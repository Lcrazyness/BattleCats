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


def import_relevant_sheets() -> list[dict]:
    try:
        api, members = get_category_files()
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
        print("ERROR: The local title screenshot is missing; title screen will use its SVG fallback.")
        # A failure to fetch upstream art must not prevent the app from deploying.
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
