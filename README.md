# Battle Cats Menu Remake

A browser-based Battle Cats menu fan remake using local screenshots, individual menu-button image crops, HTML/CSS, and plain JavaScript.

## What it has

- Title screen: local scene artwork plus separate Play, Settings, and Mailbox image sprites.
- Cat Base: separate clickable Start!!, Upgrade, Equip, Menu, Gamatoto, Missions, Storage, Cat Capsule, Rare Cat Capsule, Back, Store, and Cat Food sprite images.
- Cat Base follows the real layout: only Start!!, Upgrade, and Equip are the three large left-side buttons. Cat Guide, Enemy Guide, and Treasure are inside Menu.
- Empire of Cats Chapter 1 has a dedicated stage-select map with all 48 stages in order, using the Empire of Cats map image from the Battle Cats Wiki gallery. Start!! opens this stage map directly.
- Korea is the first playable battle: the basic Cat can be deployed from the bottom unit slot, Doges advance from the enemy side, bases have health bars, and the stage has money, cooldown, victory, defeat, and retry behavior.
- Each visible button is its own image element with its own click action, not an invisible hitbox.
- A fresh save starts with 0 XP, 0 Cat Food, 100 Energy, and the basic Cat at Level 1. The Cat Base image stores its initial zero values directly in the local background, not as duplicate number overlays.
- Browser-local saving through localStorage; save version 4 starts fresh so old demo resources do not reappear.

## Project structure

- index.html — page shell.
- src/style.css — responsive screen sizing and placement of individual menu sprites.
- src/main.js — screen navigation, sprite elements, and local save.
- sprites/ui/ — individual cropped button and icon images.
- sprites/backgrounds/ — local title background, Cat Base background, and the Battle Cats Empire of Cats world-map artwork.
- `Cats/cat/` — default Cat assets: `moving/`, `attack/`, `damaged/`, `slot.png`, `upgrade.png`, and `assets.json`.
- `enemys/doge/` — Doge assets: `moving/`, `attack/`, `damaged/`, `slot.png`, and `assets.json` (no enemy upgrade icon).
- `Levels/Korea/` — the Korea battle background.
- sprites/original_sheets/ — locally bundled Battle Cats Wiki source images.
- sounds/ — local MP3 sound effects and menu/battle music, downloaded with `scripts/import_battlecats_sounds.py`.
- sounds/source-index.json — source pages and notes for each audio asset.
- .github/workflows/import-battlecats-sounds.yml — imports the selected audio assets into the repository.
- sprites/ui/sprite-map.json — generated map of button sprite paths.
- scripts/import_battlecats_sprites.py — downloads source images and crops the UI components.
- .github/workflows/import-battlecats-sprites.yml — rebuilds local assets.

## Asset sources and limitations

The [Spriters Resource page for The Battle Cats](https://www.spriters-resource.com/mobile/thebattlecats/) provides menu and battle sprite-sheet references; the [Normal Cat sprite sheet](https://www.spriters-resource.com/mobile/thebattlecats/asset/81040/) is used as the intended source for Cat animation frames. Doge's animation and icon are imported from Battle Cats community-wiki assets. Those UI buttons are therefore cropped into individual image files from the locally bundled menu references. Source image links and notes are recorded in sprites/original_sheets/index.json.

This is an unofficial fan project, not affiliated with or endorsed by PONOS. Original game artwork belongs to its respective rights holders. Korea is an early playable prototype; its UI and battle timing are still simplified and are intended to be polished in later passes.


## Audio

The build uses local MP3 audio files in the sounds folder. The title screen uses title-theme.mp3 (Snd001); the Cat Base and regular menus use menu-theme.mp3 (Snd002); the battle preview uses battle-theme.mp3 (Snd003). Button clicks use the standard Battle Cats button-press sound, not the Cat Base door sound.

The Sound Effects and Music toggles in Settings control playback. Music begins after the first player interaction because browsers block autoplay before user input. Music changes with the current screen.

Audio sources are recorded in sounds/source-index.json and come from community Battle Cats Wiki file pages. These game assets are copyrighted and are not public-domain audio.
