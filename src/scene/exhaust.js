import * as THREE from 'three';
import { noise } from './glsl.js';

const plumeVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const plumeFrag = /* glsl */ `
uniform float uTime;
uniform float uThrust;
uniform float uExpand;
uniform float uDiamonds;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uTail;
uniform float uGain;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
${noise}
void main(){
  float y = 1.0 - vUv.y; // 0 at the nozzle, 1 at the tail
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(facing, 1.6);
  float n = snoise(vec3(vUv.x * 7.0, y * 5.0 - uTime * 9.0, uTime * 0.7));
  float n2 = snoise(vec3(vUv.x * 18.0, y * 14.0 - uTime * 16.0, 3.0));
  // shock diamonds: standing bright nodes that fade with altitude
  float diamonds = mix(1.0, 0.55 + 0.9 * pow(0.5 + 0.5 * cos(y * 34.0), 6.0), uDiamonds * (1.0 - smoothstep(0.2, 0.7, y)));
  float head = smoothstep(0.0, 0.03, y);
  float tail = 1.0 - smoothstep(0.25, 1.0, y + n * 0.12);
  vec3 col = mix(uCore, uMid, smoothstep(0.0, 0.3, y));
  col = mix(col, uTail, smoothstep(0.25, 0.9, y));
  float a = body * head * tail * diamonds * (0.8 + 0.25 * n + 0.1 * n2);
  gl_FragColor = vec4(col * a * uThrust * uGain, 1.0);
}`;

export function createExhaust() {
  const group = new THREE.Group();

  const makeMat = (gain, core, mid, tail) =>
    new THREE.ShaderMaterial({
      vertexShader: plumeVert,
      fragmentShader: plumeFrag,
      uniforms: {
        uTime: { value: 0 },
        uThrust: { value: 0 },
        uExpand: { value: 0 },
        uDiamonds: { value: 1 },
        uCore: { value: new THREE.Color(...core) },
        uMid: { value: new THREE.Color(...mid) },
        uTail: { value: new THREE.Color(...tail) },
        uGain: { value: gain },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

  // Big combined plume
  const plumeGeo = new THREE.CylinderGeometry(0.55, 1.25, 1, 48, 24, true);
  plumeGeo.translate(0, -0.5, 0);
  const plumeMat = makeMat(1.0, [1.5, 1.3, 1.15], [0.55, 0.42, 1.1], [1.5, 0.5, 0.14]);
  const plume = new THREE.Mesh(plumeGeo, plumeMat);
  plume.renderOrder = 10;
  group.add(plume);

  // Outer diffuse glow
  const haloGeo = new THREE.CylinderGeometry(0.8, 2.2, 1, 48, 12, true);
  haloGeo.translate(0, -0.5, 0);
  const haloMat = makeMat(0.28, [1.2, 0.8, 0.6], [0.7, 0.4, 0.9], [0.9, 0.3, 0.1]);
  haloMat.uniforms.uDiamonds.value = 0;
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.renderOrder = 9;
  group.add(halo);

  // Per-engine hot cores
  const coreGeo = new THREE.CylinderGeometry(0.09, 0.2, 1, 20, 8, true);
  coreGeo.translate(0, -0.5, 0);
  const slMat = makeMat(1.6, [2.2, 2.1, 2.0], [0.9, 0.8, 1.6], [1.4, 0.6, 0.3]);
  const vacMat = makeMat(1.5, [2.2, 2.1, 2.0], [0.9, 0.8, 1.6], [1.4, 0.6, 0.3]);
  const cores = [];
  const slots = [
    ...[0, 1, 2].map((k) => ({ r: 0.3, a: Math.PI / 2 + (k * Math.PI * 2) / 3, y: -0.39, s: 1, mat: slMat })),
    ...[0, 1, 2].map((k) => ({ r: 0.58, a: Math.PI / 6 + (k * Math.PI * 2) / 3, y: -0.79, s: 1.6, mat: vacMat })),
  ];
  for (const s of slots) {
    const m = new THREE.Mesh(coreGeo, s.mat);
    m.position.set(Math.sin(s.a) * s.r, s.y, Math.cos(s.a) * s.r);
    m.userData.baseScale = s.s;
    m.renderOrder = 11;
    group.add(m);
    cores.push(m);
  }

  const light = new THREE.PointLight(0xff8a45, 0, 60, 1.6);
  light.position.set(0, -2.5, 0);
  group.add(light);

  const mats = [plumeMat, haloMat, slMat, vacMat];

  function update({ time, thrust, seaLevel = 1, expand = 0 }) {
    group.visible = thrust > 0.001;
    if (!group.visible) {
      light.intensity = 0;
      return;
    }
    const flicker = 0.9 + 0.1 * Math.sin(time * 61) * Math.sin(time * 37.3);
    for (const m of mats) {
      m.uniforms.uTime.value = time;
      m.uniforms.uExpand.value = expand;
    }
    // in vacuum the plume spreads wide and turns nearly transparent
    plumeMat.uniforms.uThrust.value = thrust * flicker * (1 - expand * 0.55);
    haloMat.uniforms.uThrust.value = thrust * flicker * (1 - expand * 0.9);
    slMat.uniforms.uThrust.value = thrust * seaLevel * flicker;
    vacMat.uniforms.uThrust.value = thrust * flicker;
    plumeMat.uniforms.uDiamonds.value = 1 - expand;
    slMat.uniforms.uDiamonds.value = 1 - expand;

    // Plumes lengthen and balloon in thinning air.
    const len = (5.5 + 5 * expand) * (0.55 + 0.45 * thrust);
    plume.scale.set(1 + expand * 2.4, len, 1 + expand * 2.4);
    halo.scale.set(1 + expand * 3.4, len * 1.25, 1 + expand * 3.4);
    for (const c of cores) {
      const s = c.userData.baseScale;
      c.scale.set(1 + expand * 0.8, (1.4 + expand * 2) * s * thrust, 1 + expand * 0.8);
    }
    light.intensity = thrust * 40 * flicker;
  }

  return { group, update, light };
}
