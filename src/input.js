import { ZOOM_STEP, CELL, ISLAND_GRID } from './constants.js';
import {
  canvas, keys, player, landTiles, bridges, cam, zoom, W, H,
  workbenchOpen, activeMode, buildMenuOpen, islandGrid,
  setLastMouse, setActiveMode,
} from './state.js';
import { screenToWorld } from './utils.js';
import { setZoom, toggleBuildMenu, closeBuildMenu, toggleSettings, toggleFPS, updateUI } from './ui.js';
import { openWorkbench, closeWorkbench, getNearbyWorkbench } from './workbench.js';
import { gatherTile, tryBridge, tryPlaceStructure, tryBuyIsland } from './actions.js';
import { adjOwned } from './world.js';
import { saveGameManual, loadGame, confirmReset } from './save.js';

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape') {
    if (workbenchOpen) { closeWorkbench(); return; }
    setActiveMode(null);
    closeBuildMenu();
    document.getElementById('settings-panel').style.display = 'none';
    updateUI();
    return;
  }
  if (e.key.toLowerCase() === 'e' && !workbenchOpen) {
    const wb = getNearbyWorkbench();
    if (wb) openWorkbench(wb);
  }
  if (e.key.toLowerCase() === 'b' && !workbenchOpen) toggleBuildMenu();
  if (e.key === '-' || e.key === '_') setZoom(zoom - ZOOM_STEP);
  if (e.key === '=' || e.key === '+') setZoom(zoom + ZOOM_STEP);
});

window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  setZoom(zoom - Math.sign(e.deltaY) * ZOOM_STEP);
}, { passive: false });

canvas.addEventListener('click', e => {
  const { wx: twx, wy: twy } = screenToWorld(e.clientX, e.clientY);
  const key = `${twx},${twy}`;
  if (activeMode === 'bridge') { tryBridge(twx, twy); return; }
  if (activeMode && activeMode.startsWith('place:')) {
    tryPlaceStructure(activeMode.split(':')[1], twx, twy); return;
  }
  if (landTiles[key]) { gatherTile(twx, twy); return; }
  for (let iy = 0; iy < ISLAND_GRID; iy++) for (let ix = 0; ix < ISLAND_GRID; ix++) {
    const isl = islandGrid[iy][ix];
    if (!isl || isl.owned || !adjOwned(isl)) continue;
    if (twx >= isl.wx && twx < isl.wx + CELL && twy >= isl.wy && twy < isl.wy + CELL) {
      tryBuyIsland(isl); return;
    }
  }
});

canvas.addEventListener('mousedown', () => {
  if (buildMenuOpen && !activeMode) closeBuildMenu();
});

canvas.addEventListener('mousemove', e => setLastMouse(e.clientX, e.clientY));

// Expose globals needed by inline HTML onclick handlers
window.toggleBuildMenu = toggleBuildMenu;
window.toggleSettings = toggleSettings;
window.toggleFPS = toggleFPS;
window.saveGameManual = saveGameManual;
window.loadGame = loadGame;
window.confirmReset = confirmReset;
window.closeWorkbench = closeWorkbench;

export function updatePlayerMovement(dt) {
  if (workbenchOpen) return;
  const spd = player.spd * (dt / 1000);
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy = -1;
  if (keys['s'] || keys['arrowdown']) dy = 1;
  if (keys['a'] || keys['arrowleft']) dx = -1;
  if (keys['d'] || keys['arrowright']) dx = 1;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  if (dx || dy) player.dir = Math.atan2(dy, dx);
  const nx = player.x + dx * spd, ny = player.y + dy * spd;
  const TS = 48;
  const tkx = Math.floor(nx / TS), tky = Math.floor(ny / TS);
  const tky2 = Math.floor(player.y / TS), tkx2 = Math.floor(player.x / TS);
  if (landTiles[`${tkx},${tky2}`] || bridges.has(`${tkx},${tky2}`)) player.x = Math.max(8, nx);
  if (landTiles[`${tkx2},${tky}`] || bridges.has(`${tkx2},${tky}`)) player.y = Math.max(8, ny);
  cam.x = player.x - W / (2 * zoom);
  cam.y = player.y - H / (2 * zoom);
}
