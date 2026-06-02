import { ISLAND_GRID } from './constants.js';
import {
  inv, player, structures, bridges, xp, lvl, zoom, islandGrid, landTiles, craftTimers,
  setStructures, setBridges, setXp, setLvl, setZoom,
} from './state.js';
import { buildTiles } from './world.js';
import { updateUI } from './ui.js';
import { showMsg } from './utils.js';

export function saveGame() {
  const islandData = [];
  for (let iy = 0; iy < ISLAND_GRID; iy++)
    for (let ix = 0; ix < ISLAND_GRID; ix++) {
      const isl = islandGrid[iy][ix];
      islandData.push({ ix, iy, owned: isl.owned, shape: { cells: [...isl.shape.cells], w: isl.shape.w, h: isl.shape.h } });
    }
  const tileStates = {};
  for (const [key, t] of Object.entries(landTiles))
    tileStates[key] = { res: t.res, resHp: t.resHp, resMax: t.resMax, resTimer: t.resTimer, _lastRes: t._lastRes, alt: t.alt };
  const data = {
    v: 1, inv, xp, lvl,
    player: { x: player.x, y: player.y, spd: player.spd, dir: player.dir },
    zoom, structures, bridges: [...bridges], islandData, tileStates,
  };
  localStorage.setItem('rethrival_save', JSON.stringify(data));
}

export function saveGameManual() {
  saveGame();
  showMsg('Game saved');
}

export function loadGame(manual) {
  const raw = localStorage.getItem('rethrival_save');
  if (!raw) { if (manual) showMsg('No save found'); return false; }
  let d;
  try { d = JSON.parse(raw); } catch { if (manual) showMsg('Save corrupted'); return false; }
  Object.keys(inv).forEach(k => inv[k] = 0);
  Object.assign(inv, d.inv);
  setXp(d.xp); setLvl(d.lvl);
  Object.assign(player, d.player);
  setStructures(d.structures || []);
  setBridges(new Set(d.bridges || []));
  // Clear and rebuild land tiles
  for (const k of Object.keys(landTiles)) delete landTiles[k];
  const ts = d.tileStates || {};
  for (const id of d.islandData) {
    const isl = islandGrid[id.iy][id.ix];
    isl.shape = { cells: new Set(id.shape.cells), w: id.shape.w, h: id.shape.h };
    isl.owned = id.owned;
    isl.tiles = [];
    if (id.owned) {
      isl.shape.cells.forEach(k => {
        const [lx, ly] = k.split(',').map(Number);
        const wx = isl.wx + lx, wy = isl.wy + ly, key = `${wx},${wy}`;
        const s = ts[key];
        const t = s
          ? { wx, wy, biome: isl.biome, alt: s.alt, res: s.res, resHp: s.resHp, resMax: s.resMax, resTimer: s.resTimer, _lastRes: s._lastRes }
          : { wx, wy, biome: isl.biome, alt: Math.random() < 0.3, res: null, resHp: 0, resMax: 0, resTimer: 0, _lastRes: null };
        isl.tiles.push(t); landTiles[key] = t;
      });
    }
  }
  setZoom(d.zoom || 1);
  updateUI();
  if (manual) showMsg('Game loaded');
  return true;
}

export function confirmReset() {
  if (confirm('Reset the world? All progress will be lost.')) {
    localStorage.removeItem('rethrival_save');
    Object.keys(inv).forEach(k => inv[k] = 0); inv.gold = 30;
    setXp(0); setLvl(1);
    setStructures([]); setBridges(new Set());
    for (const k of Object.keys(landTiles)) delete landTiles[k];
    for (const k of Object.keys(craftTimers)) delete craftTimers[k];
    for (let iy = 0; iy < ISLAND_GRID; iy++)
      for (let ix = 0; ix < ISLAND_GRID; ix++)
        islandGrid[iy][ix].owned = false;
    // Re-init is called from main - signal via callback
    confirmReset._resetPending = true;
    updateUI();
    showMsg('World reset');
  }
}
confirmReset._resetPending = false;
