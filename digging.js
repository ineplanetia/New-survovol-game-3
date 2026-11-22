// digging.js: лопата, ямы в земле, добыча земли, камня, угля и драгоценностей
const MAX_DIG = 8;
const SHOVEL = { wooden_shovel: 1, stone_shovel: 2 };
const SOIL_NAMES = { dirt: "Земля", clay: "Глина", sand: "Песок" };

// Кольцо-метка на земле, куда ударит лопата
const digMarker = new THREE.Mesh(
  new THREE.RingGeometry(.5, .62, 24),
  new THREE.MeshBasicMaterial({ color: 0xe9fff0, transparent: true, opacity: .8, side: THREE.DoubleSide, depthTest: false })
);
digMarker.rotation.x = -Math.PI / 2; digMarker.visible = false; digMarker.renderOrder = 5;
scene.add(digMarker);

function findDig(x, z, r = 1.3) {
  let best = null, bd = r;
  const cx = Math.floor(x / 4), cz = Math.floor(z / 4);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = digCells.get(cellKey(cx + i, cz + j)); if (!list) continue;
    for (const d of list) { const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } }
  }
  return best;
}
function groundName(soil, n) {
  if (n >= MAX_DIG) return "Твёрдая порода";
  if (n >= 2) return "Камень под землёй";
  return SOIL_NAMES[soil];
}
// Точка земли под прицелом (только если в руке лопата и смотришь вниз)
function groundTarget() {
  const item = heldItem();
  if (!item || !SHOVEL[item.type]) return null;
  camera.getWorldDirection(camDir);
  if (camDir.y > -.05) return null;
  for (let t = .6; t <= 3.6; t += .2) {
    const x = camera.position.x + camDir.x * t, y = camera.position.y + camDir.y * t, z = camera.position.z + camDir.z * t;
    const gy = heightAt(x, z);
    if (y <= gy) {
      targetPoint.set(x, gy, z);
      const d = findDig(x, z), n = d ? d.n : 0, soil = soilAt(d ? d.x : x, d ? d.z : z);
      return { kind: "ground", name: groundName(soil, n), hp: n, maxHp: MAX_DIG, x, z, soil };
    }
  }
  return null;
}
function blockedForDig(x, z) {
  for (const o of obstacles) if (Math.hypot(o.x - x, o.z - z) < o.radius + 1.8) return true;
  return false;
}

// Что находится на глубине: сначала земля, потом камень, иногда уголь и драгоценности
function rollDig(n, soil) {
  const lump = 1 + (Math.random() < .5 ? 1 : 0);
  if (n <= 2) return [soil, lump];
  const r = Math.random(), b = n - 2;
  const table = [["diamond", .002 * b], ["emerald", .005 * b], ["sapphire", .007 * b], ["ruby", .009 * b], ["coal", .12]];
  if (n < 4) table.splice(0, 4);
  let p = 0;
  for (const [it, ch] of table) { p += ch; if (r < p) return [it, 1]; }
  return ["stone", lump];
}

function dig(t, item) {
  if (!(item && SHOVEL[item.type])) { notify("Нужна лопата"); return; }
  if (blockedForDig(t.x, t.z)) { notify("Рядом дерево, камень или постройка"); return; }
  let d = findDig(t.x, t.z);
  if (d && d.n >= MAX_DIG) { notify("Дальше только твёрдая порода"); return; }
  if (!d) d = addDig(t.x, t.z, 0);
  d.n++;
  swing(); sfx("dig");
  const [it, amt] = rollDig(d.n, soilAt(d.x, d.z));
  addItem(it, amt);
  const gem = GEM_COLORS[it];
  if (gem) { sfx("gem"); notify("💎 Найден: " + names[it] + "!"); spawnChips(targetPoint, gem, 10); }
  else { notify(`+${amt} ${names[it]}`); spawnChips(targetPoint, MAT_COLORS[it] || 0x6b4f33, 8); }
  applyDig(d);
  wearTool(item);
}

// ---------- Изменение рельефа ----------
function refreshTerrain(x0, x1, z0, z1) {
  const posA = terrainGeo.attributes.position, colA = terrainGeo.attributes.color;
  const P = posA.array, C = colA.array;
  const i0 = Math.max(0, Math.floor((x0 + 150) / 2.5) - 1), i1 = Math.min(120, Math.ceil((x1 + 150) / 2.5) + 1);
  const j0 = Math.max(0, Math.floor((z0 + 150) / 2.5) - 1), j1 = Math.min(120, Math.ceil((z1 + 150) / 2.5) + 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const idx = j * 121 + i, o = idx * 3;
    const x = P[o], z = P[o + 2], dep = digDepthAt(x, z);
    P[o + 1] = heightAt(x, z);
    if (dep < .001) { C[o] = terrainColOrig[o]; C[o + 1] = terrainColOrig[o + 1]; C[o + 2] = terrainColOrig[o + 2]; continue; }
    const k = Math.min(1, dep / .5) * .9, e = Math.min(1, Math.max(0, dep - 1) / 1);
    const tr = .42 + (.48 - .42) * e, tg = .31 + (.49 - .31) * e, tb = .2 + (.5 - .2) * e;
    C[o] = terrainColOrig[o] * (1 - k) + tr * k;
    C[o + 1] = terrainColOrig[o + 1] * (1 - k) + tg * k;
    C[o + 2] = terrainColOrig[o + 2] * (1 - k) + tb * k;
  }
  posA.needsUpdate = true; colA.needsUpdate = true;
  terrainGeo.computeVertexNormals();
}
// Трава и мелкие предметы не должны висеть над ямой
function hideGrassNear(x, z, r) {
  if (!grassMesh || !grassPos) return;
  const zero = hideGrassNear.m || (hideGrassNear.m = new THREE.Matrix4().makeScale(0, 0, 0));
  let changed = false;
  for (let i = 0; i < grassMesh.count; i++) {
    const gx = grassPos[i * 3], gz = grassPos[i * 3 + 2];
    if (Math.abs(gx - x) > r || Math.abs(gz - z) > r) continue;
    if (digDepthAt(gx, gz) > .12) { grassMesh.setMatrixAt(i, zero); changed = true; }
  }
  if (changed) grassMesh.instanceMatrix.needsUpdate = true;
}
function lowerPickups(x, z, r) {
  for (const p of pickups) {
    const dx = p.root.position.x - x, dz = p.root.position.z - z;
    if (dx * dx + dz * dz < r * r) p.root.position.y = heightAt(p.root.position.x, p.root.position.z) + .035;
  }
}
function applyDig(d) {
  const r = DIG_R + 1.6;
  refreshTerrain(d.x - r, d.x + r, d.z - r, d.z + r);
  hideGrassNear(d.x, d.z, DIG_R);
  lowerPickups(d.x, d.z, DIG_R + .5);
}
// При загрузке сохранения: пересчитать всю землю
function reapplyDigs() {
  if (!digs.length) return;
  refreshTerrain(-150, 150, -150, 150);
  for (const d of digs) { hideGrassNear(d.x, d.z, DIG_R); lowerPickups(d.x, d.z, DIG_R + .5); }
}
