import * as THREE from 'three';
import { PLANETS, MISSIONS } from '../data.js';
import { planetMaterial, createSun, createRings } from './planet.js';
import { glowTexture, rng } from './textures.js';

const TAU = Math.PI * 2;

function orbitLine(radius, color, opacity) {
  const pts = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return new THREE.Line(geo, mat);
}

export function createOrrery() {
  const group = new THREE.Group();
  const sun = createSun(5);
  group.add(sun.group);
  const r = rng(12);

  const bodies = {}; // id -> { mesh, pivot, data, orbitLine, mats: [] }
  const allMats = [];

  for (const p of PLANETS) {
    const mat = planetMaterial(p.kind, {
      colA: p.colA, colB: p.colB, colC: p.colC, atmo: p.atmo, atmoStrength: p.atmoStrength,
      seed: r() * 10, bands: p.bands, spot: p.spot, cityLights: 0.8,
    });
    allMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 64, 48), mat);
    mesh.userData.id = p.id;
    const holder = new THREE.Group(); // positioned on its orbit
    holder.add(mesh);
    group.add(holder);
    if (p.id === 'uranus') mesh.rotation.z = 1.7;
    else mesh.rotation.z = 0.2 + r() * 0.3;

    const line = orbitLine(p.orbit, 0xf1ece2, 0.12);
    group.add(line);
    const b = { id: p.id, data: p, mesh, holder, line, angle: p.phase, radius: p.radius, pickable: mesh };
    bodies[p.id] = b;

    if (p.rings) {
      const rings = createRings(p.radius * 1.35, p.radius * 2.45, p.radius);
      rings.rotation.x = -Math.PI / 2 + 0.45;
      holder.add(rings);
      b.rings = rings;
    }
  }

  // Moons that missions go to
  const moonDefs = [
    { id: 'moon', parent: 'earth', dist: 2.0, radius: 0.24, speed: 9, kind: 'ROCK', colA: 0x8e8b86, colB: 0x6a6763, colC: 0x5a5856 },
    { id: 'europa', parent: 'jupiter', dist: 4.6, radius: 0.28, speed: 3.5, kind: 'ROCK', colA: 0xd8cbb4, colB: 0xa58e70, colC: 0x8a5a3a },
    { id: 'titan', parent: 'saturn', dist: 7.2, radius: 0.34, speed: 2.2, kind: 'VENUS', colA: 0xd49a4a, colB: 0xb07830, colC: 0xe8c080 },
  ];
  for (const m of moonDefs) {
    const mat = planetMaterial(m.kind, { colA: m.colA, colB: m.colB, colC: m.colC, seed: r() * 10 });
    allMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(m.radius, 32, 24), mat);
    const holder = new THREE.Group();
    holder.add(mesh);
    group.add(holder);
    bodies[m.id] = { id: m.id, def: m, mesh, holder, angle: r() * TAU, radius: m.radius, moon: true };
  }

  // Asteroid belt, with Ceres as a slightly brighter point
  const beltN = 4200;
  const beltPos = new Float32Array(beltN * 3);
  const beltData = [];
  for (let i = 0; i < beltN; i++) {
    const rad = 30 + Math.pow(r(), 0.8) * 7 + (r() - 0.5) * 1.5;
    beltData.push({ rad, a: r() * TAU, y: (r() - 0.5) * 1.2 * (r() > 0.8 ? 2.5 : 1), s: 0.7 * Math.pow(rad / 30, -1.5) });
  }
  const beltGeo = new THREE.BufferGeometry();
  beltGeo.setAttribute('position', new THREE.BufferAttribute(beltPos, 3));
  const belt = new THREE.Points(
    beltGeo,
    new THREE.PointsMaterial({ color: 0xb0a290, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)'), size: 0.34, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false })
  );
  group.add(belt);
  const ceresMat = planetMaterial('ROCK', { colA: 0x7a7670, colB: 0x55524e, colC: 0xbdb6aa, seed: 3 });
  allMats.push(ceresMat);
  const ceres = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), ceresMat);
  const ceresHolder = new THREE.Group();
  ceresHolder.add(ceres);
  group.add(ceresHolder);
  bodies.ceres = { id: 'ceres', mesh: ceres, holder: ceresHolder, angle: 1.9, radius: 0.22, orbit: 33, speed: 0.6 };

  // Mission arcs
  const ARC_N = 160;
  const arcs = MISSIONS.map((m, i) => {
    const pos = new Float32Array(ARC_N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xe3a63b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    group.add(line);
    return { mission: m, geo, pos, mat, line, index: i };
  });
  const marker = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,190,90,0.35)'), color: new THREE.Color(3, 2.1, 1.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  marker.scale.setScalar(2.2);
  group.add(marker);
  // Ring used to mark the Tanker Run in Earth orbit
  const ringMarker = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.03, 8, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  ringMarker.rotation.x = Math.PI / 2;
  group.add(ringMarker);

  const sunPos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const a3 = new THREE.Vector3();

  function worldPos(id, target = new THREE.Vector3()) {
    return bodies[id].holder.getWorldPosition(target);
  }

  function arcPoint(from, to, s, out) {
    if (from.distanceTo(to) < 6) {
      // Short hop (Earth to Moon): a simple lifted curve.
      const lift = Math.sin(Math.PI * s) * 1.4;
      out.lerpVectors(from, to, s);
      out.y += lift;
      return out;
    }
    // A prograde spiral between two orbits, lifted slightly out of the plane.
    const r0 = Math.hypot(from.x, from.z), r1 = Math.hypot(to.x, to.z);
    const a0 = Math.atan2(from.z, from.x), a1 = Math.atan2(to.z, to.x);
    let da = a1 - a0;
    while (da < 0.6) da += TAU;
    while (da > 0.6 + TAU) da -= TAU;
    const e = (1 - Math.cos(Math.PI * s)) / 2;
    const rad = r0 + (r1 - r0) * e;
    const ang = a0 + da * s;
    const lift = Math.sin(Math.PI * s) * (1.5 + Math.abs(r1 - r0) * 0.06);
    out.set(Math.cos(ang) * rad, lift + from.y + (to.y - from.y) * s, Math.sin(ang) * rad);
    return out;
  }

  let selected = null;
  function update({ time, dt, timeScale, missionIndex, missionProgress, missionsOn, camPos }) {
    sun.update(time);
    group.getWorldPosition(sunPos);
    for (const b of Object.values(bodies)) {
      if (b.data) {
        b.angle += dt * timeScale * 0.02 * b.data.speed;
        b.holder.position.set(Math.cos(b.angle) * b.data.orbit, 0, Math.sin(b.angle) * b.data.orbit);
        b.mesh.rotation.y += dt * 0.08;
      } else if (b.moon) {
        b.angle += dt * timeScale * 0.02 * b.def.speed;
        const par = bodies[b.def.parent].holder.position;
        b.holder.position.set(par.x + Math.cos(b.angle) * b.def.dist, 0, par.z + Math.sin(b.angle) * b.def.dist);
      } else if (b.orbit) {
        b.angle += dt * timeScale * 0.02 * b.speed;
        b.holder.position.set(Math.cos(b.angle) * b.orbit, 0.2, Math.sin(b.angle) * b.orbit);
      }
    }
    for (const m of allMats) {
      m.uniforms.uSunPos.value.copy(sunPos);
      m.uniforms.uTime.value = time;
    }
    const sat = bodies.saturn;
    if (sat.rings) {
      sat.rings.material.uniforms.uSunPos.value.copy(sunPos);
      sat.holder.getWorldPosition(sat.rings.material.uniforms.uCenter.value);
    }
    for (let i = 0; i < beltN; i++) {
      const d = beltData[i];
      d.a += dt * timeScale * 0.02 * d.s;
      beltPos[i * 3] = Math.cos(d.a) * d.rad;
      beltPos[i * 3 + 1] = d.y;
      beltPos[i * 3 + 2] = Math.sin(d.a) * d.rad;
    }
    beltGeo.attributes.position.needsUpdate = true;

    for (const b of Object.values(bodies)) {
      if (b.line) {
        const on = b.id === selected;
        b.line.material.opacity += ((on ? 0.55 : 0.12) - b.line.material.opacity) * Math.min(1, dt * 6);
        b.line.material.color.set(on ? 0xe3a63b : 0xf1ece2);
      }
    }

    // Mission arcs: earlier missions stay faintly drawn, the current one draws itself in.
    const earth = bodies.earth.holder.position;
    marker.visible = false;
    ringMarker.material.opacity = 0;
    for (const arc of arcs) {
      const i = arc.index;
      let draw = 0, opacity = 0;
      if (missionsOn) {
        if (i < missionIndex) { draw = 1; opacity = 0.28; }
        else if (i === missionIndex) { draw = Math.min(1, missionProgress * 1.6); opacity = 1; }
      }
      arc.mat.opacity += (opacity - arc.mat.opacity) * Math.min(1, dt * 5);
      const target = arc.mission.target;
      if (target === 'earth') {
        if (i === missionIndex && missionsOn) {
          ringMarker.position.copy(earth);
          ringMarker.material.opacity = 0.9;
          ringMarker.rotation.z = time * 0.4;
          marker.visible = true;
          marker.position.set(earth.x + Math.cos(time * 1.2) * 1.55, 0, earth.z + Math.sin(time * 1.2) * 1.55);
        }
        arc.line.visible = false;
        continue;
      }
      const to = bodies[target].holder.position;
      const count = Math.max(2, Math.floor(ARC_N * draw));
      for (let k = 0; k < ARC_N; k++) {
        const s = Math.min(k, count - 1) / (ARC_N - 1);
        arcPoint(earth, to, s * (target === 'moon' ? 1 : 1), a3);
        arc.pos[k * 3] = a3.x;
        arc.pos[k * 3 + 1] = a3.y;
        arc.pos[k * 3 + 2] = a3.z;
      }
      arc.geo.attributes.position.needsUpdate = true;
      arc.geo.setDrawRange(0, count);
      arc.line.visible = arc.mat.opacity > 0.01 && draw > 0;
      if (i === missionIndex && missionsOn && draw > 0) {
        marker.visible = true;
        arcPoint(earth, to, (count - 1) / (ARC_N - 1), tmp);
        marker.position.copy(tmp);
      }
    }
    // keep the ship marker a constant size on screen
    if (camPos) marker.scale.setScalar(Math.max(0.3, camPos.distanceTo(marker.position) * 0.028));
  }

  function select(id) {
    selected = id;
  }

  const pickables = PLANETS.map((p) => bodies[p.id].mesh);

  return { group, bodies, update, worldPos, select, pickables, sun };
}
