export const TS = 48;
export const ISLAND_GRID = 9;
export const CELL = 10;

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1;
export const ZOOM_STEP = 0.1;

export const SWING_DUR = 280;
export const ATTACK_INTERVAL = 350; // ms between auto-attacks when holding click

export const DROP_PICKUP_RANGE = TS * 1.4;
export const DROP_ATTRACT_RANGE = TS * 1.5;
export const DROP_EXPIRE = 45000;

export const BIOMES = {
  plains: { cols: [3,4,5], rows: [3,4,5], name: 'Plains' },
  desert: { cols: [0,1,2], rows: [3,4,5], name: 'Desert' },
  marsh:  { cols: [6,7,8], rows: [3,4,5], name: 'Marsh' },
};

export const BC = {
  plains: { base: '#3a7a31', alt: '#2d5a27', res_tree: '#1b5e20', res_rock: '#616161', res_bush: '#33691e', res_stump: '#5d4037', res_wheat: '#f9a825' },
  desert: { base: '#c9a84c', alt: '#b8943e', res_cactus: '#4a7c3f', res_sand_rock: '#8d6e3a', res_dune: '#d4a843' },
  marsh:  { base: '#4a5568', alt: '#3d4a58', res_reed: '#6b8c5a', res_mud_rock: '#4a3f35', res_herb: '#7b5ea7' },
};

export const BIOME_RES = {
  plains: ['tree','rock','bush','wheat'],
  desert: ['cactus','sand_rock','dune'],
  marsh:  ['reed','mud_rock','herb'],
};

export const RES_HP = { tree:7, rock:10, bush:5, wheat:3, cactus:7, sand_rock:10, dune:5, reed:5, mud_rock:10, herb:3 };

export const RES_LOOT = {
  tree:     () => ({ wood: rnd(2,4) }),
  rock:     () => ({ stone: rnd(2,5) }),
  bush:     () => ({ food: rnd(1,2) }),
  wheat:    () => ({ wheat: rnd(1,3) }),
  cactus:   () => ({ cactus_spine: rnd(1,2), food: 1 }),
  sand_rock:() => ({ stone: rnd(1,3), sand: rnd(1,2) }),
  dune:     () => ({ sand: rnd(2,4) }),
  reed:     () => ({ reed: rnd(1,3) }),
  mud_rock: () => ({ stone: rnd(1,2), mud: 1 }),
  herb:     () => ({ herb: rnd(1,2) }),
};

export const RES_XP = { tree:8, rock:10, bush:5, wheat:4, cactus:8, sand_rock:10, dune:4, reed:6, mud_rock:10, herb:8 };

export const RESPAWN = { tree:18000, rock:25000, bush:12000, wheat:8000, cactus:20000, sand_rock:28000, dune:10000, reed:14000, mud_rock:26000, herb:16000 };

export const XP_TABLE = [0,100,250,450,700,1000,1400,1900,2500,3200];

export const RECIPES = [
  { id:'plank',       name:'Plank',       inputs:{wood:3},        outputs:{plank:2},       xp:6,  dur:3000 },
  { id:'stone_block', name:'Stone Block', inputs:{stone:3},       outputs:{stone_block:2}, xp:6,  dur:3000 },
  { id:'rope',        name:'Rope',        inputs:{reed:2},        outputs:{rope:1},        xp:4,  dur:2000 },
  { id:'mud_brick',   name:'Mud Brick',   inputs:{mud:2,sand:1},  outputs:{mud_brick:2},   xp:5,  dur:2500 },
  { id:'herb_potion', name:'Herb Potion', inputs:{herb:3,food:1}, outputs:{potion:1},      xp:12, dur:5000 },
];

export const BUILDABLES = [
  { id:'bridge',    name:'Bridge',    desc:'Cross water gaps',          cost:{wood:3,stone:2},  lvl:1, mode:'bridge' },
  { id:'workbench', name:'Workbench', desc:'Craft planks, rope & more', cost:{wood:8,stone:4},  lvl:1, mode:'place' },
  { id:'furnace',   name:'Furnace',   desc:'Smelts ore → iron',         cost:{stone:8,plank:4}, lvl:2, mode:'place' },
  { id:'forge',     name:'Forge',     desc:'Unlocks advanced crafting',  cost:{stone:12,iron:4}, lvl:4, needs:'furnace', mode:'place' },
  { id:'market',    name:'Market',    desc:'Generates gold',             cost:{plank:10,gold:4}, lvl:5, needs:'forge',   mode:'place' },
];

export const ITEM_COLORS = {
  wood:'#8d6e3a', stone:'#9e9e9e', food:'#66bb6a', wheat:'#f9a825',
  plank:'#a1887f', stone_block:'#78909c', gold:'#ffd54f', iron:'#b0bec5',
  ore:'#8d6e63', reed:'#aed581', mud:'#795548', herb:'#ab47bc',
  sand:'#ffe082', cactus_spine:'#81c784', mud_brick:'#a1887f',
  rope:'#c8a96e', potion:'#e040fb', gold_ore:'#ffd54f',
};

function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
