import './style.css';
import './input.js';
import { ATTACK_INTERVAL } from './constants.js';
import { ctx, W, H, zoom, showFPS, fps, fpsTimer, fpsCount, lastT, setLastT, setFps, setFpsTimer, setFpsCount, player, workbenchOpen, mouseHeld, lastMX, lastMY } from './state.js';
import { initWorld, respawnCheck, autoStep } from './world.js';
import { loadGame, confirmReset } from './save.js';
import { updateUI } from './ui.js';
import { updateDrops } from './drops.js';
import { drawScene } from './draw.js';
import { updatePlayerMovement } from './input.js';
import { gatherTile } from './actions.js';
import { screenToWorld } from './utils.js';

document.getElementById('s-speed')?.addEventListener('change', function () {
  player.spd = +this.value;
});

let _autoTimer = 0;
let _attackTimer = ATTACK_INTERVAL; // start ready so first hit fires immediately

function gameLoop(ts) {
  const dt = Math.min(ts - lastT, 100);
  setLastT(ts);

  updatePlayerMovement(dt);
  respawnCheck();

  _autoTimer += dt;
  if (_autoTimer >= 10000) {
    _autoTimer = 0;
    autoStep(dt, updateUI);
  }

  // Hold-to-attack: fire at ATTACK_INTERVAL rate while mouse is held over a resource tile
  if (mouseHeld && !workbenchOpen && lastMX !== undefined) {
    _attackTimer += dt;
    if (_attackTimer >= ATTACK_INTERVAL) {
      _attackTimer = 0;
      const { wx, wy } = screenToWorld(lastMX, lastMY);
      gatherTile(wx, wy);
    }
  } else {
    // Reset timer so next press fires immediately
    _attackTimer = ATTACK_INTERVAL;
  }

  updateDrops(dt);
  drawScene();

  // FPS counter (screen-space, after drawScene)
  let fc = fpsCount + 1, ft = fpsTimer + dt, fv = fps;
  if (ft >= 1000) { fv = fc; fc = 0; ft = 0; }
  setFpsCount(fc); setFpsTimer(ft); setFps(fv);
  if (showFPS) {
    ctx.fillStyle = '#0d2344'; ctx.fillRect(W - 54, H - 22, 50, 18);
    ctx.fillStyle = '#76ff03'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText(fps + ' fps', W - 6, H - 8);
  }

  if (confirmReset._resetPending) {
    confirmReset._resetPending = false;
    initWorld();
    updateUI();
  }

  requestAnimationFrame(gameLoop);
}

initWorld();
if (!loadGame(false)) updateUI();
requestAnimationFrame(ts => { setLastT(ts); requestAnimationFrame(gameLoop); });
