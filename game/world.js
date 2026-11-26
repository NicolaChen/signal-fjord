export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const radians = d => d * Math.PI / 180;
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function noise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), f = smooth(0, 1, x - i), g = smooth(0, 1, z - j);
  return lerp(lerp(hash(i, j), hash(i + 1, j), f), lerp(hash(i, j + 1), hash(i + 1, j + 1), f), g);
}

const massifs = [
  [-2080,-3950,1270,1600,1130],[-1690,-2730,1040,1260,1480],[-2270,-1280,1550,1320,1740],
  [-1360,-650,880,930,1310],[-1110,390,700,880,920],[-1760,1100,1140,1180,1580],
  [-2200,2520,1430,1720,2170],[-1125,2330,790,1080,1170],[-1950,4480,1660,1750,1880],
  [1350,-3710,1080,1720,1220],[1250,-2330,780,980,1270],[870,-1230,450,780,430],
  [1160,-120,700,920,810],[1700,880,1150,1230,1290],[1100,2100,760,1020,1190],
  [2450,2850,1580,1700,1840],[1150,4330,1070,1370,1490],[-480,5100,1190,1330,1660],
  [3600,-1000,1360,4200,2300],[-3880,250,1800,4000,2150]
];

export const strip = Object.freeze({ x:0, start:-310, end:560, width:60, y:25, heading:0 });
export const approach = Object.freeze({
  id:'RWY', x:0, y:81, z:-1050, r:66, tilt:0, name:'Runway 01 · approach'
});

export function terrainHeight(x, z) {
  let height = -46;
  const warp = (noise(x / 660, z / 640) - .5) * 275;
  const fingers = noise(x / 220 + 7, z / 280) - .5;
  const gullies = 1 - Math.abs(2*noise((x+z*.38)/210,z/360)-1);
  for (const [cx, cz, rx, rz, peak] of massifs) {
    const dz=(z-cz)/rz, dx=(x-cx+warp)/rx;
    const q = Math.hypot(dx + dz*.27,dz - dx*.10);
    if (q > 1.44) continue;
    const shape = Math.max(0, 1 - q / 1.36);
    const teeth = .62 + .46 * noise(x / 335, z / 420) + .40 * fingers + .11*gullies;
    height = Math.max(height, peak * Math.pow(shape, 1.42) * teeth - 62);
  }
  const roughness = smooth(8, 190, height);
  height += roughness * (62 * fingers + 38 * (noise(x / 87, z / 99) - .5) + (gullies-.55)*34);
  // Low, flat headland with a causeway, lying between two cliff faces.
  const headland = 40 - 36 * (Math.pow((x + 63) / 308, 2) + Math.pow((z - 120) / 720, 4));
  height = Math.max(height, headland + (noise(x / 66, z / 96) - .52) * 9);
  const runwayCut = (1-smooth(46, 91, Math.abs(x))) * smooth(-390, -329, z) * (1-smooth(570, 635, z));
  height = lerp(height, strip.y, runwayCut);
  return height;
}

const hoop = (id, x, y, z, r, name, tilt = 0) => ({id,x,y,z,r,name,tilt});

export const sorties = [
  {
    key:'post', code:'01 / AIR MAIL', title:'The Morning Run', tag:'MAIL · TRAINING ROUTE',
    brief:'Fly three beacon gates, then put the dawn mail down on Runway 01.',
    pilot:'Low wind / guided approach', color:'#ffc170', fuel:100, crosswind:0.6,
    start:{x:38,y:185,z:-2950,heading:-.111,speed:73}, land:true,
    gates:[
      hoop('01',-45,166,-2500,68,'Outer inlet',-.09),
      hoop('02',-112,139,-1960,61,'Narrows',-.05),
      hoop('03',31,109,-1460,56,'Harbour mouth',.19)
    ]
  },
  {
    key:'supply', code:'02 / RELIEF', title:'The Low Drop', tag:'AID DROP · PRECISION',
    brief:'Slow down and press F inside each marked corridor to release a relief crate, then land.',
    pilot:'Crosswind / speed windows', color:'#80f3dd', fuel:75, crosswind:4.6,
    start:{x:-125,y:142,z:-3020,heading:.22,speed:68}, land:true,
    gates:[
      {...hoop('A',25,107,-2310,51,'Lighthouse drop',.20), drop:true, maxSpeed:81},
      {...hoop('B',190,92,-1610,48,'East shore drop',.08), drop:true, maxSpeed:77}
    ]
  },
  {
    key:'weather', code:'03 / SURVEY', title:'The Wind Trace', tag:'SURVEY · TIMED CIRCUIT',
    brief:'Sweep four weather gates before the battery runs out. No landing required.',
    pilot:'Gusts / 52-second limit', color:'#ff9f9d', fuel:62, crosswind:7.8,
    start:{x:-80,y:215,z:-3150,heading:.19,speed:86}, land:false, limit:52,
    gates:[
      hoop('01',85,223,-2640,57,'First sounding',.24),
      hoop('02',230,312,-2050,56,'Updraft line',.12),
      hoop('03',-140,264,-1510,57,'Crosswind sweep',-.31),
      hoop('04',-225,169,-665,57,'Last sounding',.02)
    ]
  }
];
