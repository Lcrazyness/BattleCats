# Battle Cats Menu Remake

A browser-based Battle Cats menu fan remake using local screenshots, individual menu-button image crops, HTML/CSS, and plain JavaScript.

## What it has

- Title screen: local scene artwork plus separate Play, Settings, and Mailbox image sprites.
- Cat Base: separate clickable Start!!, Upgrade, Equip, Menu, Gamatoto, Missions, Storage, Cat Capsule, Rare Cat Capsule, Back, Store, and Cat Food sprite images.
- Cat Base follows the real layout: only Start!!, Upgrade, and Equip are the three large left-side buttons. Cat Guide, Enemy Guide, and Treasure are inside Menu.
- Each visible button is its own image element with its own click action, not an invisible hitbox.
- A fresh save starts with 0 XP, 0 Cat Food, 100 Energy, and the basic Cat at Level 1. The Cat Base image stores its initial zero values directly in the local background, not as duplicate number overlays.
- Browser-local saving through localStorage; save version 4 starts fresh so old demo resources do not reappear.

## Project structure

- index.html — page shell.
- src/style.css — responsive screen sizing and placement of individual menu sprites.
- src/main.js — screen navigation, sprite elements, and local save.
- sprites/ui/ — individual cropped button and icon images.
- sprites/backgrounds/ — local title background and `bg_restored.png`, the current Cat Base background.
- sprites/original_sheets/ — locally bundled Battle Cats Wiki source images.
- sounds/ — local Ogg sound effects and menu/battle music, downloaded with `scripts/import_battlecats_sounds.py`.
- sounds/source-index.json — source pages and notes for each audio asset.
- .github/workflows/import-battlecats-sounds.yml — imports the selected audio assets into the repository.
- sprites/ui/sprite-map.json — generated map of button sprite paths.
- scripts/import_battlecats_sprites.py — downloads source images and crops the UI components.
- .github/workflows/import-battlecats-sprites.yml — rebuilds local assets.

## Asset sources and limitations

The [Spriters Resource page for The Battle Cats](https://www.spriters-resource.com/mobile/thebattlecats/) provides assets such as Cat Base, Cat Icons, and Gamatoto, but it does not list the title-screen Play/Settings or Cat Base menu buttons as separate assets. Those UI buttons are therefore cropped into individual image files from the locally bundled menu references. Source image links and notes are recorded in sprites/original_sheets/index.json.

This is an unofficial fan project, not affiliated with or endorsed by PONOS. Original game artwork belongs to its respective rights holders. Clicking Start opens the existing stage/battle demo, not the complete side-scrolling game.


## Audio

The current build uses local files in \`sounds/\` for button clicks, menu selection, the Cat Base door, battle entry, capsule draws, rewards, and victory/defeat cues. The **Sound Effects** and **Music** toggles in Settings control the corresponding playback. Menu music and battle music loop separately. Browsers block autoplay, so audio starts after the first player click.

Audio files are sourced from the community [Battle Cats Wiki Music page](https://battle-cats.fandom.com/wiki/Music); the source file pages are recorded in \`sounds/source-index.json\`. These are copyrighted game assets, not public-domain audio.
