#!/usr/bin/env python3
"""Crop seven user-supplied EoC enemy sheets into transparent Doge-format PNGs."""
from collections import deque
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FRAME = (104, 112)
MAX_ART = (96, 104)

ENEMIES = {
    "B.B.Bunny": {
        "sheet": "enemys/B.B.Bunny/Screenshot 2026-11-05 141657.png",
        "size": (706, 490), "floating": False, "attack_rate": 5,
        "idle": (72, 25, 158, 128),
        "moving": [
            (68, 154, 147, 241), (162, 153, 245, 242),
            (248, 135, 332, 241), (336, 132, 430, 241),
            (434, 142, 518, 244)
        ],
        "attack": [
            (43, 264, 141, 370), (141, 258, 237, 371),
            (245, 258, 330, 371), (322, 251, 432, 372),
            (432, 267, 541, 371)
        ],
        "hurt": (80, 411, 158, 485),
        "stats": {
            "name": "B.B.Bunny", "health": 500, "damage": 50, "speed": 22,
            "range": 110, "spriteChangeSpeed": 8, "walkSpriteChangeSpeed": 6,
            "killReward": 45, "knockbackCount": 3, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64, "knockbackDistance": 4.5,
            "attackCooldown": 1.37, "AreaAttack": 0, "traits": ["Red"]
        }
    },
    "Kang Roo": {
        "sheet": "enemys/Kang Roo/Screenshot 2026-11-05 142240.png",
        "size": (675, 423), "floating": False, "attack_rate": 6,
        "idle": (8, 18, 151, 220),
        "moving": [
            (8, 18, 151, 220), (151, 18, 307, 220),
            (8, 219, 157, 422), (152, 216, 316, 422)
        ],
        "attack": [
            (307, 18, 500, 221), (307, 217, 468, 422),
            (516, 171, 674, 422)
        ],
        # This sheet has no separate, clearly isolated hurt drawing; use its clean resting pose.
        "hurt": (8, 18, 151, 220),
        "stats": {
            "name": "Kang Roo", "health": 4000, "damage": 250, "speed": 20,
            "range": 160, "spriteChangeSpeed": 8, "walkSpriteChangeSpeed": 6,
            "killReward": 180, "knockbackCount": 1, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64, "knockbackDistance": 4.5,
            "attackCooldown": 1.2, "AreaAttack": 0, "traits": []
        }
    },
    "Squire Rel": {
        "sheet": "enemys/Squire Rel/Screenshot 2026-11-05 142420.png",
        "size": (640, 246), "floating": False, "attack_rate": 8,
        "idle": (528, 106, 638, 231),
        "moving": [
            (18, 14, 131, 105), (134, 14, 249, 106),
            (257, 10, 378, 109), (378, 8, 498, 110),
            (505, 8, 638, 111)
        ],
        "attack": [(4, 103, 145, 238), (133, 101, 280, 239)],
        # The flattened crouch at the lower-right is the only distinct reaction pose.
        "hurt": (390, 108, 528, 235),
        "stats": {
            "name": "Squire Rel", "health": 80, "damage": 30, "speed": 30,
            "range": 110, "spriteChangeSpeed": 10, "walkSpriteChangeSpeed": 8,
            "killReward": 15, "knockbackCount": 3, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.48, "knockbackDistance": 5,
            "attackCooldown": 0.53, "AreaAttack": 0, "traits": []
        }
    },
    "Mooth": {
        "sheet": "enemys/Mooth/Screenshot 2026-11-05 142612.png",
        "size": (788, 418), "floating": True, "attack_rate": 1,
        "idle": (18, 15, 153, 159),
        "moving": [
            (18, 15, 153, 159), (151, 14, 286, 161),
            (344, 12, 482, 161), (0, 213, 163, 395),
            (344, 245, 540, 390)
        ],
        "attack": [(546, 12, 788, 224)],
        "hurt": (157, 244, 334, 400),
        "stats": {
            "name": "Mooth", "health": 5000, "damage": 350, "speed": 20,
            "range": 340, "spriteChangeSpeed": 7, "walkSpriteChangeSpeed": 5,
            "killReward": 250, "knockbackCount": 1, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.72, "knockbackDistance": 4.5,
            "attackCooldown": 2.93, "AreaAttack": 1, "traits": ["Floating"]
        }
    },
    "One Horn": {
        "sheet": "enemys/One Horn/Screenshot 2026-11-05 143648.png",
        "size": (799, 435), "floating": False, "attack_rate": 2,
        "idle": (20, 12, 174, 152),
        "moving": [
            (20, 12, 174, 152), (178, 12, 336, 153),
            (340, 12, 497, 154), (500, 12, 666, 155),
            (17, 151, 176, 293), (177, 151, 339, 293),
            (339, 151, 500, 294), (501, 151, 666, 294),
            (20, 285, 175, 431), (177, 285, 338, 431)
        ],
        # One Horn uses a short repeated ram animation in-game; these poses are
        # the forward-leaning frames visible in the supplied sheet.
        "attack": [(614, 275, 768, 432)],
        "attack_local_bg_indices": [0],
        "hurt": (339, 285, 500, 431),
        "stats": {
            "name": "One Horn", "health": 15000, "damage": 500, "speed": 3,
            "range": 40, "spriteChangeSpeed": 7, "walkSpriteChangeSpeed": 3,
            "killReward": 500, "knockbackCount": 1, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64, "knockbackDistance": 4.5,
            "attackCooldown": 0.53, "AreaAttack": 1, "traits": ["Red"]
        }
    },
    "Teacher Bear": {
        "sheet": "enemys/Teacher Bear/Screenshot 2026-11-05 143853.png",
        "size": (841, 840), "floating": False, "attack_rate": 8,
        "idle": (18, 25, 153, 235),
        "moving": [
            (18, 25, 153, 235), (154, 25, 288, 235),
            (289, 25, 425, 235), (428, 25, 566, 235),
            (570, 25, 710, 235), (710, 25, 837, 235)
        ],
        "attack": [
            (20, 270, 148, 575), (145, 270, 283, 575),
            (294, 302, 515, 579), (536, 361, 724, 591)
        ],
        "hurt": (0, 620, 190, 839),
        "stats": {
            "name": "Teacher Bear", "health": 3000, "damage": 1000, "speed": 4,
            "range": 350, "spriteChangeSpeed": 6, "walkSpriteChangeSpeed": 3,
            "killReward": 400, "knockbackCount": 10, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.52, "knockbackDistance": 3.5,
            "attackCooldown": 3.57, "AreaAttack": 1, "traits": []
        }
    },
    "The Face": {
        "sheet": "enemys/The Face/Screenshot 2026-11-05 144239.png",
        "size": (828, 416), "floating": True, "attack_rate": 2,
        "idle": (19, 14, 213, 211),
        "moving": [(19, 14, 213, 211)],
        "attack": [
            (205, 14, 405, 211), (402, 14, 610, 211),
            (608, 14, 812, 212), (18, 240, 230, 408)
        ],
        "attack_rotate_last": 180,
        # No separate hurt drawing is present; use the neutral mouth-closed face.
        "hurt": (19, 14, 213, 211),
        "stats": {
            "name": "The Face", "health": 99999, "damage": 2000, "speed": 1,
            "range": 340, "spriteChangeSpeed": 5, "walkSpriteChangeSpeed": 1,
            "killReward": 1000, "knockbackCount": 2, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.85, "knockbackDistance": 5,
            "attackCooldown": 9.1, "AreaAttack": 1, "traits": ["Floating"]
        }
    }
}


def remove_border_background(image: Image.Image, tolerance: int = 38) -> Image.Image:
    """Remove any connected neutral background visible at a source-sheet edge."""
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    corners = [pixels[0, 0][:3], pixels[width - 1, 0][:3],
               pixels[0, height - 1][:3], pixels[width - 1, height - 1][:3]]
    backgrounds = []
    for color in corners:
        if color not in backgrounds:
            backgrounds.append(color)

    def is_background(index: int) -> bool:
        x, y = index % width, index // width
        r, g, b, a = pixels[x, y]
        if a <= 0:
            return False
        chroma = max(r, g, b) - min(r, g, b)
        if chroma > 60:
            return False
        return min(max(abs(r-c[0]), abs(g-c[1]), abs(b-c[2])) for c in backgrounds) <= tolerance

    seen = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.append(x)
        queue.append((height - 1) * width + x)
    for y in range(height):
        queue.append(y * width)
        queue.append(y * width + width - 1)

    while queue:
        index = queue.popleft()
        if seen[index]:
            continue
        seen[index] = 1
        if not is_background(index):
            continue
        x, y = index % width, index // width
        pixels[x, y] = (0, 0, 0, 0)
        if x: queue.append(index - 1)
        if x + 1 < width: queue.append(index + 1)
        if y: queue.append(index - width)
        if y + 1 < height: queue.append(index + width)
    return image


def crop_pose(sheet: Image.Image, box, rotate=0, local_background=False) -> Image.Image:
    left, top, right, bottom = box
    if not (0 <= left < right <= sheet.width and 0 <= top < bottom <= sheet.height):
        raise ValueError(f"Crop {box} is outside sheet {sheet.size}")
    pose = sheet.crop(box).convert("RGBA")
    if local_background:
        pose = remove_border_background(pose, tolerance=64)
    bbox = pose.getchannel("A").point(lambda value: 255 if value > 10 else 0).getbbox()
    if not bbox:
        raise ValueError(f"Empty sprite crop {box}")
    pose = pose.crop(bbox)
    if rotate:
        pose = pose.rotate(rotate, expand=True, resample=Image.Resampling.BICUBIC)
        bbox = pose.getchannel("A").point(lambda value: 255 if value > 10 else 0).getbbox()
        pose = pose.crop(bbox)
    return pose


def fit_frame(pose: Image.Image, scale: float, floating: bool) -> Image.Image:
    width, height = pose.size
    draw_width = max(1, round(width * scale))
    draw_height = max(1, round(height * scale))
    pose = pose.resize((draw_width, draw_height), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    x = (FRAME[0] - draw_width) // 2
    y = (FRAME[1] - draw_height) // 2 if floating else FRAME[1] - draw_height - 2
    frame.alpha_composite(pose, (x, y))
    return frame


def write_enemy(folder_name: str, config: dict) -> None:
    folder = ROOT / "enemys" / folder_name
    source = ROOT / config["sheet"]
    if not source.is_file():
        raise FileNotFoundError(f"Missing source sheet: {source}")
    sheet = Image.open(source).convert("RGBA")
    if sheet.size != tuple(config["size"]):
        raise ValueError(f"{folder_name}: expected {config['size']}, got {sheet.size}")
    clean = remove_border_background(sheet)

    idle = crop_pose(clean, config["idle"])
    moving = [crop_pose(clean, box) for box in config["moving"]]
    attacks = []
    local_background_indices = set(config.get("attack_local_bg_indices", []))
    for index, box in enumerate(config["attack"]):
        rotate = config.get("attack_rotate_last", 0) if index == len(config["attack"]) - 1 else 0
        attacks.append(crop_pose(clean, box, rotate, index in local_background_indices))
    hurt = crop_pose(clean, config["hurt"])

    # One common art scale across movement, idle, attack and hurt keeps animation poses stable.
    poses = [idle, *moving, *attacks, hurt]
    common_scale = min(MAX_ART[0] / max(p.width for p in poses),
                       MAX_ART[1] / max(p.height for p in poses))
    normalized = {
        "idle": fit_frame(idle, common_scale, config["floating"]),
        "moving": [fit_frame(p, common_scale, config["floating"]) for p in moving],
        "attack": [fit_frame(p, common_scale, config["floating"]) for p in attacks],
        "hurt": fit_frame(hurt, common_scale, config["floating"])
    }

    for kind in ("moving", "attack", "damaged"):
        output = folder / kind
        output.mkdir(parents=True, exist_ok=True)
        for old in output.glob("frame-*.png"):
            old.unlink()

    def save_group(kind: str, frames):
        output = folder / kind
        paths = []
        for index, frame in enumerate(frames, 1):
            path = output / f"frame-{index:03d}.png"
            frame.save(path, format="PNG", optimize=True)
            paths.append(path.relative_to(ROOT).as_posix())
        (output / "frames.json").write_text(
            json.dumps({"frames": paths}, indent=2) + "\n", encoding="utf-8"
        )
        return paths

    moving_paths = save_group("moving", normalized["moving"])
    attack_paths = save_group("attack", normalized["attack"])
    damaged_paths = save_group("damaged", [normalized["hurt"]])
    normalized["idle"].save(folder / "idle.png", format="PNG", optimize=True)
    normalized["idle"].save(folder / "slot.png", format="PNG", optimize=True)

    manifest = {
        "name": config["stats"]["name"],
        "source": "User-provided Battle Cats enemy sprite reference sheet; original game art belongs to its respective rights holders.",
        "sourceUrl": "https://github.com/Lcrazyness/BattleCats/tree/main/" + config["sheet"].rsplit("/", 1)[0],
        "moving": moving_paths,
        "attacks": attack_paths,
        "attack": attack_paths[0],
        "attackFrameRate": config["attack_rate"],
        "damagedFrames": damaged_paths,
        "knockbackFrames": damaged_paths,
        "idle": f"enemys/{folder_name}/idle.png",
        "damaged": damaged_paths[0],
        "slot": f"enemys/{folder_name}/slot.png",
        "upgrade": None,
        "traits": config["stats"]["traits"]
    }
    (folder / "assets.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (folder / "stats.json").write_text(json.dumps(config["stats"], indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for folder_name, config in ENEMIES.items():
        write_enemy(folder_name, config)
        print(f"{folder_name}: {len(config['moving'])} moving, {len(config['attack'])} attacking, 1 hurt")


if __name__ == "__main__":
    main()
