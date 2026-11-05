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

All 48 Empire of Cats stages now have their own `stats.json` under `Levels/<Stage Name>/`. The game loads the selected stage's file directly, so edits to its base health, enemy waves, spawn timing, spawn chance, and alive limit take effect without editing `src/main.js`. Stage art remains independently configurable through the `background` and `enemyBase` filenames.


## Enemy data and trigger rules

Enemy folders under `enemys/<enemy-name>/` can contain:
- `stats.json` — base HP, damage, movement speed, range, attack cooldown, knockbacks and reward.
- `assets.json` — walking, attack, damaged and idle sprite paths. The battle loader reads these automatically.

Each level's `stats.json` can also define:
- `maxEnemies` — maximum enemies simultaneously alive on the field.
- `enemyBaseHealth` — that stage's enemy base HP.
- `enemySpawns` entries with `startTime`, `intervalMin`, `intervalMax`, `amount`, `infinite`, `maxAlive`, `spawnChance`.
- `baseHealthPercent` — spawn the rule once the enemy base drops to that percentage or lower. This can be combined with `amount` or `infinite`.

Example base-triggered spawn:
```json
{"enemy":"hippoe","amount":1,"baseHealthPercent":90,"intervalMin":1,"intervalMax":1,"maxAlive":1}
```
