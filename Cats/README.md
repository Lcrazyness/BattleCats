# Cat battle stats

Each unit can have its own `stats.json` inside its folder. For Normal Cat, edit `Cats/cat/stats.json`. Other cats use `Cats/<folder-name>/stats.json`, where the folder name is the unit name in lowercase with spaces changed to hyphens (for example, `Tank Cat` -> `Cats/tank-cat/stats.json`). The game falls back to the saved unit values if a matching stats file does not exist.

Editable fields:
- `health`: maximum health.
- `damage`: damage dealt by an attack.
- `price`: money needed to deploy a Cat.
- `speed`: movement speed on the battlefield.
- `spriteChangeSpeed`: animation frames per second for moving and attack frames.
- `range`: attack distance.
- `recharge`: seconds until it can be deployed again.
- `knockbackThresholdPercent`: remaining-health interval between knockbacks. 25 means knockback at 75%, 50%, and 25% HP.
- `knockbackDuration`: duration in seconds for the two-jump knockback.
- `knockbackDistance`: how far back the unit is pushed.

Sprite filenames live in `assets.json`. `slot` is only the unit-selection portrait; battlefield animations use `moving`, `attacks`, `idle`, and `damaged` paths.
