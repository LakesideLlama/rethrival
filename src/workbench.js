import { TS, RECIPES } from './constants.js';
import { player, structures, workbenchOpen, activeWorkbench, craftTimers, inv, setWorkbenchOpen, setActiveWorkbench } from './state.js';
import { showMsg } from './utils.js';
import { closeBuildMenu, updateUI, gainXP } from './ui.js';
import { saveGame } from './save.js';
import { ctx, W, H, cam, zoom } from './state.js';

export function getNearbyWorkbench() {
  return structures.find(s =>
    s.type === 'workbench' &&
    Math.hypot(player.x - (s.wx * TS + TS / 2), player.y - (s.wy * TS + TS / 2)) < TS * 1.5
  );
}

export function openWorkbench(struct) {
  setWorkbenchOpen(true); setActiveWorkbench(struct);
  closeBuildMenu();
  const ui = document.getElementById('workbench-ui');
  const panel = document.getElementById('workbench-panel');
  const overlay = document.getElementById('workbench-overlay');
  const sx = (struct.wx * TS + TS / 2 - cam.x) * zoom;
  const sy = (struct.wy * TS + TS / 2 - cam.y) * zoom;
  const pw = Math.min(500, window.innerWidth * 0.9);
  const ph = Math.min(window.innerHeight * 0.8, 500);
  const originX = sx - (W / 2 - pw / 2);
  const originY = sy - (H / 2 - ph / 2);
  panel.style.transformOrigin = `${originX}px ${originY}px`;
  panel.classList.remove('open');
  overlay.classList.remove('open');
  ui.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    panel.classList.add('open'); overlay.classList.add('open');
  }));
  renderWorkbenchRecipes();
}

export function closeWorkbench() {
  setWorkbenchOpen(false); setActiveWorkbench(null);
  const panel = document.getElementById('workbench-panel');
  const overlay = document.getElementById('workbench-overlay');
  panel.classList.remove('open'); overlay.classList.remove('open');
  setTimeout(() => { document.getElementById('workbench-ui').style.display = 'none'; }, 300);
}

export function renderWorkbenchRecipes() {
  const now = Date.now();
  document.getElementById('wb-recipes').innerHTML = RECIPES.map(r => {
    const ct = craftTimers[r.id];
    const isCrafting = ct && now < ct.end;
    const canCraft = !isCrafting && Object.entries(r.inputs).every(([k, v]) => (inv[k] || 0) >= v);
    const inputsHtml = Object.entries(r.inputs).map(([k, v]) => {
      const have = inv[k] || 0; const ok = have >= v;
      return `<span style="color:${ok ? '#81c784' : '#e57373'}">${v} ${k}<span style="opacity:.6"> (${have})</span></span>`;
    }).join('<span class="wb-arrow">+</span>');
    const outputsHtml = Object.entries(r.outputs).map(([k, v]) => `<span class="wb-out">${v} ${k}</span>`).join(', ');
    const timerPct = isCrafting ? Math.round((1 - (ct.end - now) / ct.duration) * 100) : 0;
    const timerBar = isCrafting ? `<div class="wb-timer-bar" style="width:${timerPct}%"></div>` : '';
    const label = isCrafting
      ? `<span style="color:#4fc3f7;font-size:10px;margin-left:auto">crafting…</span>`
      : `<span style="color:#888;margin-left:auto">+${r.xp}xp · ${(r.dur / 1000).toFixed(0)}s</span>`;
    return `<div class="wb-recipe${canCraft ? '' : ' wb-disabled'}${isCrafting ? ' crafting' : ''}" id="wbr-${r.id}" onclick="craftItem('${r.id}')">
      <div class="wb-rname">${r.name}</div>
      <div class="wb-costs">${inputsHtml}<span class="wb-arrow">→</span>${outputsHtml}${label}</div>
      ${timerBar}
    </div>`;
  }).join('');
}

let _wbTickId = null;
export function startWbTick() {
  if (_wbTickId) return;
  _wbTickId = setInterval(() => {
    if (!workbenchOpen) { clearInterval(_wbTickId); _wbTickId = null; return; }
    const now = Date.now();
    let anyActive = false;
    for (const r of RECIPES) {
      const ct = craftTimers[r.id];
      if (ct && now < ct.end) {
        anyActive = true;
        const el = document.getElementById(`wbr-${r.id}`);
        if (el) {
          const bar = el.querySelector('.wb-timer-bar');
          if (bar) bar.style.width = Math.round((1 - (ct.end - now) / ct.duration) * 100) + '%';
        }
      } else if (ct && now >= ct.end) {
        const recipe = RECIPES.find(x => x.id === r.id);
        Object.entries(recipe.outputs).forEach(([k, v]) => inv[k] = (inv[k] || 0) + v);
        gainXP(recipe.xp);
        showMsg('+' + Object.entries(recipe.outputs).map(([k, v]) => `${v} ${k}`).join(', '));
        delete craftTimers[r.id];
        updateUI(); saveGame();
        renderWorkbenchRecipes();
      }
    }
    if (!anyActive) { clearInterval(_wbTickId); _wbTickId = null; }
  }, 80);
}

export function craftItem(id) {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return;
  if (craftTimers[id] && Date.now() < craftTimers[id].end) return;
  if (!Object.entries(r.inputs).every(([k, v]) => (inv[k] || 0) >= v)) { showMsg('Not enough materials'); return; }
  Object.entries(r.inputs).forEach(([k, v]) => inv[k] -= v);
  craftTimers[id] = { end: Date.now() + r.dur, duration: r.dur };
  updateUI(); saveGame();
  renderWorkbenchRecipes();
  startWbTick();
}
window.craftItem = craftItem;
