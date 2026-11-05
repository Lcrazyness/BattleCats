(() => {
"use strict";
const $ = (selector, root=document) => root.querySelector(selector);
const money = value => Number(value || 0).toLocaleString();
function currencySpriteMarkup(value,sizeClass="") {
  const numeric=Number(value);
  const digits=String(Number.isFinite(numeric)?Math.max(0,Math.floor(numeric)):0);
  const glyphs=Array.from(digits).map(character=>
    '<i class="currency-sprite-glyph currency-glyph-'+character+'" aria-hidden="true"></i>'
  ).join("");
  return '<span class="currency-sprite-run '+sizeClass+'" aria-hidden="true">'+glyphs+'</span>';
}
function currencyRatioSpriteMarkup(current,maximum) {
  return '<span class="currency-sprite-readout">'+currencySpriteMarkup(current,"currency-size-fight")+
    '<i class="currency-sprite-glyph currency-glyph-slash" aria-hidden="true"></i>'+
    currencySpriteMarkup(maximum,"currency-size-fight")+'</span>';
}
function walletLevelSpriteMarkup(level) {
  if(Number(level)>=8) return '<span class="fight-wallet-max-label">MAX</span>';
  return '<span class="wallet-sprite-run" aria-hidden="true">'+
    '<i class="wallet-sprite-level"></i>'+
    '<i class="wallet-sprite-digit wallet-digit-'+Math.max(1,Math.floor(Number(level)||1))+'"></i>'+
  '</span>';
}
function makeAxeCatUnit() {
  return {
    id:3,name:"Axe Cat",level:1,deployCost:1,upgradeCost:400,hp:100,attack:12,range:65,speed:7,recharge:0.1,
    assetFolder:"axe-cat",spriteSlot:"Cats/axe-cat/slot.png",statsPath:"Cats/axe-cat/stats.json",assetsPath:"Cats/axe-cat/assets.json"
  };
}
function makeGrossCatUnit() {
  return {
    id:4,name:"Gross Cat",level:1,deployCost:2,upgradeCost:500,hp:130,attack:22,range:180,speed:5.2,recharge:3.2,
    assetFolder:"Gross-Cat",spriteSlot:"Cats/Gross-Cat/slot.png",statsPath:"Cats/Gross-Cat/stats.json",assetsPath:"Cats/Gross-Cat/assets.json"
  };
}
const defaults = {
  xp:0, catFood:0, rareTickets:0, normalTickets:0,
  energy:100, maxEnergy:100, exp:0, stageClears:0,
  units:[
    {id:1,name:"Cat",level:1,deployCost:1,upgradeCost:400,hp:100,attack:6,range:140,speed:5,recharge:0.1}
  ],
  equipped:[1], mail:0, missions:0, sound:true, music:true, soundSettingsVersion:1, menuVersion:4
};
const SAVE_KEY = "battleCatsSave_v4";
let save;
let savedSoundSettingsVersion = 0;
try {
  const old = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
  if (old) savedSoundSettingsVersion = Number(old.soundSettingsVersion || 0);
  save = old && old.menuVersion === 4 ? {...defaults, ...old} : {...defaults, units:defaults.units.map(unit => ({...unit})), equipped:[1]};
  if (!Array.isArray(save.units) || !save.units.length) save.units = defaults.units.map(unit => ({...unit}));
  if (!Array.isArray(save.equipped)) save.equipped = save.units.slice(0,1).map(unit => unit.id);
  delete save.level;
} catch {
  save = {...defaults, units:defaults.units.map(unit => ({...unit})), equipped:[1]};
}
if (savedSoundSettingsVersion < 1) {
  save.sound = true;
  save.soundSettingsVersion = 1;
}
if(Number(save.stageClears)>=3&&!save.units.some(unit=>unit.name==="Axe Cat"||Number(unit.id)===3)) {
  save.units.push(makeAxeCatUnit());
}
if(Number(save.stageClears)>=7&&!save.units.some(unit=>unit.name==="Gross Cat"||Number(unit.id)===4)) {
  save.units.push(makeGrossCatUnit());
}
let scene = "loading";
let currentRegion = "empire";
let selectedLevelIndex = 0;
let battleState = null;
let battleTimer = null;
let battleAssetsPromise = null;
let battleLevelConfig = null;
let battleLevelConfigPromise = null;
let battleLevelName = "Korea";
const BATTLE_ASSET_VERSION = "20261104-16";
const BATTLE_AXE_SPRITE_SIZE = 160;
const BATTLE_AXE_SPRITE_CACHE = new Map();
const BATTLE_ENEMY_SPRITE_CACHE = new Map();
const BATTLE_ATTACK_FRAME_RATE = 8;
const BATTLE_ASSETS = {
  cat: {moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:6,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"Cats/cat/slot.png",upgrade:"Cats/cat/upgrade.png"},
  doge: {moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:6,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"enemys/doge/slot.png"},
  "axe-cat": {moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:6,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"Cats/axe-cat/slot.png"},
  pigge: {moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:6,attackDuration:1,damagedFrames:[],knockbackFrames:[],damaged:"",idle:""},
};
const BATTLE_UNIT_STATS = {
  cat: {health:70,damage:6,price:1,speed:5,spriteChangeSpeed:6,walkSpriteChangeSpeed:2.5,range:55,recharge:0.1,attackCooldown:1.15,AreaAttack:false,AttackTrait:"",AttackBoost:"",knockbackCount:3,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5},
  "axe-cat": {health:100,damage:12,price:1,speed:7,spriteChangeSpeed:6,walkSpriteChangeSpeed:2.5,range:65,recharge:0.1,attackCooldown:1.4,AreaAttack:false,AttackTrait:"Red",AttackBoost:"Strong",knockbackCount:3,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5},
  "tank-cat": {health:300,damage:8,price:1,speed:3,spriteChangeSpeed:5,walkSpriteChangeSpeed:2.5,range:25,recharge:0.1,attackCooldown:1.8,AreaAttack:false,AttackTrait:"",AttackBoost:"",knockbackCount:1,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5},
  "gross-cat": {health:130,damage:22,price:2,speed:5.2,spriteChangeSpeed:10,walkSpriteChangeSpeed:4.2,range:180,recharge:3.2,attackCooldown:2.3,AreaAttack:false,AttackTrait:"",AttackBoost:"",knockbackCount:3,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5},
  doge: {health:80,damage:3,speed:2.8,spriteChangeSpeed:5,range:85,killReward:25,knockbackCount:3,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:1.7,AreaAttack:false},
  snache: {health:85,damage:8,speed:4.3,spriteChangeSpeed:7,range:100,killReward:30,knockbackCount:3,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:1.5,AreaAttack:false},
  "those-guys": {health:160,damage:8,speed:5,spriteChangeSpeed:8,range:105,killReward:75,knockbackCount:1,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:1.3,AreaAttack:false},
  hippoe: {health:800,damage:35,speed:3.7,spriteChangeSpeed:4,range:145,killReward:400,knockbackCount:1,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:2.8,AreaAttack:1},
  pigge: {health:1000,damage:40,speed:4.6,spriteChangeSpeed:4.5,range:140,killReward:400,knockbackCount:2,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:3,AreaAttack:1,traits:["Red"]},
  "jackie-peng": {health:1000,damage:30,speed:9,spriteChangeSpeed:9,range:145,killReward:450,knockbackCount:3,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:1.2,AreaAttack:false},
  gory: {health:650,damage:24,speed:8,spriteChangeSpeed:7,range:150,killReward:180,knockbackCount:3,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:1.1,AreaAttack:1,traits:[]},
  "sir-seal": {health:1150,damage:30,speed:5.5,spriteChangeSpeed:5.5,range:170,killReward:220,knockbackCount:1,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5,attackCooldown:1.3,AreaAttack:1,traits:["Red"]}
};
const BATTLE_UNIT_STATS_BY_ID = new Map();
function battleUnitKey(unitOrName) {
  const value = typeof unitOrName === "string" ? unitOrName :
    (unitOrName && (unitOrName.enemyType || unitOrName.statsKey || unitOrName.assetFolder || unitOrName.spriteFolder || unitOrName.name || unitOrName.kind)) || "cat";
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function battleUnitStats(unitOrKey) {
  const isObject = unitOrKey && typeof unitOrKey === "object";
  const unit = isObject ? unitOrKey : {};
  const key = isObject && unit.kind === "doge" ? battleUnitKey(unit.enemyType || "doge") : battleUnitKey(unitOrKey);
  const statsId = isObject ? (unit.id!==undefined && unit.id!==null ? unit.id : unit.unitId) : null;
  const config = (statsId!==undefined && statsId!==null
    ? BATTLE_UNIT_STATS_BY_ID.get(String(statsId))
    : null) || BATTLE_UNIT_STATS[key] || {};
  const positive = (value,fallback,min=0.1) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= min ? number : fallback;
  };
  const unitLevel = isObject && unit.kind !== "doge" ? Math.max(1,Math.floor(Number(unit.level)||1)) : 1;
  const levelMultiplier = 1 + Math.max(0,unitLevel-1)*0.13;
  const health = Math.round(positive(config.health,positive(unit.hp,100))*levelMultiplier);
  const damage = Math.round(positive(config.damage,positive(unit.attack,positive(unit.attackPower,8)))*levelMultiplier);
  const thresholdPercent = Math.max(1,Math.min(99,positive(config.knockbackThresholdPercent,positive(unit.knockbackThresholdPercent,25))));
  const knockbackCount = Math.max(0,Math.min(10,Math.floor(Number.isFinite(Number(config.knockbackCount))?Number(config.knockbackCount):3)));
  const rawAreaAttack=config.AreaAttack??config.areaAttack??unit.AreaAttack??unit.areaAttack??0;
  const areaAttack=rawAreaAttack===true?1:rawAreaAttack===false?0:Math.max(0,Math.min(2,Math.floor(Number(rawAreaAttack)||0)));
  const validTraits=["Red","Alien","Dark","Angelic","Metal"];
  const validBoosts=["Strong","Massive Damage"];
  const AttackTrait=validTraits.includes(config.AttackTrait)?config.AttackTrait:"";
  const AttackBoost=validBoosts.includes(config.AttackBoost)?config.AttackBoost:"";
  const traits=Array.isArray(config.traits)?config.traits.filter(trait=>validTraits.includes(trait)):[];
  return {
    level:unitLevel,
    levelMultiplier,
    health,
    damage,
    price:positive(config.price,positive(unit.deployCost,50)),
    speed:positive(config.speed,positive(unit.speed,key==="doge"?2.8:10)),
    spriteChangeSpeed:positive(config.spriteChangeSpeed,positive(unit.spriteChangeSpeed,key==="doge"?5:6)),
    walkSpriteChangeSpeed:positive(config.walkSpriteChangeSpeed,positive(unit.walkSpriteChangeSpeed,2.5)),
    range:positive(config.range,positive(unit.range,55)),
    recharge:positive(config.recharge,positive(unit.recharge,2.5)),
    attackCooldown:positive(config.attackCooldown,positive(unit.attackCooldown,key==="doge"?1.55:1.15)),
    areaAttack,
    AttackTrait,
    AttackBoost,
    traits,
    knockbackThresholdPercent:thresholdPercent,
    knockbackCount,
    knockbackDuration:positive(config.knockbackDuration,0.64,0.2),
    knockbackDistance:positive(config.knockbackDistance,4.5),
    killReward:positive(config.killReward,positive(unit.killReward,25))
  };
}

function applyBattleStatsToEntity(entity,unitOrKey) {
  const stats = battleUnitStats(unitOrKey || entity);
  const oldMax = Math.max(1,Number(entity.maxHp)||stats.health);
  const wasFull = Number(entity.hp) >= oldMax - 0.001;
  entity.maxHp = stats.health;
  entity.hp = wasFull ? stats.health : Math.min(stats.health,Math.max(0,Number(entity.hp)||0));
  entity.attackPower = stats.damage;
  entity.areaAttack = Number(stats.areaAttack)||0;
  entity.AttackTrait = stats.AttackTrait;
  entity.AttackBoost = stats.AttackBoost;
  entity.traits = stats.traits;
  const walkSpeedModifier = entity.kind==="cat" ? Math.max(-2,Math.min(2,Number(entity.walkSpeedModifier)||0)) : 0;
  entity.statsSnapshot = {...stats};
  entity.baseSpeed = stats.speed;
  entity.walkSpeedModifier = walkSpeedModifier;
  entity.speed = Math.max(1,stats.speed+walkSpeedModifier);
  entity.spriteChangeSpeed = stats.spriteChangeSpeed;
  entity.walkSpriteChangeSpeed = stats.walkSpriteChangeSpeed;
  entity.range = stats.range;
  entity.attackCooldown = stats.attackCooldown;
  entity.recharge = stats.recharge;
  entity.knockbackThresholdPercent = stats.knockbackThresholdPercent;
  entity.knockbackLimit = stats.knockbackCount;
  entity.knockbackCount = Math.max(0,Number(entity.knockbackCount)||0);
  entity.knockbackDurationSetting = stats.knockbackDuration;
  entity.knockbackDistanceSetting = stats.knockbackDistance;
  if (wasFull || !Number.isFinite(Number(entity.nextKnockbackHp))) {
    entity.nextKnockbackHp = entity.kind==="cat"
      ? stats.health*(stats.knockbackCount>0?stats.knockbackCount/(stats.knockbackCount+1):0)
      : stats.health*(1-stats.knockbackThresholdPercent/100);
  }
  if (entity.kind === "doge") entity.killReward = stats.killReward;
  return stats;
}
function battleStatsForEntity(entity) {
  return entity && entity.statsSnapshot && typeof entity.statsSnapshot==="object"
    ? {...entity.statsSnapshot}
    : battleUnitStats(entity || "cat");
}
function battleDamageAgainstTarget(attacker,target,baseDamage) {
  const attackStats=battleStatsForEntity(attacker);
  const targetStats=battleStatsForEntity(target);
  let damage=Math.max(0,Number(baseDamage)||0);
  const trait=String(attackStats.AttackTrait||"");
  const boost=String(attackStats.AttackBoost||"");
  if(trait&&boost&&Array.isArray(targetStats.traits)&&targetStats.traits.includes(trait)) {
    const multiplier=boost==="Strong"?1.25:(boost==="Massive Damage"?3:1);
    damage*=multiplier;
  }
  const isStrongAgainstRed=targetStats.AttackTrait==="Red"&&targetStats.AttackBoost==="Strong";
  const incomingTraits=Array.isArray(attackStats.traits)?attackStats.traits:[];
  if(isStrongAgainstRed&&incomingTraits.includes("Red")) damage*=0.8;
  return Math.max(0,Math.round(damage));
}

const EMPIRE_CHAPTER_ONE = [
  {
    "name": "Korea",
    "x": 78,
    "y": 29
  },
  {
    "name": "Mongolia",
    "x": 72,
    "y": 23
  },
  {
    "name": "China",
    "x": 75,
    "y": 34
  },
  {
    "name": "Thailand",
    "x": 72,
    "y": 45
  },
  {
    "name": "Cambodia",
    "x": 75,
    "y": 48
  },
  {
    "name": "Philippines",
    "x": 83,
    "y": 49
  },
  {
    "name": "Japan",
    "x": 86,
    "y": 32
  },
  {
    "name": "Australia",
    "x": 81,
    "y": 76
  },
  {
    "name": "Singapore",
    "x": 76,
    "y": 55
  },
  {
    "name": "Maldives",
    "x": 68,
    "y": 62
  },
  {
    "name": "India",
    "x": 63,
    "y": 42
  },
  {
    "name": "Nepal",
    "x": 66,
    "y": 37
  },
  {
    "name": "Dubai",
    "x": 56,
    "y": 48
  },
  {
    "name": "Saudi Arabia",
    "x": 55,
    "y": 53
  },
  {
    "name": "Kenya",
    "x": 52,
    "y": 66
  },
  {
    "name": "Madagascar",
    "x": 58,
    "y": 78
  },
  {
    "name": "South Africa",
    "x": 52,
    "y": 87
  },
  {
    "name": "Ghana",
    "x": 46,
    "y": 64
  },
  {
    "name": "Sahara",
    "x": 46,
    "y": 53
  },
  {
    "name": "Egypt",
    "x": 49,
    "y": 48
  },
  {
    "name": "Turkey",
    "x": 52,
    "y": 42
  },
  {
    "name": "Russia",
    "x": 64,
    "y": 20
  },
  {
    "name": "Greece",
    "x": 50,
    "y": 46
  },
  {
    "name": "Italy",
    "x": 47,
    "y": 42
  },
  {
    "name": "Monaco",
    "x": 43,
    "y": 46
  },
  {
    "name": "Spain",
    "x": 39,
    "y": 49
  },
  {
    "name": "France",
    "x": 43,
    "y": 40
  },
  {
    "name": "Germany",
    "x": 47,
    "y": 37
  },
  {
    "name": "Denmark",
    "x": 48,
    "y": 32
  },
  {
    "name": "Norway",
    "x": 44,
    "y": 25
  },
  {
    "name": "United Kingdom",
    "x": 40,
    "y": 35
  },
  {
    "name": "Greenland",
    "x": 28,
    "y": 15
  },
  {
    "name": "Canada",
    "x": 24,
    "y": 28
  },
  {
    "name": "New York",
    "x": 30,
    "y": 39
  },
  {
    "name": "Bermuda",
    "x": 37,
    "y": 44
  },
  {
    "name": "Jamaica",
    "x": 30,
    "y": 53
  },
  {
    "name": "Colombia",
    "x": 32,
    "y": 62
  },
  {
    "name": "Brazil",
    "x": 38,
    "y": 69
  },
  {
    "name": "Argentina",
    "x": 36,
    "y": 82
  },
  {
    "name": "Machu Picchu",
    "x": 28,
    "y": 71
  },
  {
    "name": "Easter Island",
    "x": 17,
    "y": 79
  },
  {
    "name": "Mexico",
    "x": 26,
    "y": 51
  },
  {
    "name": "NASA",
    "x": 34,
    "y": 42
  },
  {
    "name": "Las Vegas",
    "x": 27,
    "y": 39
  },
  {
    "name": "Hollywood",
    "x": 23,
    "y": 44
  },
  {
    "name": "Alaska",
    "x": 20,
    "y": 24
  },
  {
    "name": "Hawaii",
    "x": 16,
    "y": 55
  },
  {
    "name": "Moon",
    "x": 92,
    "y": 11
  }
];
let toastTimer = 0;
let titleIntroPending = true;
let titleFadeFromBlack = false;
let introFadeFromBlack = false;
let introExitTimer = null;
let baseFadeFromBlack = false;
let chapterLeavingDestination = "";
let navigationTimer = null;
const stage = $(".stage");
const persist = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
};
const totalCatLevels = () => save.units.reduce((total,unit) =>
  total + Math.max(1,Math.floor(Number(unit.level)||1)),0);
const AUDIO_VERSION = "20261104-16";
const SOUND_FILES = {
  button: "sounds/button-click.mp3",
  select: "sounds/menu-select.mp3",
  back: "sounds/back-cancel.mp3",
  blocked: "sounds/blocked-action.mp3",
  door: "sounds/cat-base-door.mp3",
  enterBattle: "sounds/enter-battle.mp3",
  stageSelect: "sounds/enter-battle.mp3",
  upgrade: "sounds/upgrade.mp3",
  victory: "sounds/victory.mp3",
  defeat: "sounds/defeat.mp3",
  reward: "sounds/reward.mp3",
  loginReward: "sounds/login-reward.mp3",
  capsule: "sounds/capsule-draw.mp3",
  attack1: "sounds/attack1.mp3",
  attack2: "sounds/attack2.mp3",
  baseAttack: "sounds/baseattack.mp3",
  deadUnit: "sounds/deadunit.mp3",
  deploy: "sounds/deploy.mp3",
  endOfRecharge: "sounds/endofrecharge.mp3"
};
const MUSIC_FILES = {
  intro: "sounds/intro-theme.mp3",
  title: "sounds/title-theme.mp3",
  menu: "sounds/menu-theme.mp3",
  battle: "sounds/battle-theme.mp3"
};
const activeSfxPlayers = new Set();
const preloadedAudioPlayers = new Map();
let battleStartPlayer = null;
let audioUnlocked = false;
let musicPlayer = null;
let currentMusicKey = "";

const GITHUB_ASSET_BASE_URL = "https://raw.githubusercontent.com/Lcrazyness/BattleCats/main/";
let githubAssetBase = document.querySelector("base");
if (!githubAssetBase) {
  githubAssetBase = document.createElement("base");
  document.head.prepend(githubAssetBase);
}
githubAssetBase.href = GITHUB_ASSET_BASE_URL;
const APP_BASE_URL = new URL(GITHUB_ASSET_BASE_URL);

const LOADING_IMAGE_ASSETS = [
  {path:"Levels/Korea/background.png?v=20261029-34",bytes:188403},
  {path:"Levels/Korea/enemybase.png?v=20261031-19",bytes:7294},
  {path:"enemys/Gory/Screenshot 2026-11-04 201609.png?v=20261104-16",bytes:221492},
  {path:"enemys/Sir-Seal/Screenshot 2026-11-04 202024.png?v=20261104-16",bytes:224118},
  {path:"sprites/battle/catbase.png?v=20261031-03",bytes:109977},
  {path:"sprites/battle/Deathsoul1.png?v=20261031-03",bytes:11785},
  {path:"sprites/battle/Deathsoul2.png?v=20261031-03",bytes:38607},
  {path:"sprites/battle/Deathsoul3.png?v=20261031-03",bytes:38428},
  {path:"sprites/battle/Deathsoul4.png?v=20261031-03",bytes:38057},
  {path:"sprites/battle/walletdown.png?v=20261031-03",bytes:46733},
  {path:"sprites/battle/walletup.png?v=20261031-03",bytes:76922},
  {path:"Cats/cat/moving/frame-001.png?v=20261029-31",bytes:7000},
  {path:"Cats/cat/moving/frame-002.png?v=20261029-31",bytes:7000},
  {path:"Cats/cat/attack/frame-001attack.png?v=20261029-31",bytes:16072},
  {path:"Cats/cat/attack/frame-002attack.png?v=20261029-31",bytes:16117},
  {path:"Cats/cat/attack/frame-003attack.png?v=20261029-31",bytes:13263},
  {path:"Cats/cat/attack/frame-004attack.png?v=20261029-31",bytes:13433},
  {path:"Cats/cat/damaged/frame-001damaged.png?v=20261029-31",bytes:17381},
  {path:"Cats/cat/slot.png?v=20261029-31",bytes:9000},
  {path:"Cats/cat/upgrade.png?v=20261029-31",bytes:9000},
  {path:"Cats/axe-cat/moving/frame-001.png?v=20261101-08",bytes:2720},
  {path:"Cats/axe-cat/moving/frame-002.png?v=20261101-08",bytes:2716},
  {path:"Cats/axe-cat/moving/frame-003.png?v=20261101-08",bytes:2749},
  {path:"Cats/axe-cat/attack/frame-001attack.png?v=20261101-08",bytes:2902},
  {path:"Cats/axe-cat/attack/frame-002attack.png?v=20261101-08",bytes:2822},
  {path:"Cats/axe-cat/attack/frame-003attack.png?v=20261101-08",bytes:4336},
  {path:"Cats/axe-cat/attack/frame-004attack.png?v=20261101-08",bytes:2721},
  {path:"Cats/axe-cat/damaged/frame-001damaged.png?v=20261101-08",bytes:2852},
  {path:"sprites/ui/numbers/currency-atlas.png?v=20261101-08",bytes:4603},
  {path:"sprites/ui/numbers/wallet-atlas.png?v=20261101-08",bytes:2133},

  {path:"Cats/tank-cat/moving/frame-001.png?v=20261030-04",bytes:2552},
  {path:"Cats/tank-cat/moving/frame-002.png?v=20261030-04",bytes:2595},
  {path:"Cats/tank-cat/moving/frame-003.png?v=20261030-04",bytes:2610},
  {path:"Cats/tank-cat/attack/frame-001attack.png?v=20261030-04",bytes:2859},
  {path:"Cats/tank-cat/attack/frame-002attack.png?v=20261030-04",bytes:3129},
  {path:"Cats/tank-cat/attack/frame-003attack.png?v=20261030-04",bytes:3897},
  {path:"Cats/tank-cat/attack/frame-004attack.png?v=20261030-04",bytes:2842},
  {path:"Cats/tank-cat/damaged/frame-001damaged.png?v=20261030-04",bytes:2908},
  {path:"Cats/tank-cat/slot.png?v=20261031-07",bytes:12025},
  {path:"enemys/doge/moving/frame-001.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-001.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-002.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-003.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-004.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/damaged/frame-001.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/slot.png?v=20261029-31",bytes:9000},
  {path:"enemys/pigge/idle.png?v=20261104-05",bytes:25927},
  {path:"enemys/pigge/moving/frame-001.png?v=20261104-05",bytes:25221},
  {path:"enemys/pigge/moving/frame-002.png?v=20261104-05",bytes:25037},
  {path:"enemys/pigge/moving/frame-003.png?v=20261104-05",bytes:24506},
  {path:"enemys/pigge/moving/frame-004.png?v=20261104-05",bytes:24251},
  {path:"enemys/pigge/attack/frame-001.png?v=20261104-05",bytes:26787},
  {path:"enemys/pigge/attack/frame-002.png?v=20261104-05",bytes:43901},
  {path:"enemys/pigge/attack/frame-003.png?v=20261104-05",bytes:31014},
  {path:"enemys/pigge/attack/frame-004.png?v=20261104-05",bytes:30506},
  {path:"enemys/pigge/attack/frame-005.png?v=20261104-05",bytes:30404},
  {path:"enemys/pigge/attack/frame-006.png?v=20261104-05",bytes:23979},
  {path:"enemys/pigge/damaged/image-removebg-preview (12).png?v=20261104-05",bytes:25927},
  {path:"enemys/snache/idle.png?v=20261104-07",bytes:1183},
  {path:"enemys/snache/slot.png?v=20261104-07",bytes:1183},
  {path:"enemys/snache/moving/frame-001.png?v=20261104-07",bytes:1183},
  {path:"enemys/snache/moving/frame-002.png?v=20261104-07",bytes:1180},
  {path:"enemys/snache/moving/frame-003.png?v=20261104-07",bytes:1179},
  {path:"enemys/snache/moving/frame-004.png?v=20261104-07",bytes:1185},
  {path:"enemys/snache/attack/frame-001.png?v=20261104-07",bytes:1193},
  {path:"enemys/snache/attack/frame-002.png?v=20261104-07",bytes:1257},
  {path:"enemys/snache/attack/frame-003.png?v=20261104-07",bytes:892},
  {path:"enemys/snache/damaged/frame-001.png?v=20261104-07",bytes:990},
  {path:"enemys/those-guys/idle.png?v=20261104-08",bytes:1043},
  {path:"enemys/those-guys/slot.png?v=20261104-08",bytes:1043},
  {path:"enemys/those-guys/moving/frame-001.png?v=20261104-08",bytes:1115},
  {path:"enemys/those-guys/moving/frame-002.png?v=20261104-08",bytes:1081},
  {path:"enemys/those-guys/moving/frame-003.png?v=20261104-08",bytes:1069},
  {path:"enemys/those-guys/moving/frame-004.png?v=20261104-08",bytes:1079},
  {path:"enemys/those-guys/moving/frame-005.png?v=20261104-08",bytes:1075},
  {path:"enemys/those-guys/attack/frame-001.png?v=20261104-08",bytes:1099},
  {path:"enemys/those-guys/attack/frame-002.png?v=20261104-08",bytes:1041},
  {path:"enemys/those-guys/attack/frame-003.png?v=20261104-08",bytes:1020},
  {path:"enemys/those-guys/attack/frame-004.png?v=20261104-08",bytes:1011},
  {path:"enemys/those-guys/attack/frame-005.png?v=20261104-08",bytes:1119},
  {path:"enemys/those-guys/attack/frame-006.png?v=20261104-08",bytes:1178},
  {path:"enemys/those-guys/attack/frame-007.png?v=20261104-08",bytes:1166},
  {path:"enemys/those-guys/attack/frame-008.png?v=20261104-08",bytes:1026},
  {path:"enemys/those-guys/damaged/frame-001.png?v=20261104-08",bytes:1326},
  {path:"enemys/hippoe/idle.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/slot.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/moving/frame-001.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/moving/frame-002.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/moving/frame-003.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/attack/frame-001.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/attack/frame-002.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/attack/frame-003.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/attack/frame-004.png?v=20261104-09",bytes:26876},
  {path:"enemys/hippoe/damaged/frame-001.png?v=20261104-09",bytes:26876},
  {path:"enemys/jackie-peng/idle.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/slot.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-001.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-002.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-003.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-004.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-005.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-006.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-007.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-008.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-009.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-010.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/moving/frame-011.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/attack/frame-001.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/attack/frame-002.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/attack/frame-003.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/attack/frame-004.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/attack/frame-005.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/attack/frame-006.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/attack/frame-007.png?v=20261104-10",bytes:26876},
  {path:"enemys/jackie-peng/damaged/frame-001.png?v=20261104-10",bytes:26876},
  {path:"sprites/backgrounds/intro-burning-city.webp?v=20261027-1",bytes:8248},
  {path:"sprites/ui/empirepfcatsbanner.png?v=20261027-1",bytes:270940},
  {path:"sprites/ui/backbutton.png?v=20261026-9",bytes:35794},
  {path:"sprites/backgrounds/titlescreenmenu.png?v=20261026-9",bytes:1513970},
  {path:"sprites/ui/Play_button.png?v=20261026-9",bytes:5844},
  {path:"sprites/ui/title-settings.png?v=20261026-9",bytes:38154},
  {path:"sprites/ui/title-mailbox.png?v=20261026-9",bytes:48748},
  {path:"sprites/backgrounds/CatBase/MenuCat.png?v=20261031-01",bytes:16787},
  {path:"sprites/backgrounds/CatBase/bottem.png?v=20261031-01",bytes:9633},
  {path:"sprites/backgrounds/CatBase/catbase-top.png?v=20261031-01",bytes:15592},
  {path:"sprites/backgrounds/CatBase/doorleft.png?v=20261031-01",bytes:106187},
  {path:"sprites/backgrounds/CatBase/doorright.png?v=20261031-01",bytes:105741},
  {path:"sprites/backgrounds/CatBase/userRank.png?v=20261031-01",bytes:38080},
  {path:"sprites/ui/backboard.png?v=20261026-25",bytes:62313},
  {path:"sprites/ui/startbutton.png?v=20261026-9",bytes:111427},
  {path:"sprites/ui/upgradebutton.png?v=20261026-9",bytes:137546},
  {path:"sprites/ui/equipbutton.png?v=20261026-9",bytes:117674},
  {path:"sprites/ui/menubutton.png?v=20261026-9",bytes:60432},
  {path:"sprites/ui/gamatotobutton.png?v=20261026-9",bytes:71513},
  {path:"sprites/ui/missionsbutton.png?v=20261026-9",bytes:76462},
  {path:"sprites/ui/storagebutton.png?v=20261026-24",bytes:25503},
  {path:"sprites/ui/storebutton.png?v=20261026-26",bytes:80376},
  {path:"sprites/ui/Cat_Food.png?v=20261026-27",bytes:5358},
  {path:"sprites/ui/Normalcapsule.png?v=20261026-27",bytes:8770},
  {path:"sprites/ui/rarecapsules.png?v=20261026-27",bytes:107426},
  {path:"sprites/original_sheets/normal-cat-right-icon.webp?v=20261026-9",bytes:2738},
  {path:"sprites/original_sheets/basic-cat-bcp.webp",bytes:16942},
  {path:"sprites/original_sheets/basic-cat-e-bcp.webp",bytes:18608},
  {path:"sprites/original_sheets/basic-cat-tf-bcp.webp",bytes:18914},
  {path:"sprites/original_sheets/cat-base-accessory-icon.webp?v=20261029-37",bytes:6458},
  {path:"sprites/original_sheets/cat-base-menu-icon.webp?v=20261029-37",bytes:4800},
  {path:"sprites/original_sheets/cat-base-menu.webp",bytes:227100},
  {path:"sprites/original_sheets/main-menu-ver-10-10.webp",bytes:392714},
  {path:"sprites/cat-base-reference.jpg",bytes:85938},
  {path:"sprites/backgrounds/empire-of-cats-map.png?v=20261029-14",bytes:511164},
  {path:"sprites/title-screen.webp",bytes:186052},
  {path:"sprites/ui/title-play.png",bytes:32980}
];
const LOADING_AUDIO_ASSETS = [
  {path:"sounds/intro-theme.mp3?v="+AUDIO_VERSION,bytes:2363802},
  {path:"sounds/title-theme.mp3?v="+AUDIO_VERSION,bytes:2129985},
  {path:"sounds/menu-theme.mp3?v="+AUDIO_VERSION,bytes:1751520},
  {path:"sounds/battle-theme.mp3?v="+AUDIO_VERSION,bytes:1649181},
  {path:"sounds/button-click.mp3?v="+AUDIO_VERSION,bytes:6799},
  {path:"sounds/menu-select.mp3?v="+AUDIO_VERSION,bytes:1505},
  {path:"sounds/back-cancel.mp3?v="+AUDIO_VERSION,bytes:6117},
  {path:"sounds/blocked-action.mp3?v="+AUDIO_VERSION,bytes:2679},
  {path:"sounds/cat-base-door.mp3?v="+AUDIO_VERSION,bytes:14782},
  {path:"sounds/enter-battle.mp3?v="+AUDIO_VERSION,bytes:48487},
  {path:"sounds/capsule-draw.mp3?v="+AUDIO_VERSION,bytes:63025},
  {path:"sounds/login-reward.mp3?v="+AUDIO_VERSION,bytes:11626},
  {path:"sounds/reward.mp3?v="+AUDIO_VERSION,bytes:78497},
  {path:"sounds/upgrade.mp3?v="+AUDIO_VERSION,bytes:16941},
  {path:"sounds/victory.mp3?v="+AUDIO_VERSION,bytes:116845},
  {path:"sounds/defeat.mp3?v="+AUDIO_VERSION,bytes:107818},
  {path:"sounds/attack1.mp3?v="+AUDIO_VERSION,bytes:11772},
  {path:"sounds/attack2.mp3?v="+AUDIO_VERSION,bytes:21672},
  {path:"sounds/baseattack.mp3?v="+AUDIO_VERSION,bytes:23138},
  {path:"sounds/deadunit.mp3?v="+AUDIO_VERSION,bytes:44044},
  {path:"sounds/deploy.mp3?v="+AUDIO_VERSION,bytes:31991},
  {path:"sounds/endofrecharge.mp3?v="+AUDIO_VERSION,bytes:18549},
];
const LOADING_TOTAL_BYTES = LOADING_IMAGE_ASSETS.reduce((sum,asset)=>sum+asset.bytes,0);
let loadingAssetsStarted = false;
let loadingBytesFinished = 0;
const preloadedImageCache = new Map();

function renderLoading() {
  return '<section class="screen loading-screen" aria-label="Loading game assets">'+
    '<div class="loading-panel">'+
      '<div class="loading-game-title">THE BATTLE CATS</div>'+
      '<div class="loading-heading">LOADING</div>'+
      '<div class="loading-progress" role="progressbar" aria-label="Game asset loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="loading-progress-fill"></div></div>'+
      '<div class="loading-progress-row"><span class="loading-status">Preparing game assets...</span><strong class="loading-percent">0%</strong></div>'+
    '</div>'+
  '</section>';
}

function updateLoadingProgress(label, currentBytes=0) {
  const percent = Math.max(0,Math.min(100,((loadingBytesFinished+currentBytes)/LOADING_TOTAL_BYTES)*100));
  const fill = stage.querySelector(".loading-progress-fill");
  const text = stage.querySelector(".loading-status");
  const number = stage.querySelector(".loading-percent");
  const bar = stage.querySelector(".loading-progress");
  if (fill) fill.style.width = percent.toFixed(2)+"%";
  if (text) text.textContent = label;
  if (number) number.textContent = Math.floor(percent)+"%";
  if (bar) bar.setAttribute("aria-valuenow",String(Math.floor(percent)));
}

function loadImageAssetSequentially(asset) {
  const requestedUrl = new URL(asset.path,APP_BASE_URL);
  const cacheKey = requestedUrl.href;
  if (preloadedImageCache.has(cacheKey)) return Promise.resolve(true);
  return new Promise(resolve => {
    const urls = [requestedUrl.href];
    if (requestedUrl.search) {
      const cleanUrl = new URL(requestedUrl.href);
      cleanUrl.search = "";
      urls.push(cleanUrl.href);
    }
    let attempt = 0;
    const tryLoad = () => {
      if (attempt >= urls.length) {
        resolve(false);
        return;
      }
      const image = new Image();
      let settled = false;
      const finish = success => {
        if (settled) return;
        settled = true;
        if (!success) {
          attempt++;
          tryLoad();
          return;
        }
        const keepDecoded = () => {
          preloadedImageCache.set(cacheKey,image);
          preloadedImageCache.set(image.currentSrc || image.src,image);
          resolve(true);
        };
        if (typeof image.decode === "function") image.decode().then(keepDecoded).catch(keepDecoded);
        else keepDecoded();
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = urls[attempt];
      if (image.complete && image.naturalWidth > 0) finish(true);
    };
    tryLoad();
  });
}

async function loadAudioAssetSequentially(asset, statusText) {
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const response = await fetch(new URL(asset.path,APP_BASE_URL).href,{cache:"force-cache"});
      if (!response.ok) throw new Error("HTTP "+response.status+" for "+asset.path);
      const contentLength = Number(response.headers.get("content-length")) || asset.bytes;
      if (response.body && typeof response.body.getReader === "function") {
        const reader = response.body.getReader();
        let received = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          received += chunk.value.byteLength;
          const weightedBytes = Math.min(asset.bytes,received*(asset.bytes/contentLength));
          updateLoadingProgress(statusText,weightedBytes);
        }
      } else {
        await response.arrayBuffer();
        updateLoadingProgress(statusText,asset.bytes);
      }
      return true;
    } catch (error) {
      updateLoadingProgress(statusText,0);
      if (attempt === 1) console.warn("Battle Cats loader skipped an audio asset after retry:",asset.path,error);
    }
  }
  return false;
}

async function startGameAssetLoading() {
  if (loadingAssetsStarted || scene !== "loading") return;
  loadingAssetsStarted = true;
  let failedAssets = 0;
  const failedAssetPaths = [];
  const imageCount = LOADING_IMAGE_ASSETS.length;

  let completedImages=0;
  const imageBatchSize=8;
  for(let batchStart=0;batchStart<imageCount;batchStart+=imageBatchSize) {
    const batch=LOADING_IMAGE_ASSETS.slice(batchStart,batchStart+imageBatchSize);
    await Promise.all(batch.map(async asset=>{
      const name=asset.path.split("/").pop().split("?")[0];
      updateLoadingProgress("Loading images "+(completedImages+1)+"/"+imageCount+" — "+name);
      const loaded=await loadImageAssetSequentially(asset);
      if(!loaded) {
        failedAssets++;
        failedAssetPaths.push(asset.path);
        console.warn("Battle Cats loader could not load image:",asset.path);
      }
      loadingBytesFinished+=asset.bytes;
      completedImages++;
      updateLoadingProgress("Loaded images "+completedImages+"/"+imageCount+" — "+name);
    }));
  }

  preloadGameAudioAssets();
  if(failedAssetPaths.length) console.warn("Battle Cats image assets that failed to load:",failedAssetPaths);
  updateLoadingProgress(failedAssets ? "Images ready — "+failedAssets+" image(s) could not be loaded. Audio is loading separately." : "Images ready. Audio is loading in the background.");
  setTimeout(() => {
    if (scene !== "loading") return;
    const loadingScreen = stage.querySelector(".loading-screen");
    if (!loadingScreen) {
      introFadeFromBlack = true;
      scene = "intro";
      render();
      return;
    }
    loadingScreen.classList.add("loading-fading-out");
    loadingScreen.style.pointerEvents = "none";
  },650);
}

// Use MP3-only playback; all bundled audio assets are MP3.
function createAudioPlayer(path) {
  const player = new Audio();
  player.preload = "auto";
  const sourcePath = String(path||"");
  const extensionMatch = sourcePath.match(/\.(mp3|ogg)$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "mp3";
  const basePath = extensionMatch ? sourcePath.slice(0,-extensionMatch[0].length) : sourcePath;
  const formats = [extension];
  let formatIndex = 0;
  let wantsPlayback = false;

  const loadCurrentFormat = () => {
    const format = formats[formatIndex];
    player.src = new URL(`${basePath}.${format}?v=${AUDIO_VERSION}`, APP_BASE_URL).href;
    player.load();
  };

  const switchFormat = retryPlayback => {
    if (formatIndex >= formats.length - 1) return false;
    formatIndex++;
    player.audioFallbackUsed = true;
    loadCurrentFormat();
    if (retryPlayback && wantsPlayback) {
      const retry = player.play();
      if (retry && typeof retry.catch === "function") {
        retry.catch(error => {
          console.warn("Battle Cats audio retry failed:", player.currentSrc, error);
        });
      }
    }
    return true;
  };

  player.playCompat = () => {
    wantsPlayback = true;
    const attemptedSource = player.src;
    let promise;
    try {
      promise = player.play();
    } catch (error) {
      if (error.name !== "NotAllowedError" && switchFormat(false)) return player.play();
      throw error;
    }
    if (promise && typeof promise.catch === "function") {
      return promise.catch(error => {
        // The media error event may already have switched to the alternate format.
        if (player.src !== attemptedSource) return;
        if (error.name !== "NotAllowedError" && switchFormat(false)) return player.play();
        throw error;
      });
    }
    return promise;
  };

  player.pauseCompat = () => {
    wantsPlayback = false;
    player.pause();
  };

  player.addEventListener("error", () => {
    if (switchFormat(true)) return;
    if (typeof player.onAudioFailure === "function") {
      player.onAudioFailure();
    } else {
      console.error("Battle Cats audio failed in both formats:", player.currentSrc, player.error);
    }
  });

  loadCurrentFormat();
  return player;
}

function preloadGameAudioAssets() {
  if(typeof Audio==="undefined"||preloadedAudioPlayers.size) return;
  const allAudio={...SOUND_FILES,...MUSIC_FILES};
  for(const [key,path] of Object.entries(allAudio)) {
    try {
      const player=createAudioPlayer(path);
      player.preload="auto";
      player.volume=0;
      player.load();
      player.addEventListener("error",()=>{
        console.warn("Battle Cats audio preload skipped:",key,player.currentSrc);
      },{once:true});
      preloadedAudioPlayers.set(key,player);
    } catch(error) {
      console.warn("Battle Cats audio preload could not start:",key,error);
    }
  }
}
function playSfx(key) {
  if (!save.sound || !SOUND_FILES[key] || typeof Audio === "undefined") return;
  let player;
  try {
    player = createAudioPlayer(SOUND_FILES[key]);
    player.preload = "auto";
    player.volume = key === "door" || key === "enterBattle" || key === "stageSelect" ? 0.62 : 0.48;
    activeSfxPlayers.add(player);
    const cleanup = () => {
      activeSfxPlayers.delete(player);
      if ((key === "enterBattle" || key === "stageSelect") && battleStartPlayer === player) {
        battleStartPlayer = null;
        if (scene === "fight") syncMusicForScene("fight");
      }
    };
    if (key === "enterBattle" || key === "stageSelect") battleStartPlayer = player;
    player.addEventListener("ended", cleanup, {once:true});
    player.onAudioFailure = () => {
      cleanup();
      console.warn("Battle Cats sound asset unavailable; continuing without it:",key,player.currentSrc,player.error);
    };
    const promise = player.playCompat();
    if (promise && typeof promise.catch === "function") {
      promise.catch(error => {
        cleanup();
        console.warn("Battle Cats sound could not play; continuing:",key,player.currentSrc,error);
      });
    }
  } catch (error) {
    if (player) activeSfxPlayers.delete(player);
    console.warn("Battle Cats sound could not be started:", key, error);
  }
}

function unlockAndStartCurrentMusic() {
  if (typeof Audio === "undefined") return;
  audioUnlocked = true;
  syncMusicForScene(scene);
}
document.addEventListener("pointerdown", unlockAndStartCurrentMusic, {capture:true});
document.addEventListener("touchstart", unlockAndStartCurrentMusic, {capture:true, passive:true});
document.addEventListener("click", unlockAndStartCurrentMusic, {capture:true});
document.addEventListener("keydown", unlockAndStartCurrentMusic, {capture:true});

function syncMusicForScene(targetScene = scene) {
  if (typeof Audio === "undefined") return;
  if(targetScene==="fight" && battleState && battleState.ended) {
    if(musicPlayer) {
      musicPlayer.pauseCompat();
      musicPlayer.currentTime=0;
    }
    musicPlayer=null;
    currentMusicKey="";
    return;
  }
  if (targetScene === "loading") {
    if (musicPlayer) {
      musicPlayer.pauseCompat();
      musicPlayer.currentTime = 0;
    }
    musicPlayer = null;
    currentMusicKey = "";
    return;
  }
  if (!audioUnlocked && targetScene !== "intro") return;
  if (!save.music) {
    if (musicPlayer) {
      musicPlayer.pauseCompat();
      musicPlayer.currentTime = 0;
    }
    musicPlayer = null;
    currentMusicKey = "";
    return;
  }

  const nextKey = targetScene === "intro" ? "intro" : (targetScene === "title" || targetScene === "chapters") ? "title" : targetScene === "fight" ? "battle" : "menu";

  // Let the battle-entry sound finish before starting the battle theme.
  if (targetScene === "fight" && battleStartPlayer && !battleStartPlayer.ended) {
    if (musicPlayer) {
      musicPlayer.pauseCompat();
      musicPlayer.currentTime = 0;
    }
    musicPlayer = null;
    currentMusicKey = "";
    return;
  }

  // Keep the current track running while navigating between menus within the same area.
  // Only replace it when the major area changes (title, menus/base, or battle).
  if (musicPlayer && currentMusicKey === nextKey) {
    if (musicPlayer.paused) {
      const resumePromise = musicPlayer.playCompat();
      if (resumePromise && typeof resumePromise.catch === "function") {
        resumePromise.catch(error => {
          console.warn("Battle Cats music resume skipped:",musicPlayer.currentSrc,error);
        });
      }
    }
    return;
  }

  if (musicPlayer) {
    musicPlayer.pauseCompat();
    musicPlayer.currentTime = 0;
  }
  musicPlayer = preloadedAudioPlayers.get(nextKey)||createAudioPlayer(MUSIC_FILES[nextKey]);
  musicPlayer.loop = true;
  musicPlayer.preload = "auto";
  musicPlayer.volume = 0.24;
  currentMusicKey = nextKey;
  const activePlayer = musicPlayer;
  activePlayer.onAudioFailure = () => {
    console.error("Battle Cats music asset failed in both formats:", nextKey, activePlayer.currentSrc, activePlayer.error);
    if (musicPlayer === activePlayer) {
      musicPlayer = null;
      currentMusicKey = "";
      console.warn("Battle Cats music unavailable; continuing without it:",nextKey);
    }
  };
  const promise = activePlayer.playCompat();
  if (promise && typeof promise.catch === "function") {
    promise.catch(error => {
      console.error("Battle Cats music failed to play:", nextKey, activePlayer.currentSrc, error);
      if (musicPlayer === activePlayer) {
        musicPlayer = null;
        currentMusicKey = "";
        if(error&&error.name!=="NotAllowedError") console.warn("Battle Cats music playback skipped:",nextKey,error);
      }
    });
  }
}

function prepareAudioForAction() {
  audioUnlocked = true;
  syncMusicForScene(scene);
}

const gold = (label, action, small=false) =>
  '<button class="gold-button'+(small?' small':'')+'" data-go="'+action+'">'+label+'</button>';
const headBar = (label) =>
  '<div class="top-strip"><span class="top-title">'+label+'</span></div>';
const bottomBar = (back="base") =>
  '<div class="bottom-strip">'+
    '<button class="back-button" data-go="go:'+back+'" aria-label="Back">↶</button>'+
    '<button class="store-button" data-go="go:store"><span class="store-cart">🛒</span> STORE</button>'+
  '</div>';
const catHead = (className="") =>
  '<img class="cat-head-sprite '+className+'" src="sprites/original_sheets/normal-cat-right-icon.webp?v=20261026-9" alt="" draggable="false">';

function renderIntro() {
  const fadeFromBlack = introFadeFromBlack;
  introFadeFromBlack = false;
  return '<section class="screen intro-screen'+(fadeFromBlack?' intro-fade-from-black':'')+'" aria-label="Story intro">'+
    '<div class="intro-frame">'+
      '<img class="intro-background" src="sprites/backgrounds/intro-burning-city.webp?v=20261027-1" alt="" draggable="false">'+
      '<div class="intro-story" aria-label="The invasion begins">'+
        '<h1>THE INVASION BEGINS</h1>'+
        '<p>For generations, the world moved to a familiar rhythm. Cities grew, roads crossed the land, and people believed that tomorrow would look much like today. The distant hills were quiet, the skies were calm, and the strange stories told around old campfires belonged to another age.</p>'+
        '<p>Then the first reports arrived from the outskirts. Travelers spoke of unusual shapes beyond the roads. Watchmen saw small silhouettes moving through the mist. At night, witnesses described pairs of red eyes glowing between abandoned buildings. Nobody could agree on what they had seen, and most people dismissed the stories as rumors.</p>'+
        '<p>Until the smoke appeared.</p>'+
        '<p>One by one, lights vanished from the outer districts. Warning bells rang across the towns, and the horizon became a wall of fire. Through the ash came an army unlike any the world had prepared for: strange little Cats with round faces, tiny expressions, and a determination that no one could understand.</p>'+
        '<p>They did not negotiate. They did not retreat when shouted at. They kept advancing, padding across broken streets and gathering beneath the burning skyline. Some looked almost harmless. Others carried themselves like seasoned warriors. Together, they pushed through gates and barriers as if the world itself were simply another obstacle to cross.</p>'+
        '<p>Humanity raised barricades, sent out scouts, and tried to hold every crossing. For a while, the defenders believed their walls would be enough. But whenever one wave was turned back, more Cats appeared beyond the smoke. Every victory bought a little time; every lost stronghold brought the flames closer to the heart of the world.</p>'+
        '<p>No one knew who had called the Cat Army into being, or what waited at the end of its march. The Cats left no declaration, carried no familiar flag, and offered no explanation. Their purpose remained hidden behind those blank, smiling faces. The only certainty was that the invasion was spreading.</p>'+
        '<p>Far from the worst of the fires, an abandoned command station flickered back to life. Beneath dust and broken equipment, an old battle console still held power. Its maps showed distant lands, locked routes, and strongholds that had not yet fallen. More importantly, it could organize the Cats into a fighting force and send them wherever a commander was willing to lead.</p>'+
        '<p>The console could not explain where the Cats came from. It could not tell whether they were heroes, invaders, or something stranger. But it offered a way to answer an invasion with an army of your own. Each Cat had different strengths. Some were quick and inexpensive to deploy; others could withstand heavy attacks or strike from a safer distance. Choosing the right lineup would matter as much as charging forward.</p>'+
        '<p>There would be resources to manage, new units to discover, and stronger enemies waiting behind every frontier. A careless commander could lose ground in moments. A patient one could build a team, learn the rhythm of each battle, and turn a scattered group of recruits into a force capable of changing the course of the war.</p>'+
        '<p>The first steps would take you across familiar countries and the ruins left behind by the opening assault. Beyond them lay unfamiliar territories, distant futures, and eventually places far above the world. Each new horizon promised tougher resistance and more questions about the mysterious army that had started it all.</p>'+
        '<p>Perhaps the Cats were chasing something. Perhaps they were searching for a place of their own. Or perhaps the world had simply become the next target in a march that began long before anyone noticed. Whatever the truth, it was buried somewhere beyond the smoke, waiting to be uncovered one battle at a time.</p>'+
        '<p>Now the command station is yours. Gather your Cats. Train the ones who stand beside you. Spend your resources wisely, protect your base, and push back the darkness spreading across the land. The road ahead will not be easy, and the army beyond the flames will not stop simply because the world is afraid.</p>'+
        '<p>Every great campaign begins with a single order. This is yours.</p>'+
        '<h1>THE BATTLE CATS</h1>'+
        '<p>The invasion has begun.</p>'+
      '</div>'+
      '<button class="intro-back" data-go="intro-back" aria-label="Back"><img src="sprites/ui/backbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="intro-skip" data-go="intro-skip" aria-label="Skip intro"></button>'+
    '</div>'+
  '</section>';
}
function renderTitle() {
  const animateButtons = titleIntroPending;
  const fadeFromBlack = titleFadeFromBlack;
  titleIntroPending = false;
  titleFadeFromBlack = false;
  return '<section class="screen title-screen real-title-screen'+(fadeFromBlack?' title-fade-from-black':'')+'">'+
    '<div class="real-title-frame">'+
      '<img class="title-background-sprite" src="sprites/backgrounds/titlescreenmenu.png?v=20261026-9" alt="" draggable="false">'+
      '<button class="title-hotspot title-sprite-button title-play'+(animateButtons?' title-intro-play':'')+'" data-go="go:base" aria-label="Play"><img src="sprites/ui/Play_button.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="title-hotspot title-sprite-button title-settings'+(animateButtons?' title-intro-settings':'')+'" data-go="go:settings" aria-label="Settings"><img src="sprites/ui/title-settings.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="title-hotspot title-sprite-button title-mailbox" data-go="go:mailbox" aria-label="Mailbox"><img src="sprites/ui/title-mailbox.png?v=20261026-9" alt="" draggable="false"></button>'+
    '</div>'+
  '</section>';
}
function renderChapterSelect() {
  return '<section class="screen chapter-select-screen" aria-label="Chapter selection">'+
    '<div class="chapter-select-frame">'+
      '<img class="chapter-select-background" src="sprites/backgrounds/titlescreenmenu.png?v=20261026-9" alt="" draggable="false">'+
      '<button class="chapter-banner" data-go="chapter-enter" aria-label="Empire of Cats">'+
        '<img src="sprites/ui/empirepfcatsbanner.png?v=20261027-1" alt="Empire of Cats" draggable="false">'+
      '</button>'+
      '<button class="chapter-back" data-go="chapter-back" aria-label="Back to title">'+
        '<img src="sprites/ui/backbutton.png?v=20261026-9" alt="" draggable="false">'+
      '</button>'+
    '</div>'+
  '</section>';
}
function renderBase() {
  const fadeFromBlack = baseFadeFromBlack;
  baseFadeFromBlack = false;
  return '<section class="screen base-sprite-screen'+(fadeFromBlack?' base-fade-from-black':'')+'">'+
    '<div class="base-sprite-frame">'+
      '<div class="base-background-sprite" aria-hidden="true"></div>'+
      '<img class="base-door-sprite base-door-left" src="sprites/backgrounds/CatBase/doorleft.png?v=20261031-01" alt="" draggable="false">'+
      '<img class="base-door-sprite base-door-right" src="sprites/backgrounds/CatBase/doorright.png?v=20261031-01" alt="" draggable="false">'+
      '<img class="base-menu-cat" src="sprites/backgrounds/CatBase/MenuCat.png?v=20261031-01" alt="" draggable="false">'+
      '<img class="base-backboard-sprite" src="sprites/ui/backboard.png?v=20261026-25" alt="" draggable="false">'+
      '<img class="base-header-art" src="sprites/backgrounds/CatBase/catbase-top.png?v=20261031-01" alt="" draggable="false">'+
      '<img class="base-footer-art" src="sprites/backgrounds/CatBase/bottem.png?v=20261031-01" alt="" draggable="false">'+
      '<img class="base-user-rank-art" src="sprites/backgrounds/CatBase/userRank.png?v=20261031-01" alt="" draggable="false">'+
      '<strong class="base-user-rank-value" aria-label="User Rank '+totalCatLevels()+'">'+money(totalCatLevels())+'</strong>'+
      '<strong class="base-xp-count" aria-label="Experience points '+money(save.xp)+'">'+currencySpriteMarkup(save.xp,"currency-size-base")+'</strong>'+
      '<button class="base-sprite-button base-start" data-go="stage:empire" aria-label="Start battle"><img src="sprites/ui/startbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-upgrade" data-go="go:upgrade" aria-label="Upgrade"><img src="sprites/ui/upgradebutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-equip" data-go="go:equip" aria-label="Equip cats"><img src="sprites/ui/equipbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-menu" data-go="go:menu" aria-label="Menu"><img src="sprites/ui/menubutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-gamatoto" data-go="go:gamatoto" aria-label="Gamatoto"><img src="sprites/ui/gamatotobutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-missions" data-go="go:missions" aria-label="Missions"><img src="sprites/ui/missionsbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-storage" data-go="go:storage" aria-label="Storage"><img src="sprites/ui/storagebutton.png?v=20261026-24" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-cat-capsule" data-go="go:capsules" aria-label="Normal Cat Capsule"></button>'+
      '<button class="base-sprite-button base-rare-capsule" data-go="go:capsules" aria-label="Rare Cat Capsule"></button>'+
      '<button class="base-sprite-button base-back" data-go="go:title" aria-label="Back to title"><img src="sprites/ui/backbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-store" data-go="go:store" aria-label="Store"><img src="sprites/ui/storebutton.png?v=20261026-26" alt="" draggable="false"></button>'+
      '<button class="base-sprite-button base-cat-food" data-go="go:store" aria-label="Cat Food store"><span class="base-cat-food-count" aria-label="Cat Food balance '+money(save.catFood)+'">'+currencySpriteMarkup(save.catFood,"currency-size-base")+'</span></button>'+
    '</div>'+
  '</section>';
}
function renderWindow(label, content, back="base") {
  return '<section class="screen menu-screen">'+headBar(label.toUpperCase())+
    '<div class="menu-pattern"></div>'+
    '<div class="menu-window"><div class="menu-window-title">'+label+'</div><div class="menu-window-body">'+content+
    '<div class="screen-actions">'+gold("BACK","go:"+back)+'</div></div></div>'+
    bottomBar("base")+
  '</section>';
}
const row = (label, detail, action, actionLabel="OPEN") =>
  '<div class="game-row"><div class="game-row-label">'+label+(detail?'<small>'+detail+'</small>':'')+'</div>'+gold(actionLabel,action,true)+'</div>';
const pageCopy = text => '<p class="menu-copy">'+text+'</p>';
function renderBattle() {
  currentRegion = "empire";
  selectedLevelIndex = Math.min(Math.max(0,Number(save.stageClears)||0),47);
  return renderStage();
}
function renderStage() {
  if (currentRegion !== "empire") {
    const locations = currentRegion==="future" ? ["Moon","Japan","New York","Brazil","Madagascar","Great Abyss"] : currentRegion==="cosmos" ? ["The Big Bang","Andromeda","Black Hole","Catseye Nebula","Finale"] : currentRegion==="legend" ? ["Japan","Korea","China","Mongolia","Russia","Australia"] : currentRegion==="event" ? ["Japan","Korea","China","Mongolia","Russia","Australia"] : ["Japan","Korea","China","Mongolia","Russia","Australia"];
    const body = pageCopy((currentRegion==="future"?"INTO THE FUTURE":currentRegion==="cosmos"?"CATS OF THE COSMOS":currentRegion==="legend"?"LEGEND STAGES":currentRegion==="event"?"EVENT STAGES":"EMPIRE OF CATS")+" · CHAPTER 1")+
      '<div class="meter"><span style="width:8%"></span></div>'+
      '<div class="menu-list">'+locations.map((name,i)=>row(name,i===0?"Clear to earn XP and continue.":"Stage not cleared",i===0?"go:fight":"locked",i===0?"BATTLE":"LOCKED")).join("")+'</div>';
    return renderWindow("Choose a Stage",body,"battle");
  }

  const completed=Math.max(0,Math.min(48,Number(save.stageClears)||0));
  const highestAvailable=Math.min(47,completed);
  if(!Number.isInteger(selectedLevelIndex)||selectedLevelIndex<0||selectedLevelIndex>47) selectedLevelIndex=highestAvailable;
  selectedLevelIndex=Math.min(selectedLevelIndex,highestAvailable);
  const selected=EMPIRE_CHAPTER_ONE[selectedLevelIndex];
  const available=selectedLevelIndex<=completed;
  const visibleLevels=EMPIRE_CHAPTER_ONE.slice(0,Math.min(48,completed+1));
  const countryRows=visibleLevels.map((level,index)=>{
    const cleared=index<completed;
    const current=index===completed;
    const classes="world-country-row"+(index===selectedLevelIndex?" is-selected":"")+(cleared?" is-cleared":"")+(current?" is-next":"");
    const status=cleared?"★":current?"NEXT":"";
    return '<button class="'+classes+'" data-go="level:'+index+'" data-level-index="'+index+'" aria-label="'+level.name+(cleared?", cleared":current?", next stage":"")+'">'+
      '<span class="world-country-name">'+level.name+'</span>'+
      '<span class="world-country-status" aria-hidden="true">'+status+'</span>'+
    '</button>';
  }).join("");
  const energyCost=5;
  const clearCount=selectedLevelIndex<completed?1:0;
  const stageStatus=clearCount?"CLEARED":"NEXT STAGE";
  return '<section class="screen world-stage-screen" aria-label="Empire of Cats Chapter 1 stage select">'+
    '<div class="world-stage-frame">'+
      '<header class="world-stage-header">'+
        '<div class="world-stage-chapter"><strong>EMPIRE OF CATS</strong><span>CHAPTER 1</span></div>'+
        '<div class="world-stage-xp"><span>XP</span><strong>'+money(save.xp)+'</strong></div>'+
      '</header>'+
      '<div class="world-level-map" aria-label="Empire of Cats map and horizontal country selector">'+
        '<div class="world-map-canvas">'+
          '<img class="world-map-art world-map-art-background" src="sprites/backgrounds/empire-of-cats-map.png?v=20261029-14" alt="" draggable="false">'+
        '</div>'+
        '<nav class="world-country-list" aria-label="Unlocked places">'+countryRows+'</nav>'+
        '<aside class="world-map-stage-info">'+
          '<span class="world-map-stage-kicker">STAGE '+String(selectedLevelIndex+1).padStart(2,"0")+' / 48 · '+stageStatus+'</span>'+
          '<strong>'+selected.name+'</strong>'+
          '<div class="world-map-stage-stats"><span>ENERGY</span><b>−'+energyCost+'</b><span>CLEARED</span><b>'+clearCount+'</b></div>'+
        '</aside>'+
        '<div class="world-map-attack-panel">'+
          '<div class="world-map-energy"><span>ENERGY</span><strong>'+money(save.energy)+' / '+money(save.maxEnergy)+'</strong><i><b style="width:'+Math.max(0,Math.min(100,(Number(save.energy)||0)/Math.max(1,Number(save.maxEnergy)||100)*100))+'%"></b></i></div>'+
          '<button class="world-battle-button" data-go="stage-battle" '+(available?"":"disabled")+'><span>ATTACK!</span></button>'+
        '</div>'+
      '</div>'+
      '<div class="world-stage-items" aria-label="Battle items">'+
        '<div class="world-map-item"><span class="world-map-item-icon">»</span><small>SPEED UP</small><b>x0</b></div>'+
        '<div class="world-map-item"><span class="world-map-item-icon">◆</span><small>GET</small><b>x0</b></div>'+
        '<div class="world-map-item"><span class="world-map-item-icon">MAX</span><small>MAX</small><b>x0</b></div>'+
        '<div class="world-map-item"><span class="world-map-item-icon">XP</span><small>XP UP</small><b>x0</b></div>'+
        '<div class="world-map-item"><span class="world-map-item-icon">XP</span><small>XP UP</small><b>x0</b></div>'+
        '<div class="world-map-item"><span class="world-map-item-icon">◎</span><small>ITEM</small><b>x0</b></div>'+
        '<div class="world-map-item is-locked"><span class="world-map-item-icon">⌕</span><small>UNLOCK</small></div>'+
      '</div>'+
      '<footer class="world-stage-footer">'+
        '<button class="world-stage-back" data-go="go:base" aria-label="Back to Cat Base"><img src="sprites/ui/backbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
        '<button class="world-stage-store" data-go="go:store" aria-label="Open Store"><img src="sprites/ui/storebutton.png?v=20261026-26" alt="" draggable="false"></button>'+
        '<button class="world-stage-catfood" data-go="go:store" aria-label="Open Cat Food Store"><img src="sprites/ui/Cat_Food.png?v=20261026-27" alt="" draggable="false"><span>+</span><strong>'+money(save.catFood)+'</strong></button>'+
      '</footer>'+
    '</div>'+
  '</section>';
}
const EOC1_ENEMY_BASE_HEALTH = [
  500,500,500,500,750,750,2400,1500,3000,2500,3500,4000,
  5000,6000,6100,7000,7000,8000,9000,9000,10000,12000,15000,15000,
  15000,15000,15000,15000,18000,15000,8000,18000,18000,18000,20000,20000,
  20000,20000,20000,20000,20000,25000,20000,25000,20000,20000,30000,99999
];
function timedEnemySpawn(enemy,amount,startTime,intervalMin,intervalMax,maxAlive=3,spawnChance=1) {
  return {enemy,amount,startTime,intervalMin,intervalMax,maxAlive,spawnChance};
}
function baseTriggeredEnemySpawn(enemy,amount,baseHealthPercent,intervalMin=2,intervalMax=4,maxAlive=6,spawnChance=1,priority=false,fallbackAfterSeconds=null) {
  return {enemy,amount,baseHealthPercent,startTime:0,intervalMin,intervalMax,maxAlive,spawnChance,priority:priority===true,fallbackAfterSeconds};
}
const EOC1_MAX_ENEMIES = {
  Korea:3,
  Mongolia:4,
  China:30,
  Thailand:5,
  Japan:6,
  Maldives:5,
  Dubai:12,
  "Saudi Arabia":3,
  Kenya:4,
  Madagascar:6,
  Greece:5
};
function defaultBattleLevelConfig(levelName="Korea") {
  const stageIndex=EMPIRE_CHAPTER_ONE.findIndex(level=>level.name===levelName);
  const enemyBaseHealth=EOC1_ENEMY_BASE_HEALTH[stageIndex]||500;
  let enemySpawns=[];
  if(stageIndex<=0) {
    enemySpawns=[timedEnemySpawn("doge",18,2,5.5,9,3,0.82)];
  } else {
    enemySpawns=[timedEnemySpawn("doge","infinite",0,6.67,13.33,3)];
    if(stageIndex>=1) enemySpawns.push(timedEnemySpawn("snache","infinite",20,20,53.33,3));
    if(stageIndex>=3) enemySpawns.push(timedEnemySpawn("those-guys","infinite",40,20,53.33,3));
    if(stageIndex>=6) enemySpawns.push(timedEnemySpawn("hippoe",3,65,25,40,1));
    if(stageIndex>=9) enemySpawns.push(timedEnemySpawn("pigge",2,80,35,50,1));
    if(stageIndex>=12) enemySpawns.push(timedEnemySpawn("jackie-peng",2,100,40,55,1));
  }
  if(levelName==="China") {
    enemySpawns=[
      timedEnemySpawn("doge",3,0.67,26.67,26.67,3),
      timedEnemySpawn("snache",3,10,26.67,26.67,3),
      timedEnemySpawn("snache",2,30,13.33,13.33,2)
    ];
  }
  if(levelName==="Thailand") {
    enemySpawns=[
      timedEnemySpawn("doge","infinite",0,6,10,3),
      timedEnemySpawn("snache","infinite",0,10,26.67,3),
      timedEnemySpawn("those-guys","infinite",40,10,26.67,3)
    ];
  }
  if(levelName==="Japan") {
    enemySpawns=[
      timedEnemySpawn("doge","infinite",0,10.67,18.67,3),
      timedEnemySpawn("snache","infinite",0,20,53.33,3),
      timedEnemySpawn("those-guys","infinite",40,20,53.33,3),
      baseTriggeredEnemySpawn("hippoe",1,90,1,1,1,1,true,65),
      baseTriggeredEnemySpawn("those-guys",6,90,2,4,6)
    ];
  }
  if(levelName==="Maldives") {
    enemySpawns=[
      timedEnemySpawn("doge","infinite",0,10.67,18.67,3),
      timedEnemySpawn("snache","infinite",8,20,53.33,3),
      timedEnemySpawn("those-guys","infinite",40,10,40,3),
      baseTriggeredEnemySpawn("pigge",1,90,1,1,1)
    ];
  }
  if(levelName==="Dubai") {
    enemySpawns=[
      timedEnemySpawn("doge","infinite",0,10,20,3),
      timedEnemySpawn("snache","infinite",20,10,26.67,3),
      timedEnemySpawn("those-guys","infinite",40,10,26.67,3),
      baseTriggeredEnemySpawn("jackie-peng",1,90,1,1,1)
    ];
  }
  if(levelName==="Saudi Arabia") {
    enemySpawns=[
      timedEnemySpawn("doge","infinite",0,8,16,3),
      timedEnemySpawn("hippoe",1,0,1,1,1),
      timedEnemySpawn("snache","infinite",20,12,24,3),
      timedEnemySpawn("those-guys","infinite",40,12,24,3)
    ];
  }
  if(levelName==="Kenya") {
    enemySpawns=[
      timedEnemySpawn("doge","infinite",0,6,12,4),
      timedEnemySpawn("snache","infinite",20,10,18,3),
      timedEnemySpawn("those-guys","infinite",40,10,18,3),
      timedEnemySpawn("pigge",1,60,60,60,1),
      timedEnemySpawn("hippoe",1,80,80,80,1)
    ];
  }
  if(levelName==="Madagascar") {
    enemySpawns=[
      timedEnemySpawn("those-guys","infinite",0,1,10,3),
      timedEnemySpawn("doge","infinite",0,10,20,2),
      baseTriggeredEnemySpawn("those-guys",8,85,0.7,2,4,1,true,55),
      baseTriggeredEnemySpawn("gory",1,85,1,1,1,1,true,70),
      baseTriggeredEnemySpawn("gory",1,60,2,3,1,1,true,140)
    ];
  } else if(stageIndex>15&&levelName!=="Greece") {
    enemySpawns.push(timedEnemySpawn("gory",1,115,75,100,1,0.55));
  }
  if(levelName==="Greece") {
    enemySpawns=[
      timedEnemySpawn("those-guys","infinite",0,1,4,4),
      timedEnemySpawn("pigge",1,10,10,10,1),
      baseTriggeredEnemySpawn("sir-seal",1,93,1,1,1,1,true,80)
    ];
  } else if(stageIndex>22) {
    enemySpawns.push(timedEnemySpawn("sir-seal",1,140,85,110,1,0.4));
  }
  return {
    name:levelName,
    background:"background.png",
    enemyBase:"enemybase.png",
    enemyBaseHealth,
    catBaseHealth:1000,
    maxEnemies:EOC1_MAX_ENEMIES[levelName]||6,
    initialSpawnDelay:stageIndex<=0?2:0,
    enemySpawns
  };
}
function normalizeBattleLevelConfig(raw,levelName="Korea") {
  const defaults=defaultBattleLevelConfig(levelName);
  const data=raw && typeof raw==="object" ? raw : {};
  const initialSpawnDelay=Math.max(0,Number.isFinite(Number(data.initialSpawnDelay))?Number(data.initialSpawnDelay):defaults.initialSpawnDelay);
  const sourceRules=Array.isArray(data.enemySpawns)?data.enemySpawns:defaults.enemySpawns;
  const enemySpawns=sourceRules.filter(rule=>rule&&typeof rule==="object").map((rule,index)=>{
    const enemy=battleUnitKey(rule.enemy||rule.type||"doge")||"doge";
    const requestedAmount=Number(rule.amount ?? rule.count);
    const infinite=rule.infinite===true||String(rule.amount??rule.count??"").toLowerCase()==="infinite"||String(rule.amount??rule.count??"")==="∞";
    const amount=infinite?0:Math.max(0,Math.floor(Number.isFinite(requestedAmount)?requestedAmount:10));
    const startTime=Math.max(0,Number.isFinite(Number(rule.startTime))?Number(rule.startTime):initialSpawnDelay);
    const intervalMin=Math.max(0.25,Number.isFinite(Number(rule.intervalMin))?Number(rule.intervalMin):5.5);
    const intervalMax=Math.max(intervalMin,Number.isFinite(Number(rule.intervalMax))?Number(rule.intervalMax):intervalMin);
    const rawChance=Number(rule.spawnChance ?? rule.randomRate ?? 1);
    const spawnChance=Math.max(0,Math.min(1,Number.isFinite(rawChance)?rawChance:1));
    const maxAlive=Math.max(1,Math.floor(Number.isFinite(Number(rule.maxAlive))?Number(rule.maxAlive):3));
    const rawBasePercent=rule.baseHealthPercent;
    const baseHealthPercent=rawBasePercent===undefined||rawBasePercent===null
      ? null
      : Math.max(1,Math.min(99,Number.isFinite(Number(rawBasePercent))?Number(rawBasePercent):90));
    const rawFallback=rule.fallbackAfterSeconds;
    const fallbackAfterSeconds=rawFallback===undefined||rawFallback===null
      ? null
      : Math.max(0,Number.isFinite(Number(rawFallback))?Number(rawFallback):0);
    return {
      id:index,enemy,amount,infinite,startTime,intervalMin,intervalMax,spawnChance,maxAlive,
      baseHealthPercent,fallbackAfterSeconds,priority:rule.priority===true,spawned:0,triggered:baseHealthPercent===null,
      nextAttemptAt:baseHealthPercent===null?startTime:Infinity
    };
  });
  const positive=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):fallback;
  const safeAssetFile=(value,fallback)=>{
    const file=String(value||"").trim();
    return /^[a-z0-9][a-z0-9._-]*\.(?:png|webp|svg)$/i.test(file) ? file : fallback;
  };
  return {
    name:String(data.name||levelName),
    background:safeAssetFile(data.background||data.backgroundFile,defaults.background),
    enemyBase:safeAssetFile(data.enemyBase||data.enemyBaseFile,defaults.enemyBase),
    enemyBaseHealth:positive(data.enemyBaseHealth,defaults.enemyBaseHealth),
    catBaseHealth:positive(data.catBaseHealth,defaults.catBaseHealth),
    maxEnemies:Math.max(1,Math.floor(positive(data.maxEnemies,defaults.maxEnemies||6))),
    initialSpawnDelay,enemySpawns
  };
}
async function loadBattleLevelConfig() {
  if(battleLevelConfigPromise) return battleLevelConfigPromise;
  const selected=EMPIRE_CHAPTER_ONE[selectedLevelIndex]||EMPIRE_CHAPTER_ONE[0];
  battleLevelName=selected.name;
  battleLevelConfigPromise=(async()=>{
    let data=null;
    try {
      const path="Levels/"+encodeURIComponent(battleLevelName)+"/stats.json";
      const response=await fetch(new URL(path,APP_BASE_URL).href+"?v="+BATTLE_ASSET_VERSION,{cache:"no-store"});
      if(response.ok) data=await response.json();
    } catch(error) {
      console.warn("Battle Cats level stats could not load; using defaults:",battleLevelName,error);
    }
    battleLevelConfig=normalizeBattleLevelConfig(data,battleLevelName);
    if(battleState) {
      battleState.levelName=battleLevelName;
      battleState.levelConfig=battleLevelConfig;
      battleState.spawnRules=battleLevelConfig.enemySpawns.map(rule=>({...rule,spawned:0,triggered:rule.baseHealthPercent===null,nextAttemptAt:rule.baseHealthPercent===null?rule.startTime:Infinity}));
      battleState.enemyBaseHp=battleLevelConfig.enemyBaseHealth;
      battleState.enemyBaseMaxHp=battleLevelConfig.enemyBaseHealth;
      battleState.catBaseHp=battleLevelConfig.catBaseHealth;
      battleState.catBaseMaxHp=battleLevelConfig.catBaseHealth;
      battleState.levelReady=false;
      applyBattleLevelVisuals();
      updateFightUI();
    }
    return battleLevelConfig;
  })();
  return battleLevelConfigPromise;
}
function createBattleEnemy(enemyType,key,x,frameAt=0) {
  const type=battleUnitKey(enemyType||"doge");
  const stats=battleUnitStats(type);
  return {
    key,kind:"doge",enemyType:type,x,hp:stats.health,maxHp:stats.health,attackPower:stats.damage,speed:stats.speed,
    statsSnapshot:{...stats},baseSpeed:stats.speed,range:stats.range,spriteChangeSpeed:stats.spriteChangeSpeed,walkSpriteChangeSpeed:stats.walkSpriteChangeSpeed,
    attackCooldown:stats.attackCooldown,attackIntervalScale:0.9+Math.random()*0.2,hasEnteredCombatRange:false,nextAttackAt:0,currentTargetKey:"",areaAttack:Number(stats.areaAttack)||0,
    mode:"moving",attackTimer:0,animUntil:0,attackEndsAt:0,hitUntil:0,frameAt,killReward:stats.killReward,
    knockbackThresholdPercent:stats.knockbackThresholdPercent,
    knockbackDurationSetting:stats.knockbackDuration,knockbackDistanceSetting:stats.knockbackDistance,
    knockbackLimit:stats.knockbackCount,knockbackCount:0,
    nextKnockbackHp:stats.health*(1-stats.knockbackThresholdPercent/100),queuedKnockbacks:0,
    walkStartedAt:battleState?battleState.elapsed:0,attackStartedAt:0
  };
}
function createBattleState() {
  const selected=EMPIRE_CHAPTER_ONE[selectedLevelIndex]||EMPIRE_CHAPTER_ONE[0];
  const defaults=defaultBattleLevelConfig(selected.name);
  return {
    elapsed:0,money:50,maxMoney:150,playerUnits:[],enemies:[],speedMultiplier:1,
    nextEnemySpawn:defaults.initialSpawnDelay,
    enemyBaseHp:defaults.enemyBaseHealth,enemyBaseMaxHp:defaults.enemyBaseHealth,
    catBaseHp:defaults.catBaseHealth,catBaseMaxHp:defaults.catBaseHealth,
    cooldowns:{},cooldownWasActive:{},nextUnitKey:1,nextEnemyKey:1,ended:"",workerLevel:1,
    walletAvailabilityInitialized:false,walletWasAvailable:false,
    deathSouls:[],nextDeathSoulKey:1,
    levelName:selected.name,levelConfig:defaults,spawnRules:[],levelReady:false
  };
}
function loadBattleAssetManifests() {
  if(battleAssetsPromise) return battleAssetsPromise;
  BATTLE_UNIT_STATS_BY_ID.clear();
  const assetRequests=[["cat","Cats/cat/assets.json"],["doge","enemys/doge/assets.json"],["snache","enemys/snache/assets.json"],["those-guys","enemys/those-guys/assets.json"],["hippoe","enemys/hippoe/assets.json"],["pigge","enemys/pigge/assets.json"],["jackie-peng","enemys/jackie-peng/assets.json"]];
  const statRequests=[];
  save.units.forEach(unit=>{
    const key=battleUnitKey(unit);
    const folder=unit.assetFolder||unit.spriteFolder||key;
    statRequests.push({id:String(unit.id),key,path:unit.statsPath||"Cats/"+folder+"/stats.json"});
    if(key!=="cat"&&key!=="doge") {
      if(!assetRequests.some(([kind])=>kind===key)) assetRequests.push([key,unit.assetsPath||"Cats/"+folder+"/assets.json"]);
      if(!BATTLE_ASSETS[key]) BATTLE_ASSETS[key]={moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:8,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"Cats/"+folder+"/slot.png"};
    }
  });
  const assetJobs=assetRequests.map(async([kind,path])=>{
    try {
      const response=await fetch(new URL(path,APP_BASE_URL).href+"?v="+BATTLE_ASSET_VERSION,{cache:"no-store"});
      if(!response.ok) return;
      const data=await response.json();
      const current=BATTLE_ASSETS[kind]||(BATTLE_ASSETS[kind]={moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:8,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"Cats/"+kind+"/slot.svg"});
      if(Array.isArray(data.moving)&&data.moving.length) current.moving=data.moving;
      if(Array.isArray(data.attackFrames)&&data.attackFrames.length) current.attacks=data.attackFrames;
      else if(Array.isArray(data.attacks)&&data.attacks.length) current.attacks=data.attacks;
      if(typeof data.attackSprite==="string") current.attackSprite=data.attackSprite;
      if(Number.isFinite(Number(data.attackFrameRate))&&Number(data.attackFrameRate)>=1) current.attackFrameRate=Math.min(30,Number(data.attackFrameRate));
      if(Number.isFinite(Number(data.attackDuration))&&Number(data.attackDuration)>=0.1) current.attackDuration=Math.min(5,Number(data.attackDuration));
      if(Array.isArray(data.damagedFrames)) current.damagedFrames=data.damagedFrames;
      if(Array.isArray(data.knockbackFrames)) current.knockbackFrames=data.knockbackFrames;
      if(data.idle) current.idle=data.idle;
      if(data.attack) current.attack=data.attack;
      if(data.damaged) current.damaged=data.damaged;
      if(data.slot) current.slot=data.slot;
      if(data.upgrade) current.upgrade=data.upgrade;
    } catch(error) { console.warn("Battle Cats sprite manifest could not load:",path,error); }
  });
  const statJobs=statRequests.map(async({id,key,path})=>{
    try {
      const response=await fetch(new URL(path,APP_BASE_URL).href+"?v="+BATTLE_ASSET_VERSION,{cache:"no-store"});
      if(!response.ok) return;
      const data=await response.json();
      if(data&&typeof data==="object") {
        BATTLE_UNIT_STATS_BY_ID.set(id,{...(BATTLE_UNIT_STATS[key]||{}),...data});
      }
    } catch(error) { console.warn("Battle Cats unit stats could not load:",path,error); }
  });
  battleAssetsPromise=Promise.all([...assetJobs,...statJobs]).then(async()=>{
    await loadBattleLevelConfig();
    const enemyTypes=[...new Set((battleLevelConfig?.enemySpawns||[]).map(rule=>rule.enemy))].filter(type=>type!=="doge");
    await Promise.all(enemyTypes.map(async type=>{
      if(!BATTLE_ASSETS[type]) BATTLE_ASSETS[type]={moving:[],attacks:[],attack:"",damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"enemys/"+type+"/slot.png"};
      const current=BATTLE_ASSETS[type];
      const jobs=[
        (async()=>{
          const path="enemys/"+type+"/assets.json";
          try {
            const response=await fetch(new URL(path,APP_BASE_URL).href+"?v="+BATTLE_ASSET_VERSION,{cache:"no-store"});
            if(!response.ok) return;
            const data=await response.json();
            if(Array.isArray(data.moving)&&data.moving.length) current.moving=data.moving;
            if(Array.isArray(data.attackFrames)&&data.attackFrames.length) current.attacks=data.attackFrames;
      else if(Array.isArray(data.attacks)&&data.attacks.length) current.attacks=data.attacks;
      if(typeof data.attackSprite==="string") current.attackSprite=data.attackSprite;
      if(Number.isFinite(Number(data.attackFrameRate))&&Number(data.attackFrameRate)>=1) current.attackFrameRate=Math.min(30,Number(data.attackFrameRate));
      if(Number.isFinite(Number(data.attackDuration))&&Number(data.attackDuration)>=0.1) current.attackDuration=Math.min(5,Number(data.attackDuration));
            if(Array.isArray(data.damagedFrames)) current.damagedFrames=data.damagedFrames;
            if(Array.isArray(data.knockbackFrames)) current.knockbackFrames=data.knockbackFrames;
            if(data.idle) current.idle=data.idle;
            if(data.attack) current.attack=data.attack;
            if(data.damaged) current.damaged=data.damaged;
            if(data.slot) current.slot=data.slot;
          } catch(error) { console.warn("Enemy sprite manifest could not load:",path,error); }
        })(),
        (async()=>{
          const path="enemys/"+type+"/stats.json";
          try {
            const response=await fetch(new URL(path,APP_BASE_URL).href+"?v="+BATTLE_ASSET_VERSION,{cache:"no-store"});
            if(!response.ok) return;
            const data=await response.json();
            if(data&&typeof data==="object") BATTLE_UNIT_STATS[type]={...(BATTLE_UNIT_STATS[type]||{}),...data};
          } catch(error) { console.warn("Enemy stats could not load:",path,error); }
        })()
      ];
      await Promise.all(jobs);
    }));
    if(battleState) {
      battleState.levelReady=true;
      for(const entity of [...battleState.playerUnits,...battleState.enemies]) {
        const unit=entity.kind==="cat"
          ? save.units.find(item=>String(item.id)===String(entity.unitId))||entity
          : (entity.enemyType||"doge");
        applyBattleStatsToEntity(entity,unit);
        updateBattleEntityView(entity);
      }
    }
    if(scene==="fight") {
      stage.querySelectorAll("[data-battle-slot]").forEach(button=>{
        const unit=save.units.find(item=>String(item.id)===button.dataset.battleSlot);
        const img=button.querySelector("img");
        if(img&&unit) img.src=battleSlotImage(unit);
      });
      updateFightUI();
    }
  }).catch(error=>{
    console.warn("Battle Cats battle assets failed to initialize:",error);
    if(battleState) battleState.levelReady=true;
  });
  return battleAssetsPromise;
}
function battleAssetUrl(path) {
  if (!path) return "";
  try {
    const url=new URL(path,APP_BASE_URL);
    const appOrigin=new URL(APP_BASE_URL).origin;
    if(url.origin===appOrigin&&!url.searchParams.has("v")) url.searchParams.set("v",BATTLE_ASSET_VERSION);
    return url.href;
  } catch {
    return path;
  }
}
function battleSlotImage(unit) {
  const key = battleUnitKey(unit);
  const assets = BATTLE_ASSETS[key];
  const source=key==="tank-cat"
    ? "Cats/tank-cat/slot.png"
    : unit.spriteSlot || (assets && assets.slot) || "sprites/original_sheets/normal-cat-right-icon.webp";
  return battleAssetUrl(source);
}
function battleAnimationMode(entity,elapsed=battleState?battleState.elapsed:0) {
  const mode=String(entity&&entity.mode||"idle");
  if(mode==="dead"||mode==="knockback") return mode;
  const attackEnd=Number(entity.attackEndsAt)||0;
  if(mode==="attack"&&attackEnd>elapsed+0.0001) return "attack";
  const hurtEnd=Number(entity.hitUntil)||0;
  if(mode==="damaged"&&hurtEnd>elapsed+0.0001) return "damaged";
  return mode==="moving"?"moving":"idle";
}
function battleImageFor(entity) {
  const catUnit=entity.kind==="cat" ? save.units.find(unit=>String(unit.id)===String(entity.unitId)) : null;
  const assetKey=entity.kind==="cat" ? battleUnitKey(catUnit||"cat") : battleUnitKey(entity.enemyType||"doge");
  const assets=BATTLE_ASSETS[assetKey] || (entity.kind==="cat"?BATTLE_ASSETS.cat:BATTLE_ASSETS.doge);
  const entityStats=battleStatsForEntity(entity);
  const elapsed=battleState?battleState.elapsed:0;
  const animationMode=battleAnimationMode(entity,elapsed);
  if(assetKey==="those-guys"&&animationMode==="idle") return battleAssetUrl("enemys/those-guys/idle.png");
  const configuredAttackRate=Math.max(1,Math.min(30,Number(assets.attackFrameRate)||BATTLE_ATTACK_FRAME_RATE));
  const frameRate=animationMode==="attack" ? configuredAttackRate : Math.max(0.5,Number(entity.spriteChangeSpeed||entityStats.spriteChangeSpeed||6));
  if(animationMode==="idle") return battleAssetUrl(assets.idle||(assets.moving&&assets.moving[0])||"");
  if(animationMode==="dead"||animationMode==="knockback") {
    const frames=assets.knockbackFrames&&assets.knockbackFrames.length?assets.knockbackFrames:(assets.damagedFrames&&assets.damagedFrames.length?assets.damagedFrames:[]);
    if(frames.length) return battleAssetUrl(frames[Math.floor(elapsed*frameRate+(entity.frameAt||0))%frames.length]);
    return battleAssetUrl(assets.damaged||assets.idle||"");
  }
  if(animationMode==="attack") {
    if(typeof assets.attackSprite==="string"&&assets.attackSprite.trim()) return battleAssetUrl(assets.attackSprite);
    const frames=Array.isArray(assets.attacks)?assets.attacks:[];
    if(frames.length) {
      const attackStartedAt=Number.isFinite(Number(entity.attackStartedAt))?Number(entity.attackStartedAt):elapsed;
      const attackElapsed=Math.max(0,elapsed-attackStartedAt);
      const frameIndex=Math.max(0,Math.min(frames.length-1,Math.floor((attackElapsed+0.0001)*configuredAttackRate)));
      return battleAssetUrl(frames[frameIndex]);
    }
    return battleAssetUrl(assets.attack||assets.idle||(assets.moving&&assets.moving[0])||"");
  }
  if(animationMode==="damaged") {
    const frames=assets.damagedFrames&&assets.damagedFrames.length?assets.damagedFrames:[];
    if(frames.length) return battleAssetUrl(frames[Math.floor(elapsed*frameRate+(entity.frameAt||0))%frames.length]);
    return battleAssetUrl(assets.damaged||assets.idle||(assets.moving&&assets.moving[0])||"");
  }
  if(entity.kind==="cat"&&animationMode==="moving") {
    const walkingFrames=(Array.isArray(assets.moving)?assets.moving:[]).filter(path=>typeof path==="string"&&path.length>0);
    if(walkingFrames.length) {
      const walkRate=Math.max(0.5,Number(entity.walkSpriteChangeSpeed||entityStats.walkSpriteChangeSpeed||2.5));
      const walkStart=Number.isFinite(Number(entity.walkStartedAt))?Number(entity.walkStartedAt):elapsed;
      const walkElapsed=Math.max(0,elapsed-walkStart);
      const frameIndex=Math.floor(walkElapsed*walkRate)%walkingFrames.length;
      return battleAssetUrl(walkingFrames[frameIndex]);
    }
  }
  const frames=Array.isArray(assets.moving)?assets.moving:[];
  if(frames.length) return battleAssetUrl(frames[Math.floor(elapsed*frameRate+(entity.frameAt||0))%frames.length]);
  return battleAssetUrl(assets.idle||"");
}
function findBattleEntity(key) {
  if (!battleState) return null;
  return [...battleState.playerUnits,...battleState.enemies].find(entity=>entity.key===key) || null;
}

function battleTargetGap(attacker,target) {
  if(!attacker||!target) return Infinity;
  return attacker.kind==="cat" ? Number(attacker.x)-Number(target.x) : Number(target.x)-Number(attacker.x);
}
function findBattleTargetFor(attacker) {
  if(!battleState||!attacker) return null;
  const candidates=attacker.kind==="cat" ? battleState.enemies : battleState.playerUnits;
  const availableCandidates=candidates.filter(target=>
    target&&Number(target.hp)>0&&target.mode!=="dead"&&target.mode!=="knockback"
  );
  if(!availableCandidates.length) {
    attacker.currentTargetKey="";
    return null;
  }

  const pinnedTarget=availableCandidates.find(target=>
    target.key===attacker.currentTargetKey&&battleTargetGap(attacker,target)>=-0.0001
  );
  if(pinnedTarget) return pinnedTarget;

  const nextTarget=availableCandidates
    .map(target=>{
      const gap=battleTargetGap(attacker,target);
      const distance=Math.abs(gap);
      const reach=battleCombatReachPercent(attacker.range,attacker,target);
      return {target,gap,distance,inRange:distance<=reach+0.0001};
    })
    .filter(item=>item.gap>=0)
    .sort((first,second)=>
      Number(second.inRange)-Number(first.inRange)||
      first.distance-second.distance
    )[0]?.target||null;

  attacker.currentTargetKey=nextTarget?nextTarget.key:"";
  return nextTarget;
}
function battleEnemyBaseHoldPosition(cat,enemyHomeCenter) {
  if(!cat) return Number(enemyHomeCenter)||0;
  if(typeof cat.enemyBaseHoldX!=="number"||!Number.isFinite(cat.enemyBaseHoldX)) {
    const reach=battleRangePercent(cat.range);
    cat.enemyBaseHoldX=Math.max(Number(enemyHomeCenter)+0.35,Number(enemyHomeCenter)+reach*0.9);
  }
  return cat.enemyBaseHoldX;
}

function battleEntityMarkup(entity) {
  const source=battleImageFor(entity);
  const unitType=entity.kind==="cat" ? battleUnitKey(entity.name||"cat") : battleUnitKey(entity.enemyType||"doge");
  return '<div class="fight-unit '+(entity.kind==="cat"?"fight-unit-cat":"fight-unit-doge")+'" data-unit-type="'+unitType+'" data-battle-entity="'+entity.key+'" style="left:'+entity.x+'%">'+
    '<img class="fight-unit-sprite" crossorigin="anonymous" '+(source?'src="'+source+'"':'')+' alt="'+(entity.kind==="cat"?"Cat":"Enemy")+'" draggable="false">'+
  '</div>';
}
function battleDeathSoulMarkup(soul) {
  const source=battleAssetUrl("sprites/battle/Deathsoul1.png");
  return '<img class="fight-death-soul" data-death-soul="'+soul.key+'" data-soul-frame="0" src="'+source+'" alt="" draggable="false" style="left:'+soul.x+'%;bottom:'+soul.startBottom+'px">';
}
function createBattleDeathSoul(entity) {
  if(!battleState||!entity) return;
  const layer=stage.querySelector(".fight-unit-layer");
  const unitNode=layer&&layer.querySelector('[data-battle-entity="'+entity.key+'"]');
  const layerRect=layer&&layer.getBoundingClientRect();
  const unitRect=unitNode&&unitNode.getBoundingClientRect();
  const layerWidth=layerRect&&layerRect.width>0?layerRect.width:1;
  const deathX=unitRect&&unitRect.width>0
    ? (unitRect.left+unitRect.width/2-layerRect.left)/layerWidth*100
    : Number(entity.x)||50;
  const startBottom=layerRect&&unitRect
    ? Math.max(0,layerRect.bottom-unitRect.top+5)
    : 82;
  const soul={
    key:"death-soul-"+battleState.nextDeathSoulKey++,
    x:Math.max(1,Math.min(99,deathX)),
    startBottom,
    age:0,
    sway:Math.random()*Math.PI*2
  };
  battleState.deathSouls.push(soul);
  if(layer) layer.insertAdjacentHTML("beforeend",battleDeathSoulMarkup(soul));
  playSfx("deadUnit");
}
function updateBattleDeathSouls(deltaSeconds) {
  if(!battleState||!battleState.deathSouls) return;
  const layer=stage.querySelector(".fight-unit-layer");
  const screen=stage.querySelector(".fight-screen");
  if(!layer||!screen) return;
  const screenRect=screen.getBoundingClientRect();
  const dt=Math.max(0,Number(deltaSeconds)||0);
  const survivors=[];
  for(const soul of battleState.deathSouls) {
    soul.age+=dt;
    const node=layer.querySelector('[data-death-soul="'+soul.key+'"]');
    if(!node) continue;
    const frame=Math.floor(soul.age*8)%4;
    const frameSource=battleAssetUrl("sprites/battle/Deathsoul"+(frame+1)+".png");
    if(node.dataset.soulFrame!==String(frame)) {
      node.dataset.soulFrame=String(frame);
      node.src=frameSource;
    }
    const drift=Math.sin(soul.age*3.1+soul.sway)*0.85;
    node.style.left=Math.max(1,Math.min(99,soul.x+drift))+"%";
    node.style.bottom=(soul.startBottom+soul.age*105)+"px";
    const rect=node.getBoundingClientRect();
    const outside=rect.bottom<screenRect.top-2 || rect.right<screenRect.left-2 ||
      rect.left>screenRect.right+2 || rect.top>screenRect.bottom+2;
    if(outside) {
      node.remove();
    } else {
      survivors.push(soul);
    }
  }
  battleState.deathSouls=survivors;
}
function startBattleRuntime() {
  if (!battleState) battleState = createBattleState();
  applyBattleLevelVisuals();
  loadBattleAssetManifests();
  if (battleTimer===null) {
    battleState.lastTickAt=performance.now();
    battleTimer=setInterval(tickBattle,50);
  }
  updateFightUI();
}
function stopBattleRuntime() {
  if(battleTimer!==null) clearInterval(battleTimer);
  battleTimer=null;
  battleState=null;
  battleAssetsPromise=null;
  battleLevelConfigPromise=null;
  battleLevelConfig=null;
  battleLevelName="Korea";
}
function ensureBattleEntityNode(entity) {
  let element = stage.querySelector('[data-battle-entity="'+entity.key+'"]');
  if (element) return element;
  const layer = stage.querySelector(".fight-unit-layer");
  if (!layer) return null;
  layer.insertAdjacentHTML("beforeend",battleEntityMarkup(entity));
  element = stage.querySelector('[data-battle-entity="'+entity.key+'"]');
  return element;
}
function normalizeAxeCatBattleSprite(image,source){
  if(!image||!image.naturalWidth||!image.naturalHeight||!source) return "";
  const cached=BATTLE_AXE_SPRITE_CACHE.get(source);
  if(cached) return cached;
  try {
    const width=image.naturalWidth;
    const height=image.naturalHeight;
    const scan=document.createElement("canvas");
    scan.width=width;
    scan.height=height;
    const scanContext=scan.getContext("2d",{willReadFrequently:true});
    if(!scanContext) return "";
    scanContext.drawImage(image,0,0);
    const pixels=scanContext.getImageData(0,0,width,height).data;
    let minX=width,minY=height,maxX=-1,maxY=-1;
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        if(pixels[(y*width+x)*4+3]>12){
          if(x<minX) minX=x;
          if(x>maxX) maxX=x;
          if(y<minY) minY=y;
          if(y>maxY) maxY=y;
        }
      }
    }
    if(maxX<minX||maxY<minY) return "";
    const padding=2;
    minX=Math.max(0,minX-padding);
    minY=Math.max(0,minY-padding);
    maxX=Math.min(width-1,maxX+padding);
    maxY=Math.min(height-1,maxY+padding);
    const cropWidth=maxX-minX+1;
    const cropHeight=maxY-minY+1;
    const target=BATTLE_AXE_SPRITE_SIZE-16;
    const scale=Math.min(target/cropWidth,target/cropHeight);
    const drawWidth=cropWidth*scale;
    const drawHeight=cropHeight*scale;
    const normalized=document.createElement("canvas");
    normalized.width=BATTLE_AXE_SPRITE_SIZE;
    normalized.height=BATTLE_AXE_SPRITE_SIZE;
    const context=normalized.getContext("2d");
    if(!context) return "";
    context.imageSmoothingEnabled=true;
    context.drawImage(image,minX,minY,cropWidth,cropHeight,
      (BATTLE_AXE_SPRITE_SIZE-drawWidth)/2,
      BATTLE_AXE_SPRITE_SIZE-4-drawHeight,
      drawWidth,drawHeight);
    const result=normalized.toDataURL("image/png");
    BATTLE_AXE_SPRITE_CACHE.set(source,result);
    return result;
  } catch(error) {
    console.warn("Axe Cat sprite could not be normalized:",source,error);
    return "";
  }
}
function normalizeEnemyBattleSprite(image,source,element=null) {
  if(!image||!image.naturalWidth||!image.naturalHeight||!source) return "";
  const cached=BATTLE_ENEMY_SPRITE_CACHE.get(source);
  if(cached) return cached;
  try {
    const url=new URL(source,APP_BASE_URL);
    const match=url.hash.match(/^#frame=(\d+),(\d+),(\d+),(\d+)$/);
    if(!match) return "";
    const sx=Number(match[1]),sy=Number(match[2]),sw=Number(match[3]),sh=Number(match[4]);
    if(sw<=0||sh<=0||sx<0||sy<0||sx+sw>image.naturalWidth||sy+sh>image.naturalHeight) return "";

    const scan=document.createElement("canvas");
    scan.width=sw;
    scan.height=sh;
    const scanContext=scan.getContext("2d",{willReadFrequently:true});
    if(!scanContext) return "";
    scanContext.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
    const imageData=scanContext.getImageData(0,0,sw,sh);
    const pixels=imageData.data;
    const cornerIndexes=[0,(sw-1)*4,((sh-1)*sw)*4,((sh*sw)-1)*4];
    let bgR=0,bgG=0,bgB=0;
    for(const p of cornerIndexes){bgR+=pixels[p];bgG+=pixels[p+1];bgB+=pixels[p+2];}
    bgR/=cornerIndexes.length;bgG/=cornerIndexes.length;bgB/=cornerIndexes.length;

    const pixelCount=sw*sh;
    const visited=new Uint8Array(pixelCount);
    const queue=new Int32Array(pixelCount);
    let readAt=0,writeAt=0;
    const isSheetBackground=index=>{
      const p=index*4;
      if(pixels[p+3]<=12) return false;
      const r=pixels[p],g=pixels[p+1],b=pixels[p+2];
      const difference=Math.max(Math.abs(r-bgR),Math.abs(g-bgG),Math.abs(b-bgB));
      const chroma=Math.max(r,g,b)-Math.min(r,g,b);
      return difference<=38&&chroma<=48;
    };
    const pushBackground=index=>{
      if(index<0||index>=pixelCount||visited[index]||!isSheetBackground(index)) return;
      visited[index]=1;
      pixels[index*4+3]=0;
      queue[writeAt++]=index;
    };
    for(let x=0;x<sw;x++){pushBackground(x);pushBackground((sh-1)*sw+x);}
    for(let y=0;y<sh;y++){pushBackground(y*sw);pushBackground(y*sw+sw-1);}
    while(readAt<writeAt){
      const index=queue[readAt++];
      const x=index%sw;
      if(x>0) pushBackground(index-1);
      if(x<sw-1) pushBackground(index+1);
      if(index>=sw) pushBackground(index-sw);
      if(index<pixelCount-sw) pushBackground(index+sw);
    }
    scanContext.putImageData(imageData,0,0);

    let minX=sw,minY=sh,maxX=-1,maxY=-1;
    for(let y=0;y<sh;y++){
      for(let x=0;x<sw;x++){
        if(pixels[(y*sw+x)*4+3]>12){
          if(x<minX) minX=x;
          if(x>maxX) maxX=x;
          if(y<minY) minY=y;
          if(y>maxY) maxY=y;
        }
      }
    }
    if(maxX<minX||maxY<minY) return "";
    const padding=2;
    minX=Math.max(0,minX-padding);
    minY=Math.max(0,minY-padding);
    maxX=Math.min(sw-1,maxX+padding);
    maxY=Math.min(sh-1,maxY+padding);
    const cropWidth=maxX-minX+1,cropHeight=maxY-minY+1;
    const unitType=element&&element.dataset?element.dataset.unitType:"";
    const sharedSize=unitType==="snache"||unitType==="those-guys";
    const maxWidth=sharedSize?148:144;
    const maxHeight=sharedSize?116:144;
    const scale=Math.min(maxWidth/cropWidth,maxHeight/cropHeight);
    const drawWidth=cropWidth*scale,drawHeight=cropHeight*scale;
    const canvas=document.createElement("canvas");
    canvas.width=160;
    canvas.height=160;
    const context=canvas.getContext("2d");
    if(!context) return "";
    context.imageSmoothingEnabled=true;
    context.drawImage(scan,minX,minY,cropWidth,cropHeight,
      (160-drawWidth)/2,156-drawHeight,drawWidth,drawHeight);
    const result=canvas.toDataURL("image/png");
    BATTLE_ENEMY_SPRITE_CACHE.set(source,result);
    return result;
  } catch(error) {
    console.warn("Enemy sprite sheet frame could not be cropped:",source,error);
    return "";
  }
}
function applyCssEnemySpriteFrame(element,image,source) {
  if(!element||!image||!image.naturalWidth||!image.naturalHeight||!source) return false;
  try {
    const url=new URL(source,APP_BASE_URL);
    const match=url.hash.match(/^#frame=(\d+),(\d+),(\d+),(\d+)$/);
    if(!match) return false;
    const sx=Number(match[1]),sy=Number(match[2]),sw=Number(match[3]),sh=Number(match[4]);
    if(sw<=0||sh<=0||sx<0||sy<0||sx+sw>image.naturalWidth||sy+sh>image.naturalHeight) return false;
    const boxWidth=Math.max(1,element.clientWidth||96);
    const boxHeight=Math.max(1,element.clientHeight||145);
    const scale=Math.min((boxWidth-4)/sw,(boxHeight-8)/sh);
    if(!Number.isFinite(scale)||scale<=0) return false;
    image.style.position="absolute";
    image.style.width=(image.naturalWidth*scale)+"px";
    image.style.height=(image.naturalHeight*scale)+"px";
    image.style.left=((boxWidth-sw*scale)/2-sx*scale)+"px";
    image.style.top=(boxHeight-4-(sy+sh)*scale)+"px";
    image.style.maxWidth="none";
    image.style.maxHeight="none";
    image.style.objectFit="fill";
    image.dataset.cssCroppedSource=source;
    return true;
  } catch(error) {
    console.warn("Enemy sprite CSS crop could not be applied:",source,error);
    return false;
  }
}
function updateBattleEntityView(entity) {
  const element = ensureBattleEntityNode(entity);
  if (!element) return;
  element.style.left = Math.max(2,Math.min(97,entity.x))+"%";
  const animationMode=battleAnimationMode(entity);
  const attackCycle=String(Number(entity.attackCycleId)||0);
  if(animationMode==="attack"&&element.dataset.attackVisualCycle!==attackCycle) {
    element.classList.remove("is-attacking");
    void element.offsetWidth;
    element.dataset.attackVisualCycle=attackCycle;
  }
  element.classList.toggle("is-attacking",animationMode==="attack");
  element.classList.toggle("is-idle",animationMode==="idle");
  element.classList.toggle("is-damaged",animationMode==="damaged");
  element.classList.toggle("is-knockback",animationMode==="knockback");
  element.classList.toggle("is-dead",animationMode==="dead");
  const sprite = element.querySelector(".fight-unit-sprite");
  const source = battleImageFor(entity);
  if (!sprite) return;
  if (animationMode==="attack") {
    const duration=Math.max(0.1,Number(entity.animUntil)-Number(entity.attackStartedAt));
    const visualSpeed=Number(battleState&&battleState.speedMultiplier)===2?2:1;
    sprite.style.setProperty("--battle-attack-duration",(duration/visualSpeed)+"s");
  } else {
    sprite.style.removeProperty("--battle-attack-duration");
  }
  if (animationMode==="knockback") {
    const duration = Math.max(0.2,Number(entity.knockbackDuration)||Number(entity.knockbackDurationSetting)||0.64);
    const visualSpeed=Number(battleState&&battleState.speedMultiplier)===2?2:1;
    sprite.style.setProperty("--battle-knockback-duration",(duration/visualSpeed*1000)+"ms");
  } else {
    sprite.style.removeProperty("--battle-knockback-duration");
  }
  if (!source) { sprite.style.visibility="hidden"; return; }
  sprite.style.visibility="";
  sprite.style.backgroundImage="";
  sprite.style.backgroundSize="";
  sprite.style.backgroundPosition="";
  sprite.style.backgroundRepeat="";
  sprite.style.objectFit="";
  if (sprite.dataset.activeSource!==source) {
    sprite.style.position="";
    sprite.style.width="";
    sprite.style.height="";
    sprite.style.left="";
    sprite.style.top="";
    sprite.style.maxWidth="";
    sprite.style.maxHeight="";
    sprite.dataset.cssCroppedSource="";
    sprite.dataset.normalizedSource="";
    sprite.dataset.activeSource=source;
    sprite.dataset.fallbackTried="";
    sprite.classList.remove("sprite-load-failed");
    sprite.onload=()=>{
      sprite.classList.remove("sprite-load-failed");
      sprite.style.visibility="";
      sprite.dataset.fallbackTried="";
      if(source.includes("#frame=")&&sprite.dataset.normalizedSource!==source){
        let externalFrame=false;
        try {
          externalFrame=new URL(source,APP_BASE_URL).origin!==new URL(APP_BASE_URL).origin;
        } catch {}
        const normalized=normalizeEnemyBattleSprite(sprite,source,element);
        if(normalized){
          sprite.dataset.normalizedSource=source;
          sprite.src=normalized;
          return;
        }
        if(externalFrame&&applyCssEnemySpriteFrame(element,sprite,source)){
          sprite.dataset.normalizedSource=source;
          return;
        }
      }
      if(element.dataset.unitType==="axe-cat"&&sprite.dataset.normalizedSource!==source){
        const normalized=normalizeAxeCatBattleSprite(sprite,source);
        if(normalized){
          sprite.dataset.normalizedSource=source;
          sprite.src=normalized;
          return;
        }
      }
    };
    sprite.onerror=()=>{
      if (!sprite.dataset.fallbackTried) {
        sprite.dataset.fallbackTried="1";
        try {
          const fallbackUrl=new URL(source);
          if(fallbackUrl.searchParams.has("v")) {
            fallbackUrl.searchParams.delete("v");
            sprite.src=fallbackUrl.href;
            return;
          }
        } catch {}
      }
      sprite.onerror=null;
      sprite.classList.add("sprite-load-failed");
      console.warn("Battle Cats sprite could not load:",source);
    };
    if(element.dataset.unitType==="axe-cat") sprite.crossOrigin="anonymous";
    sprite.src=source;
  }
}
function calculateBattleLayoutMetrics() {
  const screen=stage.querySelector(".fight-screen");
  const screenRect=screen&&screen.getBoundingClientRect();
  const width=(screenRect&&screenRect.width)||window.innerWidth||1000;
  const geometryFor=(side)=>{
    const base=screen&&screen.querySelector(side==="cat"?".player-castle":".enemy-castle");
    const rect=base&&base.getBoundingClientRect();
    if(screenRect&&screenRect.width>0&&rect&&rect.width>0) {
      return {center:(rect.left+rect.width/2-screenRect.left)/screenRect.width*100,halfWidth:rect.width/2/screenRect.width*100};
    }
    return side==="cat"?{center:94.5,halfWidth:3.5}:{center:6,halfWidth:3.5};
  };
  const sampleUnit=screen&&screen.querySelector(".fight-unit");
  const sampleRect=sampleUnit&&sampleUnit.getBoundingClientRect();
  const fallbackUnitWidth=width<=650
    ? Math.max(42,Math.min(68,width*0.11))
    : Math.max(54,Math.min(96,width*0.073));
  const unitWidth=sampleRect&&sampleRect.width>0?sampleRect.width:fallbackUnitWidth;
  return {
    width,
    catBase:geometryFor("cat"),
    enemyBase:geometryFor("enemy"),
    unitWidth,
    contactGap:((unitWidth*0.62+unitWidth*0.72)*0.5/width)*100
  };
}
function battleLayoutMetrics() {
  if(!battleState) return calculateBattleLayoutMetrics();
  if(!battleState.layoutMetrics) battleState.layoutMetrics=calculateBattleLayoutMetrics();
  return battleState.layoutMetrics;
}
function refreshBattleLayoutMetrics() {
  if(battleState) battleState.layoutMetrics=calculateBattleLayoutMetrics();
}
function battleBaseGeometry(side) {
  const metrics=battleLayoutMetrics();
  return side==="cat"?metrics.catBase:metrics.enemyBase;
}
function battleBaseCenterPercent(side) {
  return battleBaseGeometry(side).center;
}
function battleBaseContactPercent(side) {
  const metrics=battleLayoutMetrics();
  const geometry=side==="cat"?metrics.catBase:metrics.enemyBase;
  const unitHalf=metrics.unitWidth/2/metrics.width*100;
  if(side==="cat") return Math.max(2,geometry.center-geometry.halfWidth-unitHalf-0.3);
  return Math.min(98,geometry.center+geometry.halfWidth+unitHalf+0.3);
}
function battleRangePercent(range) {
  const width=battleLayoutMetrics().width;
  return Math.max(0.5,Math.min(45,(Math.max(0,Number(range)||0)/width)*100));
}
function battleEntityContactGapPercent(first=null,second=null) {
  const metrics=battleLayoutMetrics();
  if(!first||!second) return metrics.contactGap;
  const spriteScale=entity=>{
    if(entity.kind==="doge") return 0.72;
    return battleUnitKey(entity.name||entity.assetFolder||entity.spriteFolder||"cat")==="tank-cat" ? 0.76 : 0.62;
  };
  const combinedHalfWidth=metrics.unitWidth*(spriteScale(first)+spriteScale(second))*0.5;
  const safetyMargin=Math.max(10,metrics.unitWidth*0.2);
  return Math.max(metrics.contactGap,((combinedHalfWidth+safetyMargin)/metrics.width)*100);
}
function battleCombatReachPercent(range,attacker=null,target=null) {
  const metrics=battleLayoutMetrics();
  const visualContactReach=attacker&&target
    ? battleEntityContactGapPercent(attacker,target)+0.3
    : metrics.contactGap;
  const statReach=Math.max(0.5,Math.min(45,(Math.max(0,Number(range)||0)/metrics.width)*100));
  return Math.max(statReach,metrics.contactGap,visualContactReach);
}
function applyBattleLevelVisuals() {
  if(scene!=="fight"||!battleState) return;
  const levelName=battleState.levelName||battleLevelName||"Korea";
  const config=battleState.levelConfig||defaultBattleLevelConfig(levelName);
  const folder="Levels/"+levelName+"/";
  const apply=(selector,file,label)=>{
    const image=stage.querySelector(selector);
    if(!image) return;
    image.onerror=()=>{
      image.onerror=null;
      image.style.display="none";
      console.warn("Battle Cats level "+label+" could not load:",folder+file);
    };
    image.style.display="";
    image.src=battleAssetUrl(folder+file);
  };
  apply(".fight-background-art",config.background,"backdrop");
  apply(".enemy-castle",config.enemyBase,"enemy base");
}
function attemptBattleEnemySpawn(state) {
  if(!state||!state.levelReady||state.enemyBaseHp<=0) return;
  const configuredLimit=Number(state.levelConfig&&state.levelConfig.maxEnemies);
  const totalLimit=Math.max(1,Math.floor(Number.isFinite(configuredLimit)&&configuredLimit>0?configuredLimit:6));
  const rules=state.spawnRules||[];
  const prioritySpawnPending=rules.some(rule=>
    rule&&rule.priority===true&&!rule.triggered&&(rule.infinite===true||rule.spawned<rule.amount)
  );
  const normalSpawnLimit=prioritySpawnPending?Math.max(1,totalLimit-1):totalLimit;
  for(const rule of rules) {
    if(!rule||!rule.enemy) continue;
    const hasBaseTrigger=rule.baseHealthPercent!==null&&rule.baseHealthPercent!==undefined;
    if(hasBaseTrigger&&!rule.triggered) {
      const baseMaximum=Math.max(1,Number(state.enemyBaseMaxHp)||Number(state.levelConfig&&state.levelConfig.enemyBaseHealth)||1);
      const basePercent=(Number(state.enemyBaseHp)||0)/baseMaximum*100;
      const baseHealthReached=basePercent<=Number(rule.baseHealthPercent);
      const hasTimedFallback=rule.fallbackAfterSeconds!==null&&rule.fallbackAfterSeconds!==undefined;
      const timedFallbackReached=hasTimedFallback&&Number.isFinite(Number(rule.fallbackAfterSeconds))&&
        state.elapsed+0.0001>=Number(rule.fallbackAfterSeconds);
      if(!baseHealthReached&&!timedFallbackReached) continue;
      rule.triggered=true;
      rule.nextAttemptAt=state.elapsed;
    }
    if(hasBaseTrigger&&!rule.triggered) continue;
    if(!rule.infinite&&rule.spawned>=rule.amount) continue;
    if(state.elapsed+0.0001<Number(rule.nextAttemptAt)) continue;
    const aliveOfType=state.enemies.filter(enemy=>enemy.enemyType===rule.enemy&&enemy.hp>0&&enemy.mode!=="dead").length;
    const totalAlive=state.enemies.filter(enemy=>enemy.hp>0&&enemy.mode!=="dead").length;
    const spawnLimit=rule.priority===true?totalLimit:normalSpawnLimit;
    if(aliveOfType<rule.maxAlive&&totalAlive<spawnLimit&&Math.random()<=rule.spawnChance) {
      const key=rule.enemy+"-"+state.nextEnemyKey++;
      state.enemies.push(createBattleEnemy(rule.enemy,key,battleBaseCenterPercent("enemy"),state.nextEnemyKey));
      rule.spawned++;
    }
    rule.nextAttemptAt=state.elapsed+rule.intervalMin+Math.random()*(rule.intervalMax-rule.intervalMin);
  }
}
function spawnPlayerCat(unit) {
  if (!battleState || battleState.ended) return;
  const stats = battleUnitStats(unit);
  const cost = stats.price;
  const cooldown = Number(battleState.cooldowns[unit.id]||0);
  if (battleState.money < cost) return notify("Not enough money to deploy "+unit.name+".");
  if (cooldown > 0.05) return notify(unit.name+" is recharging.");
  battleState.money -= cost;
  battleState.cooldowns[unit.id] = stats.recharge;
  battleState.cooldownWasActive[String(unit.id)] = stats.recharge > 0.05;
  const walkSpeedModifier = [0,2,-2][Math.floor(Math.random()*3)];
  const entity = {
    key:"cat-"+battleState.nextUnitKey++,kind:"cat",unitId:unit.id,name:unit.name,
    x:battleBaseCenterPercent("cat"),walkSpeedModifier,statsSnapshot:{...stats},baseSpeed:stats.speed,
    hp:stats.health,maxHp:stats.health,attackPower:stats.damage,areaAttack:Number(stats.areaAttack)||0,
    AttackTrait:stats.AttackTrait,AttackBoost:stats.AttackBoost,traits:stats.traits,
    speed:Math.max(1,stats.speed+walkSpeedModifier),range:stats.range,spriteChangeSpeed:stats.spriteChangeSpeed,attackCooldown:stats.attackCooldown,
    attackIntervalScale:0.9+Math.random()*0.2,hasEnteredCombatRange:false,nextAttackAt:0,currentTargetKey:"",enemyBaseHoldX:undefined,recharge:stats.recharge,mode:"moving",
    animUntil:0,attackEndsAt:0,hitUntil:0,frameAt:0,walkStartedAt:battleState.elapsed,attackStartedAt:0,
    knockbackThresholdPercent:stats.knockbackThresholdPercent,
    knockbackDurationSetting:stats.knockbackDuration,knockbackDistanceSetting:stats.knockbackDistance,
    knockbackLimit:stats.knockbackCount,
    nextKnockbackHp:stats.health*(stats.knockbackCount>0?stats.knockbackCount/(stats.knockbackCount+1):0),queuedKnockbacks:0,
    knockbackCount:0
  };
  battleState.playerUnits.push(entity);
  ensureBattleEntityNode(entity);
  updateBattleEntityView(entity);
  updateFightUI();
}
function beginBattleKnockback(target,lethal,now) {
  if (!target || target.mode==="dead") return;
  const stats = battleStatsForEntity(target);
  target.mode = lethal ? "dead" : "knockback";
  target.knockbackElapsed = 0;
  target.knockbackDuration = lethal ? 0.68 : stats.knockbackDuration;
  target.knockbackOriginX = Number(target.x)||0;
  target.knockbackDirection = target.kind==="cat" ? 1 : -1;
  target.knockbackDistance = lethal ? stats.knockbackDistance*1.4 : stats.knockbackDistance;
  target.attackTimer = 0;
  target.hitUntil = 0;
  target.animUntil = 0;
  target.attackEndsAt = 0;
  if(lethal) {
    target.pendingAttackAt=0;
    target.pendingAttackTargetKey="";
    target.pendingAttackBase="";
    target.attackSoundPending=false;
    target.attackHitLanded=false;
    target.queuedKnockbacks=0;
  }
  updateBattleEntityView(target);
}
function advanceBattleKnockback(deltaSeconds) {
  if (!battleState) return;
  const dt = Math.max(0,Number(deltaSeconds)||0.1);
  const players = battleState.playerUnits||[];
  const enemies = battleState.enemies||[];
  const entities = [...players,...enemies];
  for (const entity of entities) {
    if (entity.mode!=="knockback" && entity.mode!=="dead") continue;
    entity.knockbackElapsed = (Number(entity.knockbackElapsed)||0)+dt;
    const duration = Math.max(0.01,Number(entity.knockbackDuration)||0.64);
    const progress = Math.min(1,entity.knockbackElapsed/duration);
    const easeOut = 1-Math.pow(1-progress,2);
    entity.x = (Number(entity.knockbackOriginX)||0)+(Number(entity.knockbackDirection)||1)*(Number(entity.knockbackDistance)||4.5)*easeOut;
    if (entity.kind==="cat") entity.x=Math.min(battleBaseCenterPercent("cat"),entity.x);
    else entity.x=Math.max(battleBaseCenterPercent("enemy"),entity.x);
    if (entity.mode==="knockback" && progress>=1) {
      if ((Number(entity.queuedKnockbacks)||0)>0) {
        entity.queuedKnockbacks = Math.max(0,Number(entity.queuedKnockbacks)-1);
        beginBattleKnockback(entity,false,battleState.elapsed);
      } else {
        entity.mode="moving";
        entity.knockbackElapsed=0;
        entity.attackTimer=0;
      }
    }
    if(battleState.ended) updateBattleEntityView(entity);
  }
  const expired = entities.filter(entity=>entity.mode==="dead" && entity.knockbackElapsed>=(Number(entity.knockbackDuration)||0.68));
  for (const entity of expired) {
    updateBattleEntityView(entity);
    if (enemies.includes(entity) && entity.kind==="doge" && !entity.rewardPaid) {
      const reward = Math.max(0,Number(entity.killReward)||25);
      battleState.money = Math.min(Number(battleState.maxMoney)||150,(Number(battleState.money)||0)+reward);
      entity.rewardPaid=true;
    }
    createBattleDeathSoul(entity);
    const node=stage.querySelector('[data-battle-entity="'+entity.key+'"]');
    if (node) node.remove();
  }
  battleState.enemies=enemies.filter(entity=>!expired.includes(entity));
  battleState.playerUnits=players.filter(entity=>!expired.includes(entity));
}
function damageBattleEntity(target,amount,now){
  if(!target||target.mode==="dead"||!battleState)return;
  const damage=Math.max(0,Number(amount)||0);if(!damage)return;
  const maxHp=Math.max(1,Number(target.maxHp)||1);
  target.hp=Math.max(0,(Number(target.hp)||0)-damage);
  const hitTime=Number.isFinite(Number(now))?Number(now):battleState.elapsed;
  if(target.hp<=0){beginBattleKnockback(target,true,hitTime);return;}
  const isCat=target.kind==="cat";
  const knockbackLimit=isCat?Math.max(0,Math.floor(Number(target.knockbackLimit??battleStatsForEntity(target).knockbackCount??3))):0;
  let threshold=Number.isFinite(Number(target.nextKnockbackHp))
    ? Number(target.nextKnockbackHp)
    : (isCat?maxHp*(knockbackLimit>0?knockbackLimit/(knockbackLimit+1):0):maxHp*0.75);
  let crossings=0;
  const thresholdStep=isCat?maxHp/(knockbackLimit+1):maxHp*0.25;
  while(threshold>0&&target.hp<=threshold&&(!isCat||(Number(target.knockbackCount)||0)+crossings<knockbackLimit)){
    crossings++;
    threshold-=thresholdStep;
  }
  if(isCat) target.knockbackCount=Math.min(knockbackLimit,(Number(target.knockbackCount)||0)+crossings);
  target.nextKnockbackHp=threshold;
  if(target.mode==="knockback"){
    if(isCat&&crossings>0) target.queuedKnockbacks=Math.max(0,Number(target.queuedKnockbacks)||0)+crossings;
    return;
  }
  if(crossings>0){
    target.queuedKnockbacks=Math.max(0,crossings-1);
    beginBattleKnockback(target,false,hitTime);
    return;
  }
  if(isCat){
    const attackStillPlaying=Number(target.attackEndsAt)>hitTime+0.0001;
    target.hitUntil=0;
    if(!attackStillPlaying){
      target.mode="idle";
      target.animUntil=0;
      target.attackEndsAt=0;
    }
    updateBattleEntityView(target);
    return;
  }
  const attackStillPlaying=Number(target.attackEndsAt)>hitTime+0.0001;
  target.hitUntil=Math.max(Number(target.hitUntil)||0,hitTime+0.18);
  if(!attackStillPlaying){
    target.attackEndsAt=0;
    target.mode="damaged";
    target.animUntil=target.hitUntil;
  }
  updateBattleEntityView(target);
}
function battleAttackAnimationDuration(attacker,fallbackDuration=0.6) {
  const unit=attacker.kind==="cat"
    ? save.units.find(item=>String(item.id)===String(attacker.unitId)) || "cat"
    : (attacker.enemyType || "doge");
  const key=battleUnitKey(unit);
  const assets=BATTLE_ASSETS[key] || (attacker.kind==="cat" ? BATTLE_ASSETS.cat : BATTLE_ASSETS.doge);
  const frames=Array.isArray(assets.attacks) ? assets.attacks : [];
  if(typeof assets.attackSprite==="string"&&assets.attackSprite.trim()) return Math.max(0.1,Number(assets.attackDuration)||fallbackDuration);
  const frameRate=Math.max(1,Math.min(30,Number(assets.attackFrameRate)||BATTLE_ATTACK_FRAME_RATE));
  return frames.length ? frames.length/frameRate : Math.max(0.1,Number(assets.attackDuration)||fallbackDuration);
}
function startBattleAttack(attacker,now,cooldown,animationDuration,target=null,baseTarget="") {
  if (!attacker || attacker.mode==="dead" || attacker.mode==="knockback" ||
      Number(attacker.nextAttackAt)>now+0.0001 ||
      Number(attacker.attackEndsAt)>now+0.0001 ||
      Number(attacker.pendingAttackAt)>0) return false;
  attacker.attackCycleId=(Number(attacker.attackCycleId)||0)+1;
  attacker.attackStartedAt=now;
  const intervalScale=Math.max(0.8,Math.min(1.2,Number(attacker.attackIntervalScale)||1));
  const attackCooldown=Math.max(0.1,cooldown*intervalScale+Math.random()*0.08);
  attacker.attackTimer=attackCooldown;
  attacker.nextAttackAt=now+attackCooldown;
  attacker.animUntil=now+animationDuration;
  attacker.attackEndsAt=attacker.animUntil;
  attacker.attackSoundPending=true;
  attacker.attackHitLanded=false;
  attacker.pendingAttackAt=now+Math.max(0.1,animationDuration*0.62);
  attacker.pendingAttackTargetKey=target ? target.key : "";
  attacker.pendingAttackBase=baseTarget;
  attacker.pendingAttackDamage=Number(attacker.attackPower)||8;
  attacker.mode="attack";
  return true;
}
function battleAreaAttackTargets(attacker,candidates) {
  const mode=Math.max(0,Math.min(2,Math.floor(Number(attacker&&attacker.areaAttack)||0)));
  const reachable=(candidates||[])
    .filter(target=>target&&Number(target.hp)>0&&target.mode!=="dead"&&target.mode!=="knockback")
    .map(target=>({
      target,
      gap:battleTargetGap(attacker,target),
      distance:Math.abs(battleTargetGap(attacker,target)),
      reach:battleCombatReachPercent(attacker.range,attacker,target)
    }))
    .filter(item=>item.gap>=-0.0001&&item.distance<=item.reach+0.0001)
    .sort((first,second)=>first.distance-second.distance);
  if(!reachable.length) return [];
  const frontline=reachable[0];
  if(mode===0) return [frontline.target];
  const frontlineBand=Math.max(0.65,battleEntityContactGapPercent(attacker,frontline.target)*0.6);
  const splashBand=mode===1
    ? frontlineBand
    : Math.max(frontlineBand,Math.min(10,battleRangePercent(attacker.range)*0.65));
  return reachable
    .filter(item=>item.distance<=frontline.distance+splashBand+0.0001)
    .map(item=>item.target);
}
function resolveBattleAttackOnce(attacker,target,damage,now) {
  if (!attacker || !target || !Number(attacker.attackCycleId)) return false;
  const cycle=attacker.attackCycleId;
  if(Number(attacker.areaAttack)>0) {
    if(!attacker.areaAttackResolvedTargets || attacker.areaAttackResolvedTargets.cycle!==cycle) {
      attacker.areaAttackResolvedTargets={cycle,targets:{}};
    }
    if(attacker.areaAttackResolvedTargets.targets[target.key]) return false;
    attacker.areaAttackResolvedTargets.targets[target.key]=true;
  } else {
    if(attacker.lastResolvedAttackCycle===cycle) return false;
    attacker.lastResolvedAttackCycle=cycle;
  }
  damageBattleEntity(target,damage,now);
  return true;
}
function finishBattleAttackSounds(now) {
  if(!battleState) return;
  const entities=[...(battleState.playerUnits||[]),...(battleState.enemies||[])];
  for(const attacker of entities) {
    if(!attacker.attackSoundPending ||
       Number(attacker.attackEndsAt)>now+0.0001 ||
       Number(attacker.pendingAttackAt)>0) continue;
    attacker.attackSoundPending=false;
    if(attacker.attackHitLanded) playSfx(Math.random()<0.5?"attack1":"attack2");
    attacker.attackHitLanded=false;
  }
}
function shakeBattleBase(side) {
  const base=stage.querySelector(side==="enemy"?".enemy-castle":".player-castle");
  if(!base) return;
  base.classList.remove("is-being-attacked");
  void base.offsetWidth;
  base.classList.add("is-being-attacked");
  base.addEventListener("animationend",()=>{
    base.classList.remove("is-being-attacked");
  },{once:true});
}
function resolvePendingBattleAttacks(now) {
  if (!battleState) return;
  const entities=[...(battleState.playerUnits||[]),...(battleState.enemies||[])];
  for (const attacker of entities) {
    const strikeAt=Number(attacker.pendingAttackAt)||0;
    if (!strikeAt || now+0.0001<strikeAt) continue;
    const targetKey=attacker.pendingAttackTargetKey;
    const baseTarget=attacker.pendingAttackBase;
    const damage=Number(attacker.pendingAttackDamage)||Number(attacker.attackPower)||8;
    attacker.pendingAttackAt=0;
    attacker.pendingAttackTargetKey="";
    attacker.pendingAttackBase="";
    if (attacker.mode==="dead" || Number(attacker.hp)<=0) continue;

    if(targetKey) {
      const candidates=attacker.kind==="cat"?battleState.enemies:battleState.playerUnits;
      let targets=[];
      const areaMode=Math.max(0,Math.min(2,Math.floor(Number(attacker.areaAttack)||0)));
      const currentTarget=findBattleTargetFor(attacker);
      if(areaMode>0) {
        targets=battleAreaAttackTargets(attacker,candidates);
      } else if(currentTarget&&currentTarget.mode!=="knockback") {
        const distance=Math.abs(battleTargetGap(attacker,currentTarget));
        if(distance<=battleCombatReachPercent(attacker.range,attacker,currentTarget)+0.0001) {
          targets=[currentTarget];
        }
      }
      for(const target of targets) {
        const targetDamage=battleDamageAgainstTarget(attacker,target,damage);
        if(resolveBattleAttackOnce(attacker,target,targetDamage,now)) attacker.attackHitLanded=true;
      }
    } else if(baseTarget&&attacker.lastResolvedAttackCycle!==attacker.attackCycleId) {
      const baseHp=baseTarget==="enemy"?battleState.enemyBaseHp:battleState.catBaseHp;
      if(baseHp>0) {
        attacker.lastResolvedAttackCycle=attacker.attackCycleId;
        if(baseTarget==="enemy") battleState.enemyBaseHp=Math.max(0,battleState.enemyBaseHp-damage);
        else battleState.catBaseHp=Math.max(0,battleState.catBaseHp-damage);
        playSfx("baseAttack");
        shakeBattleBase(baseTarget);
      }
    }
  }
}
function prepareBattleAttackPhase(attacker,now) {
  if(!attacker||attacker.hasEnteredCombatRange) return;
  attacker.hasEnteredCombatRange=true;
  const cooldown=Math.max(0.2,Number(attacker.attackCooldown)||1.2);
  attacker.nextAttackAt=now+Math.random()*Math.min(0.85,cooldown*0.7);
}
function attackBattleBase(attacker,now) {
  if (!attacker || attacker.mode==="dead" || attacker.mode==="knockback") return false;
  prepareBattleAttackPhase(attacker,now);
  if(Number(attacker.nextAttackAt)>now+0.0001) return false;
  const baseTarget=attacker.kind==="cat"?"enemy":"cat";
  const contact=battleBaseContactPercent(baseTarget);
  const reach=battleRangePercent(attacker.range);
  if(attacker.kind==="cat"?attacker.x>contact+reach+0.25:attacker.x<contact-reach-0.25) return false;
  const stats=battleStatsForEntity(attacker);
  const duration=battleAttackAnimationDuration(attacker,attacker.kind==="cat"?0.62:0.55);
  return startBattleAttack(attacker,now,attacker.attackCooldown||stats.attackCooldown,duration,null,baseTarget);
}
function enforceBattleContactSeparation() {
  if(!battleState) return;
  const cats=battleState.playerUnits||[];
  const enemies=battleState.enemies||[];
  for(const cat of cats) {
    if(!cat||Number(cat.hp)<=0||cat.mode==="dead") continue;
    for(const enemy of enemies) {
      if(!enemy||Number(enemy.hp)<=0||enemy.mode==="dead") continue;
      const requiredGap=battleEntityContactGapPercent(cat,enemy)+0.45;
      const currentGap=Number(cat.x)-Number(enemy.x);
      if(currentGap>=requiredGap) continue;
      let overlap=requiredGap-currentGap;
      const catRoom=Math.max(0,battleBaseCenterPercent("cat")-Number(cat.x));
      const enemyRoom=Math.max(0,Number(enemy.x)-battleBaseCenterPercent("enemy"));
      const catPush=Math.min(catRoom,overlap*0.5);
      cat.x+=catPush;
      overlap-=catPush;
      const enemyPush=Math.min(enemyRoom,overlap);
      enemy.x-=enemyPush;
      overlap-=enemyPush;
      if(overlap>0) cat.x=Math.min(battleBaseCenterPercent("cat"),cat.x+overlap);
      if(cat.mode==="moving") cat.mode="idle";
      if(enemy.mode==="moving") enemy.mode="idle";
      updateBattleEntityView(cat);
      updateBattleEntityView(enemy);
    }
  }
}
function tickBattle() {
  if (scene!=="fight" || !battleState) return;
  const state=battleState;
  refreshBattleLayoutMetrics();
  const tickAt=performance.now();
  const previousTickAt=Number(state.lastTickAt)||tickAt;
  const realDt=Math.max(0.001,Math.min(0.12,(tickAt-previousTickAt)/1000));
  const speedMultiplier=Number(state.speedMultiplier)===2?2:1;
  const dt=Math.min(0.12,realDt*speedMultiplier);
  state.lastTickAt=tickAt;
  state.elapsed+=dt;
  advanceBattleKnockback(dt);
  updateBattleDeathSouls(dt);
  if(state.ended) return;
  state.money=Math.min(state.maxMoney,state.money+(2.6+Math.max(0,(Number(state.workerLevel)||1)-1)*0.25)*dt);
  Object.keys(state.cooldowns).forEach(key=>state.cooldowns[key]=Math.max(0,state.cooldowns[key]-dt));

  attemptBattleEnemySpawn(state);

  const now=state.elapsed;
  resolvePendingBattleAttacks(now);
  finishBattleAttackSounds(now);
  const enemyBaseStop=battleBaseContactPercent("enemy");
  const catBaseStop=battleBaseContactPercent("cat");
  const catHomeCenter=battleBaseCenterPercent("cat");
  const enemyHomeCenter=battleBaseCenterPercent("enemy");

  for (const cat of state.playerUnits) {
    if (cat.mode==="dead" || cat.mode==="knockback") { updateBattleEntityView(cat); continue; }
    if (cat.hp<=0) continue;
    cat.attackTimer=Math.max(0,cat.attackTimer-dt);
    const attackActive=Number(cat.attackEndsAt)>now+0.0001;
    if (attackActive) cat.mode="attack";
    else if (cat.hitUntil>now) cat.mode="damaged";
    else cat.mode="idle";

    const target=findBattleTargetFor(cat);

    if(target&&target.mode==="knockback") {
      cat.mode="idle";
    } else if(attackActive) {
      cat.mode="attack";
    } else if(target) {
      const distance=Math.abs(battleTargetGap(cat,target));
      const reach=battleCombatReachPercent(cat.range,cat,target);
      const targetIsInsideEnemyBase=Number(target.x)<=enemyBaseStop+0.1;
      const baseHoldX=targetIsInsideEnemyBase?battleEnemyBaseHoldPosition(cat,enemyHomeCenter):enemyBaseStop;
      const targetApproachStop=targetIsInsideEnemyBase
        ? Math.max(baseHoldX,Number(target.x)+reach)
        : Math.max(enemyBaseStop,Number(target.x)+reach);

      if(distance>reach) {
        cat.rangeHoldX=null;
        const targetGap=battleTargetGap(cat,target);
        if(targetGap>0) {
          cat.x=Math.max(targetApproachStop,cat.x-(cat.speed*0.45)*dt);
          const distanceAfterMove=Math.abs(battleTargetGap(cat,target));
          if(distanceAfterMove<=reach+0.0001) {
            cat.mode="idle";
            prepareBattleAttackPhase(cat,now);
            const catStats=battleStatsForEntity(cat);
            const attackDuration=battleAttackAnimationDuration(cat,0.62);
            if(now+0.0001>=Number(cat.nextAttackAt||0)) {
              startBattleAttack(cat,now,cat.attackCooldown||catStats.attackCooldown,attackDuration,target);
            }
          } else {
            cat.mode=cat.x<=targetApproachStop+0.15?"idle":"moving";
          }
        } else {
          cat.mode="idle";
        }
      } else {
        cat.mode="idle";
        if(typeof cat.rangeHoldX!=="number"||!Number.isFinite(cat.rangeHoldX)) cat.rangeHoldX=cat.x;
        prepareBattleAttackPhase(cat,now);
        const catStats=battleStatsForEntity(cat);
        const attackDuration=battleAttackAnimationDuration(cat,0.62);
        if(now+0.0001>=Number(cat.nextAttackAt||0)) {
          startBattleAttack(cat,now,cat.attackCooldown||catStats.attackCooldown,attackDuration,target);
        }
      }
      const targetSideStop=targetIsInsideEnemyBase?baseHoldX:enemyBaseStop;
      const heldRangePosition=typeof cat.rangeHoldX==="number"&&Number.isFinite(cat.rangeHoldX)?cat.rangeHoldX:cat.x;
      cat.x=Math.max(targetSideStop,Math.min(catHomeCenter,heldRangePosition));
    } else if (state.enemyBaseHp>0) {
      cat.rangeHoldX=null;
      const catBaseAttackStop=enemyBaseStop+battleRangePercent(cat.range)*0.1;
      if (cat.x>catBaseAttackStop) {
        cat.mode="moving";
        cat.x=Math.max(catBaseAttackStop,cat.x-(cat.speed*0.45)*dt);
      } else if (now+0.0001>=Number(cat.nextAttackAt||0)) {
        if (!attackBattleBase(cat,now)) cat.mode="idle";
      } else {
        cat.mode="idle";
      }
    }
    updateBattleEntityView(cat);
  }

  state.enemies=state.enemies.filter(enemy=>enemy.hp>0 || enemy.mode==="dead" || enemy.mode==="knockback");
  for (const enemy of state.enemies) {
    if (enemy.mode==="dead" || enemy.mode==="knockback") { updateBattleEntityView(enemy); continue; }
    enemy.attackTimer=Math.max(0,enemy.attackTimer-dt);
    const attackActive=Number(enemy.attackEndsAt)>now+0.0001;
    if (attackActive) enemy.mode="attack";
    else if (enemy.hitUntil>now) enemy.mode="damaged";
    else enemy.mode="idle";

    const target=findBattleTargetFor(enemy);
    const enemyDistance=target?Math.abs(battleTargetGap(enemy,target)):Infinity;
    const enemyReach=battleCombatReachPercent(enemy.range,enemy,target);

    if(attackActive) {
      enemy.mode="attack";
    } else if(target&&target.mode==="knockback") {
      enemy.mode="idle";
    } else if(target&&enemyDistance<=enemyReach) {
      enemy.mode="idle";
      prepareBattleAttackPhase(enemy,now);
      const enemyStats=battleStatsForEntity(enemy);
      const attackDuration=battleAttackAnimationDuration(enemy,0.55);
      if(now+0.0001>=Number(enemy.nextAttackAt||0)) {
        startBattleAttack(enemy,now,enemy.attackCooldown||enemyStats.attackCooldown,attackDuration,target);
      }
    } else if(target&&enemyDistance>enemyReach) {
      const targetGap=battleTargetGap(enemy,target);
      if(targetGap>0) {
        const desiredStop=Math.min(catBaseStop,Number(target.x)-enemyReach);
        enemy.x=Math.min(desiredStop,enemy.x+Number(enemy.speed||2.8)*dt);
        const distanceAfterMove=Math.abs(battleTargetGap(enemy,target));
        if(distanceAfterMove<=enemyReach+0.0001) {
          enemy.mode="idle";
          prepareBattleAttackPhase(enemy,now);
          const enemyStats=battleStatsForEntity(enemy);
          const attackDuration=battleAttackAnimationDuration(enemy,0.55);
          if(now+0.0001>=Number(enemy.nextAttackAt||0)) {
            startBattleAttack(enemy,now,enemy.attackCooldown||enemyStats.attackCooldown,attackDuration,target);
          }
        } else {
          enemy.mode=enemy.x>=desiredStop-0.15?"idle":"moving";
        }
      } else {
        enemy.mode="idle";
      }
    }

    if (target) {
      enemy.x=Math.max(enemyHomeCenter,Math.min(catBaseStop,enemy.x));
    } else {
      if (state.catBaseHp>0) {
        if (enemy.x<catBaseStop) {
          enemy.mode="moving";
          enemy.x=Math.min(catBaseStop,enemy.x+Number(enemy.speed||2.8)*dt);
        } else if (now+0.0001>=Number(enemy.nextAttackAt||0)) {
          if (!attackBattleBase(enemy,now)) enemy.mode="idle";
        } else {
          enemy.mode="idle";
        }
      }
    }
    updateBattleEntityView(enemy);
  }


  enforceBattleContactSeparation();
  state.playerUnits=state.playerUnits.filter(cat=>cat.hp>0 || cat.mode==="dead" || cat.mode==="knockback");
  state.enemies=state.enemies.filter(enemy=>enemy.hp>0 || enemy.mode==="dead" || enemy.mode==="knockback");

  if (state.enemyBaseHp<=0) finishBattle("win");
  else if (state.catBaseHp<=0) finishBattle("lose");
  updateFightUI();
}
function finishBattle(result) {
  if (!battleState || battleState.ended) return;
  battleState.ended=result;
  syncMusicForScene("fight");
  playSfx(result==="win"?"victory":"defeat");
  const overlay=stage.querySelector(".fight-result");
  const title=stage.querySelector(".fight-result-title");
  const copy=stage.querySelector(".fight-result-copy");
  const button=stage.querySelector(".fight-result-button");
  if (overlay) overlay.hidden=false;
  if (title) title.textContent=result==="win"?"STAGE CLEAR!":"DEFEAT";
  if (copy) copy.textContent=result==="win"?(battleState.levelName||"Stage")+" cleared! Claim your reward.":"Your Cat Base was destroyed. Try deploying more Cats.";
  if (button) {
    button.textContent=result==="win"?"CONTINUE":"RETRY STAGE";
    button.dataset.go=result==="win"?"win":"retry-battle";
  }
}
function updateFightUI() {
  if (!battleState || scene!=="fight") return;
  const state=battleState;
  const moneyText=stage.querySelector(".fight-money-value");
  const timerText=stage.querySelector(".fight-timer");
  const enemyHpText=stage.querySelector(".fight-enemy-hp");
  const catHpText=stage.querySelector(".fight-cat-hp");
  const enemyBar=stage.querySelector(".fight-enemy-hp-bar span");
  const catBar=stage.querySelector(".fight-cat-hp-bar span");
  const workerButton=stage.querySelector(".fight-worker-cat");
  const workerIcon=stage.querySelector(".fight-worker-icon");
  const workerLevelText=stage.querySelector(".fight-worker-cat-level");
  const workerCostText=stage.querySelector(".fight-worker-cost");
  const workerLevelIndicator=stage.querySelector(".fight-wallet-level-indicator");
  const workerBar=stage.querySelector(".fight-worker-bar span");
  const speedButton=stage.querySelector(".fight-speed-toggle");
  const speedMultiplier=Number(state.speedMultiplier)===2?2:1;
  if(speedButton) {
    speedButton.textContent=speedMultiplier===2?"2× SPEED":"1× SPEED";
    speedButton.setAttribute("aria-pressed",speedMultiplier===2?"true":"false");
    speedButton.disabled=Boolean(state.ended);
    stage.querySelector(".fight-screen")?.classList.toggle("is-speed-up",speedMultiplier===2);
  }
  if (moneyText) {
    const displayedMoney=Math.floor(state.money);
    moneyText.innerHTML=currencyRatioSpriteMarkup(displayedMoney,state.maxMoney);
    moneyText.setAttribute("aria-label","Money "+displayedMoney+" of "+state.maxMoney);
  }
  if (timerText) timerText.textContent=Math.floor(state.elapsed/60).toString().padStart(2,"0")+":"+Math.floor(state.elapsed%60).toString().padStart(2,"0");
  if (enemyHpText) enemyHpText.textContent=Math.ceil(state.enemyBaseHp)+" / "+state.enemyBaseMaxHp;
  if (catHpText) catHpText.textContent=Math.ceil(state.catBaseHp)+" / "+state.catBaseMaxHp;
  if (enemyBar) enemyBar.style.width=Math.max(0,state.enemyBaseHp/state.enemyBaseMaxHp*100)+"%";
  if (catBar) catBar.style.width=Math.max(0,state.catBaseHp/state.catBaseMaxHp*100)+"%";
  const walletLevel=Math.max(1,Number(state.workerLevel)||1);
  const walletCost=50*walletLevel;
  const walletMaxLevel=8;
  if (workerLevelText) workerLevelText.textContent="LEVEL "+walletLevel;
  if (workerCostText) workerCostText.textContent=walletLevel>=walletMaxLevel?"MAX LEVEL":"UPGRADE "+walletCost+"¢";
  if(workerLevelIndicator&&workerLevelIndicator.dataset.level!==String(walletLevel)) {
    workerLevelIndicator.dataset.level=String(walletLevel);
    workerLevelIndicator.innerHTML=walletLevelSpriteMarkup(walletLevel);
    workerLevelIndicator.setAttribute("aria-label",walletLevel>=walletMaxLevel?"Wallet MAX":"Wallet level "+walletLevel);
  }
  const walletAvailable=walletLevel<walletMaxLevel && state.money>=walletCost && !state.ended;
  if(state.walletAvailabilityInitialized && walletAvailable && !state.walletWasAvailable) playSfx("endOfRecharge");
  state.walletAvailabilityInitialized=true;
  state.walletWasAvailable=walletAvailable;
  const walletImagePath=battleAssetUrl(walletAvailable?"sprites/battle/walletup.png":"sprites/battle/walletdown.png");
  if(workerIcon&&workerIcon.dataset.activeSource!==walletImagePath) {
    workerIcon.dataset.activeSource=walletImagePath;
    workerIcon.src=walletImagePath;
  }
  if (workerButton) {
    workerButton.disabled=!walletAvailable;
    workerButton.setAttribute("aria-label",walletLevel>=walletMaxLevel?"Wallet max level":walletAvailable?"Upgrade wallet for "+walletCost+"¢":"Need "+walletCost+"¢ to upgrade wallet");
  }
  if (workerBar) workerBar.style.width=Math.max(0,Math.min(100,state.money/Math.max(1,state.maxMoney)*100))+"%";
  const slots=stage.querySelectorAll("[data-battle-slot]");
  slots.forEach(button=>{
    const id=button.dataset.battleSlot;
    const unit=save.units.find(item=>String(item.id)===id);
    if (!unit) return;
    const stats=battleUnitStats(unit);
    const cost=stats.price;
    const cooldown=Number(state.cooldowns[id]||0);
    const isRecharging=cooldown>0.05;
    const wasRecharging=state.cooldownWasActive[String(id)]===true;
    if(wasRecharging&&!isRecharging) playSfx("endOfRecharge");
    state.cooldownWasActive[String(id)]=isRecharging;
    button.disabled=Boolean(state.ended)||state.money<cost||isRecharging;
    button.classList.toggle("is-recharging",isRecharging);
    const cooldownText=button.querySelector(".fight-slot-cooldown");
    if (cooldownText) cooldownText.textContent=cooldown>0.05?Math.ceil(cooldown):String(cost)+"¢";
    const rechargeFill=button.querySelector(".fight-slot-recharge-fill");
    if (rechargeFill) {
      const progress=cooldown>0.05?Math.max(0,Math.min(100,(1-cooldown/Math.max(0.1,stats.recharge))*100)):100;
      rechargeFill.style.width=progress+"%";
      rechargeFill.parentElement.style.opacity=cooldown>0.05?"1":"0";
    }
    const img=button.querySelector("img");
    if (img) img.src=battleSlotImage(unit);
  });
}

function renderFight() {
  if (!battleState) battleState=createBattleState();
  const selectedLevel=EMPIRE_CHAPTER_ONE[selectedLevelIndex]||EMPIRE_CHAPTER_ONE[0];
  const levelFolder="Levels/"+selectedLevel.name;
  const levelConfig=battleState.levelConfig||defaultBattleLevelConfig(selectedLevel.name);
  const levelBackgroundUrl=battleAssetUrl(levelFolder+"/"+levelConfig.background);
  const enemyBaseUrl=battleAssetUrl(levelFolder+"/"+levelConfig.enemyBase);
  const catBaseUrl=battleAssetUrl("sprites/battle/catbase.png");
  const walletLevel=Math.max(1,Number(battleState.workerLevel)||1);
  const walletAffordable=walletLevel<8 && battleState.money>=50*walletLevel && !battleState.ended;
  const walletImageUrl=battleAssetUrl(walletAffordable?"sprites/battle/walletup.png":"sprites/battle/walletdown.png");
  const cannonImageUrl=battleAssetUrl("sprites/original_sheets/cat-base-accessory-icon.webp");
  const slots=save.units.filter(unit=>save.equipped.includes(unit.id)).map(unit=>{
    const cost=battleUnitStats(unit).price
    const cooldown=Number(battleState.cooldowns[unit.id]||0);
    const disabled=battleState.money<cost||cooldown>0.05||Boolean(battleState.ended);
    return '<button class="fight-unit-slot'+(cooldown>0.05?" is-recharging":"")+'" data-go="deploy:'+unit.id+'" data-battle-slot="'+unit.id+'" aria-label="Deploy '+unit.name+'" '+(disabled?"disabled":"")+'>'+
      '<img src="'+battleSlotImage(unit)+'" alt="" draggable="false">'+
      '<span class="fight-slot-recharge-track" aria-hidden="true"><span class="fight-slot-recharge-fill" style="width:'+(cooldown>0.05?Math.max(0,Math.min(100,(1-cooldown/Math.max(0.1,battleUnitStats(unit).recharge))*100)):100)+'%"></span></span>'+
      '<span class="fight-slot-cooldown">'+(cooldown>0.05?Math.ceil(cooldown):cost+"¢")+'</span>'+
    '</button>';
  }).join("");
  const entities=[...battleState.playerUnits,...battleState.enemies].map(battleEntityMarkup).join("");
  const deathSouls=(battleState.deathSouls||[]).map(battleDeathSoulMarkup).join("");
  return '<section class="screen fight-screen" aria-label="' + selectedLevel.name + ' battle">'+
    '<img class="fight-background-art" src="' + levelBackgroundUrl + '" alt="" draggable="false">'+
    '<div class="fight-sky-wash"></div><div class="fight-ground"></div>'+
    '<button class="fight-back" data-go="go:battle" aria-label="Leave battle">×</button>'+
    '<button class="fight-speed-toggle" data-go="toggle-speed" aria-pressed="false" aria-label="Toggle 2x battle speed">1× SPEED</button>'+
    '<div class="fight-money"><strong class="fight-money-value" aria-label="Money '+Math.floor(battleState.money)+' of '+battleState.maxMoney+'">'+currencyRatioSpriteMarkup(Math.floor(battleState.money),battleState.maxMoney)+'</strong></div>'+
    '<button class="fight-worker-cat" data-go="wallet-upgrade" aria-label="Upgrade wallet">'+
      '<img class="fight-worker-icon" data-active-source="' + walletImageUrl + '" src="' + walletImageUrl + '" alt="" draggable="false">'+
      '<span class="fight-wallet-level-indicator" data-level="'+walletLevel+'" aria-label="Wallet level '+walletLevel+'">'+walletLevelSpriteMarkup(walletLevel)+'</span></button>'+
    '<div class="fight-base-hud fight-enemy-hud"><strong class="fight-enemy-hp">500 / 500</strong></div>'+
    '<div class="fight-base-hud fight-player-hud"><strong class="fight-cat-hp">1000 / 1000</strong></div>'+
    '<img class="fight-base enemy-castle" src="' + enemyBaseUrl + '" alt="" draggable="false">'+
    
    
    '<img class="fight-base player-castle" src="' + catBaseUrl + '" alt="" draggable="false">'+
    '<div class="fight-unit-layer">'+entities+deathSouls+'</div>'+
    '<footer class="fight-bottom">'+
      '<div class="fight-unit-slots">'+(slots||'<div class="fight-no-slots">Equip a Cat to deploy it.</div>')+'</div>'+
      '<button class="fight-cannon" type="button" disabled aria-label="Cat Cannon not implemented yet"><img class="fight-cannon-sprite" src="' + cannonImageUrl + '" alt="" draggable="false"><small>CANNON</small></button>'+
    '</footer>'+
    '<div class="fight-result" hidden><div class="fight-result-panel"><strong class="fight-result-title">STAGE CLEAR!</strong><p class="fight-result-copy">Korea cleared! Claim your reward.</p><button class="fight-result-button" data-go="win">CONTINUE</button></div></div>'+
  '</section>';
}
function renderUpgrade() {
  const body = pageCopy("Each Cat level increases its health and attack power by 13%.")+
    '<h3 style="margin:9px 0 0;text-align:center">CAT UPGRADES</h3>'+
    '<div class="menu-list">'+save.units.map((unit,i)=>{
      const level=Math.max(1,Math.floor(Number(unit.level)||1));
      const current=battleUnitStats(unit);
      const next=battleUnitStats({...unit,level:level+1});
      const cost=(Number(unit.upgradeCost)||100)*level;
      const description="Level "+level+" · HP "+current.health+" → "+next.health+" · ATK "+current.damage+" → "+next.damage+" · Next: "+cost+" XP";
      return row(unit.name,description,"unit:"+i,"UPGRADE");
    }).join("")+'</div>';
  return renderWindow("Upgrade",body,"base");
}
function renderDictionary(equip=false) {
  const body = pageCopy(equip?"Tap a cat to add or remove it from your battle lineup.":"Cats you have discovered are shown here.")+
    '<div class="cat-grid">'+save.units.map((unit,i)=>{
      const isEquipped = save.equipped.includes(unit.id);
      const stats=battleUnitStats(unit);
      const level=Math.max(1,Math.floor(Number(unit.level)||1));
      const unitArt=unit.assetFolder==="axe-cat"
        ? '<img class="cat-head-sprite axe-cat-card-sprite" src="'+battleAssetUrl("Cats/axe-cat/moving/frame-001.png")+'" alt="" draggable="false">'
        : catHead();
      return '<button class="cat-tile" data-go="'+(equip?"equipunit:":"unitinfo:")+i+'"><div class="cat-tile-art">'+unitArt+'</div><strong>'+unit.name+'</strong><small>Level '+level+' · HP '+stats.health+' · ATK '+stats.damage+(equip?(isEquipped?" · Equipped":" · Not equipped"):"")+'</small></button>';
    }).join("")+'</div>';
  if (equip) return renderWindow("Equip Cats",body,"base");
  return renderWindow("Cat Dictionary",body,"base");
}
function renderTreasure() {
  const body = pageCopy("Manage your treasures, rewards, and cat collection.")+
    '<div class="menu-list">'+
      row("Treasure","Collected treasures and chapter progress.","treasurelist")+
      row("Cat Capsules","Use tickets to recruit more cats.","go:capsules")+
      row("Storage","View your items and tickets.","go:storage")+
      row("Missions","Complete goals and claim rewards.","go:missions")+
      row("Gamatoto Expedition","Send Gamatoto to search for items.","go:gamatoto")+
      row("Other Menu","Settings, mailbox, and save controls.","go:menu")+
    '</div>';
  return renderWindow("Treasure",body,"base");
}
function renderGeneric(key) {
  if (key === "capsules") {
    const body = pageCopy("Choose a capsule to draw. Your ticket count is shown on each option.") +
      '<div class="capsule-sprite-options">' +
        '<button class="capsule-sprite-button" data-go="rare" aria-label="Draw Rare Cat Capsule">' +
          '<img class="capsule-option-icon" src="sprites/ui/rarecapsules.png?v=20261026-20" alt="" draggable="false">' +
          '<span class="capsule-option-copy"><strong>Rare Cat Capsule</strong><small>RARE TICKETS: '+save.rareTickets+'</small></span>' +
          '<span class="capsule-option-action">DRAW</span>' +
        '</button>' +
        '<button class="capsule-sprite-button" data-go="normal" aria-label="Draw Normal Cat Capsule">' +
          '<img class="capsule-option-icon" src="sprites/ui/Normalcapsule.png?v=20261026-20" alt="" draggable="false">' +
          '<span class="capsule-option-copy"><strong>Normal Cat Capsule</strong><small>NORMAL TICKETS: '+save.normalTickets+'</small></span>' +
          '<span class="capsule-option-action">DRAW</span>' +
        '</button>' +
      '</div>';
    return renderWindow("Cat Capsules", body, "base");
  }
  const data = {
    treasurelist:["Treasure","Chapter 1 treasures: 1 of 3 collected.",[
      ["Energy drink","A small energy reserve.","noop","VIEW"],
      ["Bronze treasure","A treasure waiting to be collected.","collect","COLLECT"],
      ["Gold treasure","Locked until more stages are cleared.","locked","LOCKED"]
    ]],
    gamatoto:["Gamatoto Expedition","Send Gamatoto away to collect a small demo reward.",[
      ["Start expedition","The expedition is ready to go.","expedition","SEND"],
      ["Collect results","A simulated reward for testing menus.","collect","COLLECT"]
    ]],
    missions:["Missions","Complete a task and collect a reward.",[
      ["Win a stage","Reward: 100 XP.","mission","CLAIM"],
      ["Daily reward","Reward: 300 XP after completing a mission.","daily","CLAIM"]
    ]],
    storage:["Storage","Your current items and resources.",[
      ["Rare Cat Tickets",String(save.rareTickets)+" ticket(s).","noop","VIEW"],
      ["Normal Cat Tickets",String(save.normalTickets)+" ticket(s).","noop","VIEW"],
      ["Cat Food",money(save.catFood)+" cat food.","go:store","STORE"]
    ]],
    capsules:["Cat Capsules","Spend tickets for a random cat.",[
      ["Rare Cat Capsule",String(save.rareTickets)+" rare ticket(s).","rare","DRAW"],
      ["Normal Cat Capsule",String(save.normalTickets)+" normal ticket(s).","normal","DRAW"]
    ]],
    store:["Cat Food Store","This fan demo does not process real-money purchases.",[
      ["Free daily cat food","Claim one free cat food for this demo.","dailyfood","CLAIM"],
      ["Cat Food balance",money(save.catFood)+" cat food available.","noop","OK"]
    ]],
    menu:["Menu","Open the other Cat Base menus here.",[
      ["Cat Guide","View your unlocked cats.","go:dictionary","OPEN"],
      ["Enemy Guide","View enemies you've encountered.","go:enemyguide","OPEN"],
      ["Treasure","View chapter treasure progress.","go:treasure","OPEN"],
      ["Missions","Check demo tasks and rewards.","go:missions","OPEN"],
      ["Gamatoto","Open expedition menu.","go:gamatoto","OPEN"],
      ["Storage","View collected items.","go:storage","OPEN"],
      ["Save game","Save progress on this browser.","save","SAVE"],
      ["Settings","Toggle demo audio settings.","go:settings","OPEN"],
      ["Return to Title","Go back to the title screen.","go:title","OPEN"],
      ["Reset progress","Reset this browser’s demo save.","reset","RESET"]
    ]],
    mailbox:["Mailbox",save.mail?"You have an unopened welcome gift.":"No new messages.",[
      [save.mail?"Welcome Gift":"Welcome Gift · Claimed","Reward: 1,000 XP.","mailgift",save.mail?"CLAIM":"CLAIMED"]
    ]],
    settings:["Settings","Settings are saved on this device.",[
      ["Sound Effects",save.sound?"On":"Off","sound",save.sound?"ON":"OFF"],
      ["Music",save.music?"On":"Off","music",save.music?"ON":"OFF"],
      ["Save Progress","Save your current demo progress.","save","SAVE"],
      ["Reset Progress","Erase this browser’s demo save.","reset","RESET"]
    ]],
    enemyguide:["Enemy Guide","Enemies will appear here as the chapter and battle systems are added.",[
      ["Back to Menu","Return to the Cat Base menu list.","go:menu","BACK"]
    ]],
    about:["About","An unofficial browser fan remake. Original Battle Cats art, sound, and full battle mechanics are not included in this menu demo.",[
      ["Return to Title","Back to the title screen.","go:title","BACK"]
    ]]
  };
  const entry = data[key] || data.menu;
  const body = pageCopy(entry[1])+'<div class="menu-list">'+entry[2].map(item=>row(item[0],item[1],item[2],item[3])).join("")+'</div>';
  const back = key==="settings"||key==="mailbox"||key==="about"?"title":"base";
  return renderWindow(entry[0],body,back);
}
function render() {
  let html;
  switch(scene) {
    case "loading": html=renderLoading(); break;
    case "intro": html=renderIntro(); break;
    case "title": html=renderTitle(); break;
    case "chapters": html=renderChapterSelect(); break;
    case "base": html=renderBase(); break;
    case "battle": html=renderBattle(); break;
    case "stage": html=renderStage(); break;
    case "fight": html=renderFight(); break;
    case "upgrade": html=renderUpgrade(); break;
    case "equip": html=renderDictionary(true); break;
    case "dictionary": html=renderDictionary(false); break;
    case "treasure": html=renderTreasure(); break;
    default: html=renderGeneric(scene);
  }
  stage.innerHTML = html;
  if (scene==="stage") {
    const list=stage.querySelector(".world-country-list");
    const selectedRow=stage.querySelector(".world-country-row.is-selected");
    if(list&&selectedRow) {
      const rowLeft=selectedRow.offsetLeft-list.offsetLeft;
      const rowRight=rowLeft+selectedRow.offsetWidth;
      if(rowRight>list.scrollLeft+list.clientWidth) list.scrollLeft=rowRight-list.clientWidth+14;
      else if(rowLeft<list.scrollLeft) list.scrollLeft=rowLeft-14;
    }
    if(list) list.addEventListener("wheel",event=>{
      if(list.scrollWidth>list.clientWidth) {
        event.preventDefault();
        list.scrollLeft+=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
      }
    },{passive:false});
  }
  if(scene==="fight") {
    const fightBackground=stage.querySelector(".fight-background-art");
    if(fightBackground) fightBackground.addEventListener("error",()=>{
      if(!fightBackground.dataset.fallback) {
        fightBackground.dataset.fallback="1";
        fightBackground.src="Levels/Korea/background.png?v=20261028-12";
      }
    },{once:true});
    const playerCastle=stage.querySelector(".player-castle");
    if(playerCastle) playerCastle.addEventListener("error",()=>{
      if(!playerCastle.dataset.fallback) {
        playerCastle.dataset.fallback="1";
        playerCastle.style.display="";
        playerCastle.src="Levels/Korea/cat-base.png?v=20261028-12";
      }
    },{once:true});
  }
  if (scene==="fight") startBattleRuntime(); else if (battleTimer!==null || battleState) stopBattleRuntime();
  const worldMapArt = stage.querySelector(".world-map-art-background");
  if (worldMapArt) worldMapArt.addEventListener("error", () => {
    worldMapArt.src = "https://static.wikia.nocookie.net/battle-cats/images/7/71/EOC_map.png/revision/latest?cb=20211025210429";
  }, {once:true});
  const loadingScreen = stage.querySelector(".loading-screen");
  if (loadingScreen) loadingScreen.addEventListener("animationend", event => {
    if (event.target === loadingScreen && scene === "loading" && loadingScreen.classList.contains("loading-fading-out")) {
      introFadeFromBlack = true;
      scene = "intro";
      render();
    }
  });
  const chapterScreen = stage.querySelector(".chapter-select-screen");
  if (chapterScreen) chapterScreen.addEventListener("animationend", event => {
    if (event.target === chapterScreen && scene === "chapters" && chapterScreen.classList.contains("chapter-leaving")) {
      const destination = chapterLeavingDestination || "base";
      chapterLeavingDestination = "";
      if (destination === "base") baseFadeFromBlack = true;
      if (destination === "title") titleFadeFromBlack = true;
      navigate(destination);
    }
  });
  const introStory = stage.querySelector(".intro-story");
  if (introStory) introStory.addEventListener("animationend", () => {
    if (scene === "intro" && introStory.isConnected) leaveIntro();
  }, {once:true});
  const introScreen = stage.querySelector(".intro-screen");
  if (introScreen) {
    introScreen.addEventListener("click", () => {
      if (scene === "intro") leaveIntro();
    });
    introScreen.addEventListener("animationend", event => {
      if (event.target === introScreen && event.animationName === "intro-screen-fade-out") {
        finishIntroExit(introScreen);
      }
    });
  }
  stage.querySelectorAll(".title-intro-play, .title-intro-settings").forEach(button => {
    button.addEventListener("animationend", () => {
      button.classList.remove("title-intro-play", "title-intro-settings");
    }, {once:true});
  });
  const titleArt = stage.querySelector(".title-background-sprite");
  if (titleArt) titleArt.addEventListener("error", () => { titleArt.src = "sprites/original_sheets/main-menu-ver-10-10.webp"; }, {once:true});
  const baseArt = stage.querySelector(".base-screenshot-image");
  if (baseArt) baseArt.addEventListener("error", () => { baseArt.src = "sprites/cat-base-reference.jpg"; }, {once:true});
  stage.querySelectorAll(".cat-head-sprite").forEach(icon => {
    icon.addEventListener("error", () => { icon.src = "sprites/original_sheets/cat-base-menu-icon.webp"; }, {once:true});
  });
  persist();
  syncMusicForScene();
}
function navigate(next) {
  if (navigationTimer !== null) {
    clearTimeout(navigationTimer);
    navigationTimer = null;
  }
  const previous = scene;
  const isTitleBaseTransition =
    (previous === "title" && next === "base") ||
    (previous === "base" && next === "title");
  if (!isTitleBaseTransition || previous === next) {
    scene = next;
    render();
    return;
  }

  const currentScreen = stage.querySelector(".screen");
  if (!currentScreen) {
    scene = next;
    render();
    return;
  }

  currentScreen.classList.add(next === "base" ? "screen-exit-to-base" : "screen-exit-to-title");
  currentScreen.style.pointerEvents = "none";
  navigationTimer = setTimeout(() => {
    navigationTimer = null;
    scene = next;
    render();
    const enteringScreen = stage.querySelector(".screen");
    if (enteringScreen) {
      enteringScreen.classList.add(next === "base" ? "screen-enter-from-title" : "screen-enter-from-base");
    }
  }, 350);
}
function notify(message) {
  let element = $(".toast");
  if (!element) {
    element = document.createElement("div");
    element.className = "toast";
    $(".game").appendChild(element);
  }
  element.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{if(element.isConnected)element.remove();},2300);
}
function recruit(rare) {
  const pool = rare
    ? [{name:"Dragon Cat"},{name:"Bird Cat"},{name:"Titan Cat"}]
    : [{name:"Fish Cat"},{name:"Gross Cat"},{name:"Lizard Cat"}];
  const picked = pool[Math.floor(Math.random()*pool.length)];
  save.units.push({id:Date.now(),name:picked.name,level:1,cost:100});
  render();
  notify("New cat recruited: "+picked.name+"!");
}
function beginChapterSelection() {
  if (scene !== "title") return;
  if (navigationTimer !== null) {
    clearTimeout(navigationTimer);
    navigationTimer = null;
  }
  const titleScreen = stage.querySelector(".real-title-screen");
  if (!titleScreen) {
    scene = "chapters";
    render();
    return;
  }
  if (titleScreen.classList.contains("title-leaving-for-chapters")) return;
  titleScreen.classList.add("title-leaving-for-chapters");
  titleScreen.style.pointerEvents = "none";
  navigationTimer = setTimeout(() => {
    navigationTimer = null;
    if (scene === "title") {
      scene = "chapters";
      render();
    }
  },850);
}

function leaveChapterSelect(destination) {
  if (scene !== "chapters") return;
  const chapterScreen = stage.querySelector(".chapter-select-screen");
  if (!chapterScreen) {
    if (destination === "base") baseFadeFromBlack = true;
    if (destination === "title") titleFadeFromBlack = true;
    navigate(destination);
    return;
  }
  if (chapterScreen.classList.contains("chapter-leaving")) return;
  chapterLeavingDestination = destination;
  chapterScreen.classList.add("chapter-leaving");
  chapterScreen.style.pointerEvents = "none";
}

function finishIntroExit(introScreen) {
  if (scene !== "intro" || !introScreen || !introScreen.classList.contains("intro-leaving")) return;
  if (introExitTimer !== null) {
    clearTimeout(introExitTimer);
    introExitTimer = null;
  }
  titleFadeFromBlack = true;
  navigate("title");
}

function leaveIntro() {
  if (scene !== "intro") return;
  const introScreen = stage.querySelector(".intro-screen");
  if (!introScreen) {
    titleFadeFromBlack = true;
    navigate("title");
    return;
  }
  if (introScreen.classList.contains("intro-leaving")) return;
  introScreen.classList.add("intro-leaving");
  introScreen.style.pointerEvents = "none";
  if (introExitTimer !== null) clearTimeout(introExitTimer);
  introExitTimer = setTimeout(() => finishIntroExit(introScreen), 1200);
}

function perform(action) {
  if (!action) return;
  if (action === "intro-back" || action === "intro-skip") return leaveIntro();
  if (action === "chapter-enter") return leaveChapterSelect("base");
  if (action === "chapter-back") return leaveChapterSelect("title");
  if (action.startsWith("go:")) {
    const target = action.slice(3);
    if (scene === "title" && target === "base") return beginChapterSelection();
    return navigate(target);
  }
  if (action.startsWith("stage:")) { currentRegion = action.slice(6); selectedLevelIndex = Math.min(Math.max(0,Number(save.stageClears)||0),47); return navigate("stage"); }
  if (action.startsWith("level:")) {
    const index = Number(action.slice(6));
    if (!Number.isInteger(index) || index<0 || index>=EMPIRE_CHAPTER_ONE.length) return;
    if (index > Math.min(47,Number(save.stageClears)||0)) return notify("Clear "+EMPIRE_CHAPTER_ONE[index-1].name+" to unlock this stage.");
    selectedLevelIndex = index;
    return render();
  }
  if (action === "stage-battle") {
    if (selectedLevelIndex > Math.min(47,Number(save.stageClears)||0)) return notify("Clear previous stages to unlock this one.");
    
    battleState=createBattleState();
    return navigate("fight");
  }
  if (action.startsWith("deploy:")) {
    const unit=save.units.find(item=>String(item.id)===action.slice(7));
    if (unit) spawnPlayerCat(unit);
    return;
  }
  if(action==="toggle-speed") {
    if(scene!=="fight"||!battleState||battleState.ended) return;
    battleState.speedMultiplier=Number(battleState.speedMultiplier)===2?1:2;
    updateFightUI();
    return;
  }
  if (action==="wallet-upgrade") {
    if (scene!=="fight" || !battleState || battleState.ended) return;
    const maxLevel=8;
    const currentLevel=Math.max(1,Number(battleState.workerLevel)||1);
    if (currentLevel>=maxLevel) return notify("Your wallet is already max level.");
    const cost=50*currentLevel;
    if (battleState.money<cost) return notify("Not enough money to upgrade your wallet. Need "+cost+"¢.");
    battleState.money-=cost;
    battleState.workerLevel=currentLevel+1;
    battleState.maxMoney+=50;
    updateFightUI();
    notify("Wallet upgraded to level "+battleState.workerLevel+"! Maximum money increased.");
    return;
  }
  if (action.startsWith("unit:")) {
    const unit = save.units[Number(action.split(":")[1])];
    if (!unit) return;
    const currentLevel=Math.max(1,Math.floor(Number(unit.level)||1));
    const cost=(Number(unit.upgradeCost)||100)*currentLevel;
    if (save.xp < cost) return notify("Not enough XP!");
    save.xp-=cost;
    unit.level=currentLevel+1;
    playSfx("upgrade");
    render();
    const stats=battleUnitStats(unit);
    notify(unit.name+" reached Level "+unit.level+"! HP "+stats.health+" · ATK "+stats.damage);
    return;
  }
  if (action.startsWith("unitinfo:")) {
    const unit = save.units[Number(action.split(":")[1])];
    if (unit) notify(unit.name+" · Level "+unit.level);
    return;
  }
  if (action.startsWith("equipunit:")) {
    const unit = save.units[Number(action.split(":")[1])];
    if (!unit) return;
    if (save.equipped.includes(unit.id)) {
      save.equipped = save.equipped.filter(id=>id!==unit.id);
      notify(unit.name+" removed from lineup.");
    } else if (save.equipped.length >= 5) {
      notify("Your lineup can hold up to five cats.");
    } else {
      save.equipped.push(unit.id);
      notify(unit.name+" added to lineup.");
    }
    render(); return;
  }
  switch(action) {
    case "fight": battleState=createBattleState(); navigate("fight"); break;
    case "retry-battle": battleState=createBattleState(); navigate("fight"); break;
    case "lose": playSfx("defeat"); navigate("battle"); break;
    case "win": {
      if (!battleState || battleState.ended!=="win") playSfx("victory");
      save.xp += 250; save.missions = (save.missions||0)+1; save.stageClears = (save.stageClears||0)+1;
      selectedLevelIndex = Math.min(Math.max(0,save.stageClears),47);

      let reward = "Victory! +250 XP";
      if (save.stageClears === 1 && !save.units.some(unit => unit.name === "Tank Cat")) {
        save.units.push({id:2,name:"Tank Cat",level:1,deployCost:1,upgradeCost:400,hp:300,attack:8,range:25,speed:5,recharge:0.1,assetFolder:"tank-cat",spriteSlot:"Cats/tank-cat/slot.png",statsPath:"Cats/tank-cat/stats.json"});
        reward = "Victory! +250 XP · Tank Cat unlocked";
      }
      if(save.stageClears>=3&&!save.units.some(unit=>unit.name==="Axe Cat"||Number(unit.id)===3)) {
        save.units.push(makeAxeCatUnit());
        reward += " · Axe Cat unlocked";
      }
      if(save.stageClears>=7&&!save.units.some(unit=>unit.name==="Gross Cat"||Number(unit.id)===4)) {
        save.units.push(makeGrossCatUnit());
        reward += " · Gross Cat unlocked";
      }
      navigate("battle"); notify(reward);
      break;
    }
    case "rare":
      if (save.rareTickets < 1) return notify("You need a Rare Ticket.");
      save.rareTickets--; playSfx("capsule"); recruit(true); break;
    case "normal":
      if (save.normalTickets < 1) return notify("You need a Normal Ticket.");
      save.normalTickets--; playSfx("capsule"); recruit(false); break;
    case "daily":
      if (save.missions < 1) return notify("Complete a stage first!");
      save.missions = 0; save.xp += 300; playSfx("reward"); render(); notify("Mission reward: +300 XP"); break;
    case "dailyfood":
      save.catFood += 1; playSfx("reward"); render(); notify("+1 Cat Food"); break;
    case "mission":
      save.xp += 100; save.missions = (save.missions||0)+1; playSfx("reward"); render(); notify("Mission complete! +100 XP"); break;
    case "mailgift":
      if (!save.mail) return notify("You have already claimed this gift.");
      save.mail = 0; save.xp += 1000; playSfx("loginReward"); render(); notify("Welcome gift claimed: +1,000 XP"); break;
    case "expedition": notify("Gamatoto has left on an expedition."); break;
    case "collect":
      save.xp += 100; playSfx("reward"); render(); notify("Collected a demo reward: +100 XP"); break;
    case "save": persist(); notify("Game saved on this device."); break;
    case "reset":
      if (confirm("Reset all local demo progress? This cannot be undone.")) {
        save = {...defaults,units:defaults.units.map(unit=>({...unit})),equipped:[1]};
        persist(); navigate("title"); notify("Progress reset.");
      }
      break;
    case "sound": save.sound=!save.sound; render(); notify("Sound effects "+(save.sound?"on":"off")); if (save.sound) playSfx("button"); break;
    case "music": save.music=!save.music; render(); notify("Music "+(save.music?"on":"off")); break;
    case "locked": notify("This stage is locked in the menu demo."); break;
    case "noop": notify("This item is for display in the menu demo."); break;
    default: notify("Coming soon!");
  }
}
stage.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || !stage.contains(button)) return;
  const action = button.dataset.go || "";
  const isStageChoice = scene === "stage" && Boolean(button.closest(".game-row"));
  prepareAudioForAction();

  if (action === "sound" && !save.sound) {
    perform(action);
    playSfx("button");
    return;
  }

  playSfx(action==="wallet-upgrade" || action.startsWith("deploy:") ? "deploy" : action === "intro-back" ? "back" : isStageChoice ? "enterBattle" : "button");
  if (action) perform(action);
});
document.addEventListener("keydown", event=>{
  if (scene === "loading") return;
  if (event.key==="Escape") {
    if (scene==="intro") { leaveIntro(); return; }
    if (scene==="chapters") { leaveChapterSelect("title"); return; }
    if (scene==="title") return;
    if (scene==="base") navigate("title");
    else if (scene==="stage") navigate("battle");
    else if (scene==="battle") navigate("base");
    else navigate("base");
  }
});
render();
if (scene === "loading") setTimeout(startGameAssetLoading,0);
})();