# California Driver's License Knowledge Test Prep

A study site for the California DMV knowledge test: a reader for the California Driver's Handbook and a practice quiz built on it. It's static, dependency-free and offline-capable (a PWA), and deployed to Vercel.

## Read first

| Doc | What's in it |
|---|---|
| `docs/architecture.md` | The content model: handbook blocks → facts → questions, the outline and skim parts, how a test is assembled, and how to bring in a new edition |
| `docs/questions.md` | How to write and rate questions; the quality bar every question must meet |
| `docs/design.md` | How the site looks and behaves, and why |
| `docs/evaluation.md` | How content quality is measured, with baselines to compare against |
| `README.md` | Layout, local development, deployment |

## Commands

```sh
python3 scripts/serve.py                 # dev server on 127.0.0.1:8000, live reload
node scripts/check.mjs                   # content checks; --write rebuilds the pages and site/precache.json
node --test "tests/*.test.mjs"           # unit tests
```

Before committing, `node scripts/check.mjs` and `node --test "tests/*.test.mjs"` must both pass. Vercel's build runs both and won't deploy otherwise.

## Rules

- **No dependencies and no build step in `site/`.** It's plain HTML, CSS and JavaScript modules, served as they are. Scripts in `scripts/` may use Python's standard library, or Node's with no packages; only the handbook import and `og_image.py` need Pillow.
- **Relative URLs only** (`styles.css`, not `/styles.css`), relative to the site's root: every page's `<base href>` points there. Build them with `site/js/pages.js` (see "Pages and addresses" in `docs/architecture.md`).
- **Who writes what:**
  - `site/data/handbook/` and `site/data/questions/dmv-samples.json` are written by the import scripts; never hand-edit them.
  - The pages (`site/index.html`, `site/handbook/`, `site/practice/`, `site/quiz/`, `site/results/`, `site/404.html`) and `sitemap.xml`, `robots.txt`, `llms.txt` are built from the views by `node scripts/check.mjs --write`; change the view or `scripts/pages.mjs`, never the page.
  - `outline.json`, `facts/` and our question files are editorial: edit them directly, then run the check.
- **Handbook text is the DMV's.** Never alter it. Our words (facts, titles, questions, explanations) live in our files.
- **New or changed content gets evaluated** before it ships, by the methods in `docs/evaluation.md`: facts and questions by blind review, labels by measured agreement.
- **Design:** read `docs/design.md` before changing the UI. Remove before adding. Check at phone width, in light and dark.
- **Licence:** the handbook is CC BY-NC 4.0. Nothing commercial, and the credit stays visible.
- **Git:** commit straight to `main`, and only when asked.
