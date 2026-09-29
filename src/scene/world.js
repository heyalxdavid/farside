import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createShip } from './ship.js';
import { createSky, createStars, createBlueprintGrid } from './sky.js';
import { planetMaterial, atmosphereShell } from './planet.js';
import { createLaunchSite } from './launchpad.js';
import { createOrrery } from './orrery.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFade: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.55 },
    uCA: { value: 0.0035 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uFade, uGrain, uVignette, uCA; uniform vec2 uRes; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float d = dot(c, c);
      vec2 off = c * d * uCA * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      col *= 1.0 - uVignette * smoothstep(0.08, 0.6, d);
      float g = hash(floor(vUv * uRes) + fract(uTime) * 91.0);
      col += (g - 0.5) * uGrain;
      col *= uTint;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

function makeEnvironment(renderer) {
  // A small studio-in-space: dark dome, earthshine below, a hard sun, two soft panels.
  const envScene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `varying vec3 vD; void main(){
        float y = vD.y;
        vec3 top = vec3(0.02, 0.025, 0.04);
        vec3 hor = vec3(0.22, 0.24, 0.3);
        vec3 bot = vec3(0.08, 0.16, 0.3);
        vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.5)) : mix(hor, bot, pow(-y, 0.6));
        gl_FragColor = vec4(c, 1.0);
      }`,
    })
  );
  envScene.add(dome);
  const panel = (w, h, pos, intensity, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  panel(8, 30, new THREE.Vector3(30, 5, -25), 3.2, 0xfff1dc); // sun side strip
  panel(10, 26, new THREE.Vector3(-32, 0, 16), 1.6, 0xcfe0ff);
  panel(40, 6, new THREE.Vector3(0, 32, 0), 1.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.035).texture;
  pmrem.dispose();
  return env;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  scene.fog = new THREE.Fog(0x000000, 1e5, 2e5);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 3000);

  // ---- Sky, stars, grid ----
  const sky = createSky();
  scene.add(sky.mesh);
  const stars = createStars();
  scene.add(stars.points);
  const grid = createBlueprintGrid();
  scene.add(grid.mesh);

  // ---- Ship world ----
  const shipWorld = new THREE.Group();
  scene.add(shipWorld);
  const ship = createShip();
  shipWorld.add(ship.root);

  const sunDir = new THREE.Vector3(1.0, 0.32, -0.55).normalize();
  const sunLight = new THREE.DirectionalLight(0xfff0dd, 3);
  sunLight.position.copy(sunDir).multiplyScalar(50);
  shipWorld.add(sunLight);
  const rimLight = new THREE.DirectionalLight(0x9fb8ff, 0.8);
  rimLight.position.set(-30, 10, -20);
  shipWorld.add(rimLight);
  const hemi = new THREE.HemisphereLight(0x8fb0ff, 0x101828, 0.2);
  shipWorld.add(hemi);

  const earthGroup = new THREE.Group();
  shipWorld.add(earthGroup);
  const earthMat = planetMaterial('EARTH', { useSunDir: true, atmo: 0x6fb3ff, atmoStrength: 0.8, seed: 2.7, cityLights: 1.0, clouds: 0.72, rim: 0.45 });
  earthMat.uniforms.uSunDir.value.copy(sunDir);
  const EARTH_R = 40;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 160, 120), earthMat);
  earth.rotation.set(1.25, 2.2, 0.15); // tip the pole away so temperate latitudes face the camera
  earthGroup.add(earth);
  const earthAtmo = atmosphereShell(EARTH_R * 1.045, 0x5fa0ff);
  earthAtmo.material.uniforms.uSunDir.value.copy(sunDir);
  earthGroup.add(earthAtmo);

  const moonMat = planetMaterial('ROCK', { useSunDir: true, colA: 0x9a9690, colB: 0x6e6a66, colC: 0x5c5a58, seed: 5 });
  moonMat.uniforms.uSunDir.value.copy(sunDir);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 48), moonMat);
  moon.position.set(-150, 30, -380);
  shipWorld.add(moon);

  const site = createLaunchSite();
  shipWorld.add(site.env);
  shipWorld.add(site.streaks);

  // ---- Solar system ----
  const orrery = createOrrery();
  scene.add(orrery.group);

  // ---- Post ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finalPass = new ShaderPass(FinalShader);
  composer.addPass(finalPass);

  let pixelRatio = 1;
  let quality = 1; // lowered at runtime if the GPU can't keep up
  let size = [1, 1];
  function setQuality(q) {
    quality = q;
    resize(...size);
  }
  function resize(w, h) {
    size = [w, h];
    pixelRatio = Math.min(window.devicePixelRatio || 1, w < 800 ? 1.5 : 1.75) * quality;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    finalPass.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
    stars.uniforms.uPixel.value = pixelRatio;
  }

  const fogColor = new THREE.Color();
  const dawn = new THREE.Color(0xff9a5c);
  const white = new THREE.Color(0xfff0dd);
  const studio = new THREE.Color(0xe8f0ff);

  function update(s, time, dt) {
    const orreryOn = s.orrery > 0.5;
    shipWorld.visible = !orreryOn;
    orrery.group.visible = orreryOn;

    // Sky
    sky.uniforms.uTime.value = time;
    sky.uniforms.uBlue.value = s.blue;
    sky.uniforms.uAtmo.value = orreryOn ? 0 : s.atmo;
    sky.uniforms.uAlt.value = s.skyAlt;
    sky.uniforms.uSunGlow.value = orreryOn ? 0 : s.sunGlow;
    sky.uniforms.uGalaxy.value = 1;
    const atmoHide = s.atmo * (1 - s.skyAlt);
    stars.uniforms.uTime.value = time;
    stars.uniforms.uOpacity.value = (1 - s.blue) * (1 - atmoHide);
    grid.uniforms.uOpacity.value = orreryOn ? 0 : s.blue;
    grid.mesh.visible = s.blue > 0.01 && !orreryOn;

    if (!orreryOn) {
      // Ship pose
      const bob = Math.sin(time * 0.6) * 0.18 * s.spin;
      ship.root.position.set(0, bob, 0);
      ship.root.rotation.set(0, Math.sin(time * 0.12) * 0.5 * s.spin, s.tilt);
      const shake = s.shake;
      if (shake > 0) {
        ship.root.position.x += (Math.random() - 0.5) * shake * 0.12;
        ship.root.position.y += (Math.random() - 0.5) * shake * 0.12;
      }
      ship.update({
        time,
        explode: s.explode,
        build: s.build,
        thrust: s.thrust,
        seaLevel: s.seaLevel,
        expand: s.expand,
        ghostOpacity: s.ghost,
      });

      // Earth
      earthGroup.visible = s.earth > 0.01;
      earthGroup.position.set(s.ex, s.ey - (1 - s.earth) * 150, s.ez);
      earth.rotation.y = 2.2 + time * 0.004;
      earthMat.uniforms.uTime.value = time;
      moon.visible = s.earth > 0.3 && s.blue < 0.5;

      // Lights by mood: space, blueprint studio, dawn
      const space = (1 - s.blue) * (1 - s.atmo * (1 - s.skyAlt));
      sunLight.intensity = 2.4 * space + 1.3 * s.blue + 1.5 * s.atmo * (1 - s.skyAlt);
      sunLight.color.copy(white).lerp(studio, s.blue).lerp(dawn, s.atmo * (1 - s.skyAlt) * 0.8);
      hemi.intensity = 0.12 + s.blue * 1.1 + s.atmo * (1 - s.skyAlt) * 0.6;
      rimLight.intensity = 0.8 + s.blue * 0.8;
      scene.environmentIntensity = 0.55 + s.blue * 0.35;

      // Launch site
      fogColor.setRGB(0.55, 0.36, 0.3).lerp(new THREE.Color(0.04, 0.06, 0.12), s.skyAlt);
      scene.fog.color.copy(fogColor);
      const padOn = s.pad > 0.5;
      scene.fog.near = padOn ? 60 : 1e5;
      scene.fog.far = padOn ? 420 : 2e5;
      site.update({ time, dt, drop: s.drop, thrust: s.thrust, streak: s.streak, visible: padOn, fogColor });
    } else {
      orrery.update({
        time,
        dt,
        timeScale: s.timeScale,
        missionIndex: s.missionIndex,
        missionProgress: s.missionProgress,
        missionsOn: s.missionsOn,
        camPos: camera.position,
      });
      scene.fog.near = 1e5;
      scene.fog.far = 2e5;
    }

    finalPass.uniforms.uTime.value = time;
    finalPass.uniforms.uFade.value = s.fade;
    bloom.strength = 0.42 + s.thrust * 0.12 + (orreryOn ? 0.15 : 0);
    renderer.toneMappingExposure = 1.0 + s.blue * 0.15;
    composer.render(dt);
  }

  // Compile every shader up front so no chapter stalls the first time it appears.
  async function precompile() {
    const toggles = [shipWorld, orrery.group, site.env, site.streaks, grid.mesh, earthGroup, ship.exhaust.group];
    const prev = toggles.map((o) => o.visible);
    toggles.forEach((o) => (o.visible = true));
    try {
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch (e) {
      console.warn(e);
    }
    toggles.forEach((o, i) => (o.visible = prev[i]));
  }

  return { renderer, scene, camera, ship, orrery, earthGroup, resize, setQuality, get quality() { return quality; }, update, precompile, sunDir, debug: { composer, bloom, finalPass, sky, stars } };
}
