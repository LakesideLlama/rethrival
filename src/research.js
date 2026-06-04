import { RESEARCH } from './constants.js';
import { inv, researchUnlocked, xp, player, setResearchOpen, researchOpen } from './state.js';
import { showMsg, canAfford, spendCost, costStr } from './utils.js';
import { gainXP, updateUI } from './ui.js';
import { saveGame } from './save.js';

// ── Star field ────────────────────────────────────────────────────────────────
const STAR_COUNT = 320;
let stars = [];
let starCanvas, starCtx;

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 3000,
      z: Math.random() * 1800 + 200,
      r: Math.random() * 1.4 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
}

function drawStars(pitch, alpha, bgAlpha) {
  if (!starCtx) return;
  const W = starCanvas.width, H = starCanvas.height;
  const cx = W / 2, cy = H / 2;
  const FOV = 600;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  starCtx.clearRect(0, 0, W, H);
  // Solid background painted directly onto the star canvas — hides the game canvas below
  starCtx.globalAlpha = bgAlpha;
  starCtx.fillStyle = '#00000a';
  starCtx.fillRect(0, 0, W, H);
  starCtx.globalAlpha = 1;
  const t = Date.now() * 0.001;
  for (const s of stars) {
    const ry = s.y * cp - s.z * sp;
    const rz = s.y * sp + s.z * cp;
    if (rz <= 0) continue;
    const sx = s.x / rz * FOV + cx;
    const sy = -ry / rz * FOV + cy;
    if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    const brightness = 0.55 + 0.45 * Math.sin(t * 1.8 + s.twinkle);
    const a = brightness * alpha;
    starCtx.globalAlpha = a;
    starCtx.fillStyle = '#fff';
    starCtx.beginPath();
    starCtx.arc(sx, sy, s.r, 0, Math.PI * 2);
    starCtx.fill();
    if (s.r > 1.0) {
      starCtx.globalAlpha = a * 0.28;
      starCtx.beginPath();
      starCtx.arc(sx, sy, s.r * 3.5, 0, Math.PI * 2);
      starCtx.fill();
    }
  }
  starCtx.globalAlpha = 1;
}

// ── Animation state ───────────────────────────────────────────────────────────
let animState = 'idle'; // idle | opening | open | closing
let animStart = 0;
const ANIM_DUR = 1400;
const PITCH_START = -0.18;
const PITCH_END = 1.38;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

let rafId = null;

function animLoop() {
  if (!starCanvas) return;
  const now = Date.now();
  const elapsed = now - animStart;
  const raw = Math.min(elapsed / ANIM_DUR, 1);
  const e = easeInOut(raw);

  if (animState === 'opening') {
    const pitch = PITCH_START + (PITCH_END - PITCH_START) * e;
    drawStars(pitch, e, e);
    if (raw >= 1) {
      animState = 'open';
      showPanel();
    }
  } else if (animState === 'open') {
    drawStars(PITCH_END, 1, 1);
  } else if (animState === 'closing') {
    const pitch = PITCH_END + (PITCH_START - PITCH_END) * e;
    drawStars(pitch, 1 - e, 1 - e);
    if (raw >= 1) {
      animState = 'idle';
      const ui = document.getElementById('research-ui');
      if (ui) ui.style.display = 'none';
      if (starCtx) starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
      rafId = null;
      return;
    }
  }

  rafId = requestAnimationFrame(animLoop);
}

function showPanel() {
  const panel = document.getElementById('research-panel');
  if (panel) { panel.style.opacity = '0'; panel.style.transform = 'translateY(24px)'; panel.style.display = 'flex'; }
  requestAnimationFrame(() => {
    if (panel) { panel.style.transition = 'opacity .4s, transform .4s'; panel.style.opacity = '1'; panel.style.transform = 'translateY(0)'; }
  });
  renderResearch();
}

// ── Open / close ──────────────────────────────────────────────────────────────
export function openResearch() {
  if (animState !== 'idle') return;
  if (!starCanvas) {
    starCanvas = document.getElementById('star-c');
    starCtx = starCanvas ? starCanvas.getContext('2d') : null;
    if (starCanvas) { starCanvas.width = window.innerWidth; starCanvas.height = window.innerHeight; }
    window.addEventListener('resize', () => {
      if (starCanvas) { starCanvas.width = window.innerWidth; starCanvas.height = window.innerHeight; }
    });
    initStars();
  }
  setResearchOpen(true);
  animState = 'opening';
  animStart = Date.now();
  const ui = document.getElementById('research-ui');
  if (ui) { ui.style.display = 'flex'; }
  const panel = document.getElementById('research-panel');
  if (panel) { panel.style.display = 'none'; }
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animLoop);
}

export function closeResearch() {
  if (animState === 'idle') return;
  const panel = document.getElementById('research-panel');
  if (panel) { panel.style.transition = 'opacity .25s, transform .25s'; panel.style.opacity = '0'; panel.style.transform = 'translateY(24px)'; setTimeout(() => { if (panel) panel.style.display = 'none'; }, 260); }
  animState = 'closing';
  animStart = Date.now();
  setResearchOpen(false);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animLoop);
}

// ── Research logic ────────────────────────────────────────────────────────────
export function applyResearchEffects() {
  const base = 120;
  let mult = 1;
  if (researchUnlocked.has('speed_2')) mult = 1.5;
  else if (researchUnlocked.has('speed_1')) mult = 1.25;
  player.spd = base * mult;
}

export function getResearchMultiplier(type) {
  if (type === 'respawn') {
    if (researchUnlocked.has('respawn_2')) return 0.4;
    if (researchUnlocked.has('respawn_1')) return 0.6;
    return 1.0;
  }
  if (type === 'harvest') {
    if (researchUnlocked.has('harvest_2')) return 2;
    if (researchUnlocked.has('harvest_1')) return 1;
    return 0;
  }
  if (type === 'xp') {
    return researchUnlocked.has('xp_1') ? 1.25 : 1.0;
  }
  if (type === 'craft') {
    return researchUnlocked.has('craft_1') ? 0.7 : 1.0;
  }
  return 1.0;
}

function renderResearch() {
  const container = document.getElementById('research-items');
  if (!container) return;
  container.innerHTML = '';
  for (const r of RESEARCH) {
    const unlocked = researchUnlocked.has(r.id);
    const needsMet = !r.needs || researchUnlocked.has(r.needs);
    const xpMet = xp >= r.xpReq;
    const affordable = canAfford(r.cost);
    const canUnlock = !unlocked && needsMet && xpMet && affordable;
    const el = document.createElement('div');
    el.className = 'res-item' + (unlocked ? ' res-done' : '') + (!needsMet ? ' res-locked' : '');
    el.innerHTML = `
      <div class="res-name">${unlocked ? '✓ ' : ''}${r.name}</div>
      <div class="res-desc">${r.desc}</div>
      <div class="res-meta">
        <span class="res-cost">${unlocked ? 'Unlocked' : costStr(r.cost)}</span>
        ${r.xpReq > 0 ? `<span class="res-xp-req${xpMet ? ' met' : ''}">Lv ${r.xpReq} XP</span>` : ''}
      </div>
    `;
    if (!unlocked && needsMet) {
      el.style.cursor = canUnlock ? 'pointer' : 'default';
      if (canUnlock) {
        el.addEventListener('click', () => unlockResearch(r));
        el.classList.add('res-can-buy');
      }
    }
    container.appendChild(el);
  }
}

function unlockResearch(r) {
  if (!canAfford(r.cost)) { showMsg(`Need: ${costStr(r.cost)}`); return; }
  if (xp < r.xpReq) { showMsg(`Need ${r.xpReq} XP`); return; }
  spendCost(r.cost);
  researchUnlocked.add(r.id);
  applyResearchEffects();
  gainXP(20);
  showMsg(`${r.name} researched!`);
  updateUI();
  saveGame();
  renderResearch();
}
