// save.js: сохранение и загрузка игры (в памяти браузера, сама каждые 8 секунд)
const SAVE_KEY = "island_save_v1";

function snapshot() {
  return {
    v: 1,
    player: player.dead ? null : {
      x: player.x, z: player.z, yaw: player.yaw,
      health: player.health, hunger: player.hunger, armorSlots: player.armorSlots
    },
    inventory, selectedSlot, dayTime,
    gone: [...gone], placed, digs: digs.map(d => ({ x: d.x, z: d.z, n: d.n }))
  };
}
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch (e) {}
}
function loadGame() {
  let d;
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; d = JSON.parse(raw); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  try {
    (d.gone || []).forEach(id => gone.add(id));
    for (const e of [...trees, ...rocks, ...pickups]) if (gone.has(e.id)) silentRemove(e);
    (d.digs || []).forEach(r => addDig(r.x, r.z, Math.min(r.n, MAX_DIG)));
    reapplyDigs();
    (d.placed || []).forEach(r => { placed.push(r); spawnPlaced(r); });
    if (typeof d.dayTime === "number") dayTime = d.dayTime;
    if (d.player) {
      const p = d.player;
      player.x = p.x; player.z = p.z; player.yaw = p.yaw || 0;
      player.health = p.health; player.hunger = p.hunger;
      player.y = heightAt(player.x, player.z);
      for (const k in player.armorSlots) player.armorSlots[k] = (p.armorSlots && p.armorSlots[k] && names[p.armorSlots[k].type]) ? p.armorSlots[k] : null;
      inventory.fill(null);
      (d.inventory || []).forEach((it, i) => { if (i < inventory.length && it && names[it.type]) inventory[i] = it; });
      selectedSlot = typeof d.selectedSlot === "number" ? d.selectedSlot : 0;
    }
  } catch (e) { return false; }
  return true;
}
// Строения, которые игрок поставил сам (верстак и т.д.), создаются заново при загрузке
function spawnPlaced(r) {
  if (r.type === "workbench") makeWorkbench(r.x, r.z);
}
// После смерти мир и постройки остаются, а персонаж начинает заново
function onDeath() { saveGame(); }

$("resetButton").addEventListener("click", () => {
  if (confirm("Начать новую игру? Всё сохранение будет удалено.")) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  }
});
