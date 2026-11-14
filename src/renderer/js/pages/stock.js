/*!
 * COMPTABLOO — Page « Stock » : produits, valorisation, alertes,
 * ajustements manuels et historique des mouvements.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  const filters = { q: '', cat: 'all', low: false, showArchived: false };

  const UNITS = ['pièce', 'sac', 'carton', 'kg', 'litre', 'mètre', 'paquet', 'rouleau', 'lot'];

  function render(el) {
    const st = root.COMPTA.store;
    const S = st.state;

    el.innerHTML = '';

    /* ---------- KPIs ---------- */
    const value = L.stockValue(S);
    const low = L.lowStockProducts(S);
    const active = S.products.filter(function (p) { return !p.archived; });
    el.appendChild(h('div', { class: 'kpi-grid' },
      h('div', { class: 'card kpi' },
        h('div', { class: 'kpi-ico teal', html: UI.icon('coins', 22) }),
        h('div', null,
          h('div', { class: 'kpi-lbl', text: 'Valeur du stock' }),
          h('div', { class: 'kpi-val', text: UI.money(value) }),
          h('div', { class: 'kpi-sub', text: 'Au prix d\u2019achat' })
        )
      ),
      h('div', { class: 'card kpi' },
        h('div', { class: 'kpi-ico', html: UI.icon('stock', 22) }),
        h('div', null,
          h('div', { class: 'kpi-lbl', text: 'Produits actifs' }),
          h('div', { class: 'kpi-val', text: String(active.length) }),
          h('div', { class: 'kpi-sub', text: S.products.length - active.length + ' archivé(s)' })
        )
      ),
      h('div', { class: 'card kpi' },
        h('div', { class: 'kpi-ico ' + (low.length ? 'red' : 'green'), html: UI.icon('alert', 22) }),
        h('div', null,
          h('div', { class: 'kpi-lbl', text: 'Alertes' }),
          h('div', { class: 'kpi-val' + (low.length ? ' red' : ''), text: String(low.length) }),
          h('div', { class: 'kpi-sub', text: low.filter(function (x) { return x.status === 'out'; }).length + ' rupture(s)' })
        )
      )
    ));

    /* ---------- Toolbar ---------- */
    const categories = [];
    S.products.forEach(function (p) {
      if (p.category && categories.indexOf(p.category) === -1) categories.push(p.category);
    });

    el.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'search-box' },
        h('span', { html: UI.icon('search', 15) }),
        h('input', {
          type: 'search', placeholder: 'Rechercher un produit, un code…', value: filters.q,
          oninput: function (e) { filters.q = e.target.value; renderTable(); }
        })
      ),
      h('select', { class: 'compact', onchange: function (e) { filters.cat = e.target.value; renderTable(); } },
        (function () {
          const opts = [option('all', 'Toutes catégories', filters.cat)];
          categories.sort().forEach(function (c) { opts.push(option(c, c, filters.cat)); });
          return opts;
        })()
      ),
      h('label', { class: 'check', style: { marginBottom: 0 } },
        h('input', {
          type: 'checkbox', checked: filters.low,
          onchange: function (e) { filters.low = e.target.checked; renderTable(); }
        }),
        'Alertes seulement'
      ),
      h('label', { class: 'check', style: { marginBottom: 0 } },
        h('input', {
          type: 'checkbox', checked: filters.showArchived,
          onchange: function (e) { filters.showArchived = e.target.checked; renderTable(); }
        }),
        'Voir les archivés'
      ),
      h('div', { class: 'spacer' }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('sliders', 16) + ' Ajustement de stock',
        onclick: openAdjustmentEditor
      }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('history', 16) + ' Mouvements',
        onclick: openMovesModal
      }),
      h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('plus', 16) + ' Nouveau produit',
        onclick: function () { openProductEditor(); }
      })
    ));

    const wrap = h('div', { class: 'table-wrap' });
    el.appendChild(wrap);
    renderTable();

    function option(value, label, current) {
      const o = h('option', { value: value, text: label });
      o.selected = value === current;
      return o;
    }

    function filtered() {
      const q = filters.q.trim().toLowerCase();
      return S.products
        .filter(function (p) {
          if (!filters.showArchived && p.archived) return false;
          if (filters.cat !== 'all' && (p.category || '') !== filters.cat) return false;
          if (filters.low) {
            const qty = L.computeStock(S, p.id);
            if (L.productStockStatus(p, qty) === 'ok') return false;
          }
          if (q) {
            const hay = ((p.name || '') + ' ' + (p.sku || '') + ' ' + (p.category || '')).toLowerCase();
            if (hay.indexOf(q) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'fr'); });
    }

    function renderTable() {
      const rows = filtered();
      wrap.innerHTML = '';
      if (!S.products.length) {
        wrap.appendChild(UI.emptyState({
          icon: 'stock',
          title: 'Aucun produit',
          text: 'Créez vos produits pour facturer plus vite et suivre votre stock.',
          action: h('button', {
            class: 'btn btn-primary', type: 'button',
            html: UI.icon('plus', 16) + ' Créer un produit',
            onclick: function () { openProductEditor(); }
          })
        }));
        return;
      }
      if (!rows.length) {
        wrap.appendChild(UI.emptyState({ icon: 'search', title: 'Aucun résultat', text: 'Modifiez la recherche ou les filtres.' }));
        return;
      }
      const table = h('table', { class: 'data' });
      table.appendChild(h('thead', null, h('tr', null,
        h('th', { text: 'Code' }),
        h('th', { text: 'Produit' }),
        h('th', { text: 'Catégorie' }),
        h('th', { class: 'num', text: 'PA' }),
        h('th', { class: 'num', text: 'PV' }),
        h('th', { class: 'num', text: 'Stock' }),
        h('th', { class: 'num', text: 'Valeur' }),
        h('th', { text: 'État' }),
        h('th', { style: { textAlign: 'right' }, text: 'Actions' })
      )));
      const tbody = h('tbody');
      let totalValue = 0;
      rows.forEach(function (p) {
        const qty = L.computeStock(S, p.id);
        const status = L.productStockStatus(p, qty);
        const val = qty * (Number(p.costPrice) || 0);
        totalValue += val;
        tbody.appendChild(h('tr', null,
          h('td', { class: 'muted', text: p.sku || '—' }),
          h('td', null,
            h('div', { class: 'cell-main', text: p.name }),
            (p.archived ? h('div', { class: 'cell-sub', text: 'Archivé' }) : null)
          ),
          h('td', { text: p.category || '—' }),
          h('td', { class: 'num', text: UI.money(p.costPrice) }),
          h('td', { class: 'num', text: UI.money(p.salePrice) }),
          h('td', { class: 'num bold' + (status === 'out' ? ' money-neg' : (status === 'low' ? ' money-pos' : '')), text: L.formatNumber(qty, 0) + ' ' + (p.unit || 'p.') }),
          h('td', { class: 'num', text: UI.money(val) }),
          h('td', { html: UI.stockBadge(status) }),
          h('td', null, h('div', { class: 'row-actions' },
            h('button', { class: 'icon-btn', type: 'button', title: 'Historique des mouvements', html: UI.icon('history', 16), onclick: function () { openProductHistory(p); } }),
            h('button', { class: 'icon-btn', type: 'button', title: 'Ajuster le stock', html: UI.icon('sliders', 16), onclick: function () { openAdjustmentEditor(p.id); } }),
            h('button', { class: 'icon-btn', type: 'button', title: 'Modifier', html: UI.icon('edit', 16), onclick: function () { openProductEditor(p); } }),
            h('button', {
              class: 'icon-btn', type: 'button',
              title: p.archived ? 'Désarchiver' : 'Archiver',
              html: UI.icon('inbox', 16),
              onclick: function () { st.toggleArchiveProduct(p.id); UI.toast(p.archived ? 'Produit désarchivé' : 'Produit archivé (invisible dans les nouveaux documents)'); }
            }),
            h('button', { class: 'icon-btn danger', type: 'button', title: 'Supprimer', html: UI.icon('trash', 16), onclick: async function () {
              const ok = await UI.confirm({
                title: 'Supprimer « ' + p.name + ' » ?',
                message: 'Le produit sera retiré définitivement.\nS\u2019il apparaît dans des documents, l\u2019archivage est recommandé.',
                danger: true, okText: 'Supprimer'
              });
              if (!ok) return;
              try { st.deleteProduct(p.id); UI.toast('Produit supprimé'); }
              catch (err) { UI.toast(err.message, 'error'); }
            } })
          ))
        ));
      });
      tbody.appendChild(h('tr', { class: 'total-row' },
        h('td', { colspan: 6, text: rows.length + ' produit(s) — valorisation filtrée' }),
        h('td', { class: 'num', text: UI.money(totalValue) }),
        h('td', { colspan: 2 })
      ));
      table.appendChild(tbody);
      wrap.appendChild(table);
    }
  }

  /* ==================================================================== */
  /* Éditeur produit                                                       */
  /* ==================================================================== */

  function openProductEditor(existing) {
    const st = root.COMPTA.store;
    const S = st.state;
    const isEdit = !!existing;

    const m = UI.modal({
      title: isEdit ? 'Modifier le produit' : 'Nouveau produit',
      subtitle: existing ? existing.name : 'Renseignez au minimum le nom et le prix de vente',
      okText: isEdit ? 'Enregistrer' : 'Créer le produit',
      okIcon: 'save',
      onOk: function (close) {
        try {
          st.upsertProduct({
            id: isEdit ? existing.id : undefined,
            sku: val('p-sku'),
            name: val('p-name'),
            category: val('p-cat'),
            unit: val('p-unit'),
            costPrice: num('p-cost'),
            salePrice: num('p-price'),
            stockAlert: num('p-alert'),
            openingStock: isEdit ? val('p-open') : num('p-open'),
            notes: ''
          });
          close();
          UI.toast(isEdit ? 'Produit modifié' : 'Produit créé');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      }
    });
    const b = m.body;

    const categories = [];
    S.products.forEach(function (p) { if (p.category && categories.indexOf(p.category) === -1) categories.push(p.category); });
    const catList = h('datalist', { id: 'cat-list' }, categories.sort().map(function (c) { return h('option', { value: c }); }));
    const unitList = h('datalist', { id: 'unit-list' }, UNITS.map(function (u) { return h('option', { value: u }); }));
    b.appendChild(catList);
    b.appendChild(unitList);

    b.appendChild(h('div', { class: 'form-grid' },
      field('Nom du produit *', h('input', { type: 'text', id: 'p-name', value: existing ? existing.name : '', placeholder: 'Ex. : Riz parfumé 25 kg' })),
      field('Code / référence', h('input', { type: 'text', id: 'p-sku', value: existing ? (existing.sku || '') : autoSku(), placeholder: 'ART-001' })),
      field('Catégorie', h('input', { type: 'text', id: 'p-cat', list: 'cat-list', value: existing ? (existing.category || '') : '', placeholder: 'Ex. : Alimentation' })),
      field('Unité', h('input', { type: 'text', id: 'p-unit', list: 'unit-list', value: existing ? (existing.unit || 'pièce') : 'pièce' }))
    ));
    b.appendChild(h('div', { class: 'form-grid-3' },
      field('Prix d\u2019achat (PA)', h('input', { type: 'number', min: '0', step: 'any', id: 'p-cost', value: existing ? existing.costPrice : '' })),
      field('Prix de vente (PV) *', h('input', { type: 'number', min: '0', step: 'any', id: 'p-price', value: existing ? existing.salePrice : '' })),
      field('Seuil d\u2019alerte', h('input', { type: 'number', min: '0', step: '1', id: 'p-alert', value: existing ? (existing.stockAlert || 0) : 0, placeholder: '0 = désactivé' }))
    ));

    const stockField = field(
      isEdit ? 'Stock initial (correction)' : 'Stock initial *',
      h('input', { type: 'number', step: '1', id: 'p-open', value: existing ? existing.openingStock : 0 })
    );
    b.appendChild(h('div', { class: 'form-grid' },
      stockField,
      h('div', { class: 'field' },
        h('div', { class: 'help', style: { marginTop: '24px' } },
          isEdit
            ? 'Astuce : pour une entrée ou une sortie ponctuelle, préférez « Ajustement de stock » (traçabilité). Le stock actuel est de ' + L.formatNumber(L.computeStock(root.COMPTA.store.state, existing.id), 0) + '.'
            : 'Le stock évoluera ensuite automatiquement avec vos ventes et vos achats.')
      )
    ));

    function field(label, input) { return h('div', { class: 'field' }, h('label', { text: label }), input); }
    function val(id) { return UI.qs('#' + id, b).value; }
    function num(id) { return Number(UI.qs('#' + id, b).value) || 0; }
    function autoSku() {
      const n = root.COMPTA.store.state.products.length + 1;
      return 'ART-' + String(n).padStart(3, '0');
    }
  }

  /* ==================================================================== */
  /* Ajustement de stock                                                   */
  /* ==================================================================== */

  function openAdjustmentEditor(productId) {
    const st = root.COMPTA.store;
    const S = st.state;

    const m = UI.modal({
      title: 'Ajustement de stock',
      subtitle: 'Entrée ou sortie manuelle (marchandise endommagée, inventaire, don…)',
      okText: 'Enregistrer l\u2019ajustement',
      okIcon: 'sliders',
      onOk: function (close) {
        try {
          st.addAdjustment({
            date: UI.qs('#adj-date', b).value,
            productId: UI.qs('#adj-product', b).value,
            qty: (UI.qs('#adj-type', b).value === 'out' ? -1 : 1) * (Number(UI.qs('#adj-qty', b).value) || 0),
            reason: UI.qs('#adj-reason', b).value
          });
          close();
          UI.toast('Ajustement enregistré');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      }
    });
    const b = m.body;

    const sel = h('select', { id: 'adj-product' });
    S.products.forEach(function (p) {
      if (p.archived) return;
      const o = h('option', { value: p.id, text: p.name + ' — stock actuel : ' + L.formatNumber(L.computeStock(S, p.id), 0) });
      if (p.id === productId) o.selected = true;
      sel.appendChild(o);
    });
    if (!S.products.filter(function (p) { return !p.archived; }).length) {
      sel.appendChild(h('option', { value: '', text: 'Aucun produit disponible' }));
      sel.disabled = true;
    }

    b.appendChild(h('div', { class: 'form-grid' },
      field('Produit *', sel),
      field('Date', h('input', { type: 'date', id: 'adj-date', value: L.todayISO() })),
      field('Type *', (function () {
        const s = h('select', { id: 'adj-type' });
        s.appendChild(h('option', { value: 'in', text: 'Entrée (réception, retour…)' }));
        s.appendChild(h('option', { value: 'out', text: 'Sortie (casse, don, vol…)' }));
        return s;
      })()),
      field('Quantité *', h('input', { type: 'number', min: '1', step: '1', id: 'adj-qty', value: 1 }))
    ));
    b.appendChild(field('Motif *', h('input', { type: 'text', id: 'adj-reason', placeholder: 'Ex. : sacs endommagés lors du transport' })));

    function field(label, input) { return h('div', { class: 'field' }, h('label', { text: label }), input); }
  }

  /* ==================================================================== */
  /* Historique                                                            */
  /* ==================================================================== */

  function openProductHistory(product) {
    const st = root.COMPTA.store;
    const S = st.state;
    const moves = L.deriveStockMoves(S).filter(function (mv) { return mv.productId === product.id; }).reverse();
    let running = Number(product.openingStock) || 0;

    const m = UI.modal({
      title: 'Mouvements — ' + product.name,
      subtitle: 'Stock initial : ' + L.formatNumber(running, 0) + ' ' + (product.unit || 'p.'),
      okText: null,
      cancelText: 'Fermer'
    });
    if (!moves.length) {
      m.body.appendChild(UI.emptyState({ icon: 'history', title: 'Aucun mouvement', text: 'Les ventes, achats et ajustements apparaîtront ici.' }));
      return;
    }
    const table = h('table', { class: 'data' });
    table.appendChild(h('thead', null, h('tr', null,
      h('th', { text: 'Date' }), h('th', { text: 'Origine' }), h('th', { text: 'Libellé' }),
      h('th', { class: 'num', text: 'Qté' }), h('th', { class: 'num', text: 'Stock' })
    )));
    const tbody = h('tbody');
    moves.forEach(function (mv) {
      running += mv.delta;
      const origin = mv.kind === 'sale' ? 'Vente' : (mv.kind === 'purchase' ? 'Achat' : 'Ajustement');
      const badge = mv.kind === 'sale' ? 'blue' : (mv.kind === 'purchase' ? 'purple' : 'grey');
      tbody.appendChild(h('tr', null,
        h('td', { text: L.formatDate(mv.date) }),
        h('td', { html: '<span class="badge badge-' + badge + '">' + origin + (mv.docNumber ? ' ' + UI.escapeHtml(mv.docNumber) : '') + '</span>' }),
        h('td', { text: mv.label }),
        h('td', { class: 'num bold', html: (mv.delta > 0 ? '<span class="money-pos">+' + L.formatNumber(mv.delta, 0) + '</span>' : '<span class="money-neg">' + L.formatNumber(mv.delta, 0) + '</span>') }),
        h('td', { class: 'num', text: L.formatNumber(running, 0) })
      ));
    });
    table.appendChild(tbody);
    m.body.appendChild(h('div', { class: 'table-wrap', style: { maxHeight: '50vh' } }, table));
  }

  function openMovesModal() {
    const st = root.COMPTA.store;
    const S = st.state;
    const moves = L.deriveStockMoves(S).slice().reverse().slice(0, 200);

    const m = UI.modal({
      title: 'Derniers mouvements de stock',
      subtitle: '200 mouvements les plus récents',
      okText: null,
      cancelText: 'Fermer',
      mid: true
    });
    if (!moves.length) {
      m.body.appendChild(UI.emptyState({ icon: 'history', title: 'Aucun mouvement', text: 'Enregistrez des ventes, achats ou ajustements.' }));
      return;
    }
    const table = h('table', { class: 'data' });
    table.appendChild(h('thead', null, h('tr', null,
      h('th', { text: 'Date' }), h('th', { text: 'Produit' }), h('th', { text: 'Origine' }),
      h('th', { class: 'num', text: 'Qté' })
    )));
    const tbody = h('tbody');
    moves.forEach(function (mv) {
      const p = L.findProduct(S, mv.productId);
      const origin = mv.kind === 'sale' ? 'Vente' : (mv.kind === 'purchase' ? 'Achat' : 'Ajustement');
      const badge = mv.kind === 'sale' ? 'blue' : (mv.kind === 'purchase' ? 'purple' : 'grey');
      tbody.appendChild(h('tr', null,
        h('td', { text: L.formatDate(mv.date) }),
        h('td', { class: 'cell-main', text: p ? p.name : '(produit supprimé)' }),
        h('td', { html: '<span class="badge badge-' + badge + '">' + origin + (mv.docNumber ? ' ' + UI.escapeHtml(mv.docNumber) : '') + '</span>' }),
        h('td', { class: 'num bold', html: (mv.delta > 0 ? '<span class="money-pos">+' + L.formatNumber(mv.delta, 0) + '</span>' : '<span class="money-neg">' + L.formatNumber(mv.delta, 0) + '</span>') })
      ));
    });
    table.appendChild(tbody);
    m.body.appendChild(h('div', { class: 'table-wrap', style: { maxHeight: '60vh' } }, table));
  }

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.stock = { render: render, title: 'Stock', sub: 'Produits, mouvements et alertes' };
  root.COMPTA.stock = {
    openProductEditor: openProductEditor,
    openAdjustmentEditor: openAdjustmentEditor
  };
})(typeof window !== 'undefined' ? window : this);
