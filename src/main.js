(() => {
"use strict";
const $ = (selector, root=document) => root.querySelector(selector);
const money = value => Number(value || 0).toLocaleString();
const defaults = {
  xp:0, catFood:0, rareTickets:0, normalTickets:0,
  energy:100, maxEnergy:100, level:1, exp:0, stageClears:0,
  units:[
    {id:1,name:"Cat",level:1,deployCost:50,upgradeCost:400,hp:100,attack:8,range:140,speed:10,recharge:2.5}
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
} catch {
  save = {...defaults, units:defaults.units.map(unit => ({...unit})), equipped:[1]};
}
if (savedSoundSettingsVersion < 1) {
  save.sound = true;
  save.soundSettingsVersion = 1;
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
const BATTLE_ASSET_VERSION = "20261029-46";
const BATTLE_ATTACK_FRAME_RATE = 10;
const BATTLE_ASSETS = {
  cat: {moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:6,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"Cats/cat/slot.png",upgrade:"Cats/cat/upgrade.png"},
  doge: {moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:8,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"enemys/doge/slot.png"},
  "tank-cat": {
    moving:["Cats/tank-cat/moving/frame-001.svg","Cats/tank-cat/moving/frame-002.svg","Cats/tank-cat/moving/frame-003.svg"],
    attacks:["Cats/tank-cat/attack/frame-001attack.svg","Cats/tank-cat/attack/frame-002attack.svg","Cats/tank-cat/attack/frame-003attack.svg","Cats/tank-cat/attack/frame-004attack.svg"],
    attack:"Cats/tank-cat/attack/frame-001attack.svg",attackSprite:"",attackFrameRate:8,attackDuration:0.5,
    damagedFrames:["Cats/tank-cat/damaged/frame-001damaged.svg"],knockbackFrames:["Cats/tank-cat/damaged/frame-001damaged.svg"],
    damaged:"Cats/tank-cat/damaged/frame-001damaged.svg",idle:"Cats/tank-cat/moving/frame-001.svg",
    slot:"Cats/tank-cat/slot.svg",upgrade:"Cats/tank-cat/upgrade.svg"
  }
};
const BATTLE_UNIT_STATS = {
  cat: {health:100,damage:8,price:50,speed:10,spriteChangeSpeed:8,walkSpriteChangeSpeed:2.5,range:55,recharge:2.5,attackCooldown:1.15,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5},
  doge: {health:90,damage:4,speed:2.8,spriteChangeSpeed:8,range:55,killReward:25,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5},
  "tank-cat": {health:300,damage:18,price:150,speed:6,spriteChangeSpeed:8,walkSpriteChangeSpeed:2.5,range:110,recharge:6,attackCooldown:1.8,knockbackThresholdPercent:25,knockbackDuration:0.64,knockbackDistance:4.5}
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
  const config = (isObject && unit.id!==undefined && unit.id!==null
    ? BATTLE_UNIT_STATS_BY_ID.get(String(unit.id))
    : null) || BATTLE_UNIT_STATS[key] || {};
  const positive = (value,fallback,min=0.1) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= min ? number : fallback;
  };
  const unitLevel = isObject && unit.kind !== "doge" ? Math.max(1,Math.floor(Number(unit.level)||1)) : 1;
  const levelMultiplier = 1 + Math.max(0,unitLevel-1)*0.1;
  const health = Math.round(positive(config.health,positive(unit.hp,100))*levelMultiplier);
  const damage = Math.round(positive(config.damage,positive(unit.attack,positive(unit.attackPower,8)))*levelMultiplier);
  const thresholdPercent = Math.max(1,Math.min(99,positive(config.knockbackThresholdPercent,positive(unit.knockbackThresholdPercent,25))));
  return {
    level:unitLevel,
    levelMultiplier,
    health,
    damage,
    price:positive(config.price,positive(unit.deployCost,50)),
    speed:positive(config.speed,positive(unit.speed,key==="doge"?2.8:10)),
    spriteChangeSpeed:positive(config.spriteChangeSpeed,positive(unit.spriteChangeSpeed,8)),
    walkSpriteChangeSpeed:positive(config.walkSpriteChangeSpeed,positive(unit.walkSpriteChangeSpeed,2.5)),
    range:positive(config.range,positive(unit.range,key==="doge"?110:140)),
    recharge:positive(config.recharge,positive(unit.recharge,2.5)),
    attackCooldown:positive(config.attackCooldown,positive(unit.attackCooldown,key==="doge"?1.55:1.15)),
    knockbackThresholdPercent:thresholdPercent,
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
  entity.speed = stats.speed;
  entity.spriteChangeSpeed = stats.spriteChangeSpeed;
  entity.walkSpriteChangeSpeed = stats.walkSpriteChangeSpeed;
  entity.range = stats.range;
  entity.attackCooldown = stats.attackCooldown;
  entity.recharge = stats.recharge;
  entity.knockbackThresholdPercent = stats.knockbackThresholdPercent;
  entity.knockbackDurationSetting = stats.knockbackDuration;
  entity.knockbackDistanceSetting = stats.knockbackDistance;
  if (wasFull || !Number.isFinite(Number(entity.nextKnockbackHp))) {
    entity.nextKnockbackHp = stats.health * (1 - stats.knockbackThresholdPercent / 100);
  }
  if (entity.kind === "doge") entity.killReward = stats.killReward;
  return stats;
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
const AUDIO_VERSION = "20261029-13";
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
  capsule: "sounds/capsule-draw.mp3"
};
const MUSIC_FILES = {
  intro: "sounds/intro-theme.mp3",
  title: "sounds/title-theme.mp3",
  menu: "sounds/menu-theme.mp3",
  battle: "sounds/battle-theme.mp3"
};
const activeSfxPlayers = new Set();
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
  {path:"Levels/Korea/enemy-base.svg?v=20261029-34",bytes:5200},
  {path:"sprites/battle/cat-base.svg?v=20261029-34",bytes:2400},
  {path:"Cats/cat/moving/frame-001.png?v=20261029-31",bytes:7000},
  {path:"Cats/cat/moving/frame-002.png?v=20261029-31",bytes:7000},
  {path:"Cats/cat/attack/frame-001attack.png?v=20261029-31",bytes:16072},
  {path:"Cats/cat/attack/frame-002attack.png?v=20261029-31",bytes:16117},
  {path:"Cats/cat/attack/frame-003attack.png?v=20261029-31",bytes:13263},
  {path:"Cats/cat/attack/frame-004attack.png?v=20261029-31",bytes:13433},
  {path:"Cats/cat/damaged/frame-001damaged.png?v=20261029-31",bytes:17381},
  {path:"Cats/cat/slot.png?v=20261029-31",bytes:9000},
  {path:"Cats/cat/upgrade.png?v=20261029-31",bytes:9000},
  {path:"Cats/tank-cat/moving/frame-001.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/moving/frame-002.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/moving/frame-003.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/attack/frame-001attack.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/attack/frame-002attack.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/attack/frame-003attack.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/attack/frame-004attack.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/damaged/frame-001damaged.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/slot.svg?v=20261029-44",bytes:520},
  {path:"Cats/tank-cat/upgrade.svg?v=20261029-44",bytes:520},
  {path:"enemys/doge/moving/frame-001.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-001.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-002.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-003.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/attack/frame-004.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/damaged/frame-001.png?v=20261029-31",bytes:9000},
  {path:"enemys/doge/slot.png?v=20261029-31",bytes:9000},
  {path:"sprites/backgrounds/intro-burning-city.webp?v=20261027-1",bytes:8248},
  {path:"sprites/ui/empirepfcatsbanner.png?v=20261027-1",bytes:270940},
  {path:"sprites/ui/backbutton.png?v=20261026-9",bytes:35794},
  {path:"sprites/backgrounds/titlescreenmenu.png?v=20261026-9",bytes:1513970},
  {path:"sprites/ui/Play_button.png?v=20261026-9",bytes:5844},
  {path:"sprites/ui/title-settings.png?v=20261026-9",bytes:38154},
  {path:"sprites/ui/title-mailbox.png?v=20261026-9",bytes:48748},
  {path:"sprites/backgrounds/bg_restored.png?v=20261028-13",bytes:203596},
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
];
const LOADING_TOTAL_BYTES = [...LOADING_IMAGE_ASSETS,...LOADING_AUDIO_ASSETS].reduce((sum,asset)=>sum+asset.bytes,0);
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
  const imageCount = LOADING_IMAGE_ASSETS.length;
  const audioCount = LOADING_AUDIO_ASSETS.length;

  for (let i=0; i<imageCount; i++) {
    const asset = LOADING_IMAGE_ASSETS[i];
    const name = asset.path.split("/").pop().split("?")[0];
    const status = "Loading image "+(i+1)+"/"+imageCount+" — "+name;
    updateLoadingProgress(status);
    const loaded = await loadImageAssetSequentially(asset);
    if (!loaded) {
      failedAssets++;
      console.warn("Battle Cats loader could not load image:",asset.path);
    }
    loadingBytesFinished += asset.bytes;
    updateLoadingProgress(status);
  }

  for (let i=0; i<audioCount; i++) {
    const asset = LOADING_AUDIO_ASSETS[i];
    const name = asset.path.split("/").pop().split("?")[0];
    const status = "Loading audio "+(i+1)+"/"+audioCount+" — "+name;
    updateLoadingProgress(status);
    const loaded = await loadAudioAssetSequentially(asset,status);
    if (!loaded) failedAssets++;
    loadingBytesFinished += asset.bytes;
    updateLoadingProgress(status);
  }

  updateLoadingProgress(failedAssets ? "Ready — "+failedAssets+" asset(s) could not be cached." : "Everything loaded. Starting story...");
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
  const basePath = path.replace(/\.mp3$/i, "");
  const formats = ["mp3"];
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
      console.error("Battle Cats sound asset failed in both formats:", key, player.currentSrc, player.error);
      notify("Couldn't load sound: " + key);
    };
    const promise = player.playCompat();
    if (promise && typeof promise.catch === "function") {
      promise.catch(error => {
        cleanup();
        console.error("Battle Cats sound failed to play:", key, player.currentSrc, error);
        notify("Couldn't play sound: " + key);
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
          console.error("Battle Cats music resume failed:", musicPlayer.currentSrc, error);
          if (error.name === "NotAllowedError") notify("Tap the game to allow music playback.");
        });
      }
    }
    return;
  }

  if (musicPlayer) {
    musicPlayer.pauseCompat();
    musicPlayer.currentTime = 0;
  }
  musicPlayer = createAudioPlayer(MUSIC_FILES[nextKey]);
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
      notify("Couldn't load music: " + nextKey);
    }
  };
  const promise = activePlayer.playCompat();
  if (promise && typeof promise.catch === "function") {
    promise.catch(error => {
      console.error("Battle Cats music failed to play:", nextKey, activePlayer.currentSrc, error);
      if (musicPlayer === activePlayer) {
        musicPlayer = null;
        currentMusicKey = "";
        if (error && error.name === "NotAllowedError") {
          if (targetScene !== "intro") notify("The browser blocked music playback. Check this site's sound permission and device volume.");
        } else {
          notify("Couldn't play music: " + nextKey + ". Check the loaded audio file.");
        }
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
  '<div class="top-strip"><span class="top-title">'+label+'</span><span class="top-xp">XP<span class="top-xp-plus">＋</span></span><strong class="top-value">'+money(save.xp)+'</strong></div>';
const bottomBar = (back="base") =>
  '<div class="bottom-strip">'+
    '<button class="back-button" data-go="go:'+back+'" aria-label="Back">↶</button>'+
    '<button class="store-button" data-go="go:store"><span class="store-cart">🛒</span> STORE</button>'+
    '<button class="catfood-display" data-go="go:store"><span class="catfood-label">CAT FOOD</span><span class="catfood-can">🥫</span><strong class="catfood-number">'+money(save.catFood)+'</strong><span class="top-xp-plus">＋</span></button>'+
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
      '<img class="base-background-sprite" src="sprites/backgrounds/bg_restored.png?v=20261028-13" alt="" draggable="false">'+
    '<img class="base-backboard-sprite" src="sprites/ui/backboard.png?v=20261026-25" alt="" draggable="false">'+
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
      '<button class="base-sprite-button base-cat-food" data-go="go:store" aria-label="Cat Food store"><img class="base-cat-food-icon" src="sprites/ui/Cat_Food.png?v=20261026-27" alt="" draggable="false"><span class="base-cat-food-count" aria-label="Cat Food balance">'+money(save.catFood)+'</span></button>'+
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
function defaultBattleLevelConfig(levelName="Korea") {
  return {
    name:levelName,
    background:"background.png",
    enemyBase:"enemy-base.svg",
    enemyBaseHealth:500,
    catBaseHealth:1000,
    initialSpawnDelay:2,
    enemySpawns:[{enemy:"doge",amount:18,startTime:2,intervalMin:5.5,intervalMax:9,spawnChance:0.82,maxAlive:3}]
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
    const amount=Math.max(0,Math.floor(Number.isFinite(requestedAmount)?requestedAmount:10));
    const startTime=Math.max(0,Number.isFinite(Number(rule.startTime))?Number(rule.startTime):initialSpawnDelay);
    const intervalMin=Math.max(0.25,Number.isFinite(Number(rule.intervalMin))?Number(rule.intervalMin):5.5);
    const intervalMax=Math.max(intervalMin,Number.isFinite(Number(rule.intervalMax))?Number(rule.intervalMax):intervalMin);
    const rawChance=Number(rule.spawnChance ?? rule.randomRate ?? 1);
    const spawnChance=Math.max(0,Math.min(1,Number.isFinite(rawChance)?rawChance:1));
    const maxAlive=Math.max(1,Math.floor(Number.isFinite(Number(rule.maxAlive))?Number(rule.maxAlive):3));
    return {id:index,enemy,amount,startTime,intervalMin,intervalMax,spawnChance,maxAlive,spawned:0,nextAttemptAt:startTime};
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
      battleState.spawnRules=battleLevelConfig.enemySpawns.map(rule=>({...rule,spawned:0,nextAttemptAt:rule.startTime}));
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
    range:stats.range,spriteChangeSpeed:stats.spriteChangeSpeed,walkSpriteChangeSpeed:stats.walkSpriteChangeSpeed,
    attackCooldown:stats.attackCooldown,mode:"moving",attackTimer:0,animUntil:0,hitUntil:0,frameAt,killReward:stats.killReward,
    knockbackThresholdPercent:stats.knockbackThresholdPercent,
    knockbackDurationSetting:stats.knockbackDuration,knockbackDistanceSetting:stats.knockbackDistance,
    nextKnockbackHp:stats.health*(1-stats.knockbackThresholdPercent/100),queuedKnockbacks:0,
    walkStartedAt:battleState?battleState.elapsed:0,attackStartedAt:0
  };
}
function createBattleState() {
  const selected=EMPIRE_CHAPTER_ONE[selectedLevelIndex]||EMPIRE_CHAPTER_ONE[0];
  const defaults=defaultBattleLevelConfig(selected.name);
  return {
    elapsed:0,money:50,maxMoney:150,playerUnits:[],enemies:[],
    nextEnemySpawn:defaults.initialSpawnDelay,
    enemyBaseHp:defaults.enemyBaseHealth,enemyBaseMaxHp:defaults.enemyBaseHealth,
    catBaseHp:defaults.catBaseHealth,catBaseMaxHp:defaults.catBaseHealth,
    cooldowns:{},nextUnitKey:1,nextEnemyKey:1,ended:"",workerLevel:1,
    levelName:selected.name,levelConfig:defaults,spawnRules:[],levelReady:false
  };
}
function loadBattleAssetManifests() {
  if(battleAssetsPromise) return battleAssetsPromise;
  BATTLE_UNIT_STATS_BY_ID.clear();
  const assetRequests=[["cat","Cats/cat/assets.json"],["doge","enemys/doge/assets.json"]];
  const statRequests=[];
  save.units.forEach(unit=>{
    const key=battleUnitKey(unit);
    const folder=unit.assetFolder||unit.spriteFolder||key;
    statRequests.push({id:String(unit.id),key,path:unit.statsPath||"Cats/"+folder+"/stats.json"});
    if(key!=="cat"&&key!=="doge") {
      if(!assetRequests.some(([kind])=>kind===key)) assetRequests.push([key,unit.assetsPath||"Cats/"+folder+"/assets.json"]);
      if(!BATTLE_ASSETS[key]) BATTLE_ASSETS[key]={moving:[],attacks:[],attack:"",attackSprite:"",attackFrameRate:8,attackDuration:0,damagedFrames:[],knockbackFrames:[],damaged:"",idle:"",slot:"Cats/"+folder+"/slot.svg"};
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
      if(data.upgrade&&kind==="cat") current.upgrade=data.upgrade;
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
    if (!url.searchParams.has("v")) url.searchParams.set("v",BATTLE_ASSET_VERSION);
    return url.href;
  } catch {
    return path;
  }
}
function battleSlotImage(unit) {
  const key = unit.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const assets = BATTLE_ASSETS[key];
  return battleAssetUrl(unit.spriteSlot || (assets && assets.slot) || "sprites/original_sheets/normal-cat-right-icon.webp");
}
function battleImageFor(entity) {
  const catUnit=entity.kind==="cat" ? save.units.find(unit=>String(unit.id)===String(entity.unitId)) : null;
  const assetKey=entity.kind==="cat" ? battleUnitKey(catUnit||"cat") : battleUnitKey(entity.enemyType||"doge");
  const assets=BATTLE_ASSETS[assetKey] || (entity.kind==="cat"?BATTLE_ASSETS.cat:BATTLE_ASSETS.doge);
  const statsSource=entity.kind==="cat" ? (catUnit||"cat") : (entity.enemyType||"doge");
  const elapsed=battleState?battleState.elapsed:0;
  const configuredAttackRate=Math.max(1,Math.min(30,Number(assets.attackFrameRate)||BATTLE_ATTACK_FRAME_RATE));
  const frameRate=entity.mode==="attack" ? configuredAttackRate : Math.max(0.5,Number(entity.spriteChangeSpeed||battleUnitStats(statsSource).spriteChangeSpeed||8));
  if(entity.mode==="idle") return battleAssetUrl(assets.idle||(assets.moving&&assets.moving[0])||"");
  if(entity.mode==="dead"||entity.mode==="knockback") {
    const frames=assets.knockbackFrames&&assets.knockbackFrames.length?assets.knockbackFrames:(assets.damagedFrames&&assets.damagedFrames.length?assets.damagedFrames:[]);
    if(frames.length) return battleAssetUrl(frames[Math.floor(elapsed*frameRate+(entity.frameAt||0))%frames.length]);
    return battleAssetUrl(assets.damaged||assets.idle||"");
  }
  if(entity.mode==="attack") {
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
  if(entity.mode==="damaged") {
    const frames=assets.damagedFrames&&assets.damagedFrames.length?assets.damagedFrames:[];
    if(frames.length) return battleAssetUrl(frames[Math.floor(elapsed*frameRate+(entity.frameAt||0))%frames.length]);
    return battleAssetUrl(assets.damaged||assets.idle||(assets.moving&&assets.moving[0])||"");
  }
  if(entity.kind==="cat"&&entity.mode==="moving") {
    const walkingFrames=(Array.isArray(assets.moving)?assets.moving:[]).filter(path=>typeof path==="string"&&path.length>0);
    if(walkingFrames.length) {
      const walkRate=Math.max(0.5,Number(entity.walkSpriteChangeSpeed||battleUnitStats("cat").walkSpriteChangeSpeed||2.5));
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
  return candidates
    .filter(target=>target&&Number(target.hp)>0&&target.mode!=="dead"&&target.mode!=="knockback")
    .map(target=>({target,gap:battleTargetGap(attacker,target)}))
    .filter(item=>item.gap>=-1)
    .sort((a,b)=>a.gap-b.gap)[0]?.target||null;
}
function battleEntityMarkup(entity) {
  const source=battleImageFor(entity);
  return '<div class="fight-unit '+(entity.kind==="cat"?"fight-unit-cat":"fight-unit-doge")+'" data-battle-entity="'+entity.key+'" style="left:'+entity.x+'%">'+
    '<img class="fight-unit-sprite" '+(source?'src="'+source+'"':'')+' alt="'+(entity.kind==="cat"?"Cat":"Doge")+'" draggable="false">'+
  '</div>';
}
function startBattleRuntime() {
  if (!battleState) battleState = createBattleState();
  applyBattleLevelVisuals();
  loadBattleAssetManifests();
  if (battleTimer===null) battleTimer=setInterval(tickBattle,100);
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
function updateBattleEntityView(entity) {
  const element = ensureBattleEntityNode(entity);
  if (!element) return;
  const formationSlot=Math.max(0,Number(entity.formationSlot)||0);
  const visualStagger=entity.kind==="cat" ? ((formationSlot%3)-1)*2.1 : 0;
  const visualRow=entity.kind==="cat" ? (Math.floor(formationSlot/3)%3)*4 : 0;
  element.style.left = Math.max(2,Math.min(97,entity.x+visualStagger))+"%";
  element.style.bottom = visualRow+"px";
  element.classList.toggle("is-attacking",entity.mode==="attack");
  element.classList.toggle("is-idle",entity.mode==="idle");
  element.classList.toggle("is-damaged",entity.mode==="damaged");
  element.classList.toggle("is-knockback",entity.mode==="knockback");
  element.classList.toggle("is-dead",entity.mode==="dead");
  const sprite = element.querySelector(".fight-unit-sprite");
  const source = battleImageFor(entity);
  if (!sprite) return;
  if (entity.mode==="attack") {
    const duration=Math.max(0.1,Number(entity.animUntil)-Number(entity.attackStartedAt));
    sprite.style.setProperty("--battle-attack-duration",duration+"s");
  } else {
    sprite.style.removeProperty("--battle-attack-duration");
  }
  if (entity.mode==="knockback") {
    const duration = Math.max(0.2,Number(entity.knockbackDuration)||Number(entity.knockbackDurationSetting)||0.64);
    sprite.style.setProperty("--battle-knockback-duration",(duration*1000)+"ms");
  } else {
    sprite.style.removeProperty("--battle-knockback-duration");
  }
  if (!source) { sprite.style.visibility="hidden"; return; }
  sprite.style.visibility="";
  if (sprite.dataset.activeSource!==source) {
    sprite.dataset.activeSource=source;
    sprite.dataset.fallbackTried="";
    sprite.classList.remove("sprite-load-failed");
    sprite.onload=()=>{
      sprite.classList.remove("sprite-load-failed");
      sprite.style.visibility="";
      sprite.dataset.fallbackTried="";
    };
    sprite.onerror=()=>{
      if (!sprite.dataset.fallbackTried) {
        sprite.dataset.fallbackTried="1";
        try {
          const fallbackUrl=new URL(source);
          fallbackUrl.search="";
          sprite.src=fallbackUrl.href;
          return;
        } catch {}
      }
      sprite.onerror=null;
      sprite.classList.add("sprite-load-failed");
      console.warn("Battle Cats sprite could not load:",source);
    };
    sprite.src=source;
  }
}
function battleBaseGeometry(side) {
  const screen=stage.querySelector(".fight-screen");
  const base=screen&&screen.querySelector(side==="cat"?".player-castle":".enemy-castle");
  const screenRect=screen&&screen.getBoundingClientRect();
  const baseRect=base&&base.getBoundingClientRect();
  if(screenRect&&screenRect.width>0&&baseRect&&baseRect.width>0) {
    return {center:(baseRect.left+baseRect.width/2-screenRect.left)/screenRect.width*100,halfWidth:baseRect.width/2/screenRect.width*100};
  }
  return side==="cat"?{center:94.5,halfWidth:3.5}:{center:6,halfWidth:3.5};
}
function battleBaseCenterPercent(side) {
  return battleBaseGeometry(side).center;
}
function battleBaseContactPercent(side) {
  const geometry=battleBaseGeometry(side);
  const screen=stage.querySelector(".fight-screen");
  const width=(screen&&screen.getBoundingClientRect().width)||window.innerWidth||1000;
  const unitWidth=Math.max(54,Math.min(96,width*0.073));
  const unitHalf=unitWidth/2/width*100;
  if(side==="cat") return Math.max(2,geometry.center-geometry.halfWidth-unitHalf-0.3);
  return Math.min(98,geometry.center+geometry.halfWidth+unitHalf+0.3);
}
function battleRangePercent(range) {
  const screen=stage.querySelector(".fight-screen");
  const width=(screen&&screen.getBoundingClientRect().width)||window.innerWidth||1000;
  return Math.max(0.5,Math.min(45,(Math.max(0,Number(range)||0)/width)*100));
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
  for(const rule of state.spawnRules||[]) {
    if(rule.spawned>=rule.amount||state.elapsed+0.0001<rule.nextAttemptAt) continue;
    const alive=state.enemies.filter(enemy=>enemy.enemyType===rule.enemy&&enemy.hp>0&&enemy.mode!=="dead").length;
    if(alive<rule.maxAlive&&Math.random()<=rule.spawnChance) {
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
  const entity = {
    key:"cat-"+battleState.nextUnitKey++,kind:"cat",unitId:unit.id,name:unit.name,
    x:battleBaseCenterPercent("cat"),formationSlot:battleState.playerUnits.length,hp:stats.health,maxHp:stats.health,attackPower:stats.damage,
    speed:stats.speed,range:stats.range,spriteChangeSpeed:stats.spriteChangeSpeed,attackCooldown:stats.attackCooldown,recharge:stats.recharge,mode:"moving",attackTimer:0,
    animUntil:0,hitUntil:0,frameAt:0,walkStartedAt:battleState.elapsed,attackStartedAt:0,
    knockbackThresholdPercent:stats.knockbackThresholdPercent,
    knockbackDurationSetting:stats.knockbackDuration,knockbackDistanceSetting:stats.knockbackDistance,
    nextKnockbackHp:stats.health*(1-stats.knockbackThresholdPercent/100),queuedKnockbacks:0
  };
  battleState.playerUnits.push(entity);
  ensureBattleEntityNode(entity);
  updateBattleEntityView(entity);
  updateFightUI();
}
function beginBattleKnockback(target,lethal,now) {
  if (!target || target.mode==="dead") return;
  target.pendingAttackAt=0;
  target.pendingAttackTargetKey="";
  target.pendingAttackBase="";
  const unit = target.kind==="cat"
    ? save.units.find(item=>String(item.id)===String(target.unitId)) || target
    : "doge";
  const stats = battleUnitStats(unit);
  target.mode = lethal ? "dead" : "knockback";
  target.knockbackElapsed = 0;
  target.knockbackDuration = lethal ? 0.68 : stats.knockbackDuration;
  target.knockbackOriginX = Number(target.x)||0;
  target.knockbackDirection = target.kind==="cat" ? 1 : -1;
  target.knockbackDistance = lethal ? stats.knockbackDistance*1.4 : stats.knockbackDistance;
  target.attackTimer = 0;
  target.animUntil = 0;
  target.hitUntil = 0;
  if (lethal) target.queuedKnockbacks=0;
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
    updateBattleEntityView(entity);
  }
  const expired = entities.filter(entity=>entity.mode==="dead" && entity.knockbackElapsed>=(Number(entity.knockbackDuration)||0.68));
  for (const entity of expired) {
    if (enemies.includes(entity) && entity.kind==="doge" && !entity.rewardPaid) {
      const reward = Math.max(0,Number(entity.killReward)||25);
      battleState.money = Math.min(Number(battleState.maxMoney)||150,(Number(battleState.money)||0)+reward);
      entity.rewardPaid=true;
    }
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
  let threshold=Number.isFinite(Number(target.nextKnockbackHp))?Number(target.nextKnockbackHp):maxHp*0.75;
  let crossings=0;
  while(threshold>0&&target.hp<=threshold){crossings++;threshold-=maxHp*0.25;}
  target.nextKnockbackHp=threshold;
  if(target.mode==="knockback") return;
  if(crossings>0){
    target.queuedKnockbacks=Math.max(0,crossings-1);
    beginBattleKnockback(target,false,hitTime);
    return;
  }
  const attackStillPlaying=Number(target.pendingAttackAt)>hitTime+0.0001&&Number(target.animUntil)>hitTime+0.0001;
  target.hitUntil=Math.max(Number(target.hitUntil)||0,hitTime+0.18);
  if(!attackStillPlaying){
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
      Number(attacker.attackTimer)>0.001 || Number(attacker.animUntil)>now+0.0001 ||
      Number(attacker.pendingAttackAt)>0 || Number(attacker.hitUntil)>now+0.0001) return false;
  attacker.attackCycleId=(Number(attacker.attackCycleId)||0)+1;
  attacker.attackStartedAt=now;
  attacker.attackTimer=cooldown;
  attacker.animUntil=now+animationDuration;
  attacker.pendingAttackAt=now+animationDuration;
  attacker.pendingAttackTargetKey=target ? target.key : "";
  attacker.pendingAttackBase=baseTarget;
  attacker.pendingAttackDamage=Number(attacker.attackPower)||8;
  attacker.mode="attack";
  return true;
}
function resolveBattleAttackOnce(attacker,target,damage,now) {
  if (!attacker || !target || !Number(attacker.attackCycleId) ||
      attacker.lastResolvedAttackCycle===attacker.attackCycleId) return false;
  attacker.lastResolvedAttackCycle=attacker.attackCycleId;
  damageBattleEntity(target,damage,now);
  return true;
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
    if (attacker.mode==="dead" || attacker.mode==="knockback" || Number(attacker.hp)<=0) continue;

    if(targetKey) {
      const lockedTarget=findBattleEntity(targetKey);
      if(lockedTarget&&Number(lockedTarget.hp)>0&&lockedTarget.mode!=="dead"&&lockedTarget.mode!=="knockback") {
        resolveBattleAttackOnce(attacker,lockedTarget,damage,now);
      } else {
        const replacement=findBattleTargetFor(attacker);
        const reach=battleRangePercent(attacker.range);
        if(replacement&&battleTargetGap(attacker,replacement)<=reach+0.5) {
          resolveBattleAttackOnce(attacker,replacement,damage,now);
        }
      }
    } else if(baseTarget&&attacker.lastResolvedAttackCycle!==attacker.attackCycleId) {
      attacker.lastResolvedAttackCycle=attacker.attackCycleId;
      if(baseTarget==="enemy") battleState.enemyBaseHp=Math.max(0,battleState.enemyBaseHp-damage);
      else battleState.catBaseHp=Math.max(0,battleState.catBaseHp-damage);
    }
  }
}

function attackBattleBase(attacker,now) {
  if (!attacker || attacker.mode==="dead" || attacker.mode==="knockback" || Number(attacker.attackTimer)>0.001) return false;
  const baseTarget=attacker.kind==="cat"?"enemy":"cat";
  const contact=battleBaseContactPercent(baseTarget);
  if(attacker.kind==="cat"?attacker.x>contact+0.25:attacker.x<contact-0.25) return false;
  const unit=attacker.kind==="cat"
    ? save.units.find(item=>String(item.id)===String(attacker.unitId)) || "cat"
    : (attacker.enemyType || "doge");
  const stats=battleUnitStats(unit);
  const duration=battleAttackAnimationDuration(attacker,attacker.kind==="cat"?0.62:0.55);
  return startBattleAttack(attacker,now,attacker.attackCooldown||stats.attackCooldown,duration,null,baseTarget);
}
function tickBattle() {
  if (scene!=="fight" || !battleState || battleState.ended) return;
  const state=battleState;
  const dt=0.1;
  state.elapsed+=dt;
  advanceBattleKnockback(dt);
  state.money=Math.min(state.maxMoney,state.money+(2.6+Math.max(0,(Number(state.workerLevel)||1)-1)*0.25)*dt);
  Object.keys(state.cooldowns).forEach(key=>state.cooldowns[key]=Math.max(0,state.cooldowns[key]-dt));

  attemptBattleEnemySpawn(state);

  const now=state.elapsed;
  resolvePendingBattleAttacks(now);
  const enemyBaseStop=battleBaseContactPercent("enemy");
  const catBaseStop=battleBaseContactPercent("cat");
  const catHomeCenter=battleBaseCenterPercent("cat");
  const enemyHomeCenter=battleBaseCenterPercent("enemy");

  for (const cat of state.playerUnits) {
    if (cat.mode==="dead" || cat.mode==="knockback") { updateBattleEntityView(cat); continue; }
    if (cat.hp<=0) continue;
    cat.attackTimer=Math.max(0,cat.attackTimer-dt);
    if (cat.pendingAttackAt>0 && cat.animUntil>now) cat.mode="attack";
    else if (cat.hitUntil>now) cat.mode="damaged";
    else if (cat.animUntil>now) cat.mode="attack";
    else cat.mode="idle";

    const target=findBattleTargetFor(cat);

    if (target) {
      const distance=battleTargetGap(cat,target);
      const reach=battleRangePercent(cat.range);
      if (distance<=reach) {
        const catUnit=save.units.find(unit=>String(unit.id)===String(cat.unitId))||"cat";
        const catStats=battleUnitStats(catUnit);
        const attackDuration=battleAttackAnimationDuration(cat,0.62);
        if (cat.attackTimer<=0&&startBattleAttack(cat,now,cat.attackCooldown||catStats.attackCooldown,attackDuration,target)) {
        } else if (!(cat.animUntil>now)) {
          cat.mode="idle";
        }
      } else {
        const desiredStop=Math.max(enemyBaseStop,target.x+reach);
        cat.mode="moving";
        cat.x=Math.max(desiredStop,cat.x-(cat.speed*0.45)*dt);
      }
      cat.x=Math.max(enemyBaseStop,Math.min(catHomeCenter,cat.x));
    } else if (state.enemyBaseHp>0) {
      if (cat.x>enemyBaseStop) {
        cat.mode="moving";
        cat.x=Math.max(enemyBaseStop,cat.x-(cat.speed*0.45)*dt);
      } else if (cat.attackTimer<=0) {
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
    if (enemy.pendingAttackAt>0 && enemy.animUntil>now) enemy.mode="attack";
    else if (enemy.hitUntil>now) enemy.mode="damaged";
    else if (enemy.animUntil>now) enemy.mode="attack";
    else enemy.mode="idle";

    const target=findBattleTargetFor(enemy);
    const enemyDistance=target?battleTargetGap(enemy,target):Infinity;
    const enemyReach=battleRangePercent(enemy.range);

    if(target&&enemyDistance<=enemyReach) {
      const enemyStats=battleUnitStats(enemy.enemyType||"doge");
      const attackDuration=battleAttackAnimationDuration(enemy,0.55);
      if(enemy.attackTimer<=0&&startBattleAttack(enemy,now,enemy.attackCooldown||enemyStats.attackCooldown,attackDuration,target)) {
      } else if(!(enemy.animUntil>now)) {
        enemy.mode="idle";
      }
    } else if(target&&enemyDistance>enemyReach) {
      const desiredStop=Math.min(catBaseStop,target.x-enemyReach);
      enemy.mode="moving";
      enemy.x=Math.min(desiredStop,enemy.x+Number(enemy.speed||2.8)*dt);
    }

    if (target) {
      enemy.x=Math.max(enemyHomeCenter,Math.min(catBaseStop,enemy.x));
    } else {
      if (state.catBaseHp>0) {
        if (enemy.x<catBaseStop) {
          enemy.mode="moving";
          enemy.x=Math.min(catBaseStop,enemy.x+Number(enemy.speed||2.8)*dt);
        } else if (enemy.attackTimer<=0) {
          if (!attackBattleBase(enemy,now)) enemy.mode="idle";
        } else {
          enemy.mode="idle";
        }
      }
    }
    updateBattleEntityView(enemy);
  }

  state.playerUnits=state.playerUnits.filter(cat=>cat.hp>0 || cat.mode==="dead" || cat.mode==="knockback");
  state.enemies=state.enemies.filter(enemy=>enemy.hp>0 || enemy.mode==="dead" || enemy.mode==="knockback");

  if (state.enemyBaseHp<=0) finishBattle("win");
  else if (state.catBaseHp<=0) finishBattle("lose");
  updateFightUI();
}
function finishBattle(result) {
  if (!battleState || battleState.ended) return;
  battleState.ended=result;
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
  const workerLevelText=stage.querySelector(".fight-worker-cat-level");
  const workerCostText=stage.querySelector(".fight-worker-cost");
  const workerBar=stage.querySelector(".fight-worker-bar span");
  if (moneyText) moneyText.textContent=Math.floor(state.money)+"/"+state.maxMoney+"¢";
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
  if (workerButton) {
    workerButton.disabled=walletLevel>=walletMaxLevel || state.money<walletCost || Boolean(state.ended);
    workerButton.setAttribute("aria-label",walletLevel>=walletMaxLevel?"Wallet max level":"Upgrade wallet for "+walletCost+"¢");
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
    button.disabled=Boolean(state.ended)||state.money<cost||cooldown>0.05;
    button.classList.toggle("is-recharging",cooldown>0.05);
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
  const message=stage.querySelector(".fight-message");
  if (message) {
    const available=save.units.find(unit=>save.equipped.includes(unit.id) && state.money>=battleUnitStats(unit).price && Number(state.cooldowns[unit.id]||0)<=0.05);
    message.textContent=state.ended ? "BATTLE FINISHED" : available ? "TAP A CAT SLOT TO DEPLOY" : "";
    message.hidden=!state.ended&&!available;
  }
}

function renderFight() {
  if (!battleState) battleState=createBattleState();
  const selectedLevel=EMPIRE_CHAPTER_ONE[selectedLevelIndex]||EMPIRE_CHAPTER_ONE[0];
  const levelFolder="Levels/"+selectedLevel.name;
  const levelConfig=battleState.levelConfig||defaultBattleLevelConfig(selectedLevel.name);
  const levelBackgroundUrl=battleAssetUrl(levelFolder+"/"+levelConfig.background);
  const enemyBaseUrl=battleAssetUrl(levelFolder+"/"+levelConfig.enemyBase);
  const catBaseUrl=battleAssetUrl("sprites/battle/cat-base.svg");
  const walletImageUrl=battleAssetUrl("sprites/original_sheets/cat-base-menu-icon.webp");
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
  return '<section class="screen fight-screen" aria-label="' + selectedLevel.name + ' battle">'+
    '<img class="fight-background-art" src="' + levelBackgroundUrl + '" alt="" draggable="false">'+
    '<div class="fight-sky-wash"></div><div class="fight-ground"></div>'+
    '<button class="fight-back" data-go="go:battle" aria-label="Leave battle">×</button>'+
    '<div class="fight-battle-controls">'+
      '<div class="fight-money"><strong class="fight-money-value">50/150¢</strong></div>'+
      '<button class="fight-worker-cat" data-go="wallet-upgrade" aria-label="Upgrade wallet">'+
        '<img class="fight-worker-icon" src="' + walletImageUrl + '" alt="" draggable="false">'+
        '<span class="fight-worker-details"><span class="fight-worker-heading">WALLET</span>'+
        '<strong class="fight-worker-cat-level">LEVEL 1</strong>'+
        '<span class="fight-worker-bar"><span style="width:33%"></span></span>'+
        '<small class="fight-worker-cost">UPGRADE 50¢</small></span></button>'+
    '</div>'+
    '<div class="fight-base-hud fight-enemy-hud"><strong class="fight-enemy-hp">500 / 500</strong></div>'+
    '<div class="fight-base-hud fight-player-hud"><strong class="fight-cat-hp">1000 / 1000</strong></div>'+
    '<img class="fight-base enemy-castle" src="' + enemyBaseUrl + '" alt="" draggable="false">'+
    
    
    '<img class="fight-base player-castle" src="' + catBaseUrl + '" alt="" draggable="false">'+
    '<div class="fight-unit-layer">'+entities+'</div>'+
    '<div class="fight-message">TAP A CAT SLOT TO DEPLOY</div>'+
    '<footer class="fight-bottom">'+
      '<div class="fight-unit-slots">'+(slots||'<div class="fight-no-slots">Equip a Cat to deploy it.</div>')+'</div>'+
      '<button class="fight-cannon" type="button" disabled aria-label="Cat Cannon not implemented yet"><img class="fight-cannon-sprite" src="' + cannonImageUrl + '" alt="" draggable="false"><small>CANNON</small></button>'+
    '</footer>'+
    '<div class="fight-result" hidden><div class="fight-result-panel"><strong class="fight-result-title">STAGE CLEAR!</strong><p class="fight-result-copy">Korea cleared! Claim your reward.</p><button class="fight-result-button" data-go="win">CONTINUE</button></div></div>'+
  '</section>';
}
function renderUpgrade() {
  const body = pageCopy("Each Cat level increases its health and attack power by 10%.")+
    row("Player Rank","Rank "+save.level+" · "+money(save.xp)+" XP available","rank","RANK UP · 500 XP")+
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
      return '<button class="cat-tile" data-go="'+(equip?"equipunit:":"unitinfo:")+i+'"><div class="cat-tile-art">'+catHead()+'</div><strong>'+unit.name+'</strong><small>Level '+level+' · HP '+stats.health+' · ATK '+stats.damage+(equip?(isEquipped?" · Equipped":" · Not equipped"):"")+'</small></button>';
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
    playSfx("upgrade");
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
      save.level = Math.max(save.level,1+Math.floor(save.xp/1000));
      let reward = "Victory! +250 XP";
      if (save.stageClears === 1 && !save.units.some(unit => unit.name === "Tank Cat")) {
        save.units.push({id:2,name:"Tank Cat",level:1,deployCost:150,upgradeCost:400,hp:300,attack:18,range:110,speed:6,recharge:6,assetFolder:"tank-cat",spriteSlot:"Cats/tank-cat/slot.svg",statsPath:"Cats/tank-cat/stats.json"});
        reward = "Victory! +250 XP · Tank Cat unlocked";
      }
      navigate("battle"); notify(reward);
      break;
    }
    case "rank":
      if (save.xp < 500) return notify("Not enough XP!");
      save.xp -= 500; save.level++; playSfx("upgrade"); render(); notify("Rank increased!"); break;
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

  playSfx(action === "intro-back" ? "back" : isStageChoice ? "enterBattle" : "button");
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