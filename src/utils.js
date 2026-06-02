import { TS } from './constants.js';
import { zoom, cam, inv, msgTimer, setMsgTimer } from './state.js';

export function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

export function showMsg(t) {
  const el = document.getElementById('msg');
  el.textContent = t;
  el.style.opacity = 1;
  clearTimeout(msgTimer);
  setMsgTimer(setTimeout(() => el.style.opacity = 0, 2200));
}

export function screenToWorld(sx, sy) {
  return { wx: Math.floor((sx / zoom + cam.x) / TS), wy: Math.floor((sy / zoom + cam.y) / TS) };
}

export function costStr(cost) {
  return Object.entries(cost).map(([k, v]) => `${v} ${k}`).join(', ');
}

export function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => (inv[k] || 0) >= v);
}

export function spendCost(cost) {
  Object.entries(cost).forEach(([k, v]) => inv[k] -= v);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
