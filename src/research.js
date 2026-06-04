import { RESEARCH } from './constants.js';
import { player, researchUnlocked, setResearchOpen, researchPoints, setResearchPoints } from './state.js';
import { showMsg } from './utils.js';
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
let animState = 'idle';
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
  const elapsed = Date.now() - animStart;
  const raw = Math.min(elapsed / ANIM_DUR, 1);
  const e = easeInOut(raw);

  if (animState === 'opening') {
    const pitch = PITCH_START + (PITCH_END - PITCH_START) * e;
    const bgAlpha = Math.min(raw / 0.15, 1);
    drawStars(pitch, e, bgAlpha);
    if (raw >= 1) { animState = 'open'; showPanel(); }
  } else if (animState === 'open') {
    drawStars(PITCH_END, 1, 1);
    drawTreeLoop();
  } else if (animState === 'closing') {
    const pitch = PITCH_END + (PITCH_START - PITCH_END) * e;
    const bgAlpha = Math.max(0, Math.min(1 - (raw - 0.85) / 0.15, 1));
    drawStars(pitch, 1 - e, bgAlpha);
    if (raw >= 1) {
      animState = 'idle';
      document.getElementById('research-ui').style.display = 'none';
      if (starCtx) starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
      rafId = null;
      return;
    }
  }

  rafId = requestAnimationFrame(animLoop);
}

function showPanel() {
  const panel = document.getElementById('research-panel');
  if (!panel) return;
  panel.style.opacity = '0';
  panel.style.transform = 'translateY(20px)';
  panel.style.display = 'flex';
  requestAnimationFrame(() => {
    panel.style.transition = 'opacity .35s, transform .35s';
    panel.style.opacity = '1';
    panel.style.transform = 'translateY(0)';
  });
  initTreeCanvas();
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
      resizeTreeCanvas();
    });
    initStars();
  }
  setResearchOpen(true);
  animState = 'opening';
  animStart = Date.now();
  const ui = document.getElementById('research-ui');
  if (ui) ui.style.display = 'flex';
  const panel = document.getElementById('research-panel');
  if (panel) panel.style.display = 'none';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animLoop);
}

export function closeResearch() {
  if (animState === 'idle') return;
  const panel = document.getElementById('research-panel');
  if (panel) {
    panel.style.transition = 'opacity .2s, transform .2s';
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(20px)';
    setTimeout(() => { if (panel) panel.style.display = 'none'; }, 220);
  }
  animState = 'closing';
  animStart = Date.now();
  setResearchOpen(false);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animLoop);
}

// ── Radial tree canvas ────────────────────────────────────────────────────────
let treeCanvas, treeCtx;
let hoveredNode = null;

// Section layout: center angle (radians), label
const SECTIONS = {
  red:    { angle: -Math.PI / 2,  label: 'Combat',      color: '#e53935', glow: 'rgba(229,57,53,.35)' },
  green:  { angle: 0,             label: 'Nature',      color: '#43a047', glow: 'rgba(67,160,71,.35)' },
  blue:   { angle: Math.PI / 2,   label: 'Crafting',    color: '#1e88e5', glow: 'rgba(30,136,229,.35)' },
  yellow: { angle: Math.PI,       label: 'Exploration', color: '#f9a825', glow: 'rgba(249,168,37,.35)' },
};

// Radii per ring
const RING_R = [0, 82, 148, 210];
// Angular spread per ring (two slots = ±this many radians from section center)
const RING_SPREAD = [0, 0.38, 0.3, 0];

function nodePos(node, cx, cy) {
  const sec = SECTIONS[node.section];
  const spread = node.ring < 3 ? (node.slot === 0 ? -RING_SPREAD[node.ring] : RING_SPREAD[node.ring]) : 0;
  // ring-3 has only slot 0 centred
  const angle = sec.angle + (node.ring === 3 ? 0 : spread);
  const r = RING_R[node.ring];
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function starPath(ctx, cx, cy, r, points = 5) {
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = i * step - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
            : ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function initTreeCanvas() {
  treeCanvas = document.getElementById('tree-c');
  if (!treeCanvas) return;
  treeCtx = treeCanvas.getContext('2d');
  resizeTreeCanvas();
  treeCanvas.addEventListener('mousemove', onTreeMouseMove);
  treeCanvas.addEventListener('click', onTreeClick);
  treeCanvas.addEventListener('mouseleave', () => { hoveredNode = null; });
}

function resizeTreeCanvas() {
  if (!treeCanvas) return;
  const panel = document.getElementById('research-panel');
  if (!panel) return;
  treeCanvas.width = treeCanvas.offsetWidth;
  treeCanvas.height = treeCanvas.offsetHeight;
}

function drawTreeLoop() {
  if (!treeCtx || !treeCanvas) return;
  const rpEl = document.getElementById('res-rp');
  if (rpEl) rpEl.textContent = `✦ ${researchPoints} Research Points`;
  const W = treeCanvas.width, H = treeCanvas.height;
  const cx = W / 2, cy = H / 2;
  treeCtx.clearRect(0, 0, W, H);

  // Section arcs (subtle background wedges)
  for (const [, sec] of Object.entries(SECTIONS)) {
    treeCtx.beginPath();
    treeCtx.moveTo(cx, cy);
    treeCtx.arc(cx, cy, RING_R[3] + 36, sec.angle - Math.PI / 4, sec.angle + Math.PI / 4);
    treeCtx.closePath();
    treeCtx.fillStyle = sec.glow.replace('.35', '.08');
    treeCtx.fill();
  }

  // Center hub
  treeCtx.beginPath();
  treeCtx.arc(cx, cy, 14, 0, Math.PI * 2);
  treeCtx.fillStyle = '#1a2a4a';
  treeCtx.fill();
  treeCtx.strokeStyle = '#3a5a8a';
  treeCtx.lineWidth = 1.5;
  treeCtx.stroke();
  treeCtx.fillStyle = '#6a9adf';
  treeCtx.font = 'bold 9px monospace';
  treeCtx.textAlign = 'center';
  treeCtx.textBaseline = 'middle';
  treeCtx.fillText('R', cx, cy);

  // Lines first (behind nodes)
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    let parentPos;
    if (node.ring === 1) {
      parentPos = { x: cx, y: cy };
    } else if (node.needs) {
      const parent = RESEARCH.find(r => r.id === node.needs);
      if (parent) parentPos = nodePos(parent, cx, cy);
    }
    if (!parentPos) continue;
    const unlocked = researchUnlocked.has(node.id);
    const parentUnlocked = node.ring === 1 ? true : researchUnlocked.has(node.needs);
    treeCtx.beginPath();
    treeCtx.moveTo(parentPos.x, parentPos.y);
    treeCtx.lineTo(pos.x, pos.y);
    treeCtx.strokeStyle = unlocked ? SECTIONS[node.section].color : parentUnlocked ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)';
    treeCtx.lineWidth = unlocked ? 2 : 1;
    treeCtx.stroke();
  }

  // Section labels
  for (const [, sec] of Object.entries(SECTIONS)) {
    const labelR = RING_R[3] + 22;
    const lx = cx + Math.cos(sec.angle) * labelR;
    const ly = cy + Math.sin(sec.angle) * labelR;
    treeCtx.fillStyle = sec.color;
    treeCtx.globalAlpha = 0.7;
    treeCtx.font = 'bold 9px monospace';
    treeCtx.textAlign = 'center';
    treeCtx.textBaseline = 'middle';
    treeCtx.fillText(sec.label.toUpperCase(), lx, ly);
    treeCtx.globalAlpha = 1;
  }

  // Nodes
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    const sec = SECTIONS[node.section];
    const unlocked = researchUnlocked.has(node.id);
    const needsMet = !node.needs || researchUnlocked.has(node.needs);
    const canAfford = researchPoints >= node.cost;
    const hovered = hoveredNode === node.id;
    const r = node.ring === 3 ? 13 : 10;

    // Glow for unlocked or hovered+available
    if (unlocked || (hovered && needsMet)) {
      treeCtx.save();
      treeCtx.shadowColor = sec.color;
      treeCtx.shadowBlur = unlocked ? 14 : 8;
      starPath(treeCtx, pos.x, pos.y, r + (unlocked ? 2 : 0));
      treeCtx.fillStyle = unlocked ? sec.color : 'rgba(255,255,255,.1)';
      treeCtx.fill();
      treeCtx.restore();
    } else {
      starPath(treeCtx, pos.x, pos.y, r);
      treeCtx.fillStyle = needsMet && canAfford ? sec.color + 'aa' : 'rgba(60,70,100,.7)';
      treeCtx.fill();
      treeCtx.strokeStyle = needsMet ? sec.color : 'rgba(255,255,255,.12)';
      treeCtx.lineWidth = 1;
      treeCtx.stroke();
    }
  }

  // Tooltip for hovered node
  if (hoveredNode) {
    const node = RESEARCH.find(r => r.id === hoveredNode);
    if (node) {
      const pos = nodePos(node, cx, cy);
      const sec = SECTIONS[node.section];
      const unlocked = researchUnlocked.has(node.id);
      const needsMet = !node.needs || researchUnlocked.has(node.needs);
      const tw = 148, th = 58;
      let tx = pos.x + 14, ty = pos.y - th / 2;
      if (tx + tw > W - 8) tx = pos.x - tw - 14;
      if (ty < 8) ty = 8;
      if (ty + th > H - 8) ty = H - th - 8;
      treeCtx.fillStyle = 'rgba(4,8,24,.96)';
      treeCtx.strokeStyle = sec.color + '88';
      treeCtx.lineWidth = 1;
      roundRectCtx(treeCtx, tx, ty, tw, th, 6);
      treeCtx.fill(); treeCtx.stroke();
      treeCtx.fillStyle = sec.color;
      treeCtx.font = 'bold 10px monospace';
      treeCtx.textAlign = 'left';
      treeCtx.textBaseline = 'top';
      treeCtx.fillText(node.name, tx + 8, ty + 8);
      treeCtx.fillStyle = '#8898cc';
      treeCtx.font = '9px monospace';
      treeCtx.fillText(node.desc, tx + 8, ty + 22);
      treeCtx.fillStyle = unlocked ? '#43a047' : needsMet ? (researchPoints >= node.cost ? '#f9a825' : '#e53935') : '#556';
      treeCtx.fillText(unlocked ? '✓ Unlocked' : `Cost: ${node.cost} RP  (have: ${researchPoints})`, tx + 8, ty + 36);
      if (!unlocked && !needsMet) {
        const parent = RESEARCH.find(r => r.id === node.needs);
        treeCtx.fillStyle = '#556';
        treeCtx.fillText(`Requires: ${parent ? parent.name : node.needs}`, tx + 8, ty + 46);
      }
    }
  }
}

function roundRectCtx(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function getNodeAt(mx, my) {
  if (!treeCanvas) return null;
  const rect = treeCanvas.getBoundingClientRect();
  const cx = treeCanvas.width / 2, cy = treeCanvas.height / 2;
  const x = mx - rect.left, y = my - rect.top;
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    const r = (node.ring === 3 ? 13 : 10) + 4;
    if (Math.hypot(x - pos.x, y - pos.y) <= r) return node;
  }
  return null;
}

function onTreeMouseMove(e) {
  const node = getNodeAt(e.clientX, e.clientY);
  hoveredNode = node ? node.id : null;
  treeCanvas.style.cursor = node ? 'pointer' : 'default';
}

function onTreeClick(e) {
  const node = getNodeAt(e.clientX, e.clientY);
  if (!node) return;
  if (researchUnlocked.has(node.id)) { showMsg(`${node.name} already unlocked`); return; }
  if (node.needs && !researchUnlocked.has(node.needs)) {
    const parent = RESEARCH.find(r => r.id === node.needs);
    showMsg(`Requires: ${parent ? parent.name : node.needs}`);
    return;
  }
  if (researchPoints < node.cost) { showMsg(`Need ${node.cost} Research Points (have ${researchPoints})`); return; }
  setResearchPoints(researchPoints - node.cost);
  researchUnlocked.add(node.id);
  applyResearchEffects();
  gainXP(15);
  showMsg(`${node.name} researched!`);
  updateUI();
  saveGame();
}

// ── Effects ───────────────────────────────────────────────────────────────────
export function applyResearchEffects() {
  const base = 120;
  let mult = 1;
  if (researchUnlocked.has('pathfinder')) mult = 1.75;
  else if (researchUnlocked.has('speed_2')) mult = 1.5;
  else if (researchUnlocked.has('speed_1')) mult = 1.25;
  player.spd = base * mult;
}

export function getResearchMultiplier(type) {
  if (type === 'respawn') {
    if (researchUnlocked.has('nature_gift')) return 0.3;
    if (researchUnlocked.has('respawn_2')) return 0.4;
    if (researchUnlocked.has('respawn_1')) return 0.6;
    return 1.0;
  }
  if (type === 'harvest') {
    if (researchUnlocked.has('nature_gift')) return 2;
    if (researchUnlocked.has('harvest_2')) return 2;
    if (researchUnlocked.has('harvest_1')) return 1;
    return 0;
  }
  if (type === 'xp') {
    if (researchUnlocked.has('xp_2')) return 1.5;
    if (researchUnlocked.has('xp_1')) return 1.25;
    return 1.0;
  }
  if (type === 'craft') {
    if (researchUnlocked.has('arcane')) return 0.3;
    if (researchUnlocked.has('craft_2')) return 0.45;
    if (researchUnlocked.has('craft_1')) return 0.7;
    return 1.0;
  }
  if (type === 'island_cost') {
    if (researchUnlocked.has('pathfinder')) return 0.6;
    if (researchUnlocked.has('discount_2')) return 0.7;
    if (researchUnlocked.has('discount_1')) return 0.85;
    return 1.0;
  }
  return 1.0;
}
