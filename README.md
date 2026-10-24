# Battle Cats Menu Remake

A browser-based fan remake using local menu screenshots and image assets from The Battle Cats Wiki, plus HTML/CSS hitboxes and JavaScript progression.

## Play

Open index.html locally, or the GitHub Pages site.

## Menu screens

- Title screen uses a bundled local Battle Cats title-screen image with working Play, Settings, and Mailbox click areas.
- Cat Base uses a bundled local Cat Base menu image with working click areas for Start, Upgrade, Equip, Menu, Gamatoto, Missions, Storage, Capsules, Store, and Cat Food.
- The three main Cat Base buttons are Start!!, Upgrade, and Equip. Cat Guide, Enemy Guide, and Treasure are in Menu rather than shown as main buttons.
- Fresh save starts with 0 XP, 30 Cat Food, 100 Energy, and only the basic Cat at Level 1. The battle screen remains a progression demo.
- The starter save and other progress are stored in browser localStorage.

## Project structure

- index.html — app shell.
- src/style.css — responsive display and interactive hit areas over the local menu images.
- src/main.js — screen navigation, resource overlays, and progression demo.
- sprites/ — local artwork used by the game.
- sprites/original_sheets/ — downloaded Battle Cats Wiki menu and Cat-related images, plus source metadata.
- scripts/import_battlecats_sprites.py — imports relevant image files from the wiki's gallery pages.
- .github/workflows/import-battlecats-sprites.yml — updates local assets automatically.

## Asset notes

The title screen image is stored at sprites/title-screen.webp. The Cat Base menu image and other wiki images are stored under sprites/original_sheets/. Source links and license notes are tracked in sprites/original_sheets/index.json. Community wiki content is generally marked CC BY-SA unless a file's page states otherwise; the original game artwork remains the property of its respective rights holders. This is an unofficial fan-made project and is not affiliated with or endorsed by PONOS.
