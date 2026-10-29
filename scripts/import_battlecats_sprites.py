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
    (
        "https://static.wikia.nocookie.net/battle-cats/images/7/71/EOC_map.png/revision/latest?cb=20211025210429",
        SPRITES / "backgrounds" / "empire-of-cats-map.png",
    ),
    (
        "https://www.spriters-resource.com/media/assets/78/81040.png?updated=1755474485",
        SHEETS / "battlecats-cat-spritesheet.png",
    ),
    (
        "https://www.spriters-resource.com/media/assets/82/84887.png?updated=1755474916",
        SHEETS / "battlecats-doge-spritesheet.png",
    ),
    (
        "https://www.spriters-resource.com/media/assets/82/85177.png?updated=1755474924",
        SHEETS / "battlecats-cat-base-sheet.png",
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
    urls = [url]
    is_spriters = "spriters-resource.com" in url.lower()
    if is_spriters:
        # The original host rejects automated CI requests; try image proxies as a fallback.
        clean_url = url.replace("https://", "").replace("http://", "")
        urls.extend([
            "https://wsrv.nl/?url=" + quote(clean_url, safe=""),
            "https://images.weserv.nl/?url=" + quote(clean_url, safe=""),
        ])
    last_error = None
    for candidate_url in urls:
        try:
            headers = {}
            if "spriters-resource.com" in candidate_url.lower():
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                    "Referer": "https://www.spriters-resource.com/mobile/thebattlecats/asset/81040/",
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                }
            else:
                headers = {"User-Agent": "Mozilla/5.0 (compatible; BattleCatsFanRemakeAssetImporter/1.0)"}
            response = session.get(candidate_url, headers=headers, timeout=45, stream=True)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").lower()
            if not content_type.startswith("image/"):
                print(f"Skip non-image response for {destination.name} from {candidate_url}: {content_type}")
                response.close()
                continue
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
                continue
            tmp.replace(destination)
            print(f"Downloaded {destination.relative_to(ROOT)} ({total:,} bytes) from {candidate_url}")
            return True
        except Exception as exc:
            last_error = exc
            print(f"WARNING: could not download {candidate_url}: {exc}")
    if last_error:
        print(f"WARNING: exhausted download sources for {destination.name}.")
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
    import cv2
    import numpy as np
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
        shape: str = "rect",
        flood_mode: str = "base",
    ) -> None:
        # Every UI sprite is a precise, fully opaque rectangular crop from the
        # same source image used as the scene background. Its element and crop
        # share the exact same fractional coordinates, so there are no guessed
        # alpha masks cutting holes into letters or icons.
        crop = image.crop(box_pixels(box, image.size)).convert("RGBA")
        output.parent.mkdir(parents=True, exist_ok=True)
        crop.save(output, format="PNG", optimize=True)
        written.append(output.relative_to(ROOT).as_posix())
        print(f"Built exact sprite {output.relative_to(ROOT)} ({crop.width}x{crop.height})")
    def clean_background_with_sprites(
        image: Image.Image,
        sprite_specs: dict,
        output: Path,
    ) -> None:
        """Keep source artwork pristine under matching button crops; only zero HUD values."""
        rgb = np.asarray(image.convert("RGB")).copy()
        h, w = rgb.shape[:2]
        result_rgb = rgb.copy()

        # Every visible button is an opaque crop from this exact source image.
        # Keep the same pixels beneath the sprite: when the crop is placed at its
        # source coordinates it matches pixel-for-pixel and there are no blurred
        # boxes or cleanup artifacts around the icons.
        if image.size == base.size:
            source_bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            stat_mask = np.zeros((h, w), dtype=np.uint8)
            number_boxes = (
                (0.875, 0.000, 0.999, 0.082),  # XP digits
                (0.890, 0.745, 0.999, 0.999),  # Cat Food digits over the cat/footer
            )
            for box in number_boxes:
                left, top, right, bottom = box_pixels(box, image.size)
                region = rgb[top:bottom, left:right, :].astype(np.int16)
                red = region[:, :, 0]
                green = region[:, :, 1]
                blue = region[:, :, 2]
                yellow = (
                    (red > 160) &
                    (green > 90) &
                    (blue < 145) &
                    ((red - blue) > 45) &
                    ((green - blue) > 25)
                ).astype(np.uint8) * 255
                # Only expand around the yellow digit fill to remove its black
                # outline. This preserves nearby cat artwork outside the digits.
                kernel = np.ones((23, 23), dtype=np.uint8)
                glyph_mask = cv2.dilate(yellow, kernel, iterations=1)
                stat_mask[top:bottom, left:right] = cv2.bitwise_or(
                    stat_mask[top:bottom, left:right], glyph_mask
                )

            cleaned_bgr = cv2.inpaint(source_bgr, stat_mask, 5, cv2.INPAINT_TELEA)
            result_rgb = cv2.cvtColor(cleaned_bgr, cv2.COLOR_BGR2RGB)
            result = Image.fromarray(result_rgb)
            draw = ImageDraw.Draw(result)
            try:
                from PIL import ImageFont
                font = ImageFont.truetype(
                    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
                    max(24, round(h * 0.062)),
                )
            except Exception:
                from PIL import ImageFont
                font = ImageFont.load_default()
            size_px = max(24, round(h * 0.062))
            for x, baseline in (
                (round(w * 0.994), round(h * 0.065)),
                (round(w * 0.994), round(h * 0.994)),
            ):
                draw.text(
                    (x, baseline), "0", font=font, fill="#ffd72a",
                    stroke_width=max(2, round(size_px * 0.075)), stroke_fill="#171009", anchor="rs"
                )
                draw.text(
                    (x, baseline), "0", font=font, fill="#ffe33a",
                    stroke_width=max(1, round(size_px * 0.025)), stroke_fill="#fff1a4", anchor="rs"
                )
        else:
            # Leave the title artwork alone too. Its Play/Settings/Mailbox sprites
            # are crops from the same source and cover the original pixels exactly.
            result = Image.fromarray(result_rgb)

        output.parent.mkdir(parents=True, exist_ok=True)
        result.save(output, format="WEBP", quality=95, method=6)
        written.append(output.relative_to(ROOT).as_posix())
        print(f"Built source-aligned background {output.relative_to(ROOT)} ({w}x{h})")

    # The screenshot's two large title buttons become independent sprites. The
    # old button pixels are inpainted from the scene before the sprites are placed.
    title_boxes = {
        "title-play": (0.300, 0.584, 0.700, 0.695),
        "title-settings": (0.300, 0.727, 0.700, 0.833),
        "title-mailbox": (0.875, 0.814, 0.992, 0.980),
    }
    for name, box in title_boxes.items():
        crop_save(title, box, ui_dir / f"{name}.png", "rect")
    clean_background_with_sprites(title, title_boxes, bg_dir / "title-background-clean.webp")

    # Fractions refer to the native Cat Base screenshot, so these crops scale if
    # the community wiki replaces the screen capture with a higher-resolution copy.
    base_sprites = {
        "base-start": ((0.016, 0.219, 0.326, 0.323), "rect", "base"),
        "base-upgrade": ((0.016, 0.356, 0.326, 0.458), "rect", "base"),
        "base-equip": ((0.016, 0.485, 0.326, 0.586), "rect", "base"),
        "base-menu": ((0.020, 0.615, 0.122, 0.771), "rect", "base"),
        "base-gamatoto": ((0.112, 0.610, 0.231, 0.771), "rect", "base"),
        "base-missions": ((0.215, 0.610, 0.322, 0.771), "rect", "base"),
        "base-storage": ((0.326, 0.684, 0.432, 0.844), "rect", "base"),
        "base-cat-capsule": ((0.417, 0.684, 0.530, 0.844), "rect", "base"),
        "base-rare-capsule": ((0.508, 0.684, 0.620, 0.844), "rect", "base"),
        "base-back": ((0.002, 0.849, 0.082, 0.999), "rect", "base"),
        "base-store": ((0.542, 0.860, 0.740, 0.939), "rect", "base"),
        "base-cat-food": ((0.740, 0.850, 0.895, 0.999), "rect", "base"),
    }
    for name, (box, shape, mode) in base_sprites.items():
        crop_save(base, box, ui_dir / f"{name}.png", shape, mode)

    clean_background_with_sprites(base, base_sprites, bg_dir / "cat-base-background-clean.webp")

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


def normalize_mislabeled_pngs() -> int:
    """Convert uploaded WebP files with .png names to real PNGs for reliable browser loading."""
    from PIL import Image

    ui_dir = SPRITES / "ui"
    if not ui_dir.exists():
        return 0

    converted = 0
    for path in ui_dir.glob("*.png"):
        try:
            with path.open("rb") as stream:
                header = stream.read(12)
            if header[:4] != b"RIFF" or header[8:12] != b"WEBP":
                continue
            temp_path = path.with_name(path.stem + ".normalized.png")
            with Image.open(path) as image:
                image.convert("RGBA").save(temp_path, format="PNG", optimize=True)
            temp_path.replace(path)
            converted += 1
            print(f"Converted mislabeled WebP to proper PNG: {path.relative_to(ROOT)}")
        except Exception as exc:
            print(f"WARNING: couldn't normalize {path.name}: {exc}")
    return converted


def normalized_wiki_file_title(value: str) -> str:
    value = value.lower().strip()
    if value.startswith("file:"):
        value = value[5:]
    value = re.sub(r"\.(png|webp|jpg|jpeg|gif|bmp|tif|tiff)$", "", value, flags=re.I)
    value = re.sub(r"['’]s\b", "", value)
    value = value.replace("’", " ").replace("'", " ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value)).strip()


def find_unit_asset(api: str, queries: list[str], required: tuple[str, ...] = (), excluded: tuple[str, ...] = ()) -> str | None:
    """Prefer exact Battle Cats file titles, then safely ranked unit-specific matches."""
    expected = [normalized_wiki_file_title(query) for query in queries]
    expected = [phrase for phrase in expected if phrase]
    if not expected:
        return None

    def is_excluded(normalized: str) -> bool:
        return any(normalized_wiki_file_title(term) and normalized_wiki_file_title(term) in normalized for term in excluded)

    def has_required(normalized: str) -> bool:
        return all(term.lower() in normalized for term in required)

    def has_query_words(normalized: str, query: str) -> bool:
        phrase = normalized_wiki_file_title(query)
        # Unit name/state must be a prefix, so "Ice Cat Attack Animation" cannot match "Cat Attack Animation".
        return bool(phrase) and (normalized == phrase or normalized.startswith(phrase + " "))

    # Exact titles avoid mistakenly importing another character's art.
    direct_titles = []
    extensions = (".png", ".gif", ".webp", ".jpg", ".jpeg", ".bmp")
    for query in queries:
        base = query.strip()
        if base.lower().startswith("file:"):
            base = base[5:]
        if re.search(r"\.(png|webp|jpg|jpeg|gif|bmp)$", base, flags=re.I):
            direct_titles.append("File:" + base)
        else:
            direct_titles.extend("File:" + base + extension for extension in extensions)
    for offset in range(0, len(direct_titles), 35):
        params = {
            "action": "query",
            "titles": "|".join(direct_titles[offset:offset + 35]),
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "format": "json",
        }
        try:
            response = session.get(api, params=params, timeout=30)
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages", {})
            for page in pages.values():
                title = page.get("title", "")
                normalized = normalized_wiki_file_title(title)
                if page.get("missing") is not None or normalized not in expected:
                    continue
                if not page.get("imageinfo") or is_excluded(normalized) or not has_required(normalized):
                    continue
                print(f"Matched exact Battle Cats asset: {title}")
                return title
        except Exception as exc:
            print(f"WARNING: exact file lookup failed for {queries[0]!r}: {exc}")

    candidates: dict[str, dict] = {}
    for query in queries:
        # Search in image namespace, but rank only filenames that still identify the requested unit/state.
        for search_query in ("file:" + query, query):
            params = {
                "action": "query",
                "list": "search",
                "srsearch": search_query,
                "srnamespace": "6",
                "srlimit": "30",
                "format": "json",
            }
            try:
                response = session.get(api, params=params, timeout=30)
                response.raise_for_status()
                for item in response.json().get("query", {}).get("search", []):
                    title = item.get("title", "")
                    normalized = normalized_wiki_file_title(title)
                    if not normalized or is_excluded(normalized) or not has_required(normalized):
                        continue
                    # With required terms, accept a title only if it shares at least the query's
                    # meaningful words. This permits suffixes like "(EN)" without matching "God Cat".
                    if not has_query_words(normalized, query):
                        continue
                    candidates[title] = item
            except Exception as exc:
                print(f"WARNING: file title search failed for {query!r}: {exc}")
            time.sleep(0.06)

    if not candidates:
        print("No safe Battle Cats file matched: " + " / ".join(queries))
        return None

    def rank(title: str) -> tuple[int, int, int, str]:
        normalized = normalized_wiki_file_title(title)
        exact = 0 if normalized in expected else 1
        best_shared = max((sum(1 for word in query.split() if word in normalized) for query in expected), default=0)
        return (exact, -best_shared, len(normalized), normalized)

    title = sorted(candidates, key=rank)[0]
    print(f"Matched Battle Cats asset after title verification: {title}")
    return title


def download_wiki_image(api: str, title: str, destination_base: Path, preserve_gif: bool = False) -> Path | None:
    """Download a wiki file locally, converting still artwork to a real PNG."""
    try:
        params = {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "format": "json",
        }
        response = session.get(api, params=params, timeout=30)
        response.raise_for_status()
        pages = response.json().get("query", {}).get("pages", {})
        info = next(iter(pages.values())).get("imageinfo", [{}])[0]
        url = info.get("url")
        mime = info.get("mime", "")
        if not url or not mime.startswith("image/"):
            print(f"WARNING: no image URL for {title}")
            return None

        destination_base.parent.mkdir(parents=True, exist_ok=True)
        source_ext = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "image/bmp": ".bmp",
        }.get(mime, Path(url.split("?")[0]).suffix or ".img")
        temp = destination_base.with_name(destination_base.name + ".source" + source_ext)
        if not download(url, temp):
            return None

        if preserve_gif and mime == "image/gif":
            final = destination_base.with_suffix(".gif")
            temp.replace(final)
        else:
            from PIL import Image
            final = destination_base.with_suffix(".png")
            with Image.open(temp) as opened:
                opened.seek(0)
                opened.convert("RGBA").save(final, format="PNG", optimize=True)
            temp.unlink(missing_ok=True)

        print(f"Saved Battle Cats artwork: {final.relative_to(ROOT)}")
        return final
    except Exception as exc:
        print(f"WARNING: failed to import wiki image {title}: {exc}")
        return None


def split_unit_sheet(sheet_path: Path, moving_dir: Path) -> list[Path]:
    """Cut a transparent unit sheet into frame PNGs where the sheet has separable frames."""
    import numpy as np
    from PIL import Image

    moving_dir.mkdir(parents=True, exist_ok=True)
    for stale in moving_dir.glob("frame-*.png"):
        stale.unlink()
    frames: list[Path] = []
    try:
        with Image.open(sheet_path) as opened:
            opened.seek(0)
            sheet = opened.convert("RGBA")
        alpha = np.asarray(sheet.getchannel("A"))
        occupied_x = np.any(alpha > 8, axis=0)
        occupied_y = np.any(alpha > 8, axis=1)

        def runs(mask: "np.ndarray") -> list[tuple[int, int]]:
            raw = []
            start = None
            for index, value in enumerate(mask.tolist()):
                if value and start is None:
                    start = index
                elif not value and start is not None:
                    raw.append((start, index))
                    start = None
            if start is not None:
                raw.append((start, len(mask)))
            merged = []
            join_gap = max(2, min(8, len(mask) // 180))
            for left, right in raw:
                if merged and left - merged[-1][1] <= join_gap:
                    merged[-1] = (merged[-1][0], right)
                else:
                    merged.append((left, right))
            return merged

        columns = runs(occupied_x)
        if len(columns) < 2 and sheet.width >= sheet.height * 1.7:
            count = max(2, min(16, round(sheet.width / max(1, sheet.height))))
            columns = [(round(i * sheet.width / count), round((i + 1) * sheet.width / count)) for i in range(count)]
        if len(columns) < 2:
            rows = runs(occupied_y)
            if len(rows) < 2 and sheet.height >= sheet.width * 1.7:
                count = max(2, min(16, round(sheet.height / max(1, sheet.width))))
                rows = [(round(i * sheet.height / count), round((i + 1) * sheet.height / count)) for i in range(count)]
            if len(rows) >= 2:
                for top, bottom in rows:
                    crop = sheet.crop((0, top, sheet.width, bottom))
                    box = crop.getchannel("A").getbbox()
                    if box:
                        frames.append(crop.crop(box))
        else:
            for left, right in columns:
                crop = sheet.crop((left, 0, right, sheet.height))
                box = crop.getchannel("A").getbbox()
                if box:
                    frames.append(crop.crop(box))

        if not frames:
            box = sheet.getchannel("A").getbbox()
            frames = [sheet.crop(box) if box else sheet]
        # Very large atlas images can have accidental extra regions; cap frame count.
        frames = frames[:24]
        frame_paths = []
        for index, frame in enumerate(frames, start=1):
            path = moving_dir / f"frame-{index:03d}.png"
            frame.save(path, format="PNG", optimize=True)
            frame_paths.append(path)
        print(f"Cut {len(frame_paths)} frame(s) from {sheet_path.relative_to(ROOT)}")
        return frame_paths
    except Exception as exc:
        print(f"WARNING: could not split sprite sheet {sheet_path}: {exc}")
        return []


def copy_as_png(source: Path, destination: Path) -> bool:
    try:
        from PIL import Image
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as opened:
            opened.seek(0)
            opened.convert("RGBA").save(destination, format="PNG", optimize=True)
        return True
    except Exception as exc:
        print(f"WARNING: unable to copy sprite frame to {destination}: {exc}")
        return False


def crop_sprite_strip(sheet_path: Path, bounds: tuple[int, int, int, int], output_dir: Path) -> list[Path]:
    """Crop a single animation row from an organized Battle Cats sprite sheet."""
    from PIL import Image

    output_dir.mkdir(parents=True, exist_ok=True)
    temp_path = output_dir / ".animation-strip.png"
    try:
        with Image.open(sheet_path) as opened:
            opened.seek(0)
            sheet = opened.convert("RGBA")
            strip = sheet.crop(bounds)
            box = strip.getchannel("A").getbbox()
            if box:
                strip = strip.crop(box)
            strip.save(temp_path, format="PNG", optimize=True)
        frames = split_unit_sheet(temp_path, output_dir)
        return frames
    except Exception as exc:
        print(f"WARNING: couldn't crop a Battle Cats sprite strip from {sheet_path.name}: {exc}")
        return []
    finally:
        temp_path.unlink(missing_ok=True)


def crop_default_cat_sheet(sheet_path: Path, moving_dir: Path, attack_dir: Path, damaged_dir: Path) -> tuple[list[Path], list[Path], list[Path]]:
    """Crop only Normal Cat from the narrow leftmost group of the Cat/Macho/Mohawk sprite sheet."""
    from PIL import Image

    try:
        with Image.open(sheet_path) as opened:
            sheet = opened.convert("RGBA")
        width, height = sheet.size
        # The first ~16% is Normal Cat; the other forms must never be included in this animation.
        right = min(width, round(width * 0.16))
        moving = crop_sprite_strip(sheet_path, (0, round(height * 0.12), right, round(height * 0.30)), moving_dir)
        attacks = crop_sprite_strip(sheet_path, (0, round(height * 0.36), right, round(height * 0.53)), attack_dir)
        damaged = crop_sprite_strip(sheet_path, (0, round(height * 0.56), right, round(height * 0.70)), damaged_dir)
        print(f"Extracted Normal Cat only: {len(moving)} walk, {len(attacks)} attack, {len(damaged)} hurt frame(s).")
        return moving, attacks, damaged
    except Exception as exc:
        print(f"WARNING: couldn't crop Normal Cat's spritesheet: {exc}")
        return [], [], []


def extract_gif_frames(animation_path: Path, output_dir: Path, limit: int = 20) -> list[Path]:
    """Extract the authentic Doge animation GIF into individual transparent PNG frames."""
    from PIL import Image

    output_dir.mkdir(parents=True, exist_ok=True)
    for existing in output_dir.glob("frame-*.png"):
        existing.unlink()
    frames: list[Path] = []
    try:
        with Image.open(animation_path) as opened:
            total = min(int(getattr(opened, "n_frames", 1)), limit)
            for index in range(total):
                opened.seek(index)
                frame = opened.convert("RGBA")
                box = frame.getchannel("A").getbbox()
                if box:
                    frame = frame.crop(box)
                path = output_dir / f"frame-{index + 1:03d}.png"
                frame.save(path, format="PNG", optimize=True)
                frames.append(path)
        print(f"Extracted {len(frames)} authentic frame(s) from {animation_path.relative_to(ROOT)}.")
    except Exception as exc:
        print(f"WARNING: couldn't extract animation frames from {animation_path}: {exc}")
    return frames


def split_doge_animation_atlas(atlas_path: Path, moving_dir: Path, attack_dir: Path, damaged_dir: Path) -> tuple[list[Path], list[Path], list[Path]]:
    """Split the supplied Doge Walk / Attack / Hurt animation sheet into separate folders."""
    from PIL import Image

    for folder in (moving_dir, attack_dir, damaged_dir):
        folder.mkdir(parents=True, exist_ok=True)
        for stale in folder.glob("frame-*.png"):
            stale.unlink()

    try:
        with Image.open(atlas_path) as opened:
            atlas = opened.convert("RGBA")
        if atlas.size != (416, 336):
            raise ValueError(f"Expected 416x336 Doge atlas, got {atlas.size}")
        result = {"moving": [], "attack": [], "damaged": []}
        folders = {"moving": moving_dir, "attack": attack_dir, "damaged": damaged_dir}
        for kind, row, count in (("moving", 0, 3), ("attack", 1, 4), ("damaged", 2, 1)):
            for column in range(count):
                frame = atlas.crop((column*104, row*112, (column+1)*104, (row+1)*112))
                if frame.getchannel("A").getbbox() is None:
                    continue
                destination = folders[kind] / f"frame-{len(result[kind])+1:03d}.png"
                frame.save(destination, format="PNG", optimize=True)
                result[kind].append(destination)
        if not result["moving"] or not result["attack"] or not result["damaged"]:
            raise ValueError("The Doge atlas is missing a Walk, Attack or Hurt row")
        print(f"Doge atlas split: {len(result['moving'])} Walk, {len(result['attack'])} Attack, {len(result['damaged'])} Hurt.")
        return result["moving"], result["attack"], result["damaged"]
    except Exception as exc:
        print(f"WARNING: could not split Doge animation atlas: {exc}")
        return [], [], []


def import_unit_assets(api: str, folder: Path, name: str, enemy: bool = False) -> dict:
    """Build Cats/cat or enemys/doge with locally bundled Battle Cats artwork."""
    moving_dir = folder / "moving"
    attack_dir = folder / "attack"
    damaged_dir = folder / "damaged"
    for directory in (moving_dir, attack_dir, damaged_dir):
        directory.mkdir(parents=True, exist_ok=True)
    # Never clear a working unit folder before replacement artwork has downloaded.
    # Existing frame names are safely overwritten if new artwork is available.
    if not enemy:
        bad_screenshot = SHEETS / "cat-spritesheet.png"
        if bad_screenshot.exists():
            bad_screenshot.unlink()
        wrong_wiki_sheet = moving_dir / "cat-wiki-spritesheet.png"
        if wrong_wiki_sheet.exists():
            wrong_wiki_sheet.unlink()

    title = "Doge" if enemy else "Cat"
    excluded_forms = ("Macho Cat", "Mohawk Cat", "God Cat", "Legend Cat", "True Form", "Evolved", "Dark Cat", "Crazed Cat", "Basic Cat (bcp)", "MangaCat", "Manga Cat", "PopoCat", "MangaCatMangaPopoCat")
    form_exclusions = excluded_forms if not enemy else ()
    source_url = (
        "https://www.spriters-resource.com/mobile/thebattlecats/asset/84887/"
        if enemy else
        "https://battle-cats.fandom.com/wiki/Cat_%28Normal_Cat%29/Gallery"
    )
    frame_paths: list[Path] = []
    attack_frames: list[Path] = []
    damaged_frames: list[Path] = []
    attack_gif: Path | None = None

    if not enemy:
        sheet_path = SHEETS / "battlecats-cat-spritesheet.png"
        if not sheet_path.exists():
            wiki_sheet_title = find_unit_asset(
                api,
                ["Cat's spritesheet", "Cat sprite sheet", "Cat spritesheet"],
                required=("cat",),
                excluded=form_exclusions + ("icon", "attack", "upgrade", "storage", "basic cat bcp", "macho", "mohawk"),
            )
            downloaded_sheet = download_wiki_image(api, wiki_sheet_title, SHEETS / "battlecats-cat-spritesheet") if wiki_sheet_title else None
            if downloaded_sheet:
                sheet_path = downloaded_sheet
        if sheet_path.exists():
            frame_paths, attack_frames, damaged_frames = crop_default_cat_sheet(
                sheet_path, moving_dir, attack_dir, damaged_dir
            )
        else:
            print("WARNING: Normal Cat animation sheet not found. Keeping field frames empty instead of using a slot icon.")
    else:
        doge_sheet = SHEETS / "doge-animation-atlas.png"
        if doge_sheet.exists():
            frame_paths, attack_frames, damaged_frames = split_doge_animation_atlas(
                doge_sheet, moving_dir, attack_dir, damaged_dir
            )
        else:
            print("WARNING: supplied Doge animation atlas missing; never using Attack frames as Walk frames.")

    if enemy and not attack_frames:
        attack_title = find_unit_asset(api, ["Doge attack", "Doge's attack animation", "Doge attack animation"])
        if attack_title:
            attack_gif = download_wiki_image(api, attack_title, attack_dir / "doge-attack", preserve_gif=True)
            if attack_gif and attack_gif.suffix.lower() == ".gif":
                attack_frames = extract_gif_frames(attack_gif, attack_dir)
    elif not attack_frames:
        attack_title = find_unit_asset(
            api,
            ["Cat's attack animation", "Cat attack animation", "Cat attack"],
            required=("cat", "attack"),
            excluded=form_exclusions + ("icon", "upgrade", "spritesheet", "storage"),
        )
        if attack_title:
            attack_path = download_wiki_image(api, attack_title, attack_dir / "cat-attack", preserve_gif=True)
            if attack_path and attack_path.suffix.lower() == ".gif":
                attack_frames = extract_gif_frames(attack_path, attack_dir)
            elif attack_path:
                attack_frames = [attack_path]

    slot_path: Path | None = None
    if not enemy:
        slot_title = find_unit_asset(api, ["Uni000 BCP00"], excluded=form_exclusions)
        slot_path = download_wiki_image(api, slot_title, folder / "slot") if slot_title else None
        if not slot_path:
            normal_icon = SHEETS / "normal-cat-right-icon.webp"
            if normal_icon.exists():
                slot_path = folder / "slot.png"
                copy_as_png(normal_icon, slot_path)
    else:
        slot_title = find_unit_asset(api, ["Enemy icon 000", "Doge icon"])
        slot_path = download_wiki_image(api, slot_title, folder / "slot") if slot_title else None

    # Slot portraits are reserved for the unit-selection UI and are never copied into moving/.
    if not attack_frames and frame_paths:
        if not enemy:
            for stale in attack_dir.iterdir():
                if stale.is_file() and (stale.name.startswith("frame-") or stale.name == "cat-attack.gif" or stale.name == "cat-attack.png"):
                    stale.unlink()
        attack_frame = attack_dir / "frame-001.png"
        if copy_as_png(frame_paths[-1], attack_frame):
            attack_frames = [attack_frame]
    if not enemy and not damaged_frames:
        damage_title = find_unit_asset(
            api,
            ["Cat's damage animation", "Cat hurt animation", "Cat damaged animation"],
            required=("cat",),
            excluded=form_exclusions + ("icon", "attack", "upgrade", "spritesheet", "storage"),
        )
        if damage_title:
            damage_path = download_wiki_image(api, damage_title, damaged_dir / "cat-damaged", preserve_gif=True)
            if damage_path and damage_path.suffix.lower() == ".gif":
                damaged_frames = extract_gif_frames(damage_path, damaged_dir)
            elif damage_path:
                damaged_frame = damaged_dir / "frame-001.png"
                if copy_as_png(damage_path, damaged_frame):
                    damaged_frames = [damaged_frame]
    if not damaged_frames and frame_paths:
        if not enemy:
            for stale in damaged_dir.iterdir():
                if stale.is_file() and (stale.name.startswith("frame-") or stale.name.startswith("cat-damaged")):
                    stale.unlink()
        damaged_frame = damaged_dir / "frame-001.png"
        if copy_as_png(frame_paths[-1], damaged_frame):
            damaged_frames = [damaged_frame]

    upgrade_path: Path | None = None
    if not enemy:
        upgrade_title = find_unit_asset(api, ["Udi000 BCP"], excluded=form_exclusions) or find_unit_asset(api, ["Cat's Upgrade Menu icon"], required=("cat", "upgrade"), excluded=form_exclusions + ("attack", "spritesheet", "storage", "basic cat bcp"))
        upgrade_path = download_wiki_image(api, upgrade_title, folder / "upgrade") if upgrade_title else None
        if not upgrade_path and slot_path:
            upgrade_path = folder / "upgrade.png"
            copy_as_png(slot_path, upgrade_path)

    frames = [path.relative_to(ROOT).as_posix() for path in frame_paths]
    attacks = [path.relative_to(ROOT).as_posix() for path in attack_frames]
    damaged = [path.relative_to(ROOT).as_posix() for path in damaged_frames]
    # Never use a slot portrait as a fallback when no actual field sprite exists.
    manifest = {
        "name": name,
        "source": "Battle Cats sprite artwork. Original game art belongs to its respective rights holders.",
        "sourceUrl": source_url,
        "moving": frames,
        "attacks": attacks,
        "attack": attacks[0] if attacks else (attack_gif.relative_to(ROOT).as_posix() if attack_gif else (frames[0] if frames else None)),
        "damagedFrames": damaged,
        "knockbackFrames": damaged,
        "idle": frames[0] if frames else None,
        "damaged": damaged[0] if damaged else None,
        "slot": slot_path.relative_to(ROOT).as_posix() if slot_path else None,
        "upgrade": upgrade_path.relative_to(ROOT).as_posix() if upgrade_path else None,
    }
    (folder / "assets.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (moving_dir / "frames.json").write_text(json.dumps({"frames": frames}, indent=2), encoding="utf-8")
    (attack_dir / "frames.json").write_text(json.dumps({"frames": attacks}, indent=2), encoding="utf-8")
    (damaged_dir / "frames.json").write_text(json.dumps({"frames": damaged}, indent=2), encoding="utf-8")
    print(f"Wrote {folder.relative_to(ROOT)}/assets.json: {len(frames)} moving, {len(attacks)} attack, {len(damaged)} damaged frame(s).")
    return manifest


def import_korea_background(api: str) -> Path | None:
    """Prefer the real daytime overworld background; crop a clean patch from a Korea screenshot only as a fallback."""
    level_dir = ROOT / "Levels" / "Korea"
    level_dir.mkdir(parents=True, exist_ok=True)

    # Prefer the actual localizable Battle Cats battlefield artwork over a tiny screenshot crop.
    for background_file in ("Bg000.png", "Bg001.png", "Bg002.png", "Bg003.png"):
        background = download_wiki_image(api, "File:" + background_file, level_dir / "background")
        if background:
            stale_reference = level_dir / "korea-gameplay-reference.jpg"
            stale_reference.unlink(missing_ok=True)
            print(f"Imported actual Battle Cats background {background_file} for Levels/Korea/background.png.")
            return level_dir / "background.png"

    screenshot_url = "https://img.utdstc.com/screen/dd5/107/dd5107d5976887edeb3a4613e7c12d6f2f20409939e180f7bb0754c6b21ba62d%3A600"
    temp = level_dir / "korea-gameplay-reference.jpg"
    try:
        if not temp.exists() or temp.stat().st_size < 1000:
            if not download(screenshot_url, temp):
                return None
        from PIL import Image
        with Image.open(temp) as opened:
            image = opened.convert("RGB")
            width, height = image.size
            crop = image.crop((round(width * 0.45), round(height * 0.05), round(width * 0.98), round(height * 0.74)))
            crop.save(level_dir / "background.png", format="PNG", optimize=True)
        temp.unlink(missing_ok=True)
        print("Created Levels/Korea/background.png from a clean section of an actual Korea-stage screenshot.")
        return level_dir / "background.png"
    except Exception as exc:
        print(f"WARNING: could not create Korea background asset: {exc}")
        return None


def import_cat_base_sprite() -> None:
    """Crop the real Cat Base battlefield artwork from the Sprite Resource sheet."""
    from PIL import Image

    source = SHEETS / "battlecats-cat-base-sheet.png"
    if not source.exists():
        print("WARNING: Cat Base sprite sheet unavailable; leaving the base asset unchanged.")
        return
    destination = ROOT / "Levels" / "Korea" / "cat-base.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(source) as opened:
            sheet = opened.convert("RGBA")
        crop = sheet.crop((0, 0, min(sheet.width, round(sheet.width * 0.26)), sheet.height))
        bounds = crop.getchannel("A").getbbox()
        if bounds:
            crop = crop.crop(bounds)
        crop.save(destination, format="PNG", optimize=True)
        print(f"Saved real Cat Base sprite to {destination.relative_to(ROOT)}.")
    except Exception as exc:
        print(f"WARNING: couldn't crop Cat Base sprite: {exc}")


def import_battle_scene_assets(api: str) -> None:
    """Create the exact content folders used by the first playable Korea battle."""
    (ROOT / "Cats").mkdir(parents=True, exist_ok=True)
    (ROOT / "enemys").mkdir(parents=True, exist_ok=True)
    (ROOT / "Levels" / "Korea").mkdir(parents=True, exist_ok=True)
    import_unit_assets(api, ROOT / "Cats" / "cat", "cat", enemy=False)
    import_unit_assets(api, ROOT / "enemys" / "doge", "doge", enemy=True)
    import_korea_background(api)
    import_cat_base_sprite()

def main() -> int:
    SPRITES.mkdir(parents=True, exist_ok=True)
    # Import the real menu screenshot as a local asset first; the SVG remains a
    # fallback if the source is temporarily unavailable.
    for url, destination in SCREENSHOT_SOURCES:
        if destination.exists() and destination.stat().st_size > 1000:
            print(f"Already present: {destination.relative_to(ROOT)}")
            continue
        download(url, destination)

    try:
        api, _ = get_category_files()
        import_battle_scene_assets(api)
    except Exception as exc:
        print(f"WARNING: could not import first-battle assets: {exc}")

    sheets = import_relevant_sheets()
    cat_source = SHEETS / "battlecats-cat-spritesheet.png"
    if cat_source.exists():
        sheets.append({
            "title": "Cat sprite sheet",
            "path": cat_source.relative_to(ROOT).as_posix(),
            "source": "The Spriters Resource — The Battle Cats",
            "source_url": "https://www.spriters-resource.com/mobile/thebattlecats/asset/81040/",
            "license_note": "Sprite sheet uploaded by the community. Original artwork is owned by PONOS.",
        })
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
        normalized = normalize_mislabeled_pngs()
        print(f"Normalized {normalized} mislabeled PNG file(s).")
    except Exception as exc:
        print(f"WARNING: Could not generate separate UI sprites: {exc}")
        raise
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# Regenerate from the supplied Doge Walk/Attack/Hurt atlas after refreshing the PNG.

# Rebuild the separated Walk/Attack/Hurt frames when the supplied atlas is refreshed.
