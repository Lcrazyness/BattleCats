#!/usr/bin/env python3
"""Create standalone transparent PNG sprites from the supplied Gory/Sir Seal sheets.

The source screenshots are references only. Every output in the enemy folders is a
real cropped PNG with its background removed and a shared 160x160 bottom baseline.
"""
from pathlib import Path
import json
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]

ENEMIES = {
    "gory": {
        "sheet": ROOT / "enemys/Gory/Screenshot 2026-11-04 201609.png",
        "moving": [
            (65, 44, 181, 189),
            (180, 44, 294, 189),
            (294, 42, 411, 188),
            (411, 42, 526, 188),
            (526, 42, 642, 188),
            (642, 44, 758, 189),
        ],
        "attack": [
            (68, 185, 185, 345),
            (185, 182, 302, 344),
            (302, 188, 435, 328),
            (436, 187, 582, 329),
            (584, 187, 746, 333),
            (442, 301, 604, 420),
        ],
        "stats": {
            "name": "Gory", "health": 650, "damage": 24, "speed": 8,
            "spriteChangeSpeed": 7, "range": 150, "killReward": 180,
            "knockbackCount": 3, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64, "knockbackDistance": 4.5,
            "attackCooldown": 1.1, "AreaAttack": 1, "traits": []
        }
    },
    "sir-seal": {
        "sheet": ROOT / "enemys/Sir-Seal/Screenshot 2026-11-04 202024.png",
        "moving": [
            (48, 22, 226, 144),
            (226, 16, 404, 150),
            (48, 143, 226, 263),
            (48, 261, 226, 394),
        ],
        "attack": [
            (394, 23, 574, 203),
            (574, 17, 755, 210),
            (218, 142, 407, 263),
            (217, 255, 408, 384),
            (565, 181, 756, 360),
        ],
        "stats": {
            "name": "Sir Seal", "health": 1150, "damage": 30, "speed": 5.5,
            "spriteChangeSpeed": 5.5, "range": 170, "killReward": 220,
            "knockbackCount": 1, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64, "knockbackDistance": 4.5,
            "attackCooldown": 1.3, "AreaAttack": 1, "traits": ["Red"]
        }
    }
}


def remove_sheet_background(crop: Image.Image) -> Image.Image:
    """Remove screenshot beige/white background without erasing Gory's white body."""
    image = crop.convert("RGBA")
    pix = image.load()
    w, h = image.size

    # Use the median of the four sheet-background corners as the local backdrop.
    corner_samples = [
        pix[0, 0][:3], pix[w - 1, 0][:3],
        pix[0, h - 1][:3], pix[w - 1, h - 1][:3],
    ]
    bg = tuple(sorted(sample[channel] for sample in corner_samples)[2]
               for channel in range(3))

    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            delta = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            chroma = max(r, g, b) - min(r, g, b)
            # The paper backdrop is close to the sampled beige; pure white sprite
            # interiors remain opaque because they differ more strongly from it.
            if delta <= 23 and chroma <= 52:
                pix[x, y] = (r, g, b, 0)
    return image


def normalized_sprite(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    if left < 0 or top < 0 or right > sheet.width or bottom > sheet.height:
        raise ValueError(f"Frame box {box} is outside source sheet {sheet.size}")
    crop = remove_sheet_background(sheet.crop(box))
    alpha = crop.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 10 else 0).getbbox()
    if not bbox:
        raise ValueError(f"Frame {box} became empty after background removal")
    crop = crop.crop(bbox)

    # Trim only transparent fringe; keep the original artwork and its shadows.
    pad = 3
    padded = Image.new("RGBA", (crop.width + pad * 2, crop.height + pad * 2), (0, 0, 0, 0))
    padded.alpha_composite(crop, (pad, pad))
    crop = padded

    max_w, max_h = 148, 146
    scale = min(max_w / crop.width, max_h / crop.height)
    new_size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(new_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    canvas.alpha_composite(crop, ((160 - crop.width) // 2, 156 - crop.height))
    return canvas


def write_png(sheet: Image.Image, box: tuple[int, int, int, int], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = normalized_sprite(sheet, box)
    image.save(path, format="PNG", optimize=True)


def main() -> None:
    for key, config in ENEMIES.items():
        sheet_path = config["sheet"]
        if not sheet_path.is_file():
            raise FileNotFoundError(f"Missing source reference sheet: {sheet_path}")
        sheet = Image.open(sheet_path).convert("RGBA")
        expected_width = 906 if key == "gory" else 802
        required_height = max(box[3] for group in (config["moving"], config["attack"]) for box in group)
        if sheet.width != expected_width or sheet.height < required_height:
            raise ValueError(
                f"{key} sheet dimensions are incompatible with the crop map: "
                f"expected width {expected_width} and height at least {required_height}, got {sheet.size}"
            )

        folder = ROOT / "enemys" / key
        paths = {"moving": [], "attacks": []}
        for category, boxes, folder_name in (
            ("moving", config["moving"], "moving"),
            ("attacks", config["attack"], "attack"),
        ):
            for index, box in enumerate(boxes, start=1):
                frame_path = folder / folder_name / f"frame-{index:03d}.png"
                write_png(sheet, box, frame_path)
                paths[category].append(frame_path.relative_to(ROOT).as_posix())

        # Doge-style utility sprites: standalone idle, slot, and damaged PNGs.
        first_move = Image.open(folder / "moving/frame-001.png").convert("RGBA")
        first_move.save(folder / "idle.png", format="PNG", optimize=True)
        first_move.save(folder / "slot.png", format="PNG", optimize=True)
        damaged_path = folder / "damaged/frame-001.png"
        damaged_path.parent.mkdir(parents=True, exist_ok=True)
        first_move.save(damaged_path, format="PNG", optimize=True)
        damaged_rel = damaged_path.relative_to(ROOT).as_posix()

        manifest = {
            "name": config["stats"]["name"],
            "source": "Cropped from the source sheet stored alongside this asset folder.",
            "sourceUrl": (
                "https://github.com/Lcrazyness/BattleCats/blob/main/enemys/Gory/"
                "Screenshot%202026-11-04%20201609.png"
                if key == "gory" else
                "https://github.com/Lcrazyness/BattleCats/blob/main/enemys/Sir-Seal/"
                "Screenshot%202026-11-04%20202024.png"
            ),
            "moving": paths["moving"],
            "attacks": paths["attacks"],
            "attack": paths["attacks"][0],
            "attackFrameRate": 7 if key == "gory" else 5.5,
            "attackDuration": 0.86 if key == "gory" else 0.91,
            "damagedFrames": [damaged_rel],
            "knockbackFrames": [damaged_rel],
            "idle": "enemys/" + key + "/idle.png",
            "damaged": damaged_rel,
            "slot": "enemys/" + key + "/slot.png",
            "upgrade": None
        }
        (folder / "assets.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        (folder / "stats.json").write_text(json.dumps(config["stats"], indent=2) + "\n", encoding="utf-8")
        (folder / "moving/frames.json").write_text(json.dumps({"frames": paths["moving"]}, indent=2) + "\n", encoding="utf-8")
        (folder / "attack/frames.json").write_text(json.dumps({"frames": paths["attacks"]}, indent=2) + "\n", encoding="utf-8")
        (folder / "damaged/frames.json").write_text(json.dumps({"frames": [damaged_rel]}, indent=2) + "\n", encoding="utf-8")
        print(f"{key}: wrote {len(paths['moving'])} moving, {len(paths['attacks'])} attack, idle/slot/damaged PNGs")


if __name__ == "__main__":
    main()
