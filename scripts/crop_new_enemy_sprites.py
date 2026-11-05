#!/usr/bin/env python3
"""Build Doge-format PNG animation folders for Baa Baa, Croco and Le'boin."""
from pathlib import Path
import base64
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FRAME = (104, 112)
MAX_ART = (98, 106)

ENEMIES = {
    "Baa-Baa": {
        "key": "baa-baa", "name": "Baa Baa",
        "sheet": ROOT / "enemys/Baa-Baa/Screenshot 2026-11-05 100131.png",
        "size": (487, 451),
        "moving": [(58, 52, 151, 132), (157, 52, 251, 132), (255, 52, 350, 132)],
        "attack": [(60, 166, 158, 246), (164, 166, 259, 246), (270, 166, 373, 246),
                   (378, 166, 482, 246), (60, 256, 187, 346), (252, 256, 364, 346),
                   (368, 256, 482, 346)],
        "hurt": (58, 366, 151, 444),
        "attack_rate": 7,
        "stats": {
            "name": "Baa Baa", "health": 40, "damage": 10, "speed": 5.5,
            "range": 110, "spriteChangeSpeed": 7, "walkSpriteChangeSpeed": 3.8,
            "killReward": 40, "knockbackCount": 3, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64, "knockbackDistance": 4.5,
            "attackCooldown": 1.77, "AreaAttack": 0, "traits": []
        }
    },
    "Croco": {
        "key": "croco", "name": "Croco",
        "sheet": ROOT / "enemys/Croco/Screenshot 2026-11-05 100428.png",
        "size": (606, 249),
        "moving": [(18, 4, 119, 64), (120, 4, 220, 64), (221, 4, 321, 64),
                   (322, 4, 422, 64), (423, 4, 525, 64)],
        "attack": [(20, 86, 119, 163), (120, 57, 220, 149), (220, 57, 321, 149),
                   (320, 57, 421, 149), (418, 86, 519, 163), (119, 141, 226, 218)],
        "hurt": (416, 171, 526, 231),
        "attack_rate": 8,
        "stats": {
            "name": "Croco", "health": 35, "damage": 6, "speed": 14,
            "range": 110, "spriteChangeSpeed": 10, "walkSpriteChangeSpeed": 6,
            "killReward": 20, "knockbackCount": 1, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.64, "knockbackDistance": 4.5,
            "attackCooldown": 0.9, "AreaAttack": 0, "traits": []
        }
    }
}


def flood_remove_sheet_bg(image: Image.Image) -> Image.Image:
    """Remove only the connected near-gray sheet backdrop, keeping white sprite fill."""
    img = image.convert("RGBA")
    p = img.load()
    w, h = img.size
    corners = [p[0, 0][:3], p[w - 1, 0][:3], p[0, h - 1][:3], p[w - 1, h - 1][:3]]
    bg = tuple(sorted(c[i] for c in corners)[len(corners) // 2] for i in range(3))
    from collections import deque
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        idx = y * w + x
        if seen[idx]:
            continue
        seen[idx] = 1
        r, g, b, a = p[x, y]
        if a == 0:
            continue
        if max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2])) > 34:
            continue
        p[x, y] = (r, g, b, 0)
        if x: q.append((x - 1, y))
        if x + 1 < w: q.append((x + 1, y))
        if y: q.append((x, y - 1))
        if y + 1 < h: q.append((x, y + 1))
    return img


def trim_alpha(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    bbox = img.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    if not bbox:
        raise ValueError("Empty crop: check source coordinates")
    return img.crop(bbox)


def fit_canvas(pose: Image.Image, scale: float) -> Image.Image:
    w, h = pose.size
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    pose = pose.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    out.alpha_composite(pose, ((FRAME[0] - nw) // 2, FRAME[1] - nh - 2))
    return out


def normalize_group(poses):
    poses = [trim_alpha(p) for p in poses]
    scale = min(MAX_ART[0] / max(p.width for p in poses),
                MAX_ART[1] / max(p.height for p in poses))
    return [fit_canvas(p, scale) for p in poses]


def write_enemy(folder_name, key, name, moving_poses, attack_poses, hurt_pose, stats, attack_rate, source_url):
    folder = ROOT / "enemys" / folder_name
    # Match a common scale across every moving, attack and damaged pose.
    all_poses = [trim_alpha(p) for p in moving_poses + attack_poses + [hurt_pose]]
    common_scale = min(MAX_ART[0] / max(p.width for p in all_poses),
                       MAX_ART[1] / max(p.height for p in all_poses))
    moving = [fit_canvas(p, common_scale) for p in moving_poses]
    attacks = [fit_canvas(p, common_scale) for p in attack_poses]
    hurt = fit_canvas(trim_alpha(hurt_pose), common_scale)

    def save_frames(kind, frames):
        target = folder / kind
        target.mkdir(parents=True, exist_ok=True)
        paths = []
        for n, frame in enumerate(frames, 1):
            path = target / f"frame-{n:03d}.png"
            frame.save(path, format="PNG", optimize=True)
            paths.append(path.relative_to(ROOT).as_posix())
        (target / "frames.json").write_text(json.dumps({"frames": paths}, indent=2) + "\n")
        return paths

    moving_paths = save_frames("moving", moving)
    attack_paths = save_frames("attack", attacks)
    damaged_paths = save_frames("damaged", [hurt])
    (folder / "idle.png").write_bytes((ROOT / moving_paths[0]).read_bytes())
    (folder / "slot.png").write_bytes((ROOT / moving_paths[0]).read_bytes())
    manifest = {
        "name": name,
        "source": "User-provided Battle Cats sprite reference sheet; original game art belongs to its respective rights holders.",
        "sourceUrl": source_url,
        "moving": moving_paths,
        "attacks": attack_paths,
        "attack": attack_paths[0],
        "attackFrameRate": attack_rate,
        "damagedFrames": damaged_paths,
        "knockbackFrames": damaged_paths,
        "idle": f"enemys/{folder_name}/idle.png",
        "damaged": damaged_paths[0],
        "slot": f"enemys/{folder_name}/slot.png",
        "upgrade": None
    }
    (folder / "assets.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (folder / "stats.json").write_text(json.dumps(stats, indent=2) + "\n")


def crop_sheet_enemy(folder_name, config):
    sheet = Image.open(config["sheet"]).convert("RGBA")
    if sheet.size != config["size"]:
        raise ValueError(f'{folder_name}: expected sheet {config["size"]}, found {sheet.size}')
    clean = flood_remove_sheet_bg(sheet)
    moving = [clean.crop(box) for box in config["moving"]]
    attacks = [clean.crop(box) for box in config["attack"]]
    hurt = clean.crop(config["hurt"])
    write_enemy(
        folder_name, config["key"], config["name"], moving, attacks, hurt,
        config["stats"], config["attack_rate"],
        "https://github.com/Lcrazyness/BattleCats/tree/main/enemys/" + folder_name
    )
    print(f'{folder_name}: {len(moving)} moving, {len(attacks)} attack, 1 damaged frame')


def crop_le_boin():
    folder = ROOT / "enemys/Le-Boin"
    parts = sorted(folder.glob("reference-atlas.b64.part*"))
    atlas_path = folder / "reference-atlas.png"
    if parts:
        if len(parts) != 6:
            raise ValueError(f"Le-Boin atlas must have exactly 6 base64 parts; found {len(parts)}")
        encoded = "".join(p.read_text(encoding="ascii").strip() for p in parts)
        atlas_path.write_bytes(base64.b64decode(encoded, validate=True))
    elif not atlas_path.is_file():
        raise FileNotFoundError("Le-Boin reference-atlas.png is missing")
    atlas = Image.open(atlas_path).convert("RGBA")
    if atlas.size != (512, 256):
        raise ValueError(f"Le-Boin atlas must be 512x256; got {atlas.size}")
    # The PNG is now the retained source reference; remove temporary text chunks.
    for part in parts:
        part.unlink()

    # Connect the separate elephant head, body, walking-leg strips and attack trunk.
    head_b = trim_alpha(atlas.crop((160, 0, 300, 150)))
    head_c = trim_alpha(atlas.crop((294, 0, 430, 150)))
    head_a = trim_alpha(atlas.crop((0, 0, 160, 154)))
    head_hurt = trim_alpha(atlas.crop((0, 150, 160, 256)))
    torso = trim_alpha(atlas.crop((306, 150, 430, 256)))
    legs = [
        trim_alpha(atlas.crop((160, 150, 306, 190))),
        trim_alpha(atlas.crop((160, 190, 306, 225))),
        trim_alpha(atlas.crop((160, 225, 306, 256)))
    ]
    trunk_extension = trim_alpha(atlas.crop((429, 0, 512, 116)))

    def assemble(head, leg_index=None, extend=False):
        out = Image.new("RGBA", (250, 190), (0, 0, 0, 0))
        # Set the rear body first; overlap the head across the shoulder joint.
        out.alpha_composite(torso, (90, 45))
        if leg_index is not None:
            out.alpha_composite(legs[leg_index], (99, 112))
        out.alpha_composite(head, (0, 0))
        if extend:
            # This detached piece extends the raised trunk through the slam.
            out.alpha_composite(trunk_extension, (83, 0))
        return trim_alpha(out)

    moving_raw = [
        assemble(head_b, 0),
        assemble(head_c, 1),
        assemble(head_b, 2)
    ]
    attack_raw = [
        assemble(head_b, 0, True),
        assemble(head_c, 1, True),
        assemble(head_a, 2),
        assemble(head_c, 2, True)
    ]
    hurt_raw = assemble(head_hurt, 1)
    write_enemy(
        "Le-Boin", "le-boin", "Le'boin", moving_raw, attack_raw, hurt_raw,
        {
            "name": "Le'boin", "health": 3000, "damage": 200, "speed": 2.8,
            "range": 400, "spriteChangeSpeed": 4, "walkSpriteChangeSpeed": 2,
            "killReward": 1000, "knockbackCount": 1, "knockbackThresholdPercent": 25,
            "knockbackDuration": 0.72, "knockbackDistance": 4.5,
            "attackCooldown": 6.23, "AreaAttack": 1, "traits": []
        },
        5,
        "https://github.com/Lcrazyness/BattleCats/tree/main/enemys/Le-Boin"
    )
    print("Le-Boin: assembled 3 moving, 4 connected attack, 1 damaged frames")


def main():
    for folder, config in ENEMIES.items():
        crop_sheet_enemy(folder, config)
    crop_le_boin()


if __name__ == "__main__":
    main()
