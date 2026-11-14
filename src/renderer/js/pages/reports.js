/*!
 * COMPTABLOO — Page « Rapports » : rapports prêts à l'emploi
 * avec période personnalisable, export CSV et impression.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  const REPORTS = [
    { id: 'sales', label: 'Ventes détaillées', icon: 'sales', desc: 'Toutes les factures de la période' },
    { id: 'sales-products', label: 'Ventes par produit', icon: 'stock', desc: 'Quantités et CA par article' },
    { id: 'sales-clients', label: 'Ventes par client', icon: 'clients', desc: 'Chiffre d\u2019affaires par client' },
    { id: 'purchases', label: 'Achats détaillés', icon: 'purchases', desc: 'Tous les achats de la période' },
    { id: 'purchases-suppliers', label: 'Achats par fournisseur', icon: 'suppliers', desc: 'Montants achetés et dettes' },
    { id: 'stock', label: 'État du stock', icon: 'box', desc: 'Quantités et valorisation' },
    { id: 'clients-balance', label: 'Balance clients', icon: 'coins', desc: 'Créances à encaisser' },
    { id: 'suppliers-balance', label: 'Balance fournisseurs', icon: 'wallet', desc: 'Dettes à payer' },
    { id: 'income', label: 'Compte de résultat', icon: 'accounting', desc: 'Recettes, dépenses, bénéfice' },
    { id: 'journal', label: 'Journal comptable', icon: 'book', desc: 'Toutes les opérations' }
  ];

  const sel = { report: 'sales', from: null, to: null };

  function render(el) {
    const st = root.COMPTA.store;
    const S = st.state;
    const today = L.todayISO();
    if (!sel.from) sel.from = L.startOfYearISO(today);
    if (!sel.to) sel.to = today;

    el.innerHTML = '';

    el.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'period-bar' },
        h('label', { text: 'Période :' }),
        h('input', { type: 'date', class: 'compact', value: sel.from, onchange: function (e) { sel.from = e.target.value; renderResult(); } }),
        h('span', { class: 'muted', text: '→' }),
        h('input', { type: 'date', class: 'compact', value: sel.to, onchange: function (e) { sel.to = e.target.value; renderResult(); } }),
        quickBtn('Ce mois', L.startOfMonthISO(today), L.endOfMonthISO(today)),
        quickBtn('30 jours', L.addDaysISO(today, -29), today),
        quickBtn('Cette année', L.startOfYearISO(today), today)
      ),
      h('div', { class: 'spacer' }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('download', 16) + ' Exporter CSV',
        onclick: exportCurrent
      }),
      h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('print', 16) + ' Imprimer',
        onclick: printCurrent
      })
    ));

    const content = h('div', { class: 'grid-1-2' });
    el.appendChild(content);

    /* ---- Liste des rapports ---- */
    const listCard = h('div', { class: 'card' },
      h('div', { class: 'card-h' }, h('h3', { text: 'Rapports disponibles' })),
      h('div', { class: 'card-b', style: { display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px' } })
    );
    REPORTS.forEach(function (r) {
      listCard.querySelector('.card-b').appendChild(h('button', {
        class: 'report-item' + (sel.report === r.id ? ' active' : ''),
        type: 'button',
        onclick: function () { sel.report = r.id; render(el); }
      },
        h('span', { class: 'ri-ico', html: UI.icon(r.icon, 18) }),
        h('span', { class: 'ri-txt' },
          h('span', { class: 'ri-title', text: r.label }),
          h('span', { class: 'ri-sub', text: r.desc })
        )
      ));
    });
    content.appendChild(listCard);

    /* ---- Résultat ---- */
    const resultCard = h('div', { class: 'card' },
      h('div', { class: 'card-h' }, h('h3', { id: 'rep-title' }), h('span', { class: 'hint', id: 'rep-period' })),
      h('div', { class: 'card-b', id: 'rep-body' })
    );
    content.appendChild(resultCard);

    renderResult();

    function quickBtn(label, from, to) {
      return h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', text: label,
        onclick: function () { sel.from = from; sel.to = to; render(el); }
      });
    }

    function reportDef() { return REPORTS.find(function (r) { return r.id === sel.report; }); }

    function renderResult() {
      const def = reportDef();
      UI.qs('#rep-title').textContent = def.label;
      UI.qs('#rep-period').textContent = L.formatDate(sel.from) + ' → ' + L.formatDate(sel.to);
      const body = UI.qs('#rep-body');
      body.innerHTML = '';
      const table = buildTable();
      if (table) body.appendChild(h('div', { class: 'table-wrap', style: { maxHeight: '58vh' } }, table));
      else body.appendChild(UI.emptyState({ icon: 'inbox', title: 'Aucune donnée', text: 'Aucun résultat pour cette période.' }));
    }

    /** Construit le tableau du rapport courant. */
    function buildTable() {
      const from = sel.from;
      const to = sel.to;
      const table = h('table', { class: 'data' });
      const thead = h('thead');
      const tbody = h('tbody');

      function head(cells) {
        thead.appendChild(h('tr', null, cells.map(function (c) {
          return h('th', { text: c[0], class: c[1] ? 'num' : '', style: c[1] ? {} : undefined });
        })));
        table.appendChild(thead);
      }
      function row(cells, total) {
        tbody.appendChild(h('tr', { class: total ? 'total-row' : '' }, cells.map(function (c) {
          return h('td', { text: String(c[0]), class: c[1] ? 'num' + (total ? '' : '') : '' });
        })));
      }

      switch (sel.report) {
        case 'sales': {
          const docs = S.sales.filter(function (d) { return d.type === 'invoice' && L.inPeriod(d.date, from, to); });
          if (!docs.length) return null;
          head([['N°', 0], ['Date', 0], ['Client', 0], ['Total HT', 1], ['TVA', 1], ['Total TTC', 1], ['Payé', 1], ['Reste', 1]]);
          let st = [0, 0, 0, 0, 0];
          docs.forEach(function (d) {
            const t = L.computeDocTotals(d, S.settings);
            const paid = L.paidAmount(d);
            const due = L.dueAmount(d, S.settings);
            st[0] += t.subtotal; st[1] += t.taxTotal; st[2] += t.total; st[3] += paid; st[4] += due;
            row([[d.number], [L.formatDate(d.date)], [L.clientName(S, d.clientId)], [t.subtotal, 1], [t.taxTotal, 1], [t.total, 1], [paid, 1], [due, 1]]);
          });
          row([['Total (' + docs.length + ' factures)', 0], [''], [''], [st[0], 1], [st[1], 1], [st[2], 1], [st[3], 1], [st[4], 1]], true);
          break;
        }
        case 'sales-products': {
          const list = L.topProducts(S, from, to);
          if (!list.length) return null;
          head([['Produit', 0], ['Catégorie', 0], ['Quantité', 1], ['CA HT', 1]]);
          let total = 0;
          list.forEach(function (p) {
            total += p.revenue;
            row([[p.description], [p.category], [p.qty, 1], [p.revenue, 1]]);
          });
          row([['Total'], [''], [''], [total, 1]], true);
          break;
        }
        case 'sales-clients': {
          const list = L.revenueByClient(S, from, to);
          if (!list.length) return null;
          head([['Client', 0], ['Factures', 1], ['CA TTC', 1], ['Reste à encaisser', 1]]);
          let t1 = 0, t2 = 0;
          list.forEach(function (c) {
            t1 += c.revenue; t2 += c.due;
            row([[c.name], [c.invoices, 1], [c.revenue, 1], [c.due, 1]]);
          });
          row([['Total'], [''], [t1, 1], [t2, 1]], true);
          break;
        }
        case 'purchases': {
          const docs = S.purchases.filter(function (d) { return L.inPeriod(d.date, from, to); });
          if (!docs.length) return null;
          head([['N°', 0], ['Date', 0], ['Fournisseur', 0], ['Total HT', 1], ['TVA', 1], ['Total TTC', 1], ['Payé', 1], ['Reste', 1]]);
          let st = [0, 0, 0, 0, 0];
          docs.forEach(function (d) {
            const t = L.computeDocTotals(d, S.settings);
            const paid = L.paidAmount(d);
            const due = L.dueAmount(d, S.settings);
            st[0] += t.subtotal; st[1] += t.taxTotal; st[2] += t.total; st[3] += paid; st[4] += due;
            row([[d.number], [L.formatDate(d.date)], [L.supplierName(S, d.supplierId)], [t.subtotal, 1], [t.taxTotal, 1], [t.total, 1], [paid, 1], [due, 1]]);
          });
          row([['Total (' + docs.length + ' achats)', 0], [''], [''], [st[0], 1], [st[1], 1], [st[2], 1], [st[3], 1], [st[4], 1]], true);
          break;
        }
        case 'purchases-suppliers': {
          const list = L.purchasesBySupplier(S, from, to);
          if (!list.length) return null;
          head([['Fournisseur', 0], ['Achats', 1], ['Total TTC', 1], ['Dette', 1]]);
          let t1 = 0, t2 = 0;
          list.forEach(function (s) {
            t1 += s.total; t2 += s.due;
            row([[s.name], [s.purchases, 1], [s.total, 1], [s.due, 1]]);
          });
          row([['Total'], [''], [t1, 1], [t2, 1]], true);
          break;
        }
        case 'stock': {
          if (!S.products.length) return null;
          head([['Code', 0], ['Produit', 0], ['Catégorie', 0], ['Stock', 1], ['PA', 1], ['Valeur', 1]]);
          let total = 0;
          S.products.filter(function (p) { return !p.archived; }).forEach(function (p) {
            const qty = L.computeStock(S, p.id);
            const val = qty * (Number(p.costPrice) || 0);
            total += val;
            row([[p.sku || '—'], [p.name], [p.category || '—'], [qty, 1], [p.costPrice, 1], [val, 1]]);
          });
          row([['Valorisation totale'], [''], [''], [''], [''], [total, 1]], true);
          break;
        }
        case 'clients-balance': {
          const list = L.clientBalances(S).filter(function (b) { return b.due > 0; });
          if (!list.length) return null;
          head([['Client', 0], ['Factures impayées', 1], ['Encours', 1]]);
          let t = 0;
          list.forEach(function (b) {
            t += b.due;
            row([[b.contact.name], [b.unpaidCount, 1], [b.due, 1]]);
          });
          row([['Total à encaisser'], [''], [t, 1]], true);
          break;
        }
        case 'suppliers-balance': {
          const list = L.supplierBalances(S).filter(function (b) { return b.due > 0; });
          if (!list.length) return null;
          head([['Fournisseur', 0], ['Achats impayés', 1], ['Dette', 1]]);
          let t = 0;
          list.forEach(function (b) {
            t += b.due;
            row([[b.contact.name], [b.unpaidCount, 1], [b.due, 1]]);
          });
          row([['Total à payer'], [''], [t, 1]], true);
          break;
        }
        case 'income': {
          const t = L.periodTotals(S, from, to);
          if (!t.income && !t.expense) return null;
          head([['Catégorie', 0], ['Montant', 1]]);
          Object.keys(t.incomeByCat).forEach(function (k) { row([['Recette — ' + k], [t.incomeByCat[k], 1]]); });
          Object.keys(t.expenseByCat).forEach(function (k) { row([['Dépense — ' + k], [t.expenseByCat[k], 1]]); });
          row([['RÉSULTAT (recettes − dépenses)'], [t.result, 1]], true);
          break;
        }
        case 'journal': {
          const entries = L.deriveJournal(S).filter(function (e) { return L.inPeriod(e.date, from, to); });
          if (!entries.length) return null;
          head([['Date', 0], ['Libellé', 0], ['Catégorie', 0], ['Type', 0], ['Montant', 1]]);
          let ti = 0, te = 0;
          entries.forEach(function (e) {
            if (e.type === 'income') ti += e.amount; else te += e.amount;
            row([[L.formatDate(e.date)], [e.label], [e.category], [e.type === 'income' ? 'Recette' : 'Dépense'], [e.amount, 1]]);
          });
          row([['Totaux'], [''], [''], ['Recettes : ' + UI.money(ti)], [te, 1]], true);
          break;
        }
      }
      table.appendChild(tbody);
      return table;
    }

    function exportCurrent() {
      const def = reportDef();
      const table = buildTable();
      if (!table) { UI.toast('Aucune donnée à exporter', 'info'); return; }
      const rows = [];
      table.querySelectorAll('tr').forEach(function (tr) {
        const r = [];
        tr.querySelectorAll('th,td').forEach(function (cell) { r.push(cell.textContent); });
        rows.push(r);
      });
      UI.exportCSV(def.id + '-' + L.todayISO() + '.csv', rows);
    }

    function printCurrent() {
      const def = reportDef();
      const table = buildTable();
      if (!table) { UI.toast('Aucune donnée à imprimer', 'info'); return; }
      const inner = table.outerHTML;
      const html =
        '<div class="print-doc print-report">' +
        '<div class="print-report-title"><h2>' + UI.escapeHtml(def.label) + '</h2><div class="sub">' +
        UI.escapeHtml(S.settings.companyName) + ' • ' + L.formatDate(sel.from) + ' → ' + L.formatDate(sel.to) +
        '</div></div>' + inner +
        '<div class="print-footer">Document généré par COMPTABLOO — ' + L.formatDate(L.todayISO()) + '</div>' +
        '</div>';
      UI.printHTML(html);
    }
  }

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.reports = { render: render, title: 'Rapports', sub: 'Analyses, exports CSV et impressions' };
})(typeof window !== 'undefined' ? window : this);
