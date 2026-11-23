// audio.js: звуки без файлов (создаются кодом) и фоновая атмосфера
let audioCtx = null, masterGain = null, noiseBuf = null, soundOn = true;
try { soundOn = localStorage.getItem("island_sound") !== "0"; } catch (e) {}
const lastPlay = {};

function audioInit() {
  if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    audioCtx = new AC();
    masterGain = audioCtx.createGain(); masterGain.gain.value = soundOn ? .7 : 0; masterGain.connect(audioCtx.destination);
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbient();
  } catch (e) { audioCtx = null; }
}
// звук можно включить только после касания экрана (правило браузеров)
["pointerup", "touchend", "click", "keydown"].forEach(ev => addEventListener(ev, audioInit, { passive: true }));

function noise(freq, q, dur, vol, type = "bandpass", delay = 0, slideTo) {
  if (!audioCtx || !soundOn) return;
  const t = audioCtx.currentTime + delay;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
  const f = audioCtx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(masterGain);
  src.start(t, Math.random() * .4); src.stop(t + dur + .05);
}
function tone(freq, dur, vol, type = "sine", slideTo, delay = 0) {
  if (!audioCtx || !soundOn) return;
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + .05);
}

const SFX = {
  chop() { noise(900, 1.2, .12, .5); tone(110, .12, .35, "triangle", 70); },
  clink() { noise(3200, 3, .1, .35); tone(1400, .12, .15, "square", 900); },
  thud() { noise(300, .8, .15, .5); tone(90, .15, .4, "sine", 50); },
  pop() { tone(500, .09, .25, "sine", 900); },
  step() { noise(220 + Math.random() * 80, .7, .07, .12, "lowpass"); },
  jump() { tone(220, .12, .12, "sine", 380); },
  hurt() { noise(500, .6, .25, .6, "lowpass"); tone(160, .25, .45, "sawtooth", 70); },
  eat() { noise(1800, 2, .05, .3); noise(1500, 2, .05, .3, "bandpass", .09); noise(1700, 2, .05, .3, "bandpass", .18); },
  craft() { tone(660, .08, .2, "square"); tone(990, .12, .2, "square", undefined, .08); },
  equip() { noise(2200, 1, .1, .25, "highpass"); tone(300, .1, .2, "triangle", 450); },
  fall() { noise(250, .5, .9, .6, "lowpass", 0, 80); tone(70, .8, .5, "sine", 35); },
  break() { noise(1200, .8, .3, .5); tone(180, .3, .4, "triangle", 60); },
  swing() { noise(700, .8, .12, .15, "bandpass", 0, 2500); },
  dig() { noise(350, .7, .18, .45, "lowpass"); tone(80, .14, .3, "sine", 50); },
  gem() { tone(1200, .12, .2); tone(1600, .18, .2, "sine", undefined, .1); tone(2000, .25, .18, "sine", undefined, .2); },
  bleat() { tone(420, .35, .2, "sawtooth", 340); tone(425, .35, .12, "square", 335); }
};
function sfx(name) {
  if (!audioCtx || !soundOn) return;
  const now = performance.now();
  if (lastPlay[name] && now - lastPlay[name] < 45) return;
  lastPlay[name] = now;
  const f = SFX[name];
  if (f) { try { f(); } catch (e) {} }
}

// Фон: ветер, ночью сверчки, днём птицы
function startAmbient() {
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = audioCtx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 380;
  const g = audioCtx.createGain(); g.gain.value = .03;
  src.connect(f); f.connect(g); g.connect(masterGain); src.start();
  setInterval(() => {
    if (!audioCtx || !soundOn) return;
    const t = audioCtx.currentTime;
    g.gain.setTargetAtTime(.015 + Math.random() * .05, t, 1.2);
    f.frequency.setTargetAtTime(250 + Math.random() * 350, t, 1.5);
    if (typeof nightK === "undefined") return;
    if (nightK > .5 && Math.random() < .7) { for (let i = 0; i < 3; i++) tone(4300 + Math.random() * 300, .05, .035, "square", undefined, i * .09); }
    else if (nightK < .3 && Math.random() < .25) {
      const b = 2200 + Math.random() * 900;
      tone(b, .1, .05, "sine", b * 1.4); tone(b * 1.2, .1, .05, "sine", b * 1.5, .14);
    }
  }, 1500);
}

function setSound(on) {
  soundOn = on;
  if (masterGain) masterGain.gain.value = on ? .7 : 0;
  try { localStorage.setItem("island_sound", on ? "1" : "0"); } catch (e) {}
  const b = document.getElementById("soundButton");
  if (b) b.textContent = on ? "🔊" : "🔇";
}
document.getElementById("soundButton").addEventListener("click", () => { audioInit(); setSound(!soundOn); });
setSound(soundOn);
