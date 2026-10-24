#!/usr/bin/env python3
"""Import menu-related Battle Cats sprite sheets into sprites/ from the community wiki.

This is intentionally limited to menu assets and the basic Cat so the repository
does not accidentally mirror the wiki's entire multi-gigabyte asset category.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "sprites"
SHEETS = SPRITES / "original_sheets"
API_CANDIDATES = [
    "https://battlecats.miraheze.org/w/api.php",
    "https://battlecats.miraheze.org/api.php",
    "https://battle-cats.fandom.com/api.php",
]
USER_AGENT = "BattleCatsFanRemakeAssetImporter/1.0 (GitHub Actions; menu asset reference)"
MAX_FILES = 30
MAX_FILE_BYTES = 18 * 1024 * 1024
session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})

# Exact title-screen screenshot was the reference the developer liked.
SCREENSHOT_SOURCES = [
    (
        "https://picfiles.alphacoders.com/655/thumb-1920-655856.webp",
        SPRITES / "title-screen.webp",
    ),
    (
        "https://encdn.ldmnq.com/faq/images/en/73a29ff2-35c8-4ee8-810c-3c3607c40cee.jpg",
        SPRITES / "cat-base-reference.jpg",
    ),
]

KEYWORDS = (
    "main menu",
    "menu title",
    "title menu",
    "cat base menu",
    "cat base menu cat",
    "normal cat",
    "cat (normal cat)",
    "cat's spritesheet",
    "cat’s spritesheet",
    "cat sprite sheet",
    "normal cat sprite sheet",
    "cat unit sprite",
    "cat's icon",
    "cat’s icon",
    "cat's upgrade menu icon",
    "cat’s upgrade menu icon",
    "cat's sprite in the storage",
    "normal cat's spritesheet",
    "basic cat",
    "various ui elements (en)",
    "ui elements (en)",
    "cat base",
)
PREFERRED = (
    "main menu",
    "cat base menu",
    "cat base menu cat",
    "cat's spritesheet",
    "cat’s spritesheet",
    "cat's icon",
    "cat’s icon",
    "cat's upgrade menu icon",
    "cat’s upgrade menu icon",
    "normal cat",
    "various ui elements (en)",
)


def safe_slug(title: str) -> str:
    title = title.removeprefix("File:")
    title = re.sub(r"\.(png|webp|jpg|jpeg|gif|bmp|tif|tiff)$", "", title, flags=re.I)
    title = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower()
    return (title[:100] or "sprite-sheet")


def download(url: str, destination: Path) -> bool:
    try:
        response = session.get(url, timeout=45, stream=True)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        if not content_type.startswith("image/"):
            print(f"Skip non-image response for {destination.name}: {content_type}")
            response.close()
            return False
        tmp = destination.with_suffix(destination.suffix + ".part")
        total = 0
        with tmp.open("wb") as output:
            for chunk in response.iter_content(128 * 1024):
                if not chunk:
                    continue
                total += len(chunk)
                if total > MAX_FILE_BYTES:
                    raise ValueError(f"file exceeds {MAX_FILE_BYTES} byte safety limit")
                output.write(chunk)
        response.close()
        if total < 128:
            tmp.unlink(missing_ok=True)
            print(f"Skip suspiciously small image: {destination.name}")
            return False
        tmp.replace(destination)
        print(f"Downloaded {destination.relative_to(ROOT)} ({total:,} bytes)")
        return True
    except Exception as exc:
        print(f"WARNING: could not download {url}: {exc}")
        return False


PAGE_REFERENCES = [
    "Main Menu/Gallery",
    "Cat Base Menu/Gallery",
    "Cat (Normal Cat)/Gallery",
    "Sonic the Hedgehog Collaboration Event/Gallery",
    "Summer Break Cats (Celebration Event)/Gallery",
    "Cat Base Menu",
    "Main Menu",
]


def get_category_files() -> tuple[str, list[dict]]:
    errors = []
    for api in API_CANDIDATES:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": "Category:Spritesheets",
            "cmtype": "file",
            "cmlimit": "max",
            "format": "json",
        }
        files: list[dict] = []
        try:
            for _ in range(30):
                response = session.get(api, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
                files.extend(data.get("query", {}).get("categorymembers", []))
                continuation = data.get("continue")
                if not continuation:
                    break
                params.update(continuation)
            if files:
                print(f"Spritesheet category source: {api}; {len(files)} file entries.")
                return api, files
        except Exception as exc:
            errors.append(f"{api} category: {exc}")
            print(f"WARNING: category API failed at {api}: {exc}")

        # Some wikis categorize gallery pages rather than individual files.
        try:
            params = {
                "action": "query",
                "titles": "|".join(PAGE_REFERENCES),
                "prop": "images",
                "imlimit": "max",
                "format": "json",
            }
            response = session.get(api, params=params, timeout=30)
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages", {})
            files = []
            for page in pages.values():
                files.extend(page.get("images", []))
            if files:
                unique = {entry["title"]: entry for entry in files if entry.get("title")}
                print(f"Loaded {len(unique)} image references from gallery pages on {api}.")
                return api, list(unique.values())
            errors.append(f"{api} gallery pages: no images returned")
        except Exception as exc:
            errors.append(f"{api} gallery pages: {exc}")
            print(f"WARNING: gallery image query failed at {api}: {exc}")
    raise RuntimeError("; ".join(errors))

def normalize_webp_extension(path: Path) -> Path:
    try:
        with path.open("rb") as image_file:
            header = image_file.read(12)
        if header[:4] == b"RIFF" and header[8:12] == b"WEBP" and path.suffix.lower() != ".webp":
            destination = path.with_suffix(".webp")
            if destination.exists():
                path.unlink()
            else:
                path.rename(destination)
            print(f"Normalized WebP extension: {destination.relative_to(ROOT)}")
            return destination
    except Exception as exc:
        print(f"WARNING: could not inspect {path.name}: {exc}")
    return path



def search_sprite_files(api: str) -> list[dict]:
    """Find actual sheet/icon file pages by name; category gallery can hide them."""
    terms = [
        "Cat's spritesheet",
        "Cat's icon",
        "Cat's Upgrade Menu icon",
        "Cat's sprite in the Storage",
        "Basic Cat sprite sheet",
        "Normal Cat spritesheet",
        "Various UI elements EN",
    ]
    found: dict[str, dict] = {}
    for term in terms:
        params = {
            "action": "query",
            "list": "search",
            "srsearch": term,
            "srnamespace": "6",
            "srlimit": "10",
            "format": "json",
        }
        try:
            response = session.get(api, params=params, timeout=30)
            response.raise_for_status()
            results = response.json().get("query", {}).get("search", [])
            for item in results:
                title = item.get("title", "")
                if title:
                    found[title] = {"title": title}
        except Exception as exc:
            print(f"WARNING: file search failed for {term!r}: {exc}")
        time.sleep(0.08)
    return list(found.values())

def import_relevant_sheets() -> list[dict]:
    try:
        api, members = get_category_files()
        search_hits = search_sprite_files(api)
        known_titles = {entry.get("title") for entry in members}
        members.extend(entry for entry in search_hits if entry.get("title") not in known_titles)
        print(f"Added {len(search_hits)} file-name search results from {api}.")
    except Exception as exc:
        print(f"WARNING: spritesheet wiki API was unavailable: {exc}")
        return []

    matches = []
    for entry in members:
        title = entry.get("title", "")
        lowered = title.lower()
        if any(keyword in lowered for keyword in KEYWORDS):
            matches.append(entry)
    # When pages expose gallery files with generic titles (for example "English"),
    # keep files used by the menu/normal-cat galleries so the source artwork still lands locally.
    if not matches:
        print("No filenames matched the category filter; candidate image titles:")
        for entry in members[:60]:
            print("  - " + entry.get("title", "" ))
        matches = members[:MAX_FILES]

    print("Relevant sprite sheet candidates:")
    for entry in matches:
        print("  - " + entry.get("title", ""))
    matches.sort(
        key=lambda entry: (
            min(
                (PREFERRED.index(term) for term in PREFERRED if term in entry["title"].lower()),
                default=99,
            ),
            entry["title"].lower(),
        )
    )
    SHEETS.mkdir(parents=True, exist_ok=True)
    saved: list[dict] = []

    for entry in matches[:MAX_FILES]:
        title = entry["title"]
        params = {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "format": "json",
        }
        try:
            response = session.get(api, params=params, timeout=30)
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages", {})
            info = next(iter(pages.values())).get("imageinfo", [{}])[0]
            url = info.get("url")
            mime = info.get("mime", "")
            if not url or not mime.startswith("image/"):
                print(f"Skip asset with no image URL: {title}")
                continue
            ext = {
                "image/png": ".png",
                "image/jpeg": ".jpg",
                "image/webp": ".webp",
                "image/gif": ".gif",
            }.get(mime, Path(url.split("?")[0]).suffix or ".img")
            destination = SHEETS / (safe_slug(title) + ext)
            normalized_existing = destination.with_suffix(".webp")
            if normalized_existing.exists() and normalized_existing.stat().st_size > 100:
                destination = normalized_existing
                ok = True
            elif destination.exists() and destination.stat().st_size > 100:
                ok = True
            else:
                ok = download(url, destination)
            if ok:
                destination = normalize_webp_extension(destination)
                saved.append({
                    "title": title,
                    "path": destination.relative_to(ROOT).as_posix(),
                    "source": "The Battle Cats Wiki — Category:Spritesheets",
                    "wiki_api": api,
                    "source_url": "https://battle-cats.fandom.com/wiki/" + quote(title.replace(" ", "_")),
                    "license_note": "Community wiki content is commonly CC BY-SA unless a file page states otherwise; original game art belongs to its respective rights holders.",
                })
            time.sleep(0.15)
        except Exception as exc:
            print(f"WARNING: failed to import {title}: {exc}")

    return saved



def build_ui_sprite_assets() -> list[str]:
    """Split the real game menu screenshots into individual, transparent UI sprites."""
    from collections import deque
    from PIL import Image, ImageDraw

    ui_dir = SPRITES / "ui"
    bg_dir = SPRITES / "backgrounds"
    ui_dir.mkdir(parents=True, exist_ok=True)
    bg_dir.mkdir(parents=True, exist_ok=True)

    title_path = SPRITES / "title-screen.webp"
    base_path = SHEETS / "cat-base-menu.webp"
    if not title_path.exists() or not base_path.exists():
        print("WARNING: menu screenshots are missing; cannot generate cropped UI sprites.")
        return []

    title = Image.open(title_path).convert("RGB")
    base = Image.open(base_path).convert("RGB")
    written: list[str] = []

    def box_pixels(box: tuple[float, float, float, float], size: tuple[int, int], pad: float = 0.0) -> tuple[int, int, int, int]:
        w, h = size
        x1, y1, x2, y2 = box
        return (
            max(0, round((x1 - pad) * w)),
            max(0, round((y1 - pad) * h)),
            min(w, round((x2 + pad) * w)),
            min(h, round((y2 + pad) * h)),
        )

    def flood_alpha(crop: Image.Image, mode: str) -> Image.Image:
        """Make only edge-connected screenshot wallpaper transparent."""
        rgba = crop.convert("RGBA")
        pixels = rgba.load()
        w, h = rgba.size
        visited = bytearray(w * h)
        queue = deque()

        def is_background(pixel: tuple[int, ...]) -> bool:
            r, g, b = pixel[:3]
            if mode == "mailbox":
                cool_or_cloud = (b >= r * 0.88 and g >= r * 0.70) or (min(r, g, b) > 190 and max(r, g, b) - min(r, g, b) < 55)
                return cool_or_cloud
            # The newer menu uses a muted teal/green swirl wallpaper. Remove
            # edge-connected wall colors but preserve artwork isolated by ink.
            pale_wall = r > 165 and g > 130 and b > 135 and r - b < 125 and g - b < 115
            teal_wall = g > 40 and b > 40 and g >= r * 0.84 and b >= r * 0.78 and max(r, g, b) - min(r, g, b) < 135
            wood = r > 65 and r > g * 1.18 and g > b * 1.15 and b < 135 and r < 205
            return pale_wall or teal_wall or wood

        seeds = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
        seeds += [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
        for x, y in seeds:
            idx = y * w + x
            if not visited[idx] and is_background(pixels[x, y]):
                visited[idx] = 1
                queue.append((x, y))
        while queue:
            x, y = queue.popleft()
            pixels[x, y] = (*pixels[x, y][:3], 0)
            for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1),(x+1,y+1)):
                if 0 <= nx < w and 0 <= ny < h:
                    idx = ny * w + nx
                    if not visited[idx] and is_background(pixels[nx, ny]):
                        visited[idx] = 1
                        queue.append((nx, ny))
        return rgba

    def crop_save(
        image: Image.Image,
        box: tuple[float, float, float, float],
        output: Path,
        shape: str = "round",
        flood_mode: str = "base",
    ) -> None:
        crop = image.crop(box_pixels(box, image.size))
        if shape == "round":
            rgba = crop.convert("RGBA")
            alpha = Image.new("L", rgba.size, 0)
            draw = ImageDraw.Draw(alpha)
            radius = max(4, round(min(rgba.size) * 0.16))
            draw.rounded_rectangle((0, 0, rgba.width - 1, rgba.height - 1), radius=radius, fill=255)
            rgba.putalpha(alpha)
        elif shape == "flood":
            rgba = flood_alpha(crop, flood_mode)
        else:
            rgba = crop.convert("RGBA")
        output.parent.mkdir(parents=True, exist_ok=True)
        rgba.save(output, format="PNG", optimize=True)
        written.append(output.relative_to(ROOT).as_posix())
        print(f"Built sprite {output.relative_to(ROOT)} ({rgba.width}x{rgba.height})")

    def inpaint_background(image: Image.Image, boxes: list[tuple[float, float, float, float]], output: Path) -> None:
        """Replace areas under extracted UI sprites without blur streaks."""
        if not boxes:
            clean = image.copy()
            clean.save(output, format="WEBP", quality=94, method=6)
            written.append(output.relative_to(ROOT).as_posix())
            print(f"Saved local screen backdrop {output.relative_to(ROOT)} ({image.width}x{image.height})")
            return

        # The original Cat Base wallpaper is a repeated green swirl design. Use
        # a clean sample of that exact wallpaper for the hidden areas, and a
        # brown footer sample for buttons on the bottom bar. This prevents the
        # long blur trails caused by inpainting entire button rectangles.
        if image.size == base.size:
            wall_tile = image.crop(box_pixels((0.355, 0.14, 0.465, 0.405), image.size))
            footer_tile = image.crop(box_pixels((0.16, 0.865, 0.48, 0.945), image.size))
        else:
            wall_tile = image.crop(box_pixels((0.08, 0.18, 0.24, 0.38), image.size))
            footer_tile = wall_tile

        clean = image.copy()
        for box in boxes:
            rect = box_pixels(box, image.size)
            x1, y1, x2, y2 = rect
            if x2 <= x1 or y2 <= y1:
                continue
            tile = footer_tile if y1 > image.height * 0.80 else wall_tile
            tile = tile.resize((x2 - x1, y2 - y1), Image.Resampling.LANCZOS)
            clean.paste(tile, (x1, y1))
        output.parent.mkdir(parents=True, exist_ok=True)
        clean.save(output, format="WEBP", quality=94, method=6)
        written.append(output.relative_to(ROOT).as_posix())
        print(f"Built texture-patched background {output.relative_to(ROOT)} ({image.width}x{image.height})")

    # The screenshot's two large title buttons become independent sprites. The
    # old button pixels are inpainted from the scene before the sprites are placed.
    title_boxes = {
        "title-play": (0.300, 0.584, 0.700, 0.695),
        "title-settings": (0.300, 0.727, 0.700, 0.833),
        "title-mailbox": (0.881, 0.824, 0.986, 0.971),
    }
    for name, box in title_boxes.items():
        shape = "flood" if name == "title-mailbox" else "round"
        flood_mode = "mailbox" if name == "title-mailbox" else "base"
        crop_save(title, box, ui_dir / f"{name}.png", shape, flood_mode)
    # Keep the title scene intact underneath the tightly-cropped button images;
    # the transparent sprites are now actual clickable image elements.
    inpaint_background(title, [], bg_dir / "title-background-clean.webp")

    # Fractions refer to the native Cat Base screenshot, so these crops scale if
    # the community wiki replaces the screen capture with a higher-resolution copy.
    base_sprites = {
        "base-start": ((0.016, 0.219, 0.326, 0.323), "round", "base"),
        "base-upgrade": ((0.016, 0.356, 0.326, 0.458), "round", "base"),
        "base-equip": ((0.016, 0.485, 0.326, 0.586), "round", "base"),
        "base-menu": ((0.030, 0.632, 0.113, 0.755), "flood", "base"),
        "base-gamatoto": ((0.123, 0.626, 0.220, 0.755), "flood", "base"),
        "base-missions": ((0.226, 0.626, 0.311, 0.755), "flood", "base"),
        "base-storage": ((0.338, 0.695, 0.420, 0.833), "flood", "base"),
        "base-cat-capsule": ((0.430, 0.695, 0.517, 0.833), "flood", "base"),
        "base-rare-capsule": ((0.522, 0.695, 0.609, 0.833), "flood", "base"),
        "base-back": ((0.002, 0.849, 0.082, 0.999), "round", "base"),
        "base-store": ((0.542, 0.860, 0.740, 0.939), "round", "base"),
        "base-cat-food": ((0.748, 0.860, 0.904, 0.994), "flood", "base"),
    }
    for name, (box, shape, mode) in base_sprites.items():
        crop_save(base, box, ui_dir / f"{name}.png", shape, mode)

    # Mask the original controls from the backdrop. The sprites are then the
    # visible UI elements, rather than invisible hitboxes over a full screenshot.
    base_masks = [
        (0.015, 0.218, 0.327, 0.324),
        (0.015, 0.355, 0.327, 0.459),
        (0.015, 0.484, 0.327, 0.587),
        (0.028, 0.630, 0.115, 0.757),
        (0.121, 0.624, 0.222, 0.757),
        (0.224, 0.624, 0.313, 0.757),
        (0.001, 0.848, 0.083, 1.000),
        (0.540, 0.858, 0.742, 0.941),
        (0.746, 0.858, 0.906, 0.996),
    ]
    inpaint_background(base, base_masks, bg_dir / "cat-base-background-clean.webp")

    # The main Cat Base background itself stays as an actual game capture. Only
    # UI areas are cleaned; the top HUD, door, cat character, and wall art remain.
    manifest = {
        "titleBackground": "sprites/backgrounds/title-background-clean.webp",
        "titleButtons": {
            name: f"sprites/ui/{name}.png" for name in ("title-play", "title-settings", "title-mailbox")
        },
        "catBaseBackground": "sprites/backgrounds/cat-base-background-clean.webp",
        "catBaseButtons": {name: f"sprites/ui/{name}.png" for name in base_sprites},
        "source": "Cropped from local Battle Cats Wiki menu captures; see sprites/original_sheets/index.json for source links."
    }
    manifest_path = SPRITES / "ui" / "sprite-map.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    written.append(manifest_path.relative_to(ROOT).as_posix())
    return written

def main() -> int:
    SPRITES.mkdir(parents=True, exist_ok=True)
    # Import the real menu screenshot as a local asset first; the SVG remains a
    # fallback if the source is temporarily unavailable.
    for url, destination in SCREENSHOT_SOURCES:
        if destination.exists() and destination.stat().st_size > 1000:
            print(f"Already present: {destination.relative_to(ROOT)}")
            continue
        download(url, destination)

    sheets = import_relevant_sheets()
    index_path = SPRITES / "original_sheets" / "index.json"
    if sheets:
        SHEETS.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps(sheets, indent=2), encoding="utf-8")
        print(f"Imported {len(sheets)} relevant wiki sprite sheets.")
    else:
        print("No menu sheets were imported from the category; screenshot assets are still attempted.")

    if not (SPRITES / "title-screen.webp").exists():
        print("ERROR: The local title screenshot is missing; cannot split menu sprites.")
        return 0
    try:
        sprite_files = build_ui_sprite_assets()
        print(f"Generated {len(sprite_files)} individual UI sprite assets.")
    except Exception as exc:
        print(f"WARNING: Could not generate separate UI sprites: {exc}")
        raise
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
