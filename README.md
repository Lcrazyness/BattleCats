# Battle Cats Menu Remake

A browser-based Battle Cats menu fan remake using local screenshots, cropped menu sprites from the Battle Cats Wiki, HTML/CSS, and plain JavaScript.

## What it has

- Title screen: local scene artwork plus separate Play, Settings, and Mailbox image sprites.
- Cat Base: separate clickable Start!!, Upgrade, Equip, Menu, Gamatoto, Missions, Storage, Cat Capsule, Rare Cat Capsule, Back, Store, and Cat Food sprites.
- Cat Base main buttons follow the real layout: only Start!!, Upgrade, and Equip are the three large left-side buttons. Cat Guide, Enemy Guide, and Treasure are under Menu.
- The sprite controls are real buttons containing individual image files, not invisible hitboxes placed over a flattened screenshot.
- Fresh save starts with 0 XP, 30 Cat Food, 100 Energy, and the basic Cat at Level 1. Battle progression is still a demo.
- Browser-local saving through localStorage.

## Project structure

- index.html — page shell.
- src/style.css — responsive screen sizing and placement of individual menu sprites.
- src/main.js — screen navigation, sprite elements, resource overlays, and progression demo.
- sprites/ui/ — individual cropped button and icon images.
- sprites/backgrounds/ — title and Cat Base background images with menu controls removed from the sprite regions.
- sprites/original_sheets/ — locally bundled Battle Cats Wiki source images.
- sprites/ui/sprite-map.json — generated map of button sprite asset names to file paths.
- scripts/import_battlecats_sprites.py — imports source images and crops each UI element.
- .github/workflows/import-battlecats-sprites.yml — updates local assets.

## Asset sources and limitations

The source screenshots and game sprites are from community Battle Cats Wiki pages. Source links and notes are recorded in sprites/original_sheets/index.json. Wiki content is generally CC BY-SA unless an individual file says otherwise; the game's original artwork remains the property of its rights holders. This is an unofficial fan project, not affiliated with or endorsed by PONOS.

The game is not a full battle recreation yet: clicking Start opens the existing stage/battle demo rather than the complete side-scrolling game.
