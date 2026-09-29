import * as THREE from 'three';
import { steelTextures, tileTextures, foilBump } from './textures.js';
import { createExhaust } from './exhaust.js';

// Ship proportions: 1 unit = 4.5 m. Body is 11.7 units tall (≈52 m), 2 units wide (9 m).
const RING = 0.55;
const SHIELD_PHI = Math.PI; // heat shield covers the -x half
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function ogivePoints(scale = 1, tMax = 1, yBase = 9.3, height = 2.4) {
  const pts = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * tMax;
    const r = Math.pow(Math.max(0, 1 - Math.pow(t, 1.7)), 0.55) * scale;
    pts.push(new THREE.Vector2(r, yBase + t * height));
  }
  return pts;
}

function bellGeometry(rt, re, len) {
  const pts = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(rt + (re - rt) * Math.pow(t, 0.55), -t * len));
  }
  return new THREE.LatheGeometry(pts, 40);
}

export function createShip() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -5.8;
  root.add(body);

  const steel = steelTextures(10, 7);
  const tiles = tileTextures(3);
  const foil = foilBump();

  const steelMat = (height, rx = 2) => {
    const map = steel.map.clone();
    const rough = steel.roughness.clone();
    for (const t of [map, rough]) {
      t.repeat.set(rx, height / (10 * RING));
      t.needsUpdate = true;
    }
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map,
      roughnessMap: rough,
      roughness: 1,
      metalness: 1,
      envMapIntensity: 1.15,
      side: THREE.DoubleSide,
    });
  };
  const tileMat = (rx, ry) => {
    const map = tiles.map.clone();
    const bump = tiles.bump.clone();
    for (const t of [map, bump]) {
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
    }
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 3,
      roughness: 0.72,
      metalness: 0.1,
      envMapIntensity: 0.6,
      side: THREE.DoubleSide,
    });
  };
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x4a4540, metalness: 0.9, roughness: 0.45 });
  const bellMat = new THREE.MeshStandardMaterial({
    color: 0x3b332c,
    metalness: 0.85,
    roughness: 0.38,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xff5a1a),
    emissiveIntensity: 0,
  });
  const kapton = new THREE.MeshStandardMaterial({
    color: 0xe3a63b,
    metalness: 1,
    roughness: 0.3,
    bumpMap: foil,
    bumpScale: 4,
    envMapIntensity: 1.4,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: new THREE.Color(0xffc98a),
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const parts = {};
  const addPart = (name, step, explode, anchor, rot = new THREE.Euler()) => {
    const g = new THREE.Group();
    g.name = name;
    body.add(g);
    parts[name] = { group: g, step, explode, anchor, rot, amount: 0 };
    return g;
  };

  // ---------- Engine bay ----------
  const engines = addPart('engines', 0, new THREE.Vector3(0, -3.4, 0), new THREE.Vector3(0.7, -0.4, 0.4), new THREE.Euler(0, 0.9, 0));
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.9, 0.14, 48), darkMetal);
  puck.position.y = 0.72;
  engines.add(puck);
  const engineSlots = [
    ...[0, 1, 2].map((k) => ({ r: 0.3, a: Math.PI / 2 + (k * Math.PI * 2) / 3, rt: 0.08, re: 0.2, len: 0.75 })),
    ...[0, 1, 2].map((k) => ({ r: 0.58, a: Math.PI / 6 + (k * Math.PI * 2) / 3, rt: 0.09, re: 0.34, len: 1.15 })),
  ];
  for (const s of engineSlots) {
    const x = Math.sin(s.a) * s.r, z = Math.cos(s.a) * s.r;
    const bell = new THREE.Mesh(bellGeometry(s.rt, s.re, s.len), bellMat);
    bell.position.set(x, 0.36, z);
    engines.add(bell);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(s.re, 0.012, 6, 40), darkMetal);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(x, 0.36 - s.len, z);
    engines.add(lip);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.32, 16), darkMetal);
    head.position.set(x, 0.52, z);
    engines.add(head);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 16), kapton);
    pump.position.set(Math.sin(a) * 0.5, 0.95, Math.cos(a) * 0.5);
    engines.add(pump);
  }
  const exhaust = createExhaust();
  exhaust.group.position.y = -0.05;
  engines.add(exhaust.group);

  // ---------- Lower tank with aft skirt (liquid oxygen) ----------
  const lox = addPart('lox', 1, new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(1.0, 2.6, 0.3), new THREE.Euler(0, -0.35, 0));
  const loxShell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4.6, 72, 1, true), steelMat(4.6));
  loxShell.position.y = 2.3;
  lox.add(loxShell);
  const domeLow = new THREE.Mesh(new THREE.SphereGeometry(0.985, 48, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), darkMetal);
  domeLow.scale.y = 0.4;
  domeLow.position.y = 1.35;
  lox.add(domeLow);
  const domeLoxTop = new THREE.Mesh(new THREE.SphereGeometry(0.985, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), steelMat(1.5));
  domeLoxTop.scale.y = 0.35;
  domeLoxTop.position.y = 4.6;
  lox.add(domeLoxTop);

  // ---------- Upper tank (liquid methane) ----------
  const ch4 = addPart('ch4', 1, new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(1.0, 6.3, 0.3), new THREE.Euler(0, 0.25, 0));
  const ch4Shell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.5, 72, 1, true), steelMat(3.5));
  ch4Shell.position.y = 6.35;
  ch4.add(ch4Shell);
  const domeCh4Low = new THREE.Mesh(new THREE.SphereGeometry(0.985, 48, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steelMat(1.5));
  domeCh4Low.scale.y = 0.35;
  domeCh4Low.position.y = 4.6;
  ch4.add(domeCh4Low);
  const domeCh4Top = domeLoxTop.clone();
  domeCh4Top.position.y = 8.1;
  ch4.add(domeCh4Top);

  // raceways running along the steel side of both tanks
  const raceA = Math.PI / 2 - 0.5;
  for (const [part, y0, h] of [[lox, 0.3, 4.3], [ch4, 4.6, 3.5]]) {
    const race = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.12), darkMetal);
    race.position.set(Math.sin(raceA) * 1.03, y0 + h / 2, Math.cos(raceA) * 1.03);
    race.rotation.y = raceA;
    part.add(race);
  }

  // ---------- Crew section and nose ----------
  const nose = addPart('nose', 3, new THREE.Vector3(0, 2.6, 0), new THREE.Vector3(0.75, 8.75, 0.66), new THREE.Euler(0, -0.6, 0));
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.2, 72, 1, true), steelMat(1.2));
  deck.position.y = 8.7;
  nose.add(deck);
  const ogive = new THREE.Mesh(new THREE.LatheGeometry(ogivePoints(1), 72), steelMat(2.4));
  nose.add(ogive);
  const noseDome = domeCh4Low.clone();
  noseDome.position.y = 8.1;
  nose.add(noseDome);
  const winGeo = new THREE.BoxGeometry(0.13, 0.085, 0.03);
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 9; k++) {
      const a = 0.18 * Math.PI + (k / 8) * 0.64 * Math.PI + (row ? 0.035 : 0);
      const w = new THREE.Mesh(winGeo, windowMat);
      w.position.set(Math.sin(a) * 1.005, 8.62 + row * 0.2, Math.cos(a) * 1.005);
      w.rotation.y = a;
      nose.add(w);
    }
  }

  // ---------- Heat shield and flaps ----------
  const shield = addPart('shield', 2, new THREE.Vector3(-3.2, 0.2, 0), new THREE.Vector3(-1.03, 5.4, 0), new THREE.Euler(0, 0, 0.1));
  const shieldBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.02, 9.1, 72, 1, true, SHIELD_PHI, Math.PI),
    tileMat(1.7, 4.9)
  );
  shieldBody.position.y = 0.2 + 4.55;
  shield.add(shieldBody);
  const shieldNose = new THREE.Mesh(
    new THREE.LatheGeometry(ogivePoints(1.02, 0.84), 72, SHIELD_PHI, Math.PI),
    tileMat(1.7, 1.1)
  );
  shield.add(shieldNose);

  const flapMat = tileMat(0.5, 0.9);
  const flap = (w, h, top) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(w, h * 0.12);
    s.lineTo(w, h * 0.72);
    s.lineTo(0, top);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    g.translate(0, 0, -0.035);
    return g;
  };
  const aftGeo = flap(0.95, 2.2, 2.3);
  const fwdGeo = flap(0.62, 1.3, 1.45);
  const flaps = [];
  for (const side of [1, -1]) {
    const aft = new THREE.Mesh(aftGeo, flapMat);
    aft.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    aft.position.set(-0.12, 0.25, side * 0.97);
    aft.userData.side = side;
    shield.add(aft);
    flaps.push(aft);
    const fwd = new THREE.Mesh(fwdGeo, flapMat);
    fwd.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    fwd.rotation.x = side * -0.12;
    fwd.position.set(-0.12, 9.05, side * 0.9);
    fwd.userData.side = side;
    shield.add(fwd);
    flaps.push(fwd);
  }

  // ---------- Blueprint ghost: rim lines of every part in its assembled place ----------
  root.updateMatrixWorld(true);
  const ghostMat = new THREE.LineBasicMaterial({ color: 0xdfe9ff, transparent: true, opacity: 0, depthWrite: false });
  const ghost = new THREE.Group();
  body.add(ghost);
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  body.traverse((o) => {
    if (!o.isMesh || o.material === windowMat || o.parent === exhaust.group) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), ghostMat);
    lines.matrixAutoUpdate = false;
    lines.matrix.multiplyMatrices(inv, o.matrixWorld);
    ghost.add(lines);
  });

  // Dimension line: overall height, drawn beside the ship in blueprint mode.
  const dimPts = [];
  const dx = 2.3;
  dimPts.push(dx, -0.79, 0, dx, 11.7, 0);
  dimPts.push(dx - 0.25, -0.79, 0, dx + 0.25, -0.79, 0);
  dimPts.push(dx - 0.25, 11.7, 0, dx + 0.25, 11.7, 0);
  for (let y = 0; y <= 11.7; y += RING * 2) dimPts.push(dx - 0.08, y, 0, dx, y, 0);
  const dimGeo = new THREE.BufferGeometry();
  dimGeo.setAttribute('position', new THREE.Float32BufferAttribute(dimPts, 3));
  const dim = new THREE.LineSegments(dimGeo, ghostMat);
  body.add(dim);
  const dimAnchor = new THREE.Vector3(dx, 5.5, 0);

  const partList = Object.values(parts);
  const tmp = new THREE.Vector3();

  function update({ time, explode, build, thrust, seaLevel, expand, ghostOpacity, flapAngle = 0 }) {
    for (const p of partList) {
      // Each step claims a fifth of the build chapter after a short hold.
      const start = 0.1 + p.step * 0.2;
      const a = smooth(start, start + 0.17, build);
      p.amount = a;
      const e = explode * (1 - a);
      const eased = e * e * (3 - 2 * e);
      p.group.position.copy(p.explode).multiplyScalar(eased);
      p.group.rotation.set(p.rot.x * eased, p.rot.y * eased, p.rot.z * eased);
    }
    for (const f of flaps) {
      const e = explode * (1 - parts.shield.amount);
      f.position.z = Math.sign(f.position.z) * (f.userData.base ?? (f.userData.base = Math.abs(f.position.z))) + f.userData.side * e * 1.4;
      f.rotation.z = flapAngle * f.userData.side;
    }
    ghostMat.opacity = ghostOpacity;
    ghost.visible = dim.visible = ghostOpacity > 0.001;
    bellMat.emissiveIntensity = thrust * (0.6 + expand * 2.4);
    exhaust.update({ time, thrust, seaLevel, expand });
  }

  // World position of a part's callout anchor (for the HTML label).
  function anchorOf(name, target = tmp) {
    const p = parts[name];
    return target.copy(p.anchor).applyMatrix4(p.group.matrixWorld);
  }
  function dimensionAnchor(target = tmp) {
    return target.copy(dimAnchor).applyMatrix4(body.matrixWorld);
  }

  return { root, body, parts, update, anchorOf, dimensionAnchor, exhaust };
}
