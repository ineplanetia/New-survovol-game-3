// containers.js: печь (плавит и жарит) и сундук (хранилище) с окном как у инвентаря
const FUEL = { stick: 3, wood: 6, plank: 10, coal: 40 };                  // сколько секунд горит
const SMELT = {                                                          // что во что и за сколько секунд
  clay: { out: "brick", t: 8 }, sand: { out: "glass", t: 8 }, raw_meat: { out: "cooked_meat", t: 6 }
};
const CHEST_SLOTS = 18;
let contEnt = null, contTimer = 0;

// ---------- Модели ----------
function makeFurnace(r) {
  r.data = r.data || { inp: null, fuel: null, out: null, burn: 0, prog: 0 };
  const root = new THREE.Group(); root.position.set(r.x, heightAt(r.x, r.z), r.z);
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: 1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.1), stone); body.position.y = .55; body.castShadow = true; root.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, .14, 1.2), new THREE.MeshStandardMaterial({ color: 0x73787b })); top.position.y = 1.17; root.add(top);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(.35, .6, .35), stone); chim.position.set(.35, 1.5, -.25); root.add(chim);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.6, .45, .08), dark); mouth.position.set(0, .45, .56); root.add(mouth);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff6a00, emissiveIntensity: 0 });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(.46, .3, .05), glowMat); glow.position.set(0, .45, .6); root.add(glow);
  const entity = { kind: "furnace", struct: "furnace", name: "Печь", root, x: r.x, z: r.z, rec: r, glowMat };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); structures.push(entity); obstacles.push({ x: r.x, z: r.z, radius: .85, entity });
  return entity;
}
function makeChest(r) {
  r.data = r.data || { slots: Array(CHEST_SLOTS).fill(null) };
  const root = new THREE.Group(); root.position.set(r.x, heightAt(r.x, r.z), r.z);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.05, .55, .7), wood); box.position.y = .28; box.castShadow = true; root.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, .2, .75), new THREE.MeshStandardMaterial({ color: 0x6e4620 })); lid.position.y = .64; root.add(lid);
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(.14, .2, .06), new THREE.MeshStandardMaterial({ color: 0xc9b060, metalness: .5 })); clasp.position.set(0, .56, .38); root.add(clasp);
  const entity = { kind: "chest", struct: "chest", name: "Сундук", root, x: r.x, z: r.z, rec: r };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); structures.push(entity); obstacles.push({ x: r.x, z: r.z, radius: .7, entity });
  return entity;
}
function containerHasItems(rec) {
  const d = rec.data; if (!d) return false;
  if (rec.type === "furnace") return !!(d.inp || d.fuel || d.out);
  if (rec.type === "chest") return d.slots.some(Boolean);
  return false;
}

// ---------- Работа печи (идёт всегда, даже если окно закрыто) ----------
function updateFurnaces(dt) {
  let refresh = false;
  for (const e of structures) {
    if (e.kind !== "furnace") continue;
    const d = e.rec.data, rec = d.inp && SMELT[d.inp.type];
    let working = false;
    if (rec && (!d.out || (d.out.type === rec.out && d.out.count < 99))) {
      if (d.burn <= 0 && d.fuel) { d.burn = FUEL[d.fuel.type]; d.fuel.count--; if (d.fuel.count <= 0) d.fuel = null; if (e === contEnt) refresh = true; }
      if (d.burn > 0) {
        working = true; d.burn -= dt; d.prog += dt;
        if (d.prog >= rec.t) {
          d.prog = 0; d.inp.count--; if (d.inp.count <= 0) d.inp = null;
          if (d.out) d.out.count++; else d.out = { type: rec.out, count: 1 };
          if (e === contEnt) refresh = true; sfx("pop");
        }
      }
    }
    if (!working) d.prog = Math.max(0, d.prog - dt * 2);
    e.glowMat.emissiveIntensity = working ? 1.3 + Math.sin(performance.now() * .02) * .35 : 0;
  }
  contTimer -= dt;
  if (contEnt && contEnt.kind === "furnace" && (refresh || contTimer <= 0)) { contTimer = .25; renderCont(); }
}

// ---------- Окно ----------
const contStyle = document.createElement("style");
contStyle.textContent = `#contModal{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:10px;background:#0009;pointer-events:auto;z-index:4}
#contPanel{width:min(96vw,640px);max-height:94vh;overflow:auto;padding:13px;border:1px solid #ffffff55;border-radius:12px;background:#1c2a22;color:#fff}
#contHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
#contHead h2{margin:0;font-size:17px}
#contClose{padding:8px 12px;border-radius:8px;background:#80504b}
.cRow{display:flex;align-items:center;gap:12px;padding:9px;border-radius:10px;background:#101a15aa;margin-bottom:8px}
.cRow .slot{width:50px;height:50px}
.cGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:8px}
.cGrid .slot{width:100%;height:44px}
#fBar{height:10px;border:1px solid #ffffff88;border-radius:6px;overflow:hidden;background:#2229;margin:6px 0}
#fFill{height:100%;background:linear-gradient(90deg,#c25a10,#ffb347)}
.cHint{color:#c3d0c6;font-size:11px;line-height:1.35}`;
document.head.appendChild(contStyle);
const contModal = document.createElement("div");
contModal.id = "contModal";
contModal.innerHTML = `<div id="contPanel"><div id="contHead"><h2 id="contTitle"></h2><button id="contClose">Закрыть</button></div><div id="contBody"></div></div>`;
document.getElementById("ui").appendChild(contModal);
const contBody = contModal.querySelector("#contBody"), contTitle = contModal.querySelector("#contTitle");

function openContainer(e) {
  if (player.dead || player.sleeping) return;
  contEnt = e; modalOpen = true; handHeld = false; resetInput();
  contTitle.textContent = e.kind === "furnace" ? "Печь" : "Сундук";
  contModal.style.display = "flex"; renderCont();
}
function closeContainer() { contModal.style.display = "none"; contEnt = null; modalOpen = false; }
contModal.querySelector("#contClose").addEventListener("click", closeContainer);

function renderCont() {
  if (!contEnt) return;
  const d = contEnt.rec.data; let html = "";
  if (contEnt.kind === "furnace") {
    const rec = d.inp && SMELT[d.inp.type], pct = rec ? Math.min(100, d.prog / rec.t * 100) : 0;
    html += `<div class="cRow"><div><div class="craftLabel">Сырьё</div><div class="slot" data-f="inp">${itemSlotHTML(d.inp)}</div></div>
      <div><div class="craftLabel">Топливо</div><div class="slot" data-f="fuel">${itemSlotHTML(d.fuel)}</div></div>
      <div id="craftArrow">${d.burn > 0 ? "🔥" : "➜"}</div>
      <div><div class="craftLabel">Результат</div><div class="slot" data-f="out">${itemSlotHTML(d.out)}</div></div></div>
      <div id="fBar"><div id="fFill" style="width:${pct}%"></div></div>
      <div class="cHint">Топливо: ветка 🪵, палка, доска, уголь ⚫ (уголь горит дольше всего). Плавится: глина → кирпич, песок → стекло, сырое мясо → жареное. Нажмите предмет в инвентаре, чтобы положить, нажмите слот печи, чтобы забрать.</div>`;
  } else {
    html += `<div class="craftLabel">Сундук · ${CHEST_SLOTS} слотов</div><div class="cGrid">`;
    for (let i = 0; i < CHEST_SLOTS; i++) html += `<div class="slot" data-s="${i}">${itemSlotHTML(d.slots[i])}</div>`;
    html += `</div><div class="cHint">Нажмите предмет в инвентаре, чтобы убрать в сундук, нажмите слот сундука, чтобы забрать.</div>`;
  }
  html += `<div class="craftLabel" style="margin-top:8px">Инвентарь</div><div class="cGrid">`;
  for (let i = 0; i < inventory.length; i++) html += `<div class="slot" data-ci="${i}">${itemSlotHTML(inventory[i])}</div>`;
  contBody.innerHTML = html + "</div>";
}
contBody.addEventListener("click", e => {
  const inv = e.target.closest("[data-ci]"), f = e.target.closest("[data-f]"), s = e.target.closest("[data-s]");
  if (inv) invToCont(+inv.dataset.ci);
  else if (f) furnaceToInv(f.dataset.f);
  else if (s) chestToInv(+s.dataset.s);
});

// ---------- Перекладывание предметов ----------
function giveToPlayer(it) {            // true, если всё влезло
  if (nonStackable.has(it.type)) return addItemObj(it);
  const n = addItem(it.type, it.count); it.count -= n; return it.count <= 0;
}
function invToCont(idx) {
  const it = inventory[idx]; if (!it || !contEnt) return;
  const d = contEnt.rec.data;
  if (contEnt.kind === "furnace") {
    const slot = SMELT[it.type] ? "inp" : FUEL[it.type] ? "fuel" : null;
    if (!slot) { notify("Это нельзя положить в печь"); return; }
    if (d[slot] && d[slot].type !== it.type) { notify("Сначала заберите другой предмет из этого слота"); return; }
    const room = 99 - (d[slot] ? d[slot].count : 0), n = Math.min(room, it.count);
    if (n <= 0) { notify("Слот заполнен"); return; }
    if (d[slot]) d[slot].count += n; else d[slot] = { type: it.type, count: n };
    it.count -= n; if (it.count <= 0) inventory[idx] = null;
  } else {
    let left = it.count;
    if (!nonStackable.has(it.type)) for (const s of d.slots) {
      if (s && s.type === it.type && s.count < 99 && left > 0) { const n = Math.min(left, 99 - s.count); s.count += n; left -= n; }
    }
    if (left > 0) {
      const free = d.slots.findIndex(s => !s);
      if (free < 0) { notify("Сундук полон"); if (left === it.count) return; }
      else { d.slots[free] = Object.assign({}, it, { count: left }); left = 0; }
    }
    it.count = left; if (left <= 0) inventory[idx] = null;
  }
  sfx("pop"); renderAll(); renderCont();
}
function furnaceToInv(slot) {
  const d = contEnt.rec.data, it = d[slot]; if (!it) return;
  if (giveToPlayer(it)) d[slot] = null;
  sfx("pop"); renderAll(); renderCont();
}
function chestToInv(i) {
  const d = contEnt.rec.data, it = d.slots[i]; if (!it) return;
  if (giveToPlayer(it)) d.slots[i] = null;
  sfx("pop"); renderAll(); renderCont();
}
