from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/bgg/monopolydeal/property-sheet.jpg"
OUTPUT = ROOT / "public/assets/bgg/monopolydeal/property-sheet-rectified.png"
WILD_SOURCE = ROOT / "public/assets/bgg/monopolydeal/property-wild-sheet.jpg"
WILD_OUTPUT = ROOT / "public/assets/bgg/monopolydeal/property-wild-sheet-rectified.png"

# Destination boxes are the coordinates already consumed by
# property-original.js. Source quads follow the photographed outer card edge
# in UL, LL, LR, UR order, which is the order Pillow's QUAD transform expects.
CARDS = [
    ((17, 15, 181, 281), (18, 14, 17, 295, 199, 296, 198, 15)),
    ((209, 15, 185, 283), (210, 15, 209, 296, 395, 298, 394, 16)),
    ((402, 15, 189, 284), (403, 15, 402, 298, 594, 299, 590, 14)),
    ((598, 16, 189, 285), (600, 15, 598, 299, 790, 300, 786, 14)),
    ((793, 15, 191, 285), (794, 14, 792, 299, 989, 298, 982, 12)),
    ((17, 305, 182, 285), (17, 304, 17, 590, 200, 590, 199, 306)),
    ((210, 305, 184, 288), (209, 304, 209, 593, 394, 593, 393, 305)),
    ((403, 307, 189, 285), (404, 305, 403, 592, 592, 592, 590, 307)),
    ((604, 307, 185, 285), (604, 306, 604, 592, 790, 592, 787, 307)),
    ((797, 308, 185, 284), (797, 306, 797, 592, 982, 592, 980, 307)),
]

PROPERTY_INNER_FRAMES = {
    0: {"source": ((30, 28), (28, 284), (189, 285), (191, 29)), "target": ((12, 10), (12, 270), (172, 270), (172, 10))},
    1: {"source": ((223, 29), (220, 284), (381, 287), (384, 29)), "target": ((13, 11), (13, 272), (174, 272), (174, 11))},
    2: {"source": ((421, 24), (415, 284), (576, 288), (582, 28)), "target": ((18, 10), (18, 273), (179, 273), (179, 10))},
    3: {"source": ((613, 29), (615, 291), (776, 289), (772, 28)), "target": ((18, 10), (18, 274), (179, 274), (179, 10))},
    4: {"source": ((811, 25), (812, 289), (975, 285), (970, 23)), "target": ((18, 10), (18, 274), (180, 274), (180, 10))},
    5: {"source": ((28, 316), (28, 580), (188, 580), (188, 317)), "target": ((11, 11), (11, 274), (171, 274), (171, 11))},
    6: {"source": ((221, 317), (221, 582), (383, 582), (382, 317)), "target": ((11, 12), (11, 277), (173, 277), (173, 12))},
    7: {"source": ((415, 318), (415, 581), (580, 582), (580, 319)), "target": ((12, 11), (12, 274), (177, 274), (177, 11))},
    8: {"source": ((616, 318), (616, 581), (779, 581), (778, 319)), "target": ((12, 11), (12, 274), (175, 274), (175, 11))},
    9: {"source": ((809, 319), (809, 581), (973, 581), (972, 319)), "target": ((12, 11), (12, 273), (176, 273), (176, 11))},
}

WILD_CARDS = [
    ((48, 36, 453, 695), (48, 36, 49, 728, 500, 730, 500, 34)),
    ((568, 28, 461, 696), (568, 28, 571, 724, 1029, 725, 1027, 28)),
    ((1106, 20, 462, 699), (1106, 20, 1114, 718, 1568, 719, 1560, 20)),
    ((59, 792, 461, 701), (59, 792, 61, 1493, 520, 1493, 512, 795)),
    ((584, 804, 464, 701), (584, 804, 586, 1505, 1048, 1505, 1042, 805)),
    ((1115, 795, 469, 703), (1115, 795, 1116, 1498, 1584, 1498, 1577, 795)),
]

# Inner printed frame anchors are more reliable than the low-contrast paper
# edge. Begin with the visibly skewed red/yellow card and promote the remaining
# cards only after their individual preview has been checked.
WILD_INNER_FRAMES = {
    0: {
        "source": ((80, 55), (81, 699), (478, 699), (474, 55)),
        "target": ((31, 20), (31, 663), (429, 663), (429, 20)),
    },
    1: {
        "source": ((596, 53), (607, 695), (1005, 695), (994, 48)),
        "target": ((28, 25), (28, 667), (433, 667), (433, 25)),
    },
    2: {
        "source": ((1131, 50), (1147, 695), (1546, 687), (1529, 44)),
        "target": ((28, 28), (28, 671), (434, 671), (434, 28)),
    },
    3: {
        "source": ((96, 811), (86, 1447), (483, 1452), (493, 817)),
        "target": ((30, 24), (30, 675), (431, 675), (431, 24)),
    },
    4: {
        "source": ((616, 827), (608, 1472), (1006, 1476), (1013, 831)),
        "target": ((28, 25), (28, 675), (436, 675), (436, 25)),
    },
    5: {
        "source": ((1140, 816), (1148, 1471), (1554, 1470), (1539, 816)),
        "target": ((25, 22), (25, 675), (444, 675), (444, 22)),
    },
}


def perspective_coefficients(target, source):
    matrix = []
    values = []
    for (u, v), (x, y) in zip(target, source):
        matrix.append([u, v, 1, 0, 0, 0, -x * u, -x * v])
        values.append(x)
        matrix.append([0, 0, 0, u, v, 1, -y * u, -y * v])
        values.append(y)

    # Small dependency-free Gaussian elimination for the eight homography
    # coefficients expected by Pillow's PERSPECTIVE transform.
    for column in range(8):
        pivot = max(range(column, 8), key=lambda row: abs(matrix[row][column]))
        matrix[column], matrix[pivot] = matrix[pivot], matrix[column]
        values[column], values[pivot] = values[pivot], values[column]
        divisor = matrix[column][column]
        matrix[column] = [value / divisor for value in matrix[column]]
        values[column] /= divisor
        for row in range(8):
            if row == column:
                continue
            factor = matrix[row][column]
            matrix[row] = [value - factor * base for value, base in zip(matrix[row], matrix[column])]
            values[row] -= factor * values[column]
    return values


def main():
    source = Image.open(SOURCE).convert("RGB")
    output = Image.new("RGB", source.size, "white")
    resampling = getattr(Image, "Resampling", Image).BICUBIC
    transform = getattr(Image, "Transform", Image).QUAD
    perspective = getattr(Image, "Transform", Image).PERSPECTIVE
    for index, ((x, y, width, height), quad) in enumerate(CARDS):
        anchors = PROPERTY_INNER_FRAMES[index]
        coefficients = perspective_coefficients(anchors["target"], anchors["source"])
        card = source.transform((width, height), perspective, coefficients, resample=resampling)
        output.paste(card, (x, y))
    output.save(OUTPUT, optimize=True)

    # property-original.js deliberately addresses this scan in a 1632×1530
    # coordinate system, so rectify at that same display size.
    wild_source = Image.open(WILD_SOURCE).convert("RGB").resize((1632, 1530), resampling)
    wild_output = Image.new("RGB", wild_source.size, "white")
    for index, ((x, y, width, height), quad) in enumerate(WILD_CARDS):
        anchors = WILD_INNER_FRAMES.get(index)
        if anchors:
            coefficients = perspective_coefficients(anchors["target"], anchors["source"])
            card = wild_source.transform((width, height), perspective, coefficients, resample=resampling)
        else:
            card = wild_source.transform((width, height), transform, quad, resample=resampling)
        wild_output.paste(card, (x, y))
    wild_output.save(WILD_OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
