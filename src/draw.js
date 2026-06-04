import { TS, ISLAND_GRID, BC, SWING_DUR, SWING_REST, SWING_IMPACT, RECIPES } from './constants.js';
import { ctx, cam, zoom, W, H, player, landTiles, bridges, structures, islandGrid, workbenchOpen, lastMX, lastMY, activeMode, craftTimers, perspectiveMode } from './state.js';
import { roundRect, screenToWorld } from './utils.js';
import { adjOwned } from './world.js';
import { getNearbyWorkbench } from './workbench.js';
import { drawDrops } from './drops.js';
import { registerChunkMaps, invalidateChunk, invalidateAllChunks } from './chunkCache.js';

// --- Chunk cache ---
const CHUNK_TILES = 8;
const CHUNK_PX = CHUNK_TILES * TS; // 384px

const chunkCache = new Map();
const dirtyChunks = new Set();

// Register the maps so chunkCache.js helpers can mutate them
registerChunkMaps(chunkCache, dirtyChunks);

export { invalidateChunk, invalidateAllChunks };

// Depth of the south-face wall strip in world pixels (AC perspective only)
const AC_FACE_H = 14;
// Vertical squish factor for AC perspective
const AC_SCALE_Y = 0.62;

function renderChunk(cxIdx, cyIdx) {
  const key = `${cxIdx},${cyIdx}`;
  let osc = chunkCache.get(key);
  if (!osc) {
    osc = new OffscreenCanvas(CHUNK_PX, CHUNK_PX + AC_FACE_H);
    chunkCache.set(key, osc);
  }
  const octx = osc.getContext('2d');
  octx.clearRect(0, 0, osc.width, osc.height);

  // The chunk's world-pixel origin
  const originWX = cxIdx * CHUNK_TILES;
  const originWY = cyIdx * CHUNK_TILES;

  // Draw tiles in this chunk
  for (let dy = 0; dy < CHUNK_TILES; dy++) {
    for (let dx = 0; dx < CHUNK_TILES; dx++) {
      const wx = originWX + dx, wy = originWY + dy;
      const t = landTiles[`${wx},${wy}`];
      if (!t) continue;
      const px = dx * TS, py = dy * TS;
      const bc = BC[t.biome] || BC.plains;
      octx.fillStyle = t.alt ? bc.alt : bc.base;
      octx.fillRect(px, py, TS, TS);
      octx.strokeStyle = 'rgba(0,0,0,.12)'; octx.lineWidth = 0.5;
      octx.strokeRect(px, py, TS, TS);
      if (perspectiveMode) {
        octx.fillStyle = t.alt ? (bc.alt_dark || bc.alt) : (bc.base_dark || bc.base);
        octx.globalAlpha = 0.55;
        octx.fillRect(px, py + TS, TS, AC_FACE_H);
        octx.globalAlpha = 1;
        octx.strokeStyle = 'rgba(0,0,0,.25)'; octx.lineWidth = 0.5;
        octx.strokeRect(px, py + TS, TS, AC_FACE_H);
      }
      // Draw static resources (skip tiles with active hitT — those are overlaid on main canvas)
      if (t.res && !t.hitT) {
        drawRes(octx, t.res, px + TS / 2, py + TS / 2, t.resHp, t.resMax || 1, t.biome);
      }
    }
  }

  // Draw bridges in this chunk
  for (const bk of bridges) {
    const [bwx, bwy] = bk.split(',').map(Number);
    const dx = bwx - originWX, dy = bwy - originWY;
    if (dx < 0 || dx >= CHUNK_TILES || dy < 0 || dy >= CHUNK_TILES) continue;
    const px = dx * TS, py = dy * TS;
    octx.fillStyle = '#8d6e3a'; octx.fillRect(px, py, TS, TS);
    octx.strokeStyle = '#5d4037'; octx.lineWidth = 1; octx.strokeRect(px + 4, py + 4, TS - 8, TS - 8);
    octx.fillStyle = '#a1887f'; octx.fillRect(px + 4, py + TS / 2 - 3, TS - 8, 6);
    if (perspectiveMode) {
      octx.fillStyle = '#5d4037';
      octx.globalAlpha = 0.6;
      octx.fillRect(px, py + TS, TS, AC_FACE_H);
      octx.globalAlpha = 1;
    }
  }

  dirtyChunks.delete(key);
}

export function drawRes(ctx, res, cx, cy, hp, maxHp, biome) {
  const s = TS * 0.32, bc = BC[biome] || BC.plains;
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 1.5;
  if (res === 'tree' || res === 'reed') {
    ctx.fillStyle = res === 'reed' ? (bc.res_reed || '#6b8c5a') : bc.res_tree;
    ctx.beginPath(); ctx.moveTo(0, -s * 1.2); ctx.lineTo(s * .8, s * .6); ctx.lineTo(-s * .8, s * .6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = bc.res_stump || '#5d4037'; ctx.beginPath(); ctx.rect(-3, s * .5, 6, s * .5); ctx.fill(); ctx.stroke();
  } else if (res === 'rock' || res === 'sand_rock' || res === 'mud_rock') {
    ctx.fillStyle = res === 'sand_rock' ? (bc.res_sand_rock || '#8d6e3a') : res === 'mud_rock' ? (bc.res_mud_rock || '#4a3f35') : (bc.res_rock || '#616161');
    ctx.beginPath(); ctx.ellipse(0, 0, s * .9, s * .7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (res === 'bush' || res === 'herb') {
    ctx.fillStyle = res === 'herb' ? (bc.res_herb || '#7b5ea7') : (bc.res_bush || '#33691e');
    ctx.beginPath(); ctx.arc(0, 0, s * .8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = res === 'herb' ? '#c2185b' : '#c62828';
    for (let i = 0; i < 3; i++) { const a = i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * s * .4, Math.sin(a) * s * .4, s * .2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  } else if (res === 'cactus') {
    ctx.fillStyle = bc.res_cactus || '#4a7c3f';
    ctx.beginPath(); ctx.rect(-s * .25, -s * 1.1, s * .5, s * 1.4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(-s * .7, -s * .3, s * .45, s * .25); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(s * .25, -s * .5, s * .45, s * .25); ctx.fill(); ctx.stroke();
  } else if (res === 'wheat' || res === 'dune') {
    ctx.fillStyle = res === 'dune' ? (bc.res_dune || '#d4a843') : (bc.res_wheat || '#f9a825');
    ctx.beginPath(); ctx.ellipse(0, s * .1, s * .85, s * .55, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  if (hp < maxHp && hp > 0) {
    const bw = TS * .6, bh = 4, bx = -bw / 2, by = s * .95;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#76ff03'; ctx.fillRect(bx, by, bw * (hp / maxHp), bh);
  }
  ctx.restore();
}

export function drawStruct(ctx, type, cx, cy) {
  const s = TS * .35;
  ctx.save(); ctx.translate(cx, cy);
  if (type === 'workbench') {
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(-s, -s * .5, s * 2, s * .9);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(-s, -s * .5, s * 2, s * .9);
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-s + 2, s * .4, s * .35, s * .6); ctx.fillRect(s * .65, s * .4, s * .35, s * .6);
    ctx.fillRect(-s + 2, -s * .5 - s * .25, s * .35, s * .3); ctx.fillRect(s * .65, -s * .5 - s * .25, s * .35, s * .3);
    ctx.fillStyle = '#8d6e63'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('WB', 0, -s * .05);
    // Progress ring for active background craft
    const now = Date.now();
    const activeCraft = RECIPES.find(r => craftTimers[r.id] && now < craftTimers[r.id].end);
    if (activeCraft) {
      const ct = craftTimers[activeCraft.id];
      const pct = (ct.duration - (ct.end - now)) / ct.duration;
      const rad = s * 0.72, oy = -s * 1.35;
      ctx.beginPath(); ctx.arc(0, oy, rad, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      ctx.strokeStyle = '#2a3a2a'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, oy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
      ctx.fillStyle = '#eee'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Object.keys(activeCraft.outputs)[0], 0, oy);
    }
  } else {
    const C = { furnace: '#bf360c', forge: '#37474f', market: '#1565c0' };
    ctx.fillStyle = C[type] || '#888'; ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText({ furnace: 'FRN', forge: 'FRG', market: 'MKT' }[type] || '?', 0, 0);
  }
  ctx.restore();
}

export function drawEKey(wx, wy) {
  const bob = Math.sin(Date.now() / 320) * 3;
  const px = (wx * TS + TS / 2 - cam.x) * zoom;
  const py = (wy * TS - 14 - cam.y) * zoom + bob * zoom;
  ctx.save(); ctx.translate(px, py);
  const sc = zoom; ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(ctx, -11, 3, 22, 6, 3); ctx.fill();
  ctx.fillStyle = '#e8e0d0'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
  roundRect(ctx, -11, -11, 22, 20, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f5f0e8'; roundRect(ctx, -9, -9, 18, 14, 3); ctx.fill();
  ctx.fillStyle = '#222'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('E', 0, -2);
  ctx.restore();
}

export function drawPlayer() {
  const now = Date.now();
  const swingAge = now - player.swingT;
  const swinging = swingAge < SWING_DUR;
  // Two-phase: fast strike (0–30%) then slow pull-back (30–100%)
  const t = swingAge / SWING_DUR;
  const IMPACT_AT = 0.30;
  let animT;
  if (t <= IMPACT_AT) {
    const p = t / IMPACT_AT;
    animT = p * p;           // ease-in snap to impact
  } else {
    const p = (t - IMPACT_AT) / (1 - IMPACT_AT);
    animT = 1 - p * p;       // ease-out slow return
  }
  const restAngle   = player.swingDir + SWING_REST;
  const impactAngle = player.swingDir + SWING_IMPACT;
  const idleAngle   = player.dir + SWING_REST;
  const swordAng = swinging
    ? restAngle + (impactAngle - restAngle) * animT
    : idleAngle;
  const px = player.x, py = player.y;
  // Sword floats slightly away from the player body for a cartoon feel
  ctx.save(); ctx.translate(px, py); ctx.rotate(swordAng); ctx.translate(14, 0);
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(1, -1); ctx.lineTo(19, -1); ctx.stroke();
  ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, 0); ctx.stroke();
  ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(-7, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  if (swinging) {
    // Trail peaks at impact then fades during pull-back
    ctx.globalAlpha = (1 - Math.abs(animT - 1) ) * 0.45;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 0); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(px + Math.cos(player.dir) * 7, py + Math.sin(player.dir) * 7, 3, 0, Math.PI * 2); ctx.fill();
}

export function drawActiveModeHint() {
  if (typeof lastMX === 'undefined') return;
  const { wx, wy } = screenToWorld(lastMX, lastMY);
  const px = wx * TS, py = wy * TS;
  ctx.save();
  ctx.strokeStyle = 'rgba(79,195,247,.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
  ctx.strokeRect(px, py, TS, TS); ctx.setLineDash([]);
  ctx.restore();
}

export function drawScene() {
  const now = Date.now();
  ctx.fillStyle = '#0d2344'; ctx.fillRect(0, 0, W, H);
  ctx.save();

  if (perspectiveMode) {
    // Shift the horizon up so the world doesn't drift off-screen when squished
    ctx.translate(0, H * (1 - AC_SCALE_Y) * 0.5);
    ctx.scale(1, AC_SCALE_Y);
  }

  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  // ocean grid
  ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1;
  const s0x = Math.floor(cam.x / TS) - 1, e0x = Math.ceil((cam.x + W / zoom) / TS) + 1;
  const s0y = Math.floor(cam.y / TS) - 1, e0y = Math.ceil((cam.y + H / zoom) / TS) + 1;
  for (let tx = s0x; tx <= e0x; tx++) { ctx.beginPath(); ctx.moveTo(tx * TS, s0y * TS); ctx.lineTo(tx * TS, e0y * TS); ctx.stroke(); }
  for (let ty = s0y; ty <= e0y; ty++) { ctx.beginPath(); ctx.moveTo(s0x * TS, ty * TS); ctx.lineTo(e0x * TS, ty * TS); ctx.stroke(); }

  // Compute visible chunk range
  const chunkX0 = Math.floor(cam.x / CHUNK_PX) - 1;
  const chunkX1 = Math.ceil((cam.x + W / zoom) / CHUNK_PX) + 1;
  const chunkY0 = Math.floor(cam.y / CHUNK_PX) - 1;
  const chunkY1 = Math.ceil((cam.y + H / zoom) / CHUNK_PX) + 1;

  // Blit chunks (tiles + bridges, static resources)
  for (let cy = chunkY0; cy <= chunkY1; cy++) {
    for (let cx = chunkX0; cx <= chunkX1; cx++) {
      const key = `${cx},${cy}`;
      if (dirtyChunks.has(key) || !chunkCache.has(key)) {
        // Only render if there's anything in this chunk
        const chunkOriginWX = cx * CHUNK_TILES;
        const chunkOriginWY = cy * CHUNK_TILES;
        let hasContent = false;
        for (let dy = 0; dy < CHUNK_TILES && !hasContent; dy++) {
          for (let dx = 0; dx < CHUNK_TILES && !hasContent; dx++) {
            if (landTiles[`${chunkOriginWX + dx},${chunkOriginWY + dy}`]) hasContent = true;
          }
        }
        if (!hasContent) {
          // Check bridges
          for (const bk of bridges) {
            const [bwx, bwy] = bk.split(',').map(Number);
            if (Math.floor(bwx / CHUNK_TILES) === cx && Math.floor(bwy / CHUNK_TILES) === cy) {
              hasContent = true; break;
            }
          }
        }
        if (hasContent) renderChunk(cx, cy);
        else { dirtyChunks.delete(key); continue; }
      }
      const osc = chunkCache.get(key);
      if (osc) {
        const chunkWorldX = cx * CHUNK_PX;
        const chunkWorldY = cy * CHUNK_PX;
        ctx.drawImage(osc, chunkWorldX, chunkWorldY);
      }
    }
  }

  // Overlay: tiles with active hitT (shake animation) drawn on main canvas
  for (const t of Object.values(landTiles)) {
    if (!t.res && !t.hitT) continue;
    const px = t.wx * TS, py = t.wy * TS;
    if (px > cam.x + W / zoom + TS || py > cam.y + H / zoom + TS + AC_FACE_H || px + TS < cam.x || py + TS < cam.y) continue;
    if (t.hitT) {
      const age = now - t.hitT;
      if (age < 350) {
        if (t.res) {
          const ox = Math.sin(age * 0.09) * 2.5 * (1 - age / 350);
          drawRes(ctx, t.res, px + TS / 2 + ox, py + TS / 2, t.resHp, t.resMax || 1, t.biome);
        }
      } else {
        t.hitT = null;
        invalidateChunk(t.wx, t.wy);
      }
    }
  }

  // structures
  for (const s of structures) {
    const px = s.wx * TS, py = s.wy * TS;
    if (px > cam.x + W / zoom + TS || py > cam.y + H / zoom + TS || px + TS < cam.x || py + TS < cam.y) continue;
    drawStruct(ctx, s.type, px + TS / 2, py + TS / 2);
  }

  // island cost labels
  for (let iy = 0; iy < ISLAND_GRID; iy++) for (let ix = 0; ix < ISLAND_GRID; ix++) {
    const isl = islandGrid[iy][ix];
    if (isl.owned || !adjOwned(isl)) continue;
    const cx = (isl.wx + isl.shape.w / 2) * TS, cy = (isl.wy + isl.shape.h / 2) * TS;
    if (cx > cam.x + W / zoom + 100 || cy > cam.y + H / zoom + 60 || cx < cam.x - 100 || cy < cam.y - 60) continue;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.7)'; roundRect(ctx, cx - 52, cy - 22, 104, 44, 6); ctx.fill();
    ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1; roundRect(ctx, cx - 52, cy - 22, 104, 44, 6); ctx.stroke();
    ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((isl.biome || 'island').toUpperCase(), cx, cy - 6);
    ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.fillText('🪙 ' + isl.cost + ' to unlock', cx, cy + 10);
    ctx.restore();
  }

  // world-space: drops, player, active mode hint
  drawDrops();
  drawPlayer();
  if (activeMode) drawActiveModeHint();

  ctx.restore();

  // screen-space: E key prompt
  if (!workbenchOpen) {
    const wb = getNearbyWorkbench();
    if (wb) drawEKey(wb.wx, wb.wy);
  }

  // Keep HUD perspective indicator in sync
  const perspBox = document.getElementById('persp-box');
  if (perspBox) {
    perspBox.textContent = perspectiveMode ? '3D' : '2D';
    perspBox.style.color = perspectiveMode ? '#ffd580' : '#aad4ff';
  }
}
