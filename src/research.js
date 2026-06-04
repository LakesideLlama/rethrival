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

// ── Animation ─────────────────────────────────────────────────────────────────
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
    if (raw >= 1) animState = 'open';
  } else if (animState === 'open') {
    drawStars(PITCH_END, 1, 1);
    drawTree(starCtx, starCanvas.width, starCanvas.height);
  } else if (animState === 'closing') {
    const pitch = PITCH_END + (PITCH_START - PITCH_END) * e;
    const bgAlpha = Math.max(0, Math.min(1 - (raw - 0.85) / 0.15, 1));
    drawStars(pitch, 1 - e, bgAlpha);
    if (raw >= 1) {
      animState = 'idle';
      document.getElementById('research-ui').style.display = 'none';
      starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
      rafId = null;
      return;
    }
  }

  rafId = requestAnimationFrame(animLoop);
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
    initOverlay();
  }
  setResearchOpen(true);
  animState = 'opening';
  animStart = Date.now();
  document.getElementById('research-ui').style.display = 'flex';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animLoop);
}

export function closeResearch() {
  if (animState === 'idle') return;
  animState = 'closing';
  animStart = Date.now();
  setResearchOpen(false);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animLoop);
}

// ── Overlay mouse events ──────────────────────────────────────────────────────
let hoveredNode = null;

function initOverlay() {
  const overlay = document.getElementById('research-overlay');
  if (!overlay) return;
  overlay.addEventListener('mousemove', e => {
    const node = nodeAt(e.clientX, e.clientY);
    hoveredNode = node ? node.id : null;
    overlay.style.cursor = node ? 'pointer' : 'default';
  });
  overlay.addEventListener('mouseleave', () => { hoveredNode = null; });
  overlay.addEventListener('click', e => {
    const node = nodeAt(e.clientX, e.clientY);
    if (node) tryUnlock(node);
    else closeResearch();
  });
}

// ── Radial tree drawing ───────────────────────────────────────────────────────
const SECTIONS = {
  red:    { angle: -Math.PI / 2, label: 'Combat',      color: '#e53935', glow: '#e53935' },
  green:  { angle: 0,            label: 'Nature',      color: '#43a047', glow: '#43a047' },
  blue:   { angle: Math.PI / 2,  label: 'Crafting',    color: '#1e88e5', glow: '#1e88e5' },
  yellow: { angle: Math.PI,      label: 'Exploration', color: '#f9a825', glow: '#f9a825' },
};
const RING_R   = [0, 90, 160, 230];
const RING_SPREAD = [0, 0.36, 0.28, 0];

function nodePos(node, cx, cy) {
  const sec = SECTIONS[node.section];
  const spread = node.ring === 3 ? 0 : (node.slot === 0 ? -RING_SPREAD[node.ring] : RING_SPREAD[node.ring]);
  const angle = sec.angle + spread;
  const r = RING_R[node.ring];
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function nodeAt(mx, my) {
  if (!starCanvas) return null;
  const cx = starCanvas.width / 2, cy = starCanvas.height / 2;
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    const r = (node.ring === 3 ? 14 : 11) + 6;
    if (Math.hypot(mx - pos.x, my - pos.y) <= r) return node;
  }
  return null;
}

function starPath(ctx, cx, cy, r) {
  const points = 5, step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = i * step - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
            : ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawTree(ctx, W, H) {
  const cx = W / 2, cy = H / 2;
  const t = Date.now() * 0.001;

  // Connection lines
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    let parentPos = node.ring === 1 ? { x: cx, y: cy } : null;
    if (node.ring > 1 && node.needs) {
      const p = RESEARCH.find(r => r.id === node.needs);
      if (p) parentPos = nodePos(p, cx, cy);
    }
    if (!parentPos) continue;
    const unlocked = researchUnlocked.has(node.id);
    const parentUnlocked = node.ring === 1 || researchUnlocked.has(node.needs);
    ctx.beginPath();
    ctx.moveTo(parentPos.x, parentPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = unlocked ? SECTIONS[node.section].color + 'cc'
      : parentUnlocked ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)';
    ctx.lineWidth = unlocked ? 1.5 : 1;
    ctx.stroke();
  }

  // Center hub
  ctx.save();
  ctx.shadowColor = '#6a9adf';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#a8c4ff';
  ctx.fill();
  ctx.restore();

  // Section labels
  for (const [, sec] of Object.entries(SECTIONS)) {
    const lr = RING_R[3] + 30;
    ctx.fillStyle = sec.color;
    ctx.globalAlpha = 0.55;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sec.label.toUpperCase(), cx + Math.cos(sec.angle) * lr, cy + Math.sin(sec.angle) * lr);
    ctx.globalAlpha = 1;
  }

  // Nodes
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    const sec = SECTIONS[node.section];
    const unlocked = researchUnlocked.has(node.id);
    const needsMet = !node.needs || researchUnlocked.has(node.needs);
    const hovered = hoveredNode === node.id;
    const r = node.ring === 3 ? 13 : 10;
    const twinkleAmt = unlocked ? (0.8 + 0.2 * Math.sin(t * 2.2 + node.ring)) : 1;

    ctx.save();
    if (unlocked || hovered) {
      ctx.shadowColor = sec.glow;
      ctx.shadowBlur = unlocked ? 18 : 10;
    }
    starPath(ctx, pos.x, pos.y, r * twinkleAmt);
    if (unlocked) {
      ctx.fillStyle = sec.color;
    } else if (needsMet && researchPoints >= node.cost) {
      ctx.fillStyle = sec.color + '66';
      ctx.strokeStyle = sec.color + 'bb';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(80,90,130,.5)';
      ctx.strokeStyle = 'rgba(255,255,255,.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fill();
    ctx.restore();
  }

  // Tooltip for hovered node
  if (hoveredNode) {
    const node = RESEARCH.find(r => r.id === hoveredNode);
    if (node) {
      const pos = nodePos(node, cx, cy);
      const sec = SECTIONS[node.section];
      const unlocked = researchUnlocked.has(node.id);
      const needsMet = !node.needs || researchUnlocked.has(node.needs);
      const tw = 180, th = needsMet || unlocked ? 60 : 72;
      let tx = pos.x + 18, ty = pos.y - th / 2;
      if (tx + tw > W - 10) tx = pos.x - tw - 18;
      if (ty < 10) ty = 10;
      if (ty + th > H - 10) ty = H - th - 10;

      ctx.save();
      ctx.shadowColor = sec.color;
      ctx.shadowBlur = 12;
      roundRectPath(ctx, tx, ty, tw, th, 7);
      ctx.fillStyle = 'rgba(3,6,20,.96)';
      ctx.fill();
      ctx.strokeStyle = sec.color + '66';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = sec.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name, tx + 10, ty + 10);

      ctx.fillStyle = '#8898cc';
      ctx.font = '9px monospace';
      ctx.fillText(node.desc, tx + 10, ty + 25);

      if (unlocked) {
        ctx.fillStyle = '#43a047';
        ctx.fillText('✓ Unlocked', tx + 10, ty + 39);
      } else {
        ctx.fillStyle = needsMet ? (researchPoints >= node.cost ? '#f9a825' : '#e57373') : '#556';
        ctx.fillText(`Cost: ${node.cost} RP  (have: ${researchPoints})`, tx + 10, ty + 39);
        if (!needsMet) {
          const parent = RESEARCH.find(r => r.id === node.needs);
          ctx.fillStyle = '#445';
          ctx.fillText(`Req: ${parent ? parent.name : node.needs}`, tx + 10, ty + 53);
        }
      }
    }
  }

  // RP + hint overlay (top-center)
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  roundRectPath(ctx, cx - 110, 18, 220, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#f0c040';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`✦ ${researchPoints} Research Points`, cx, 32);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.font = '9px monospace';
  ctx.fillText('click a star to research · click background to close', cx, 52);
}

// ── Effects ───────────────────────────────────────────────────────────────────
function tryUnlock(node) {
  if (researchUnlocked.has(node.id)) { showMsg(`${node.name} already unlocked`); return; }
  if (node.needs && !researchUnlocked.has(node.needs)) {
    const parent = RESEARCH.find(r => r.id === node.needs);
    showMsg(`Requires: ${parent ? parent.name : node.needs}`);
    return;
  }
  if (researchPoints < node.cost) { showMsg(`Need ${node.cost} RP (have ${researchPoints})`); return; }
  setResearchPoints(researchPoints - node.cost);
  researchUnlocked.add(node.id);
  applyResearchEffects();
  gainXP(15);
  showMsg(`${node.name} researched!`);
  updateUI();
  saveGame();
}

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
