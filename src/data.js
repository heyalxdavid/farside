// Real planetary figures; transit times are Farside's own planning estimates.
export const PLANETS = [
  {
    id: 'mercury', name: 'Mercury', kind: 'ROCK', orbit: 11, radius: 0.45, speed: 1.6, phase: 0.8,
    colA: 0x7d7874, colB: 0x55504c, colC: 0x8f8579,
    au: '0.39 AU', day: '176 days', gravity: '0.38 g', moons: '0', temp: '167 °C', transit: '4 months',
    note: 'Closest to the Sun, where solar panels work a little too well. Crews would only ever pass through.',
  },
  {
    id: 'venus', name: 'Venus', kind: 'VENUS', orbit: 15, radius: 0.85, speed: 1.17, phase: 2.6,
    colA: 0xd9b77e, colB: 0xb88a4c, colC: 0xf0dcb0, atmo: 0xffd9a0, atmoStrength: 0.6,
    au: '0.72 AU', day: '117 days', gravity: '0.90 g', moons: '0', temp: '464 °C', transit: '3 months',
    note: 'The surface crushes landers within hours. We would study it from the clouds, 55 km up, where the air is room temperature.',
  },
  {
    id: 'earth', name: 'Earth', kind: 'EARTH', orbit: 20, radius: 0.9, speed: 1, phase: 4.1,
    atmo: 0x6fb3ff, atmoStrength: 1,
    au: '1 AU', day: '24 hours', gravity: '1 g', moons: '1', temp: '15 °C', transit: 'Home port',
    note: 'Every Longreach is built, fuelled and flown from here. The Moon is three days away.',
  },
  {
    id: 'mars', name: 'Mars', kind: 'MARS', orbit: 25.5, radius: 0.6, speed: 0.81, phase: 5.4,
    colA: 0x7a3517, colB: 0xb4592a, colC: 0x3a2418, atmo: 0xe0a080, atmoStrength: 0.35,
    au: '1.52 AU', day: '24.6 hours', gravity: '0.38 g', moons: '2', temp: '−65 °C', transit: '5 months',
    note: 'Our first destination with people aboard. There is water ice a metre under the dust at Arcadia Planitia.',
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'GAS', orbit: 45, radius: 2.8, speed: 0.44, phase: 1.2, spot: true, bands: 22,
    colA: 0xd8c3a0, colB: 0xa0704a, colC: 0xf2e6d0, atmo: 0xe8d2b0, atmoStrength: 0.3,
    au: '5.2 AU', day: '9.9 hours', gravity: '2.53 g', moons: '95', temp: '−110 °C', transit: '2.1 years',
    note: 'Europa, one of its moons, hides an ocean under 20 km of ice. That ocean is the reason we are going.',
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'GAS', orbit: 60, radius: 2.4, speed: 0.33, phase: 3.3, rings: true, bands: 16,
    colA: 0xe3cf9f, colB: 0xc2a26b, colC: 0xf3e7c6, atmo: 0xf0dfb0, atmoStrength: 0.3,
    au: '9.5 AU', day: '10.7 hours', gravity: '1.07 g', moons: '274', temp: '−140 °C', transit: '3.4 years',
    note: 'Titan has lakes of liquid methane: fuel for the trip home, if we can refine it on site.',
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'GAS', orbit: 73, radius: 1.5, speed: 0.24, phase: 0.2, bands: 8,
    colA: 0xa8dde0, colB: 0x8cc7cf, colC: 0xc4ecee, atmo: 0xb0f0ff, atmoStrength: 0.5,
    au: '19.2 AU', day: '17.2 hours', gravity: '0.90 g', moons: '29', temp: '−195 °C', transit: '8 years',
    note: 'It spins on its side, so each pole gets 42 years of daylight. Nobody has visited since Voyager 2 in 1986.',
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'GAS', orbit: 85, radius: 1.45, speed: 0.19, phase: 5.9, bands: 10,
    colA: 0x2f5bd0, colB: 0x2446a8, colC: 0x6f95ff, atmo: 0x7aa2ff, atmoStrength: 0.55,
    au: '30.1 AU', day: '16.1 hours', gravity: '1.14 g', moons: '16', temp: '−200 °C', transit: '12 years',
    note: 'Winds here reach 2,000 km/h. It is the last planet and the longest trip on our charts.',
  },
];

export const MISSIONS = [
  {
    year: 2027, name: 'Tanker Run', target: 'earth',
    text: 'Two Longreach ships dock in low Earth orbit and move 100 tonnes of propellant between them. Everything after this depends on refuelling in space.',
    status: 'Hardware in test',
  },
  {
    year: 2029, name: 'Harbor', target: 'moon',
    text: 'A depot on the rim of Shackleton crater, where sunlight is almost constant and the ice in the crater floor never has been.',
    status: 'Site selected',
  },
  {
    year: 2031, name: 'Red Crossing', target: 'mars',
    text: 'Six crew, five months out, eighteen months on the surface. Two cargo ships land first with power, habitat and the return propellant plant.',
    status: 'Crew in selection',
  },
  {
    year: 2034, name: 'Beltline', target: 'ceres',
    text: 'An uncrewed survey of Ceres, the largest body in the asteroid belt, to map the brine deposits under Occator crater.',
    status: 'In design',
  },
  {
    year: 2038, name: 'Cold Water', target: 'europa',
    text: 'A lander with a melt probe that works its way through the ice shell of Europa, reporting back through a tether of relays.',
    status: 'In study',
  },
  {
    year: 2041, name: 'Long Night', target: 'titan',
    text: 'A crewed flyby of Saturn and a robotic lander on Titan to test making methane propellant from its lakes.',
    status: 'In study',
  },
];
