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
let scene = "title";
let currentRegion = "empire";
let toastTimer = 0;
let titleIntroPending = true;
let navigationTimer = null;
const stage = $(".stage");
const persist = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
};
const AUDIO_VERSION = "20261026-26";
const SOUND_FILES = {
  button: "sounds/button-click.ogg",
  select: "sounds/menu-select.ogg",
  back: "sounds/back-cancel.ogg",
  blocked: "sounds/blocked-action.ogg",
  door: "sounds/cat-base-door.ogg",
  enterBattle: "sounds/enter-battle.ogg",
  stageSelect: "sounds/enter-battle.ogg",
  upgrade: "sounds/upgrade.ogg",
  victory: "sounds/victory.ogg",
  defeat: "sounds/defeat.ogg",
  reward: "sounds/reward.ogg",
  loginReward: "sounds/login-reward.ogg",
  capsule: "sounds/capsule-draw.ogg"
};
const MUSIC_FILES = {
  title: "sounds/title-theme.ogg",
  menu: "sounds/menu-theme.ogg",
  battle: "sounds/battle-theme.ogg"
};
const activeSfxPlayers = new Set();
let battleStartPlayer = null;
let audioUnlocked = false;
let musicPlayer = null;
let currentMusicKey = "";

const mainScript = document.querySelector('script[src*="src/main.js"]');
const APP_BASE_URL = new URL("../", mainScript ? mainScript.src : document.baseURI);

function audioPath(path) {
  return new URL(path + "?v=" + AUDIO_VERSION, APP_BASE_URL).href;
}

function playSfx(key) {
  if (!save.sound || !SOUND_FILES[key] || typeof Audio === "undefined") return;
  let player;
  try {
    player = new Audio(audioPath(SOUND_FILES[key]));
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
    player.addEventListener("error", () => {
      cleanup();
      console.error("Battle Cats sound asset failed to load:", key, player.currentSrc, player.error);
      notify("Couldn't load sound: " + key);
    }, {once:true});
    const promise = player.play();
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
  if (audioUnlocked) return;
  audioUnlocked = true;
  syncMusicForScene(scene);
}
document.addEventListener("pointerdown", unlockAndStartCurrentMusic, {capture:true, once:true});
document.addEventListener("keydown", unlockAndStartCurrentMusic, {capture:true, once:true});

function syncMusicForScene(targetScene = scene) {
  if (!audioUnlocked || typeof Audio === "undefined") return;
  if (!save.music) {
    if (musicPlayer) {
      musicPlayer.pause();
      musicPlayer.currentTime = 0;
    }
    musicPlayer = null;
    currentMusicKey = "";
    return;
  }

  const nextKey = targetScene === "title" ? "title" : targetScene === "fight" ? "battle" : "menu";

  // Let the battle-entry sound finish before starting the battle theme.
  if (targetScene === "fight" && battleStartPlayer && !battleStartPlayer.ended) {
    if (musicPlayer) {
      musicPlayer.pause();
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
      const resumePromise = musicPlayer.play();
      if (resumePromise && typeof resumePromise.catch === "function") resumePromise.catch(() => {});
    }
    return;
  }

  if (musicPlayer) {
    musicPlayer.pause();
    musicPlayer.currentTime = 0;
  }
  musicPlayer = new Audio(audioPath(MUSIC_FILES[nextKey]));
  musicPlayer.loop = true;
  musicPlayer.preload = "auto";
  musicPlayer.volume = 0.24;
  currentMusicKey = nextKey;
  const activePlayer = musicPlayer;
  const promise = activePlayer.play();
  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {
      if (musicPlayer === activePlayer) {
        musicPlayer = null;
        currentMusicKey = "";
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

function renderTitle() {
  const animateButtons = titleIntroPending;
  titleIntroPending = false;
  return '<section class="screen title-screen real-title-screen">'+
    '<div class="real-title-frame">'+
      '<img class="title-background-sprite" src="sprites/backgrounds/titlescreenmenu.png?v=20261026-9" alt="" draggable="false">'+
      '<button class="title-hotspot title-sprite-button title-play'+(animateButtons?' title-intro-play':'')+'" data-go="go:base" aria-label="Play"><img src="sprites/ui/Play_button.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="title-hotspot title-sprite-button title-settings'+(animateButtons?' title-intro-settings':'')+'" data-go="go:settings" aria-label="Settings"><img src="sprites/ui/title-settings.png?v=20261026-9" alt="" draggable="false"></button>'+
      '<button class="title-hotspot title-sprite-button title-mailbox" data-go="go:mailbox" aria-label="Mailbox"><img src="sprites/ui/title-mailbox.png?v=20261026-9" alt="" draggable="false"></button>'+
    '</div>'+
  '</section>';
}
function renderBase() {
  return '<section class="screen base-sprite-screen">'+
    '<div class="base-sprite-frame">'+
      '<img class="base-background-sprite" src="sprites/backgrounds/bg_restored.png?v=20261026-9" alt="" draggable="false">'+
    '<img class="base-backboard-sprite" src="sprites/ui/backboard.png?v=20261026-25" alt="" draggable="false">'+
      '<button class="base-sprite-button base-start" data-go="go:battle" aria-label="Start battle"><img src="sprites/ui/startbutton.png?v=20261026-9" alt="" draggable="false"></button>'+
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
      '<button class="base-sprite-button base-cat-food" data-go="go:store" aria-label="Cat Food store"><img src="sprites/ui/base-cat-food.png?v=20261026-9" alt="" draggable="false"></button>'+
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
  const body = pageCopy("Choose where to send your cats.")+
    '<div class="menu-list">'+
      row("Empire of Cats","The first steps to conquering the world.","stage:empire","CHOOSE")+
      row("Into the Future","A new adventure beyond Earth.","stage:future","CHOOSE")+
      row("Cats of the Cosmos","Explore the far reaches of space.","stage:cosmos","CHOOSE")+
      row("Legend Stages","Special stages with powerful enemies.","stage:legend","CHOOSE")+
      row("Event Stages","Limited-time challenges.","stage:event","CHOOSE")+
    '</div>';
  return renderWindow("Select a Stage",body,"base");
}
function renderStage() {
  const locations = currentRegion==="future" ? ["Moon","Japan","New York","Brazil","Madagascar","Great Abyss"] : currentRegion==="cosmos" ? ["The Big Bang","Andromeda","Black Hole","Catseye Nebula","Finale"] : ["Japan","Korea","China","Mongolia","Russia","Australia"];
  const body = pageCopy((currentRegion==="future"?"INTO THE FUTURE":currentRegion==="cosmos"?"CATS OF THE COSMOS":currentRegion==="legend"?"LEGEND STAGES":currentRegion==="event"?"EVENT STAGES":"EMPIRE OF CATS")+" · CHAPTER 1")+
    '<div class="meter"><span style="width:8%"></span></div>'+
    '<div class="menu-list">'+locations.map((name,i)=>row(name,i===0?"Clear to earn XP and continue.":"Stage not cleared",i===0?"go:fight":"locked",i===0?"BATTLE":"LOCKED")).join("")+'</div>';
  return renderWindow("Choose a Stage",body,"battle");
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
    case "title": html=renderTitle(); break;
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
function perform(action) {
  if (!action) return;
  if (action.startsWith("go:")) return navigate(action.slice(3));
  if (action.startsWith("stage:")) { currentRegion = action.slice(6); return navigate("stage"); }
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

  playSfx(isStageChoice ? "enterBattle" : "button");
  if (action) perform(action);
});
document.addEventListener("keydown", event=>{
  if (event.key==="Escape") {
    if (scene==="title") return;
    if (scene==="base") navigate("title");
    else if (scene==="stage") navigate("battle");
    else if (scene==="battle") navigate("base");
    else navigate("base");
  }
});
render();
})();