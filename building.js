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
  if (e) { e.rec = r; e.struct = r.type; alignToGround(e.root, r.x, r.z, r.rot || 0); }
  return e;
}
function blockedPlace(x, z, r) {
  for (const o of obstacles) if (Math.hypot(o.x - x, o.z - z) < o.radius + r) return true;
  return false;
}
// ---------- Куда можно поставить ----------
const FOOT = {   // размеры занимаемого места: ширина, высота, глубина и радиус "личного пространства"
  workbench: { w: 1.7, h: 1.25, d: 1.35, r: 1.1 }, bed: { w: .95, h: .3, d: 2.05, r: 1.15 },
  furnace: { w: 1.3, h: 1.6, d: 1.1, r: 1.0 }, chest: { w: 1.05, h: .8, d: .75, r: .85 }
};
const _up = new THREE.Vector3(0, 1, 0), _nrm = new THREE.Vector3(), _dir = new THREE.Vector3();
// Постройка ложится на землю и наклоняется вместе со склоном
function alignToGround(root, x, z, rot) {
  const d = .6;
  _nrm.set(heightAt(x - d, z) - heightAt(x + d, z), 2 * d, heightAt(x, z - d) - heightAt(x, z + d)).normalize();
  root.position.set(x, heightAt(x, z) - .03, z);
  root.quaternion.setFromUnitVectors(_up, _nrm);
  root.rotateY(rot || 0);
}
// Точка, куда смотрит игрок (если смотрит вниз), иначе перед ним
function placeSpot() {
  camera.getWorldDirection(_dir);
  if (_dir.y < -.04) for (let t = .8; t <= 5; t += .2) {
    const x = camera.position.x + _dir.x * t, y = camera.position.y + _dir.y * t, z = camera.position.z + _dir.z * t;
    if (y <= heightAt(x, z)) return { x, z };
  }
  return { x: player.x - Math.sin(player.yaw) * 2.6, z: player.z - Math.cos(player.yaw) * 2.6 };
}
function placeCheck(type, x, z, rot = player.yaw) {
  const f = FOOT[type];
  if (Math.hypot(x - player.x, z - player.z) < 1.1) return { ok: false, why: "Слишком близко к вам" };
  if (blockedPlace(x, z, f.r)) return { ok: false, why: "Мешает дерево, камень или постройка" };
  for (const e of structures) if (Math.hypot(e.x - x, e.z - z) < f.r + .4) return { ok: false, why: "Мешает другая постройка" };
  const cs = Math.cos(rot), sn = Math.sin(rot), hw = f.w / 2, hd = f.d / 2;
  let lo = 1e9, hi = -1e9, pit = 0;
  for (const [lx, lz] of [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    const px = x + lx * cs + lz * sn, pz = z - lx * sn + lz * cs;
    const h = heightAt(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); pit = Math.max(pit, digDepthAt(px, pz));
  }
  if (pit > .06) return { ok: false, why: "Нельзя ставить в яму" };
  if (hi - lo > .75) return { ok: false, why: "Слишком крутой склон" };
  return { ok: true, why: "" };
}
function placeFromHand(item) {
  const type = ITEM_STRUCT[item.type], sp = placeSpot(), chk = placeCheck(type, sp.x, sp.z);
  if (!chk.ok) { notify(chk.why); return; }
  const rec = { type, x: sp.x, z: sp.z, rot: player.yaw };
  placed.push(rec); spawnPlaced(rec);
  inventory[selectedSlot] = null; renderAll();
  sfx("thud"); notify("Поставлено: " + STRUCT[type].name);
}

// Прозрачный "призрак": зелёный, если можно поставить, красный, если нельзя
const ghost = new THREE.Group(); ghost.visible = false;
const ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x4cff6a, transparent: true, opacity: .4, depthWrite: false }));
const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xb8ffc4 }));
ghost.add(ghostBox); ghost.add(ghostEdges); scene.add(ghost);
const placeHintEl = document.createElement("div");
placeHintEl.style.cssText = "position:absolute;bottom:62px;left:50%;transform:translateX(-50%);display:none;padding:5px 12px;border-radius:8px;background:#17231ddd;font-size:13px;white-space:nowrap;border:1px solid #ffffff44";
document.getElementById("ui").appendChild(placeHintEl);
function updatePlaceGhost() {
  const item = heldItem(), type = item && ITEM_STRUCT[item.type];
  if (!type || player.dead || modalOpen || player.sleeping) { ghost.visible = false; placeHintEl.style.display = "none"; return; }
  const sp = placeSpot(), chk = placeCheck(type, sp.x, sp.z), f = FOOT[type];
  for (const m of [ghostBox, ghostEdges]) { m.scale.set(f.w, f.h, f.d); m.position.y = f.h / 2; }
  ghostBox.material.color.setHex(chk.ok ? 0x4cff6a : 0xff4040);
  ghostEdges.material.color.setHex(chk.ok ? 0xb8ffc4 : 0xff9a9a);
  alignToGround(ghost, sp.x, sp.z, player.yaw);
  ghost.visible = true;
  placeHintEl.style.display = "block";
  placeHintEl.style.color = chk.ok ? "#9dffb0" : "#ff9a9a";
  placeHintEl.textContent = chk.ok ? "✓ Можно поставить" : "✗ " + chk.why;
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
