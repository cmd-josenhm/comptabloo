/*!
 * COMPTABLOO — Page « Ventes » : liste des factures et devis,
 * recherche, filtres, création, paiements, conversion devis → facture.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  // État des filtres (persiste pendant la session)
  const filters = { q: '', type: 'all', status: 'all' };

  function render(el) {
    const st = root.COMPTA.store;
    const S = st.state;
    const today = L.todayISO();

    el.innerHTML = '';

    /* ---------- Barre d'outils ---------- */
    const toolbar = h('div', { class: 'toolbar' },
      h('div', { class: 'search-box' },
        h('span', { html: UI.icon('search', 15) }),
        h('input', {
          type: 'search', placeholder: 'Rechercher un numéro ou un client…', value: filters.q,
          oninput: function (e) { filters.q = e.target.value; renderTable(); }
        })
      ),
      h('select', { class: 'compact', onchange: function (e) { filters.type = e.target.value; renderTable(); } },
        option('all', 'Factures et devis', filters.type),
        option('invoice', 'Factures', filters.type),
        option('quote', 'Devis', filters.type)
      ),
      h('select', { class: 'compact', onchange: function (e) { filters.status = e.target.value; renderTable(); } },
        option('all', 'Tous les statuts', filters.status),
        option('paid', 'Payées', filters.status),
        option('partial', 'Paiements partiels', filters.status),
        option('unpaid', 'Impayées', filters.status),
        option('overdue', 'En retard', filters.status)
      ),
      h('div', { class: 'spacer' }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('download', 16) + ' Exporter CSV',
        onclick: exportCSV
      }),
      h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('plus', 16) + ' Nouvelle facture',
        onclick: function () { root.COMPTA.docs.openEditor({ kind: 'sale', mode: 'invoice' }); }
      }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('plus', 16) + ' Nouveau devis',
        onclick: function () { root.COMPTA.docs.openEditor({ kind: 'sale', mode: 'quote' }); }
      })
    );
    el.appendChild(toolbar);

    /* ---------- Tableau ---------- */
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
      return S.sales.slice()
        .filter(function (d) {
          if (filters.type !== 'all' && d.type !== filters.type) return false;
          if (filters.status !== 'all') {
            const status = L.docStatus(d, S.settings);
            const overdue = L.isOverdue(d, S.settings, today);
            if (filters.status === 'overdue' && !overdue) return false;
            if (filters.status !== 'overdue' && status !== filters.status) return false;
          }
          if (q) {
            const hay = (d.number + ' ' + L.clientName(S, d.clientId) + ' ' + (d.notes || '')).toLowerCase();
            if (hay.indexOf(q) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) { return a.date === b.date ? (b.createdAt > a.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1); });
    }

    function renderTable() {
      const rows = filtered();
      wrap.innerHTML = '';
      if (!S.sales.length) {
        wrap.appendChild(UI.emptyState({
          icon: 'sales',
          title: 'Aucune vente pour le moment',
          text: 'Créez votre première facture ou votre premier devis pour démarrer.',
          action: h('button', {
            class: 'btn btn-primary', type: 'button',
            html: UI.icon('plus', 16) + ' Créer une facture',
            onclick: function () { root.COMPTA.docs.openEditor({ kind: 'sale', mode: 'invoice' }); }
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
        h('th', { text: 'N°' }),
        h('th', { text: 'Date' }),
        h('th', { text: 'Client' }),
        h('th', { text: 'Type' }),
        h('th', { class: 'num', text: 'Total TTC' }),
        h('th', { class: 'num', text: 'Payé' }),
        h('th', { class: 'num', text: 'Reste dû' }),
        h('th', { text: 'Statut' }),
        h('th', { style: { textAlign: 'right' }, text: 'Actions' })
      )));
      const tbody = h('tbody');
      let sumTotal = 0;
      let sumPaid = 0;
      let sumDue = 0;
      rows.forEach(function (d) {
        const totals = L.computeDocTotals(d, S.settings);
        const paid = L.paidAmount(d);
        const due = L.dueAmount(d, S.settings);
        sumTotal += totals.total;
        sumPaid += paid;
        sumDue += due;
        const actions = h('td', null, h('div', { class: 'row-actions' },
          h('button', { class: 'icon-btn', type: 'button', title: 'Voir le détail', html: UI.icon('eye', 16), onclick: function () { root.COMPTA.docs.openDetail({ doc: d, kind: 'sale' }); } }),
          (d.type === 'invoice' && due > 0
            ? h('button', { class: 'icon-btn', type: 'button', title: 'Enregistrer un paiement', html: UI.icon('payment', 16), onclick: function () { root.COMPTA.docs.openPayments({ doc: d, kind: 'sale' }); } })
            : null),
          (d.type === 'quote' && !d.convertedTo
            ? h('button', { class: 'icon-btn', type: 'button', title: 'Convertir en facture', html: UI.icon('convert', 16), onclick: async function () {
                const ok = await UI.confirm({ title: 'Convertir ' + d.number + ' en facture ?', message: 'Une facture sera créée avec les mêmes lignes.' });
                if (ok) {
                  try { const inv = st.convertQuote(d.id); UI.toast('Facture créée : ' + inv.number); }
                  catch (err) { UI.toast(err.message, 'error'); }
                }
              } })
            : null),
          h('button', { class: 'icon-btn', type: 'button', title: 'Imprimer', html: UI.icon('print', 16), onclick: function () { root.COMPTA.docs.printDoc(d); } }),
          h('button', { class: 'icon-btn', type: 'button', title: 'Modifier', html: UI.icon('edit', 16), onclick: function () { root.COMPTA.docs.openEditor({ kind: 'sale', mode: d.type, doc: d }); } }),
          h('button', { class: 'icon-btn danger', type: 'button', title: 'Supprimer', html: UI.icon('trash', 16), onclick: async function () {
            const ok = await UI.confirm({
              title: 'Supprimer ' + d.number + ' ?',
              message: 'Le stock et le journal comptable seront recalculés automatiquement.\nCette action est définitive.',
              danger: true, okText: 'Supprimer'
            });
            if (ok) { st.deleteSale(d.id); UI.toast('Document supprimé : ' + d.number); }
          } })
        ));

        tbody.appendChild(h('tr', null,
          h('td', { class: 'cell-main', text: d.number }),
          h('td', { text: L.formatDate(d.date) }),
          h('td', null,
            h('div', { class: 'cell-main', text: L.clientName(S, d.clientId) }),
            (d.dueDate && d.type === 'invoice' ? h('div', { class: 'cell-sub', text: 'Échéance : ' + L.formatDate(d.dueDate) }) : null)
          ),
          h('td', { html: d.type === 'quote'
            ? '<span class="badge badge-grey">Devis</span>'
            : '<span class="badge badge-blue">Facture</span>' }),
          h('td', { class: 'num bold', text: UI.money(totals.total) }),
          h('td', { class: 'num', text: paid ? UI.money(paid) : '—' }),
          h('td', { class: 'num', html: due > 0 ? '<span class="money-neg">' + UI.escapeHtml(UI.money(due)) + '</span>' : '—' }),
          h('td', { html: UI.docBadge(d, S.settings, today) }),
          actions
        ));
      });
      tbody.appendChild(h('tr', { class: 'total-row' },
        h('td', { colspan: 4, text: rows.length + ' document' + (rows.length > 1 ? 's' : '') }),
        h('td', { class: 'num', text: UI.money(sumTotal) }),
        h('td', { class: 'num', text: UI.money(sumPaid) }),
        h('td', { class: 'num', text: UI.money(sumDue) }),
        h('td', { colspan: 2 })
      ));
      table.appendChild(tbody);
      wrap.appendChild(table);
    }

    function exportCSV() {
      const rows = [['Numéro', 'Date', 'Type', 'Client', 'Total TTC', 'Payé', 'Reste dû', 'Statut']];
      filtered().forEach(function (d) {
        rows.push([
          d.number,
          L.formatDate(d.date),
          d.type === 'quote' ? 'Devis' : 'Facture',
          L.clientName(S, d.clientId),
          L.computeDocTotals(d, S.settings).total,
          L.paidAmount(d),
          L.dueAmount(d, S.settings),
          UI.STATUS_LABELS[L.docStatus(d, S.settings)]
        ]);
      });
      UI.exportCSV('ventes-' + L.todayISO() + '.csv', rows);
    }
  }

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.sales = { render: render, title: 'Ventes', sub: 'Factures et devis clients' };
})(typeof window !== 'undefined' ? window : this);
