// core.js: сцена, свет, рельеф, игрок, данные предметов, инвентарь (базовые функции)
// Одинаковый "случайный" мир при каждом запуске (нужно для сохранений)
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261122);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 150);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xdff4ff, 0x53613d, 2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
sun.position.set(-25, 38, 18);
sun.castShadow = true;
scene.add(sun); scene.add(sun.target);
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sun.shadow.camera.updateProjectionMatrix();

// Две ровные площадки (спавн и место для дома), остальное холмистое и "кривое"
const PLATEAUS = [{ x: 0, z: 8, r: 9, h: 1.0 }, { x: 45, z: -35, r: 15, h: 1.6 }];
const PLATEAU_FADE = 16;
function baseHeight(x, z) {
  const wx = x + Math.sin(z * 0.07) * 5, wz = z + Math.cos(x * 0.06) * 5;
  return Math.sin(wx * 0.04) * Math.cos(wz * 0.04) * 4.2 + Math.sin(wx * 0.11 + wz * 0.08) * 1.2 + Math.cos(wz * 0.13) * 0.8 +
    Math.sin(wx * 0.021 - wz * 0.017 + 1.7) * 2.6 + Math.sin(wx * 0.29 + wz * 0.37) * 0.28 + Math.cos(wx * 0.41) * Math.sin(wz * 0.33) * 0.22;
}
function plateauK(x, z) {
  let k = 0;
  for (const p of PLATEAUS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r + PLATEAU_FADE) { const u = d <= p.r ? 1 : 1 - (d - p.r) / PLATEAU_FADE; k = Math.max(k, u * u * (3 - 2 * u)); }
  }
  return k;
}
// Вид почвы: песок в низинах, глина в рыжих пятнах, остальное земля
const SAND_H = -2.6;
function clayK(x, z) { return Math.sin(x * 0.031 + 1) * Math.cos(z * 0.037 + 3) + Math.sin(x * 0.09 + z * 0.07) * 0.25; }
function soilAt(x, z) {
  if (plateauK(x, z) > 0.5) return "dirt";
  if (baseHeight(x, z) < SAND_H) return "sand";
  if (clayK(x, z) > 0.7) return "clay";
  return "dirt";
}
// Ямы, которые выкопал игрок (хранятся по клеткам 4x4 для быстрого поиска)
const digs = [], digCells = new Map(), DIG_R = 3.2;
const cellKey = (cx, cz) => cx + "," + cz;
function addDig(x, z, n) {
  const d = { x, z, n }; digs.push(d);
  const k = cellKey(Math.floor(x / 4), Math.floor(z / 4));
  if (!digCells.has(k)) digCells.set(k, []);
  digCells.get(k).push(d); return d;
}
function digDepthAt(x, z) {
  if (!digs.length) return 0;
  const cx = Math.floor(x / 4), cz = Math.floor(z / 4); let best = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = digCells.get(cellKey(cx + i, cz + j)); if (!list) continue;
    for (const d of list) {
      const r = Math.hypot(x - d.x, z - d.z) / DIG_R;
      if (r < 1) { const f = 1 - r * r, v = d.n * 0.3 * f * f; if (v > best) best = v; }
    }
  }
  return best;
}
function heightAt(x, z) {
  let h = baseHeight(x, z);
  for (const p of PLATEAUS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r + PLATEAU_FADE) { const u = d <= p.r ? 1 : 1 - (d - p.r) / PLATEAU_FADE, s = u * u * (3 - 2 * u); h += (p.h - h) * s; }
  }
  return h - digDepthAt(x, z);
}
const terrainGeo = new THREE.PlaneGeometry(300, 300, 120, 120);
terrainGeo.rotateX(-Math.PI / 2);
let terrainColOrig = null;
{
  const pos = terrainGeo.attributes.position, col = new Float32Array(pos.count * 3);
  const cLow = new THREE.Color(0x3f7a3a), cMid = new THREE.Color(0x5c9b50), cHigh = new THREE.Color(0x8d8a80);
  const cDirt = new THREE.Color(0x8a6b45), cClean = new THREE.Color(0x73b25a), cSand = new THREE.Color(0xd9c988), cClay = new THREE.Color(0xa86f4c), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // чуть сдвигаем узлы сетки, чтобы земля не выглядела ровной решёткой
    const ox = pos.getX(i), oz = pos.getZ(i);
    const x = ox + Math.sin(ox * 12.9898 + oz * 78.233) * 0.5, z = oz + Math.cos(ox * 39.3468 + oz * 11.135) * 0.5;
    const h = heightAt(x, z);
    pos.setXYZ(i, x, h, z);
    if (h < 0.5) c.copy(cLow).lerp(cMid, THREE.MathUtils.clamp((h + 3) / 3.5, 0, 1));
    else c.copy(cMid).lerp(cHigh, THREE.MathUtils.clamp((h - 2.5) / 3, 0, 1));
    const patch = Math.sin(x * 0.05 + 2) * Math.cos(z * 0.043 - 1) + Math.sin(x * 0.13) * 0.3;
    if (patch > 0.7) c.lerp(cDirt, THREE.MathUtils.clamp((patch - 0.7) * 3, 0, 0.75));
    c.lerp(cClean, plateauK(x, z) * 0.7);
    const soil = soilAt(x, z);
    if (soil === "sand") c.lerp(cSand, 0.85); else if (soil === "clay") c.lerp(cClay, 0.8);
    const j = (rand() - 0.5) * 0.05;
    col[i * 3] = c.r + j; col[i * 3 + 1] = c.g + j; col[i * 3 + 2] = c.b + j;
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  terrainColOrig = col.slice();
  terrainGeo.computeVertexNormals();
}
const ground = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
ground.receiveShadow = true;
scene.add(ground);

const player = {
  x: 0, z: 8, y: 0, vy: 0, yaw: 0, pitch: 0, grounded: true,
  health: 100, hunger: 100, armorSlots: { helmet: null, chest: null, legs: null, boots: null, shield: null }, dead: false, knockX: 0, knockZ: 0
};
const pickups = [], trees = [], rocks = [], sheep = [], carcasses = [], workbenches = [], obstacles = [];
const raycaster = new THREE.Raycaster(); raycaster.far = 3.5;
const inventory = Array(30).fill(null);
const craftSlots = Array(9).fill(null);
const names = {
  wood:"Ветка", stone:"Маленький камень", plank:"Доска", stick:"Палка",
  table:"Верстак", small_axe:"Маленький топор", wooden_pickaxe:"Деревянная кирка",
  wooden_axe:"Деревянный топор", stone_pickaxe:"Каменная кирка", stone_axe:"Каменный топор",
  sword:"Меч", hammer:"Молоток", berry_wild:"Лесная ягода", berry_blue:"Синяя ягода",
  berry_red:"Красная ягода", raw_meat:"Сырое мясо", bone:"Кость", wool:"Шерсть",
  bandage:"Бинт", brick:"Кирпич", glass:"Стекло", cooked_meat:"Жареное мясо", furnace:"Печь", chest:"Сундук",
  wooden_shovel:"Деревянная лопата", stone_shovel:"Каменная лопата", dirt:"Земля", clay:"Глина", sand:"Песок", coal:"Уголь", ruby:"Рубин", sapphire:"Сапфир", emerald:"Изумруд", diamond:"Алмаз",
  bone_helmet:"Костяной шлем", bone_chest:"Костяной нагрудник", bone_pants:"Костяные штаны", bone_boots:"Костяные ботинки", bone_shield:"Костяной щит", sleeping_bag:"Спальный мешок"
};
const icons = {
  wood:"🪵",stone:"🪨",plank:"🟫",stick:"🥢",table:"🪚",small_axe:"🪓",
  wooden_pickaxe:"⛏️",wooden_axe:"🪓",stone_pickaxe:"⛏️",stone_axe:"🪓",
  sword:"🗡️",hammer:"🔨",berry_wild:"🫐",berry_blue:"🔵",berry_red:"🔴",
  raw_meat:"🥩",bone:"🦴",wool:"🧶",bandage:"🩹",brick:"🧱", glass:"🪟", cooked_meat:"🍖", furnace:"🔥", chest:"📦",
  wooden_shovel:"🥄", stone_shovel:"🥄", dirt:"🟤", clay:"🟧", sand:"🟨", coal:"⚫", ruby:"♦️", sapphire:"🔷", emerald:"🟢", diamond:"💎",
  bone_helmet:"⛑️", bone_chest:"🦺", bone_pants:"👖", bone_boots:"🥾", bone_shield:"🛡️",sleeping_bag:"🛏️"
};
const berryFood = { berry_wild:5, berry_blue:5, berry_red:5 };
const durabilityMax = { small_axe:35, wooden_axe:65, stone_axe:130, wooden_pickaxe:60, stone_pickaxe:125, sword:90, hammer:110, wooden_shovel:50, stone_shovel:110 };
const nonStackable = new Set(["small_axe","wooden_axe","stone_axe","wooden_pickaxe","stone_pickaxe","sword","hammer","table","furnace","chest","wooden_shovel","stone_shovel","bone_helmet","bone_chest","bone_pants","bone_boots","bone_shield","sleeping_bag"]);

// Броня: слот и защита в процентах (сумма не больше 80%)
const ARMOR = {
  bone_helmet: { slot: "helmet", def: 8 }, bone_chest: { slot: "chest", def: 20 }, bone_pants: { slot: "legs", def: 14 },
  bone_boots: { slot: "boots", def: 8 }, bone_shield: { slot: "shield", def: 12 }
};
const ARMOR_SLOTS = [["helmet", "Шлем", "⛑️"], ["chest", "Нагрудник", "🦺"], ["legs", "Штаны", "👖"], ["boots", "Ботинки", "🥾"], ["shield", "Щит", "🛡️"]];
function armorDefense() {
  let d = 0;
  for (const k in player.armorSlots) { const it = player.armorSlots[k]; if (it && ARMOR[it.type]) d += ARMOR[it.type].def + (it.bonus || 0); }
  return Math.min(80, d);
}
// Сытость и здоровье "полные", если на экране показано 100
const hungerFull = () => Math.ceil(player.hunger) >= 100;
const healthFull = () => Math.ceil(player.health) >= 100;
const GEM_COLORS = { ruby: 0xd0213a, sapphire: 0x2a5ad8, emerald: 0x1fae55, diamond: 0xbdeeff };
const MAT_COLORS = { dirt: 0x6b4f33, clay: 0xb5693c, sand: 0xe0cf8f, coal: 0x2b2b2b, brick: 0xb5502f, glass: 0xbfe8f5, stone: 0x858b8e };
// Что убрано из мира (для сохранения) и что игрок построил
const gone = new Set(), placed = [];
function addItemObj(it) {
  const i = inventory.findIndex(s => !s);
  if (i < 0) { notify("Инвентарь заполнен"); return false; }
  inventory[i] = it; renderAll(); return true;
}

let selectedSlot = -1, currentTarget = null, highlighted = null;
let modalOpen = false, workbenchCrafting = false, activeRecipe = null;
let toastTimer, nameTimer, longPress;
let hungerTimer = 0, starvationTimer = 0, walkTime = 0, pantTimer = 0, damageFlashTimer = 0;
let lastToolUse = 0, swingUntil = 0;
let handHoldTimer = null, ignoreHandClick = false;

const neonBox = new THREE.Box3Helper(new THREE.Box3(), 0xe9fff0);
neonBox.material.transparent = true; neonBox.material.opacity = 0.95; neonBox.visible = false;
scene.add(neonBox);

function notify(text) {
  const el = document.getElementById("toast");
  el.textContent = text; el.style.display = "block";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.style.display = "none", 1650);
}
function updateStatus() {
  document.getElementById("healthFill").style.width = `${player.health}%`;
  document.getElementById("hungerFill").style.width = `${player.hunger}%`;
  document.getElementById("healthText").textContent = `${Math.ceil(player.health)} / 100`;
  document.getElementById("hungerText").textContent = `${Math.ceil(player.hunger)} / 100`;
}
function showSelectedName() {
  const el = document.getElementById("heldName");
  const item = selectedSlot >= 0 ? inventory[selectedSlot] : null;
  if (!item) { el.style.display = "none"; return; }
  el.textContent = names[item.type] || item.type; el.style.display = "block";
  clearTimeout(nameTimer); nameTimer = setTimeout(() => el.style.display = "none", 2000);
}
function createItem(type, count = 1) {
  const item = { type, count };
  if (durabilityMax[type]) item.durability = durabilityMax[type];
  return item;
}
function canFit(type, amount) {
  if (nonStackable.has(type)) return inventory.filter(Boolean).length + amount <= inventory.length;
  let space = 0;
  for (const slot of inventory) {
    if (!slot) space += 99;
    else if (slot.type === type) space += 99 - slot.count;
  }
  return space >= amount;
}
function addItem(type, amount = 1) {
  let left = amount;
  if (nonStackable.has(type)) {
    while (left > 0) {
      const index = inventory.findIndex(slot => !slot);
      if (index < 0) break;
      inventory[index] = createItem(type, 1);
      left--;
    }
  } else {
    for (const slot of inventory) {
      if (slot?.type === type && slot.count < 99) {
        const n = Math.min(left, 99 - slot.count);
        slot.count += n; left -= n; if (!left) break;
      }
    }
    while (left > 0) {
      const index = inventory.findIndex(slot => !slot);
      if (index < 0) break;
      const n = Math.min(left, 99);
      inventory[index] = createItem(type, n); left -= n;
    }
  }
  renderAll();
  if (left) notify("Инвентарь заполнен");
  return amount - left;
}
function consumeOne(item) {
  if (!item) return null;
  if (nonStackable.has(item.type) || item.count <= 1) return null;
  item.count--; return item;
}
function itemSlotHTML(item) {
  if (!item) return "";
  const count = nonStackable.has(item.type) ? "" : `<small>${item.count}</small>`;
  const durability = item.durability != null ? `<span class="durability"><i style="width:${Math.max(0, item.durability / durabilityMax[item.type] * 100)}%"></i></span>` : "";
  return `${icons[item.type] || "?"}${count}${durability}`;
}
