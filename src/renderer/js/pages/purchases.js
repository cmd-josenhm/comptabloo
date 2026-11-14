/*!
 * COMPTABLOO — Page « Achats » : bons d'achat fournisseurs,
 * recherche, statuts de paiement, impressions.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  const filters = { q: '', status: 'all' };

  function render(el) {
    const st = root.COMPTA.store;
    const S = st.state;
    const today = L.todayISO();

    el.innerHTML = '';

    el.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'search-box' },
        h('span', { html: UI.icon('search', 15) }),
        h('input', {
          type: 'search', placeholder: 'Rechercher un numéro ou un fournisseur…', value: filters.q,
          oninput: function (e) { filters.q = e.target.value; renderTable(); }
        })
      ),
      h('select', { class: 'compact', onchange: function (e) { filters.status = e.target.value; renderTable(); } },
        option('all', 'Tous les statuts', filters.status),
        option('paid', 'Payés', filters.status),
        option('partial', 'Paiements partiels', filters.status),
        option('unpaid', 'Impayés', filters.status)
      ),
      h('div', { class: 'spacer' }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('download', 16) + ' Exporter CSV',
        onclick: exportCSV
      }),
      h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('plus', 16) + ' Nouvel achat',
        onclick: function () { root.COMPTA.docs.openEditor({ kind: 'purchase', mode: 'purchase' }); }
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
      return S.purchases.slice()
        .filter(function (d) {
          if (filters.status !== 'all' && L.docStatus(d, S.settings) !== filters.status) return false;
          if (q) {
            const hay = (d.number + ' ' + L.supplierName(S, d.supplierId) + ' ' + (d.notes || '')).toLowerCase();
            if (hay.indexOf(q) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) { return a.date === b.date ? (b.createdAt > a.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1); });
    }

    function renderTable() {
      const rows = filtered();
      wrap.innerHTML = '';
      if (!S.purchases.length) {
        wrap.appendChild(UI.emptyState({
          icon: 'purchases',
          title: 'Aucun achat pour le moment',
          text: 'Enregistrez vos achats fournisseurs : le stock se met à jour automatiquement.',
          action: h('button', {
            class: 'btn btn-primary', type: 'button',
            html: UI.icon('plus', 16) + ' Enregistrer un achat',
            onclick: function () { root.COMPTA.docs.openEditor({ kind: 'purchase', mode: 'purchase' }); }
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
        h('th', { text: 'Fournisseur' }),
        h('th', { class: 'num', text: 'Total TTC' }),
        h('th', { class: 'num', text: 'Payé' }),
        h('th', { class: 'num', text: 'Reste à payer' }),
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

        tbody.appendChild(h('tr', null,
          h('td', { class: 'cell-main', text: d.number }),
          h('td', { text: L.formatDate(d.date) }),
          h('td', { class: 'cell-main', text: L.supplierName(S, d.supplierId) }),
          h('td', { class: 'num bold', text: UI.money(totals.total) }),
          h('td', { class: 'num', text: paid ? UI.money(paid) : '—' }),
          h('td', { class: 'num', html: due > 0 ? '<span class="money-neg">' + UI.escapeHtml(UI.money(due)) + '</span>' : '—' }),
          h('td', { html: UI.docBadge(d, S.settings, today) }),
          h('td', null, h('div', { class: 'row-actions' },
            h('button', { class: 'icon-btn', type: 'button', title: 'Voir le détail', html: UI.icon('eye', 16), onclick: function () { root.COMPTA.docs.openDetail({ doc: d, kind: 'purchase' }); } }),
            (due > 0
              ? h('button', { class: 'icon-btn', type: 'button', title: 'Enregistrer un paiement', html: UI.icon('payment', 16), onclick: function () { root.COMPTA.docs.openPayments({ doc: d, kind: 'purchase' }); } })
              : null),
            h('button', { class: 'icon-btn', type: 'button', title: 'Imprimer', html: UI.icon('print', 16), onclick: function () { root.COMPTA.docs.printDoc(d); } }),
            h('button', { class: 'icon-btn', type: 'button', title: 'Modifier', html: UI.icon('edit', 16), onclick: function () { root.COMPTA.docs.openEditor({ kind: 'purchase', mode: 'purchase', doc: d }); } }),
            h('button', { class: 'icon-btn danger', type: 'button', title: 'Supprimer', html: UI.icon('trash', 16), onclick: async function () {
              const ok = await UI.confirm({
                title: 'Supprimer ' + d.number + ' ?',
                message: 'Le stock et le journal comptable seront recalculés automatiquement.\nCette action est définitive.',
                danger: true, okText: 'Supprimer'
              });
              if (ok) { st.deletePurchase(d.id); UI.toast('Achat supprimé : ' + d.number); }
            } })
          ))
        ));
      });
      tbody.appendChild(h('tr', { class: 'total-row' },
        h('td', { colspan: 3, text: rows.length + ' achat' + (rows.length > 1 ? 's' : '') }),
        h('td', { class: 'num', text: UI.money(sumTotal) }),
        h('td', { class: 'num', text: UI.money(sumPaid) }),
        h('td', { class: 'num', text: UI.money(sumDue) }),
        h('td', { colspan: 2 })
      ));
      table.appendChild(tbody);
      wrap.appendChild(table);
    }

    function exportCSV() {
      const rows = [['Numéro', 'Date', 'Fournisseur', 'Total TTC', 'Payé', 'Reste à payer', 'Statut']];
      filtered().forEach(function (d) {
        rows.push([
          d.number,
          L.formatDate(d.date),
          L.supplierName(S, d.supplierId),
          L.computeDocTotals(d, S.settings).total,
          L.paidAmount(d),
          L.dueAmount(d, S.settings),
          UI.STATUS_LABELS[L.docStatus(d, S.settings)]
        ]);
      });
      UI.exportCSV('achats-' + L.todayISO() + '.csv', rows);
    }
  }

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.purchases = { render: render, title: 'Achats', sub: 'Bons d\u2019achat et dettes fournisseurs' };
})(typeof window !== 'undefined' ? window : this);
