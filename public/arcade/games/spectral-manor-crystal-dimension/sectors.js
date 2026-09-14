// ============================================================
// CRYSTAL DIMENSION — sector data
// Four sectors, each three waves and a boss. After the Prism Core the run
// loops back to sector 1 as the next CYCLE: same layouts, more of everything,
// faster. Wave fields are counts; `volatile` / `armored` are the fraction of
// large crystals given that variant.
// ============================================================

const SECTORS = [
  {
    name: 'AMETHYST DRIFT',
    sub: 'The manor\'s wreckage floats here',
    hazard: null,
    palette: {
      void: ['#160a26', '#0c0518', '#04020a'],
      nebula: ['rgba(124,58,237,0.10)', 'rgba(232,121,249,0.07)', 'rgba(34,211,238,0.05)'],
      aurora: ['rgba(232,121,249,0.12)', 'rgba(103,232,249,0.10)'],
      rock: ['#a78bfa', '#f0abfc'],
      star: '#e0d4ff'
    },
    waves: [
      { rocks: 4, saucers: 0 },
      { rocks: 4, saucers: 1 },
      { rocks: 5, saucers: 2, armored: 0.25 }
    ],
    boss: { type: 'warden', name: 'THE GEODE WARDEN', rocks: 0 }
  },
  {
    name: 'ROSE NEBULA',
    sub: 'Ion clouds drag at the hull',
    hazard: 'clouds',
    palette: {
      void: ['#26091c', '#150512', '#070208'],
      nebula: ['rgba(244,63,94,0.10)', 'rgba(251,146,60,0.06)', 'rgba(232,121,249,0.08)'],
      aurora: ['rgba(251,113,133,0.13)', 'rgba(253,186,116,0.08)'],
      rock: ['#fb7185', '#fda4af'],
      star: '#ffe4e6'
    },
    waves: [
      { rocks: 4, saucers: 1, volatile: 0.35 },
      { rocks: 4, saucers: 1, wraiths: 1, volatile: 0.35 },
      { rocks: 5, saucers: 2, wraiths: 2, volatile: 0.4 }
    ],
    boss: { type: 'carrier', name: 'THE BANSHEE CARRIER', rocks: 0 }
  },
  {
    name: 'FROZEN VOID',
    sub: 'A gravity well bends every shot',
    hazard: 'well',
    palette: {
      void: ['#071a26', '#040f18', '#02060a'],
      nebula: ['rgba(34,211,238,0.09)', 'rgba(147,197,253,0.07)', 'rgba(167,139,250,0.05)'],
      aurora: ['rgba(165,243,252,0.12)', 'rgba(147,197,253,0.10)'],
      rock: ['#67e8f9', '#bae6fd'],
      star: '#e0f2fe'
    },
    waves: [
      { rocks: 4, saucers: 1, mines: 2, armored: 0.3 },
      { rocks: 5, saucers: 1, mines: 3, wraiths: 1, armored: 0.3 },
      { rocks: 5, saucers: 2, mines: 3, wraiths: 2, armored: 0.4, volatile: 0.2 }
    ],
    boss: { type: 'serpent', name: 'THE CRYSTAL SERPENT', rocks: 0 }
  },
  {
    name: 'PRISM CORE',
    sub: 'The heart of the dimension',
    hazard: null,
    palette: {
      void: ['#1f1a06', '#100d05', '#050402'],
      nebula: ['rgba(250,204,21,0.08)', 'rgba(232,121,249,0.08)', 'rgba(103,232,249,0.07)'],
      aurora: ['rgba(253,224,71,0.11)', 'rgba(240,171,252,0.11)'],
      rock: ['#fde047', '#f0abfc'],
      star: '#fef9c3'
    },
    waves: [
      { rocks: 5, saucers: 2, seekers: 2, armored: 0.3, volatile: 0.3 },
      { rocks: 5, saucers: 2, wraiths: 2, mines: 2, seekers: 2, armored: 0.3, volatile: 0.3 },
      { rocks: 6, saucers: 3, wraiths: 2, mines: 3, seekers: 3, armored: 0.4, volatile: 0.35 }
    ],
    boss: { type: 'heart', name: 'THE PRISM HEART', rocks: 0 }
  }
];

const WAVES_PER_SECTOR = 4; // three waves + the boss
