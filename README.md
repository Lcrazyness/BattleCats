# Battle Cats Remake

A fan-made remake, built in plain HTML5 canvas + JavaScript. No build step, no dependencies.

**Run it:** open `index.html` in a browser (or serve the folder, e.g. `python3 -m http.server`).
Opening via `file://` works, but some browsers block loading `assets/manifest.json` that way, in which case the game runs on placeholder art. Serving the folder avoids that.

## Status

| Screen | State |
| --- | --- |
| Title (Play / Settings / Mailbox) | built |
| Cat Base (Start, Upgrade, Equip, Menu, Gamatoto, Missions, Storage, capsules, Store, HUD, bubble) | built, navigation works |
| Everything else | stub screens with a back arrow |

## Layout

```
index.html            entry point (classic <script> tags, load order matters)
assets/
  manifest.json       maps asset names -> image files; null = use placeholder
  ui/ sprites/ bg/    drop your own art here
src/
  main.js             boot, input, game loop, scene registration
  style.css
  engine/
    assets.js         manifest loader
    draw.js           canvas helpers (outlined text, buttons, placeholders)
    widgets.js        button / icon / counter / banner / bubble / ... built from data
    scenes.js         Scene base class + SceneManager (history, fade)
  data/
    layout.js         every menu position, as data. Tweak and refresh.
    save.js           localStorage save (xp, money, cat food, capsule counts)
  scenes/
    TitleScene.js
    CatBaseScene.js
    StubScene.js      placeholder for unbuilt screens
```

## Adding art

1. Put the image in `assets/ui/`, `assets/sprites/` or `assets/bg/`.
2. Set its path in `assets/manifest.json`, e.g. `"ui.button": "ui/button.png"`.

Nothing in the code depends on any image existing; missing art falls back to a generated placeholder.
Use art you made or have the rights to use.

## Adding a screen

1. Create `src/scenes/YourScene.js` extending `Scene` (see `CatBaseScene.js`), add its `<script>` tag in `index.html`.
2. In `src/main.js`, replace the matching stub with `game.scenes.register('name', (g, p) => new YourScene(g, p))`.

## Dev tips

- In the browser console: `game.save.set('catFood', 99999)`, `game.save.reset()`.
- `Esc` goes back.

## Legal

Fan project, not affiliated with or endorsed by the original game's publisher. No original game assets are included.
