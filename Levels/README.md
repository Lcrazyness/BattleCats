# Level battle assets

Each playable stage has its own folder under `Levels/`, named exactly like the stage (for example, `Levels/Korea/`).

Each level folder should contain:
- `stats.json` — the level's `enemyBaseHealth`, optional `catBaseHealth`, spawn rules, and asset filenames.
- `background.png` — that level's battlefield backdrop (or another local PNG/WebP/SVG file named by the `background` field).
- `enemy-base.svg` — that level's enemy-base sprite (or another local PNG/WebP/SVG file named by the `enemyBase` field).

Example:
```json
{
  "name": "Korea",
  "background": "background.png",
  "enemyBase": "enemy-base.svg",
  "enemyBaseHealth": 500,
  "catBaseHealth": 1000,
  "initialSpawnDelay": 2,
  "enemySpawns": []
}
```

The level loader reads the files and base health from that level's own folder. The Cat Base is a shared transparent sprite at `sprites/battle/cat-base.svg`; the Worker Cat wallet and Cat Cannon icons are in `sprites/ui/`.

Korea is the first level folder configured with its own backdrop, enemy-base sprite, and base health. Add the equivalent assets and `stats.json` to each additional stage folder as those stages are built.
