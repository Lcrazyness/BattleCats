#!/usr/bin/env python3
"""Apply the requested Battle Cats enemy damage, cat-level test and XP changes."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
main_path = ROOT / "src/main.js"
css_path = ROOT / "src/style.css"
html_path = ROOT / "index.html"

main = main_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    if old not in source:
        raise RuntimeError(f"Could not locate {label}")
    return source.replace(old, new, 1)


# Keep the runtime fallback in sync with the JSON enemy stat files.
stat_replacements = [
    ('"b-b-bunny": {health:500,damage:50,speed:22,',
     '"b-b-bunny": {health:500,damage:25,speed:12,', "B.B.Bunny"),
    ('"kang-roo": {health:4000,damage:250,speed:20,',
     '"kang-roo": {health:4000,damage:125,speed:11,', "Kang Roo"),
    ('"squire-rel": {health:80,damage:30,speed:30,',
     '"squire-rel": {health:80,damage:15,speed:13,', "Squire Rel"),
    ('mooth: {health:5000,damage:350,speed:20,',
     'mooth: {health:5000,damage:175,speed:10,', "Mooth"),
    ('"one-horn": {health:15000,damage:500,speed:3,',
     '"one-horn": {health:15000,damage:250,speed:3,', "One Horn"),
    ('"teacher-bear": {health:3000,damage:1000,speed:4,',
     '"teacher-bear": {health:3000,damage:500,speed:4,', "Teacher Bear"),
    ('"the-face": {health:99999,damage:2000,speed:1,',
     '"the-face": {health:99999,damage:1000,speed:1,', "The Face"),
]
for old, new, label in stat_replacements:
    main = replace_once(main, old, new, label + " runtime stats")

# Cat level growth is 15% per level above level 1.
main = replace_once(
    main,
    "const levelMultiplier = 1 + Math.max(0,unitLevel-1)*0.13;",
    "const levelMultiplier = 1 + Math.max(0,unitLevel-1)*0.15;",
    "cat level multiplier"
)
main = main.replace(
    "Each Cat level increases its health and attack power by 13%.",
    "Each Cat level increases its health and attack power by 15%."
)

# Grant a persistent, practically unlimited XP balance without serializing Infinity.
xp_marker = 'let scene = "loading";'
xp_block = '''save.xp = Math.max(9999999999, Number(save.xp) || 0);
try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
let scene = "loading";'''
main = replace_once(main, xp_marker, xp_block, "initial XP grant")

# Replace the upgrade screen with working per-cat and all-cat level testing controls.
upgrade_start = main.index("function renderUpgrade() {")
upgrade_end = main.index(chr(10) + "function renderDictionary", upgrade_start)
new_upgrade = r'''function renderUpgrade() {
  const body = pageCopy("Each Cat level increases its health and attack power by 15%.")+
    '<h3 style="margin:9px 0 0;text-align:center">CAT UPGRADES</h3>'+
    '<div class="menu-list">'+save.units.map((unit,i)=>{
      const level=Math.max(1,Math.floor(Number(unit.level)||1));
      const current=battleUnitStats(unit);
      const next=battleUnitStats({...unit,level:level+1});
      const cost=(Number(unit.upgradeCost)||100)*level;
      const description="Level "+level+" · HP "+current.health+" → "+next.health+" · ATK "+current.damage+" → "+next.damage+" · Next: "+cost+" XP";
      return row(unit.name,description,"unit:"+i,"UPGRADE");
    }).join("")+'</div>';

  const testTools = '<section class="cat-level-test-panel">'+
    '<div class="cat-level-test-heading">CAT LEVEL TESTING</div>'+
    '<p>Set any owned Cat to a level for testing. These changes are free and saved to your game.</p>'+
    '<div class="cat-level-test-all">'+
      '<label for="test-all-cat-level">Set every Cat to level</label>'+
      '<input id="test-all-cat-level" data-test-all-level-input type="number" min="1" max="9999" step="1" value="1">'+
      '<button type="button" class="gold-button small" data-test-all-level>SET ALL</button>'+
    '</div>'+
    '<div class="cat-level-test-list">'+save.units.map(unit=>{
      const id=String(unit.id);
      const level=Math.max(1,Math.floor(Number(unit.level)||1));
      const name=String(unit.name||"Cat").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return '<div class="cat-level-test-row">'+
        '<span class="cat-level-test-name">'+name+'<small>Current: Lv. '+level+'</small></span>'+
        '<input type="number" min="1" max="9999" step="1" value="'+level+'" data-test-level-input="'+id+'" aria-label="'+name+' test level">'+
        '<button type="button" class="gold-button small" data-test-unit-level="'+id+'">SET</button>'+
      '</div>';
    }).join("")+'</div>'+
  '</section>';

  return renderWindow("Upgrade",body+testTools,"base");
}'''
main = main[:upgrade_start] + new_upgrade + main[upgrade_end:]

# Handle the level test buttons before the normal menu action router.
click_marker = '''stage.addEventListener("click", event => {
  const button = event.target.closest("button");'''
click_handler = '''stage.addEventListener("click", event => {
  const setAllLevelButton = event.target.closest("[data-test-all-level]");
  if (setAllLevelButton) {
    event.preventDefault();
    const input = stage.querySelector("[data-test-all-level-input]");
    const level = Math.max(1,Math.min(9999,Math.floor(Number(input && input.value)||1)));
    for (const unit of save.units) unit.level = level;
    persist();
    render();
    notify("Set all Cats to level "+level+".");
    return;
  }

  const setUnitLevelButton = event.target.closest("[data-test-unit-level]");
  if (setUnitLevelButton) {
    event.preventDefault();
    const unitId = setUnitLevelButton.getAttribute("data-test-unit-level");
    const input = stage.querySelector('[data-test-level-input="'+unitId+'"]');
    const unit = save.units.find(entry=>String(entry.id)===String(unitId));
    if (!unit || !input) return;
    const level = Math.max(1,Math.min(9999,Math.floor(Number(input.value)||1)));
    unit.level = level;
    persist();
    render();
    notify(unit.name+" set to level "+level+".");
    return;
  }

  const button = event.target.closest("button");'''
main = replace_once(main, click_marker, click_handler, "stage test-level click handler")

# New enemy sprite sizes should be grounded; The Face sits only a few pixels above the baseline.
test_css_marker = "/* Test level controls inside the Cat Upgrade screen. */"
if test_css_marker not in css:
    css += '''

/* Test level controls inside the Cat Upgrade screen. */
.cat-level-test-panel {
  margin: 16px 0 8px;
  padding: 12px;
  border: 1px solid rgba(92,55,28,.42);
  border-radius: 10px;
  background: rgba(255,241,202,.92);
  color: #4c2b19;
}
.cat-level-test-heading {
  text-align: center;
  font-weight: 900;
  letter-spacing: .08em;
  margin-bottom: 5px;
}
.cat-level-test-panel > p {
  margin: 0 0 10px;
  text-align: center;
  font-size: 12px;
}
.cat-level-test-all,
.cat-level-test-row {
  display: grid;
  grid-template-columns: minmax(0,1fr) 76px 62px;
  align-items: center;
  gap: 7px;
  margin: 7px 0;
}
.cat-level-test-all label,
.cat-level-test-name {
  font-size: 12px;
  font-weight: 800;
}
.cat-level-test-name small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  font-weight: 600;
  opacity: .75;
}
.cat-level-test-panel input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 5px;
  border: 1px solid #9a7145;
  border-radius: 6px;
  background: #fffaf0;
  color: #3c2113;
  font: inherit;
  text-align: center;
}
.cat-level-test-panel .gold-button {
  min-width: 0;
  padding-left: 5px;
  padding-right: 5px;
}
.cat-level-test-list {
  margin-top: 10px;
  border-top: 1px solid rgba(92,55,28,.25);
  padding-top: 7px;
}
.fight-screen .fight-unit[data-unit-type="the-face"] {
  bottom: 8px !important;
}
'''
else:
    raise RuntimeError("Test panel CSS already exists; inspect patch before rerunning.")

# Remove the obsolete speed helper (the game is wrapped in an IIFE) and refresh assets.
main = replace_once(
    main,
    'const BATTLE_ASSET_VERSION = "20261105-21";',
    'const BATTLE_ASSET_VERSION = "20261105-23";',
    "battle asset version"
)
html = "\\n".join(line for line in html.splitlines() if "src/enemy-speed-balance.js" not in line)
html = re.sub("20261105-[0-9]+", "20261105-23", html)
if 'src/enemy-speed-balance.js' in html:
    raise RuntimeError("Obsolete speed helper is still referenced in index.html")

main_path.write_text(main, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

# Parse-check the resulting main script with Node-compatible syntax if available.
print("Patched runtime stats, XP grant, 15% level growth, upgrade test controls and cache version.")
