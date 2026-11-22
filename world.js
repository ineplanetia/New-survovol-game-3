// world.js: деревья, камни, ягоды, верстак, овцы, расстановка мира, руки игрока
function makeWorkbench(x, z) {
  const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z);
  const dark = new THREE.MeshStandardMaterial({ color: 0x65401f });
  const topMat = new THREE.MeshStandardMaterial({ color: 0xa47743 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x80552f });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, .22, 1.35), topMat); top.position.y = 1.02; top.castShadow = true; root.add(top);
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(.77, .045, .57), stripe); plank.position.set(i % 2 === 0 ? -.39 : .39, 1.15, i < 2 ? -.29 : .29); root.add(plank);
  }
  for (const [a, b] of [[-.62, -.48], [.62, -.48], [-.62, .48], [.62, .48]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.2, .9, .2), dark); leg.position.set(a, .45, b); root.add(leg);
  }
  const entity = { kind: "workbench", name: "Верстак", root, x, z };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); workbenches.push(entity); obstacles.push({ x, z, radius: .96, entity });
  return entity;
}
function makeSheep(x, z, male = Math.random() < .5) {
  const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z);
  const woolMat = new THREE.MeshStandardMaterial({ color: 0xe9e5d7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x4a3831 });
  const body = new THREE.Group(); body.position.y = .8; root.add(body);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.58, 12, 10), woolMat); torso.scale.set(1.25, .92, .82); torso.castShadow = true; body.add(torso);
  for (const [a, b, c] of [[-.36, .1, 0], [0, .2, .1], [.35, .1, 0], [-.2, -.12, .2], [.2, -.12, -.2]]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(.29, 9, 8), woolMat); puff.position.set(a, b, c); body.add(puff);
  }
  const head = new THREE.Group(); head.position.set(.58, .1, 0); body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(.23, 10, 8), new THREE.MeshStandardMaterial({ color: 0x43332d })));
  const legs = [];
  for (const [a, b] of [[-.32, -.27], [-.32, .27], [.32, -.27], [.32, .27]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.055, .075, .48, 7), skin); leg.position.set(a, .28, b); root.add(leg); legs.push(leg);
  }
  if (male) for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.TorusGeometry(.14, .035, 6, 10, Math.PI * 1.35), new THREE.MeshStandardMaterial({ color: 0xb7a58d })); horn.position.set(.54, .32, side * .17); horn.rotation.z = 1.2; root.add(horn);
  }
  const entity = { kind: "sheep", name: male ? "Баран" : "Овца", male, hp: 6, root, body, head, legs, state: "wander", timer: 2 + Math.random() * 3, cooldown: 0, charged: false, phase: Math.random() * 5, wander: Math.random() * 6 };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); sheep.push(entity);
}
function makeCarcass(animal) {
  const root = new THREE.Group(); root.position.copy(animal.root.position);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.55, 12, 9), new THREE.MeshStandardMaterial({ color: 0xbdb6a9 })); body.position.y = .42; body.scale.set(1.35, .55, .8); root.add(body);
  const mark = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8c4c48 })); mark.position.set(.25, .42, .18); root.add(mark);
  const entity = { kind: "carcass", name: "Туша овцы", root, butchered: false };
  root.traverse(o => { if (o.isMesh) o.userData.entity = entity; });
  scene.add(root); carcasses.push(entity);
}
inventory[0] = createItem("small_axe");

const viewModel = new THREE.Group(); camera.add(viewModel); scene.add(camera);
function makeLimb(parent, color, len, radius, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .82, radius, len, 8), new THREE.MeshStandardMaterial({ color }));
  mesh.position.y = -len / 2; g.add(mesh); parent.add(g); return g;
}
const leftLeg = makeLimb(viewModel, 0x334a6b, .8, .12, -.19, -.7, -.72);
const rightLeg = makeLimb(viewModel, 0x334a6b, .8, .12, .19, -.7, -.72);
const leftArm = makeLimb(viewModel, 0xc98e69, .63, .105, -.47, -.38, -.75);
const rightArm = makeLimb(viewModel, 0xc98e69, .63, .105, .47, -.38, -.75);
const heldObject = new THREE.Group(); heldObject.position.set(.57, -.7, -.95); viewModel.add(heldObject);
function addHandle() { const handle = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, .58, 8), new THREE.MeshStandardMaterial({ color: 0x754b29 })); handle.position.y = -.04; heldObject.add(handle); }
