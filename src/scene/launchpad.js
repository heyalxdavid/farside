import * as THREE from 'three';
import { puffTexture, glowTexture, rng } from './textures.js';

const GROUND_Y = -9.4;

export function createLaunchSite() {
  const r = rng(99);
  const env = new THREE.Group(); // everything fixed to the ground; slides down as the ship climbs
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 0.7, roughness: 0.55 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0, roughness: 0.95 });

  // Ground
  const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 64), concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  env.add(ground);

  // Launch mount: ring table on six legs
  const ringPts = [
    new THREE.Vector2(1.05, 0),
    new THREE.Vector2(1.7, 0),
    new THREE.Vector2(1.7, 0.55),
    new THREE.Vector2(1.05, 0.55),
    new THREE.Vector2(1.05, 0),
  ];
  const mount = new THREE.Mesh(new THREE.LatheGeometry(ringPts, 48), metal);
  mount.position.y = -6.45;
  env.add(mount);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.0, 0.35), metal);
    leg.position.set(Math.sin(a) * 1.4, -7.9, Math.cos(a) * 1.4);
    env.add(leg);
  }
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 0.4, 48), concrete);
  deck.position.y = GROUND_Y + 0.2;
  env.add(deck);

  // Tower: four columns and X-bracing, built from instanced struts.
  const towerX = -4.6, towerZ = -2.2, half = 0.9, top = 14;
  const struts = [];
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  for (const [cx, cz] of corners) struts.push([[cx, GROUND_Y, cz], [cx, top, cz], 0.09]);
  const levels = 13;
  const dy = (top - GROUND_Y) / levels;
  for (let i = 0; i < levels; i++) {
    const y0 = GROUND_Y + i * dy, y1 = y0 + dy;
    for (let f = 0; f < 4; f++) {
      const [ax, az] = corners[f];
      const [bx, bz] = corners[(f + 1) % 4];
      struts.push([[ax, y0, az], [bx, y1, bz], 0.035]);
      struts.push([[bx, y0, bz], [ax, y1, az], 0.035]);
      struts.push([[ax, y1, az], [bx, y1, bz], 0.045]);
    }
  }
  const strutGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const inst = new THREE.InstancedMesh(strutGeo, metal, struts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), mid = new THREE.Vector3(), dir = new THREE.Vector3(), s = new THREE.Vector3();
  struts.forEach(([p0, p1, w], i) => {
    a.set(...p0);
    b.set(...p1);
    mid.addVectors(a, b).multiplyScalar(0.5);
    dir.subVectors(b, a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    s.set(w, len, w);
    m.compose(mid, q, s);
    inst.setMatrixAt(i, m);
  });
  const tower = new THREE.Group();
  tower.add(inst);
  // Chopstick arms reaching toward the ship
  // arms straddle the ship at world z = ±1.3, open just wide enough for it to leave
  for (const wz of [-1.3, 1.3]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 0.22), metal);
    arm.position.set(2.9, 3.6, wz - towerZ);
    tower.add(arm);
  }
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 2.1), metal);
  carriage.position.set(0, 3.6, 0);
  tower.add(carriage);
  const beacons = [];
  for (const [cx, cz] of corners) {
    const l = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(4, 0.3, 0.15), blending: THREE.AdditiveBlending, depthWrite: false })
    );
    l.position.set(cx, top + 0.2, cz);
    l.scale.setScalar(0.9);
    tower.add(l);
    beacons.push(l);
  }
  tower.position.set(towerX, 0, towerZ);
  env.add(tower);

  // Far-off site lights along the coast
  const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,190,120,0.2)');
  for (let i = 0; i < 70; i++) {
    const ang = r() * Math.PI * 2;
    const d = 40 + r() * 260;
    const l = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(2.4, 1.5, 0.8).multiplyScalar(0.6 + r()), blending: THREE.AdditiveBlending, depthWrite: false })
    );
    l.position.set(Math.cos(ang) * d, GROUND_Y + 0.3 + r() * 0.8, Math.sin(ang) * d);
    l.scale.setScalar(0.6 + r() * 1.4);
    env.add(l);
  }

  // ---------- Smoke ----------
  const puff = puffTexture();
  const smokeGroup = new THREE.Group();
  env.add(smokeGroup);
  const puffs = [];
  for (let i = 0; i < 90; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    sp.userData = { age: 0, life: 1, vel: new THREE.Vector3(), rot: 0, grow: 1 };
    smokeGroup.add(sp);
    puffs.push(sp);
  }
  let spawnAcc = 0;
  let cursor = 0;
  const spawn = () => {
    const sp = puffs[cursor];
    cursor = (cursor + 1) % puffs.length;
    const ang = r() * Math.PI * 2;
    const speed = 5 + r() * 10;
    sp.userData.age = 0;
    sp.userData.life = 4 + r() * 5;
    sp.userData.vel.set(Math.cos(ang) * speed, 0.4 + r() * 2.2, Math.sin(ang) * speed);
    sp.userData.grow = 5 + r() * 7;
    sp.material.rotation = r() * Math.PI * 2;
    sp.position.set(Math.cos(ang) * 1.2, GROUND_Y + 1 + r(), Math.sin(ang) * 1.2);
    sp.visible = true;
  };

  // ---------- Cloud deck (the ship punches through it) ----------
  const clouds = new THREE.Group();
  env.add(clouds);
  const cloudY = 0.2 * 47 * 47; // env height the ship reaches at T+47 s
  for (let i = 0; i < 80; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0.85 }));
    const ang = r() * Math.PI * 2;
    const d = 5 + Math.pow(r(), 0.7) * 70;
    sp.position.set(Math.cos(ang) * d, cloudY + (r() - 0.5) * 16, Math.sin(ang) * d);
    sp.scale.setScalar(14 + r() * 26);
    sp.material.rotation = r() * Math.PI * 2;
    sp.material.color.setRGB(1.25, 0.95, 0.85);
    clouds.add(sp);
  }

  // ---------- Speed streaks (live in ship space, not ground space) ----------
  const N = 140;
  const streakPos = new Float32Array(N * 6);
  const seeds = [];
  for (let i = 0; i < N; i++) {
    const ang = r() * Math.PI * 2;
    const d = 6 + r() * 30;
    seeds.push({ x: Math.cos(ang) * d, z: Math.sin(ang) * d, y: r() * 80, len: 0.4 + r() * 1.6 });
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;

  const tmp = new THREE.Color();
  function update({ time, dt, drop, thrust, streak, visible, fogColor }) {
    env.visible = visible;
    streaks.visible = visible && streak > 0.01;
    if (!visible) return;
    env.position.y = -drop;
    tower.visible = drop < 120;
    ground.visible = mount.visible = deck.visible = drop < 400;
    for (const bcn of beacons) bcn.material.opacity = Math.sin(time * 3) > 0 ? 1 : 0.15;

    // smoke billows only while the exhaust is still hitting the ground
    if (thrust > 0.15 && drop < 60) {
      spawnAcc += dt * 26 * thrust;
      while (spawnAcc > 1) {
        spawn();
        spawnAcc -= 1;
      }
    }
    for (const sp of puffs) {
      if (!sp.visible) continue;
      const u = sp.userData;
      u.age += dt;
      const k = u.age / u.life;
      if (k >= 1) {
        sp.visible = false;
        continue;
      }
      sp.position.addScaledVector(u.vel, dt);
      u.vel.multiplyScalar(Math.pow(0.55, dt));
      u.vel.y += dt * 0.5;
      sp.scale.setScalar(2 + u.grow * Math.sqrt(k) * 2.2);
      sp.material.opacity = Math.min(1, k * 8) * (1 - k) * 0.95;
      // hot near the flame, then dawn-grey
      const heat = Math.max(0, 1 - k * 3) * thrust;
      tmp.setRGB(0.5, 0.52, 0.6).lerp(fogColor, 0.25);
      sp.material.color.setRGB(tmp.r + heat * 2.6, tmp.g + heat * 1.2, tmp.b + heat * 0.4);
    }

    // streaks: scroll-driven offset plus a gentle time drift so they never freeze
    const off = drop * 0.9 + time * 12 * streak;
    for (let i = 0; i < N; i++) {
      const sd = seeds[i];
      const y = 40 - ((sd.y + off) % 80);
      streakPos[i * 6 + 0] = sd.x;
      streakPos[i * 6 + 1] = y;
      streakPos[i * 6 + 2] = sd.z;
      streakPos[i * 6 + 3] = sd.x;
      streakPos[i * 6 + 4] = y + sd.len * (0.5 + streak * 2);
      streakPos[i * 6 + 5] = sd.z;
    }
    streakGeo.attributes.position.needsUpdate = true;
    streakMat.opacity = streak * 0.16;
  }

  return { env, streaks, update };
}
