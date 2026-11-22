// gameplay.js: удары, добыча, еда, голод, смерть, овцы и бараны, прицел
// ---------- Эффекты: щепки и пыль при ударах ----------
const chipGeo = new THREE.BoxGeometry(.09, .09, .09);
function spawnChips(pos, color, n = 7) {
  const mat = new THREE.MeshStandardMaterial({ color });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(chipGeo, mat); m.position.copy(pos); scene.add(m);
    particles.push({ m, vx: (Math.random() - .5) * 3, vy: 1.5 + Math.random() * 2.5, vz: (Math.random() - .5) * 3, life: .7 });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy -= 12 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); }
  }
}

// ---------- Действия игрока ----------
const AXE_DMG = { small_axe: 1, wooden_axe: 2, stone_axe: 3 };
const PICK_DMG = { wooden_pickaxe: 1, stone_pickaxe: 2 };
const WEAPON_DMG = { small_axe: 2, wooden_axe: 3, stone_axe: 4, wooden_pickaxe: 2, stone_pickaxe: 3, sword: 7, hammer: 4 };
const heldItem = () => selectedSlot >= 0 ? inventory[selectedSlot] : null;
function swing() { sfx("swing"); swingUntil = performance.now() + 360; }
function wearTool(item) {
  if (!item || item.durability == null) return;
  item.durability--;
  if (item.durability <= 0) { notify(`${names[item.type]} сломан`); inventory[selectedSlot] = null; }
  renderAll();
}
function useOne(item) { sfx("eat"); item.count--; if (item.count <= 0) inventory[selectedSlot] = null; renderAll(); }
function removeObstacle(e) { const k = obstacles.findIndex(o => o.entity === e); if (k >= 0) obstacles.splice(k, 1); }
function removeFrom(list, e) { const k = list.indexOf(e); if (k >= 0) list.splice(k, 1); }

function collectPickup(p) {
  if (addItem(p.type, 1)) {
    sfx("pop"); gone.add(p.id);
    scene.remove(p.root); removeFrom(pickups, p); currentTarget = null;
    notify(`+1 ${names[p.type]}`);
  }
}
function fellTree(t) {
  removeFrom(trees, t); removeObstacle(t); gone.add(t.id); sfx("fall");
  const dx = t.root.position.x - player.x, dz = t.root.position.z - player.z, d = Math.hypot(dx, dz) || 1;
  dying.push({ kind: "tree", root: t.root, t: 0, dx: dx / d, dz: dz / d });
  addItem("wood", 3); notify("Дерево упало · +3 ветки");
}
function breakRock(r) {
  removeFrom(rocks, r); removeObstacle(r); gone.add(r.id); sfx("break");
  dying.push({ kind: "rock", root: r.root, t: 0 });
  addItem("stone", 3); notify("Камень разбит · +3 камня");
}
function hitTree(t, item) {
  if (!(item && AXE_DMG[item.type])) { notify("Нужен топор"); return; }
  swing(); t.hp -= AXE_DMG[item.type]; t.shake = .3;
  sfx("chop"); spawnChips(targetPoint, 0x8a5a2b); addItem("wood", 1);
  wearTool(item);
  if (t.hp <= 0) fellTree(t);
}
function hitRock(r, item) {
  if (!(item && PICK_DMG[item.type])) { notify("Нужна кирка"); return; }
  swing(); r.hp -= PICK_DMG[item.type]; r.shake = .3;
  sfx("clink"); spawnChips(targetPoint, 0xb5babd); addItem("stone", 1);
  wearTool(item);
  if (r.hp <= 0) breakRock(r);
}
function hitSheep(s, item) {
  swing();
  s.hp -= (item && WEAPON_DMG[item.type]) || 1; s.hitT = .3;
  sfx("thud"); sfx("bleat"); spawnChips(targetPoint, 0xb02a2a, 6);
  wearTool(item);
  if (s.hp <= 0) {
    makeCarcass(s); scene.remove(s.root); removeFrom(sheep, s); currentTarget = null;
    notify(`${s.name} убит${s.male ? "" : "а"}`);
  } else if (s.male) { s.state = "charge"; s.timer = 6; s.cooldown = 0; }
  else { s.state = "flee"; s.timer = 4; }
}
function butcher(c) {
  swing(); spawnChips(c.root.position.clone().setY(c.root.position.y + .5), 0xb02a2a, 8);
  addItem("raw_meat", 2); addItem("bone", 2); addItem("wool", 2 + Math.floor(Math.random() * 2));
  scene.remove(c.root); removeFrom(carcasses, c); currentTarget = null;
  notify("Разделано: мясо, кости, шерсть");
}
function placeTable() {
  const x = player.x - Math.sin(player.yaw) * 2.4, z = player.z - Math.cos(player.yaw) * 2.4;
  placed.push({ type: "workbench", x, z }); makeWorkbench(x, z);
  inventory[selectedSlot] = null; renderAll(); notify("Верстак установлен");
}
function useHand() {
  if (player.dead || modalOpen) return;
  if (player.sleeping) return;
  const item = heldItem(), t = currentTarget;
  { const nowMs = performance.now(); if (nowMs < nextUseAt) return; nextUseAt = nowMs + cooldownFor(item, t) * 1000; }
  if (t) {
    if (t.struct && item && item.type === "hammer") return demolish(t, item);
    if (t.kind === "bed") return startSleep(t);
    if (t.kind === "furnace" || t.kind === "chest") return openContainer(t);
    if (t.kind === "pickup") return collectPickup(t);
    if (t.kind === "workbench") return openModal(true);
    if (t.kind === "carcass") return butcher(t);
    if (t.kind === "tree") return hitTree(t, item);
    if (t.kind === "rock") return hitRock(t, item);
    if (t.kind === "sheep") return hitSheep(t, item);
    if (t.kind === "ground") return dig(t, item);
  }
  if (!item) return;
  if (ITEM_STRUCT[item.type]) return placeFromHand(item);
  if (ARMOR[item.type]) return equipHeld(item);
  if (berryFood[item.type]) {
    if (hungerFull()) { notify("Вы не голодны"); return; }
    player.hunger = Math.min(100, player.hunger + berryFood[item.type]);
    notify(`+${berryFood[item.type]} сытости`); useOne(item); return;
  }
  if (item.type === "cooked_meat") {
    if (hungerFull()) { notify("Вы не голодны"); return; }
    player.hunger = Math.min(100, player.hunger + 30);
    notify("+30 сытости"); useOne(item); return;
  }
  if (item.type === "raw_meat") {
    if (hungerFull()) { notify("Вы не голодны"); return; }
    player.hunger = Math.min(100, player.hunger + 12);
    notify("+12 сытости"); useOne(item); return;
  }
  if (item.type === "bandage") {
    if (healthFull()) { notify("Здоровье полное"); return; }
    player.health = Math.min(100, player.health + 30);
    notify("+30 здоровья"); useOne(item); return;
  }
  swing();
}

// ---------- Здоровье, голод, смерть ----------
function die() {
  if (player.dead) return;
  player.dead = true; handHeld = false; resetInput();
  if (modalOpen) closeModal();
  deadEl.style.display = "flex"; onDeath();
}
function hurtPlayer(n, fx, fz) {
  if (player.dead) return;
  n *= 1 - armorDefense() / 100; sfx("hurt");
  player.health = Math.max(0, player.health - n);
  damageFlashTimer = 1.2;
  if (fx !== undefined) {
    const dx = player.x - fx, dz = player.z - fz, d = Math.hypot(dx, dz) || 1;
    player.knockX = dx / d * 9; player.knockZ = dz / d * 9;
  }
  if (player.health <= 0) die();
}
function survival(dt) {
  player.hunger = Math.max(0, player.hunger - dt * .12);
  if (player.hunger <= 0) {
    starvationTimer += dt;
    if (starvationTimer >= 2) { starvationTimer = 0; hurtPlayer(3); }
  } else {
    starvationTimer = 0;
    if (player.hunger > 60 && player.health < 100) player.health = Math.min(100, player.health + dt * .6);
  }
}

// ---------- Овцы и бараны ----------
function updateSheep(dt) {
  for (const s of sheep) {
    const r = s.root;
    s.phase += dt; s.cooldown = Math.max(0, s.cooldown - dt); s.timer -= dt;
    if (s.hitT > 0) s.hitT -= dt;
    const dx = player.x - r.position.x, dz = player.z - r.position.z, d = Math.hypot(dx, dz) || 1;
    let speed = 0, hx = 0, hz = 0;
    if (s.state === "wander") {
      if (s.timer <= 0) { s.timer = 2 + Math.random() * 4; s.moving = Math.random() < .55; s.wander = Math.random() * 6.283; }
      if (s.moving) { speed = 1.2; hx = Math.cos(s.wander); hz = Math.sin(s.wander); }
      if (s.male && !player.dead && s.cooldown <= 0 && d < 8) { s.state = "charge"; s.timer = 6; }
    } else if (s.state === "charge") {
      hx = dx / d; hz = dz / d; speed = 5.5;
      if (player.dead || s.timer <= 0 || d > 16) { s.state = "wander"; s.timer = 1; }
      else if (d < 1.6 && s.cooldown <= 0) {
        hurtPlayer(12, r.position.x, r.position.z);
        s.cooldown = 3.5; s.state = "retreat"; s.timer = 1.6;
      }
    } else if (s.state === "retreat") {
      hx = -dx / d; hz = -dz / d; speed = 3;
      if (s.timer <= 0) { s.state = "wander"; s.timer = 1; }
    } else if (s.state === "flee") {
      hx = -dx / d; hz = -dz / d; speed = 4.5;
      if (s.timer <= 0) { s.state = "wander"; s.timer = 1; }
    }
    if (speed > 0) {
      r.position.x = Math.max(-140, Math.min(140, r.position.x + hx * speed * dt));
      r.position.z = Math.max(-140, Math.min(140, r.position.z + hz * speed * dt));
      const want = Math.atan2(-hz, hx);
      let diff = want - r.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      r.rotation.y += diff * Math.min(1, dt * 7);
    }
    r.position.y = heightAt(r.position.x, r.position.z);
    const freq = speed > 2 ? 14 : 8, stride = speed > 0 ? 1 : 0;
    s.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(s.phase * freq + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * .5 * stride; });
    s.head.rotation.z = s.state === "charge" ? -.6 : Math.sin(s.phase * 1.5) * .08;
    s.body.position.y = .8 + Math.abs(Math.sin(s.phase * freq)) * .04 * stride;
  }
}

// ---------- Тряска и падение объектов ----------
function updateEntities(dt) {
  for (const list of [trees, rocks]) for (const e of list) {
    if (e.shake > 0) { e.shake -= dt; e.root.rotation.z = e.shake > 0 ? Math.sin(e.shake * 55) * e.shake * .22 : 0; }
  }
  for (let i = dying.length - 1; i >= 0; i--) {
    const d = dying[i]; d.t += dt;
    if (d.kind === "tree") {
      const a = Math.min(Math.PI / 2, d.t * d.t * 2.6);
      d.root.rotation.z = -d.dx * a; d.root.rotation.x = d.dz * a;
      if (d.t > 2.4) { scene.remove(d.root); dying.splice(i, 1); }
    } else {
      d.root.scale.setScalar(Math.max(.001, 1 - d.t * 3.5));
      if (d.t > .3) { scene.remove(d.root); dying.splice(i, 1); }
    }
  }
}

// ---------- Прицел и подсветка цели ----------
function updateTarget() {
  const roots = [];
  for (const list of [trees, rocks, sheep, carcasses, workbenches, structures, pickups]) for (const e of list) {
    const dx = e.root.position.x - player.x, dz = e.root.position.z - player.z;
    if (dx * dx + dz * dz < 30) roots.push(e.root);
  }
  let found = null;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  if (roots.length) {
    const hits = raycaster.intersectObjects(roots, true);
    if (hits.length) { found = hits[0].object.userData.entity || null; targetPoint.copy(hits[0].point); }
  }
  if (!found) { // помощь прицеливания для мелких предметов на земле
    camera.getWorldDirection(camDir);
    let best = .93;
    for (const p of pickups) {
      tmpV.set(p.root.position.x - camera.position.x, p.root.position.y + .1 - camera.position.y, p.root.position.z - camera.position.z);
      const d = tmpV.length(); if (d > 3.4 || d < .001) continue;
      const dot = tmpV.dot(camDir) / d;
      if (dot > best) { best = dot; found = p; targetPoint.copy(p.root.position); }
    }
  }
  currentTarget = found || groundTarget();
}
function targetInfo(t, item) {
  if (item && item.type === "hammer" && t.struct) return ["Разобрать молотком", ""];
  switch (t.kind) {
    case "pickup": return ["Подобрать", ""];
    case "workbench": return ["Открыть верстак", ""];
    case "tree": return [AXE_DMG[item && item.type] ? "Рубить" : "Нужен топор", `Прочность ${t.hp}/${t.maxHp}`];
    case "rock": return [PICK_DMG[item && item.type] ? "Добывать" : "Нужна кирка", `Прочность ${t.hp}/${t.maxHp}`];
    case "sheep": return ["Атаковать", `Здоровье ${Math.max(0, Math.ceil(t.hp))}/6`];
    case "furnace": return ["Открыть печь", ""];
    case "chest": return ["Открыть сундук", ""];
    case "bed": return ["Лечь спать", ""];
    case "ground": return [SHOVEL[item && item.type] ? "Копать" : "Нужна лопата", `Глубина ${t.hp}/${t.maxHp}`];
    case "carcass": return ["Разделать: мясо, кости, шерсть", ""];
  }
  return ["", ""];
}
function updateTargetUI() {
  const t = currentTarget;
  crosshairEl.classList.toggle("target", !!t);
  if (!t) { if (lastTargetKey !== "") { targetBoxEl.style.display = "none"; lastTargetKey = ""; } neonBox.visible = false; digMarker.visible = false; return; }
  const item = heldItem();
  const key = `${t.kind}|${t.hp}|${item ? item.type : ""}|${t.name}`;
  if (key !== lastTargetKey) {
    lastTargetKey = key;
    const [action, dur] = targetInfo(t, item);
    $("targetName").textContent = t.name; $("targetAction").textContent = action; $("targetDurability").textContent = dur;
    targetBoxEl.style.display = "block";
  }
  if (t.root) { neonBox.box.setFromObject(t.root); neonBox.visible = true; digMarker.visible = false; }
  else { neonBox.visible = false; digMarker.visible = true; digMarker.position.set(targetPoint.x, targetPoint.y + .06, targetPoint.z); }
}
targetBoxEl.addEventListener("click", () => useHand());
