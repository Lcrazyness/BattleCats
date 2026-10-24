(() => {
"use strict";
const $ = (selector, root=document) => root.querySelector(selector);
const money = value => Number(value || 0).toLocaleString();
const defaults = {
  xp:14636, catFood:104, rareTickets:1, normalTickets:2,
  energy:100, maxEnergy:100, level:1, exp:0,
  units:[
    {id:1,name:"Macho Cat",level:1,cost:100},
    {id:2,name:"Tank Cat",level:1,cost:150},
    {id:3,name:"Axe Cat",level:1,cost:200}
  ],
  equipped:[1,2,3], mail:1, missions:0, sound:true, music:true, menuVersion:2
};
let save;
try {
  const old = JSON.parse(localStorage.getItem("battleCatsSave") || "{}");
  save = {...defaults, ...old};
  if (!Array.isArray(save.units)) save.units = defaults.units.map(unit => ({...unit}));
  if (!Array.isArray(save.equipped)) save.equipped = save.units.slice(0,3).map(unit => unit.id);
  if (save.menuVersion !== 2) {
    if (!old.menuVersion) {
      save.xp = defaults.xp;
      save.catFood = defaults.catFood;
    }
    save.menuVersion = 2;
  }
} catch {
  save = {...defaults, units:defaults.units.map(unit => ({...unit})), equipped:[1,2,3]};
}
let scene = "title";
let currentRegion = "empire";
let toastTimer = 0;
const stage = $(".stage");
const persist = () => {
  try { localStorage.setItem("battleCatsSave", JSON.stringify(save)); } catch {}
};
const gold = (label, action, small=false) =>
  '<button class="gold-button'+(small?' small':'')+'" data-go="'+action+'">'+label+'</button>';
const headBar = (label) =>
  '<div class="top-strip"><span class="top-title">'+label+'</span><span class="top-xp">XP<span class="top-xp-plus">＋</span></span><strong class="top-value">'+money(save.xp)+'</strong></div>';
const bottomBar = () =>
  '<div class="bottom-strip">'+
    '<button class="back-button" data-go="go:base" aria-label="Back">↶</button>'+
    '<button class="store-button" data-go="go:store"><span class="store-cart">🛒</span> STORE</button>'+
    '<button class="catfood-display" data-go="go:store"><span class="catfood-label">CAT FOOD</span><span class="catfood-can">🥫</span><strong class="catfood-number">'+money(save.catFood)+'</strong><span class="top-xp-plus">＋</span></button>'+
  '</div>';
const catHead = (className="") =>
  '<svg class="'+className+'" viewBox="0 0 180 195" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<path d="M25 72 L14 18 L61 46 Q90 29 119 46 L166 18 L155 73 Q180 95 176 128 Q171 177 91 185 Q11 178 5 129 Q1 96 25 72Z" fill="#fff" stroke="#111" stroke-width="7" stroke-linejoin="round"/>'+
    '<ellipse cx="57" cy="91" rx="7" ry="10" fill="#111"/><ellipse cx="123" cy="91" rx="7" ry="10" fill="#111"/>'+
    '<path d="M78 115 Q90 107 102 115 Q97 127 90 127 Q83 126 78 115Z" fill="#111"/>'+
    '<path d="M90 126 Q87 141 72 139 M90 126 Q94 141 108 139 M72 139 Q66 152 57 142 M108 139 Q115 152 123 142" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round"/>'+
  '</svg>';
const catBody = () =>
  '<svg viewBox="0 0 300 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<path d="M65 154 Q30 185 38 250 L45 354 L113 354 L127 272 L143 354 L218 354 L231 239 Q244 177 202 151Z" fill="#fff" stroke="#111" stroke-width="8" stroke-linejoin="round"/>'+
    '<path d="M69 192 Q19 208 21 259 Q20 285 43 284 L62 249 M204 187 Q258 209 257 251 Q257 278 233 280 L217 247" fill="#fff" stroke="#111" stroke-width="8" stroke-linecap="round"/>'+
    '<path d="M62 96 L45 18 L103 53 Q151 32 194 53 L254 19 L235 100 Q267 126 258 163 Q247 226 150 229 Q53 227 41 164 Q33 126 62 96Z" fill="#fff" stroke="#111" stroke-width="8" stroke-linejoin="round"/>'+
    '<ellipse cx="104" cy="119" rx="8" ry="12" fill="#111"/><ellipse cx="192" cy="119" rx="8" ry="12" fill="#111"/>'+
    '<path d="M133 145 Q150 133 167 145 Q160 158 150 158 Q140 158 133 145Z" fill="#111"/>'+
    '<path d="M150 157 Q146 176 126 174 M150 157 Q154 176 174 174 M126 174 Q119 187 109 177 M174 174 Q182 187 191 177" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>'+
  '</svg>';
const worldCrowd = () =>
  '<div class="title-crowd">'+Array.from({length:13},(_,i)=>'<div class="crowd-cat" style="transform:translateY('+(i%4*4)+'px)">'+catHead()+'</div>').join("")+'</div>';
function renderTitle() {
  return '<section class="screen title-screen">'+
    '<div class="title-sun"></div><div class="title-clouds"></div><div class="ruin ruin-left"></div><div class="ruin ruin-right"></div>'+
    '<div class="title-logo"><div class="logo-the">The</div><div class="logo-battle">Battle</div><div class="logo-cats">Cats</div><div class="logo-paw">●</div></div>'+
    '<div class="logo-cat">'+catHead()+'</div>'+worldCrowd()+
    '<div class="title-buttons">'+gold("Play","go:base")+gold("Settings","go:settings")+'</div>'+
    '<button class="title-mailbox" data-go="go:mailbox"><span class="mailbox-art">📮</span><span>Mailbox</span></button>'+
  '</section>';
}
function renderBase() {
  return '<section class="screen base-screen">'+headBar("CAT BASE")+
    '<div class="base-pattern"></div>'+
    '<div class="base-menu">'+
      gold("START!!","go:battle")+
      gold("UPGRADE","go:upgrade")+
      gold("EQUIP","go:equip")+
      gold("TREASURE","go:treasure")+
      gold("DICTIONARY","go:dictionary")+
    '</div>'+
    '<div class="cat-illustration">'+catBody()+'</div>'+
    '<div class="speech-bubble">Working-Cat earns money and it’s really important. Do invest in UPGRADE!!</div>'+
    bottomBar()+
  '</section>';
}
function renderWindow(label, content, back="base") {
  return '<section class="screen menu-screen">'+headBar(label.toUpperCase())+
    '<div class="menu-pattern"></div>'+
    '<div class="menu-window"><div class="menu-window-title">'+label+'</div><div class="menu-window-body">'+content+
    '<div class="screen-actions">'+gold("BACK","go:"+back)+'</div></div></div>'+
    bottomBar()+
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
    '<div class="menu-list">'+save.units.map((unit,i)=>row(unit.name,"Level "+unit.level+" · Next level costs "+(unit.level*100)+" XP","unit:"+i,"UPGRADE")).join("")+'</div>';
  return renderWindow("Upgrade",body,"base");
}
function renderDictionary(equip=false) {
  const body = pageCopy(equip?"Tap a cat to add or remove it from your battle lineup.":"Cats you have discovered are shown here.")+
    '<div class="cat-grid">'+save.units.map((unit,i)=>{
      const isEquipped = save.equipped.includes(unit.id);
      return '<button class="cat-tile" data-go="'+(equip?"equipunit:":"unitinfo:")+i+'"><div class="cat-tile-art">'+catHead()+'</div><strong>'+unit.name+'</strong><small>Level '+unit.level+(equip?(isEquipped?" · Equipped":" · Not equipped"):"")+'</small></button>';
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
    menu:["Menu","Save your game or open another menu.",[
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
  persist();
}
function navigate(next) {
  scene = next;
  render();
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
    const cost = unit.level*100;
    if (save.xp < cost) return notify("Not enough XP!");
    save.xp -= cost; unit.level++;
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
    case "win":
      save.xp += 250; save.missions = (save.missions||0)+1;
      save.level = Math.max(save.level,1+Math.floor(save.xp/1000));
      navigate("battle"); notify("Victory! +250 XP");
      break;
    case "rank":
      if (save.xp < 500) return notify("Not enough XP!");
      save.xp -= 500; save.level++; render(); notify("Rank increased!"); break;
    case "rare":
      if (save.rareTickets < 1) return notify("You need a Rare Ticket.");
      save.rareTickets--; recruit(true); break;
    case "normal":
      if (save.normalTickets < 1) return notify("You need a Normal Ticket.");
      save.normalTickets--; recruit(false); break;
    case "daily":
      if (save.missions < 1) return notify("Complete a stage first!");
      save.missions = 0; save.xp += 300; render(); notify("Mission reward: +300 XP"); break;
    case "dailyfood":
      save.catFood += 1; render(); notify("+1 Cat Food"); break;
    case "mission":
      save.xp += 100; save.missions = (save.missions||0)+1; render(); notify("Mission complete! +100 XP"); break;
    case "mailgift":
      if (!save.mail) return notify("You have already claimed this gift.");
      save.mail = 0; save.xp += 1000; render(); notify("Welcome gift claimed: +1,000 XP"); break;
    case "expedition": notify("Gamatoto has left on an expedition."); break;
    case "collect":
      save.xp += 100; render(); notify("Collected a demo reward: +100 XP"); break;
    case "save": persist(); notify("Game saved on this device."); break;
    case "reset":
      if (confirm("Reset all local demo progress? This cannot be undone.")) {
        save = {...defaults,units:defaults.units.map(unit=>({...unit})),equipped:[1,2,3]};
        persist(); navigate("title"); notify("Progress reset.");
      }
      break;
    case "sound": save.sound=!save.sound; render(); notify("Sound effects "+(save.sound?"on":"off")); break;
    case "music": save.music=!save.music; render(); notify("Music "+(save.music?"on":"off")); break;
    case "locked": notify("This stage is locked in the menu demo."); break;
    case "noop": notify("This item is for display in the menu demo."); break;
    default: notify("Coming soon!");
  }
}
stage.addEventListener("click", event=>{
  const button = event.target.closest("[data-go]");
  if (button) perform(button.dataset.go);
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