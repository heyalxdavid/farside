# Farside

A scroll-driven 3D site for a fictional starship agency, rendered live with Three.js.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

## The story, in scroll order

1. **Orbit**: the finished ship over Earth. The wordmark stretches in on load.
2. **Build**: the page turns cyanotype blue and the ship assembles part by part (engines, tanks, heat shield, crew deck).
3. **Launch**: dawn liftoff with smoke, a cloud deck, a gravity turn and live telemetry, ending in orbit.
4. **Worlds**: a pull-back through black into an explorable solar system. Pick a planet to fly to it.
5. **Missions**: six missions in order, each drawing its transfer arc across the orrery.
6. **Join**: careers, close on the Sun.

## Where things live

- `src/director.js`: every scene value (camera, blueprint, atmosphere, fades) is keyed to a scroll position. Tune shots here.
- `src/scene/`: ship, planets (procedural GLSL), sky, launch site, orrery, post-processing.
- `src/data.js`: planet facts and mission copy.

Everything is procedural, with no image or model downloads. Fonts are Anybody and Instrument Sans from Google Fonts.
