import { RESEARCH } from './constants.js';
import { player, researchUnlocked, setResearchOpen, researchPoints, setResearchPoints } from './state.js';
import { showMsg } from './utils.js';
import { gainXP, updateUI } from './ui.js';
import { saveGame } from './save.js';

// ── Star field ────────────────────────────────────────────────────────────────
const STAR_COUNT = 600;
let stars = [];
let starCanvas, starCtx;

function initStars() {
  stars = [];
  // Distribute uniformly on a sphere so the full sky is covered at any pitch
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;       // azimuth
    const cosφ = Math.random() * 2 - 1;              // uniform on sphere
    const sinφ = Math.sqrt(1 - cosφ * cosφ);
    const r = Math.random() * 1200 + 500;
    stars.push({
      x: sinφ * Math.cos(theta) * r,
      y: sinφ * Math.sin(theta) * r,
      z: cosφ * r,
      r: Math.random() * 1.5 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
}

function drawStar(ctx, sx, sy, radius, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  if (radius > 1.0) {
    ctx.globalAlpha = alpha * 0.22;
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStars(pitch, alpha, bgAlpha) {
  if (!starCtx) return;
  const W = starCanvas.width, H = starCanvas.height;
  const cx = W / 2, cy = H / 2;
  const FOV = 700;
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
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    const brightness = 0.55 + 0.45 * Math.sin(t * 1.8 + s.twinkle);
    drawStar(starCtx, sx, sy, s.r, brightness * alpha);
  }
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
  } else {
    viewZoom = 1; viewPan.x = 0; viewPan.y = 0;
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

// ── Pan / zoom state ──────────────────────────────────────────────────────────
let viewZoom = 1;
let viewPan  = { x: 0, y: 0 };
let isDragging = false;
let dragStart  = { x: 0, y: 0 };
let panAtDrag  = { x: 0, y: 0 };
let didDrag    = false;  // distinguish click vs drag

function screenToTree(mx, my) {
  const cx = starCanvas.width / 2, cy = starCanvas.height / 2;
  return {
    x: (mx - cx - viewPan.x) / viewZoom + cx,
    y: (my - cy - viewPan.y) / viewZoom + cy,
  };
}

// ── Overlay mouse events ──────────────────────────────────────────────────────
let hoveredNode = null;

function initOverlay() {
  const overlay = document.getElementById('research-overlay');
  if (!overlay) return;

  overlay.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    viewZoom = Math.max(0.35, Math.min(4, viewZoom * factor));
  }, { passive: false });

  overlay.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    isDragging = true;
    didDrag = false;
    dragStart  = { x: e.clientX, y: e.clientY };
    panAtDrag  = { ...viewPan };
    overlay.style.cursor = 'grabbing';
  });

  overlay.addEventListener('mousemove', e => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (!didDrag && Math.hypot(dx, dy) > 4) didDrag = true;
      viewPan.x = panAtDrag.x + dx;
      viewPan.y = panAtDrag.y + dy;
      hoveredNode = null;
      overlay.style.cursor = 'grabbing';
      return;
    }
    const tp = screenToTree(e.clientX, e.clientY);
    const node = nodeAt(tp.x, tp.y);
    hoveredNode = node ? node.id : null;
    overlay.style.cursor = node ? 'pointer' : 'grab';
  });

  overlay.addEventListener('mouseup', e => {
    const wasDrag = didDrag;
    isDragging = false;
    didDrag = false;
    if (wasDrag) { overlay.style.cursor = 'grab'; return; }
    const tp = screenToTree(e.clientX, e.clientY);
    const node = nodeAt(tp.x, tp.y);
    if (node) tryUnlock(node);
  });

  overlay.addEventListener('mouseleave', () => {
    isDragging = false;
    hoveredNode = null;
  });

  // Reset view when opened fresh
  viewZoom = 1;
  viewPan  = { x: 0, y: 0 };
}

// ── Radial tree drawing ───────────────────────────────────────────────────────
const SECTIONS = {
  red:    { angle: -Math.PI / 2, label: 'Combat',      color: '#e53935', glow: '#e53935' },
  green:  { angle: 0,            label: 'Nature',      color: '#43a047', glow: '#43a047' },
  blue:   { angle: Math.PI / 2,  label: 'Crafting',    color: '#1e88e5', glow: '#1e88e5' },
  yellow: { angle: Math.PI,      label: 'Exploration', color: '#f9a825', glow: '#f9a825' },
};
const RING_R   = [0, 60, 110, 160];
const RING_SPREAD = [0, 0.36, 0.28, 0];

function nodePos(node, cx, cy) {
  const sec = SECTIONS[node.section];
  const spread = node.ring === 3 ? 0 : (node.slot === 0 ? -RING_SPREAD[node.ring] : RING_SPREAD[node.ring]);
  const angle = sec.angle + spread;
  const r = RING_R[node.ring];
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

// mx, my are already in tree-space (inverse-transformed)
function nodeAt(tx, ty) {
  if (!starCanvas) return null;
  const cx = starCanvas.width / 2, cy = starCanvas.height / 2;
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    const r = (node.ring === 3 ? 5.5 : node.ring === 2 ? 4 : 3) * 1.25;
    if (Math.hypot(tx - pos.x, ty - pos.y) <= r) return node;
  }
  return null;
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

  // ── Apply pan/zoom transform (tree content only) ──────────────────────────
  ctx.save();
  ctx.translate(cx + viewPan.x, cy + viewPan.y);
  ctx.scale(viewZoom, viewZoom);
  ctx.translate(-cx, -cy);

  const hovNode = hoveredNode ? RESEARCH.find(r => r.id === hoveredNode) : null;

  // ── Connection lines ──────────────────────────────────────────────────────
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

  // ── Center hub ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = '#6a9adf';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#a8c4ff';
  ctx.fill();
  ctx.restore();

  // ── Section labels (between hub and ring 1) ───────────────────────────────
  for (const [, sec] of Object.entries(SECTIONS)) {
    const lr = RING_R[1] * 0.5;
    ctx.fillStyle = sec.color;
    ctx.globalAlpha = 0.6;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sec.label.toUpperCase(), cx + Math.cos(sec.angle) * lr, cy + Math.sin(sec.angle) * lr);
    ctx.globalAlpha = 1;
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────
  for (const node of RESEARCH) {
    const pos = nodePos(node, cx, cy);
    const sec = SECTIONS[node.section];
    const unlocked = researchUnlocked.has(node.id);
    const needsMet = !node.needs || researchUnlocked.has(node.needs);
    const hovered = hoveredNode === node.id;
    const baseR = node.ring === 3 ? 5.5 : node.ring === 2 ? 4 : 3;
    const twinkle = unlocked ? (0.82 + 0.18 * Math.sin(t * 2.1 + node.ring * 1.3)) : 1;
    const r = baseR * twinkle;

    ctx.save();
    if (hovered) {
      ctx.shadowColor = sec.color;
      ctx.shadowBlur = 28;
    }
    if (unlocked) {
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = sec.color;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = twinkle * 0.3;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = twinkle * 0.1;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 11, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (needsMet && researchPoints >= node.cost) {
      ctx.globalAlpha = hovered ? 0.95 : 0.45;
      ctx.fillStyle = sec.color;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = hovered ? 0.28 : 0.1;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = hovered ? 0.5 : 0.25;
      ctx.fillStyle = '#8898cc';
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  ctx.restore(); // end pan/zoom transform

  // ── Tooltip (screen-space, not transformed) ───────────────────────────────
  if (hovNode) {
    const sec = SECTIONS[hovNode.section];
    const unlocked = researchUnlocked.has(hovNode.id);
    const needsMet = !hovNode.needs || researchUnlocked.has(hovNode.needs);

    // Project node position into screen space for tooltip anchor
    const nodeTreePos = nodePos(hovNode, cx, cy);
    const nsx = (nodeTreePos.x - cx) * viewZoom + cx + viewPan.x;
    const nsy = (nodeTreePos.y - cy) * viewZoom + cy + viewPan.y;

    const tw = 200, th = needsMet || unlocked ? 76 : 90;
    let tx = nsx + 20, ty = nsy - th / 2;
    if (tx + tw > W - 10) tx = nsx - tw - 20;
    if (ty < 10) ty = 10;
    if (ty + th > H - 10) ty = H - th - 10;

    // Background
    ctx.save();
    ctx.shadowColor = sec.color;
    ctx.shadowBlur = 16;
    roundRectPath(ctx, tx, ty, tw, th, 8);
    ctx.fillStyle = 'rgba(2,5,18,.97)';
    ctx.fill();
    ctx.strokeStyle = sec.color + '55';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Icon + name row
    ctx.font = '16px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hovNode.icon || '', tx + 10, ty + 16);

    ctx.fillStyle = sec.color;
    ctx.font = 'bold 11px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(hovNode.name, tx + 32, ty + 16);

    // Section label badge
    ctx.fillStyle = sec.color + '33';
    roundRectPath(ctx, tx + tw - 58, ty + 6, 52, 18, 4);
    ctx.fill();
    ctx.fillStyle = sec.color + 'cc';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sec.label.toUpperCase(), tx + tw - 32, ty + 15);

    // Description
    ctx.fillStyle = '#8898cc';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(hovNode.desc, tx + 10, ty + 32);

    // Cost / status
    if (unlocked) {
      ctx.fillStyle = '#43a047';
      ctx.fillText('✓ Unlocked', tx + 10, ty + 48);
    } else {
      ctx.fillStyle = needsMet ? (researchPoints >= hovNode.cost ? '#f9a825' : '#e57373') : '#556';
      ctx.fillText(`Cost: ${hovNode.cost} RP  (have: ${researchPoints})`, tx + 10, ty + 48);
      if (!needsMet) {
        const parent = RESEARCH.find(r => r.id === hovNode.needs);
        ctx.fillStyle = '#445';
        ctx.fillText(`Requires: ${parent ? parent.name : hovNode.needs}`, tx + 10, ty + 63);
      }
    }
  }

  // ── RP + hint (screen-space) ──────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  roundRectPath(ctx, cx - 120, 16, 240, 30, 6);
  ctx.fill();
  ctx.fillStyle = '#f0c040';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`✦ ${researchPoints} Research Points`, cx, 28);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.font = '9px monospace';
  ctx.fillText('scroll to zoom · drag to pan · click star to research · R or Esc to close', cx, 54);
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
