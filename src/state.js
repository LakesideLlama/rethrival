import { TS, ZOOM_MIN, ZOOM_MAX } from './constants.js';

export const canvas = document.getElementById('c');
export const ctx = canvas.getContext('2d');
export let W = window.innerWidth;
export let H = window.innerHeight;
canvas.width = W; canvas.height = H;
window.addEventListener('resize', () => {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
});

export const inv = { wood:0, stone:0, food:0, wheat:0, plank:0, stone_block:0, gold:30, iron:0, ore:0, gold_ore:0, cactus_spine:0, sand:0, reed:0, mud:0, herb:0 };
export const player = { x:0, y:0, spd:120, dir:0, mineRange:TS*1.5, swingT:0, swingDir:0, swingSide:1 };
export const drops = [];
export let _dropId = 0;
export function nextDropId() { return _dropId++; }
export const cam = { x:0, y:0 };
export let zoom = 1;
export function setZoom(z) {
  zoom = +Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)).toFixed(2);
  const pct = Math.round(zoom * 100) + '%';
  const zoomBox = document.getElementById('zoom-box');
  const sZoom = document.getElementById('s-zoom');
  if (zoomBox) zoomBox.textContent = pct;
  if (sZoom) sZoom.textContent = pct;
}
export const keys = {};
export let structures = [];
export let bridges = new Set();
export function setStructures(v) { structures = v; }
export function setBridges(v) { bridges = v; }
export let xp = 0, lvl = 1;
export function setXp(v) { xp = v; }
export function setLvl(v) { lvl = v; }
export let lastT = 0;
export function setLastT(v) { lastT = v; }
export let autoTimer = 0;
export function setAutoTimer(v) { autoTimer = v; }
export let msgTimer = null;
export function setMsgTimer(v) { msgTimer = v; }
export let activeMode = null;
export function setActiveMode(v) { activeMode = v; }
export let buildMenuOpen = false, settingsOpen = false;
export function setBuildMenuOpen(v) { buildMenuOpen = v; }
export function setSettingsOpen(v) { settingsOpen = v; }
export let showFPS = false, fps = 0, fpsTimer = 0, fpsCount = 0;
export function setShowFPS(v) { showFPS = v; }
export function setFps(v) { fps = v; }
export function setFpsTimer(v) { fpsTimer = v; }
export function setFpsCount(v) { fpsCount = v; }
export let workbenchOpen = false, activeWorkbench = null;
export function setWorkbenchOpen(v) { workbenchOpen = v; }
export function setActiveWorkbench(v) { activeWorkbench = v; }
export const craftTimers = {};
export let islandGrid = [];
export const landTiles = {};
export let lastMX, lastMY;
export function setLastMouse(x, y) { lastMX = x; lastMY = y; }
export let mouseHeld = false, heldWx = 0, heldWy = 0;
export function setMouseHeld(held, wx, wy) { mouseHeld = held; if (wx !== undefined) { heldWx = wx; heldWy = wy; } }
export const discovered = new Set(['gold']);
export function discover(item) { discovered.add(item); }
