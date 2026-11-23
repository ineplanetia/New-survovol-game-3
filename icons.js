// icons.js: пиксельные иконки предметов (рисуются кодом, 16x16) и портрет персонажа
const ICON_URL = {};
const OUTLINE = "#1a130e";
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
  const f = k >= 0 ? v => v + (255 - v) * k : v => v * (1 + k);
  return "#" + ch.map(v => Math.max(0, Math.min(255, Math.round(f(v)))).toString(16).padStart(2, "0")).join("");
}
// Рисуем по пикселям: P точка, R прямоугольник, L линия (th=2 толще), D круг. Потом объём (свет сверху) и контур.
function pixelGrid(W, H, draw, bevel = true) {
  const g = Array.from({ length: H }, () => Array(W).fill(null));
  const P = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
  const R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c); };
  const L = (x0, y0, x1, y1, c, th = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; P(x, y, c); if (th > 1) P(x + 1, y, c); }
  };
  const D = (cx, cy, r, c) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + .5) P(x, y, c); };
  draw({ P, R, L, D });
  if (bevel) {
    const src = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = src[y][x]; if (!c) continue;
      if (y === 0 || !src[y - 1][x]) g[y][x] = shade(c, .2);
      else if (y === H - 1 || !src[y + 1][x]) g[y][x] = shade(c, -.22);
    }
  }
  const out = g.map(r => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g[y][x]) {
    if ((y > 0 && g[y - 1][x]) || (y < H - 1 && g[y + 1][x]) || (x > 0 && g[y][x - 1]) || (x < W - 1 && g[y][x + 1])) out[y][x] = OUTLINE;
  }
  return out;
}
function gridToCanvas(grid, cv) {
  const H = grid.length, W = grid[0].length;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x]) { ctx.fillStyle = grid[y][x]; ctx.fillRect(x, y, 1, 1); }
  return cv;
}

// ---------- Семейства рисунков ----------
const WD = "#9a6a3a", WDD = "#6e4a26", WDL = "#c08a52", BONE = "#e8e1ca", BONES = "#b9b199", BONED = "#7d7560";
const handle = (L, x0, y0, x1, y1) => { L(x0, y0, x1, y1, WD, 2); L(x0 + 1, y0, x1 + 1, y1, WDD); };
const axeArt = (head, small) => ({ R, L }) => {
  handle(L, 3, 14, 10, 5);
  const s = small ? 1 : 0;
  R(8 + s, 1 + s, 5 - s, 6 - s, head); R(12, 1 + s, 2, 6 - s, shade(head, .35)); R(8 + s, 6, 5 - s, 1, shade(head, -.3));
};
const pickArt = head => ({ R, L, P }) => {
  handle(L, 4, 14, 8, 3);
  R(2, 3, 12, 2, head); R(2, 3, 12, 1, shade(head, .3)); P(1, 5, head); P(14, 5, head); P(2, 5, shade(head, -.3)); P(13, 5, shade(head, -.3));
};
const shovelArt = hex => ({ R, L, D, P }) => {
  L(11, 1, 6, 9, WD, 2); R(9, 1, 4, 1, WDD);
  D(5, 12, 3, hex); R(4, 9, 3, 2, hex); P(4, 11, shade(hex, .35));
};
const gemArt = (c, kind) => ({ R, P }) => {
  const rows = kind === "emerald" ? [[5, 6], [4, 8], [3, 10], [3, 10], [3, 10], [3, 10], [4, 8], [5, 6]]
    : [[5, 6], [4, 8], [3, 10], [3, 10], [4, 8], [5, 6], [6, 4], [7, 2]];
  rows.forEach(([x, w], i) => R(x, 3 + i, w, 1, c));
  rows.forEach(([x, w], i) => { if (i > 1) P(x + w - 1, 3 + i, shade(c, -.3)); });
  R(5, 4, 3, 1, shade(c, .55)); P(5, 5, shade(c, .55)); P(9, 6, "#ffffff");
  if (kind === "diamond") { R(3, 5, 10, 1, shade(c, -.12)); }
};
const berryArt = c => ({ D, P, R }) => {
  R(7, 2, 3, 2, "#3e8a3a"); P(10, 3, "#2f6e2c");
  for (const [x, y] of [[5, 10], [10, 10], [8, 7]]) { D(x, y, 2.4, c); P(x - 1, y - 1, shade(c, .55)); }
};
const lump = (c, c2) => ({ D, P }) => { D(8, 9, 5, c); D(6, 7, 2.2, c2); P(10, 12, shade(c, -.2)); };
const pile = (c, c2) => ({ R, P }) => {
  for (let y = 5; y < 14; y++) { const w = (y - 5) * 2 + 1; R(8 - (w >> 1), y, w, 1, c); }
  for (const [x, y] of [[6, 10], [9, 9], [8, 12], [11, 12], [5, 12], [7, 7]]) P(x, y, c2);
};

const ART = {
  small_axe: axeArt("#a7adb2", true), wooden_axe: axeArt("#a8763f"), stone_axe: axeArt("#8e949a"),
  wooden_pickaxe: pickArt("#a8763f"), stone_pickaxe: pickArt("#8e949a"),
  wooden_shovel: shovelArt("#a8763f"), stone_shovel: shovelArt("#8e949a"),
  sword: ({ L, P }) => {
    L(13, 2, 5, 10, "#d8dde2", 2); L(12, 2, 4, 10, "#aab1b8"); P(14, 1, "#ffffff");
    L(3, 8, 8, 13, "#6b4a2a", 2); L(4, 11, 2, 14, WDD, 2); P(2, 14, "#c9b060");
  },
  hammer: ({ R, L }) => { handle(L, 3, 14, 10, 6); R(7, 1, 8, 5, "#7a8085"); R(7, 1, 8, 1, "#a7adb2"); R(7, 5, 8, 1, "#4f5458"); },
  wood: ({ L, P }) => { L(3, 13, 12, 3, WD, 2); L(4, 13, 13, 3, WDD); L(7, 9, 10, 10, WD); L(5, 11, 3, 9, WD); P(12, 3, WDL); P(11, 4, WDL); P(3, 13, "#d9b58a"); },
  stick: ({ L, P }) => { L(3, 14, 12, 3, WDL); L(4, 14, 13, 3, WD); P(12, 2, WDL); P(8, 9, WDD); },
  plank: ({ R, P }) => {
    R(1, 4, 14, 8, "#c59a62"); R(1, 7, 14, 1, "#a87b45"); R(1, 10, 14, 1, "#a87b45");
    P(3, 5, "#8a6130"); P(12, 9, "#8a6130"); P(7, 11, "#8a6130"); R(1, 4, 1, 8, "#dcb982");
  },
  stone: ({ D, P }) => { D(8, 9, 5, "#8a8f92"); D(6, 7, 2.5, "#aab0b3"); D(11, 11, 2, "#73787b"); P(9, 6, "#c1c6c8"); },
  coal: ({ D, P }) => { D(8, 9, 5, "#2e2e33"); D(6, 7, 2, "#55555c"); P(10, 6, "#8a8a94"); P(5, 11, "#444448"); },
  dirt: pile("#6b4f33", "#86683f"), sand: pile("#e0cf8f", "#f3e7b4"), clay: lump("#b5693c", "#d08852"),
  brick: ({ R, P }) => {
    R(1, 4, 14, 8, "#b5502f"); R(1, 7, 14, 1, "#e0cdb4"); R(1, 4, 14, 0, "#e0cdb4");
    R(5, 4, 1, 3, "#e0cdb4"); R(11, 4, 1, 3, "#e0cdb4"); R(3, 8, 1, 3, "#e0cdb4"); R(9, 8, 1, 3, "#e0cdb4"); R(14, 8, 1, 3, "#e0cdb4");
    P(2, 5, "#cf6a45"); P(7, 9, "#cf6a45");
  },
  glass: ({ R, L, P }) => {
    R(3, 2, 10, 12, "#cdeefa"); R(3, 2, 10, 1, "#8fc5d8"); R(3, 13, 10, 1, "#8fc5d8"); R(3, 2, 1, 12, "#8fc5d8"); R(12, 2, 1, 12, "#8fc5d8");
    L(5, 10, 9, 4, "#ffffff"); L(7, 12, 11, 6, "#ffffff"); P(5, 4, "#ffffff");
  },
  ruby: gemArt("#d0213a", "round"), sapphire: gemArt("#2a5ad8", "round"), emerald: gemArt("#1fae55", "emerald"), diamond: gemArt("#bdeeff", "diamond"),
  berry_wild: berryArt("#754184"), berry_blue: berryArt("#306bd1"), berry_red: berryArt("#c92d3b"),
  raw_meat: ({ D, L, R, P }) => { D(7, 8, 5, "#d8657c"); D(5, 6, 2.5, "#e98499"); L(4, 10, 10, 6, "#f5d7dc"); R(11, 10, 4, 2, BONE); P(15, 9, BONE); P(15, 12, BONE); },
  cooked_meat: ({ D, L, R, P }) => { D(7, 8, 5, "#9b5a2e"); D(5, 6, 2.5, "#b9743f"); L(4, 6, 9, 11, "#5e3317"); L(6, 5, 11, 10, "#5e3317"); R(11, 10, 4, 2, BONE); P(15, 9, BONE); P(15, 12, BONE); },
  bone: ({ L, D }) => { L(4, 12, 11, 5, BONE, 2); D(3, 12, 1.8, BONE); D(5, 13, 1.5, BONE); D(12, 4, 1.8, BONE); D(10, 3, 1.5, BONE); },
  wool: ({ D, P }) => { for (const [x, y] of [[5, 9], [9, 7], [11, 10], [7, 11], [8, 9]]) D(x, y, 3, "#f1eee3"); P(7, 6, "#ffffff"); P(11, 12, "#cfcabb"); },
  bandage: ({ R }) => { R(2, 5, 12, 6, "#f4f1ea"); R(2, 7, 12, 1, "#dcd6c8"); R(7, 6, 2, 4, "#c9302c"); R(6, 7, 4, 2, "#c9302c"); },
  table: ({ R, P }) => {
    R(1, 5, 14, 3, "#b98a52"); R(1, 8, 14, 1, "#7a5430"); R(2, 9, 2, 6, WDD); R(12, 9, 2, 6, WDD); R(4, 11, 8, 1, WD);
    R(9, 3, 4, 2, "#aab1b8"); P(4, 4, "#9aa0a5"); P(5, 4, "#9aa0a5");
  },
  furnace: ({ R, P, D }) => {
    R(2, 3, 12, 11, "#8a8f92"); R(10, 1, 3, 2, "#73787b");
    R(2, 6, 12, 1, "#6c7174"); R(2, 10, 12, 1, "#6c7174"); R(6, 3, 1, 3, "#6c7174"); R(10, 7, 1, 3, "#6c7174"); R(4, 7, 1, 3, "#6c7174");
    R(5, 9, 6, 5, "#1d1d1f"); D(8, 12, 1.6, "#ff8a1f"); P(8, 11, "#ffd24a");
  },
  chest: ({ R, P }) => {
    R(2, 6, 12, 8, "#8a5a2b"); R(2, 3, 12, 4, "#a06a35"); R(2, 7, 12, 1, "#5e3a1b"); R(6, 8, 1, 6, "#6e4620"); R(10, 8, 1, 6, "#6e4620");
    R(7, 6, 2, 3, "#d9b44a"); P(8, 8, "#3a2a10"); P(2, 3, null); P(13, 3, null);
  },
  sleeping_bag: ({ R, D, P }) => {
    R(2, 5, 12, 7, "#3d6fb5"); R(2, 8, 12, 1, "#2c4f86"); P(2, 5, null); P(13, 5, null); P(2, 11, null); P(13, 11, null);
    D(3, 8, 3.2, "#5f8fd0"); R(10, 3, 4, 3, "#ece7d6");
  },
  bone_helmet: ({ D, R, P }) => {
    D(8, 8, 6, BONE); R(0, 12, 16, 4, null); R(2, 12, 12, 1, BONES);
    R(5, 9, 6, 2, "#2a2420"); R(7, 9, 2, 4, BONE); R(7, 2, 2, 4, BONES); P(5, 5, "#ffffff");
  },
  bone_chest: ({ R }) => {
    R(3, 3, 10, 11, BONE); R(6, 3, 4, 2, null); R(1, 3, 3, 5, BONE); R(12, 3, 3, 5, BONE);
    R(5, 7, 6, 1, BONES); R(5, 9, 6, 1, BONES); R(5, 11, 6, 1, BONES); R(8, 5, 1, 8, BONED);
  },
  bone_pants: ({ R }) => {
    R(3, 2, 10, 4, BONE); R(3, 2, 10, 1, BONES); R(3, 6, 4, 9, BONE); R(9, 6, 4, 9, BONE);
    R(3, 10, 4, 1, BONES); R(9, 10, 4, 1, BONES); R(7, 6, 2, 1, BONED);
  },
  bone_boots: ({ R }) => {
    R(2, 5, 5, 7, BONE); R(9, 5, 5, 7, BONE); R(1, 12, 6, 2, BONED); R(8, 12, 6, 2, BONED); R(2, 5, 5, 1, BONES); R(9, 5, 5, 1, BONES);
  },
  bone_shield: ({ D, R }) => { D(8, 8, 6, BONE); D(8, 8, 5, "#8a5a2b"); R(7, 3, 2, 10, "#6e4a26"); R(3, 7, 10, 2, "#6e4a26"); D(8, 8, 2, BONE); }
};
for (const type in ART) {
  try {
    const cv = gridToCanvas(pixelGrid(16, 16, ART[type]), document.createElement("canvas"));
    ICON_URL[type] = cv.toDataURL();
    icons[type] = `<img class="ico" src="${ICON_URL[type]}" alt="">`;
  } catch (e) { /* останется значок-эмодзи */ }
}
function miniIcon(t) { return ICON_URL[t] ? `<img class="ico s" src="${ICON_URL[t]}" alt="">` : (icons[t] || "?"); }

// ---------- Портрет персонажа: лицо, тело и надетая броня ----------
function drawAvatar() {
  const cv = document.getElementById("avatarCanvas");
  if (!cv || !cv.getContext) return;
  const A = player.armorSlots;
  const grid = pixelGrid(24, 40, ({ R, P }) => {
    const skin = "#e8b48a", skinD = "#c98e69", hair = "#4a2f1a", shirt = "#3f6fa8", pants = "#33445f", boot = "#4a3524", belt = "#3a2a1a";
    // ноги и ботинки
    R(6, 26, 5, 10, A.legs ? BONE : pants); R(13, 26, 5, 10, A.legs ? BONE : pants);
    if (A.legs) { R(6, 31, 5, 1, BONES); R(13, 31, 5, 1, BONES); }
    R(6, 36, 5, 3, A.boots ? BONE : boot); R(13, 36, 5, 3, A.boots ? BONE : boot);
    R(5, 38, 6, 1, A.boots ? BONED : "#2a1c10"); R(13, 38, 6, 1, A.boots ? BONED : "#2a1c10");
    // туловище и руки
    R(6, 14, 12, 12, A.chest ? BONE : shirt);
    if (A.chest) { R(8, 17, 8, 1, BONES); R(8, 20, 8, 1, BONES); R(8, 23, 8, 1, BONES); R(11, 15, 2, 9, BONED); }
    else { R(6, 14, 12, 1, "#5a8cc4"); R(11, 17, 2, 6, "#4f7fb8"); }
    R(6, 25, 12, 1, belt);
    R(3, 14, 3, 8, A.chest ? BONE : shirt); R(18, 14, 3, 8, A.chest ? BONE : shirt); // рукава
    R(3, 22, 3, 4, skin); R(18, 22, 3, 4, skin); R(3, 25, 3, 1, skinD); R(18, 25, 3, 1, skinD);
    if (A.chest) { R(2, 13, 4, 3, BONES); R(18, 13, 4, 3, BONES); }
    // голова и лицо
    R(7, 3, 10, 10, skin); P(7, 3, null); P(16, 3, null); P(7, 12, null); P(16, 12, null);
    R(10, 13, 4, 1, skinD); P(6, 8, skin); P(17, 8, skin);
    R(7, 2, 10, 3, hair); R(6, 3, 1, 5, hair); R(17, 3, 1, 5, hair); R(7, 5, 3, 1, hair); R(14, 5, 3, 1, hair); P(6, 2, null); P(17, 2, null);
    R(9, 6, 2, 1, hair); R(13, 6, 2, 1, hair);                                   // брови
    R(9, 7, 2, 2, "#ffffff"); R(13, 7, 2, 2, "#ffffff"); P(10, 8, "#2a1a10"); P(14, 8, "#2a1a10");   // глаза
    P(12, 9, skinD); P(12, 10, skinD);                                           // нос
    P(9, 10, "#e29a7a"); P(15, 10, "#e29a7a");                                   // румянец
    R(10, 11, 4, 1, "#9a3e36"); P(9, 10, "#c97562"); P(14, 10, "#c97562");       // улыбка
    // шлем, щит
    if (A.helmet) { R(6, 1, 12, 5, BONE); R(6, 5, 2, 4, BONE); R(16, 5, 2, 4, BONE); R(11, 5, 2, 5, BONE); R(6, 5, 12, 1, BONES); P(6, 1, null); P(17, 1, null); }
    if (A.shield) { R(0, 15, 5, 10, "#8a5a2b"); R(0, 15, 5, 1, BONE); R(0, 24, 5, 1, BONE); R(0, 15, 1, 10, BONE); R(4, 15, 1, 10, BONE); P(2, 19, BONE); P(2, 20, BONE); P(2, 21, BONE); }
  });
  gridToCanvas(grid, cv);
}
