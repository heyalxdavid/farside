// Generative sound: a slow two-note drone and a filtered-noise rumble that follows engine thrust.
export function createAudio() {
  let ctx = null;
  let master, droneGain, rumbleGain, rumbleFilter;
  let on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 700;
    droneGain.connect(droneFilter).connect(master);
    for (const [f, d] of [[55, 0], [82.4, 3], [110, -4], [164.8, 5]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = d;
      const g = ctx.createGain();
      g.gain.value = f > 100 ? 0.25 : 0.5;
      // slow swell on each voice
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.03 + Math.random() * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.2;
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(g).connect(droneGain);
      o.start();
      lfo.start();
    }

    // brown noise for the rumble
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 180;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    noise.connect(rumbleFilter).connect(rumbleGain).connect(master);
    noise.start();
  }

  function toggle() {
    if (!ctx) build();
    on = !on;
    if (on) ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.4);
    return on;
  }

  function update(thrust, altitude) {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    // Thin air carries less sound: the rumble fades as the ship climbs.
    rumbleGain.gain.setTargetAtTime(thrust * 1.4 * (1 - altitude * 0.85), t, 0.15);
    rumbleFilter.frequency.setTargetAtTime(120 + thrust * 260 * (1 - altitude), t, 0.2);
    droneGain.gain.setTargetAtTime(0.16 * (1 - thrust * 0.6 * (1 - altitude)), t, 0.3);
  }

  function blip(freq = 880) {
    if (!ctx || !on) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  }

  return { toggle, update, blip, get on() { return on; } };
}
