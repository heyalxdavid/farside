import './style.css';
import * as THREE from 'three';
import Lenis from 'lenis';
import gsap from 'gsap';
import { createWorld } from './scene/world.js';
import { createDirector } from './director.js';
import { createAudio } from './audio.js';
import { PLANETS, MISSIONS } from './data.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

const loader = $('#loader');
const loaderBar = $('#loaderBar');
loaderBar.style.width = '25%';

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
let world = null;
try {
  world = createWorld($('#gl'));
} catch (err) {
  console.error(err);
  document.body.classList.add('no-webgl');
}
loaderBar.style.width = '60%';

const director = createDirector();
const audio = createAudio();

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const SECTION_IDS = ['hero', 'build', 'launch', 'system', 'missions', 'join'];
const sections = {};
let vh = window.innerHeight;
let maxScroll = 1;

function measure() {
  vh = window.innerHeight;
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    const sticky = el.classList.contains('chapter');
    sections[id] = { el, start: el.offsetTop, span: sticky ? Math.max(1, el.offsetHeight - vh) : vh, vh };
  }
  maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  director.layout(sections, vh);
}

function resize() {
  world?.resize(window.innerWidth, window.innerHeight);
  measure();
}

// ---------------------------------------------------------------------------
// Smooth scroll + chapter links
// ---------------------------------------------------------------------------
const lenis = reduced ? null : new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, touchMultiplier: 1.3 });
const getScroll = () => (lenis ? lenis.scroll : window.scrollY);

const GOTO = {
  hero: () => 0,
  build: () => sections.build.start + sections.build.span * 0.09,
  launch: () => sections.launch.start,
  system: () => sections.system.start + sections.system.span * 0.45,
  missions: () => sections.missions.start + sections.missions.span * 0.02,
  join: () => maxScroll,
};
function goTo(id) {
  const y = GOTO[id]();
  if (lenis) lenis.scrollTo(y, { duration: Math.min(4, 1.2 + Math.abs(y - getScroll()) / vh / 6), easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: y, behavior: 'auto' });
}
for (const a of $$('[data-goto]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(a.dataset.goto);
  });
}

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------
const soundBtn = $('#sound');
soundBtn.addEventListener('click', () => {
  const on = audio.toggle();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.querySelector('.sound-label').textContent = on ? 'Sound on' : 'Sound off';
});

// ---------------------------------------------------------------------------
// Solar system UI
// ---------------------------------------------------------------------------
const planetList = $('#planetList');
const card = $('#planetCard');
const labelsEl = $('#labels');
document.body.appendChild(labelsEl); // labels float over every chapter that shows the orrery
labelsEl.classList.add('labels-fixed');
const swatch = { earth: '#3f7fc4' };
const labelEls = {};
for (const p of PLANETS) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.id = p.id;
  b.setAttribute('aria-pressed', 'false');
  b.style.setProperty('--c', swatch[p.id] ?? `#${p.colA.toString(16).padStart(6, '0')}`);
  b.innerHTML = `<i></i>${p.name}`;
  b.addEventListener('click', () => select(selected === p.id ? null : p.id));
  li.appendChild(b);
  planetList.appendChild(li);

  const l = document.createElement('button');
  l.type = 'button';
  l.className = 'p-label';
  l.textContent = p.name;
  l.tabIndex = -1;
  l.setAttribute('aria-hidden', 'true');
  l.addEventListener('click', () => select(p.id));
  labelsEl.appendChild(l);
  labelEls[p.id] = l;
}

let selected = null;
const focus = { amt: 0 };
function select(id) {
  if (id === selected) return;
  selected = id;
  world?.orrery.select(id);
  for (const b of planetList.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
  for (const [pid, l] of Object.entries(labelEls)) l.classList.toggle('on', pid === id);
  sections.system.el.classList.toggle('has-focus', !!id);
  if (id) {
    const p = PLANETS.find((q) => q.id === id);
    $('#pcName').textContent = p.name;
    $('#pcNote').textContent = p.note;
    $('#pcAu').textContent = p.au;
    $('#pcDay').textContent = p.day;
    $('#pcGravity').textContent = p.gravity;
    $('#pcMoons').textContent = p.moons;
    $('#pcTemp').textContent = p.temp;
    $('#pcTransit').textContent = p.transit;
    card.hidden = false;
    card.classList.remove('enter');
    void card.offsetWidth;
    card.classList.add('enter');
    audio.blip(660 + PLANETS.indexOf(p) * 60);
  } else {
    card.hidden = true;
  }
  gsap.to(focus, { amt: id ? 1 : 0, duration: reduced ? 0 : 2.2, ease: 'power3.inOut', overwrite: true });
}
$('#pcClose').addEventListener('click', () => select(null));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selected) select(null);
});

// ---------------------------------------------------------------------------
// Missions UI
// ---------------------------------------------------------------------------
const stage = $('#missionStage');
const years = $('#missionYears');
const missionEls = MISSIONS.map((m) => {
  const el = document.createElement('article');
  el.className = 'mission';
  el.innerHTML = `<p class="mission-year">${m.year}</p><h3>${m.name}</h3><p>${m.text}</p><p class="status">${m.status}</p>`;
  stage.appendChild(el);
  const y = document.createElement('li');
  y.textContent = m.year;
  years.appendChild(y);
  return { el, y };
});

// ---------------------------------------------------------------------------
// Pointer: parallax and planet picking
// ---------------------------------------------------------------------------
const pointer = { x: 0, y: 0, sx: 0, sy: 0, ndc: new THREE.Vector2(), moved: false };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  pointer.ndc.set(pointer.x, pointer.y);
  pointer.moved = true;
});
const raycaster = new THREE.Raycaster();
let hovered = null;
let pickEnabled = false;
window.addEventListener('click', (e) => {
  if (!pickEnabled || e.target.closest('button, a, .panel, .planet-card')) return;
  if (hovered) select(hovered);
});

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
const cam = world?.camera;
const tgt = new THREE.Vector3();
const pos = new THREE.Vector3();
const right = new THREE.Vector3();
const pPos = new THREE.Vector3();
const fPos = new THREE.Vector3();
const fTgt = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const intro = { k: reduced ? 1 : 1.9, fade: 1, done: reduced };

const mission = { tgt: new THREE.Vector3(), dist: 120, w: 0, init: false };
function applyCamera(s, dt) {
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 0.85;
  const orrery = s.orrery > 0.5;
  let dist = s.dist * (portrait ? (orrery ? 2.1 : 1.3) : 1) * intro.k;
  const lateral = portrait ? 0 : s.lateral;

  tgt.set(s.tx, s.ty, s.tz);
  if (orrery && s.focusEarth > 0) {
    world.orrery.worldPos('earth', pPos);
    tgt.lerp(pPos, s.focusEarth);
  }
  // Missions: frame Earth and the current destination together, easing between missions.
  mission.w += ((orrery && s.missionsOn ? 1 : 0) - mission.w) * Math.min(1, dt * 1.6);
  if (mission.w > 0.001) {
    const m = MISSIONS[s.missionIndex];
    world.orrery.worldPos('earth', pPos);
    world.orrery.worldPos(m.target, fTgt);
    const sep = pPos.distanceTo(fTgt);
    fTgt.add(pPos).multiplyScalar(0.5);
    const wantDist = clamp(sep * 1.7 + 9, 14, 160);
    if (!mission.init) {
      mission.tgt.copy(tgt);
      mission.dist = dist;
      mission.init = true;
    }
    const k = Math.min(1, dt * 1.4);
    mission.tgt.lerp(fTgt, k);
    mission.dist += (wantDist * (portrait ? 1.8 : 1) - mission.dist) * k;
    const w = mission.w * mission.w * (3 - 2 * mission.w);
    tgt.lerp(mission.tgt, w);
    dist += (mission.dist - dist) * w;
  } else mission.init = false;
  const az = s.az + pointer.sx * 0.06;
  const el = s.el + pointer.sy * 0.035;
  pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(tgt);
  const hw = dist * Math.tan(THREE.MathUtils.degToRad(s.fov / 2)) * cam.aspect;
  right.set(Math.cos(az), 0, -Math.sin(az)).multiplyScalar(-lateral * hw);
  pos.add(right);
  tgt.add(right);

  // Planet focus: fly to the selected world, lit side toward us.
  const e = focus.amt * focus.amt * (3 - 2 * focus.amt);
  if (orrery && selected && e > 0.0005) {
    const b = world.orrery.bodies[selected];
    world.orrery.worldPos(selected, pPos);
    const R = b.radius * (b.data?.rings ? 2.1 : 1);
    const fd = (R * 4.4 + 1.4) * (portrait ? 1.7 : 1);
    const toSun = tmpV.copy(pPos).negate().normalize();
    const side = new THREE.Vector3(-toSun.z, 0, toSun.x);
    fPos.copy(toSun).multiplyScalar(0.6).add(side.multiplyScalar(0.75)).add(up.clone().multiplyScalar(0.28)).normalize().multiplyScalar(fd).add(pPos);
    fTgt.copy(pPos);
    if (!portrait) {
      // leave room for the card on the right
      const dir = tmpV.subVectors(fTgt, fPos).normalize();
      const r2 = new THREE.Vector3().crossVectors(dir, up).normalize();
      const fhw = fd * Math.tan(THREE.MathUtils.degToRad(s.fov / 2)) * cam.aspect;
      r2.multiplyScalar(0.18 * fhw);
      fPos.add(r2);
      fTgt.add(r2);
    } else {
      // card sits at the top on phones: drop the planet into the lower half
      fTgt.y += fd * 0.1;
    }
    pos.lerp(fPos, e);
    tgt.lerp(fTgt, e);
  }

  if (s.shake > 0 && !reduced) {
    pos.x += (Math.random() - 0.5) * s.shake * 0.08;
    pos.y += (Math.random() - 0.5) * s.shake * 0.08;
  }
  cam.position.copy(pos);
  cam.lookAt(tgt);
  if (Math.abs(cam.fov - s.fov) > 0.01) {
    cam.fov = s.fov;
    cam.updateProjectionMatrix();
  }
}

// DOM refs for per-frame UI
const steps = $$('.steps li');
const specs = $('#specs');
const callout = $('#callout');
const calloutText = $('#calloutText');
const dimLabel = $('#dimLabel');
const events = $$('#events li');
const tClock = $('#tClock');
const tAlt = $('#tAlt');
const tVel = $('#tVel');
const tThrust = $('#tThrust');
const railFill = $('#railFill');
const railItems = $$('.rail li');
const rail = $('.rail');
const navLinks = $$('.nav nav a');
const wordmark = $('.wm-letters');
const heroInner = $('.hero-inner');
const PARTS = ['engines', 'lox', 'shield', 'nose'];
const CALLOUTS = ['6 engines, 1,650 t of thrust', 'Methane 300 t, oxygen 900 t', '18,000 tiles, rated to 1,400 °C', 'Crew deck, 12 berths'];

const last = {};
const setOnce = (key, value, fn) => {
  if (last[key] !== value) {
    last[key] = value;
    fn(value);
  }
};
const pad2 = (n) => String(n).padStart(2, '0');
const fmtClock = (T) => {
  if (T < 0) return `T−0:${pad2(Math.ceil(-T))}`;
  const t = Math.floor(T);
  return `T+${Math.floor(t / 60)}:${pad2(t % 60)}`;
};
const nf = new Intl.NumberFormat('en-US');

function project(v) {
  tmpV.copy(v).project(cam);
  return { x: (tmpV.x * 0.5 + 0.5) * window.innerWidth, y: (-tmpV.y * 0.5 + 0.5) * window.innerHeight, behind: tmpV.z > 1 };
}

function updateUI(s, x) {
  // Chapter rail and nav
  const chapter = SECTION_IDS.reduce((acc, id) => (x >= sections[id].start - vh * 0.5 ? id : acc), 'hero');
  setOnce('chapter', chapter, (c) => {
    railItems.forEach((li) => li.classList.toggle('on', li.dataset.ch === c));
    navLinks.forEach((a) => a.setAttribute('aria-current', String(a.dataset.goto === c)));
  });
  railFill.style.height = `${(x / maxScroll) * 100}%`;
  setOnce('rail', x > vh * 0.6, (v) => rail.classList.toggle('show', v));

  // Hero wordmark squeezes as you leave orbit
  if (intro.done) {
    const hp = clamp(x / (vh * 0.8));
    wordmark.style.fontVariationSettings = `'wdth' ${150 - hp * 90}`;
    heroInner.style.opacity = String(1 - hp * 1.1);
    heroInner.style.transform = `translate3d(0, ${-hp * 40}px, 0)`;
  }

  // Build steps
  const b = s.buildRaw;
  const step = b < 0.1 || b > 1.05 ? -1 : Math.min(3, Math.floor((b - 0.1) / 0.2));
  setOnce('step', step + (b > 0.9 ? 10 : 0), () => {
    steps.forEach((li, i) => {
      li.classList.toggle('on', i === step && b <= 0.9);
      li.classList.toggle('done', i < step || b > 0.9);
    });
  });
  setOnce('specs', b > 0.9 && b < 1.1, (v) => specs.classList.toggle('show', v));
  const inBuild = b > -0.2 && b < 1.1;
  if (world && inBuild && step >= 0 && b < 0.92) {
    const a = project(world.ship.anchorOf(PARTS[step]));
    callout.style.transform = `translate3d(${a.x}px, ${a.y}px, 0)`;
    setOnce('flip', a.x + 90 + calloutText.offsetWidth > window.innerWidth - 12, (v) => callout.classList.toggle('flip', v));
    setOnce('calloutText', step, (i) => (calloutText.textContent = CALLOUTS[i]));
    setOnce('callout', true, () => callout.classList.add('show'));
  } else setOnce('callout', false, () => callout.classList.remove('show'));
  if (world && inBuild && s.ghost > 0.2 && s.blue > 0.8) {
    const d = project(world.ship.dimensionAnchor());
    dimLabel.style.transform = `translate3d(${d.x + 10}px, ${d.y - 8}px, 0)`;
    setOnce('dim', true, () => dimLabel.classList.add('show'));
  } else setOnce('dim', false, () => dimLabel.classList.remove('show'));

  // Launch telemetry
  if (s.launchP > 0 || x > sections.launch.start - vh) {
    setOnce('clock', fmtClock(s.T), (v) => (tClock.textContent = v));
    setOnce('alt', s.altKm.toFixed(s.altKm < 100 ? 1 : 0), (v) => (tAlt.textContent = v));
    setOnce('vel', nf.format(Math.round(s.velKmh / 10) * 10), (v) => (tVel.textContent = v));
    tThrust.style.width = `${s.thrust * (s.seaLevel * 0.35 + 0.65) * 100}%`;
    setOnce('event', s.launchEvent, (ev) => {
      events.forEach((li, i) => {
        li.classList.toggle('past', i < ev);
        li.classList.toggle('now', i === ev || (ev < 0 && i === 0));
      });
    });
  }

  // Solar system labels
  const orreryOn = s.orrery > 0.5;
  const inSystem = orreryOn && x < sections.missions.start - vh * 0.4;
  pickEnabled = inSystem && s.systemP > 0.2;
  if (!inSystem && selected) select(null);
  setOnce('labels', orreryOn ? (inSystem ? 'sys' : 'mis') : 'off', (m) => {
    labelsEl.style.opacity = m === 'sys' ? (s.systemP > 0.2 ? 1 : 0) : m === 'mis' ? 0.55 : 0;
    labelsEl.style.visibility = m === 'off' ? 'hidden' : 'visible';
    labelsEl.classList.toggle('passive', m !== 'sys');
  });
  if (orreryOn) {
    labelsEl.style.opacity = inSystem ? String(clamp((s.systemP - 0.15) * 6)) : '0.55';
    for (const p of PLANETS) {
      const bdy = world.orrery.bodies[p.id];
      world.orrery.worldPos(p.id, pPos);
      pPos.y += bdy.radius * (p.rings ? 1.6 : 1.25);
      const a = project(pPos);
      const l = labelEls[p.id];
      const hideForFocus = selected && focus.amt > 0.4;
      l.style.transform = `translate3d(${a.x}px, ${a.y}px, 0) translate(-50%, -100%)`;
      l.style.opacity = a.behind || hideForFocus ? '0' : '1';
    }
  }

  // Missions
  if (s.missionsOn) {
    setOnce('mission', s.missionIndex, (mi) => {
      missionEls.forEach((m, i) => {
        m.el.classList.toggle('on', i === mi);
        m.y.classList.toggle('past', i < mi);
        m.y.classList.toggle('on', i === mi);
        m.y.style.setProperty('--fill', i < mi ? 1 : 0);
      });
    });
    missionEls[s.missionIndex].y.style.setProperty('--fill', s.missionProgress.toFixed(3));
  }
}

let lastT = performance.now();
let time = 0;
let raf = 0;
// Adaptive resolution: watch the frame time and step the render scale down if we fall behind.
const perf = { acc: 0, n: 0, cooldown: 3 };
function adapt(dt) {
  if (!world) return;
  perf.cooldown -= dt;
  perf.acc += dt;
  perf.n++;
  if (perf.acc < 2) return;
  const avg = perf.acc / perf.n;
  perf.acc = 0;
  perf.n = 0;
  if (perf.cooldown > 0) return;
  if (avg > 1 / 42 && world.quality > 0.55) {
    world.setQuality(Math.max(0.55, world.quality - 0.15));
    perf.cooldown = 3;
  }
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  lenis?.raf(now);
  adapt(dt);

  const x = getScroll();
  const s = director.evaluate(x);
  s.fade = Math.max(s.fade, intro.fade);
  s.timeScale *= 1 - 0.9 * focus.amt;

  pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2.5);
  pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2.5);
  if (reduced) {
    s.shake = 0;
    s.spin *= 0.2;
  }

  if (world) {
    applyCamera(s, dt);
    world.update(s, time, dt);

    // hover planets
    if (pickEnabled) {
      raycaster.setFromCamera(pointer.ndc, cam);
      const hit = raycaster.intersectObjects(world.orrery.pickables, false)[0];
      const id = hit ? hit.object.userData.id : null;
      if (id !== hovered) {
        hovered = id;
        document.body.style.cursor = id ? 'pointer' : '';
        for (const [pid, l] of Object.entries(labelEls)) l.classList.toggle('on', pid === id || pid === selected);
      }
    } else if (hovered) {
      hovered = null;
      document.body.style.cursor = '';
    }
    updateUI(s, x);
  }
  audio.update(s.thrust, s.skyAlt);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  resize();
  window.addEventListener('resize', resize);
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  measure();
  if (world) {
    await world.precompile();
  }
  loaderBar.style.width = '100%';
  raf = requestAnimationFrame(frame);
  await new Promise((r) => setTimeout(r, 350));
  loader.classList.add('done');

  if (reduced) {
    intro.fade = 0;
    return;
  }
  // The one orchestrated moment: the ship drifts in from the dark while the name stretches out.
  const tl = gsap.timeline({ onComplete: () => (intro.done = true) });
  tl.to(intro, { fade: 0, duration: 2.2, ease: 'power2.out' }, 0)
    .to(intro, { k: 1, duration: 4.2, ease: 'expo.out' }, 0)
    .fromTo(wordmark, { fontVariationSettings: "'wdth' 50", opacity: 0, x: -30 }, { fontVariationSettings: "'wdth' 150", opacity: 1, x: 0, duration: 2.6, ease: 'expo.out' }, 0.4)
    .from('.tagline', { opacity: 0, y: 16, duration: 1.4, ease: 'expo.out' }, 1.2)
    .from('.hero-foot > *', { opacity: 0, y: 16, duration: 1.4, ease: 'expo.out', stagger: 0.12 }, 1.45)
    .from('.nav', { opacity: 0, duration: 1.4 }, 1.6)
    .from('.scroll-hint', { opacity: 0, duration: 1.2 }, 2.2);
}
boot();

if (!world) {
  loader.classList.add('done');
}

if (import.meta.env.DEV) window.__farside = { world, director, sections, get s() { return director.evaluate(getScroll()); } };
