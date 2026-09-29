import * as THREE from 'three';

// Deterministic PRNG so every visit builds the same ship.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Stacked stainless rings: each ring has its own tint, with weld seams between them
// and brushed vertical grain. Returns { map, roughness } covering `rings` rings.
export function steelTextures(rings = 8, seed = 7) {
  const r = rng(seed);
  const W = 512, H = 1024;
  const [c, g] = canvas(W, H);
  const [rc, rg] = canvas(W, H);
  const ringH = H / rings;

  for (let i = 0; i < rings; i++) {
    const tone = 188 + Math.floor(r() * 30);
    const warm = Math.floor(r() * 6);
    g.fillStyle = `rgb(${tone + warm},${tone + warm * 0.5},${tone - 2})`;
    g.fillRect(0, i * ringH, W, ringH);
    const rough = 70 + Math.floor(r() * 40);
    rg.fillStyle = `rgb(${rough},${rough},${rough})`;
    rg.fillRect(0, i * ringH, W, ringH);
    // panel seams inside each ring (the rings are rolled from sheets)
    const seams = 2 + Math.floor(r() * 2);
    for (let s = 0; s < seams; s++) {
      const x = r() * W;
      g.fillStyle = 'rgba(90,86,80,0.35)';
      g.fillRect(x, i * ringH, 1.5, ringH);
      rg.fillStyle = 'rgba(200,200,200,0.5)';
      rg.fillRect(x - 1, i * ringH, 3, ringH);
    }
  }
  // brushed grain + heat discolouration
  for (let k = 0; k < 2600; k++) {
    const x = r() * W, y = r() * H, len = 20 + r() * 140;
    const a = 0.03 + r() * 0.05;
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,38,36,${a})`;
    g.fillRect(x, y, 1, len);
    rg.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a * 2})` : `rgba(0,0,0,${a * 2})`;
    rg.fillRect(x, y, 1, len);
  }
  for (let k = 0; k < 14; k++) {
    const x = r() * W, y = r() * H, rad = 30 + r() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(170,140,110,0.10)');
    grad.addColorStop(1, 'rgba(170,140,110,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // weld seams between rings
  for (let i = 0; i <= rings; i++) {
    const y = i * ringH;
    g.fillStyle = 'rgba(70,64,58,0.8)';
    g.fillRect(0, y - 1.5, W, 3);
    g.fillStyle = 'rgba(255,240,220,0.35)';
    g.fillRect(0, y + 1.5, W, 1);
    rg.fillStyle = 'rgb(210,210,210)';
    rg.fillRect(0, y - 3, W, 6);
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughness = new THREE.CanvasTexture(rc);
  for (const t of [map, roughness]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, roughness };
}

// Hexagonal thermal protection tiles.
export function tileTextures(seed = 3) {
  const r = rng(seed);
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  const [bc, bg] = canvas(W, H);
  g.fillStyle = '#2c2a28';
  g.fillRect(0, 0, W, H);
  bg.fillStyle = '#000';
  bg.fillRect(0, 0, W, H);
  const size = 16; // hex radius in px
  const w = Math.sqrt(3) * size, h = size * 1.5;
  const cols = Math.ceil(W / w) + 1, rows = Math.ceil(H / h) + 1;
  const hex = (ctx, cx, cy, rad) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i + Math.PI / 6;
      ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
    ctx.closePath();
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cx = x * w + (y % 2 ? w / 2 : 0);
      const cy = y * h;
      const v = 14 + Math.floor(r() * 16);
      const odd = r() > 0.97 ? 22 : 0; // the occasional replaced tile
      g.fillStyle = `rgb(${v + odd},${v + odd},${v + 2 + odd})`;
      hex(g, cx, cy, size - 1.6);
      g.fill();
      bg.fillStyle = '#fff';
      hex(bg, cx, cy, size - 1.6);
      bg.fill();
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bc);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, bump };
}

// Crinkled multi-layer insulation foil.
export function foilBump(seed = 11) {
  const r = rng(seed);
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    const x = r() * 256, y = r() * 256;
    g.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Soft billowing puff for smoke and clouds.
export function puffTexture(seed = 5) {
  const r = rng(seed);
  const S = 256;
  const [c, g] = canvas(S, S);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = r() * S * 0.22;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
    const rad = S * (0.12 + r() * 0.16);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,200,120,0.25)') {
  const S = 256;
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.18, mid);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
