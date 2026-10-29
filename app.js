/* ==========================================================================
   LTL ELECTRICISTAS  |  app.js
   --------------------------------------------------------------------------
   Sin dependencias. Un único bucle requestAnimationFrame lee el scroll y
   actualiza las escenas (primero lecturas, luego escrituras) para evitar
   reflujos. Todo respeta prefers-reduced-motion.

   Módulos:
     1. Utilidades y estado        7. Escena: servicios (pan horizontal / pila)
     2. Loader (encendido)         8. Escena: energía solar (sol > panel > recibo)
     3. Texto dividido y reveals   9. Escena: imagen que se abre + cifras
     4. Hero FX (canvas eléctrico) 10. Línea de circuito, marquee, footer
     5. Puntero (tilt, imán, luz)  11. UI: menú, FAQ, calculadora, formulario,
     6. Escena: manifiesto             interruptor, video, WhatsApp
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ 1 */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mapR = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const safe = (fn) => { try { return fn(); } catch (err) { console.error('[LTL]', err); return null; } };

  const root = document.documentElement;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqWide = window.matchMedia('(min-width: 1024px)');
  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');

  const WA_NUMBER = '523310431010';
  const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

  const S = {
    y: 0, vel: 0,
    vw: window.innerWidth, vh: window.innerHeight,
    px: 0, py: 0, cx: -9999, cy: -9999, pointerSeen: false,
    reduced: mqReduce.matches,
    ready: false,
  };

  const scenes = [];
  const sceneByEl = new Map();
  function addScene(scene) {
    if (!scene) return;
    scenes.push(scene);
    sceneByEl.set(scene.el, scene);
    scene.active = false;
  }

  /* ------------------------------------------------------------------ 2 */
  function initLoader(onDone) {
    const loader = $('#loader');
    if (!loader) { root.classList.remove('is-loading'); root.classList.add('is-ready'); onDone(); return; }

    const arc = $('#ld-arc');
    const num = $('#ld-num');
    const label = $('#ld-label');
    const minMs = S.reduced ? 350 : 2300;
    const t0 = performance.now();
    let loaded = false;
    let shown = 0;
    let finished = false;

    const markLoaded = () => { loaded = true; };
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => {
      if (document.readyState === 'complete') markLoaded();
      else window.addEventListener('load', markLoaded, { once: true });
    });
    setTimeout(markLoaded, 5000); // salvavidas: nunca se queda cargando

    const labels = [[0, 'Conectando'], [.34, 'Energizando'], [.82, 'Sistema listo']];

    function paint(p) {
      arc.style.strokeDashoffset = String(100 - p * 100);
      num.textContent = String(Math.round(p * 100)).padStart(3, '0');
      loader.style.setProperty('--ld-p', p.toFixed(3));
      let text = labels[0][1];
      for (const [t, l] of labels) if (p >= t) text = l;
      if (label.textContent !== text) label.textContent = text;
    }

    function finish() {
      if (finished) return;
      finished = true;
      loader.classList.add('done');
      setTimeout(() => {
        root.classList.remove('is-loading');
        root.classList.add('is-ready');
        S.ready = true;
        onDone();
      }, 380);
      setTimeout(() => { loader.classList.add('gone'); loader.remove(); }, 1800);
    }

    function frame(now) {
      const timeP = clamp((now - t0) / minMs);
      const target = loaded ? easeInOut(timeP) : Math.min(easeInOut(timeP), .86);
      shown = lerp(shown, target, .14);
      if (loaded && timeP >= 1 && shown > .992) shown = 1;
      paint(shown);
      if (shown >= 1) finish();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ 3 */
  /* Divide un texto en palabras conservando etiquetas en línea (<em>, <br>).
     mode 'mask'  -> .w > .wi (revelado con máscara)
     mode 'scrub' -> .mw (se enciende con el scroll). Devuelve las palabras. */
  function splitWords(el, mode) {
    const out = [];
    let idx = 0;
    const walk = (node, parent) => {
      node.childNodes.forEach((ch) => {
        if (ch.nodeType === 3) {
          ch.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { parent.appendChild(document.createTextNode(' ')); return; }
            if (mode === 'scrub') {
              const w = document.createElement('span');
              w.className = 'mw';
              w.textContent = part;
              parent.appendChild(w);
              out.push(w);
            } else {
              const w = document.createElement('span');
              w.className = 'w';
              const wi = document.createElement('span');
              wi.className = 'wi';
              wi.style.setProperty('--wi', idx++);
              wi.textContent = part;
              w.appendChild(wi);
              parent.appendChild(w);
            }
          });
        } else if (ch.nodeType === 1) {
          if (ch.tagName === 'BR') { parent.appendChild(ch.cloneNode()); return; }
          const clone = ch.cloneNode(false);
          parent.appendChild(clone);
          walk(ch, clone);
        }
      });
    };
    const holder = document.createElement('div');
    walk(el, holder);
    el.textContent = '';
    while (holder.firstChild) el.appendChild(holder.firstChild);
    return out;
  }

  function runCount(el) {
    if (el._counted) return;
    el._counted = true;
    const to = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    if (S.reduced) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now();
    const dur = 1900;
    (function step(now) {
      const p = clamp((now - t0) / dur);
      el.textContent = (to * easeOut(p)).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  function initReveal() {
    $$('[data-stagger]').forEach((group) => {
      $$(':scope > [data-reveal]', group).forEach((c, i) => c.style.setProperty('--i', i));
    });
    $$('[data-split]').forEach((el) => splitWords(el, 'mask'));

    const targets = $$('[data-reveal], [data-split]');
    const counters = $$('[data-count]').filter((c) => !c.closest('#expand-stats'));

    if (S.reduced || !('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('in'));
      counters.forEach(runCount);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    targets.forEach((t) => io.observe(t));

    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        runCount(e.target);
        cio.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    counters.forEach((c) => cio.observe(c));
  }

  /* ------------------------------------------------------------------ 4 */
  function createFX() {
    const canvas = $('#fx');
    const hero = $('#inicio');
    const hud = $('#hud');
    if (!canvas || !canvas.getContext || !hero || !hud) return null;

    const ctx = canvas.getContext('2d');
    const layer = document.createElement('canvas');
    const lctx = layer.getContext('2d');

    let W = 0, H = 0, dpr = 1;
    let heroRect = { left: 0, top: 0 };
    const C = { x: 0, y: 0, r: 0 };
    let traces = [];
    let embers = [];
    let bolts = [];
    let nextBolt = 0;
    let flash = 0;

    const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
      .map(([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; });

    function resize() {
      const r = hero.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 1.75);
      [canvas, layer].forEach((c) => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const h = hud.getBoundingClientRect();
      C.x = h.left - r.left + h.width / 2;
      C.y = h.top - r.top + h.height / 2;
      C.r = h.width * 0.36;
      buildTraces();
      drawLayer();
    }

    function buildTraces() {
      traces = [];
      const n = W < 700 ? 11 : 24;
      const margin = 60;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-.14, .14);
        const h0 = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
        let x = C.x + Math.cos(a) * C.r * 1.02;
        let y = C.y + Math.sin(a) * C.r * 1.02;
        const pts = [[x, y]];
        let guard = 0;
        while (guard++ < 22) {
          const turn = [-1, 0, 0, 0, 1][Math.floor(Math.random() * 5)];
          const h = (h0 + turn + 8) % 8;
          const len = rnd(40, 150);
          x += DIR[h][0] * len; y += DIR[h][1] * len;
          pts.push([x, y]);
          if (x < -margin || x > W + margin || y < -margin || y > H + margin) break;
        }
        let total = 0;
        const cum = [0];
        for (let k = 1; k < pts.length; k++) {
          total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
          cum.push(total);
        }
        const pulses = [];
        const count = Math.random() < .45 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          pulses.push({ d: -rnd(0, total * .9), v: rnd(110, 260), trail: rnd(70, 150), hot: Math.random() < .22 });
        }
        traces.push({ pts, cum, total, pulses });
      }
    }

    function drawLayer() {
      lctx.clearRect(0, 0, W, H);
      lctx.lineWidth = 1;
      lctx.lineJoin = 'round';
      traces.forEach((tr) => {
        lctx.strokeStyle = 'rgba(255,70,50,.17)';
        lctx.beginPath();
        tr.pts.forEach(([x, y], i) => (i ? lctx.lineTo(x, y) : lctx.moveTo(x, y)));
        lctx.stroke();
        lctx.fillStyle = 'rgba(255,100,70,.45)';
        tr.pts.forEach(([x, y], i) => {
          if (i === 0 || i === tr.pts.length - 1) return;
          lctx.beginPath(); lctx.arc(x, y, 1.8, 0, 6.2832); lctx.fill();
        });
        const end = tr.pts[tr.pts.length - 1];
        lctx.strokeStyle = 'rgba(255,110,80,.35)';
        lctx.beginPath(); lctx.arc(end[0], end[1], 4, 0, 6.2832); lctx.stroke();
      });
    }

    function pointAt(tr, d) {
      d = clamp(d, 0, tr.total);
      let i = 1;
      while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
      const seg = (tr.cum[i] - tr.cum[i - 1]) || 1;
      const t = (d - tr.cum[i - 1]) / seg;
      return [lerp(tr.pts[i - 1][0], tr.pts[i][0], t), lerp(tr.pts[i - 1][1], tr.pts[i][1], t)];
    }

    function jag(x1, y1, x2, y2, disp, out) {
      if (disp < 5) { out.push([x2, y2]); return; }
      const mx = (x1 + x2) / 2 + rnd(-disp, disp);
      const my = (y1 + y2) / 2 + rnd(-disp, disp);
      jag(x1, y1, mx, my, disp / 2, out);
      jag(mx, my, x2, y2, disp / 2, out);
    }

    function burst(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, 6.2832);
        const sp = rnd(30, 150);
        embers.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0, max: rnd(.5, 1.3), s: rnd(1, 2.4), ph: rnd(0, 6.28), spark: true });
      }
    }

    function spawnBolt(sx, sy, tx, ty) {
      if (sx == null) {
        const side = Math.random();
        if (side < .55) { sx = rnd(W * .1, W * .9); sy = -10; }
        else if (side < .78) { sx = -10; sy = rnd(0, H * .5); }
        else { sx = W + 10; sy = rnd(0, H * .5); }
      }
      if (tx == null) {
        const a = rnd(-2.7, -.45);
        tx = C.x + Math.cos(a) * C.r * .98;
        ty = C.y + Math.sin(a) * C.r * .98;
      }
      const pts = [[sx, sy]];
      jag(sx, sy, tx, ty, Math.hypot(tx - sx, ty - sy) * .17, pts);
      const branches = [];
      for (let k = 0; k < 3; k++) {
        const i = Math.floor(rnd(pts.length * .2, pts.length * .8));
        const [bx, by] = pts[i];
        const ang = Math.atan2(ty - sy, tx - sx) + rnd(-1, 1) * .9;
        const len = rnd(60, 180);
        const bp = [[bx, by]];
        jag(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, len * .3, bp);
        branches.push(bp);
      }
      bolts.push({ pts, branches, t: 0, life: rnd(.3, .46) });
      flash = Math.max(flash, .24);
      burst(tx, ty, 14);
    }

    function strokePath(pts, w, col, a) {
      ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }

    function update(now, dt) {
      const r = hero.getBoundingClientRect();
      heroRect = r;
      const px = S.cx - r.left;
      const py = S.cy - r.top;
      const dts = dt / 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(layer, 0, 0, W, H);

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      /* pulsos que viajan por las pistas */
      traces.forEach((tr) => {
        tr.pulses.forEach((p) => {
          p.d += p.v * dts;
          if (p.d - p.trail > tr.total) { p.d = -rnd(0, 420); p.v = rnd(110, 260); }
          if (p.d < 0) return;
          const steps = 9;
          let prev = pointAt(tr, p.d);
          for (let k = 1; k <= steps; k++) {
            const dk = p.d - (k / steps) * p.trail;
            if (dk < 0) break;
            const cur = pointAt(tr, dk);
            const f = 1 - k / steps;
            ctx.globalAlpha = f * .95;
            ctx.strokeStyle = p.hot ? 'rgb(255,215,190)' : `rgb(255,${70 + Math.round(f * 70)},45)`;
            ctx.lineWidth = .6 + f * 2.2;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
            prev = cur;
          }
          const head = pointAt(tr, p.d);
          ctx.globalAlpha = .28; ctx.fillStyle = 'rgb(255,60,40)';
          ctx.beginPath(); ctx.arc(head[0], head[1], 7, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = 'rgb(255,225,205)';
          ctx.beginPath(); ctx.arc(head[0], head[1], 2.1, 0, 6.2832); ctx.fill();
        });
      });

      /* brasas y chispas */
      const cap = W < 700 ? 34 : 80;
      let free = cap - embers.length;
      while (free-- > 0 && Math.random() < .5) {
        const a = rnd(0, 6.2832);
        const rr = C.r * rnd(.9, 1.25);
        embers.push({ x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr, vx: rnd(-8, 8), vy: -rnd(14, 46), life: 0, max: rnd(1.8, 3.8), s: rnd(.8, 2.1), ph: rnd(0, 6.28) });
      }
      embers = embers.filter((e) => {
        e.life += dts;
        if (e.life >= e.max) return false;
        e.x += (e.vx + (e.spark ? 0 : Math.sin(now / 600 + e.ph) * 14)) * dts;
        e.y += e.vy * dts;
        if (e.spark) { e.vx *= .96; e.vy = e.vy * .96 + 40 * dts; }
        const dx = e.x - px, dy = e.y - py, d2 = dx * dx + dy * dy;
        if (S.pointerSeen && d2 < 14400 && d2 > 1) { const d = Math.sqrt(d2); e.x += (dx / d) * (120 - d) * dts * 2.4; e.y += (dy / d) * (120 - d) * dts * 2.4; }
        const k = 1 - e.life / e.max;
        ctx.globalAlpha = k * (.55 + .45 * Math.sin(now / 90 + e.ph));
        ctx.fillStyle = e.spark ? 'rgb(255,200,150)' : `rgb(255,${100 + Math.round(k * 70)},50)`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, 6.2832); ctx.fill();
        return true;
      });

      /* rayos */
      if (now > nextBolt) { spawnBolt(); nextBolt = now + rnd(3000, 6400); }
      bolts = bolts.filter((b) => {
        b.t += dts;
        if (b.t > b.life) return false;
        const a = (1 - b.t / b.life) * (.65 + Math.random() * .35);
        strokePath(b.pts, 9, 'rgb(255,40,30)', a * .16);
        b.branches.forEach((bp) => strokePath(bp, 4, 'rgb(255,70,40)', a * .3));
        strokePath(b.pts, 3.2, 'rgb(255,110,60)', a * .55);
        strokePath(b.pts, 1.3, 'rgb(255,240,225)', a);
        b.branches.forEach((bp) => strokePath(bp, 1, 'rgb(255,200,170)', a * .8));
        return true;
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (flash > 0) {
        flash = Math.max(0, flash - dts * .9);
        hero.style.setProperty('--flash', flash.toFixed(3));
      }
    }

    function drawStatic() { ctx.clearRect(0, 0, W, H); ctx.drawImage(layer, 0, 0, W, H); }

    function zapAt(clientX, clientY) {
      const r = hero.getBoundingClientRect();
      const tx = clientX - r.left, ty = clientY - r.top;
      const ang = Math.atan2(ty - C.y, tx - C.x);
      spawnBolt(C.x + Math.cos(ang) * C.r, C.y + Math.sin(ang) * C.r, tx, ty);
    }

    resize();
    nextBolt = performance.now() + 1500;
    return { resize, update, drawStatic, zapAt, burst, arm() { nextBolt = performance.now() + 900; } };
  }

  /* ------------------------------------------------------------------ 5 */
  function initPointer(fx) {
    let spotEl = null;
    let magnet = null;

    function resetMagnet(m) { if (!m) return; m.style.setProperty('--tx', '0px'); m.style.setProperty('--ty', '0px'); }

    window.addEventListener('pointermove', (e) => {
      S.cx = e.clientX; S.cy = e.clientY;
      S.px = (e.clientX / S.vw - .5) * 2;
      S.py = (e.clientY / S.vh - .5) * 2;
      S.pointerSeen = true;

      const spot = e.target.closest && e.target.closest('[data-spot]');
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        spot.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
      spotEl = spot;

      if (mqFine.matches && !S.reduced) {
        const m = e.target.closest && e.target.closest('[data-magnetic]');
        if (magnet && magnet !== m) resetMagnet(magnet);
        magnet = m;
        if (m) {
          const r = m.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) * .22;
          const dy = (e.clientY - (r.top + r.height / 2)) * .3;
          m.style.setProperty('--tx', clamp(dx, -9, 9).toFixed(1) + 'px');
          m.style.setProperty('--ty', clamp(dy, -7, 7).toFixed(1) + 'px');
        }
      }
    }, { passive: true });

    document.addEventListener('pointerleave', () => { S.cx = S.cy = -9999; resetMagnet(magnet); magnet = null; });

    /* clic o toque en el hero: el logo dispara un rayo hacia tu dedo */
    const hero = $('#inicio');
    if (hero && fx && !S.reduced) {
      hero.addEventListener('pointerdown', (e) => {
        if (e.target.closest('a, button')) return;
        fx.zapAt(e.clientX, e.clientY);
      });
    }
  }

  /* ------------------------------------------------------------------ 6 */
  function sceneHero(fx) {
    const hero = $('#inicio');
    const tilt = $('#hud-tilt');
    const copy = $('.hero-copy');
    if (!hero) return null;
    let rx = 0, ry = 0, r = null, last = 0;
    return {
      el: hero,
      measure() { r = hero.getBoundingClientRect(); },
      apply(now) {
        const dt = Math.min(64, now - last || 16); last = now;
        if (S.reduced) return;
        /* tilt 3D: puntero en escritorio, flotación autónoma en táctil */
        const idleX = Math.sin(now / 1900) * 3.2, idleY = Math.cos(now / 2300) * 4.4;
        const usePtr = S.pointerSeen && mqFine.matches;
        const tx = usePtr ? -S.py * 8 : idleX;
        const ty = usePtr ? S.px * 11 : idleY;
        rx = lerp(rx, tx, .07); ry = lerp(ry, ty, .07);
        tilt.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        tilt.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        /* parallax de salida al hacer scroll */
        const p = clamp(-r.top / (r.height * .9));
        if (copy) {
          copy.style.translate = `0 ${(p * 70).toFixed(1)}px`;
          copy.style.opacity = String((1 - p * 1.1).toFixed(3));
        }
        if (fx) fx.update(now, dt);
      },
    };
  }

  /* Manifiesto: las palabras se encienden con el scroll */
  function sceneManifesto() {
    const sec = $('#nosotros');
    const txt = $('.manifesto-text');
    if (!sec || !txt) return null;
    const words = splitWords(txt, 'scrub');
    if (S.reduced) { words.forEach((w) => w.style.setProperty('--l', '1')); return null; }
    words.forEach((w) => { w.style.setProperty('--l', '0'); w._l = 0; });
    const n = words.length, ramp = 7;
    let cur = 0, r;
    return {
      el: sec,
      measure() { r = sec.getBoundingClientRect(); },
      apply() {
        const p = clamp(-r.top / Math.max(1, r.height - S.vh));
        cur = lerp(cur, p, .13);
        const head = cur * (n + ramp);
        for (let i = 0; i < n; i++) {
          const l = clamp((head - i) / ramp);
          if (Math.abs(l - words[i]._l) > .012) { words[i]._l = l; words[i].style.setProperty('--l', l.toFixed(3)); }
        }
      },
    };
  }

  /* ------------------------------------------------------------------ 7 */
  function sceneServices() {
    const sec = $('#servicios');
    const track = $('#svc-track');
    const bar = $('#svc-progress');
    if (!sec || !track) return null;
    const cards = $$('.svc-card', track);
    const imgs = cards.map((c) => $('.svc-img', c));
    let dist = 0, cur = 0, enabled = false, r, lefts = [], widths = [], nextTops = [], tops = [];

    function layout() {
      enabled = mqWide.matches && !S.reduced;
      if (!enabled) {
        sec.style.removeProperty('--pan-h');
        track.style.transform = '';
        imgs.forEach((i) => i && i.style.removeProperty('translate'));
        return;
      }
      track.style.transform = 'none';
      dist = Math.max(0, track.offsetWidth - S.vw);
      sec.style.setProperty('--pan-h', Math.round(dist + S.vh * 1.25) + 'px');
      lefts = cards.map((c) => c.offsetLeft);
      widths = cards.map((c) => c.offsetWidth);
    }

    const scene = {
      el: sec,
      layout,
      measure() {
        r = sec.getBoundingClientRect();
        if (!enabled && !S.reduced) {
          tops = cards.map((c) => c.getBoundingClientRect().top);
          nextTops = cards.map((c, i) => (cards[i + 1] ? cards[i + 1].getBoundingClientRect().top : 99999));
        }
      },
      apply() {
        if (S.reduced) return;
        if (enabled) {
          const p = mapR(clamp(-r.top / Math.max(1, r.height - S.vh)), .02, .98);
          cur = lerp(cur, p, .1);
          const x = -cur * dist;
          track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
          bar.style.setProperty('--pp', cur.toFixed(4));
          cards.forEach((c, i) => {
            const center = lefts[i] + widths[i] / 2 + x;
            if (center < -widths[i] || center > S.vw + widths[i]) return;
            imgs[i].style.translate = `${((center - S.vw / 2) * -.07).toFixed(1)}px 0`;
          });
        } else {
          /* móvil y tableta: la tarjeta que queda debajo se reduce al taparla */
          cards.forEach((c, i) => {
            if (i === cards.length - 1) return;
            const q = clamp(1 - (nextTops[i] - tops[i]) / (S.vh * .55));
            c.style.transformOrigin = '50% 0';
            c.style.scale = (1 - q * .05).toFixed(4);
          });
        }
      },
    };
    layout();
    return scene;
  }

  /* ------------------------------------------------------------------ 8 */
  function sceneSolar() {
    const sec = $('#solar');
    if (!sec) return null;
    const stage = $('#solar-stage');
    const sun = $('#sun');
    const arr = $('#array');
    const steps = $$('.s-step');
    const billNum = $('#bill-num');
    const badge = $('#bill-badge');
    const cta = $('#solar-cta');

    const cols = 8, rows = 4;
    const cells = [];
    for (let i = 0; i < cols * rows; i++) {
      const c = document.createElement('i');
      arr.appendChild(c);
      cells.push({ el: c, th: ((i % cols) / cols) * .6 + (Math.floor(i / cols) / rows) * .1, v: -1 });
    }

    const BILL_FROM = 4820, BILL_TO = 96;
    const fmt = new Intl.NumberFormat('es-MX');
    let cur = 0, r, sw = 0, sh = 0, sunW = 0, lastStep = -1, lastBill = '';

    function setState(p) {
      /* sol: sale del horizonte y sube en arco */
      const t = easeOut(mapR(p, 0, .6));
      const x = lerp(sw * .03, sw * (mqWide.matches ? .62 : .66) - sunW * .5, t);
      const y = lerp(sh - sunW * .45, sh * (mqWide.matches ? .15 : .03), t);
      sun.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${lerp(.82, 1.12, t).toFixed(3)})`;
      sec.style.setProperty('--sun', mapR(p, 0, .4).toFixed(3));
      sec.style.setProperty('--sp', p.toFixed(3));
      stage.style.setProperty('--fl', mapR(p, .34, .46).toFixed(3));

      /* paneles: se energizan de izquierda a derecha */
      cells.forEach((c) => {
        const lit = clamp((p - .1 - c.th * .5) / .18);
        if (Math.abs(lit - c.v) > .02) { c.v = lit; c.el.style.setProperty('--lit', lit.toFixed(3)); }
      });

      /* pasos */
      const idx = p < .34 ? 0 : p < .67 ? 1 : 2;
      if (idx !== lastStep) { steps.forEach((s, i) => s.classList.toggle('is-on', i === idx)); lastStep = idx; }

      /* recibo */
      const v = p < .62 ? BILL_FROM : lerp(BILL_FROM, BILL_TO, easeOut(mapR(p, .62, .92)));
      const text = fmt.format(Math.round(v));
      if (text !== lastBill) { billNum.textContent = text; lastBill = text; }
      badge.style.setProperty('--bs', mapR(p, .9, .98).toFixed(3));
      const c = mapR(p, .86, .96);
      cta.style.setProperty('--cta', c.toFixed(3));
      cta.classList.toggle('show', c > .9);
    }

    function measureStage() { sw = stage.clientWidth; sh = stage.clientHeight; sunW = sun.offsetWidth; }
    measureStage();

    if (S.reduced) { setState(1); return null; }
    setState(0);

    return {
      el: sec,
      layout: measureStage,
      measure() { r = sec.getBoundingClientRect(); },
      apply() {
        const p = clamp(-r.top / Math.max(1, r.height - S.vh));
        cur = lerp(cur, p, .1);
        setState(cur);
      },
    };
  }

  /* ------------------------------------------------------------------ 9 */
  function sceneExpand() {
    const sec = $('#resultados');
    const media = $('#expand-media');
    const title = $('.expand-title');
    const stats = $('#expand-stats');
    if (!sec || !media) return null;

    const counters = $$('[data-count]', stats);
    let counted = false, cur = 0, r, titleH = 0;

    function setState(p) {
      const mobile = S.vw < 768;
      const e = easeInOut(mapR(p, 0, .6));
      const ix0 = mobile ? 9 : 24, it0 = mobile ? 24 : 22;
      media.style.setProperty('--ix', (ix0 * (1 - e)).toFixed(2) + '%');
      media.style.setProperty('--it', (it0 * (1 - e)).toFixed(2) + '%');
      media.style.setProperty('--rad', (30 * (1 - e)).toFixed(1) + 'px');
      media.style.setProperty('--zs', (1.3 - .3 * e).toFixed(3));
      const topNow = S.vh / 2 - titleH / 2;
      const topEnd = mobile ? 92 : 116;
      title.style.setProperty('--ty', (e * (topEnd - topNow)).toFixed(1) + 'px');
      title.style.setProperty('--ts', lerp(1, mobile ? .6 : .56, e).toFixed(3));
      const st = mapR(p, .68, .86);
      stats.style.setProperty('--st', st.toFixed(3));
      if (st > .15 && !counted) { counted = true; counters.forEach(runCount); }
    }

    titleH = title.offsetHeight;
    if (S.reduced) { setState(1); return null; }
    setState(0);

    return {
      el: sec,
      layout() { titleH = title.offsetHeight; setState(cur); },
      measure() { r = sec.getBoundingClientRect(); },
      apply() {
        const p = clamp(-r.top / Math.max(1, r.height - S.vh));
        cur = lerp(cur, p, .12);
        setState(cur);
      },
    };
  }

  /* ----------------------------------------------------------------- 10 */
  function sceneTimeline() {
    const tl = $('#timeline');
    if (!tl) return null;
    const line = $('.tl-line', tl);
    const steps = $$('.tl-step', tl);
    if (S.reduced) { line.style.setProperty('--tp', '1'); steps.forEach((s) => s.classList.add('on')); return null; }
    let cur = 0, r, centers = [];
    return {
      el: tl,
      measure() {
        r = tl.getBoundingClientRect();
        centers = steps.map((s) => { const b = s.getBoundingClientRect(); return b.top + b.height / 2; });
      },
      apply() {
        const trigger = S.vh * .62;
        const raw = clamp((trigger - r.top) / Math.max(1, r.height));
        cur = lerp(cur, raw, .14);
        line.style.setProperty('--tp', cur.toFixed(4));
        line.style.setProperty('--th', raw > .005 && raw < .995 ? '1' : '0');
        steps.forEach((s, i) => s.classList.toggle('on', centers[i] < trigger));
      },
    };
  }

  function sceneMarquee() {
    const track = $('#marquee-track');
    if (!track || S.reduced) return null;
    track.style.animation = 'none';
    let x = 0, half = 0, last = 0;
    function layout() { half = track.scrollWidth / 2; }
    layout();
    return {
      el: track.parentElement,
      layout,
      measure() {},
      apply(now) {
        const dt = Math.min(64, now - last || 16); last = now;
        /* velocidad base + impulso por velocidad de scroll */
        const speed = 62 + Math.min(Math.abs(S.vel) * 900, 900);
        x -= speed * dt / 1000;
        if (-x >= half) x += half;
        track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      },
    };
  }

  function sceneFooter() {
    const footer = $('.footer');
    const mark = $('#footer-mark');
    if (!footer || !mark || S.reduced) return null;
    let r;
    return {
      el: footer,
      measure() { r = footer.getBoundingClientRect(); },
      apply() {
        const p = clamp((S.vh - r.top) / Math.max(1, r.height * .9));
        mark.style.setProperty('--fy', ((1 - p) * 90).toFixed(1) + 'px');
      },
    };
  }

  /* Barra de progreso, navegación y scrollspy */
  function initNav() {
    const nav = $('#nav');
    const bar = $('#nav-progress');
    const links = $$('.nav-links a');
    let lastScrolled = null;
    const sync = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - S.vh);
      bar.style.setProperty('--sp', clamp(S.y / max).toFixed(4));
      const scrolled = S.y > 40;
      if (scrolled !== lastScrolled) { nav.classList.toggle('is-scrolled', scrolled); lastScrolled = scrolled; }
    };

    if ('IntersectionObserver' in window) {
      const map = new Map();
      links.forEach((a) => { const t = $(a.getAttribute('href')); if (t) map.set(t, a); });
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const a = map.get(e.target);
          if (a && e.isIntersecting) { links.forEach((l) => l.classList.toggle('is-active', l === a)); }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      map.forEach((_, el) => io.observe(el));
    }
    return sync;
  }

  /* ----------------------------------------------------------------- 11 */
  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return () => {};
    let closeTimer;
    function open() {
      clearTimeout(closeTimer);
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('open'));
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Cerrar menú');
      root.classList.add('menu-open');
      const first = $('a', menu); if (first) setTimeout(() => first.focus({ preventScroll: true }), 120);
    }
    function close() {
      if (menu.hidden) return;
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Abrir menú');
      root.classList.remove('menu-open');
      closeTimer = setTimeout(() => { menu.hidden = true; }, 520);
    }
    burger.addEventListener('click', () => (burger.getAttribute('aria-expanded') === 'true' ? close() : open()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); burger.focus(); } });
    mqWide.addEventListener('change', (e) => { if (e.matches) close(); });
    return close;
  }

  function initAnchors(closeMenu) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const y = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: y, behavior: S.reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  }

  function initFAQ() {
    const items = $$('.faq-item');
    items.forEach((item) => {
      const btn = $('.faq-q', item);
      btn.addEventListener('click', () => {
        const willOpen = !item.classList.contains('open');
        items.forEach((i) => {
          if (i !== item && i.classList.contains('open')) { i.classList.remove('open'); $('.faq-q', i).setAttribute('aria-expanded', 'false'); }
        });
        item.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
    });
    if (items[0]) { items[0].classList.add('open'); $('.faq-q', items[0]).setAttribute('aria-expanded', 'true'); }
  }

  function initCalc() {
    const range = $('#bill-range');
    if (!range) return;
    const out = $('#bill-out');
    const rNew = $('#r-new'), rYear = $('#r-year'), rPanels = $('#r-panels'), r25 = $('#r-25');
    const cta = $('#calc-cta');
    const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const SAVE = .98;       /* ahorro máximo anunciado: "hasta 98%" */
    const MAX_PAY = 200;    /* tope del cliente: con paneles, por bimestre se paga máximo esto */
    const TARIFF = 2.8;     /* MXN por kWh, promedio de referencia */
    const PANEL_KWH = 60;   /* kWh por mes que produce un panel de ~550 W en Guadalajara */

    function tween(el, to, fmt) {
      const from = el._v == null ? to : el._v;
      el._v = to;
      if (S.reduced || from === to) { el.textContent = fmt(to); return; }
      const t0 = performance.now();
      cancelAnimationFrame(el._raf);
      (function step(now) {
        const p = easeOut(clamp((now - t0) / 520));
        el.textContent = fmt(lerp(from, to, p));
        if (p < 1) el._raf = requestAnimationFrame(step);
      })(t0);
    }

    function render() {
      const b = +range.value;
      const pay = Math.min(Math.round(b * (1 - SAVE)), MAX_PAY);
      const year = (b - pay) * 6;
      const panels = Math.max(3, Math.ceil((b / TARIFF / 2) / PANEL_KWH));
      out.textContent = money.format(b);
      range.style.setProperty('--fill-p', (((b - +range.min) / (+range.max - +range.min)) * 100).toFixed(1) + '%');
      tween(rNew, pay, (v) => money.format(Math.round(v)));
      tween(rYear, year, (v) => money.format(Math.round(v)));
      tween(rPanels, panels, (v) => String(Math.round(v)));
      tween(r25, year * 25, (v) => money.format(Math.round(v)));
      cta.href = waLink(`Hola, pago aprox. ${money.format(b)} de luz por bimestre y quiero cotizar paneles solares. Calculé un ahorro de hasta ${money.format(year)} al año.`);
    }
    range.addEventListener('input', render);
    render();
  }

  function initForm() {
    const form = $('#wa-form');
    if (!form) return;
    const name = $('#f-name'), service = $('#f-service'), msg = $('#f-msg');
    const eName = $('#e-name'), eService = $('#e-service');
    const label = $('#f-btn-label');
    const original = label.textContent;

    const mark = (input, errEl, text) => {
      const box = input.closest('.control');
      box.classList.toggle('invalid', !!text);
      errEl.textContent = text || '';
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
    };
    name.addEventListener('input', () => mark(name, eName, ''));
    service.addEventListener('change', () => mark(service, eService, ''));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = name.value.trim();
      let bad = null;
      if (n.length < 2) { mark(name, eName, 'Escribe tu nombre para saber a quién responderle.'); bad = bad || name; } else mark(name, eName, '');
      if (!service.value) { mark(service, eService, 'Elige qué necesitas para atenderte mejor.'); bad = bad || service; } else mark(service, eService, '');
      if (bad) { bad.focus(); return; }

      const extra = msg.value.trim();
      const text = `Hola LTL Electricistas, soy ${n}. Me interesa: ${service.value}.${extra ? ' ' + extra : ''} Quiero mi visita técnica gratis.`;
      label.textContent = 'Abriendo WhatsApp...';
      const win = window.open(waLink(text), '_blank', 'noopener');
      if (!win) window.location.href = waLink(text);
      setTimeout(() => { label.textContent = original; }, 3200);
    });
  }

  function initBreaker() {
    const sw = $('#breaker');
    const sec = $('#emergencias');
    const state = $('#breaker-state');
    if (!sw || !sec) return;
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      sec.classList.toggle('is-on', on);
      state.textContent = on ? 'Atención de emergencia activa. Escríbenos ahora.' : 'Sin energía. Toca el interruptor.';
      if (navigator.vibrate && on) navigator.vibrate(24);
    });
  }

  function initReel() {
    const video = $('#reel');
    const btn = $('#reel-sound');
    if (!video) return;
    if ('IntersectionObserver' in window && !S.reduced) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) video.play().catch(() => {});
          else video.pause();
        });
      }, { threshold: .35 });
      io.observe(video);
    }
    if (btn) {
      btn.addEventListener('click', () => {
        video.muted = !video.muted;
        btn.setAttribute('aria-pressed', String(!video.muted));
        btn.setAttribute('aria-label', video.muted ? 'Activar sonido del video' : 'Silenciar video');
        if (!video.muted) video.play().catch(() => {});
      });
    }
  }

  function initWhatsAppTip() {
    const tip = $('#wa-tip');
    if (!tip) return;
    setTimeout(() => tip.classList.add('show'), 9000);
    setTimeout(() => tip.classList.remove('show'), 15500);
  }

  /* ----------------------------------------------------------------- main */
  function boot() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    const closeMenu = safe(initMenu) || (() => {});
    safe(() => initAnchors(closeMenu));
    safe(initReveal);
    safe(initFAQ);
    safe(initCalc);
    safe(initForm);
    safe(initBreaker);
    safe(initReel);
    const syncNav = safe(initNav) || (() => {});

    const fx = safe(createFX);
    safe(() => initPointer(fx));

    [safe(() => sceneHero(fx)), safe(sceneManifesto), safe(sceneServices), safe(sceneSolar),
      safe(sceneExpand), safe(sceneTimeline), safe(sceneMarquee), safe(sceneFooter)].forEach(addScene);

    /* activar solo las escenas cercanas a la pantalla */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { const s = sceneByEl.get(e.target); if (s) s.active = e.isIntersecting; });
      }, { rootMargin: '120% 0px 120% 0px' });
      scenes.forEach((s) => io.observe(s.el));
    } else {
      scenes.forEach((s) => { s.active = true; });
    }

    if (S.reduced && fx) fx.drawStatic();

    const layoutAll = () => {
      S.vw = window.innerWidth; S.vh = window.innerHeight;
      if (fx) fx.resize();
      scenes.forEach((s) => s.layout && s.layout());
      if (S.reduced && fx) fx.drawStatic();
    };
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layoutAll, 160); });
    window.addEventListener('orientationchange', () => setTimeout(layoutAll, 260));
    mqWide.addEventListener('change', layoutAll);
    window.addEventListener('load', () => setTimeout(layoutAll, 80));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(layoutAll, 40));

    /* bucle principal: lecturas, luego escrituras */
    let last = performance.now();
    function loop(now) {
      const dt = Math.max(1, now - last); last = now;
      const y = window.scrollY;
      S.vel = lerp(S.vel, (y - S.y) / dt, .18);
      S.y = y;
      const live = scenes.filter((s) => s.active);
      live.forEach((s) => s.measure && s.measure(now));
      live.forEach((s) => s.apply && s.apply(now));
      syncNav();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    initLoader(() => { safe(initWhatsAppTip); if (fx) fx.arm(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
