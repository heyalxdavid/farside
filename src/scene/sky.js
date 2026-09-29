import * as THREE from 'three';
import { noise } from './glsl.js';
import { rng } from './textures.js';

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBlue: { value: 0 },
      uAtmo: { value: 0 },
      uAlt: { value: 0 },
      uGalaxy: { value: 1 },
      uSunDir: { value: new THREE.Vector3(1, 0.3, -0.6).normalize() },
      uSunGlow: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBlue, uAtmo, uAlt, uGalaxy, uSunGlow;
      uniform vec3 uSunDir;
      varying vec3 vDir;
      ${noise}
      void main(){
        vec3 d = normalize(vDir);

        // ---- deep space with a Milky Way band ----
        vec3 space = mix(vec3(0.0025, 0.0035, 0.009), vec3(0.006, 0.008, 0.02), smoothstep(-1.0, 1.0, d.y));
        vec3 gn = normalize(vec3(0.35, 1.0, 0.25));
        float b = dot(d, gn);
        float band = exp(-b * b * 14.0);
        float core = exp(-b * b * 60.0) * smoothstep(-0.2, 1.0, dot(d, normalize(vec3(-0.8, 0.1, -0.6))));
        float neb = fbm(d * 3.2) * 0.5 + 0.5;
        float dust = smoothstep(0.1, 0.6, fbm(d * 6.5 + 4.0) * 0.5 + 0.5);
        vec3 milky = vec3(0.16, 0.15, 0.22) * band * neb + vec3(0.34, 0.24, 0.16) * core * neb;
        milky *= 1.0 - dust * 0.75 * band;
        milky += vec3(0.08, 0.05, 0.12) * smoothstep(0.55, 0.9, fbm3(d * 2.0 + 11.0)) * band;
        space += milky * 0.55 * uGalaxy;
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        space += vec3(1.0, 0.75, 0.5) * pow(sd, 400.0) * 12.0 * uSunGlow;
        space += vec3(1.0, 0.6, 0.35) * pow(sd, 12.0) * 0.06 * uSunGlow;

        // ---- dawn atmosphere that thins with altitude ----
        float hy = d.y + uAlt * 0.35; // the horizon drops as we climb
        vec3 zenith = mix(vec3(0.05, 0.12, 0.3), vec3(0.004, 0.008, 0.03), smoothstep(0.0, 0.7, uAlt));
        vec3 horizon = mix(vec3(1.0, 0.52, 0.26), vec3(0.18, 0.32, 0.7), smoothstep(0.2, 0.9, uAlt));
        vec3 sunward = normalize(vec3(-0.5, 0.0, -1.0));
        float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z)), sunward), 0.0);
        horizon = mix(horizon * vec3(0.55, 0.6, 0.9), horizon, pow(toSun, 2.0));
        vec3 sky = mix(horizon, zenith, pow(smoothstep(-0.02, 0.55, hy), 0.7));
        sky += vec3(1.0, 0.6, 0.3) * pow(toSun, 8.0) * exp(-abs(hy) * 18.0) * 0.8 * (1.0 - uAlt);
        vec3 ground = mix(vec3(0.03, 0.035, 0.05), vec3(0.01, 0.02, 0.06), uAlt);
        sky = mix(ground, sky, smoothstep(-0.03, 0.005, hy));
        float atmoMix = uAtmo;
        vec3 col = mix(space, sky, atmoMix * (1.0 - smoothstep(0.55, 1.0, uAlt) * smoothstep(0.0, 0.4, d.y)));

        // ---- cyanotype drafting paper ----
        float grain = snoise(d * 220.0) * 0.5 + 0.5;
        float mottled = fbm3(d * 3.0) * 0.5 + 0.5;
        vec3 paper = mix(vec3(0.028, 0.075, 0.19), vec3(0.05, 0.12, 0.27), mottled);
        paper *= 0.94 + 0.08 * grain;
        col = mix(col, paper, uBlue);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms: mat.uniforms };
}

export function createStars(count = 7000) {
  const r = rng(42);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const gn = new THREE.Vector3(0.35, 1.0, 0.25).normalize();
  const v = new THREE.Vector3();
  const palette = [
    [0.7, 0.8, 1.0],
    [1.0, 1.0, 1.0],
    [1.0, 0.92, 0.8],
    [1.0, 0.8, 0.6],
  ];
  for (let i = 0; i < count; i++) {
    // bias a portion of the stars toward the galactic band
    let tries = 0;
    do {
      v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      tries++;
    } while ((v.lengthSq() > 1 || v.lengthSq() < 0.01 || (i % 3 === 0 && Math.abs(v.clone().normalize().dot(gn)) > 0.25)) && tries < 50);
    v.normalize().multiplyScalar(700 + r() * 200);
    pos.set([v.x, v.y, v.z], i * 3);
    const c = palette[Math.floor(Math.pow(r(), 0.8) * palette.length)];
    const b = 0.5 + r() * 0.5;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = Math.pow(r(), 6) * 5 + 0.8;
    phase[i] = r() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float phase; attribute vec3 color;
      uniform float uTime; uniform float uPixel;
      varying vec3 vColor; varying float vTw;
      void main(){
        vColor = color;
        vTw = 0.75 + 0.25 * sin(uTime * (0.6 + fract(phase) * 2.0) + phase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixel;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor; varying float vTw;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        gl_FragColor = vec4(vColor * a * vTw * uOpacity * 1.6, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -5;
  return { points, uniforms: mat.uniforms };
}

// Drafting grid under the ship in blueprint mode.
export function createBlueprintGrid() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vW;
      float line(float x, float w){ float f = abs(fract(x - 0.5) - 0.5) / fwidth(x); return 1.0 - min(f / w, 1.0); }
      void main(){
        vec2 p = vW.xz;
        float minor = max(line(p.x * 2.0, 1.0), line(p.y * 2.0, 1.0)) * 0.22;
        float major = max(line(p.x * 0.5, 1.2), line(p.y * 0.5, 1.2)) * 0.55;
        float r = length(p);
        float rings = line(r * 0.25, 1.2) * 0.5 * step(r, 24.5);
        float axis = max(1.0 - smoothstep(0.0, fwidth(p.x) * 1.5, abs(p.x)), 1.0 - smoothstep(0.0, fwidth(p.y) * 1.5, abs(p.y))) * 0.7;
        float a = max(max(minor, major), max(rings, axis));
        a *= smoothstep(38.0, 8.0, r);
        gl_FragColor = vec4(vec3(0.86, 0.92, 1.0) * a * uOpacity, a * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -8.5;
  return { mesh, uniforms: mat.uniforms };
}
