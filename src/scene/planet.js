import * as THREE from 'three';
import { noise } from './glsl.js';
import { glowTexture } from './textures.js';

const vert = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vWorld;
void main(){
  vObj = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform vec3 uSunPos;
uniform vec3 uSunDir;
uniform float uUseSunDir;
uniform float uTime;
uniform vec3 uAtmo;
uniform float uAtmoStrength;
uniform float uSeed;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform float uBands;
uniform float uCityLights;
uniform float uExposure;
uniform float uClouds;
uniform float uRim;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vWorld;
${noise}

void main(){
  vec3 p = vObj;
  vec3 N = normalize(vN);
  vec3 L = normalize(mix(uSunPos - vWorld, uSunDir, uUseSunDir));
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, L);
  float lat = p.y;
  vec3 albedo = uColA;
  float spec = 0.0;
  float specPow = 40.0;
  vec3 emissive = vec3(0.0);

#ifdef KIND_EARTH
  vec3 q = p * 1.5 + uSeed;
  vec3 w = vec3(fbm3(q + vec3(0.0, 1.3, 0.0)), fbm3(q + vec3(5.2, 0.0, 1.1)), fbm3(q + vec3(2.1, 4.4, 0.0)));
  float h = fbm(q * 1.2 + w * 0.8);
  float land = smoothstep(0.03, 0.06, h);
  float shelf = smoothstep(-0.08, 0.03, h) * (1.0 - land);
  vec3 ocean = mix(vec3(0.004, 0.02, 0.07), vec3(0.01, 0.07, 0.16), shelf);
  float n2 = fbm3(q * 4.0 + 3.0);
  float arid = smoothstep(0.35, 0.0, abs(abs(lat) - 0.38)) * (0.7 + n2);
  vec3 green = mix(vec3(0.035, 0.07, 0.03), vec3(0.09, 0.11, 0.05), n2 * 0.5 + 0.5);
  vec3 desert = vec3(0.36, 0.26, 0.15);
  vec3 landCol = mix(green, desert, clamp(arid, 0.0, 1.0));
  landCol = mix(landCol, vec3(0.2, 0.18, 0.17), smoothstep(0.28, 0.5, h));
  float ice = smoothstep(0.8, 0.88, abs(lat) + n2 * 0.06);
  albedo = mix(ocean, landCol, land);
  albedo = mix(albedo, vec3(0.8, 0.85, 0.9), ice);
  spec = (1.0 - land) * (1.0 - ice);
  specPow = 60.0;
  // clouds drift slowly over everything
  vec3 cq = p * 2.2 + vec3(uTime * 0.004, 0.0, 0.0) + w * 0.6;
  float cloud = smoothstep(0.05, 0.5, fbm(cq) * 0.9 + 0.12 * snoise(p * 9.0));
  cloud *= uClouds;
  float city = smoothstep(0.66, 0.86, fbm3(p * 55.0 + uSeed) * 0.5 + 0.5) * land * (1.0 - ice) * (1.0 - clamp(arid, 0.0, 1.0) * 0.7);
  emissive = vec3(1.0, 0.6, 0.25) * city * uCityLights * smoothstep(0.02, -0.25, ndl) * (1.0 - cloud * 0.8);
  albedo = mix(albedo, vec3(0.78, 0.8, 0.84), cloud);
  spec *= (1.0 - cloud);
#endif

#ifdef KIND_ROCK
  float c1 = worley(p * 4.0 + uSeed);
  float c2 = worley(p * 11.0 + uSeed * 2.0);
  float n = fbm(p * 3.0 + uSeed);
  albedo = mix(uColA, uColB, n * 0.5 + 0.5);
  albedo *= 0.75 + 0.35 * smoothstep(0.15, 0.32, c1) + 0.25 * smoothstep(0.32, 0.36, c1) * smoothstep(0.42, 0.36, c1);
  albedo *= 0.85 + 0.2 * smoothstep(0.1, 0.3, c2);
  albedo = mix(albedo, uColC, smoothstep(0.35, 0.7, fbm3(p * 1.4 + uSeed + 9.0)) * 0.6);
#endif

#ifdef KIND_VENUS
  vec3 q = p * 2.0 + vec3(uTime * 0.01, 0.0, 0.0);
  float sw = fbm(vec3(q.x * 1.0, q.y * 3.0, q.z) + fbm3(q * 2.0) * 1.2);
  albedo = mix(uColA, uColB, sw * 0.5 + 0.5);
  albedo = mix(albedo, uColC, smoothstep(0.2, 0.6, fbm3(q * 5.0)) * 0.3);
#endif

#ifdef KIND_MARS
  vec3 q = p * 1.8 + uSeed;
  float n = fbm(q + fbm3(q * 2.0) * 0.6);
  albedo = mix(uColA, uColB, smoothstep(-0.2, 0.3, n));
  albedo = mix(albedo, uColC, smoothstep(0.25, 0.55, fbm3(q * 3.0)) * 0.5);
  float c = worley(p * 7.0 + uSeed);
  albedo *= 0.85 + 0.2 * smoothstep(0.2, 0.35, c);
  float cap = smoothstep(0.86, 0.9, abs(lat) + n * 0.05);
  albedo = mix(albedo, vec3(0.9, 0.88, 0.85), cap);
#endif

#ifdef KIND_GAS
  float t = uTime * 0.015;
  vec3 q = vec3(p.x * 2.0, p.y * 10.0, p.z * 2.0);
  float warp = fbm(q + vec3(t, 0.0, -t)) * 0.2;
  float turb = fbm3(vec3(p.x * 5.0, p.y * 30.0, p.z * 5.0) + vec3(t * 2.0, 0.0, 0.0));
  float b = lat * uBands + warp * 5.0 + turb * 0.35;
  float band = sin(b) * 0.5 + 0.5;
  float band2 = sin(b * 2.3 + 1.7) * 0.5 + 0.5;
  albedo = mix(uColA, uColB, band);
  albedo = mix(albedo, uColC, band2 * 0.35 + smoothstep(0.3, 0.8, turb) * 0.2);
  #ifdef SPOT
    float lon = atan(p.z, p.x);
    vec2 sd = vec2((lon - 0.6) * 1.4, (lat + 0.33) * 4.2);
    float sp = 1.0 - smoothstep(0.1, 0.24, length(sd) + turb * 0.05);
    albedo = mix(albedo, vec3(0.62, 0.28, 0.14), sp);
  #endif
  albedo *= 0.92 + 0.12 * snoise(p * 40.0);
  // limb haze
#endif

  float wrap = smoothstep(-0.12, 0.55, ndl);
  float diff = max(ndl, 0.0) * 0.7 + wrap * 0.35;
  vec3 col = albedo * diff * 1.15 + albedo * 0.01;
  vec3 H = normalize(L + V);
  col += spec * pow(max(dot(N, H), 0.0), specPow) * vec3(1.0, 0.86, 0.66) * 0.9 * smoothstep(0.0, 0.1, ndl);
  col += emissive;

  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float lit = smoothstep(-0.3, 0.35, ndl);
  float dusk = smoothstep(0.35, 0.0, ndl) * smoothstep(-0.25, 0.05, ndl);
  vec3 atmoCol = mix(uAtmo, vec3(1.0, 0.42, 0.16), dusk * 0.8);
  col += atmoCol * fres * lit * uAtmoStrength * uRim;
  col += uAtmo * lit * uAtmoStrength * 0.04;

  gl_FragColor = vec4(col * uExposure, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function planetMaterial(kind, o = {}) {
  const defines = { [`KIND_${kind}`]: '' };
  if (o.spot) defines.SPOT = '';
  return new THREE.ShaderMaterial({
    defines,
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uSunPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uUseSunDir: { value: o.useSunDir ? 1 : 0 },
      uTime: { value: 0 },
      uAtmo: { value: new THREE.Color(o.atmo ?? 0x000000) },
      uAtmoStrength: { value: o.atmoStrength ?? 0 },
      uSeed: { value: o.seed ?? 0 },
      uColA: { value: new THREE.Color(o.colA ?? 0x888888) },
      uColB: { value: new THREE.Color(o.colB ?? 0x666666) },
      uColC: { value: new THREE.Color(o.colC ?? 0x444444) },
      uBands: { value: o.bands ?? 12 },
      uCityLights: { value: o.cityLights ?? 1 },
      uExposure: { value: 1 },
      uClouds: { value: o.clouds ?? 0.9 },
      uRim: { value: o.rim ?? 1.4 },
    },
  });
}

// Soft outer atmosphere shell (used for the big Earth).
export function atmosphereShell(radius, color = 0x5fa8ff) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uStrength: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vWN; varying vec3 vV;
      void main(){
        vN = normalize(normalMatrix * normal);
        vWN = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uSunDir; uniform float uStrength;
      varying vec3 vN; varying vec3 vWN; varying vec3 vV;
      void main(){
        float rim = dot(normalize(vN), normalize(vV));
        // back faces: rim is ~0 at the shell's outer edge and grows negative toward the planet
        float i = pow(max(0.0, 0.62 - rim), 7.0);
        float lit = smoothstep(-0.35, 0.4, dot(normalize(vWN), normalize(uSunDir)));
        float dusk = smoothstep(0.35, -0.05, dot(normalize(vWN), normalize(uSunDir)));
        vec3 col = mix(uColor, vec3(1.0, 0.5, 0.25), dusk * 0.7);
        gl_FragColor = vec4(col * i * lit * uStrength * 1.6, 1.0);
      }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
  return mesh;
}

export function createSun(radius = 5) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: vert,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vObj; varying vec3 vN; varying vec3 vWorld;
      ${noise}
      void main(){
        vec3 p = vObj;
        float n = fbm(p * 3.0 + vec3(0.0, uTime * 0.03, uTime * 0.02));
        float g = worley(p * 22.0 + vec3(uTime * 0.05));
        float spots = smoothstep(0.55, 0.7, fbm3(p * 2.0 + 20.0));
        vec3 col = mix(vec3(1.0, 0.38, 0.06), vec3(1.0, 0.82, 0.45), n * 0.5 + 0.5);
        col *= 0.8 + 0.35 * smoothstep(0.1, 0.6, g);
        col *= 1.0 - spots * 0.5;
        vec3 V = normalize(cameraPosition - vWorld);
        float mu = max(dot(normalize(vN), V), 0.0);
        col *= 0.45 + 0.75 * pow(mu, 0.45);
        gl_FragColor = vec4(col * 0.85, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
  group.add(sphere);

  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,235,200,0.9)', 'rgba(255,150,60,0.22)'),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      color: new THREE.Color(1.0, 0.8, 0.6),
    })
  );
  corona.scale.setScalar(radius * 6);
  group.add(corona);
  const haze = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,180,90,0.35)', 'rgba(255,120,40,0.08)'),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
  );
  haze.scale.setScalar(radius * 13);
  haze.material.opacity = 0.55;
  group.add(haze);

  return {
    group,
    sphere,
    update(time) {
      mat.uniforms.uTime.value = time;
      sphere.rotation.y = time * 0.02;
    },
  };
}

export function createRings(inner, outer, planetRadius) {
  const geo = new THREE.RingGeometry(inner, outer, 160, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: inner },
      uOuter: { value: outer },
      uSunPos: { value: new THREE.Vector3() },
      uCenter: { value: new THREE.Vector3() },
      uPlanetR: { value: planetRadius },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal; varying vec3 vWorld;
      void main(){
        vLocal = position;
        vec4 w = modelMatrix * vec4(position,1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uInner; uniform float uOuter; uniform vec3 uSunPos; uniform vec3 uCenter; uniform float uPlanetR;
      varying vec3 vLocal; varying vec3 vWorld;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5453); }
      void main(){
        float r = (length(vLocal.xy) - uInner) / (uOuter - uInner);
        float i = floor(r * 90.0);
        float fine = mix(h(i), h(i + 1.0), fract(r * 90.0));
        float density = 0.35 + 0.65 * fine;
        density *= smoothstep(0.0, 0.06, r) * smoothstep(1.0, 0.9, r);
        density *= 1.0 - 0.9 * smoothstep(0.54, 0.56, r) * smoothstep(0.62, 0.6, r); // Cassini division
        density *= mix(0.55, 1.0, smoothstep(0.1, 0.35, r));
        vec3 col = mix(vec3(0.55, 0.47, 0.36), vec3(0.93, 0.85, 0.7), fine);
        // planet shadow on the rings
        vec3 L = normalize(uSunPos - uCenter);
        vec3 d = vWorld - uCenter;
        float t = dot(d, L);
        float shadow = (t < 0.0 && length(d - t * L) < uPlanetR) ? 0.15 : 1.0;
        gl_FragColor = vec4(col * shadow * 1.1, density * 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
