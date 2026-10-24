# Battle Cats Remake

A fan-made, browser-based Battle Cats-inspired menu and progression demo built with plain HTML, CSS, and JavaScript. No build step or external dependencies required.

**Play locally:** open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Current features

- Title screen with Play, Settings, Mailbox, and About.
- Cat Base hub with Battle, Upgrade, Cats, Equip, Gamatoto, Missions, Storage, Capsules, Store, Menu, Mailbox, and Settings.
- Stage selection and a simple battle-preview/reward loop.
- Cat collection, unit upgrades, ticket-based cat recruitment, and rank progression.
- Settings and utility screens with working navigation and feedback.
- Local save data through `localStorage`; progress remains on the same browser/device.
- Responsive layout for desktop and mobile screens.
- Escape returns to the previous hub.

## Project structure

```
index.html       Page shell and top resource bar
src/
  style.css      Responsive menu theme and reusable UI components
  main.js        Screen rendering, navigation, game actions, local save
Assets/
  manifest.js    Planned image asset mapping
README.md        Project notes
```

## Art and next steps

The current interface uses CSS shapes and emoji placeholders so it can run without bundled game art. You can replace these with original artwork or assets you have permission to use. The next major step is to connect proper illustrations, animations, audio, and fully playable battle mechanics.

## Legal

This is an unofficial fan-made project and is not affiliated with or endorsed by the creators or publisher of The Battle Cats. It does not include original game assets.