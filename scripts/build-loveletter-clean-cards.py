from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/bgg/loveletter/cards-clean-source"
OUTPUT = ROOT / "public/assets/games/loveletter/cards-clean-zh"
SIZE = (300, 419)
FONT = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"

NAMES = {
    "guard": "侍卫",
    "priest": "牧师",
    "baron": "男爵",
    "handmaid": "侍女",
    "prince": "王子",
    "king": "国王",
    "countess": "伯爵夫人",
    "princess": "公主",
}

# Clean BGG singles exist for four cards. The other four are cut from BGG
# image 1455645, using the outer gold frame rather than the photographed table.
SHEET_BOXES = {
    "priest": (290, 38, 528, 371),
    "handmaid": (765, 38, 1010, 371),
    "king": (291, 371, 533, 712),
    "countess": (527, 371, 774, 712),
}

# Inner parchment polygons exclude the surrounding gold frame and ornaments.
PARCHMENT = {
    "guard": (18, 307, 282, 400),
    "priest": (18, 330, 282, 400),
    "baron": (18, 307, 282, 400),
    "handmaid": (18, 328, 282, 400),
    "prince": (18, 307, 282, 400),
    "king": (18, 329, 282, 400),
    "countess": (18, 326, 282, 400),
    "princess": (18, 307, 282, 400),
}


def fit_card(image):
    return image.resize(SIZE, getattr(Image, "Resampling", Image).LANCZOS)


def source_card(slug, sheet):
    single = SOURCE / f"{slug}.jpg"
    if single.exists():
        return fit_card(Image.open(single).convert("RGB"))
    return fit_card(sheet.crop(SHEET_BOXES[slug]))


def repair_rules_panel(card, slug):
    box = PARCHMENT[slug]
    left, top, right, bottom = box
    width, height = right - left, bottom - top

    # Estimate the original parchment from its light pixels, excluding ink.
    samples = []
    for red, green, blue in card.crop(box).getdata():
        if min(red, green, blue) > 125 and max(red, green, blue) - min(red, green, blue) < 75:
            samples.append((red, green, blue))
    base = tuple(sum(pixel[channel] for pixel in samples) // len(samples) for channel in range(3))
    rng = random.Random(slug)
    repaired = Image.new("RGB", (width, height))
    pixels = repaired.load()
    for y in range(height):
        vertical = round(4 * (1 - abs((y / max(height - 1, 1)) * 2 - 1)))
        for x in range(width):
            grain = rng.randint(-4, 4)
            pixels[x, y] = tuple(max(0, min(255, value + vertical + grain)) for value in base)
    repaired = repaired.filter(ImageFilter.GaussianBlur(.45))

    mask = Image.new("L", (width, height), 0)
    inset = 7
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, width - 1, height - 1),
        radius=18,
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(1.0))
    card.paste(repaired, box, mask)

    name = NAMES[slug]
    font_size = 35 if len(name) <= 2 else 29
    font = ImageFont.truetype(FONT, font_size, index=2)
    draw = ImageDraw.Draw(card)
    bounds = draw.textbbox((0, 0), name, font=font)
    text_width = bounds[2] - bounds[0]
    text_height = bounds[3] - bounds[1]
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    draw.text(
        (round(center_x - text_width / 2), round(center_y - text_height / 2 - bounds[1])),
        name,
        font=font,
        fill=(66, 37, 26),
    )
    return card


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE / "all-cards.jpg").convert("RGB")
    reference_card = source_card("guard", sheet)
    reference_edge_4 = reference_card.crop((296, 0, 300, 419))
    reference_edge_5 = reference_card.crop((295, 0, 300, 419))
    for slug in NAMES:
        card = repair_rules_panel(source_card(slug, sheet), slug)
        if slug in {"priest", "king"}:
            aligned = Image.new("RGB", SIZE)
            aligned.paste(card.resize((295, 419), getattr(Image, "Resampling", Image).LANCZOS), (0, 0))
            aligned.paste(reference_edge_5, (295, 0))
            card = aligned
        elif slug == "countess":
            card.paste(reference_edge_4, (296, 0))
        card.save(OUTPUT / f"{slug}.png", optimize=True)


if __name__ == "__main__":
    main()
