/*!
 * COMPTABLOO — Aides d'interface (DOM, modales, toasts, icônes, impression).
 * Dépend de : COMPTA.logic, COMPTA.db (pour l'export CSV selon le mode).
 */
(function (root) {
  'use strict';
  const L = root.COMPTA && root.COMPTA.logic;

  /* ------------------------------------------------------------------ */
  /* Icônes SVG (jeu « feather », trait 2, aucune dépendance externe)     */
  /* ------------------------------------------------------------------ */
  const PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    sales: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
    purchases: '<circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    stock: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    clients: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    suppliers: '<rect x="1" y="3" width="15" height="13" rx="1.5"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    accounting: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    reports: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>',
    settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    payment: '<rect x="1" y="4" width="22" height="16" rx="2.5"/><line x1="1" y1="10" x2="23" y2="10"/>',
    convert: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    wallet: '<path d="M20 7H4a2 2 0 0 1 0-4h14v4"/><path d="M20 7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5"/><circle cx="16" cy="14" r="1.2"/>',
    trendUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    trendDown: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M16.71 13.88l.7.71-2.82 2.82"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 15"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    users2: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    reset: '<path d="M3 2v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 8"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'
  };

  function icon(name, size) {
    const s = size || 24;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="' + s + '" height="' + s + '" aria-hidden="true">' + (PATHS[name] || PATHS.info) + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */

  function qs(sel, scope) { return (scope || document).querySelector(sel); }
  function qsa(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Créateur d'éléments concis.
   * h('div', {class:'x', onclick: fn}, enfant1, 'texte', ...)
   */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v == null) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'disabled') { if (v) el.disabled = true; }
        else el.setAttribute(k, v);
      });
    }
    for (let i = 2; i < arguments.length; i++) {
      const child = arguments[i];
      if (child == null || child === false) continue;
      if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
      else append(el, child);
    }
    return el;
  }

  function append(el, child) {
    if (child == null || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') el.appendChild(document.createTextNode(String(child)));
    else el.appendChild(child);
  }

  /* ------------------------------------------------------------------ */
  /* Formatage (délègue à la logique avec la devise courante)            */
  /* ------------------------------------------------------------------ */

  function store() { return root.COMPTA && root.COMPTA.store; }

  function money(v) {
    const st = store();
    return L.formatMoney(v, st && st.state ? st.state.settings : null);
  }

  function moneyOrDash(v) {
    const n = Number(v) || 0;
    return n === 0 ? '—' : money(n);
  }

  function fmtDate(iso) { return L.formatDate(iso); }

  /* ------------------------------------------------------------------ */
  /* Modales                                                             */
  /* ------------------------------------------------------------------ */

  let openModals = 0;

  /**
   * Ouvre une modale centrée.
   * @returns {{root:Element, body:Element, close:Function}}
   */
  function modal(opts) {
    const o = opts || {};
    const rootEl = h('div', { class: 'modal-overlay' });
    const box = h('div', { class: 'modal' + (o.wide ? ' wide' : '') + (o.mid ? ' mid' : '') });
    const header = h('div', { class: 'modal-h' },
      h('div', null,
        h('h3', { text: o.title || '' }),
        o.subtitle ? h('div', { class: 'modal-sub', text: o.subtitle }) : null
      ),
      h('button', {
        class: 'icon-btn', type: 'button', title: 'Fermer', html: icon('close', 16),
        onclick: function () { close(); }
      })
    );
    const body = h('div', { class: 'modal-body' });
    box.appendChild(header);
    box.appendChild(body);
    if (o.footer !== false) {
      const foot = h('div', { class: 'modal-f' });
      if (o.cancelText !== null) {
        foot.appendChild(h('button', {
          class: 'btn btn-outline', type: 'button', text: o.cancelText || 'Annuler',
          onclick: function () { close(); }
        }));
      }
      if (o.okText) {
        foot.appendChild(h('button', {
          class: 'btn ' + (o.okClass || 'btn-primary'), type: 'button', html: icon(o.okIcon || 'check', 16) + ' ' + escapeHtml(o.okText),
          onclick: function () { if (o.onOk) o.onOk(close, body); }
        }));
      }
      box.appendChild(foot);
    }
    rootEl.appendChild(box);
    rootEl.addEventListener('mousedown', function (e) {
      if (e.target === rootEl && !o.blockBackdrop) close();
    });
    document.getElementById('modal-root').appendChild(rootEl);
    openModals += 1;

    function close() {
      if (!rootEl.parentNode) return;
      openModals -= 1;
      rootEl.remove();
      if (o.onClose) o.onClose();
    }

    // Échap ferme la dernière modale ouverte
    rootEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    box.tabIndex = -1;
    setTimeout(function () {
      const first = body.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 30);

    return { root: rootEl, body: body, close: close };
  }

  /** Boîte de confirmation (Promesse<boolean>). */
  function confirm(opts) {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {});
    return new Promise(function (resolve) {
      let done = false;
      const m = modal({
        title: o.title || 'Confirmer',
        blockBackdrop: true,
        okText: o.okText || 'Confirmer',
        okClass: o.danger ? 'btn-danger-solid' : 'btn-primary',
        cancelText: 'Annuler',
        onOk: function (close) { done = true; close(); resolve(true); },
        onClose: function () { if (!done) resolve(false); }
      });
      m.body.appendChild(h('div', { class: 'small', style: { lineHeight: '1.6' }, html: (o.message || '').replace(/\n/g, '<br>') }));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */

  function toast(message, type) {
    const t = type || 'success';
    const iconName = t === 'error' ? 'alert' : (t === 'info' ? 'info' : 'check');
    const el = h('div', { class: 'toast ' + t }, h('span', { html: icon(iconName, 18) }), h('div', { text: message }));
    document.getElementById('toast-root').appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 3400);
  }

  /* ------------------------------------------------------------------ */
  /* États vides                                                         */
  /* ------------------------------------------------------------------ */

  function emptyState(opts) {
    const o = opts || {};
    return h('div', { class: 'empty' },
      h('div', { html: icon(o.icon || 'inbox', 44) }),
      h('h4', { text: o.title || 'Rien pour le moment' }),
      h('p', { text: o.text || '' }),
      o.action ? o.action : null
    );
  }

  /* ------------------------------------------------------------------ */
  /* Impression (factures, devis, rapports)                              */
  /* ------------------------------------------------------------------ */

  let printing = false;

  /** Imprime le HTML fourni ( feuille A4 dédiée, l'interface est masquée ). */
  function printHTML(html) {
    const rootEl = document.getElementById('print-root');
    rootEl.innerHTML = html;
    document.body.classList.add('printing');
    printing = true;
    const cleanup = function () {
      if (!printing) return;
      printing = false;
      document.body.classList.remove('printing');
      rootEl.innerHTML = '';
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    // Filet de sécurité si afterprint ne se déclenche pas
    setTimeout(cleanup, 60000);
    try {
      window.print();
    } catch (e) {
      cleanup();
      toast('Impression impossible : ' + e.message, 'error');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Export CSV (via boîte de dialogue Electron, ou téléchargement web)  */
  /* ------------------------------------------------------------------ */

  /**
   * @param {string} defaultName  ex. 'ventes-2026.csv'
   * @param {Array<Array>} rows   lignes déjà séparées (strings/numbers)
   */
  async function exportCSV(defaultName, rows) {
    const esc = function (v) {
      const s = String(v == null ? '' : v);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const content = rows.map(function (r) { return r.map(esc).join(';'); }).join('\r\n');
    const db = root.COMPTA && root.COMPTA.db;
    if (db && db.isElectron()) {
      const res = await db.exportCSV(defaultName, content);
      if (res && res.ok) toast('Fichier exporté : ' + res.path);
      else if (res && res.error) toast('Export impossible : ' + res.error, 'error');
      return;
    }
    // Mode navigateur : téléchargement
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast('Fichier téléchargé : ' + defaultName);
  }

  /* ------------------------------------------------------------------ */
  /* Badges prêts à l'emploi                                             */
  /* ------------------------------------------------------------------ */

  const STATUS_LABELS = {
    paid: 'Payée', partial: 'Partielle', unpaid: 'Impayée', overdue: 'En retard',
    pending: 'En attente', converted: 'Facturée'
  };

  function docBadge(doc, settings, todayIso) {
    const st = L.docStatus(doc, settings);
    const overdue = L.isOverdue(doc, settings, todayIso);
    let cls = 'grey';
    let label = STATUS_LABELS[st] || st;
    if (st === 'paid') cls = 'green';
    else if (st === 'partial') cls = 'amber';
    else if (st === 'unpaid') cls = overdue ? 'red' : 'blue';
    else if (st === 'pending') cls = 'grey';
    else if (st === 'converted') cls = 'green';
    if (overdue && st !== 'paid') { label = 'En retard'; cls = 'red'; }
    return '<span class="badge badge-' + cls + '"><span class="dot"></span>' + label + '</span>';
  }

  function stockBadge(status) {
    if (status === 'out') return '<span class="badge badge-red"><span class="dot"></span>Rupture</span>';
    if (status === 'low') return '<span class="badge badge-amber"><span class="dot"></span>Stock faible</span>';
    return '<span class="badge badge-green"><span class="dot"></span>Disponible</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Tri de tableaux                                                     */
  /* ------------------------------------------------------------------ */

  function makeSortable(table, rows, defaultKey, defaultDir, renderRow) {
    let key = defaultKey;
    let dir = defaultDir || 'desc';

    function valueOf(row) {
      const v = typeof key === 'function' ? key(row) : row[key];
      return v;
    }
    function apply() {
      rows.sort(function (a, b) {
        const va = valueOf(a);
        const vb = valueOf(b);
        if (va === vb) return 0;
        const r = (typeof va === 'number' && typeof vb === 'number') ? va - vb : String(va).localeCompare(String(vb), 'fr');
        return dir === 'asc' ? r : -r;
      });
      const tbody = table.querySelector('tbody');
      tbody.innerHTML = '';
      rows.forEach(function (row) { tbody.appendChild(renderRow(row)); });
      qsa('th[data-sort]', table).forEach(function (th) {
        th.classList.toggle('sortable', true);
        const base = th.getAttribute('data-sort-label') || th.textContent;
        if (th.getAttribute('data-sort') === key) th.textContent = base + (dir === 'asc' ? ' ↑' : ' ↓');
        else th.textContent = base;
      });
    }
    qsa('th[data-sort]', table).forEach(function (th) {
      th.setAttribute('data-sort-label', th.textContent);
      th.classList.add('sortable');
      th.addEventListener('click', function () {
        const k = th.getAttribute('data-sort');
        if (k === key) dir = dir === 'asc' ? 'desc' : 'asc';
        else { key = k; dir = 'asc'; }
        apply();
      });
    });
    apply();
    return { refresh: apply };
  }

  /* ------------------------------------------------------------------ */

  root.COMPTA = root.COMPTA || {};
  root.COMPTA.ui = {
    icon: icon,
    ICONS: PATHS,
    qs: qs,
    qsa: qsa,
    h: h,
    escapeHtml: escapeHtml,
    money: money,
    moneyOrDash: moneyOrDash,
    fmtDate: fmtDate,
    modal: modal,
    confirm: confirm,
    toast: toast,
    emptyState: emptyState,
    printHTML: printHTML,
    exportCSV: exportCSV,
    docBadge: docBadge,
    stockBadge: stockBadge,
    STATUS_LABELS: STATUS_LABELS,
    makeSortable: makeSortable
  };
})(typeof window !== 'undefined' ? window : this);
