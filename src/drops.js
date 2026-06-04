import { TS, DROP_PICKUP_RANGE, DROP_ATTRACT_RANGE, DROP_EXPIRE, ITEM_COLORS } from './constants.js';
import { drops, player, landTiles, bridges, inv, discover } from './state.js';
import { roundRect } from './utils.js';
import { ctx } from './state.js';
import { updateUI } from './ui.js';
import { saveGame } from './save.js';

export function updateDrops(dt) {
  const now = Date.now();
  const friction = Math.pow(0.012, dt / 1000);
  let anyCollected = false;
  for (const d of drops) {
    if (!d.active) continue;
    if (d.collected) { d.active = false; continue; }
    if (now - d.born > DROP_EXPIRE) { d.active = false; continue; }
    const age = (now - d.born) / 1000;
    d.vx *= friction; d.vy *= friction;
    const dist = Math.hypot(player.x - d.x, player.y - d.y);
    if (dist < DROP_ATTRACT_RANGE && age > 0.25) {
      const spd = Math.max(80, (DROP_ATTRACT_RANGE - dist) / DROP_ATTRACT_RANGE * 320);
      const ang = Math.atan2(player.y - d.y, player.x - d.x);
      d.vx += Math.cos(ang) * spd * (dt / 1000) * 6;
      d.vy += Math.sin(ang) * spd * (dt / 1000) * 6;
    }
    const nx = d.x + d.vx * (dt / 1000), ny = d.y + d.vy * (dt / 1000);
    const tkx = Math.floor(nx / TS), tky = Math.floor(ny / TS);
    if (landTiles[`${tkx},${tky}`] || bridges.has(`${tkx},${tky}`)) {
      d.x = nx; d.y = ny;
    } else {
      const onX = landTiles[`${Math.floor(nx / TS)},${Math.floor(d.y / TS)}`] || bridges.has(`${Math.floor(nx / TS)},${Math.floor(d.y / TS)}`);
      const onY = landTiles[`${Math.floor(d.x / TS)},${Math.floor(ny / TS)}`] || bridges.has(`${Math.floor(d.x / TS)},${Math.floor(ny / TS)}`);
      if (onX) { d.x = nx; d.vx *= 0.4; } else { d.vx *= -0.4; }
      if (onY) { d.y = ny; d.vy *= 0.4; } else { d.vy *= -0.4; }
    }
    if (dist < DROP_PICKUP_RANGE && age > 0.15) {
      d.collected = true; d.active = false; inv[d.item] = (inv[d.item] || 0) + d.qty; discover(d.item);
      anyCollected = true;
    }
  }
  if (anyCollected) { updateUI(); saveGame(); }
}

export function drawDrops() {
  const now = Date.now();
  for (const d of drops) {
    if (!d.active) continue;
    const age = (now - d.born) / 1000;
    const life = (now - d.born) / DROP_EXPIRE;
    const alpha = life > 0.88 ? 1 - (life - 0.88) / 0.12 : 1;
    const bob = Math.sin(now / 400 + d.id) * 3;
    const scale = Math.min(1, age * 4);
    ctx.save();
    ctx.globalAlpha = alpha; ctx.translate(d.x, d.y + bob); ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    const col = ITEM_COLORS[d.item] || '#aaa';
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5;
    roundRect(ctx, -14, -10, 28, 20, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; roundRect(ctx, -12, -8, 24, 9, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.qty > 1 ? `${d.qty} ${d.item}` : d.item, 0, 0);
    ctx.restore();
  }
}
