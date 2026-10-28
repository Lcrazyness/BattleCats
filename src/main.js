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
const AUDIO_VERSION = "20261029-12";
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

const mainScript = document.querySelector('script[src*="src/main.js"]');
const APP_BASE_URL = new URL("../", mainScript ? mainScript.src : document.baseURI);

const LOADING_IMAGE_ASSETS = [
  {path:"sprites/backgrounds/intro-burning-city.webp?v=20261027-1",bytes:8248},
  {path:"sprites/ui/empirepfcatsbanner.png?v=20261027-1",bytes:270940},
  {path:"sprites/ui/backbutton.png?v=20261026-9",bytes:35794},
  {path:"sprites/backgrounds/titlescreenmenu.png?v=20261026-9",bytes:1513970},
  {path:"sprites/ui/Play_button.png?v=20261026-9",bytes:5844},
  {path:"sprites/ui/title-settings.png?v=20261026-9",bytes:38154},
  {path:"sprites/ui/title-mailbox.png?v=20261026-9",bytes:48748},
  {path:"sprites/backgrounds/bg_restored.png?v=20261026-9",bytes:203596},
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
  {path:"sprites/original_sheets/cat-base-accessory-icon.webp",bytes:6458},
  {path:"sprites/original_sheets/cat-base-menu-icon.webp",bytes:4800},
  {path:"sprites/original_sheets/cat-base-menu.webp",bytes:227100},
  {path:"sprites/original_sheets/main-menu-ver-10-10.webp",bytes:392714},
  {path:"sprites/cat-base-reference.jpg",bytes:85938},
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
const preloadedImageCache = [];

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
  return new Promise(resolve => {
    let attempts = 0;
    const tryLoad = () => {
      const image = new Image();
      let eventFinished = false;
      const finish = success => {
        if (eventFinished) return;
        eventFinished = true;
        if (!success) {
          if (attempts < 1) {
            attempts++;
            tryLoad();
          } else {
            resolve(false);
          }
          return;
        }
        const keepDecoded = () => {
          preloadedImageCache.push(image);
          resolve(true);
        };
        if (typeof image.decode === "function") image.decode().then(keepDecoded).catch(keepDecoded);
        else keepDecoded();
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = new URL(asset.path,APP_BASE_URL).href;
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
      '<img class="base-background-sprite" src="sprites/backgrounds/bg_restored.png?v=20261026-9" alt="" draggable="false">'+
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
    const locations = currentRegion==="future" ? ["Moon","Japan","New York","Brazil","Madagascar","Great Abyss"] : currentRegion==="cosmos" ? ["The Big Bang","Andromeda","Black Hole","Catseye Nebula","Finale"] : ["Japan","Korea","China","Mongolia","Russia","Australia"];
    const body = pageCopy((currentRegion==="future"?"INTO THE FUTURE":currentRegion==="cosmos"?"CATS OF THE COSMOS":currentRegion==="legend"?"LEGEND STAGES":currentRegion==="event"?"EVENT STAGES":"EMPIRE OF CATS")+" · CHAPTER 1")+
      '<div class="meter"><span style="width:8%"></span></div>'+
      '<div class="menu-list">'+locations.map((name,i)=>row(name,i===0?"Clear to earn XP and continue.":"Stage not cleared",i===0?"go:fight":"locked",i===0?"BATTLE":"LOCKED")).join("")+'</div>';
    return renderWindow("Choose a Stage",body,"battle");
  }
  const completed = Math.max(0,Math.min(48,Number(save.stageClears)||0));
  if (!Number.isInteger(selectedLevelIndex) || selectedLevelIndex < 0 || selectedLevelIndex > 47) selectedLevelIndex = Math.min(completed,47);
  const selected = EMPIRE_CHAPTER_ONE[selectedLevelIndex];
  const available = selectedLevelIndex <= completed;
  const progressPercent = Math.round(completed / 48 * 100);
  const routePoints = EMPIRE_CHAPTER_ONE.map(level => (level.x*10)+","+(level.y*5)).join(" ");
  const nodes = EMPIRE_CHAPTER_ONE.map((level,index) => {
    const unlocked = index <= completed;
    const classes = "world-level-node"+(unlocked?" is-open":" is-locked")+(index===selectedLevelIndex?" is-selected":"")+(index===completed?" is-frontier":"");
    return '<button class="'+classes+'" style="left:'+level.x+'%;top:'+level.y+'%" data-go="level:'+index+'" aria-label="Stage '+(index+1)+': '+level.name+(unlocked?', available':', locked')+'" title="'+(index+1)+'. '+level.name+'">'+
      '<span>'+(unlocked?(index+1):"•")+'</span></button>';
  }).join("");
  const treasure = selectedLevelIndex===0 ? "TREASURE: KIMCHI · FIRST CLEAR: TANK CAT" : (available ? "CLEAR THIS STAGE TO CONTINUE THE CAMPAIGN" : "CLEAR PREVIOUS STAGES TO UNLOCK");
  return '<section class="screen world-stage-screen" aria-label="Empire of Cats Chapter 1 stage select">'+
    '<div class="world-stage-frame">'+
      '<header class="world-stage-header">'+
        '<button class="world-stage-back" data-go="go:base" aria-label="Back to Cat Base"><img src="sprites/ui/backbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
        '<div class="world-stage-title"><strong>EMPIRE OF CATS</strong><span>CHAPTER 1 · WORLD TOUR</span></div>'+
        '<div class="world-stage-hud">'+
          '<div class="world-hud-value xp"><span>XP</span><strong>'+money(save.xp)+'</strong></div>'+
          '<div class="world-hud-value energy"><span>ENERGY</span><strong>'+money(save.energy)+'</strong></div>'+
          '<div class="world-hud-value catfood"><span>CAT FOOD</span><strong>'+money(save.catFood)+'</strong></div>'+
        '</div>'+
      '</header>'+
      '<div class="world-level-map" aria-label="World map showing all 48 chapter stages">'+
        '<img class="world-map-art world-map-art-background" src="sprites/backgrounds/empire-of-cats-map.png?v=20261029-14" alt="" draggable="false">'+
        '<svg class="world-route-art" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><polyline points="'+routePoints+'"/></svg>'+
        '<div class="world-map-compass" aria-hidden="true">N<span>▲</span></div>'+
        '<div class="world-map-progress">STAGES CLEARED <strong>'+completed+' / 48</strong></div>'+
        nodes+
      '</div>'+
      '<footer class="world-stage-footer">'+
        '<div class="world-stage-info">'+
          '<div class="world-stage-kicker">STAGE '+String(selectedLevelIndex+1).padStart(2,"0")+' / 48 · '+(available?"AVAILABLE":"LOCKED")+'</div>'+
          '<h1>'+selected.name+'</h1>'+
          '<p>'+treasure+'</p>'+
          '<div class="world-stage-progress" aria-label="'+completed+' of 48 stages cleared"><span style="width:'+progressPercent+'%"></span></div>'+
        '</div>'+
        '<div class="world-stage-actions">'+
          '<div class="world-energy-cost"><span>ENERGY</span><strong>'+ (selectedLevelIndex===0?"5":"—") +'</strong></div>'+
          '<button class="world-battle-button" data-go="stage-battle" '+(available?"":"disabled")+'><span>BATTLE!!</span><small>'+ (selectedLevelIndex===0?"KOREA":"STAGE "+(selectedLevelIndex+1)) +'</small></button>'+
        '</div>'+
      '</footer>'+
    '</div>'+
  '</section>';
}
function renderFight() {
  const body = pageCopy("BATTLE DEMO")+
    '<div class="cat-grid">'+
      '<div class="cat-tile"><div class="cat-tile-art">'+catHead()+'</div><strong>Your Cats</strong><small>'+save.equipped.length+' equipped</small></div>'+
      '<div class="cat-tile"><div class="cat-tile-art">?</div><strong>Enemy Base</strong><small>Stage 1</small></div>'+
    '</div>'+
    pageCopy("The full side-scrolling battle is not implemented yet. This button simulates a win so you can test menu progression.")+
    row("Stage Reward","+250 XP","win","SIMULATE WIN");
  return renderWindow("Battle Preview",body,"battle");
}
function renderUpgrade() {
  const body = pageCopy("Spend XP to increase your rank and strengthen your cats.")+
    row("Player Rank","Rank "+save.level+" · "+money(save.xp)+" XP available","rank","RANK UP · 500 XP")+
    '<h3 style="margin:9px 0 0;text-align:center">CAT UPGRADES</h3>'+
    '<div class="menu-list">'+save.units.map((unit,i)=>row(unit.name,"Level "+unit.level+" · Next level costs "+((unit.upgradeCost||100)*unit.level)+" XP","unit:"+i,"UPGRADE")).join("")+'</div>';
  return renderWindow("Upgrade",body,"base");
}
function renderDictionary(equip=false) {
  const body = pageCopy(equip?"Tap a cat to add or remove it from your battle lineup.":"Cats you have discovered are shown here.")+
    '<div class="cat-grid">'+save.units.map((unit,i)=>{
      const isEquipped = save.equipped.includes(unit.id);
      return '<button class="cat-tile" data-go="'+(equip?"equipunit:":"unitinfo:")+i+'"><div class="cat-tile-art">'+catHead()+'</div><strong>'+unit.name+'</strong><small>Level '+unit.level+(unit.hp?' · HP '+unit.hp+' · ATK '+unit.attack:'')+(equip?(isEquipped?" · Equipped":" · Not equipped"):"")+'</small></button>';
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
    return navigate("fight");
  }
  if (action.startsWith("unit:")) {
    const unit = save.units[Number(action.split(":")[1])];
    if (!unit) return;
    const cost = (unit.upgradeCost || 100)*unit.level;
    if (save.xp < cost) return notify("Not enough XP!");
    save.xp -= cost; unit.level++;
    playSfx("upgrade");
    render(); notify(unit.name+" upgraded!");
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
    case "fight": navigate("fight"); break;
    case "lose": playSfx("defeat"); navigate("battle"); break;
    case "win": {
      playSfx("victory");
      save.xp += 250; save.missions = (save.missions||0)+1; save.stageClears = (save.stageClears||0)+1;
      save.level = Math.max(save.level,1+Math.floor(save.xp/1000));
      let reward = "Victory! +250 XP";
      if (save.stageClears === 1 && !save.units.some(unit => unit.name === "Tank Cat")) {
        save.units.push({id:2,name:"Tank Cat",level:1,deployCost:150,upgradeCost:400,hp:300,attack:8,range:110,speed:6,recharge:6});
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