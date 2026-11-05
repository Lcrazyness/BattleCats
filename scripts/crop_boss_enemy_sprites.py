#!/usr/bin/env python3
"""Crop enemy sprite poses from the user-provided reference sheets.

The screenshots stay in their reference folders. Runtime sprites are standalone,
transparent PNGs under the same Doge-style folder layout and use Doge's 104x112
frame canvas. Gross Cat and Axe Cat frames are also normalized to a shared canvas
and common visible-art scale so their animation poses do not jump in size.
"""
from pathlib import Path
import json
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
ENEMIES = {
    "Gory": {
        "key": "gory",
        "sheet": ROOT / "enemys/Gory/Screenshot 2026-11-04 201609.png",
        "expected_width": 906,
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
            "name": "Gory",
            "health": 650,
            "damage": 24,
            "speed": 8,
            "range": 150,
            "spriteChangeSpeed": 7,
            "killReward": 180,
            "knockbackCount": 3,
            "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64,
            "knockbackDistance": 4.5,
            "attackCooldown": 1.1,
            "AreaAttack": 1
        },
        "attack_rate": 6
    },
    "Sir-Seal": {
        "key": "sir-seal",
        "sheet": ROOT / "enemys/Sir-Seal/Screenshot 2026-11-04 202024.png",
        "expected_width": 802,
        "moving": [
            (48, 22, 226, 142),
            (226, 16, 404, 142),
            (48, 143, 226, 260),
            (48, 261, 226, 394),
        ],
        "attack": [
            (400, 23, 574, 197),
            (575, 17, 755, 195),
            (228, 143, 400, 260),
            (228, 264, 400, 384),
            (575, 203, 756, 360),
        ],
        "stats": {
            "name": "Sir Seal",
            "health": 1150,
            "damage": 30,
            "speed": 5.5,
            "range": 170,
            "spriteChangeSpeed": 5.5,
            "killReward": 220,
            "knockbackCount": 1,
            "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64,
            "knockbackDistance": 4.5,
            "attackCooldown": 1.3,
            "AreaAttack": 1,
            "traits": ["Red"]
        },
        "attack_rate": 6
    }
}


def remove_sheet_background(crop: Image.Image) -> Image.Image:
    """Remove connected beige/white sheet background while preserving white artwork."""
    image = crop.convert("RGBA")
    px = image.load()
    width, height = image.size
    corners = [px[0, 0][:3], px[width - 1, 0][:3],
               px[0, height - 1][:3], px[width - 1, height - 1][:3]]
    background = tuple(sorted(sample[channel] for sample in corners)[2]
                       for channel in range(3))

    for y in range(height):
        for x in range(width):
            r, g, b, alpha = px[x, y]
            if alpha <= 12:
                continue
            delta = max(abs(r - background[0]), abs(g - background[1]), abs(b - background[2]))
            chroma = max(r, g, b) - min(r, g, b)
            if delta <= 23 and chroma <= 52:
                px[x, y] = (r, g, b, 0)
    return image


def crop_pose(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    if left < 0 or top < 0 or right > sheet.width or bottom > sheet.height:
        raise ValueError(f"Frame box {box} is outside source sheet {sheet.size}")
    pose = remove_sheet_background(sheet.crop(box))
    bbox = pose.getchannel("A").point(lambda value: 255 if value > 10 else 0).getbbox()
    if not bbox:
        raise ValueError(f"Frame {box} is empty after removing its sheet background")
    pose = pose.crop(bbox)
    padded = Image.new("RGBA", (pose.width + 4, pose.height + 4), (0, 0, 0, 0))
    padded.alpha_composite(pose, (2, 2))
    return padded


def fit_to_canvas(pose: Image.Image, canvas_size: tuple[int, int],
                  max_art_size: tuple[int, int], scale: float | None = None) -> Image.Image:
    canvas_width, canvas_height = canvas_size
    max_width, max_height = max_art_size
    fit_scale = min(max_width / pose.width, max_height / pose.height)
    draw_scale = min(fit_scale, scale) if scale is not None else fit_scale
    draw_size = (max(1, round(pose.width * draw_scale)),
                 max(1, round(pose.height * draw_scale)))
    pose = pose.resize(draw_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.alpha_composite(pose, ((canvas_width - pose.width) // 2,
                                  canvas_height - pose.height - 2))
    return canvas


def crop_enemy_folder(folder_name: str, config: dict) -> None:
    key = config["key"]
    sheet_path = config["sheet"]
    if not sheet_path.is_file():
        raise FileNotFoundError(f"Missing source reference sheet: {sheet_path}")
    sheet = Image.open(sheet_path).convert("RGBA")
    required_height = max(box[3] for group in (config["moving"], config["attack"]) for box in group)
    if sheet.width != config["expected_width"] or sheet.height < required_height:
        raise ValueError(
            f"{key} sheet dimensions do not match its crop map: "
            f"expected width {config['expected_width']} and height >= {required_height}, got {sheet.size}"
        )

    folder = ROOT / "enemys" / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    moving_poses = [crop_pose(sheet, box) for box in config["moving"]]
    attack_poses = [crop_pose(sheet, box) for box in config["attack"]]

    # All poses for an enemy share one scale, one 104x112 canvas and one foot baseline.
    all_poses = moving_poses + attack_poses
    largest_width = max(pose.width for pose in all_poses)
    largest_height = max(pose.height for pose in all_poses)
    common_scale = min(96 / largest_width, 106 / largest_height)

    moving_paths = []
    attack_paths = []
    for index, pose in enumerate(moving_poses, start=1):
        path = folder / "moving" / f"frame-{index:03d}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        fit_to_canvas(pose, (104, 112), (96, 106), common_scale).save(path, optimize=True)
        moving_paths.append(path.relative_to(ROOT).as_posix())
    for index, pose in enumerate(attack_poses, start=1):
        path = folder / "attack" / f"frame-{index:03d}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        fit_to_canvas(pose, (104, 112), (96, 106), common_scale).save(path, optimize=True)
        attack_paths.append(path.relative_to(ROOT).as_posix())

    # Doge-style single idle, slot, and damaged sprite files.
    first_move = Image.open(ROOT / moving_paths[0]).convert("RGBA")
    first_move.save(folder / "idle.png", format="PNG", optimize=True)
    first_move.save(folder / "slot.png", format="PNG", optimize=True)
    damaged_path = folder / "damaged" / "frame-001.png"
    damaged_path.parent.mkdir(parents=True, exist_ok=True)
    first_move.save(damaged_path, format="PNG", optimize=True)
    damaged_rel = damaged_path.relative_to(ROOT).as_posix()
    idle_rel = (folder / "idle.png").relative_to(ROOT).as_posix()
    slot_rel = (folder / "slot.png").relative_to(ROOT).as_posix()

    source_url = (
        "https://github.com/Lcrazyness/BattleCats/blob/main/enemys/Gory/"
        "Screenshot%202026-11-04%20201609.png"
        if folder_name == "Gory" else
        "https://github.com/Lcrazyness/BattleCats/blob/main/enemys/Sir-Seal/"
        "Screenshot%202026-11-04%20202024.png"
    )
    manifest = {
        "name": config["stats"]["name"],
        "source": "Battle Cats sprite artwork. Original game art belongs to its respective rights holders.",
        "sourceUrl": source_url,
        "moving": moving_paths,
        "attacks": attack_paths,
        "attack": attack_paths[0],
        "attackFrameRate": config["attack_rate"],
        "damagedFrames": [damaged_rel],
        "knockbackFrames": [damaged_rel],
        "idle": idle_rel,
        "damaged": damaged_rel,
        "slot": slot_rel,
        "upgrade": None
    }
    (folder / "assets.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (folder / "stats.json").write_text(json.dumps(config["stats"], indent=2) + "\n", encoding="utf-8")
    (folder / "moving" / "frames.json").write_text(json.dumps({"frames": moving_paths}, indent=2) + "\n", encoding="utf-8")
    (folder / "attack" / "frames.json").write_text(json.dumps({"frames": attack_paths}, indent=2) + "\n", encoding="utf-8")
    (folder / "damaged" / "frames.json").write_text(json.dumps({"frames": [damaged_rel]}, indent=2) + "\n", encoding="utf-8")
    print(f"{folder_name}: cropped {len(moving_paths)} moving and {len(attack_paths)} attack PNGs at common scale")


def normalize_unit_frames(folder_name: str) -> None:
    """Give all animation poses for a cat one common visible-art scale and baseline."""
    folder = ROOT / "Cats" / folder_name
    manifest_path = folder / "assets.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Missing cat asset manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    paths = []
    for key in ("moving", "attacks", "attackFrames", "damagedFrames", "knockbackFrames"):
        values = manifest.get(key, [])
        if isinstance(values, list):
            paths.extend(values)
    for key in ("idle", "damaged"):
        value = manifest.get(key)
        if isinstance(value, str):
            paths.append(value)

    unique_paths = list(dict.fromkeys(path for path in paths if isinstance(path, str) and path.endswith(".png")))
    poses = []
    for relative in unique_paths:
        path = ROOT / relative
        if not path.is_file():
            continue
        try:
            image = Image.open(path).convert("RGBA")
        except (UnidentifiedImageError, OSError):
            # The checked-in fourth Axe Cat attack PNG is corrupt. Replace only
            # that unusable file with the preceding valid pose so the animation
            # remains complete until a clean original frame is supplied.
            if folder_name == "axe-cat" and path.name == "frame-004attack.png":
                fallback = path.with_name("frame-003attack.png")
                if not fallback.is_file():
                    raise
                path.write_bytes(fallback.read_bytes())
                image = Image.open(path).convert("RGBA")
                print("Cats/axe-cat: repaired corrupt frame-004attack.png using frame-003attack.png")
            else:
                raise
        bbox = image.getchannel("A").point(lambda value: 255 if value > 10 else 0).getbbox()
        if not bbox:
            continue
        pose = image.crop(bbox)
        padded = Image.new("RGBA", (pose.width + 4, pose.height + 4), (0, 0, 0, 0))
        padded.alpha_composite(pose, (2, 2))
        poses.append((path, padded))

    if not poses:
        raise ValueError(f"No visible PNG frames found for Cats/{folder_name}")
    common_width = max(pose.width for _, pose in poses)
    common_height = max(pose.height for _, pose in poses)
    common_scale = min(146 / common_width, 146 / common_height)
    for path, pose in poses:
        normalized = fit_to_canvas(pose, (160, 160), (146, 146), common_scale)
        normalized.save(path, format="PNG", optimize=True)
    print(f"Cats/{folder_name}: normalized {len(poses)} animation PNGs to a shared 160x160 canvas")


def remove_legacy_lowercase_enemy_folders() -> None:
    for legacy in (ROOT / "enemys/gory", ROOT / "enemys/sir-seal"):
        if legacy.exists():
            for path in sorted(legacy.rglob("*"), reverse=True):
                if path.is_file():
                    path.unlink()
                elif path.is_dir():
                    path.rmdir()
            legacy.rmdir()


def main() -> None:
    for folder_name, config in ENEMIES.items():
        crop_enemy_folder(folder_name, config)
    normalize_unit_frames("Gross-Cat")
    normalize_unit_frames("axe-cat")
    remove_legacy_lowercase_enemy_folders()


if __name__ == "__main__":
    main()
