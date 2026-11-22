// building.js: постройки игрока, сон, разборка молотком, перезарядка инструментов
const structures = [];   // постройки игрока (кроме верстака, он лежит в workbenches)
const STRUCT = {
  workbench: { item: "table", name: "Верстак" },
  bed: { item: "sleeping_bag", name: "Спальный мешок" },
  furnace: { item: "furnace", name: "Печь" },
  chest: { item: "chest", name: "Сундук" }
};
const ITEM_STRUCT = {};
for (const k in STRUCT) ITEM_STRUCT[STRUCT[k].item] = k;
let bedPos = null;   // где игрок спал в последний раз (там он появится после смерти)

// ---------- Перезарядка (КД) инструментов, секунды ----------
const COOLDOWN = {
  small_axe: .75, wooden_axe: .65, stone_axe: .55, wooden_pickaxe: .8, stone_pickaxe: .65,
  wooden_shovel: .7, stone_shovel: .55, sword: .45, hammer: .6
};
let nextUseAt = 0;
function cooldownFor(item, t) {
  if (t && t.kind === "pickup") return .25;
  if (t && (t.kind === "workbench" || t.kind === "bed" || t.kind === "furnace" || t.kind === "chest")) return .4;
  if (item && COOLDOWN[item.type]) return COOLDOWN[item.type];
  return .35;
}
function updateCooldownUI() {
  const el = document.getElementById("handButton");
  if (el) el.style.opacity = performance.now() < nextUseAt ? ".55" : "1";
}

// ---------- Модели ----------
function makeBed(x, z, rot) {
  const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z); root.rotation.y = rot;
  const bag = new THREE.Mesh(new THREE.BoxGeometry(.95, .18, 2.05), new THREE.MeshStandardMaterial({ color: 0x3d6fb5, roughness: 1 }));
  bag.position.y = .11; bag.castShadow = true; root.add(bag);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.97, .19, .12), new THREE.MeshStandardMaterial({ color: 0x2c4f86 }));
  stripe.position.set(0, .11, .35); root.add(stripe);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(.6, .12, .38), new THREE.MeshStandardMaterial({ color: 0xece7d6 }));
  pillow.position.set(0, .24, -.72); root.add(pillow);
  const entity = { kind: "bed", name: "Спальный мешок", root, x, z };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); structures.push(entity);
  return entity;
}

// Создаёт постройку по записи из сохранения или из руки игрока
function spawnPlaced(r) {
  let e = null;
  if (r.type === "workbench") e = makeWorkbench(r.x, r.z);
  else if (r.type === "bed") e = makeBed(r.x, r.z, r.rot || 0);
  else if (r.type === "furnace") e = makeFurnace(r);
  else if (r.type === "chest") e = makeChest(r);
  if (e) { e.rec = r; e.struct = r.type; if (r.rot !== undefined) e.root.rotation.y = r.rot; }
  return e;
}
function blockedPlace(x, z, r) {
  for (const o of obstacles) if (Math.hypot(o.x - x, o.z - z) < o.radius + r) return true;
  return false;
}
function placeFromHand(item) {
  const type = ITEM_STRUCT[item.type];
  const x = player.x - Math.sin(player.yaw) * 2.3, z = player.z - Math.cos(player.yaw) * 2.3;
  if (blockedPlace(x, z, 1.1)) { notify("Здесь нельзя поставить"); return; }
  const rec = { type, x, z, rot: player.yaw };
  placed.push(rec); spawnPlaced(rec);
  inventory[selectedSlot] = null; renderAll();
  sfx("thud"); notify("Поставлено: " + STRUCT[type].name);
}

// ---------- Молоток: разобрать свою постройку ----------
function demolish(e, item) {
  const info = STRUCT[e.struct];
  if (!info) return;
  if (e.rec && containerHasItems(e.rec)) { notify("Сначала опустошите"); return; }
  if (!canFit(info.item, 1)) { notify("Инвентарь заполнен"); return; }
  swing();
  scene.remove(e.root);
  removeFrom(workbenches, e); removeFrom(structures, e); removeObstacle(e); removeFrom(placed, e.rec);
  currentTarget = null;
  addItem(info.item, 1); sfx("break");
  notify("Разобрано: " + info.name);
  wearTool(item);
}

// ---------- Сон ----------
const sleepFadeEl = document.createElement("div");
sleepFadeEl.style.cssText = "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:6";
document.body.appendChild(sleepFadeEl);
let sleepT = -1, sleepBed = null, sleepDone = false;

function startSleep(bed) {
  if (sleepT >= 0 || player.dead) return;
  if (nightK < .25) { notify("Спать можно только ночью, после 18:00"); return; }
  sleepT = 0; sleepBed = bed; sleepDone = false;
  player.sleeping = true; handHeld = false; resetInput();
  bedPos = { x: bed.x, z: bed.z };
}
// true, пока игрок спит (обычное движение отключено)
function updateSleep(dt) {
  if (sleepT < 0) return false;
  sleepT += dt;
  if (sleepT < 1.2) sleepFadeEl.style.opacity = "0";
  else if (sleepT < 2.2) sleepFadeEl.style.opacity = String(sleepT - 1.2);
  else {
    if (!sleepDone) {
      sleepDone = true;
      dayTime = .02;
      player.health = Math.min(100, player.health + 40);
      player.hunger = Math.max(5, player.hunger - 15);
      notify("Вы выспались. Наступило утро");
      saveGame();
    }
    sleepFadeEl.style.opacity = sleepT < 3.2 ? String(1 - (sleepT - 2.2)) : "0";
  }
  if (sleepT >= 4) { sleepT = -1; player.sleeping = false; sleepFadeEl.style.opacity = "0"; }
  return true;
}
// Камера "ложится" на спальный мешок и смотрит в небо
function applySleepCam() {
  if (sleepT < 0 || !sleepBed) return;
  const k = sleepT < 1.2 ? sleepT / 1.2 : sleepT < 3.2 ? 1 : Math.max(0, 1 - (sleepT - 3.2) / .8);
  const gy = heightAt(sleepBed.x, sleepBed.z) + .45;
  camera.position.x += (sleepBed.x - camera.position.x) * k;
  camera.position.z += (sleepBed.z - camera.position.z) * k;
  camera.position.y += (gy - camera.position.y) * k;
  camera.rotation.x = player.pitch + (1.25 - player.pitch) * k;
}
