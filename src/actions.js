import { TS, BUILDABLES, RES_LOOT, RES_XP } from './constants.js';
import { player, inv, landTiles, bridges, structures, drops, nextDropId, activeMode, setActiveMode } from './state.js';
import { showMsg, costStr, canAfford, spendCost } from './utils.js';
import { gainXP, updateUI } from './ui.js';
import { saveGame } from './save.js';
import { buildTiles } from './world.js';
import { rnd } from './utils.js';

export function gatherTile(twx, twy) {
  const t = landTiles[`${twx},${twy}`];
  if (!t || !t.res) return;
  if (Math.hypot(player.x - (twx * TS + TS / 2), player.y - (twy * TS + TS / 2)) > player.mineRange) {
    showMsg('Too far away'); return;
  }
  t.resHp--;
  player.dir = Math.atan2(twy * TS + TS / 2 - player.y, twx * TS + TS / 2 - player.x);
  player.swingT = Date.now(); player.swingDir = player.dir;
  if (t.resHp <= 0) {
    const loot = (RES_LOOT[t.res] || (() => ({})))();
    const cx = twx * TS + TS / 2, cy = twy * TS + TS / 2;
    gainXP(RES_XP[t.res] || 5);
    Object.entries(loot).forEach(([item, qty]) => {
      const angle = Math.random() * Math.PI * 2;
      const spd = rnd(20, 55);
      drops.push({ id: nextDropId(), x: cx, y: cy, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, item, qty, born: Date.now(), collected: false });
    });
    t.resTimer = Date.now(); t._lastRes = t.res; t.res = null;
    updateUI(); saveGame();
  }
}

export function tryBridge(twx, twy) {
  const key = `${twx},${twy}`;
  if (landTiles[key] || bridges.has(key)) { showMsg('Already land here'); return; }
  const adj = [[0,1],[0,-1],[1,0],[-1,0]];
  if (!adj.some(([dx, dy]) => { const k = `${twx+dx},${twy+dy}`; return landTiles[k] || bridges.has(k); })) {
    showMsg('Must connect to land'); return;
  }
  const b = BUILDABLES.find(x => x.id === 'bridge');
  if (!canAfford(b.cost)) { showMsg(`Need: ${costStr(b.cost)}`); setActiveMode(null); updateUI(); return; }
  spendCost(b.cost); bridges.add(key);
  showMsg('Bridge placed'); updateUI(); saveGame();
}

export function tryPlaceStructure(type, twx, twy) {
  const key = `${twx},${twy}`;
  if (!landTiles[key]) { showMsg('Must place on land'); return; }
  if (structures.some(s => s.wx === twx && s.wy === twy)) { showMsg('Tile already occupied'); return; }
  const b = BUILDABLES.find(x => x.id === type);
  if (!b) return;
  if (!canAfford(b.cost)) { showMsg(`Need: ${costStr(b.cost)}`); setActiveMode(null); updateUI(); return; }
  spendCost(b.cost);
  structures.push({ type, wx: twx, wy: twy });
  gainXP(30); showMsg(`${b.name} built!`);
  setActiveMode(null); updateUI(); saveGame();
}

export function tryBuyIsland(isl) {
  if (inv.gold < isl.cost) { showMsg(`Need ${isl.cost} gold`); return; }
  inv.gold -= isl.cost; isl.owned = true; buildTiles(isl);
  gainXP(50); showMsg(`${isl.biome || 'Island'} unlocked!`);
  updateUI(); saveGame();
}
