from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/games/loveletter/cards-zh-v2/guard.png"
OUTPUT = ROOT / "public/assets/games/loveletter/cards-framed-prototype/guard.png"

# The generated preview contains a narrow photographed tabletop outside the
# outer gold frame. These coordinates retain the gold frame and remove that rim.
GOLD_FRAME_BOX = (24, 14, 1012, 1477)
CANVAS_SIZE = (936, 1360)  # exact 234:340 UI aspect ratio at 4x
INSET = 13
RADIUS = 22


def vertical_gradient(size, top, bottom):
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / max(height - 1, 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        draw.line((0, y, width, y), fill=color)
    return image


def main():
    source = Image.open(SOURCE).convert("RGB").crop(GOLD_FRAME_BOX)

    # Preserve the crop's proportions and center it; never stretch the artwork.
    available = (CANVAS_SIZE[0] - INSET * 2, CANVAS_SIZE[1] - INSET * 2)
    scale = min(available[0] / source.width, available[1] / source.height)
    fitted = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        getattr(Image, "Resampling", Image).LANCZOS,
    )

    card = vertical_gradient(CANVAS_SIZE, (116, 52, 68), (61, 24, 35))
    # A restrained cloth-like variation keeps the backing related to the table.
    texture = Image.effect_noise(CANVAS_SIZE, 7).convert("L").filter(ImageFilter.GaussianBlur(0.7))
    texture_color = Image.new("RGB", CANVAS_SIZE, (117, 58, 70))
    card = Image.composite(texture_color, card, texture.point(lambda p: max(0, min(22, p - 116))))

    x = (CANVAS_SIZE[0] - fitted.width) // 2
    y = (CANVAS_SIZE[1] - fitted.height) // 2
    card.paste(fitted, (x, y))

    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(
        (x - 2, y - 2, x + fitted.width + 1, y + fitted.height + 1),
        radius=8,
        outline=(224, 188, 114),
        width=2,
    )

    alpha = Image.new("L", CANVAS_SIZE, 0)
    ImageDraw.Draw(alpha).rounded_rectangle((0, 0, CANVAS_SIZE[0] - 1, CANVAS_SIZE[1] - 1), radius=RADIUS, fill=255)
    result = card.convert("RGBA")
    result.putalpha(alpha)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
