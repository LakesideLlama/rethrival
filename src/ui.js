import { BUILDABLES, XP_TABLE } from './constants.js';
import {
  inv, xp, lvl, activeMode, buildMenuOpen, structures,
  setActiveMode, setBuildMenuOpen, settingsOpen, setSettingsOpen,
  showFPS, setShowFPS, setZoom, setXp, setLvl,
} from './state.js';
import { costStr, canAfford, showMsg } from './utils.js';

export function updateUI() {
  const items = Object.entries(inv).filter(([, v]) => v > 0);
  document.getElementById('inv-list').innerHTML = items.length
    ? items.map(([k, v]) => `<div class="inv-row"><span>${k}</span><span class="inv-val">${v}</span></div>`).join('')
    : '<div style="color:#555;font-size:11px">empty</div>';
  document.getElementById('gold-box').textContent = '🪙 ' + inv.gold;
  const need = XP_TABLE[lvl] || 1;
  document.getElementById('xpbar-fill').style.width = (Math.min(xp / need, 1) * 100) + '%';
  document.getElementById('lvl-box').textContent = 'Lv ' + lvl + ' (' + xp + '/' + need + ')';
  document.getElementById('btn-build').classList.toggle('active', !!activeMode);
  if (buildMenuOpen) renderBuildMenu();
}

export function gainXP(a) {
  setXp(xp + a);
  const n = XP_TABLE[lvl] || 99999;
  if (xp >= n && lvl < 10) {
    setLvl(lvl + 1);
    setXp(xp - n);
    showMsg('LEVEL UP! Lv ' + lvl);
  }
  updateUI();
}

export function renderBuildMenu() {
  document.getElementById('build-items').innerHTML = BUILDABLES.map(b => {
    const count = structures.filter(s => s.type === b.id).length;
    const locked = lvl < b.lvl || (b.needs && !structures.some(s => s.type === b.needs));
    const affordable = canAfford(b.cost);
    const disabled = locked || !affordable;
    const modeKey = b.mode === 'bridge' ? 'bridge' : `place:${b.id}`;
    const isActive = activeMode === modeKey;
    const lockReason = lvl < b.lvl
      ? `Requires level ${b.lvl}`
      : (b.needs && !structures.some(s => s.type === b.needs) ? `Requires ${b.needs}` : '');
    const costHtml = Object.entries(b.cost).map(([k, v]) => {
      const have = inv[k] || 0; const ok = have >= v;
      return `<span style="color:${ok ? '#81c784' : '#e57373'}">${v} ${k} <span style="opacity:.7">(${have})</span></span>`;
    }).join('<span style="color:#556"> · </span>');
    return `<div class="build-item${disabled ? ' disabled' : ''}${isActive ? ' active-mode' : ''}" onclick="${disabled && !isActive ? '' : "selectBuildItem('" + b.id + "')"}">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="bi-name">${b.name}</span>
        ${isActive ? '<span style="color:#4fc3f7;font-size:10px;margin-left:auto">active</span>' : ''}
        ${count > 0 ? `<span style="color:#81c784;font-size:10px;margin-left:auto">×${count}</span>` : ''}
      </div>
      <div class="bi-desc">${b.desc}</div>
      ${lockReason
        ? `<div class="bi-cost" style="color:#e57373">${lockReason}</div>`
        : `<div class="bi-cost" style="display:flex;flex-wrap:wrap;gap:3px">${costHtml}</div>`}
    </div>`;
  }).join('');
}

export function toggleBuildMenu() {
  setBuildMenuOpen(!buildMenuOpen);
  document.getElementById('build-menu').style.display = buildMenuOpen ? 'block' : 'none';
  document.getElementById('btn-build').classList.toggle('active', buildMenuOpen);
  if (buildMenuOpen) renderBuildMenu();
}

export function closeBuildMenu() {
  setBuildMenuOpen(false);
  document.getElementById('build-menu').style.display = 'none';
  document.getElementById('btn-build').classList.remove('active');
}

export function selectBuildItem(id) {
  const b = BUILDABLES.find(x => x.id === id);
  if (!b) return;
  if (lvl < b.lvl) { showMsg(`Need level ${b.lvl}`); return; }
  if (b.needs && !structures.some(s => s.type === b.needs)) { showMsg(`Need a ${b.needs} first`); return; }
  if (!canAfford(b.cost)) { showMsg(`Need: ${costStr(b.cost)}`); return; }
  const modeKey = b.mode === 'bridge' ? 'bridge' : `place:${b.id}`;
  if (activeMode === modeKey) { setActiveMode(null); showMsg('Build mode off'); }
  else {
    setActiveMode(modeKey);
    showMsg(b.mode === 'bridge' ? 'Click water to place bridge' : `Click land to place ${b.name}`);
  }
  closeBuildMenu();
  updateUI();
}
window.selectBuildItem = selectBuildItem;

export function toggleSettings() {
  setSettingsOpen(!settingsOpen);
  document.getElementById('settings-panel').style.display = settingsOpen ? 'block' : 'none';
}

export function toggleFPS() {
  setShowFPS(!showFPS);
  document.getElementById('fps-lbl').textContent = showFPS ? 'On' : 'Off';
}

export { setZoom };
