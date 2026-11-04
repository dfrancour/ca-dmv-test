#!/usr/bin/env python3
"""Draw site/og.png, the picture shown when a link to the site is shared: the home page's
licence plate (site/js/views/home.js) on the page's background, with the site's name.

    python3 scripts/og_image.py

Needs Pillow, and the Liberation fonts (fonts-liberation on Debian and Ubuntu).
Run it again only if the plate or the colours change.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "site" / "og.png"
FONTS = Path("/usr/share/fonts/truetype/liberation")
W, H = 1200, 630
S = 2  # drawn at twice the size, then reduced, for smooth edges


def oklch(l, c, h):
    """An oklch() colour from site/styles.css, as sRGB."""
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_, m_, s_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3, (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, (l - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )
    gamma = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(round(255 * min(1, max(0, gamma(x)))) for x in rgb)


# The light theme's tokens.
BG = oklch(0.98, 0.005, 220)
INK = oklch(0.18, 0.008, 220)
PLATE = (255, 255, 255)
RIM = oklch(0.80, 0.01, 220)
PLATE_INK = oklch(0.32, 0.13, 265)
SCRIPT = oklch(0.52, 0.2, 25)
STICKER = oklch(0.86, 0.15, 92)


def text_fitted(text, font, width, fill):
    """Text squeezed to a width, as the plate's textLength does."""
    box = font.getbbox(text)
    img = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((-box[0], -box[1]), text, font=font, fill=fill)
    return img.resize((round(width), img.height), Image.LANCZOS)


def main():
    img = Image.new("RGB", (W * S, H * S), BG)

    # The plate is 300 x 150 in home.js; here k times that, centred a little above the middle.
    k = 2.4 * S
    pw, ph = 300 * k, 150 * k
    x0, y0 = (W * S - pw) / 2, 85 * S
    at = lambda x, y: (x0 + x * k, y0 + y * k)

    shadow = Image.new("L", img.size, 0)
    ImageDraw.Draw(shadow).rounded_rectangle([*at(1, 7), *at(299, 155)], radius=12 * k, fill=60)
    img.paste(Image.new("RGB", img.size, INK), (0, 0), shadow.filter(ImageFilter.GaussianBlur(14 * k)))

    d = ImageDraw.Draw(img)
    d.rounded_rectangle([*at(1, 1), *at(299, 149)], radius=12 * k, fill=PLATE, outline=RIM, width=round(1.5 * k))
    d.rounded_rectangle([*at(7, 7), *at(293, 143)], radius=8 * k, outline=RIM, width=round(1 * k))
    d.rounded_rectangle([*at(244, 16), *at(276, 35)], radius=2 * k, fill=STICKER)

    script = ImageFont.truetype(str(FONTS / "LiberationSerif-BoldItalic.ttf"), round(25 * k))
    d.text(at(150, 41), "California", font=script, fill=SCRIPT, anchor="ms")

    plate = ImageFont.truetype(str(FONTS / "LiberationSansNarrow-Bold.ttf"), round(84 * k))
    word = text_fitted("PRACTICE", plate, 236 * k, PLATE_INK)
    img.paste(word, (round(at(150, 0)[0] - word.width / 2), round(at(0, 122)[1] - word.height)), word)

    name = ImageFont.truetype(str(FONTS / "LiberationSans-Bold.ttf"), 52 * S)
    d.text((W * S / 2, 545 * S), "California DMV Practice Test", font=name, fill=INK, anchor="ms")

    img.resize((W, H), Image.LANCZOS).save(OUT, optimize=True)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
