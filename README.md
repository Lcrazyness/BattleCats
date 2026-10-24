# Battle Cats Menu Remake

A browser-based fan remake focused on recreating the classic **Battle Cats title screen and Cat Base menu layout** with HTML, CSS, SVG, and plain JavaScript. No build step or external dependencies are required.

## Play

Open the GitHub Pages site if Pages is enabled for this repository, or open index.html locally in a browser.

## Menu screens

- Title screen with the large Battle Cats-style logo treatment, Play, Settings, and Mailbox.
- Cat Base layout with the brown XP header, green patterned background, five tall yellow menu buttons, cat character and dialogue bubble, and the bottom Store/Cat Food strip.
- Stage selection and chapter stage list.
- Upgrade, Equip, Cat Dictionary, Treasure, Cat Capsules, Storage, Missions, Gamatoto, Store, Mailbox, and Settings menus.
- Fresh save starts at 0 XP, 30 Cat Food, 100 Energy, and the basic Cat at Level 1 (HP 100 / ATK 8). The first stage win unlocks Tank Cat.
- Local save data through localStorage, including XP, cat food, tickets, cats, levels, and equipped lineup.
- Responsive layout for desktop and mobile screens.

## Project structure

- index.html — page shell.
- src/style.css — menu layouts, patterned backgrounds, buttons, and responsive styling.
- src/main.js — screen rendering, navigation, progression demo, and local save.
- Assets/manifest.js — future asset mapping.

## Current limitations

The menu layouts are recreated with CSS and inline SVG rather than original in-game artwork. The battle button currently runs a **simulated reward demo**; full side-scrolling combat, original animations, sound, and official assets are not included. This is an unofficial fan project and is not affiliated with or endorsed by the game's publisher.
