/* ==========================================================
   Harmony Wheel — color wheel & palette generator
   Plain JavaScript, no dependencies.

   Model
   -----
   Every palette color is { a, s, v }:
     a = angle on the wheel (0–360, clockwise from the top)
     s = saturation (0–1)  → distance from the wheel's center
     v = brightness (0–1)  → HSB "value"
   The wheel angle is turned into a real hue through the chosen
   wheel: RYB (artist's wheel, like Adobe Color) or RGB.
   Harmony rules are defined as angle offsets on that wheel.
   ========================================================== */

(() => {
  'use strict';

  /* ---------- small helpers ---------- */

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
  const mod = (x, n) => ((x % n) + n) % n;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const DEG = Math.PI / 180;

  /* ---------- color math ---------- */

  function hsvToRgb(h, s, v) {
    h = mod(h, 360) / 60;
    const i = Math.floor(h);
    const f = h - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = mod(h * 60, 360);
    }
    return { h, s: max ? d / max : 0, v: max };
  }

  const toHex = (rgb) => '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();

  function parseHex(str) {
    let s = String(str || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  }

  function luminance([r, g, b]) {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  /** Black or white — whichever reads better on top of rgb. */
  function onColor(rgb) {
    const L = luminance(rgb);
    return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#111111' : '#FFFFFF';
  }

  /* ---------- wheels: RYB (artist) and RGB ----------
     Pairs of [wheel angle, RGB hue]. On the RYB wheel red sits
     opposite green, yellow opposite purple and blue opposite
     orange — the relationships painters (and Adobe Color) use. */

  const RYB_STOPS = [[0, 0], [60, 35], [120, 60], [180, 120], [240, 240], [300, 280], [360, 360]];

  function lerpStops(x, from, to) {
    x = mod(x, 360);
    for (let i = 1; i < RYB_STOPS.length; i++) {
      const a = RYB_STOPS[i - 1];
      const b = RYB_STOPS[i];
      if (x <= b[from]) return a[to] + ((x - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
    }
    return x;
  }

  const angleToHue = (angle, wheel) => (wheel === 'rgb' ? mod(angle, 360) : mod(lerpStops(angle, 0, 1), 360));
  const hueToAngle = (hue, wheel) => (wheel === 'rgb' ? mod(hue, 360) : mod(lerpStops(hue, 1, 0), 360));

  /* ---------- harmony rules ---------- */

  const S_MIN = 0.04;
  const V_MIN = 0.12;

  /** Shift x by d; if that leaves [lo, hi], shift the other way instead. */
  function nudge(x, d, lo, hi) {
    let y = x + d;
    if (y > hi || y < lo) y = x - d;
    return clamp(y, lo, hi);
  }

  /** A color related to base b: rotated by da degrees, with optional saturation / brightness shifts. */
  function tone(b, da = 0, ds = 0, dv = 0) {
    return {
      a: mod(b.a + da, 360),
      s: ds ? nudge(b.s, ds, S_MIN, 1) : b.s,
      v: dv ? nudge(b.v, dv, V_MIN, 1) : b.v,
    };
  }

  /** Shades: same hue & saturation, evenly stepped brightness, lightest first. */
  function buildShades(b) {
    for (const step of [0.18, 0.15, 0.12, 0.09, 0.06]) {
      for (const k of [2, 1, 3, 0, 4]) { // k = number of darker shades below the base
        const lo = b.v - k * step;
        const hi = b.v + (4 - k) * step;
        if (lo >= V_MIN - 1e-9 && hi <= 1 + 1e-9) {
          const colors = [0, 1, 2, 3, 4].map((j) => ({ a: b.a, s: b.s, v: hi - j * step }));
          colors[4 - k] = { ...b };
          return { colors, baseIndex: 4 - k };
        }
      }
    }
    // Base is almost black: build lighter shades above it.
    const colors = [0, 1, 2, 3, 4].map((j) => ({ a: b.a, s: b.s, v: clamp(b.v + (4 - j) * 0.18) }));
    colors[4] = { ...b };
    return { colors, baseIndex: 4 };
  }

  const RULES = {
    analogous: {
      name: 'Analogous',
      desc: 'Neighbouring hues on the wheel. Calm, cohesive and natural.',
      build: (b, o = {}) => {
        const d = o.spread ?? 20;
        return { colors: [tone(b, -2 * d), tone(b, -d), tone(b), tone(b, d), tone(b, 2 * d)], baseIndex: 2 };
      },
    },
    monochromatic: {
      name: 'Monochromatic',
      desc: 'One hue in different saturation and brightness levels. Clean, elegant, impossible to clash.',
      build: (b) => ({
        colors: [tone(b, 0, 0, -0.25), tone(b, 0, -0.35, 0), tone(b), tone(b, 0, -0.35, -0.25), tone(b, 0, 0, -0.5)],
        baseIndex: 2,
      }),
    },
    triad: {
      name: 'Triad',
      desc: 'Three hues evenly spaced 120° apart. Vibrant but balanced — let one color lead.',
      build: (b) => ({
        colors: [tone(b, 120, 0, -0.3), tone(b, 120), tone(b), tone(b, 240), tone(b, 240, -0.3, 0)],
        baseIndex: 2,
      }),
    },
    complementary: {
      name: 'Complementary',
      desc: 'Two opposite hues, 180° apart. Maximum contrast — great for making things pop.',
      build: (b) => ({
        colors: [tone(b, 0, 0, -0.3), tone(b, 0, -0.3, 0), tone(b), tone(b, 180), tone(b, 180, 0, -0.3)],
        baseIndex: 2,
      }),
    },
    splitComplementary: {
      name: 'Split Complementary',
      desc: 'The base plus the two hues on either side of its complement (150° and 210°). Strong contrast, less tension.',
      build: (b) => ({
        colors: [tone(b, 150, 0, -0.3), tone(b, 150), tone(b), tone(b, 210), tone(b, 210, 0, -0.3)],
        baseIndex: 2,
      }),
    },
    doubleSplitComplementary: {
      name: 'Double Split Complementary',
      desc: 'The base, its two neighbours (±30°) and the complements of those neighbours. Rich — keep one hue dominant.',
      build: (b) => ({
        colors: [tone(b, -150), tone(b, -30), tone(b), tone(b, 30), tone(b, 150)],
        baseIndex: 2,
      }),
    },
    square: {
      name: 'Square',
      desc: 'Four hues spaced evenly, 90° apart. Playful and bold.',
      build: (b) => ({
        colors: [tone(b, 0, 0, -0.3), tone(b, 90), tone(b), tone(b, 180), tone(b, 270)],
        baseIndex: 2,
      }),
    },
    rectangle: {
      name: 'Rectangle (Tetradic)',
      desc: 'Two complementary pairs, 60° apart. Lots of variety with built-in balance.',
      build: (b) => ({
        colors: [tone(b, 0, 0, -0.3), tone(b, 60), tone(b), tone(b, 180), tone(b, 240)],
        baseIndex: 2,
      }),
    },
    compound: {
      name: 'Compound',
      desc: 'Analogous meets complementary: a neighbour of the base plus hues around its complement.',
      build: (b) => ({
        colors: [tone(b, 30, 0, -0.25), tone(b, 30), tone(b), tone(b, 165), tone(b, 195, 0, -0.3)],
        baseIndex: 2,
      }),
    },
    shades: {
      name: 'Shades',
      desc: 'Same hue and saturation in different brightness steps. Perfect for UI tints and depth.',
      build: buildShades,
    },
    custom: {
      name: 'Custom',
      desc: 'No rule — every marker moves on its own. Build anything you like.',
      build: null,
    },
  };

  const RULE_ORDER = Object.keys(RULES);
  const GENERATIVE_RULES = RULE_ORDER.filter((k) => k !== 'custom');

  /* Moods for random palettes — ranges of saturation / brightness
     for the base color. Hues always follow the harmony rule. */
  const MOODS = [
    { name: 'Vibrant', s: [0.65, 0.95], v: [0.78, 1.0] },
    { name: 'Pastel', s: [0.18, 0.40], v: [0.88, 1.0] },
    { name: 'Muted', s: [0.22, 0.50], v: [0.50, 0.80] },
    { name: 'Deep', s: [0.55, 0.90], v: [0.35, 0.62] },
    { name: 'Balanced', s: [0.40, 0.80], v: [0.58, 0.95] },
  ];

  /* ---------- state ---------- */

  const DEFAULT_SEED = '#E4572E';
  const STORAGE_KEY = 'hw-state';

  const state = {
    mode: 'analogous',
    wheel: 'ryb',
    colors: [],
    baseIndex: 2,
    selected: 2,
  };

  const hueOf = (c) => angleToHue(c.a, state.wheel);
  const rgbOf = (c) => hsvToRgb(hueOf(c), c.s, c.v);
  const hexOf = (c) => toHex(rgbOf(c));
  const hexList = () => state.colors.map(hexOf);

  function colorFromHex(hex, fallbackAngle = 0) {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const { h, s, v } = rgbToHsv(...rgb);
    // Greys have no hue: keep the current angle so markers don't jump.
    return { a: s === 0 ? fallbackAngle : hueToAngle(h, state.wheel), s, v };
  }

  /* ---------- palette operations ---------- */

  function applyRule(mode, base, opts) {
    const { colors, baseIndex } = RULES[mode].build({ ...base }, opts);
    state.colors = colors;
    state.baseIndex = baseIndex;
    state.selected = baseIndex;
  }

  function setMode(mode) {
    if (!RULES[mode] || mode === state.mode) return;
    state.mode = mode;
    if (mode !== 'custom') applyRule(mode, state.colors[state.baseIndex]);
    commit();
  }

  /**
   * Move color i to (angle, s).
   * Rule modes keep the harmony: the whole set rotates together and
   * only the moved color's saturation changes (shades: all of them).
   * Custom mode moves just that one color.
   */
  function moveColor(i, angle, s) {
    const cs = state.colors;
    if (state.mode === 'custom') {
      cs[i].a = mod(angle, 360);
      cs[i].s = s;
      return;
    }
    const delta = angle - cs[i].a;
    cs.forEach((c) => { c.a = mod(c.a + delta, 360); });
    if (state.mode === 'shades') cs.forEach((c) => { c.s = s; });
    else cs[i].s = s;
  }

  function setColorHex(i, hex) {
    const c = colorFromHex(hex, state.colors[i].a);
    if (!c) return false;
    moveColor(i, c.a, c.s);
    state.colors[i].v = c.v;
    return true;
  }

  function harmonize() {
    const seed = colorFromHex(ui.seedHex.value, state.colors[state.baseIndex].a);
    if (!seed) {
      ui.seedHex.classList.add('invalid');
      ui.seedHex.focus();
      toast('Enter a valid hex color, e.g. #3A86FF');
      return;
    }
    setSeed(ui.seedHex.value);
    if (state.mode === 'custom') {
      // Keep your custom layout, but rotate it so the base becomes your color.
      const b = state.colors[state.baseIndex];
      const delta = seed.a - b.a;
      state.colors.forEach((c) => { c.a = mod(c.a + delta, 360); });
      b.s = seed.s;
      b.v = seed.v;
    } else {
      applyRule(state.mode, seed);
    }
    commit();
    toast(`${RULES[state.mode].name} palette from ${toHex(parseHex(ui.seedHex.value))}`);
  }

  function randomize() {
    let rule = state.mode;
    if (ui.randomRule.checked) {
      rule = pick(GENERATIVE_RULES.filter((r) => r !== state.mode));
      state.mode = rule;
    } else if (rule === 'custom') {
      rule = pick(GENERATIVE_RULES); // custom has no rule: borrow one, stay in custom
    }

    const mood = pick(MOODS);
    const base = { a: rand(0, 360), s: rand(...mood.s), v: rand(...mood.v) };
    const { colors, baseIndex } = RULES[rule].build(base, { spread: rand(14, 30) });

    // Gentle saturation/brightness variety. Angles stay untouched, so the harmony holds.
    if (rule !== 'shades') {
      colors.forEach((c, i) => {
        if (i === baseIndex) return;
        c.s = clamp(c.s + rand(-0.08, 0.08), S_MIN, 1);
        c.v = clamp(c.v + rand(-0.06, 0.06), V_MIN, 1);
      });
    }

    state.colors = colors;
    state.baseIndex = baseIndex;
    state.selected = baseIndex;
    setSeed(hexOf(colors[baseIndex]));
    commit();
    toast(`${mood.name} · ${RULES[rule].name}`);
  }

  function setWheel(wheel) {
    if (wheel === state.wheel) return;
    const old = state.wheel;
    if (state.mode === 'custom') {
      // Keep every actual color.
      state.colors.forEach((c) => { c.a = hueToAngle(angleToHue(c.a, old), wheel); });
    } else {
      // Keep the base color; re-read the rule on the new wheel.
      const b = state.colors[state.baseIndex];
      const delta = hueToAngle(angleToHue(b.a, old), wheel) - b.a;
      state.colors.forEach((c) => { c.a = mod(c.a + delta, 360); });
    }
    state.wheel = wheel;
    commit();
  }

  /* ---------- DOM refs ---------- */

  const ui = {
    root: document.documentElement,
    wrap: $('#wheelWrap'),
    canvas: $('#wheelCanvas'),
    svg: $('#wheelOverlay'),
    rules: $('#rules'),
    ruleDesc: $('#ruleDesc'),
    palette: $('#palette'),
    satSlider: $('#satSlider'),
    briSlider: $('#briSlider'),
    satOut: $('#satOut'),
    briOut: $('#briOut'),
    editing: $('#editingLabel'),
    seedPicker: $('#seedPicker'),
    seedHex: $('#seedHex'),
    seedSwatch: $('#seedSwatch'),
    harmonizeBtn: $('#harmonizeBtn'),
    harmonizeHint: $('#harmonizeHint'),
    randomBtn: $('#randomBtn'),
    randomRule: $('#randomRule'),
    themeToggle: $('#themeToggle'),
    wheelBtns: $$('[data-wheel]'),
    toast: $('#toast'),
  };
  const ctx = ui.canvas.getContext('2d');
  let ruleEls = [];
  let swatchEls = [];

  /* ---------- wheel geometry & drawing ---------- */

  const PAD = 18; // room for markers at full saturation
  const geom = { size: 0, R: 0, dpr: 1 };
  let wheelCache = { key: '', canvas: null };
  let drawnKey = '';

  function measure() {
    const size = ui.wrap.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (size === geom.size && dpr === geom.dpr) return false;
    geom.size = size;
    geom.dpr = dpr;
    geom.R = size / 2 - PAD;
    return true;
  }

  /** Full-brightness wheel image (cached per wheel type and pixel size). */
  function wheelImage(px, R, wheel) {
    const key = `${wheel}|${px}`;
    if (wheelCache.key === key) return wheelCache.canvas;
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = px;
    const c2 = cnv.getContext('2d');
    const img = c2.createImageData(px, px);
    const d = img.data;
    const c = px / 2;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const dist = Math.hypot(dx, dy);
        if (dist > R + 1) continue;
        const angle = Math.atan2(dx, -dy) / DEG;
        const [r, g, b] = hsvToRgb(angleToHue(angle, wheel), Math.min(dist / R, 1), 1);
        const i = (y * px + x) * 4;
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = Math.round(clamp(R + 0.5 - dist) * 255);
      }
    }
    c2.putImageData(img, 0, 0);
    wheelCache = { key, canvas: cnv };
    return cnv;
  }

  function drawWheel() {
    if (!geom.size) return;
    const v = state.colors[state.selected].v;
    const px = Math.round(geom.size * geom.dpr);
    const key = `${state.wheel}|${px}|${v.toFixed(3)}`;
    if (key === drawnKey) return;
    drawnKey = key;

    if (ui.canvas.width !== px) ui.canvas.width = ui.canvas.height = px;
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(wheelImage(px, geom.R * geom.dpr, state.wheel), 0, 0);
    // Brightness = multiply by v, which is exactly a black overlay at (1 - v).
    if (v < 1) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(0,0,0,${1 - v})`;
      ctx.fillRect(0, 0, px, px);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function polar(angle, r) {
    const c = geom.size / 2;
    return { x: c + r * Math.sin(angle * DEG), y: c - r * Math.cos(angle * DEG) };
  }

  const markerPoints = () => state.colors.map((col) => polar(col.a, col.s * geom.R));
  const markerRadius = (i) => (i === state.baseIndex ? 15 : 11);

  function renderMarkers() {
    if (!geom.size) return;
    const c = geom.size / 2;
    const pts = markerPoints();
    let out = '';
    pts.forEach((p) => { out += `<line class="spoke-shadow" x1="${c}" y1="${c}" x2="${p.x}" y2="${p.y}"/>`; });
    pts.forEach((p) => { out += `<line class="spoke" x1="${c}" y1="${c}" x2="${p.x}" y2="${p.y}"/>`; });
    out += `<circle class="hub" cx="${c}" cy="${c}" r="3.5"/>`;

    // Draw order: others, then base, then the selected one on top.
    const order = [0, 1, 2, 3, 4].sort((a, b) => rank(a) - rank(b));
    function rank(i) { return (i === state.selected ? 2 : 0) + (i === state.baseIndex ? 1 : 0); }
    order.forEach((i) => {
      const p = pts[i];
      const r = markerRadius(i);
      if (i === state.selected) out += `<circle class="sel-ring" cx="${p.x}" cy="${p.y}" r="${r + 5}"/>`;
      out += `<circle class="dot" cx="${p.x}" cy="${p.y}" r="${r}" fill="${hexOf(state.colors[i])}"/>`;
    });

    ui.svg.setAttribute('viewBox', `0 0 ${geom.size} ${geom.size}`);
    ui.svg.innerHTML = out;
  }

  /** Index of the marker under (x, y), or -1. The selected marker wins ties. */
  function hitTest(x, y) {
    const pts = markerPoints();
    let hit = -1;
    let best = Infinity;
    pts.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > markerRadius(i) + 6) return;
      const score = d - (i === state.selected ? 0.5 : 0) - (i === state.baseIndex ? 0.25 : 0);
      if (score < best) { best = score; hit = i; }
    });
    return hit;
  }

  /* ---------- wheel interaction ---------- */

  let drag = null;

  function localPoint(e) {
    const r = ui.wrap.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function dragTo(x, y) {
    const c = geom.size / 2;
    const dx = x - c;
    const dy = y - c;
    const s = clamp(Math.hypot(dx, dy) / geom.R);
    const a = s > 1e-4 ? mod(Math.atan2(dx, -dy) / DEG, 360) : state.colors[drag.i].a;
    moveColor(drag.i, a, s);
    commit();
  }

  ui.wrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = localPoint(e);
    const c = geom.size / 2;
    let i = hitTest(p.x, p.y);
    if (i === -1) {
      // Clicked the wheel itself: move the selected marker there.
      if (Math.hypot(p.x - c, p.y - c) > geom.R + 8) return;
      drag = { i: state.selected, ox: 0, oy: 0 };
      dragTo(p.x, p.y);
    } else {
      const mp = markerPoints()[i];
      state.selected = i;
      drag = { i, ox: mp.x - p.x, oy: mp.y - p.y };
      commit();
    }
    ui.wrap.setPointerCapture(e.pointerId);
    ui.wrap.classList.add('is-dragging');
    ui.wrap.focus({ preventScroll: true });
    e.preventDefault();
  });

  ui.wrap.addEventListener('pointermove', (e) => {
    const p = localPoint(e);
    if (drag) dragTo(p.x + drag.ox, p.y + drag.oy);
    else ui.wrap.classList.toggle('is-over-marker', hitTest(p.x, p.y) !== -1);
  });

  function endDrag() {
    if (!drag) return;
    drag = null;
    ui.wrap.classList.remove('is-dragging');
    commit();
  }
  ui.wrap.addEventListener('pointerup', endDrag);
  ui.wrap.addEventListener('pointercancel', endDrag);
  ui.wrap.addEventListener('pointerleave', () => ui.wrap.classList.remove('is-over-marker'));

  ui.wrap.addEventListener('keydown', (e) => {
    const i = state.selected;
    const c = state.colors[i];
    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowLeft': moveColor(i, c.a - step, c.s); break;
      case 'ArrowRight': moveColor(i, c.a + step, c.s); break;
      case 'ArrowUp': moveColor(i, c.a, clamp(c.s + step / 100)); break;
      case 'ArrowDown': moveColor(i, c.a, clamp(c.s - step / 100)); break;
      default: return;
    }
    e.preventDefault();
    commit();
  });

  /* ---------- sliders ---------- */

  ui.satSlider.addEventListener('input', () => {
    const i = state.selected;
    moveColor(i, state.colors[i].a, ui.satSlider.value / 100);
    commit();
  });

  ui.briSlider.addEventListener('input', () => {
    state.colors[state.selected].v = ui.briSlider.value / 100;
    commit();
  });

  /* ---------- rules list ---------- */

  function buildRules() {
    ui.rules.innerHTML = RULE_ORDER.map((k) => `
      <button type="button" class="rule" data-rule="${k}" aria-pressed="false">
        <span class="rule-name">${RULES[k].name}</span>
        <span class="rule-preview" aria-hidden="true">${'<i></i>'.repeat(5)}</span>
      </button>`).join('');
    ruleEls = $$('.rule', ui.rules).map((btn) => ({ key: btn.dataset.rule, btn, bars: $$('i', btn) }));
    ui.rules.addEventListener('click', (e) => {
      const btn = e.target.closest('.rule');
      if (btn) setMode(btn.dataset.rule);
    });
  }

  /* ---------- swatches ---------- */

  function buildSwatches() {
    ui.palette.innerHTML = [0, 1, 2, 3, 4].map((i) => `
      <article class="swatch" data-i="${i}">
        <button type="button" class="swatch-color" aria-label="Select color ${i + 1}" title="Select color ${i + 1}">
          <span class="badge">BASE</span>
          <span class="swatch-index">${i + 1}</span>
        </button>
        <div class="swatch-info">
          <input class="swatch-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Color ${i + 1} hex value">
          <div class="meta"><b>RGB</b><span data-rgb></span></div>
          <div class="meta"><b>HSB</b><span data-hsb></span></div>
          <div class="swatch-actions">
            <button type="button" class="mini-btn" data-copy>Copy</button>
            <button type="button" class="mini-btn" data-base>Set as base</button>
          </div>
        </div>
      </article>`).join('');

    swatchEls = $$('.swatch', ui.palette).map((root) => ({
      root,
      color: $('.swatch-color', root),
      hex: $('.swatch-hex', root),
      rgb: $('[data-rgb]', root),
      hsb: $('[data-hsb]', root),
      copyBtn: $('[data-copy]', root),
      baseBtn: $('[data-base]', root),
    }));

    swatchEls.forEach((el, i) => {
      el.color.addEventListener('click', () => { state.selected = i; render(); });
      el.copyBtn.addEventListener('click', () => {
        const hex = hexOf(state.colors[i]);
        copyText(hex, hex);
      });
      el.baseBtn.addEventListener('click', () => {
        state.baseIndex = i;
        state.selected = i;
        commit();
        toast(`Color ${i + 1} is now the base`);
      });
      el.hex.addEventListener('focus', () => {
        if (state.selected !== i) { state.selected = i; render(); }
        el.hex.select();
      });
      el.hex.addEventListener('input', () => {
        const v = el.hex.value.replace(/^#/, '');
        if ((v.length === 3 || v.length === 6) && setColorHex(i, el.hex.value)) commit();
      });
      el.hex.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') el.hex.blur();
      });
      el.hex.addEventListener('blur', () => render()); // tidy up / revert invalid input
    });
  }

  /* ---------- render ---------- */

  /** Snap to the precision used in saved/shared links, so a reload shows exactly the same hex values. */
  function quantize(c) {
    const a = Math.round(mod(c.a, 360) * 100) / 100;
    c.a = a >= 360 ? 0 : a;
    c.s = Math.round(clamp(c.s) * 1e4) / 1e4;
    c.v = Math.round(clamp(c.v) * 1e4) / 1e4;
  }

  function render() {
    state.colors.forEach(quantize);
    drawWheel();
    renderMarkers();
    renderSwatches();
    renderSliders();
    renderRules();
    renderChrome();
  }

  function renderSwatches() {
    state.colors.forEach((c, i) => {
      const el = swatchEls[i];
      const rgb = rgbOf(c);
      const hex = toHex(rgb);
      el.root.classList.toggle('is-selected', i === state.selected);
      el.root.classList.toggle('is-base', i === state.baseIndex);
      el.color.style.backgroundColor = hex;
      el.color.style.setProperty('--on', onColor(rgb));
      if (document.activeElement !== el.hex) el.hex.value = hex;
      el.rgb.textContent = rgb.join(', ');
      el.hsb.textContent = `${Math.round(hueOf(c)) % 360}°, ${Math.round(c.s * 100)}%, ${Math.round(c.v * 100)}%`;
      el.baseBtn.disabled = i === state.baseIndex;
      el.baseBtn.textContent = i === state.baseIndex ? 'Base color' : 'Set as base';
    });
  }

  function renderSliders() {
    const c = state.colors[state.selected];
    const h = hueOf(c);
    const hex = hexOf(c);
    ui.satSlider.value = Math.round(c.s * 100);
    ui.briSlider.value = Math.round(c.v * 100);
    ui.satOut.textContent = `${Math.round(c.s * 100)}%`;
    ui.briOut.textContent = `${Math.round(c.v * 100)}%`;
    ui.satSlider.style.setProperty('--track',
      `linear-gradient(to right, ${toHex(hsvToRgb(h, 0, c.v))}, ${toHex(hsvToRgb(h, 1, c.v))})`);
    ui.briSlider.style.setProperty('--track',
      `linear-gradient(to right, #000000, ${toHex(hsvToRgb(h, c.s, 1))})`);
    ui.satSlider.style.setProperty('--thumb', hex);
    ui.briSlider.style.setProperty('--thumb', hex);
    const isBase = state.selected === state.baseIndex;
    ui.editing.innerHTML = `Editing <strong>color ${state.selected + 1}</strong>${isBase ? ' (base)' : ''} · <span style="font-family:var(--mono)">${hex}</span>`;
  }

  function renderRules() {
    const base = state.colors[state.baseIndex];
    ruleEls.forEach(({ key, btn, bars }) => {
      const active = key === state.mode;
      btn.setAttribute('aria-pressed', String(active));
      const cols = active || key === 'custom' ? state.colors : RULES[key].build({ ...base }).colors;
      bars.forEach((bar, j) => { bar.style.background = hexOf(cols[j]); });
    });
  }

  function renderChrome() {
    const rule = RULES[state.mode];
    ui.ruleDesc.innerHTML = `<strong>${rule.name}.</strong> ${rule.desc}`;
    ui.harmonizeHint.innerHTML = state.mode === 'custom'
      ? 'Rotates your <strong>custom</strong> layout so the base becomes your color.'
      : `Builds a <strong>${rule.name.toLowerCase()}</strong> palette around your color.`;
    ui.wheelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wheel === state.wheel)));
    hexList().forEach((hex, i) => ui.root.style.setProperty(`--c${i + 1}`, hex));
  }

  /* ---------- persistence (localStorage + shareable URL hash) ---------- */

  function serialize() {
    const p = state.colors
      .map((c) => [c.a.toFixed(2), c.s.toFixed(4), c.v.toFixed(4)].join('_'))
      .join('~');
    return `rule=${state.mode}&wheel=${state.wheel}&base=${state.baseIndex}&p=${p}`;
  }

  function deserialize(str) {
    try {
      const q = new URLSearchParams(String(str || '').replace(/^#/, ''));
      const mode = q.get('rule');
      const wheel = q.get('wheel');
      const base = Number(q.get('base'));
      const cols = (q.get('p') || '').split('~').map((t) => t.split('_').map(Number));
      const valid = RULES[mode] && ['ryb', 'rgb'].includes(wheel) &&
        Number.isInteger(base) && base >= 0 && base < 5 && cols.length === 5 &&
        cols.every((c) => c.length === 3 && c.every(Number.isFinite));
      if (!valid) return false;
      state.mode = mode;
      state.wheel = wheel;
      state.baseIndex = base;
      state.selected = base;
      state.colors = cols.map(([a, s, v]) => ({ a, s, v }));
      state.colors.forEach(quantize);
      return true;
    } catch (err) {
      return false;
    }
  }

  let saveTimer = 0;
  function persist() {
    state.colors.forEach(quantize);
    const str = serialize();
    try { localStorage.setItem(STORAGE_KEY, str); } catch (err) { /* private mode */ }
    try { history.replaceState(null, '', `#${str}`); } catch (err) { /* sandboxed */ }
  }

  /** Re-render now, save shortly after. */
  function commit() {
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 250);
  }

  window.addEventListener('hashchange', () => {
    if (deserialize(location.hash)) {
      setSeed(hexOf(state.colors[state.baseIndex]));
      render();
    }
  });

  /* ---------- seed color (Your color) ---------- */

  function setSeed(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return;
    const h = toHex(rgb);
    ui.seedHex.value = h;
    ui.seedPicker.value = h.toLowerCase();
    ui.seedSwatch.style.setProperty('--seed', h);
    ui.seedHex.classList.remove('invalid');
  }

  ui.seedPicker.addEventListener('input', () => setSeed(ui.seedPicker.value));
  ui.seedHex.addEventListener('input', () => {
    const rgb = parseHex(ui.seedHex.value);
    if (rgb) {
      ui.seedPicker.value = toHex(rgb).toLowerCase();
      ui.seedSwatch.style.setProperty('--seed', toHex(rgb));
      ui.seedHex.classList.remove('invalid');
    }
  });
  ui.seedHex.addEventListener('keydown', (e) => { if (e.key === 'Enter') harmonize(); });
  ui.harmonizeBtn.addEventListener('click', harmonize);
  ui.randomBtn.addEventListener('click', randomize);

  /* ---------- wheel type & theme ---------- */

  ui.wheelBtns.forEach((b) => b.addEventListener('click', () => setWheel(b.dataset.wheel)));

  function applyTheme(theme, save) {
    ui.root.dataset.theme = theme;
    ui.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    if (save) { try { localStorage.setItem('hw-theme', theme); } catch (err) { /* ignore */ } }
  }

  ui.themeToggle.addEventListener('click', () => {
    applyTheme(ui.root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });

  // Follow the system setting until the user picks a theme themselves.
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.addEventListener?.('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem('hw-theme'); } catch (err) { /* ignore */ }
    if (!saved) applyTheme(e.matches ? 'dark' : 'light', false);
  });

  /* ---------- export ---------- */

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
    }
    toast(`Copied ${label}`);
  }

  function downloadPng() {
    const hexes = hexList();
    const W = 1500;
    const H = 600;
    const w = W / hexes.length;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c2 = cv.getContext('2d');
    hexes.forEach((hex, i) => {
      c2.fillStyle = hex;
      c2.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, H);
      c2.fillStyle = onColor(parseHex(hex));
      c2.font = '600 28px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      c2.fillText(hex, i * w + 28, H - 36);
    });
    cv.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `palette-${hexes.map((h) => h.slice(1)).join('-')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    toast('PNG downloaded');
  }

  const EXPORTS = {
    hex: () => copyText(hexList().join(', '), 'HEX values'),
    css: () => copyText(`:root {\n${hexList().map((h, i) => `  --color-${i + 1}: ${h};`).join('\n')}\n}`, 'CSS variables'),
    json: () => copyText(JSON.stringify({
      rule: RULES[state.mode].name,
      wheel: state.wheel.toUpperCase(),
      base: hexOf(state.colors[state.baseIndex]),
      colors: hexList(),
    }, null, 2), 'JSON'),
    png: downloadPng,
    link: () => { persist(); copyText(location.href, 'share link'); },
  };

  $$('[data-export]').forEach((b) => b.addEventListener('click', () => EXPORTS[b.dataset.export]()));

  /* ---------- toast ---------- */

  let toastTimer = 0;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1800);
  }

  /* ---------- global shortcuts ---------- */

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const typing = t.closest && t.closest('input, textarea, select, button, [contenteditable="true"]');
    if (typing) return;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      randomize();
    } else if (/^[1-5]$/.test(e.key)) {
      state.selected = Number(e.key) - 1;
      render();
    }
  });

  /* ---------- init ---------- */

  function init() {
    buildRules();
    buildSwatches();
    measure();

    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    if (!deserialize(location.hash) && !deserialize(saved)) {
      applyRule(state.mode, colorFromHex(DEFAULT_SEED));
    }
    setSeed(hexOf(state.colors[state.baseIndex]));
    applyTheme(ui.root.dataset.theme || 'light', false);
    render();

    new ResizeObserver(() => {
      if (measure()) { drawnKey = ''; render(); }
    }).observe(ui.wrap);
  }

  init();
})();
