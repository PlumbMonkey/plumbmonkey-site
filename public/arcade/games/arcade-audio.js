// Shared Spectral Manor Arcade audio mixer.
// One AudioContext, separate music/SFX buses, saved levels and peak protection.
const ArcadeAudio = (function () {
  const STORE = 'spectralArcade.audio.v1';
  const defaults = { master: 0.8, music: 0.45, sfx: 0.75, muted: false };
  let settings = load();
  let ctx = null, master = null, music = null, sfx = null, limiter = null;

  function load() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORE) || '{}')); }
    catch (e) { return Object.assign({}, defaults); }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) {}
  }

  function context() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    music = ctx.createGain();
    sfx = ctx.createGain();
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    music.connect(master);
    sfx.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
    apply();
    return ctx;
  }

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, t, 0.015);
    music.gain.setTargetAtTime(settings.music, t, 0.015);
    sfx.gain.setTargetAtTime(settings.sfx, t, 0.015);
  }

  function output(kind, pan) {
    context();
    const bus = kind === 'music' ? music : sfx;
    if (typeof pan !== 'number' || !ctx.createStereoPanner) return bus;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.75, Math.min(0.75, pan));
    p.connect(bus);
    return p;
  }

  function resume() {
    const c = context();
    if (c.state === 'suspended') return c.resume();
    return Promise.resolve();
  }

  function set(name, value) {
    if (name === 'muted') settings.muted = !!value;
    else settings[name] = Math.max(0, Math.min(1, Number(value)));
    save();
    apply();
    updateUI();
  }

  function buildUI() {
    if (/[?&]attract\b/.test(location.search) || document.getElementById('aa-toggle')) return;
    const bar = document.querySelector('.ac-bar');
    if (!bar) return;
    const button = document.createElement('button');
    button.id = 'aa-toggle';
    button.className = 'ac-chip';
    button.textContent = '🔊';
    button.title = 'Audio mixer';
    const panel = document.createElement('div');
    panel.id = 'aa-panel';
    panel.hidden = true;
    panel.innerHTML = ['master', 'music', 'sfx'].map(name =>
      `<label>${name.toUpperCase()} <span id="aa-${name}-value"></span>
       <input id="aa-${name}" type="range" min="0" max="100"></label>`
    ).join('') + '<button id="aa-mute"></button>';
    panel.style.cssText = 'position:fixed;right:8px;top:52px;z-index:50;width:210px;padding:12px;' +
      'border:1px solid #6d4aa0;border-radius:10px;background:rgba(10,7,18,.96);color:#e9d5ff;' +
      'font:600 11px system-ui;box-shadow:0 12px 35px #0008';
    panel.querySelectorAll('label').forEach(el => {
      el.style.cssText = 'display:block;margin:0 0 10px;letter-spacing:1px';
      el.querySelector('input').style.cssText = 'display:block;width:100%;margin-top:5px;accent-color:#c084fc';
    });
    button.addEventListener('click', () => { panel.hidden = !panel.hidden; });
    ['master', 'music', 'sfx'].forEach(name => {
      panel.querySelector('#aa-' + name).addEventListener('input', e => set(name, e.target.value / 100));
    });
    panel.querySelector('#aa-mute').addEventListener('click', () => set('muted', !settings.muted));
    document.body.appendChild(panel);
    bar.appendChild(button);
    updateUI();
  }

  function updateUI() {
    ['master', 'music', 'sfx'].forEach(name => {
      const input = document.getElementById('aa-' + name);
      const value = document.getElementById('aa-' + name + '-value');
      if (input) input.value = Math.round(settings[name] * 100);
      if (value) value.textContent = Math.round(settings[name] * 100) + '%';
    });
    const mute = document.getElementById('aa-mute');
    const toggle = document.getElementById('aa-toggle');
    if (mute) {
      mute.textContent = settings.muted ? 'UNMUTE' : 'MUTE ALL';
      mute.style.cssText = 'width:100%;padding:7px;border:1px solid #7c3aed;border-radius:6px;' +
        'background:#21152f;color:#fff;font-weight:700;cursor:pointer';
    }
    if (toggle) toggle.textContent = settings.muted ? '🔇' : '🔊';
  }

  window.addEventListener('DOMContentLoaded', () => setTimeout(buildUI, 0));
  return { context, output, resume, set, get settings() { return Object.assign({}, settings); } };
})();
