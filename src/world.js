import { TS, ISLAND_GRID, CELL, BIOMES, BIOME_RES, RES_HP, RESPAWN } from './constants.js';
import { islandGrid, landTiles, player, structures, inv } from './state.js';
import { rnd } from './utils.js';

export function getBiome(ix, iy) {
  for (const [n, b] of Object.entries(BIOMES)) {
    if (b.cols.includes(ix) && b.rows.includes(iy)) return n;
  }
  return null;
}

export function genShape() {
  const cells = new Set();
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) cells.add(`${x},${y}`);
  const ext = rnd(4, 14);
  for (let i = 0; i < ext; i++) {
    const arr = [...cells];
    const [sx, sy] = arr[Math.floor(Math.random() * arr.length)].split(',').map(Number);
    const [dx, dy] = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]][Math.floor(Math.random() * 8)];
    cells.add(`${sx+dx},${sy+dy}`);
  }
  if (Math.random() < 0.05) for (let y = 1; y < 4; y++) cells.delete(`2,${y}`);
  const xs = [...cells].map(k => +k.split(',')[0]);
  const ys = [...cells].map(k => +k.split(',')[1]);
  const mx = Math.min(...xs), my = Math.min(...ys);
  const norm = new Set([...cells].map(k => { const [x,y] = k.split(',').map(Number); return `${x-mx},${y-my}`; }));
  const w = Math.max(...[...norm].map(k => +k.split(',')[0])) + 1;
  const h = Math.max(...[...norm].map(k => +k.split(',')[1])) + 1;
  return { cells: norm, w, h };
}

export function buildTiles(isl) {
  isl.tiles = [];
  const rt = BIOME_RES[isl.biome] || BIOME_RES.plains;
  isl.shape.cells.forEach(k => {
    const [lx, ly] = k.split(',').map(Number);
    const wx = isl.wx + lx, wy = isl.wy + ly, key = `${wx},${wy}`;
    let res = null, resHp = 0;
    if (Math.random() < 0.28) { res = rt[Math.floor(Math.random() * rt.length)]; resHp = RES_HP[res]; }
    const t = { wx, wy, biome: isl.biome, alt: Math.random() < 0.3, res, resHp, resMax: resHp, resTimer: 0, _lastRes: res };
    isl.tiles.push(t); landTiles[key] = t;
  });
}

export function adjOwned(isl) {
  return [[0,1],[0,-1],[1,0],[-1,0]].some(([dx, dy]) => {
    const ni = islandGrid[isl.iy + dy]?.[isl.ix + dx];
    return ni && ni.owned;
  });
}

export function initWorld() {
  for (let iy = 0; iy < ISLAND_GRID; iy++) {
    islandGrid[iy] = [];
    for (let ix = 0; ix < ISLAND_GRID; ix++) {
      const biome = getBiome(ix, iy);
      const shape = genShape();
      const wx = ix * CELL, wy = iy * CELL;
      const owned = ix === 4 && iy === 4;
      const dist = Math.max(Math.abs(ix - 4), Math.abs(iy - 4));
      const cost = Math.floor(20 * Math.pow(1.8, dist));
      const isl = { ix, iy, biome, shape, owned, cost, wx, wy, tiles: [] };
      islandGrid[iy][ix] = isl;
      if (owned) buildTiles(isl);
    }
  }
  const ci = islandGrid[4][4];
  player.x = (ci.wx + Math.floor(ci.shape.w / 2)) * TS + TS / 2;
  player.y = (ci.wy + Math.floor(ci.shape.h / 2)) * TS + TS / 2;
}

export function respawnCheck() {
  const now = Date.now();
  for (const t of Object.values(landTiles)) {
    if (!t.res && t.resTimer > 0 && now - t.resTimer > (RESPAWN[t._lastRes] || 20000)) {
      const rt = BIOME_RES[t.biome] || BIOME_RES.plains;
      t.res = rt[Math.floor(Math.random() * rt.length)];
      t.resHp = RES_HP[t.res]; t.resMax = t.resHp; t.resTimer = 0;
    }
  }
}

export function autoStep(dt, updateUI) {
  // autoTimer is managed in main.js to avoid circular state imports
  let ch = false;
  for (const s of structures) {
    if (s.type === 'furnace' && inv.ore > 0) { inv.ore--; inv.iron = (inv.iron || 0) + 1; ch = true; }
    if (s.type === 'market') { inv.gold = (inv.gold || 0) + 2; ch = true; }
  }
  if (ch) updateUI();
}
