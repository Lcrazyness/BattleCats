# Battle Cats Menu Remake

A browser-based fan remake focused on recreating Battle Cats menu layouts with HTML, CSS, local SVG sprites, and plain JavaScript.

## Play

Open the GitHub Pages site if Pages is enabled for this repository, or open index.html locally in a browser.

## Menu screens

- Title screen composed from local background, logo, crowd, and mailbox sprites.
- Cat Base layout with the brown XP header, green patterned background, five yellow menu buttons, cat character and dialogue bubble, and bottom Store/Cat Food strip.
- Stage selection and chapter stage list.
- Upgrade, Equip, Cat Dictionary, Treasure, Cat Capsules, Storage, Missions, Gamatoto, Store, Mailbox, and Settings menus.
- Fresh save starts at 0 XP, 30 Cat Food, 100 Energy, and the basic Cat at Level 1 (HP 100 / ATK 8). The first simulated stage win unlocks Tank Cat.
- Local save data through localStorage.
- Responsive layout for desktop and mobile screens.

## Project structure

- index.html — page shell.
- src/style.css — responsive layout and menu styling.
- src/main.js — screen rendering, navigation, progression demo, and local save.
- sprites/ — local artwork used by the game.
  - title-background.svg — title scene scenery.
  - title-logo.svg — outlined game logo and cat mascot.
  - title-crowd.svg — title-screen cat crowd.
  - cat.svg and cat-head.svg — reusable Cat sprites.
  - mailbox.svg — mailbox icon.
- Assets/manifest.js — logical asset map.

## Current limitations

The sprites are original vector recreations inspired by the provided Battle Cats reference screens; they are not extracted from the official game. The battle button currently runs a simulated reward demo; full side-scrolling combat, original animations, and sound are not included. This is an unofficial fan project and is not affiliated with or endorsed by the game's publisher.
