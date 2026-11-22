// inventory.js: предметы в руке, рецепты, крафт, окно инвентаря и верстака
// ============ ДАЛЬШЕ: предметы в руке, крафт, инвентарь, овцы, управление, игровой цикл ============
const $ = id => document.getElementById(id);
const hotbarEl = $("hotbar"), inventoryGridEl = $("inventoryGrid"), craftGridEl = $("craftGrid");
const craftOutputEl = $("craftOutput"), recipeListEl = $("recipeList"), modalEl = $("modal");
const armorSlotEl = $("armorSlots"), armorTextEl = $("armorText"), targetBoxEl = $("targetBox");
const crosshairEl = $("crosshair"), bloodEl = $("blood"), breathEl = $("breath"), clockEl = $("clock");
const joyEl = $("joystick"), stickEl = $("stick"), deadEl = $("deadScreen");
let handHeld = false, craftPick = -1, heldKey = null, lastTargetKey = "";
const dying = [], particles = [];
const camDir = new THREE.Vector3(), tmpV = new THREE.Vector3(), targetPoint = new THREE.Vector3();
camera.rotation.order = "YXZ";
player.y = heightAt(player.x, player.z);

// ---------- Модели предметов в руке ----------
function addAxeHead(type) {
  const color = type === "stone_axe" ? 0x8e949a : type === "small_axe" ? 0xa7adb2 : 0x9a6a3a;
  const head = new THREE.Mesh(new THREE.BoxGeometry(.3, .19, .06), new THREE.MeshStandardMaterial({ color }));
  head.position.set(.15, .22, 0); heldObject.add(head);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(.04, .24, .07), new THREE.MeshStandardMaterial({ color: 0xdfe4e8 }));
  edge.position.set(.31, .22, 0); heldObject.add(edge);
}
function addPickHead(stone) {
  const mat = new THREE.MeshStandardMaterial({ color: stone ? 0x8e949a : 0x9a6a3a });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.58, .07, .07), mat); bar.position.set(0, .24, 0); heldObject.add(bar);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 6), mat);
    tip.rotation.z = -s * Math.PI / 2; tip.position.set(s * .34, .24, 0); heldObject.add(tip);
  }
}
function addShovelHead(type) {
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .03), new THREE.MeshStandardMaterial({ color: type === "stone_shovel" ? 0x8e949a : 0x9a6a3a }));
  blade.position.set(0, .34, 0); heldObject.add(blade);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.14, .04, .04), new THREE.MeshStandardMaterial({ color: 0x754b29 }));
  grip.position.set(0, -.3, 0); heldObject.add(grip);
}
function addSword() {
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.075, .66, .02), new THREE.MeshStandardMaterial({ color: 0xd5dadf, metalness: .4, roughness: .35 }));
  blade.position.y = .38; heldObject.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.27, .05, .06), new THREE.MeshStandardMaterial({ color: 0x5a3b1f }));
  guard.position.y = .04; heldObject.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, .22, 8), new THREE.MeshStandardMaterial({ color: 0x754b29 }));
  grip.position.y = -.09; heldObject.add(grip);
}
function addHammerHead() {
  const head = new THREE.Mesh(new THREE.BoxGeometry(.34, .16, .16), new THREE.MeshStandardMaterial({ color: 0x777d83 }));
  head.position.set(0, .26, 0); heldObject.add(head);
}
function addSmallItem(type) {
  let mesh;
  const std = c => new THREE.MeshStandardMaterial({ color: c });
  if (type === "table") mesh = new THREE.Mesh(new THREE.BoxGeometry(.36, .26, .3), std(0xa47743));
  else if (berryFood[type]) mesh = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), std(type === "berry_blue" ? 0x306bd1 : type === "berry_red" ? 0xc92d3b : 0x754184));
  else if (type === "raw_meat") mesh = new THREE.Mesh(new THREE.BoxGeometry(.24, .12, .17), std(0xc9586a));
  else if (type === "bone") { mesh = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .32, 6), std(0xf0ead8)); mesh.rotation.z = 1.1; }
  else if (type === "wool") mesh = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 7), std(0xeeeadb));
  else if (type === "plank") mesh = new THREE.Mesh(new THREE.BoxGeometry(.42, .06, .15), std(0xc59a62));
  else if (type === "stick") { mesh = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .5, 6), std(0x7a5230)); mesh.rotation.z = .4; }
  else if (type === "wood") { mesh = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .5, 6), std(0x82572f)); mesh.rotation.z = .4; }
  else if (type === "stone") mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(.13, 0), std(0x858b8e));
  else if (type === "bandage") mesh = new THREE.Mesh(new THREE.BoxGeometry(.22, .09, .13), std(0xf2f2f2));
  else if (ARMOR[type]) { const bm = std(0xe6dfc9); mesh = type === "bone_helmet" ? new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), bm) : type === "bone_shield" ? new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .05, 10), bm) : new THREE.Mesh(new THREE.BoxGeometry(.28, .32, .1), bm); if (type === "bone_shield") mesh.rotation.x = Math.PI / 2; }
  else if (type === "sleeping_bag") { mesh = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .42, 10), std(0x3d6fb5)); mesh.rotation.z = Math.PI / 2; }
  else if (type === "furnace") mesh = new THREE.Mesh(new THREE.BoxGeometry(.3, .28, .26), std(0x8a8f92));
  else if (type === "chest") mesh = new THREE.Mesh(new THREE.BoxGeometry(.32, .22, .22), std(0x8a5a2b));
  else if (type === "brick") mesh = new THREE.Mesh(new THREE.BoxGeometry(.22, .1, .12), std(0xb5502f));
  else if (type === "glass") mesh = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .04), std(0xbfe8f5));
  else if (type === "cooked_meat") mesh = new THREE.Mesh(new THREE.BoxGeometry(.24, .12, .17), std(0x8a4a2a));
  else if (GEM_COLORS[type]) mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.11), std(GEM_COLORS[type]));
  else if (MAT_COLORS[type]) mesh = new THREE.Mesh(new THREE.BoxGeometry(.2, .14, .2), std(MAT_COLORS[type]));
  else mesh = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), std(0xcccccc));
  mesh.position.y = (mesh.position.y || 0) + .18; heldObject.add(mesh);
}
function updateHeld() {
  const item = selectedSlot >= 0 ? inventory[selectedSlot] : null;
  const key = item ? item.type : "";
  if (key === heldKey) return;
  heldKey = key; heldObject.clear();
  if (!item) return;
  const t = item.type;
  if (t.endsWith("_axe")) { addHandle(); addAxeHead(t); }
  else if (t.endsWith("pickaxe")) { addHandle(); addPickHead(t === "stone_pickaxe"); }
  else if (t.endsWith("_shovel")) { addHandle(); addShovelHead(t); }
  else if (t === "sword") addSword();
  else if (t === "hammer") { addHandle(); addHammerHead(); }
  else addSmallItem(t);
}

// ---------- Рецепты и крафт ----------
const RECIPES = [
  { out: "plank", n: 2, needs: { wood: 1 } },
  { out: "stick", n: 2, needs: { plank: 1 } },
  { out: "table", n: 1, needs: { plank: 4 } },
  { out: "small_axe", n: 1, needs: { stick: 1, stone: 2 } },
  { out: "bandage", n: 2, needs: { wool: 2 } },
  { out: "wooden_shovel", n: 1, needs: { plank: 2, stick: 2 } },
  { out: "stone_shovel", n: 1, needs: { stone: 2, stick: 2 } },
  { out: "wooden_pickaxe", n: 1, needs: { plank: 3, stick: 2 }, bench: true },
  { out: "wooden_axe", n: 1, needs: { plank: 2, stick: 3 }, bench: true },
  { out: "stone_pickaxe", n: 1, needs: { stone: 3, stick: 2 }, bench: true },
  { out: "stone_axe", n: 1, needs: { stone: 2, stick: 3 }, bench: true },
  { out: "sword", n: 1, needs: { stone: 2, bone: 1, stick: 1 }, bench: true },
  { out: "hammer", n: 1, needs: { stone: 2, plank: 2, stick: 1 }, bench: true },
  { out: "furnace", n: 1, needs: { stone: 8 }, bench: true },
  { out: "chest", n: 1, needs: { plank: 8 }, bench: true },
  { out: "bone_helmet", n: 1, needs: { bone: 4 }, bench: true },
  { out: "bone_chest", n: 1, needs: { bone: 8 }, bench: true },
  { out: "bone_pants", n: 1, needs: { bone: 6 }, bench: true },
  { out: "bone_boots", n: 1, needs: { bone: 4 }, bench: true },
  { out: "bone_shield", n: 1, needs: { plank: 4, bone: 2 }, bench: true },
  { out: "sleeping_bag", n: 1, needs: { wool: 3, plank: 2 }, bench: true }
];
const cellCount = () => workbenchCrafting ? 9 : 4;
function countInv(type) { let c = 0; for (const s of inventory) if (s && s.type === type) c += s.count; return c; }
function countCraft(type) { let c = 0; for (const s of craftSlots) if (s && s.type === type) c++; return c; }
function takeInv(type, n) {
  for (let i = 0; i < inventory.length && n > 0; i++) {
    const s = inventory[i];
    if (s && s.type === type) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (s.count <= 0) inventory[i] = null; }
  }
}
function matchRecipe() {
  const counts = {}; let total = 0;
  for (let i = 0; i < cellCount(); i++) { const s = craftSlots[i]; if (s) { counts[s.type] = (counts[s.type] || 0) + 1; total++; } }
  if (!total) return null;
  const kinds = Object.keys(counts);
  for (const r of RECIPES) {
    if (r.bench && !workbenchCrafting) continue;
    const need = Object.keys(r.needs);
    if (need.length === kinds.length && need.every(k => counts[k] === r.needs[k])) return r;
  }
  return null;
}
function returnCraftItems() {
  for (let i = 0; i < craftSlots.length; i++) {
    const s = craftSlots[i];
    if (s) { craftSlots[i] = null; addItem(s.type, s.count); }
  }
}
function autofill(r) {
  returnCraftItems();
  const total = Object.values(r.needs).reduce((a, b) => a + b, 0);
  if (total > cellCount()) return;
  for (const [t, n] of Object.entries(r.needs)) if (countInv(t) < n) { notify("Не хватает ресурсов"); return; }
  let c = 0;
  for (const [t, n] of Object.entries(r.needs)) for (let k = 0; k < n; k++) { takeInv(t, 1); craftSlots[c++] = { type: t, count: 1 }; }
  renderAll();
}
function doCraft() {
  const r = matchRecipe(); if (!r) return;
  for (let i = 0; i < craftSlots.length; i++) craftSlots[i] = null;
  if (!canFit(r.out, r.n)) { notify("Инвентарь заполнен"); renderAll(); return; }
  addItem(r.out, r.n);
  sfx("craft"); notify(`Создано: ${names[r.out]}`);
}

// ---------- Отрисовка интерфейса ----------
function renderHotbar() {
  let html = "";
  for (let i = 0; i < 6; i++) html += `<div class="slot${i === selectedSlot ? " selected" : ""}" data-h="${i}">${itemSlotHTML(inventory[i])}</div>`;
  hotbarEl.innerHTML = html;
}
function renderInventory() {
  let html = "";
  for (let i = 0; i < inventory.length; i++) html += `<div class="slot${i === craftPick ? " selected" : ""}" data-i="${i}">${itemSlotHTML(inventory[i])}</div>`;
  inventoryGridEl.innerHTML = html;
}
function renderCraft() {
  craftGridEl.className = "craftGrid" + (workbenchCrafting ? "" : " two");
  let html = "";
  for (let i = 0; i < cellCount(); i++) html += `<div class="slot" data-c="${i}">${craftSlots[i] ? icons[craftSlots[i].type] : ""}</div>`;
  craftGridEl.innerHTML = html;
  const r = matchRecipe();
  craftOutputEl.innerHTML = r ? `${icons[r.out]}<small>${r.n}</small>` : "";
  $("craftLabel").textContent = workbenchCrafting ? "Верстак 3×3" : "Крафт 2×2";
  $("panelTitle").textContent = workbenchCrafting ? "Верстак · крафт 3×3" : "Инвентарь · крафт 2×2";
}
function renderRecipes() {
  let html = "";
  RECIPES.forEach((r, idx) => {
    if (r.bench && !workbenchCrafting) return;
    const ready = Object.entries(r.needs).every(([t, n]) => countInv(t) + countCraft(t) >= n);
    const cost = Object.entries(r.needs).map(([t, n]) => `${n}×${icons[t]}`).join(" + ");
    html += `<div class="recipeHint${ready ? " ready" : ""}" data-r="${idx}"><span>${icons[r.out]} ${names[r.out]} ← ${cost}</span><span class="recipeStatus">${ready ? "готово" : "нет ресурсов"}</span></div>`;
  });
  if (!workbenchCrafting) html += `<div class="recipeHint"><span>🪚 Инструменты и броня</span><span class="recipeStatus">у верстака</span></div>`;
  recipeListEl.innerHTML = html;
}
function renderArmor() {
  let html = "";
  for (const [key, label, icon] of ARMOR_SLOTS) {
    const it = player.armorSlots[key];
    html += it ? `<div class="slot" data-a="${key}" title="${label}">${icons[it.type]}</div>`
               : `<div class="slot empty" data-a="${key}" title="${label}">${icon}</div>`;
  }
  armorSlotEl.innerHTML = html;
  armorTextEl.textContent = `Защита: ${armorDefense()}%`;
}
function equipFromInventory(key) {
  const cur = player.armorSlots[key];
  if (cur) {
    if (!addItemObj(cur)) return;
    player.armorSlots[key] = null; sfx("equip"); renderAll(); return;
  }
  const it = craftPick >= 0 ? inventory[craftPick] : null;
  if (!it || !ARMOR[it.type] || ARMOR[it.type].slot !== key) { notify("Выберите подходящую броню в инвентаре"); return; }
  player.armorSlots[key] = it; inventory[craftPick] = null; craftPick = -1; sfx("equip"); notify("Надето"); renderAll();
}
// Надеть броню из руки (кнопка действия); старая вещь возвращается в тот же слот
function equipHeld(item) {
  const key = ARMOR[item.type].slot, old = player.armorSlots[key];
  player.armorSlots[key] = item; inventory[selectedSlot] = old || null;
  sfx("equip"); notify("Надето: " + names[item.type]); renderAll();
}
function renderAll() {
  if (craftPick >= 0 && !inventory[craftPick]) craftPick = -1;
  renderHotbar(); renderInventory(); renderCraft(); renderRecipes(); renderArmor(); updateHeld();
}

// ---------- Окно инвентаря / верстака ----------
function openModal(bench) {
  returnCraftItems();
  workbenchCrafting = !!bench; modalOpen = true; craftPick = -1;
  modalEl.style.display = "flex";
  handHeld = false; resetInput(); renderAll();
}
function closeModal() {
  returnCraftItems();
  modalOpen = false; workbenchCrafting = false; modalEl.style.display = "none"; renderAll();
}
$("inventoryButton").addEventListener("click", () => { if (!player.dead) openModal(false); });
$("closeModal").addEventListener("click", closeModal);
$("restartButton").addEventListener("click", () => location.reload());
craftGridEl.addEventListener("click", e => {
  const el = e.target.closest("[data-c]"); if (!el) return;
  const i = +el.dataset.c;
  if (craftSlots[i]) { const t = craftSlots[i].type; craftSlots[i] = null; addItem(t, 1); renderAll(); return; }
  const it = craftPick >= 0 ? inventory[craftPick] : null;
  if (!it) { notify("Сначала выберите предмет в инвентаре"); return; }
  if (nonStackable.has(it.type)) { notify("Этот предмет нельзя класть в крафт"); return; }
  craftSlots[i] = { type: it.type, count: 1 };
  it.count--; if (it.count <= 0) { inventory[craftPick] = null; craftPick = -1; }
  renderAll();
});
craftOutputEl.addEventListener("click", doCraft);
recipeListEl.addEventListener("click", e => {
  const el = e.target.closest("[data-r]"); if (!el || !el.classList.contains("ready")) return;
  autofill(RECIPES[+el.dataset.r]);
});
armorSlotEl.addEventListener("click", e => {
  const el = e.target.closest("[data-a]"); if (!el) return;
  equipFromInventory(el.dataset.a);
});
hotbarEl.addEventListener("click", e => {
  const el = e.target.closest("[data-h]"); if (!el) return;
  const i = +el.dataset.h;
  selectedSlot = selectedSlot === i ? -1 : i;
  renderAll(); showSelectedName();
});

// Перетаскивание и разделение стопок в инвентаре
function moveSlot(a, b) {
  if (a === b) return;
  const A = inventory[a], B = inventory[b];
  if (!A) return;
  if (B && B.type === A.type && !nonStackable.has(A.type)) {
    const n = Math.min(A.count, 99 - B.count); B.count += n; A.count -= n;
    if (A.count <= 0) inventory[a] = null;
  } else { inventory[a] = B; inventory[b] = A; }
  craftPick = -1; renderAll();
}
function splitStack(i) {
  const it = inventory[i]; if (!it || it.count < 2) return;
  const free = inventory.findIndex(s => !s);
  if (free < 0) { notify("Нет свободного слота"); return; }
  const half = Math.floor(it.count / 2);
  it.count -= half; inventory[free] = { type: it.type, count: half };
  notify("Стопка разделена"); renderAll();
}
let drag = null;
inventoryGridEl.addEventListener("pointerdown", e => {
  const el = e.target.closest("[data-i]"); if (!el) return;
  const i = +el.dataset.i;
  drag = { i, x: e.clientX, y: e.clientY, moved: false, split: false };
  clearTimeout(longPress);
  const it = inventory[i];
  if (it && !nonStackable.has(it.type) && it.count > 1)
    longPress = setTimeout(() => { if (drag && !drag.moved) { drag.split = true; splitStack(i); } }, 3000);
});
addEventListener("pointermove", e => {
  if (drag && !drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) { drag.moved = true; clearTimeout(longPress); }
});
addEventListener("pointerup", e => {
  handHeld = false;
  if (!drag) return;
  clearTimeout(longPress);
  const d = drag; drag = null;
  if (d.split) return;
  if (d.moved) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const t = under && under.closest ? under.closest("[data-i]") : null;
    if (t) moveSlot(d.i, +t.dataset.i);
  } else { craftPick = craftPick === d.i ? -1 : (inventory[d.i] ? d.i : -1); renderAll(); }
});
addEventListener("pointercancel", () => { drag = null; handHeld = false; clearTimeout(longPress); });
