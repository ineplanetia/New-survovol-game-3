// nature.js: разные деревья и камни, трава, предметы на земле, расстановка мира
const idCount = { t: 0, r: 0, p: 0 };

// Детерминированная "кривизна" формы: одна и та же точка всегда смещается одинаково, швов нет
function h3(a, b, c, k) {
  const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + k * 19.19) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
function jitterGeo(geo, amt, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.round(x * 100) + seed, b = Math.round(y * 100), c = Math.round(z * 100);
    p.setXYZ(i, x + h3(a, b, c, 1) * amt, y + h3(a, b, c, 2) * amt, z + h3(a, b, c, 3) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}
function inPlateau(x, z, pad) {
  for (const p of PLATEAUS) if (Math.hypot(x - p.x, z - p.z) < p.r + pad) return true;
  return false;
}
function randomPoint(min = 16) {
  for (let i = 0; i < 100; i++) {
    const x = (rand() * 2 - 1) * 130, z = (rand() * 2 - 1) * 130;
    if (Math.hypot(x - player.x, z - player.z) > min && !inPlateau(x, z, 3)) return [x, z];
  }
  return [70 + rand() * 20, 70 + rand() * 20];
}

// ---------- Материалы ----------
const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
const pick = arr => arr[(rand() * arr.length) | 0];
const barkMats = [0x76502d, 0x6a4727, 0x835a35].map(mat);
const pineMats = [0x287a3e, 0x1f6b36, 0x2f8645, 0x246b4a].map(mat);
const oakMats = [0x3c8a3a, 0x4a9a3c, 0x2f7a35, 0x6a9a30].map(mat);
const birchLeafMats = [0x8fb83a, 0xa8c443, 0x78a838].map(mat);
const birchBarkMat = mat(0xdad4c2), deadBarkMat = mat(0x5d4a3a);
const rockMats = [0x858b8e, 0x7a8083, 0x969a98, 0x6f7478, 0x8d857a, 0x7d8a76].map(mat);

// ---------- Деревья: сосна, дуб, берёза, сухое ----------
function makeTree(x, z) {
  const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z);
  const body = new THREE.Group(); root.add(body);
  const s = .8 + rand() * .75, seed = (rand() * 1000) | 0, roll = rand();
  const add = (geo, m, px, py, pz) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(px, py, pz); mesh.castShadow = true; body.add(mesh); return mesh;
  };
  let name, trunkR;
  if (roll < .45) {
    name = "Сосна"; trunkR = .3 + rand() * .12;
    const th = 2.4 + rand() * 1.6;
    add(jitterGeo(new THREE.CylinderGeometry(trunkR * .7, trunkR * 1.3, th, 7), .05, seed), pick(barkMats), 0, th / 2, 0);
    const tiers = 2 + ((rand() * 3) | 0), leaf = pick(pineMats);
    for (let i = 0; i < tiers; i++) {
      const r = (1.9 - i * (1.2 / tiers)) * (.85 + rand() * .3), h = 1.8 + rand() * .8;
      add(jitterGeo(new THREE.ConeGeometry(r, h, 7), .13, seed + i), leaf, (rand() - .5) * .15, th * .5 + i * 1.1 + h / 2, (rand() - .5) * .15);
    }
  } else if (roll < .72) {
    name = "Дуб"; trunkR = .45 + rand() * .15;
    const th = 1.8 + rand() * .9;
    add(jitterGeo(new THREE.CylinderGeometry(trunkR * .75, trunkR * 1.25, th, 8), .06, seed), pick(barkMats), 0, th / 2, 0);
    const leaf = pick(oakMats), blobs = 3 + ((rand() * 3) | 0);
    for (let i = 0; i < blobs; i++) {
      const r = .9 + rand() * .7, a = rand() * 6.28, d = i === 0 ? 0 : .8 + rand() * .5;
      add(jitterGeo(new THREE.IcosahedronGeometry(r, 1), r * .22, seed + i * 7), leaf, Math.cos(a) * d, th + .6 + rand() * .9, Math.sin(a) * d);
    }
  } else if (roll < .88) {
    name = "Берёза"; trunkR = .17 + rand() * .08;
    const th = 3.4 + rand() * 1.6;
    add(jitterGeo(new THREE.CylinderGeometry(trunkR * .7, trunkR * 1.1, th, 6), .03, seed), birchBarkMat, 0, th / 2, 0);
    const leaf = pick(birchLeafMats);
    for (let i = 0; i < 2 + ((rand() * 2) | 0); i++) {
      const r = .6 + rand() * .45;
      add(jitterGeo(new THREE.IcosahedronGeometry(r, 1), r * .25, seed + i * 5), leaf, (rand() - .5) * .7, th - .2 + i * .7, (rand() - .5) * .7);
    }
  } else {
    name = "Сухое дерево"; trunkR = .3 + rand() * .1;
    const th = 2.8 + rand() * 1.6;
    add(jitterGeo(new THREE.CylinderGeometry(trunkR * .45, trunkR * 1.2, th, 6), .08, seed), deadBarkMat, 0, th / 2, 0);
    for (let i = 0; i < 2 + ((rand() * 2) | 0); i++) {
      const br = add(jitterGeo(new THREE.CylinderGeometry(.04, .12, 1.4, 5), .04, seed + i), deadBarkMat, 0, th * (.55 + i * .13), 0);
      br.rotation.z = (i % 2 ? 1 : -1) * (.7 + rand() * .5); br.rotation.y = rand() * 6.28; br.position.x = (i % 2 ? .4 : -.4);
    }
  }
  body.scale.setScalar(s);
  body.rotation.z = (rand() - .5) * .14; body.rotation.x = (rand() - .5) * .1;
  const hp = Math.round(5 + s * 3.5);
  const entity = { kind: "tree", id: "t" + idCount.t++, name, hp, maxHp: hp, root, x, z };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); trees.push(entity);
  obstacles.push({ x, z, radius: Math.max(.5, trunkR * s + .15), entity });
}

// ---------- Камни: валун, плита, скала, груда ----------
function makeRock(x, z) {
  const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z);
  const m = pick(rockMats), seed = (rand() * 1000) | 0, roll = rand();
  let name, hp, radius;
  const piece = (r, sx, sy, sz, px, pz) => {
    const mesh = new THREE.Mesh(jitterGeo(new THREE.DodecahedronGeometry(r, 1), r * .3, seed + ((px * 10) | 0)), m);
    mesh.scale.set(sx, sy, sz); mesh.position.set(px, r * sy * .6, pz);
    mesh.rotation.set((rand() - .5) * .4, rand() * 6.28, (rand() - .5) * .4);
    mesh.castShadow = true; root.add(mesh);
  };
  if (roll < .4) {
    name = "Валун"; const r = .7 + rand() * .7;
    piece(r, 1 + rand() * .5, .6 + rand() * .4, .9 + rand() * .4, 0, 0);
    hp = Math.round(6 + r * 5); radius = r * 1.15;
  } else if (roll < .65) {
    name = "Каменная плита"; const r = 1 + rand() * .6;
    piece(r, 1.5, .32 + rand() * .15, 1.1 + rand() * .3, 0, 0);
    hp = Math.round(6 + r * 4); radius = r * 1.5;
  } else if (roll < .85) {
    name = "Скала"; const r = .6 + rand() * .3;
    piece(r, .7, 1.5 + rand() * .9, .7, 0, 0);
    hp = Math.round(8 + r * 6); radius = r * .8;
  } else {
    name = "Груда камней";
    piece(.7, 1, .7, 1, 0, 0); piece(.45, 1.1, .8, 1, .85, .3); piece(.35, 1, .7, 1.2, -.5, .75);
    hp = 8; radius = 1.2;
  }
  const entity = { kind: "rock", id: "r" + idCount.r++, name, hp, maxHp: hp, root, x, z };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); rocks.push(entity);
  obstacles.push({ x, z, radius, entity });
}

// ---------- Предметы на земле: ветки, камешки, ягоды ----------
function makePickup(type, x, z) {
  const root = new THREE.Group(); root.position.set(x, heightAt(x, z) + .035, z); root.rotation.y = rand() * Math.PI;
  if (type === "wood") {
    const len = .55 + rand() * .55;
    const branch = new THREE.Mesh(jitterGeo(new THREE.CylinderGeometry(.04 + rand() * .03, .07, len, 6), .02, (rand() * 99) | 0), mat(pick([0x82572f, 0x6e4a28, 0x94683b])));
    branch.rotation.z = Math.PI / 2; branch.position.y = .07; root.add(branch);
  } else if (type === "stone") {
    const sz = .17 + rand() * .12;
    const stone = new THREE.Mesh(jitterGeo(new THREE.DodecahedronGeometry(sz, 0), sz * .3, (rand() * 99) | 0), pick(rockMats));
    stone.position.y = .13; stone.scale.set(1.3, .72, 1); root.add(stone);
    const small = new THREE.Mesh(new THREE.DodecahedronGeometry(.1 + rand() * .05, 0), pick(rockMats));
    small.position.set(.19, .08, .1); root.add(small);
  } else {
    const colors = { berry_wild: 0x754184, berry_blue: 0x306bd1, berry_red: 0xc92d3b };
    const bush = new THREE.Mesh(new THREE.SphereGeometry(.31, 8, 7), mat(0x356b36));
    bush.scale.set(1.15, .67, 1); bush.position.y = .2; root.add(bush);
    const bm = new THREE.MeshStandardMaterial({ color: colors[type] });
    for (const [a, b, c] of [[-.14, .27, .08], [.09, .25, .18], [.12, .18, -.13], [-.08, .18, -.18]]) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 6), bm); berry.position.set(a, b, c); root.add(berry);
    }
  }
  const entity = { kind: "pickup", id: "p" + idCount.p++, type, name: names[type], root };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); pickups.push(entity);
}

// ---------- Трава: тысячи маленьких пучков одним объектом ----------
let grassMesh = null, grassPos = null;
function buildGrass(count) {
  const pos = [], nor = [];
  for (let b = 0; b < 3; b++) {
    const a = b * Math.PI * 2 / 3 + .3, c = Math.cos(a), s = Math.sin(a), w = .06, h = .4 + b * .09;
    pos.push(-w * c, 0, -w * s, w * c, 0, w * s, c * .06 + (b - 1) * .03, h, s * .06);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide }), count);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const tints = [0x5fa24a, 0x6bb04f, 0x4f9440, 0x7fbf55, 0x5a9a3f, 0xb5b35a];
  const gp = new Float32Array(count * 3);
  let n = 0;
  for (let i = 0; i < count * 2 && n < count; i++) {
    const x = (rand() * 2 - 1) * 142, z = (rand() * 2 - 1) * 142;
    if (inPlateau(x, z, 0)) continue;
    const y = heightAt(x, z);
    if (y > 4.8) continue;
    const sc = .7 + rand() * .9;
    dummy.position.set(x, y, z); dummy.rotation.set(0, rand() * 6.28, 0);
    dummy.scale.set(sc, sc * (.8 + rand() * .6), sc);
    dummy.updateMatrix(); mesh.setMatrixAt(n, dummy.matrix);
    gp[n * 3] = x; gp[n * 3 + 1] = y; gp[n * 3 + 2] = z;
    col.setHex(tints[(rand() * (rand() < .9 ? 5 : 6)) | 0]); col.offsetHSL(0, 0, (rand() - .5) * .08);
    mesh.setColorAt(n, col); n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  grassMesh = mesh; grassPos = gp;
  scene.add(mesh);
}

// ---------- Расстановка мира (одинаковая при каждом запуске) ----------
for (let i = 0; i < 95; i++) { const [x, z] = randomPoint(); makeTree(x, z); }
for (let i = 0; i < 75; i++) { const [x, z] = randomPoint(); makeRock(x, z); }
for (let i = 0; i < 130; i++) { const [x, z] = randomPoint(5); makePickup("wood", x, z); }
for (let i = 0; i < 120; i++) { const [x, z] = randomPoint(5); makePickup("stone", x, z); }
const berryTypes = ["berry_wild", "berry_blue", "berry_red"];
for (let i = 0; i < 75; i++) { const [x, z] = randomPoint(9); makePickup(berryTypes[i % 3], x, z); }
buildGrass(13000);
for (let i = 0; i < 18; i++) { const [x, z] = randomPoint(12); makeSheep(x, z, i % 2 === 0); }

// Удаление объекта без эффектов (при загрузке сохранения)
function silentRemove(e) {
  scene.remove(e.root);
  for (const list of [trees, rocks, pickups]) { const k = list.indexOf(e); if (k >= 0) list.splice(k, 1); }
  const k = obstacles.findIndex(o => o.entity === e); if (k >= 0) obstacles.splice(k, 1);
}
