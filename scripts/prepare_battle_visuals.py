#!/usr/bin/env python3
"""Prepare the first-stage artwork: tightly crop/upscale Doge frames and remove Cat Base wood bars."""
from pathlib import Path
import json
from PIL import Image, ImageFilter
from PIL.PngImagePlugin import PngInfo

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "sprites" / "original_sheets" / "doge-animation-atlas.png"
DOGE = ROOT / "enemys" / "doge"
BACKGROUND = ROOT / "sprites" / "backgrounds" / "bg_restored.png"


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


def row_is_wood(image: Image.Image, y: int) -> bool:
    width = image.width
    band = image.convert("RGB").crop((width // 5, y, width * 4 // 5, y + 1))
    pixels = list(band.getdata())
    if not pixels:
        return False
    red = sum(pixel[0] for pixel in pixels) / len(pixels)
    green = sum(pixel[1] for pixel in pixels) / len(pixels)
    blue = sum(pixel[2] for pixel in pixels) / len(pixels)
    return red > green * 1.05 and red > blue * 1.1 and red > 45


def remove_cat_base_bars() -> bool:
    if not BACKGROUND.exists():
        print("Cat Base background not present; skipping frame cleanup.")
        return False
    with Image.open(BACKGROUND) as opened:
        if opened.info.get("battlecats_frame_cleaned") == "3":
            print("Cat Base wood bars already removed.")
            return False
        image = opened.convert("RGBA")
    width, height = image.size
    if (width, height) == (573, 345):
        # Include the narrow dark shadows at both edges of the wallpaper with the wood strips.
        top, bottom = 36, 307
    else:
        top = 0
        while top < height // 4 and row_is_wood(image, top):
            top += 1
        bottom = height - 1
        while bottom > (height * 3) // 4 and row_is_wood(image, bottom):
            bottom -= 1
    if top < 4 or bottom > height - 5:
        print("Could not safely identify both Cat Base wood strips; leaving the image unchanged.")
        return False

    original = image.copy()
    top_edge = original.crop((0, top, width, top + 1))
    top_depth = max(1, top)
    for y in range(top):
        depth = top - y
        source_y = min(bottom, top + depth)
        sample = original.crop((0, source_y, width, source_y + 1))
        fill = Image.blend(top_edge, sample, depth / top_depth)
        image.paste(fill, (0, y))
    bottom_edge = original.crop((0, bottom, width, bottom + 1))
    bottom_depth = max(1, height - 1 - bottom)
    for y in range(bottom + 1, height):
        depth = y - bottom
        source_y = max(top, bottom - depth)
        sample = original.crop((0, source_y, width, source_y + 1))
        fill = Image.blend(bottom_edge, sample, depth / bottom_depth)
        image.paste(fill, (0, y))

    metadata = PngInfo()
    metadata.add_text("battlecats_frame_cleaned", "3")
    image.save(BACKGROUND, format="PNG", optimize=True, pnginfo=metadata)
    print(f"Removed the {top}px top and {height - 1 - bottom}px bottom wood bars without shifting menu controls.")
    return True


if __name__ == "__main__":
    crop_doge_frames()
    remove_cat_base_bars()
