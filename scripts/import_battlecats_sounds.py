#!/usr/bin/env python3
"""Download a small, named set of Battle Cats audio assets into sounds/.

Files are sourced from file pages indexed by the community Battle Cats Wiki.
This intentionally downloads only the clips listed below, never the entire archive.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parent.parent
SOUNDS = ROOT / "sounds"
API_CANDIDATES = [
    "https://battle-cats.fandom.com/api.php",
    "https://battlecats.miraheze.org/w/api.php",
    "https://battlecats.miraheze.org/api.php",
]
WIKI_FILE_ROOT = "https://battle-cats.fandom.com/wiki/File:"
USER_AGENT = "BattleCatsFanRemakeAudioImporter/1.0 (GitHub Actions; fan remake asset references)"
MAX_FILE_BYTES = 32 * 1024 * 1024
session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})

# Output filename -> wiki filename / what the clip is used for in this project.
ASSETS: list[dict[str, Any]] = [
    {"file": "button-click.ogg", "wiki_file": "Snd011.ogg", "role": "Common UI button press"},
    {"file": "menu-select.ogg", "wiki_file": "Snd010.ogg", "role": "Menu selection / navigation"},
    {"file": "back-cancel.ogg", "wiki_file": "Snd012.ogg", "role": "Back / cancel from menus"},
    {"file": "blocked-action.ogg", "wiki_file": "Snd015.ogg", "role": "Blocked or unavailable action"},
    {"file": "cat-base-door.ogg", "wiki_file": "Snd046.ogg", "role": "Opening the Cat Base door"},
    {"file": "enter-battle.ogg", "wiki_file": "Snd007.ogg", "role": "Entering a stage such as Japan / beginning battle"},
    {"file": "victory.ogg", "wiki_file": "VictoryChime.ogg", "role": "Snd008 victory sound / simulated win", "refresh": True},
    {"file": "upgrade.ogg", "wiki_file": "Snd014.ogg", "role": "Upgrade action (user-requested mapping)", "refresh": True},
    {"file": "defeat.ogg", "wiki_file": "Defeat.ogg", "role": "Snd009 defeat sound"},
    {"file": "reward.ogg", "wiki_file": "TreasureObtained.ogg", "role": "Snd029 reward obtained"},
    {"file": "login-reward.ogg", "wiki_file": "Snd041.ogg", "role": "Login reward / cat stamp"},
    {"file": "capsule-draw.ogg", "wiki_file": "Snd043.ogg", "role": "Drawing a Cat Capsule"},
    {"file": "title-theme.ogg", "wiki_file": "Snd001.ogg", "role": "Title screen music", "refresh": True},
    {"file": "menu-theme.ogg", "wiki_file": "Snd002.ogg", "role": "Cat Base/main menu music", "refresh": True},
    {"file": "battle-theme.ogg", "wiki_file": "Snd003.ogg", "role": "Battle/stage background music"},
]


def lookup_file(wiki_file: str) -> tuple[str, dict[str, Any]]:
    errors: list[str] = []
    for api in API_CANDIDATES:
        params = {
            "action": "query",
            "titles": "File:" + wiki_file,
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "format": "json",
        }
        try:
            response = session.get(api, params=params, timeout=35)
            response.raise_for_status()
            data = response.json()
            pages = data.get("query", {}).get("pages", {})
            for page in pages.values():
                if page.get("missing") is not None or page.get("imagerepository") == "shared" and not page.get("imageinfo"):
                    continue
                imageinfo = page.get("imageinfo") or []
                if imageinfo and imageinfo[0].get("url"):
                    info = imageinfo[0]
                    print(f"Resolved {wiki_file} via {api} ({info.get('mime', 'unknown MIME')}, {info.get('size', 0)} bytes)")
                    return api, info
            errors.append(f"{api}: no file information for File:{wiki_file}")
        except Exception as exc:
            errors.append(f"{api}: {exc}")
            print(f"WARNING: metadata lookup failed for {wiki_file} using {api}: {exc}")
        time.sleep(0.15)
    raise RuntimeError("; ".join(errors))


def valid_ogg(path: Path) -> bool:
    try:
        if path.stat().st_size < 128 or path.stat().st_size > MAX_FILE_BYTES:
            return False
        with path.open("rb") as stream:
            return stream.read(4) == b"OggS"
    except OSError:
        return False


def download_ogg(url: str, destination: Path) -> bool:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_suffix(destination.suffix + ".part")
    try:
        with session.get(url, timeout=60, stream=True) as response:
            response.raise_for_status()
            total = 0
            first = b""
            with temp.open("wb") as output:
                for chunk in response.iter_content(chunk_size=128 * 1024):
                    if not chunk:
                        continue
                    if not first:
                        first = chunk[:4]
                    total += len(chunk)
                    if total > MAX_FILE_BYTES:
                        raise ValueError(f"audio exceeds {MAX_FILE_BYTES:,} byte safety limit")
                    output.write(chunk)
            if first != b"OggS":
                temp.unlink(missing_ok=True)
                raise ValueError(f"file response was not Ogg audio (signature {first!r})")
            if total < 128:
                temp.unlink(missing_ok=True)
                raise ValueError("audio file is suspiciously small")
        temp.replace(destination)
        print(f"Downloaded sounds/{destination.name} ({total:,} bytes)")
        return True
    except Exception as exc:
        temp.unlink(missing_ok=True)
        print(f"WARNING: couldn't download {url}: {exc}")
        return False


def main() -> int:
    SOUNDS.mkdir(parents=True, exist_ok=True)
    saved: list[dict[str, str | int]] = []
    failures: list[str] = []
    for asset in ASSETS:
        filename = asset["file"]
        wiki_file = asset["wiki_file"]
        destination = SOUNDS / filename
        if valid_ogg(destination) and not asset.get("refresh", False):
            print(f"Already present: sounds/{filename}")
            file_size = destination.stat().st_size
            api = ""
            source_url = WIKI_FILE_ROOT + wiki_file
        else:
            try:
                api, info = lookup_file(wiki_file)
                size = int(info.get("size") or 0)
                if size > MAX_FILE_BYTES:
                    raise ValueError(f"source is too large: {size:,} bytes")
                url = info["url"]
                if not download_ogg(url, destination):
                    raise RuntimeError("download failed or wasn't valid Ogg audio")
                file_size = destination.stat().st_size
                source_url = WIKI_FILE_ROOT + wiki_file
            except Exception as exc:
                failures.append(filename)
                print(f"ERROR: {filename} ({wiki_file}) could not be imported: {exc}")
                time.sleep(0.15)
                continue
        saved.append({
            "file": "sounds/" + filename,
            "wiki_file": wiki_file,
            "role": asset["role"],
            "bytes": file_size,
            "source_page": source_url,
            "lookup_api": api,
            "source_note": "Community wiki file page. Battle Cats audio remains copyrighted by PONOS/respective rights holders; verify permissions before redistributing.",
        })
        time.sleep(0.15)

    index = {
        "source": "The Battle Cats Wiki — Music / Sound Effects",
        "source_page": "https://battle-cats.fandom.com/wiki/Music",
        "assets": saved,
        "failed_assets": failures,
        "note": "Audio is included for a private/unofficial fan remake prototype. The game audio is not public domain and remains the property of its rights holders.",
    }
    (SOUNDS / "source-index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    if not any(asset["file"] == "sounds/button-click.ogg" for asset in saved):
        print("ERROR: required button-click sound wasn't imported.")
        return 1
    if len(saved) < 5:
        print(f"WARNING: only {len(saved)} of {len(ASSETS)} sound files were imported.")
    print(f"Imported {len(saved)} audio assets; {len(failures)} unavailable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
