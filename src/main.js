import './style.css';
import './input.js';
import { ctx, W, H, zoom, showFPS, fps, fpsTimer, fpsCount, lastT, setLastT, setFps, setFpsTimer, setFpsCount, player, workbenchOpen } from './state.js';
import { initWorld, respawnCheck, autoStep } from './world.js';
import { loadGame, confirmReset } from './save.js';
import { updateUI } from './ui.js';
import { updateDrops } from './drops.js';
import { drawScene } from './draw.js';
import { updatePlayerMovement } from './input.js';

document.getElementById('s-speed')?.addEventListener('change', function () {
  player.spd = +this.value;
});

let _autoTimer = 0;

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

  // Reset pending from confirmReset
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
