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

function maxCraftQty(r) {
  return Math.floor(Math.min(...Object.entries(r.inputs).map(([k, v]) => Math.floor((inv[k] || 0) / v))));
}

function qtyBtn(id, qty, label) {
  const r = RECIPES.find(x => x.id === id);
  const isCrafting = craftTimers[id] && Date.now() < craftTimers[id].end;
  const canDo = !isCrafting && qty > 0 && Object.entries(r.inputs).every(([k, v]) => (inv[k] || 0) >= v * qty);
  return `<button class="wb-qty${canDo ? ' can-craft' : ''}" ${canDo ? `onclick="craftItem('${id}',${qty})"` : 'disabled'}>${label}</button>`;
}

export function renderWorkbenchRecipes() {
  const now = Date.now();
  document.getElementById('wb-recipes').innerHTML = RECIPES.map(r => {
    const ct = craftTimers[r.id];
    const isCrafting = ct && now < ct.end;
    const maxQty = maxCraftQty(r);
    const inputsHtml = Object.entries(r.inputs).map(([k, v]) => {
      const have = inv[k] || 0; const ok = have >= v;
      return `<span style="color:${ok ? '#81c784' : '#e57373'}">${v} ${k}<span style="opacity:.6"> (${have})</span></span>`;
    }).join('<span class="wb-arrow">+</span>');
    const outputsHtml = Object.entries(r.outputs).map(([k, v]) => `<span class="wb-out">${v} ${k}</span>`).join(', ');
    const timerPct = isCrafting ? Math.round((1 - (ct.end - now) / ct.duration) * 100) : 0;
    const craftQty = ct?.qty || 1;

    const qtyRow = isCrafting
      ? `<div class="wb-crafting-label">crafting ×${craftQty}<span style="color:#aaa;margin-left:auto">${((ct.end - now) / 1000).toFixed(1)}s left</span></div>`
      : `<div class="wb-qty-btns">
          ${qtyBtn(r.id, 1, '×1')}
          ${qtyBtn(r.id, 5, '×5')}
          ${qtyBtn(r.id, 10, '×10')}
          ${maxQty > 0 ? qtyBtn(r.id, maxQty, `Max (${maxQty})`) : '<button class="wb-qty" disabled>Max (0)</button>'}
         </div>`;

    return `<div class="wb-recipe${isCrafting ? ' crafting' : ''}" id="wbr-${r.id}">
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
        <span class="wb-rname">${r.name}</span>
        <span style="color:#556;font-size:10px;margin-left:auto">+${r.xp}xp · ${(r.dur / 1000).toFixed(0)}s/ea</span>
      </div>
      <div class="wb-costs">${inputsHtml}<span class="wb-arrow">→</span>${outputsHtml}</div>
      ${qtyRow}
      ${isCrafting ? `<div class="wb-timer-bar" style="width:${timerPct}%"></div>` : ''}
    </div>`;
  }).join('');
}

let _wbTickId = null;

export function startWbTick() {
  if (_wbTickId) return;
  _wbTickId = setInterval(() => {
    const now = Date.now();
    let anyActive = false;
    for (const r of RECIPES) {
      const ct = craftTimers[r.id];
      if (ct && now < ct.end) {
        anyActive = true;
        if (workbenchOpen) {
          const el = document.getElementById(`wbr-${r.id}`);
          if (el) {
            const bar = el.querySelector('.wb-timer-bar');
            if (bar) bar.style.width = Math.round((1 - (ct.end - now) / ct.duration) * 100) + '%';
            const lbl = el.querySelector('.wb-crafting-label span:last-child');
            if (lbl) lbl.textContent = ((ct.end - now) / 1000).toFixed(1) + 's left';
          }
        }
      } else if (ct && now >= ct.end) {
        const recipe = RECIPES.find(x => x.id === r.id);
        const qty = ct.qty || 1;
        Object.entries(recipe.outputs).forEach(([k, v]) => inv[k] = (inv[k] || 0) + v * qty);
        gainXP(recipe.xp * qty);
        showMsg('+' + Object.entries(recipe.outputs).map(([k, v]) => `${v * qty} ${k}`).join(', '));
        delete craftTimers[r.id];
        updateUI(); saveGame();
        if (workbenchOpen) renderWorkbenchRecipes();
      }
    }
    if (!anyActive) { clearInterval(_wbTickId); _wbTickId = null; }
  }, 80);
}

export function initCraftTick() {
  if (RECIPES.some(r => craftTimers[r.id] && Date.now() < craftTimers[r.id].end)) startWbTick();
}

export function craftItem(id, qty = 1) {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return;
  if (craftTimers[id] && Date.now() < craftTimers[id].end) return;
  if (!Object.entries(r.inputs).every(([k, v]) => (inv[k] || 0) >= v * qty)) { showMsg('Not enough materials'); return; }
  Object.entries(r.inputs).forEach(([k, v]) => inv[k] -= v * qty);
  craftTimers[id] = { end: Date.now() + r.dur * qty, duration: r.dur * qty, qty };
  updateUI(); saveGame();
  renderWorkbenchRecipes();
  startWbTick();
}
window.craftItem = craftItem;
