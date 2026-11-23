// controls.js: сенсорное управление, движение игрока, день и ночь
// ---------- Управление: сенсор ----------
const move = { x: 0, y: 0 };
const keys = {};
let joyId = null, lookId = null, joyOrigin = { x: 0, y: 0 }, lastLook = { x: 0, y: 0 };
let handCooldown = 0;
const isUI = el => el && el.closest && el.closest("button, #hotbar, #modal, #deadScreen, #targetBox");
function resetInput() {
  joyId = null; lookId = null; move.x = 0; move.y = 0;
  joyEl.style.display = "none"; stickEl.style.transform = "translate(0px,0px)";
}
addEventListener("touchstart", e => {
  if (modalOpen || player.dead) return;
  let handled = false;
  for (const t of e.changedTouches) {
    if (isUI(t.target)) continue;
    if (t.clientX < innerWidth * .4 && joyId === null) {
      joyId = t.identifier; joyOrigin = { x: t.clientX, y: t.clientY };
      joyEl.style.display = "block"; joyEl.style.left = t.clientX + "px"; joyEl.style.top = t.clientY + "px";
      stickEl.style.transform = "translate(0px,0px)"; handled = true;
    } else if (t.clientX >= innerWidth * .4 && lookId === null) {
      lookId = t.identifier; lastLook = { x: t.clientX, y: t.clientY }; handled = true;
    }
  }
  if (handled) e.preventDefault();
}, { passive: false });
addEventListener("touchmove", e => {
  let handled = false;
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) {
      let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
      const len = Math.hypot(dx, dy), max = 55;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      move.x = dx / max; move.y = -dy / max;
      stickEl.style.transform = `translate(${dx}px,${dy}px)`; handled = true;
    } else if (t.identifier === lookId) {
      player.yaw -= (t.clientX - lastLook.x) * .0055;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - (t.clientY - lastLook.y) * .0055));
      lastLook = { x: t.clientX, y: t.clientY }; handled = true;
    }
  }
  if (handled) e.preventDefault();
}, { passive: false });
function endTouch(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) { joyId = null; move.x = 0; move.y = 0; joyEl.style.display = "none"; }
    if (t.identifier === lookId) lookId = null;
  }
}
addEventListener("touchend", endTouch);
addEventListener("touchcancel", endTouch);
addEventListener("contextmenu", e => e.preventDefault());

$("handButton").addEventListener("pointerdown", e => { e.preventDefault(); useHand(); handHeld = true; handCooldown = .45; });
$("jump").addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
function jump() { if (player.grounded && !player.dead && !modalOpen) { player.vy = 8.5; sfx("jump"); player.grounded = false; } }

addEventListener("keydown", e => {
  keys[e.code] = true;
  if (e.code === "Space") jump();
  if (e.code === "KeyE") useHand();
  if (e.code === "KeyI") { modalOpen ? closeModal() : openModal(false); }
});
addEventListener("keyup", e => { keys[e.code] = false; });

// ---------- Движение игрока ----------
let walkAmt = 0, lastStep = 0, nightK = 0;
function updatePlayer(dt) {
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let mx = move.x + (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  let my = move.y + (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const speed = 5.2;
  const vx = (-sin * my + cos * mx) * speed + player.knockX;
  const vz = (-cos * my - sin * mx) * speed + player.knockZ;
  const decay = Math.max(0, 1 - dt * 6); player.knockX *= decay; player.knockZ *= decay;
  player.x = Math.max(-145, Math.min(145, player.x + vx * dt));
  player.z = Math.max(-145, Math.min(145, player.z + vz * dt));
  for (const o of obstacles) {
    const ox = player.x - o.x, oz = player.z - o.z, min = o.radius + .45;
    if (Math.abs(ox) > min || Math.abs(oz) > min) continue;
    const d = Math.hypot(ox, oz);
    if (d < min && d > .0001) { player.x = o.x + ox / d * min; player.z = o.z + oz / d * min; }
  }
  const was = player.grounded;
  player.vy -= 24 * dt; player.y += player.vy * dt;
  const gy = heightAt(player.x, player.z);
  if (player.y <= gy || (was && player.vy <= 0 && player.y - gy < .5)) { player.y = gy; player.vy = 0; player.grounded = true; }
  else player.grounded = false;
  const target = player.grounded ? Math.min(1, Math.hypot(mx, my)) : 0;
  walkAmt += (target - walkAmt) * Math.min(1, dt * 10);
  walkTime += dt * 9 * walkAmt;
  const stepNo = Math.floor(walkTime / Math.PI);
  if (stepNo !== lastStep) { lastStep = stepNo; if (walkAmt > .4 && player.grounded) sfx("step"); }
}

// ---------- День и ночь, звёзды ----------
const DAY_LEN = 300;
let dayTime = .05;
const cDay = new THREE.Color(0x87ceeb), cNight = new THREE.Color(0x070b18), cDusk = new THREE.Color(0xff8a4c);
const starGeo = new THREE.BufferGeometry();
const sp = new Float32Array(300 * 3);
for (let i = 0; i < 300; i++) {
  const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random());
  sp[i * 3] = 110 * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = 110 * Math.cos(ph); sp[i * 3 + 2] = 110 * Math.sin(ph) * Math.sin(th);
}
starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
stars.frustumCulled = false; scene.add(stars);
const clamp = THREE.MathUtils.clamp;
function updateSky(dt) {
  dayTime = (dayTime + dt / DAY_LEN) % 1;
  const a = dayTime * Math.PI * 2, h = Math.sin(a);
  const day = clamp(h * 3 + .3, 0, 1);
  scene.background.copy(cNight).lerp(cDay, day);
  scene.background.lerp(cDusk, clamp(1 - Math.abs(h) * 4, 0, 1) * .6);
  scene.fog.color.copy(scene.background);
  sun.position.set(player.x + Math.cos(a) * 60, Math.max(8, Math.sin(a) * 60 + 8), player.z + 25);
  sun.target.position.set(player.x, player.y, player.z);
  sun.intensity = 2.1 * clamp(h * 3 + .2, 0, 1);
  hemi.intensity = .25 + 1.75 * day;
  stars.material.opacity = clamp(1 - day * 2, 0, 1);
  nightK = clamp(1 - day * 2, 0, 1);
  stars.position.copy(camera.position);
}
