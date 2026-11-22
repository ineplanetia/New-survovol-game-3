// main.js: главный игровой цикл и запуск
// ---------- Главный цикл ----------
function pad(n) { return n < 10 ? "0" + n : "" + n; }
let last = performance.now(), statusTimer = 0, fpsAcc = 0, fpsN = 0, fps = 60;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;

  if (!player.dead) {
    updatePlayer(dt); survival(dt);
    handCooldown -= dt;
    if (handHeld && handCooldown <= 0 && !modalOpen) { useHand(); handCooldown = .45; }
  }
  updateSheep(dt); updateEntities(dt); updateParticles(dt);
  damageFlashTimer = Math.max(0, damageFlashTimer - dt);

  // камера и модель рук
  const shake = damageFlashTimer > 0 ? damageFlashTimer * .03 : 0;
  camera.position.set(
    player.x + (Math.random() - .5) * shake,
    player.y + 1.7 + Math.sin(walkTime) * .045 * walkAmt + (Math.random() - .5) * shake,
    player.z
  );
  camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
  camera.updateMatrixWorld();

  const swingAmt = swingUntil > now ? Math.sin((1 - (swingUntil - now) / 360) * Math.PI) : 0;
  leftLeg.rotation.x = Math.sin(walkTime) * .45 * walkAmt; rightLeg.rotation.x = -leftLeg.rotation.x;
  leftArm.rotation.x = -Math.sin(walkTime) * .12 * walkAmt;
  rightArm.rotation.x = Math.sin(walkTime) * .12 * walkAmt - swingAmt * .9;
  heldObject.rotation.set(-.25 - swingAmt * 1.2, 0, -.2 + swingAmt * .3);
  heldObject.position.set(.55, -.58 + Math.sin(walkTime * 2) * .012 * walkAmt, -1 - swingAmt * .12);

  updateTarget(); updateTargetUI(); updateSky(dt);

  // интерфейс
  fpsAcc += dt; fpsN++;
  statusTimer += dt;
  if (statusTimer > .2) {
    statusTimer = 0; updateStatus();
    if (fpsAcc > .5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const hours = (6 + dayTime * 24) % 24;
    clockEl.textContent = `🕐 ${pad(Math.floor(hours))}:${pad(Math.floor((hours % 1) * 60))} · ${fps} FPS`;
    bloodEl.classList.toggle("active", player.health < 30 || damageFlashTimer > 0);
    breathEl.style.display = (player.health < 35 || player.hunger < 10) && !player.dead ? "block" : "none";
  }
  renderer.render(scene, camera);
}

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

selectedSlot = 0;
loadGame();
setInterval(saveGame, 8000);
addEventListener("pagehide", saveGame);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveGame(); });
renderAll(); updateStatus();
requestAnimationFrame(loop);
