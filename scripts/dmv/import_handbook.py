#!/usr/bin/env python3
"""Turn the fetched handbook pages into site/data/handbook/.

    python3 scripts/dmv/fetch.py && python3 scripts/dmv/import_handbook.py

Writes one file per section (sections/NN.json): a flat list of blocks, each with
an id that is kept across imports. A block whose text is unchanged keeps its id;
one that was edited keeps it when it is still clearly the same block. The report
at the end lists what changed, so facts that quote edited text can be reviewed.

Figures are downloaded to figures/ (cached in .cache/dmv/images/).
"""

import difflib
import html
import json
import re
import secrets
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "dmv"
OUT = ROOT / "site" / "data" / "handbook"
ORIGIN = "https://www.dmv.ca.gov"
VOID = {"img", "br", "hr", "input", "meta", "link", "source", "wbr"}
SIMILAR = 0.6  # how alike an edited block must be to keep its id


# ---------- a minimal DOM ----------

class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def cls(self):
        return self.attrs.get("class", "").split()

    def find(self, pred):
        if pred(self):
            return self
        for child in self.children:
            if isinstance(child, Node) and (hit := child.find(pred)):
                return hit
        return None

    def text(self):
        return "".join(c if isinstance(c, str) else c.text() for c in self.children)


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse(markup):
    builder = TreeBuilder()
    builder.feed(markup)
    return builder.root


# ---------- inline markup: strong, em, a, br; everything else becomes text ----------

def squash(text):
    return re.sub(r"\s+", " ", text.replace(" ", " "))


def inline(node, images=None):
    markup = re.sub(r" {2,}", " ", inline_parts(node, images))
    return re.sub(r"\s*<br>\s*", "<br>", markup).strip()


def inline_parts(node, images):
    """The markup of node's children. Only the outermost call strips whitespace:
    the handbook often puts the space between words inside a tag ("<strong>Wet
    road: </strong>Reduce"), and stripping there would join the words."""
    out = []
    for child in node.children:
        if isinstance(child, str):
            out.append(html.escape(squash(child), quote=False))
            continue
        tag, cls = child.tag, child.cls()
        if "mobile-title" in cls or "format-label__text" in cls:
            continue
        if tag == "img":
            if images is not None:
                images.append(child)
            continue
        if tag == "br":
            out.append("<br>")
        elif tag in ("strong", "b"):
            out.append(wrap("<strong>", inline_parts(child, images), "</strong>"))
        elif tag in ("em", "i"):
            out.append(wrap("<em>", inline_parts(child, images), "</em>"))
        elif tag == "a" and (href := absolute(child.attrs.get("href", ""))):
            out.append(wrap(f'<a href="{html.escape(href)}">', inline_parts(child, images), "</a>"))
        elif tag in ("ul", "ol"):
            continue  # nested lists are handled by the list walker
        else:
            out.append(inline_parts(child, images))
    return "".join(out)


def wrap(start, inner, end):
    """Put a tag around inner, moving whitespace at its edges outside the tag."""
    core = inner.strip()
    if not core:
        return " " if inner else ""
    lead = " " if inner[0].isspace() else ""
    trail = " " if inner[-1].isspace() else ""
    return f"{lead}{start}{core}{end}{trail}"


def absolute(href):
    if href.startswith("/"):
        href = ORIGIN + href
    return href if href.startswith(("http://", "https://", "mailto:")) else ""


def plain(markup):
    return squash(html.unescape(re.sub(r"<[^>]+>", " ", markup))).strip()


# ---------- blocks ----------

def figure_block(img, caption=""):
    src = absolute(img.attrs.get("src", ""))
    block = {"type": "figure", "src": src, "alt": squash(img.attrs.get("alt", "")).strip()}
    if caption:
        block["caption"] = caption
    for dim in ("width", "height"):
        if img.attrs.get(dim, "").isdigit():
            block[dim] = int(img.attrs[dim])
    return block


def list_items(lst):
    items = []
    for li in (c for c in lst.children if isinstance(c, Node) and c.tag == "li"):
        paragraphs = [c for c in li.children if isinstance(c, Node) and c.tag == "p"]
        if paragraphs:
            markup = "".join(f"<p>{inline(p)}</p>" for p in paragraphs if inline(p))
        else:
            markup = inline(li)
        item = {"html": markup}
        sub = next((c for c in li.children if isinstance(c, Node) and c.tag in ("ul", "ol")), None)
        if sub is not None:
            item["items"] = list_items(sub)
        items.append(item)
    return items


def walk(node, blocks):
    for child in node.children:
        if not isinstance(child, Node):
            continue
        tag, cls = child.tag, child.cls()
        if "handbook-formats" in cls:
            return False
        if tag in ("h2", "h3", "h4", "h5"):
            text = inline(child)
            if plain(text) == "Additional Formats":
                return False
            if re.match(r"Section \d+:", plain(text)):
                continue  # the page title; the section carries it
            blocks.append({"type": "heading", "level": int(tag[1]), "html": text})
        elif tag == "p":
            images = []
            note = child.find(lambda n: any(c.startswith("format-label--") for c in n.cls()))
            markup = inline(child, images)
            blocks.extend(figure_block(img) for img in images)
            if not re.search(r"\w", plain(markup)):
                continue  # empty, or a stray mark: one page has a paragraph that is only "."
            if note is not None:
                kind = next(c for c in note.cls() if c.startswith("format-label--")).split("--")[1]
                blocks.append({"type": "note", "kind": kind, "html": markup})
            else:
                blocks.append({"type": "paragraph", "html": markup})
        elif tag in ("ul", "ol"):
            blocks.append({"type": "list", "ordered": tag == "ol", "items": list_items(child)})
        elif tag == "figure" and "wp-block-table" in cls:
            table = child.find(lambda n: n.tag == "table")
            head = [inline(th) for th in iter_tags(table, "th")]
            rows, pictures = [], []
            for tr in iter_tags(table, "tr"):
                cells = []
                for col, td in enumerate(iter_tags(tr, "td")):
                    images = []
                    cells.append(inline(td, images))
                    pictures += [(img, head[col] if col < len(head) else "") for img in images]
                if cells:
                    rows.append(cells)
            if pictures and not any(plain(c) for r in rows for c in r):
                # A table of pictures (the hand signals): each one is a figure, captioned by its column.
                blocks.extend(figure_block(img, caption) for img, caption in pictures)
            else:
                blocks.append({"type": "table", "head": head, "rows": rows})
        elif tag == "figure":
            img = child.find(lambda n: n.tag == "img")
            cap = child.find(lambda n: n.tag == "figcaption")
            if img is not None:
                blocks.append(figure_block(img, inline(cap) if cap is not None else ""))
        elif tag == "img":
            blocks.append(figure_block(child))
        else:
            if walk(child, blocks) is False:
                return False
    return True


def iter_tags(node, tag):
    for child in node.children:
        if isinstance(child, Node):
            if child.tag == tag:
                yield child
            else:
                yield from iter_tags(child, tag)


def page_blocks(markup):
    root = parse(markup)
    content = root.find(lambda n: "handbook-page-content" in n.cls())
    title = root.find(lambda n: n.tag == "h2" and re.match(r"\s*Section \d+:", n.text()))
    blocks = []
    walk(content, blocks)
    number, name = re.match(r"\s*Section (\d+):\s*(.*?)\s*(\(Continued\))?\s*$", squash(title.text())).group(1, 2)
    return int(number), name, blocks


# ---------- ids that survive re-imports ----------

def signature(node):
    """What identifies a block or list item: its type and its text (or image)."""
    if node["type"] == "figure":
        return f"figure:{node['src']}"
    if node["type"] == "table":
        return "table:" + plain(" ".join(node["head"] + [c for r in node["rows"] for c in r]))
    if node["type"] == "list":
        return "list:" + " | ".join(plain(i["html"]) for i in node["items"])
    return f"{node['type']}:{plain(node.get('html', ''))}"


def nodes(blocks):
    """Every block and list item, in reading order."""
    for block in blocks:
        yield block
        if block["type"] == "list":
            yield from items(block["items"])


def items(entries):
    for item in entries:
        item.setdefault("type", "item")
        yield item
        yield from items(item.get("items", []))


def assign_ids(blocks, previous, taken):
    old = [n for n in nodes(previous)]
    by_sig = {}
    for n in old:
        by_sig.setdefault(signature(n), []).append(n)
    used, report = set(), {"kept": 0, "edited": [], "added": [], "removed": []}

    fresh = list(nodes(blocks))
    for n in fresh:
        for candidate in by_sig.get(signature(n), []):
            if candidate["id"] not in used:
                n["id"] = candidate["id"]
                used.add(candidate["id"])
                report["kept"] += 1
                break

    leftovers = [o for o in old if o["id"] not in used]
    for n in fresh:
        if "id" in n:
            continue
        sig, best, score = signature(n), None, SIMILAR
        for o in leftovers:
            if o["id"] in used or o["type"] != n["type"]:
                continue
            ratio = difflib.SequenceMatcher(None, signature(o), sig).ratio()
            if ratio >= score:
                best, score = o, ratio
        if best is not None:
            n["id"] = best["id"]
            used.add(best["id"])
            report["edited"].append(n["id"])
        else:
            n["id"] = new_id(taken)
            report["added"].append(n["id"])
        taken.add(n["id"])

    report["removed"] = [o["id"] for o in old if o["id"] not in used]
    for n in fresh:
        if n["type"] == "item":
            del n["type"]
    return report


def new_id(taken):
    while True:
        candidate = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(6))
        if candidate not in taken:
            return candidate


def order(block):
    """Put id first so the JSON reads naturally."""
    out = {"id": block["id"]}
    for key, value in block.items():
        if key == "id":
            continue
        out[key] = [order(i) for i in value] if key == "items" else value
    return out


# ---------- figures ----------

def localize(blocks):
    figures = OUT / "figures"
    figures.mkdir(parents=True, exist_ok=True)
    cache = CACHE / "images"
    cache.mkdir(parents=True, exist_ok=True)
    for block in blocks:
        if block["type"] != "figure":
            continue
        name = re.sub(r"[^A-Za-z0-9._-]", "-", block["src"].rsplit("/", 1)[-1])
        cached = cache / name
        if not cached.exists():
            req = urllib.request.Request(block["src"], headers={"User-Agent": "Mozilla/5.0 (handbook import)"})
            with urllib.request.urlopen(req, timeout=60) as res:
                cached.write_bytes(res.read())
        block["file"] = f"figures/{compress(cached, figures)}"
        if "width" not in block:
            from PIL import Image

            block["width"], block["height"] = Image.open(cached).size


def compress(source, folder):
    """Diagrams and photos become WebP (about a seventh the size); the small sign GIFs stay as they are."""
    from PIL import Image  # the import's one dependency: pip install pillow

    image = Image.open(source)
    if image.format == "GIF" or source.stat().st_size < 8_000:
        (folder / source.name).write_bytes(source.read_bytes())
        return source.name
    name = source.with_suffix(".webp").name
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    image.save(folder / name, "WEBP", quality=82, method=6)
    return name


# ---------- main ----------

def main():
    manifest = json.loads((CACHE / "manifest.json").read_text())
    sections = {}
    for slug in manifest["pages"]:
        markup = (CACHE / "handbook" / f"{slug}.html").read_text(encoding="utf-8")
        number, name, blocks = page_blocks(markup)
        section = sections.setdefault(number, {"number": number, "title": name, "pages": [], "blocks": []})
        section["pages"].append(f"{manifest['handbook']}{slug}/")
        section["blocks"].extend(blocks)

    (OUT / "sections").mkdir(parents=True, exist_ok=True)
    taken = set()
    previous = {}
    for path in (OUT / "sections").glob("*.json"):
        data = json.loads(path.read_text())
        previous[data["number"]] = data["blocks"]
        taken.update(n["id"] for n in nodes(data["blocks"]))

    totals = {"kept": 0, "edited": [], "added": [], "removed": []}
    for number, section in sorted(sections.items()):
        localize(section["blocks"])
        report = assign_ids(section["blocks"], previous.get(number, []), taken)
        totals["kept"] += report["kept"]
        for key in ("edited", "added", "removed"):
            totals[key] += [f"{number}:{i}" for i in report[key]]
        section["blocks"] = [order(b) for b in section["blocks"]]
        path = OUT / "sections" / f"{number:02d}.json"
        path.write_text(json.dumps(section, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    edition = {
        "title": "California Driver's Handbook",
        "publisher": "California Department of Motor Vehicles",
        "source": manifest["handbook"],
        "fetched": manifest["fetched"],
        "license": {
            "name": "CC BY-NC 4.0",
            "url": "https://creativecommons.org/licenses/by-nc/4.0/",
            "attribution": "California Driver’s Handbook, California Department of Motor Vehicles, licensed under CC BY-NC 4.0.",
            "changes": "Reformatted for the web and divided into shorter parts; the handbook’s text is unchanged. The practice questions and explanations are ours, based on it.",
        },
        "sections": [
            {"number": n, "title": s["title"], "file": f"sections/{n:02d}.json"}
            for n, s in sorted(sections.items())
        ],
    }
    (OUT / "edition.json").write_text(json.dumps(edition, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"{len(sections)} sections. Ids kept: {totals['kept']}, edited: {len(totals['edited'])}, "
          f"added: {len(totals['added'])}, removed: {len(totals['removed'])}")
    if previous:
        for key in ("edited", "added", "removed"):
            if totals[key]:
                print(f"  {key}: {' '.join(totals[key])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
