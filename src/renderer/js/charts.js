/*!
 * COMPTABLOO — Graphiques dessinés en Canvas (aucune bibliothèque externe).
 * Deux graphiques : barres groupées (revenus/dépenses) et anneau (répartition).
 * Dégradation silencieuse si le canvas n'est pas disponible (tests automatisés).
 */
(function (root) {
  'use strict';

  const registry = []; // graphiques actifs, redessinés au redimensionnement
  let resizeBound = false;

  function ctx2d(canvas) {
    try {
      return canvas.getContext ? canvas.getContext('2d') : null;
    } catch (e) {
      return null;
    }
  }

  /** Prépare un canvas haute résolution (devicePixelRatio). */
  function prepare(canvas, cssHeight) {
    if (!canvas || !canvas.getContext) return null;
    const c = ctx2d(canvas);
    if (!c) return null;
    const parent = canvas.parentNode;
    const w = Math.max(80, parent ? parent.clientWidth : canvas.clientWidth || 300);
    const hgt = Math.max(60, cssHeight || (parent ? parent.clientHeight : 0) || 220);
    const dpr = (root.devicePixelRatio || 1) * 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = hgt + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, w: w, h: hgt };
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    let nice;
    if (n <= 1) nice = 1;
    else if (n <= 2) nice = 2;
    else if (n <= 2.5) nice = 2.5;
    else if (n <= 5) nice = 5;
    else nice = 10;
    return nice * pow;
  }

  function shorten(n) {
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + 'Md';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.0', '') + 'k';
    return String(Math.round(n));
  }

  /* ------------------------------------------------------------------ */
  /* Barres groupées                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts {labels:[...], series:[{name,color,values:[...]}], height}
   */
  function barChart(canvas, opts) {
    const p = prepare(canvas, opts.height || 240);
    if (!p) return;
    const { c, w, h } = p;
    const labels = opts.labels || [];
    const series = opts.series || [];
    const padL = 46;
    const padR = 10;
    const padT = 18;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let max = 0;
    series.forEach(function (s) { (s.values || []).forEach(function (v) { if (v > max) max = v; }); });
    max = niceMax(max * 1.05);

    c.clearRect(0, 0, w, h);

    // Grille + axe Y
    c.font = '10.5px "Segoe UI", sans-serif';
    c.fillStyle = '#8A94A6';
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padT + plotH - (plotH * i) / steps;
      c.strokeStyle = i === 0 ? '#DCE4F0' : '#EDF2F8';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(padL, y + 0.5);
      c.lineTo(w - padR, y + 0.5);
      c.stroke();
      c.fillText(shorten((max * i) / steps), padL - 8, y);
    }

    // Barres
    const n = labels.length || 1;
    const slot = plotW / n;
    const groupW = Math.min(slot * 0.62, 56);
    const barW = series.length ? groupW / series.length : groupW;

    labels.forEach(function (label, i) {
      const cx = padL + slot * i + slot / 2;
      series.forEach(function (s, si) {
        const v = (s.values || [])[i] || 0;
        if (v <= 0) return;
        const bh = (v / max) * plotH;
        const x = cx - groupW / 2 + si * barW + 1.5;
        const y = padT + plotH - bh;
        const r = Math.min(5, barW / 2.2, bh);
        c.fillStyle = s.color;
        c.beginPath();
        c.moveTo(x, y + bh);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.lineTo(x + barW - 3, y);
        c.quadraticCurveTo(x + barW - 3 + 0, y, x + barW - 3, y + r);
        c.lineTo(x + barW - 3, y + bh);
        c.closePath();
        c.fill();
      });
      // Étiquette X (une ligne sur deux si largeur insuffisante)
      const every = slot < 38 ? 3 : (slot < 52 ? 2 : 1);
      if (i % every === 0 || i === labels.length - 1) {
        c.fillStyle = '#8A94A6';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillText(String(label), cx, padT + plotH + 8);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Anneau (donut)                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Array} items [{label, value, color}]
   * @param {Object} opts {height, centerLabel, centerValue}
   */
  function donutChart(canvas, items, opts) {
    const p = prepare(canvas, opts.height || 220);
    if (!p) return;
    const { c, w, h } = p;
    const total = items.reduce(function (s, it) { return s + (it.value || 0); }, 0);
    c.clearRect(0, 0, w, h);
    if (total <= 0) {
      c.font = '12.5px "Segoe UI", sans-serif';
      c.fillStyle = '#8A94A6';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('Aucune donnée sur la période', w / 2, h / 2);
      return;
    }
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 8;
    const r = R * 0.62;
    let a0 = -Math.PI / 2;
    items.forEach(function (it) {
      const frac = (it.value || 0) / total;
      if (frac <= 0) return;
      const a1 = a0 + frac * Math.PI * 2;
      c.fillStyle = it.color;
      c.beginPath();
      c.arc(cx, cy, R, a0, a1);
      c.arc(cx, cy, r, a1, a0, true);
      c.closePath();
      c.fill();
      a0 = a1;
    });
    // Trou central
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(cx, cy, r - 1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#02123A';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 15px "Segoe UI", sans-serif';
    c.fillText(opts.centerValue || shorten(total), cx, cy - 8);
    c.font = '10.5px "Segoe UI", sans-serif';
    c.fillStyle = '#8A94A6';
    c.fillText(opts.centerLabel || '', cx, cy + 10);
  }

  /* ------------------------------------------------------------------ */
  /* Enregistrement & redimensionnement                                  */
  /* ------------------------------------------------------------------ */

  function track(fn) {
    registry.push(fn);
    fn();
    if (!resizeBound) {
      resizeBound = true;
      let t = null;
      root.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          registry.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
        }, 150);
      });
    }
  }

  function reset() {
    registry.length = 0;
  }

  root.COMPTA = root.COMPTA || {};
  root.COMPTA.charts = {
    barChart: barChart,
    donutChart: donutChart,
    track: track,
    reset: reset,
    shorten: shorten
  };
})(typeof window !== 'undefined' ? window : this);
