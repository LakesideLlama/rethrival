import { TS, SWING_ARC, BUILDABLES, RES_LOOT, RES_XP } from './constants.js';
import { player, inv, landTiles, bridges, structures, drops, nextDropId, activeMode, setActiveMode, setCamShake } from './state.js';
import { showMsg, costStr, canAfford, spendCost, rnd } from './utils.js';
import { gainXP, updateUI } from './ui.js';
import { saveGame } from './save.js';
import { buildTiles } from './world.js';

// Sword blade occupies world pixels 8–28 from player center (ctx.translate(8,0) + lineTo(20,0))
const BLADE_MIN = 8, BLADE_MAX = 28;
// Collision radii matched to each resource's drawn sprite (s = TS*0.32 ≈ 15.4px)
const RES_COL_R = {
  tree: 12, reed: 10,
  rock: 14, sand_rock: 14, mud_rock: 14,
  bush: 12, herb: 12,
  wheat: 13, dune: 13,
  cactus: 9,
};

export function swingAttack() {
  player.swingSide = -player.swingSide; // alternate left↔right each swing
  const swingDir = player.dir;
  player.swingT = Date.now();
  player.swingDir = swingDir;

  let anyDied = false;
  for (const t of Object.values(landTiles)) {
    if (!t.res) continue;
    const tx = t.wx * TS + TS / 2, ty = t.wy * TS + TS / 2;
    const d = Math.hypot(tx - player.x, ty - player.y);
    const r = RES_COL_R[t.res] || 12;
    // Radial: blade must overlap the sprite circle
    if (d > BLADE_MAX + r || d < Math.max(0, BLADE_MIN - r)) continue;
    // Angular: sprite's half-width at distance d widens the valid arc
    let diff = Math.atan2(ty - player.y, tx - player.x) - swingDir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > SWING_ARC / 2 + Math.atan2(r, Math.max(d, 1))) continue;

    t.resHp--;
    setCamShake(3.5);
    if (t.resHp <= 0) {
      const loot = (RES_LOOT[t.res] || (() => ({})))();
      gainXP(RES_XP[t.res] || 5);
      Object.entries(loot).forEach(([item, qty]) => {
        const angle = Math.random() * Math.PI * 2;
        const spd = rnd(20, 55);
        drops.push({ id: nextDropId(), x: tx, y: ty, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, item, qty, born: Date.now(), collected: false });
      });
      t.resTimer = Date.now(); t._lastRes = t.res; t.res = null;
      anyDied = true;
    }
  }
  if (anyDied) { updateUI(); saveGame(); }
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
