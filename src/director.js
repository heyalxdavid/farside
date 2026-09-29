import { MISSIONS } from './data.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Each key pins a set of scene values to a scroll position: [section, progress, extra viewport heights].
// Values interpolate between the nearest keys that define them.
const KEYS = [
  // Orbit: the finished ship over Earth
  { at: ['hero', 0], az: 0.62, el: 0.16, dist: 33, tx: 0, ty: -0.4, tz: 0, fov: 30, lateral: 0.36, ex: -10, ey: -47, ez: -34, blue: 0, atmo: 0, explode: 0, tilt: 0.42, spin: 1, earth: 1, orrery: 0, fade: 0, ghost: 0, pad: 0, sunGlow: 1, focusEarth: 0, timeScale: 1 },

  // The yard: blueprint, exploded, assembling
  { at: ['build', 0], az: 0.9, el: 0.1, dist: 36, ty: -0.6, fov: 36, lateral: 0.28, blue: 1, explode: 1, tilt: 0, spin: 0, earth: 0, ghost: 0.55, sunGlow: 0 },
  { at: ['build', 0.09], az: 0.78, el: 0.1, dist: 35, ty: -0.6 },
  { at: ['build', 0.27], az: 0.5, el: -0.14, dist: 20, ty: -3.8 },
  { at: ['build', 0.47], az: 0.2, el: 0.02, dist: 25, ty: -0.6 },
  { at: ['build', 0.67], az: -1.2, el: 0.08, dist: 23, ty: 0.6 },
  { at: ['build', 0.87], az: -0.25, el: 0.18, dist: 19, ty: 3.6 },
  { at: ['build', 1], az: 0.5, el: 0.05, dist: 27, ty: 0.3, lateral: 0.16, ghost: 0.35, blue: 1, atmo: 0, pad: 0 },

  // Launch at dawn
  { at: ['launch', 0], az: 0.34, el: 0.02, dist: 34, ty: 2.2, fov: 40, lateral: 0.1, blue: 0, atmo: 1, ghost: 0, pad: 1, earth: 0 },
  { at: ['launch', 0.09], az: 0.44, el: -0.05, dist: 29, ty: 1 },
  { at: ['launch', 0.3], az: 0.62, el: -0.12, dist: 22, ty: 1.2 },
  { at: ['launch', 0.6], az: 0.3, el: 0.05, dist: 24, ty: 0.6, earth: 0, sunGlow: 0, ex: 0, ey: -52, ez: -60 },
  { at: ['launch', 0.94], az: 0.16, el: 0.12, dist: 26, earth: 1, sunGlow: 1, lateral: 0.1 },
  { at: ['launch', 1], az: 0.1, el: 0.14, dist: 27, ty: 0.6, orrery: 0, fade: 0, fov: 40, focusEarth: 0 },

  // Pull back through black into the solar system
  { at: ['system', 0, -0.52], dist: 70, el: 0.3, fade: 1, orrery: 0, lateral: 0 },
  { at: ['system', 0, -0.48], dist: 2.6, el: 0.25, az: 0.6, tx: 0, ty: 0, fade: 1, orrery: 1, focusEarth: 1, pad: 0, atmo: 0, fov: 42 },
  { at: ['system', 0], dist: 9, el: 0.3, az: 0.4, fade: 0, focusEarth: 1 },
  { at: ['system', 0.4], dist: 150, el: 0.52, az: 0.15, focusEarth: 0, lateral: 0.22, timeScale: 1 },
  { at: ['system', 1], dist: 138, el: 0.58, az: -0.05, lateral: 0.22 },

  // Missions: a high view to show every transfer
  { at: ['missions', 0], dist: 132, el: 0.78, az: -0.1, lateral: -0.34, timeScale: 0.2 },
  { at: ['missions', 1], dist: 118, el: 0.7, az: -0.7, lateral: -0.34 },

  // Close on the Sun
  { at: ['join', 0], dist: 62, el: 0.1, az: -1.1, lateral: 0.3, fov: 44, timeScale: 1 },
];

export const LAUNCH_EVENTS = [0, 62, 160, 472, 490];

export function createDirector() {
  let tracks = {};
  let sections = {};

  function layout(secs, vh) {
    sections = secs;
    tracks = {};
    for (const k of KEYS) {
      const [name, p, off = 0] = k.at;
      const sec = secs[name];
      const x = sec.start + p * sec.span + off * vh;
      for (const prop in k) {
        if (prop === 'at') continue;
        (tracks[prop] ||= []).push({ x, v: k[prop] });
      }
    }
    for (const t of Object.values(tracks)) t.sort((a, b) => a.x - b.x);
  }

  function sample(prop, x) {
    const t = tracks[prop];
    if (!t) return 0;
    if (x <= t[0].x) return t[0].v;
    const last = t[t.length - 1];
    if (x >= last.x) return last.v;
    for (let i = 0; i < t.length - 1; i++) {
      const a = t[i], b = t[i + 1];
      if (x >= a.x && x <= b.x) {
        const u = b.x === a.x ? 1 : (x - a.x) / (b.x - a.x);
        const e = u * u * (3 - 2 * u);
        return a.v + (b.v - a.v) * e;
      }
    }
    return last.v;
  }

  const progress = (name, x) => {
    const s = sections[name];
    return clamp((x - s.start) / s.span);
  };

  function evaluate(x) {
    const s = {};
    for (const prop in tracks) s[prop] = sample(prop, x);

    s.build = progress('build', x);
    s.buildRaw = (x - sections.build.start) / sections.build.span;

    // ---- Launch clock ----
    const lp = progress('launch', x);
    s.launchP = lp;
    const T = lp < 0.08 ? -10 + (lp / 0.08) * 10 : ((lp - 0.08) / 0.92) * 490;
    s.T = T;
    const tp = clamp(T / 490);
    s.altKm = T <= 0 ? 0 : 205 * Math.pow(tp, 1.55);
    s.velKmh = T <= 0 ? 0 : 28000 * Math.pow(tp, 1.45);
    s.thrust = smooth(-3, -0.5, T) * (1 - smooth(472, 478, T));
    s.seaLevel = 1 - smooth(158, 162, T);
    s.drop = T <= 0 ? 0 : 0.2 * T * T;
    s.skyAlt = smooth(0, 95, s.altKm);
    s.expand = smooth(8, 70, s.altKm);
    s.tilt += 1.2 * smooth(14, 430, T);
    s.streak = smooth(6, 25, T) * (1 - smooth(40, 80, s.altKm));
    s.shake = s.thrust * (1 - smooth(0, 30, s.altKm)) * (T < 1 ? 1.6 : 1) * (lp > 0 && lp < 1 ? 1 : 0);
    s.launchEvent = LAUNCH_EVENTS.reduce((acc, t, i) => (T >= t ? i : acc), -1);

    // ---- Missions ----
    const mp = progress('missions', x);
    const n = MISSIONS.length;
    s.missionsOn = x > sections.missions.start - 0.35 * sections.missions.vh;
    s.missionIndex = Math.min(n - 1, Math.floor(mp * n));
    s.missionProgress = clamp(mp * n - s.missionIndex);

    s.systemP = progress('system', x);
    return s;
  }

  return { layout, evaluate, progress };
}
