#!/usr/bin/env python3
"""Prepare high-resolution, tightly cropped Doge animation frames."""
from pathlib import Path
import json
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "sprites" / "original_sheets" / "doge-animation-atlas.png"
DOGE = ROOT / "enemys" / "doge"
def crop_doge_frames() -> int:
    with Image.open(ATLAS) as opened:
        atlas = opened.convert("RGBA")
    if atlas.size != (416, 336):
        raise ValueError(f"Expected a 416x336 Doge atlas, got {atlas.size}")

    frames = {"moving": [], "attack": [], "damaged": []}
    row_specs = (("moving", 0, 3), ("attack", 1, 4), ("damaged", 2, 1))
    for kind, row, count in row_specs:
        for column in range(count):
            tile = atlas.crop((column * 104 + 2, row * 112 + 2,
                               (column + 1) * 104 - 2, (row + 1) * 112 - 2))
            alpha_box = tile.getchannel("A").getbbox()
            if alpha_box:
                frames[kind].append(tile.crop(alpha_box))

    if not all(frames[name] for name, _, _ in row_specs):
        raise ValueError("Doge atlas is missing a Walk, Attack or Hurt frame")

    all_frames = [frame for values in frames.values() for frame in values]
    max_width = max(frame.width for frame in all_frames)
    max_height = max(frame.height for frame in all_frames)
    canvas_size = (max_width + 10, max_height + 10)
    saved = 0

    for kind, values in frames.items():
        output_dir = DOGE / kind
        output_dir.mkdir(parents=True, exist_ok=True)
        for old in output_dir.glob("frame-*.png"):
            old.unlink()
        paths = []
        for index, frame in enumerate(values, start=1):
            canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
            x = (canvas_size[0] - frame.width) // 2
            y = canvas_size[1] - frame.height - 4
            canvas.alpha_composite(frame, (x, y))
            large = canvas.resize(
                (canvas_size[0] * 4, canvas_size[1] * 4),
                Image.Resampling.LANCZOS
            )
            large = large.filter(ImageFilter.UnsharpMask(radius=1.0, percent=25, threshold=2))
            target = output_dir / f"frame-{index:03d}.png"
            large.save(target, format="PNG", optimize=True)
            paths.append(target)
            saved += 1
        (output_dir / "frames.json").write_text(
            json.dumps({"frames": [p.relative_to(ROOT).as_posix() for p in paths]}, indent=2) + "\n",
            encoding="utf-8"
        )

    idle = DOGE / "moving" / "frame-001.png"
    if idle.exists():
        (DOGE / "idle.png").write_bytes(idle.read_bytes())
    print(f"Prepared {saved} tightly cropped, 3x-resolution Doge frames.")
    return saved


if __name__ == "__main__":
    crop_doge_frames()
