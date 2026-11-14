/*!
 * COMPTABLOO — Page « Comptabilité » :
 *  - Journal (toutes les opérations, automatiques et manuelles)
 *  - Compte de résultat simplifié par catégorie
 *  - Résumé TVA
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  let currentTab = 'journal';

  // Périodes prédéfinies
  function periodChoices() {
    const today = L.todayISO();
    return [
      { id: 'month', label: 'Ce mois', from: L.startOfMonthISO(today), to: L.endOfMonthISO(today) },
      { id: 'prev', label: 'Mois dernier', from: L.startOfMonthISO(L.addDaysISO(L.startOfMonthISO(today), -1)), to: L.addDaysISO(L.startOfMonthISO(today), -1) },
      { id: 'quarter', label: 'Ce trimestre', from: quarterStart(today), to: today },
      { id: 'year', label: 'Cette année', from: L.startOfYearISO(today), to: today },
      { id: 'all', label: 'Tout', from: '', to: '' }
    ];
  }

  function quarterStart(iso) {
    const m = Number(iso.slice(5, 7));
    const q = Math.floor((m - 1) / 3) * 3 + 1;
    return iso.slice(0, 4) + '-' + String(q).padStart(2, '0') + '-01';
  }

  const journalFilters = { period: 'month', type: 'all' };

  function render(el) {
    const st = root.COMPTA.store;
    const S = st.state;

    el.innerHTML = '';

    /* ---------- Onglets ---------- */
    const tabs = h('div', { class: 'tabs' });
    [['journal', 'Journal'], ['result', 'Compte de résultat'], ['tva', 'TVA']].forEach(function (t) {
      tabs.appendChild(h('button', {
        class: 'tab' + (currentTab === t[0] ? ' active' : ''),
        type: 'button', text: t[1],
        onclick: function () { currentTab = t[0]; render(el); }
      }));
    });
    el.appendChild(tabs);

    if (currentTab === 'journal') renderJournal(el);
    else if (currentTab === 'result') renderResult(el);
    else renderTVA(el);
  }

  /* ==================================================================== */
  /* Journal                                                               */
  /* ==================================================================== */

  function renderJournal(el) {
    const st = root.COMPTA.store;
    const S = st.state;
    const today = L.todayISO();
    const choices = periodChoices();
    const period = choices.find(function (c) { return c.id === journalFilters.period; }) || choices[0];
    const entries = L.deriveJournal(S).filter(function (e) {
      if (!L.inPeriod(e.date, period.from, period.to)) return false;
      if (journalFilters.type !== 'all' && e.type !== journalFilters.type) return false;
      return true;
    });

    el.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'period-bar' },
        h('label', { text: 'Période :' }),
        h('select', { class: 'compact', onchange: function (e) { journalFilters.period = e.target.value; rerender(); } },
          choices.map(function (c) { return option(c.id, c.label, journalFilters.period); })
        ),
        h('span', { class: 'muted small', text: period.from ? L.formatDate(period.from) + ' → ' + L.formatDate(period.to) : 'Depuis le début' })
      ),
      h('div', { class: 'spacer' }),
      h('select', { class: 'compact', onchange: function (e) { journalFilters.type = e.target.value; rerender(); } },
        option('all', 'Recettes et dépenses', journalFilters.type),
        option('income', 'Recettes seulement', journalFilters.type),
        option('expense', 'Dépenses seulement', journalFilters.type)
      ),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('download', 16) + ' Exporter CSV',
        onclick: exportJournal
      }),
      h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('plus', 16) + ' Nouvelle écriture',
        onclick: function () { openEntryEditor(); }
      })
    ));

    const totals = entries.reduce(function (acc, e) {
      if (e.type === 'income') acc.income += e.amount; else acc.expense += e.amount;
      return acc;
    }, { income: 0, expense: 0 });

    const wrap = h('div', { class: 'table-wrap' });
    el.appendChild(wrap);

    if (!entries.length) {
      wrap.appendChild(UI.emptyState({
        icon: 'accounting',
        title: 'Aucune opération sur la période',
        text: 'Les paiements de factures et d\u2019achats alimentent le journal automatiquement.\nVous pouvez aussi ajouter des écritures manuelles (loyer, salaires…).'
      }));
    } else {
      const table = h('table', { class: 'data' });
      table.appendChild(h('thead', null, h('tr', null,
        h('th', { text: 'Date' }),
        h('th', { text: 'Libellé' }),
        h('th', { text: 'Catégorie' }),
        h('th', { text: 'Origine' }),
        h('th', { class: 'num', text: 'Recette' }),
        h('th', { class: 'num', text: 'Dépense' }),
        h('th', { style: { textAlign: 'right' }, text: '' })
      )));
      const tbody = h('tbody');
      entries.forEach(function (e) {
        const originBadge = e.origin === 'sale'
          ? '<span class="badge badge-blue">Vente</span>'
          : (e.origin === 'purchase' ? '<span class="badge badge-purple">Achat</span>' : '<span class="badge badge-grey">Manuel</span>');
        tbody.appendChild(h('tr', null,
          h('td', { text: L.formatDate(e.date), style: { whiteSpace: 'nowrap' } }),
          h('td', { class: 'cell-main', text: e.label }),
          h('td', { text: e.category }),
          h('td', { html: originBadge }),
          h('td', { class: 'num', html: e.type === 'income' ? '<span class="money-pos bold">' + UI.escapeHtml(UI.money(e.amount)) + '</span>' : '' }),
          h('td', { class: 'num', html: e.type === 'expense' ? '<span class="money-neg bold">' + UI.escapeHtml(UI.money(e.amount)) + '</span>' : '' }),
          h('td', null, e.origin === 'manual'
            ? h('div', { class: 'row-actions' },
              h('button', { class: 'icon-btn', type: 'button', title: 'Modifier', html: UI.icon('edit', 16), onclick: function () { openEntryEditor(e); } }),
              h('button', { class: 'icon-btn danger', type: 'button', title: 'Supprimer', html: UI.icon('trash', 16), onclick: async function () {
                const ok = await UI.confirm({ title: 'Supprimer cette écriture ?', message: e.label, danger: true, okText: 'Supprimer' });
                if (ok) { root.COMPTA.store.deleteJournalEntry(e.id); UI.toast('Écriture supprimée'); }
              } })
            )
            : null)
        ));
      });
      tbody.appendChild(h('tr', { class: 'total-row' },
        h('td', { colspan: 4, text: entries.length + ' opération(s)' }),
        h('td', { class: 'num', text: UI.money(totals.income) }),
        h('td', { class: 'num', text: UI.money(totals.expense) }),
        h('td')
      ));
      table.appendChild(tbody);
      wrap.appendChild(table);
    }

    function exportJournal() {
      const rows = [['Date', 'Libellé', 'Catégorie', 'Origine', 'Type', 'Montant']];
      entries.forEach(function (e) {
        rows.push([L.formatDate(e.date), e.label, e.category, e.origin === 'sale' ? 'Vente' : (e.origin === 'purchase' ? 'Achat' : 'Manuel'), e.type === 'income' ? 'Recette' : 'Dépense', e.amount]);
      });
      UI.exportCSV('journal-' + L.todayISO() + '.csv', rows);
    }
  }

  /* ==================================================================== */
  /* Compte de résultat                                                     */
  /* ==================================================================== */

  function renderResult(el) {
    const st = root.COMPTA.store;
    const S = st.state;
    const choices = periodChoices();
    let periodId = renderResult.periodId || 'year';
    let from = renderResult.from;
    let to = renderResult.to;
    if (renderResult.periodId) {
      const c = choices.find(function (x) { return x.id === renderResult.periodId; });
      if (c) { from = c.from; to = c.to; }
    } else {
      from = from || L.startOfYearISO(L.todayISO());
      to = to || L.todayISO();
    }

    el.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'period-bar' },
        h('label', { text: 'Période :' }),
        h('select', { class: 'compact', onchange: function (e) {
          const id = e.target.value;
          if (id === 'custom') {
            renderResult.periodId = 'custom';
            renderResult.from = UI.qs('#res-from', el).value;
            renderResult.to = UI.qs('#res-to', el).value;
          } else {
            renderResult.periodId = id;
            const c = choices.find(function (x) { return x.id === id; });
            renderResult.from = c.from; renderResult.to = c.to;
          }
          rerender();
        } },
          choices.map(function (c) { return option(c.id, c.label, periodId === 'custom' ? 'year' : periodId); }).concat([option('custom', 'Personnalisée…', '')])
        ),
        h('input', { type: 'date', class: 'compact', id: 'res-from', value: from || '', onchange: function () { renderResult.periodId = 'custom'; renderResult.from = this.value; rerender(); } }),
        h('span', { class: 'muted', text: '→' }),
        h('input', { type: 'date', class: 'compact', id: 'res-to', value: to || '', onchange: function () { renderResult.periodId = 'custom'; renderResult.to = this.value; rerender(); } })
      ),
      h('div', { class: 'spacer' }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('print', 16) + ' Imprimer',
        onclick: function () { printResult(from, to); }
      })
    ));

    const t = L.periodTotals(S, from || null, to || null);

    el.appendChild(h('div', { class: 'kpi-grid' },
      kpi('trendUp', 'Recettes encaissées', UI.money(t.income), 'green', 'Trésorerie entrée'),
      kpi('trendDown', 'Dépenses payées', UI.money(t.expense), 'red', 'Trésorerie sortie'),
      kpi('wallet', 'Résultat', UI.money(t.result), t.result >= 0 ? 'green' : 'red', t.result >= 0 ? 'Bénéfice de la période' : 'Perte de la période')
    ));

    const incomeCats = Object.keys(t.incomeByCat).map(function (k) { return { label: k, value: t.incomeByCat[k] }; }).sort(function (a, b) { return b.value - a.value; });
    const expenseCats = Object.keys(t.expenseByCat).map(function (k) { return { label: k, value: t.expenseByCat[k] }; }).sort(function (a, b) { return b.value - a.value; });

    el.appendChild(h('div', { class: 'grid-2' },
      catCard('Recettes par catégorie', incomeCats, t.income, 'green'),
      catCard('Dépenses par catégorie', expenseCats, t.expense, 'red')
    ));

    el.appendChild(h('div', { class: 'note-box mt-16' },
      h('strong', { text: 'Comment lire ce résultat ? ' }),
      'Le résultat est calculé en trésorerie : il compare l\u2019argent réellement encaissé (paiements clients + autres revenus) ',
      'à l\u2019argent réellement sorti (paiements fournisseurs + charges). C\u2019est l\u2019approche la plus simple et la plus sûre ',
      'pour piloter une petite entreprise au quotidien.'
    ));

    function catCard(title, cats, total, color) {
      const card = h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', { text: title }), h('span', { class: 'hint', text: UI.money(total) })),
        h('div', { class: 'card-b', style: { paddingTop: '8px' } })
      );
      const body = card.querySelector('.card-b');
      if (!cats.length) {
        body.appendChild(h('p', { class: 'muted small', text: 'Aucune opération sur la période.' }));
      } else {
        const max = Math.max.apply(null, cats.map(function (c) { return c.value; })) || 1;
        cats.forEach(function (c) {
          body.appendChild(h('div', { class: 'cat-row' },
            h('div', { class: 'cat-label', text: c.label }),
            h('div', { class: 'progress ' + color }, h('div', { style: { width: Math.max(4, Math.round(c.value / max * 100)) + '%' } })),
            h('div', { class: 'cat-val', text: UI.money(c.value) })
          ));
        });
      }
      return card;
    }

    function printResult(from, to) {
      const S2 = root.COMPTA.store.state;
      const t2 = L.periodTotals(S2, from || null, to || null);
      const rowsOf = function (cats) {
        return Object.keys(cats).map(function (k) {
          return '<tr><td>' + UI.escapeHtml(k) + '</td><td class="num">' + UI.escapeHtml(UI.money(cats[k])) + '</td></tr>';
        }).join('');
      };
      const html =
        '<div class="print-doc print-report">' +
        '<div class="print-report-title"><h2>Compte de résultat</h2><div class="sub">' +
        UI.escapeHtml(S2.settings.companyName) + ' • ' + (from ? L.formatDate(from) + ' au ' + L.formatDate(to) : 'Depuis le début') +
        '</div></div>' +
        '<table class="print-table"><thead><tr><th>Recettes</th><th class="num">Montant</th></tr></thead><tbody>' + rowsOf(t2.incomeByCat) +
        '<tr><td><strong>Total recettes</strong></td><td class="num"><strong>' + UI.escapeHtml(UI.money(t2.income)) + '</strong></td></tr></tbody></table>' +
        '<br/><table class="print-table"><thead><tr><th>Dépenses</th><th class="num">Montant</th></tr></thead><tbody>' + rowsOf(t2.expenseByCat) +
        '<tr><td><strong>Total dépenses</strong></td><td class="num"><strong>' + UI.escapeHtml(UI.money(t2.expense)) + '</strong></td></tr></tbody></table>' +
        '<br/><table class="print-table"><tbody><tr><td><strong>RÉSULTAT DE LA PÉRIODE</strong></td><td class="num"><strong>' + UI.escapeHtml(UI.money(t2.result)) + '</strong></td></tr></tbody></table>' +
        '<div class="print-footer">Document généré par COMPTABLOO — ' + L.formatDate(L.todayISO()) + '</div>' +
        '</div>';
      UI.printHTML(html);
    }
  }

  /* ==================================================================== */
  /* TVA                                                                   */
  /* ==================================================================== */

  function renderTVA(el) {
    const st = root.COMPTA.store;
    const S = st.state;
    let periodId = renderTVA.periodId || 'quarter';
    const choices = periodChoices();
    const c = choices.find(function (x) { return x.id === periodId; }) || choices[3];

    el.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'period-bar' },
        h('label', { text: 'Période :' }),
        h('select', { class: 'compact', onchange: function (e) { renderTVA.periodId = e.target.value; rerender(); } },
          choices.filter(function (x) { return x.id !== 'prev'; }).map(function (x) { return option(x.id, x.label, periodId); })
        ),
        h('span', { class: 'muted small', text: c.from ? L.formatDate(c.from) + ' → ' + L.formatDate(c.to) : 'Depuis le début' })
      )
    ));

    const t = L.periodTotals(S, c.from || null, c.to || null);
    el.appendChild(h('div', { class: 'kpi-grid' },
      kpi('sales', 'TVA collectée', UI.money(t.tvaCollected), 'amber', 'Sur vos ventes facturées'),
      kpi('purchases', 'TVA déductible', UI.money(t.tvaDeductible), 'teal', 'Sur vos achats'),
      kpi('accounting', t.tvaDue >= 0 ? 'TVA à reverser' : 'Crédit de TVA', UI.money(Math.abs(t.tvaDue)), t.tvaDue >= 0 ? 'red' : 'green',
        t.tvaDue >= 0 ? 'À payer à l\u2019État' : 'À récupérer')
    ));

    el.appendChild(h('div', { class: 'note-box' },
      h('strong', { text: 'Comprendre la TVA : ' }),
      'La TVA collectée est celle que vos clients vous ont payée sur vos factures. La TVA déductible est celle que vous avez ',
      'payée sur vos achats. La différence (', UI.money(t.tvaCollected), ' − ', UI.money(t.tvaDeductible),
      ') est ce que vous devez reverser au Trésor public pour la période. Conservez vos factures d\u2019achat : elles réduisent votre TVA à payer.'
    ));

    // Détail mois par mois sur la période
    const byMonth = {};
    S.sales.forEach(function (d) {
      if (d.type !== 'invoice' || !L.inPeriod(d.date, c.from || null, c.to || null)) return;
      const k = L.monthKey(d.date);
      byMonth[k] = byMonth[k] || { collected: 0, deductible: 0 };
      byMonth[k].collected += L.computeDocTotals(d, S.settings).taxTotal;
    });
    S.purchases.forEach(function (d) {
      if (!L.inPeriod(d.date, c.from || null, c.to || null)) return;
      const k = L.monthKey(d.date);
      byMonth[k] = byMonth[k] || { collected: 0, deductible: 0 };
      byMonth[k].deductible += L.computeDocTotals(d, S.settings).taxTotal;
    });

    const keys = Object.keys(byMonth).sort();
    if (keys.length) {
      const table = h('table', { class: 'data' });
      table.appendChild(h('thead', null, h('tr', null,
        h('th', { text: 'Mois' }), h('th', { class: 'num', text: 'TVA collectée' }),
        h('th', { class: 'num', text: 'TVA déductible' }), h('th', { class: 'num', text: 'TVA à payer' })
      )));
      const tbody = h('tbody');
      let sc = 0, sd = 0;
      keys.forEach(function (k) {
        const due = L.roundMoney(byMonth[k].collected - byMonth[k].deductible, L.currencyDecimals(S.settings));
        sc += byMonth[k].collected; sd += byMonth[k].deductible;
        tbody.appendChild(h('tr', null,
          h('td', { class: 'cell-main', text: L.monthLabel(k) }),
          h('td', { class: 'num', text: UI.money(byMonth[k].collected) }),
          h('td', { class: 'num', text: UI.money(byMonth[k].deductible) }),
          h('td', { class: 'num bold', text: UI.money(due) })
        ));
      });
      tbody.appendChild(h('tr', { class: 'total-row' },
        h('td', { text: 'Total' }),
        h('td', { class: 'num', text: UI.money(sc) }),
        h('td', { class: 'num', text: UI.money(sd) }),
        h('td', { class: 'num', text: UI.money(sc - sd) })
      ));
      table.appendChild(tbody);
      el.appendChild(h('div', { class: 'table-wrap mt-16' }, table));
    }
  }

  /* ==================================================================== */
  /* Écriture manuelle                                                     */
  /* ==================================================================== */

  function openEntryEditor(existing) {
    const st = root.COMPTA.store;
    const S = st.state;
    let type = existing ? existing.type : 'expense';

    const m = UI.modal({
      title: existing ? 'Modifier l\u2019écriture' : 'Nouvelle écriture manuelle',
      subtitle: 'Loyer, salaires, électricité… tout ce qui n\u2019est pas une facture ou un achat',
      okText: existing ? 'Enregistrer' : 'Ajouter au journal',
      okIcon: 'save',
      onOk: function (close) {
        try {
          st.upsertJournalEntry({
            id: existing ? existing.id : undefined,
            date: UI.qs('#je-date', b).value,
            type: type,
            category: UI.qs('#je-cat', b).value,
            label: UI.qs('#je-label', b).value,
            amount: Number(UI.qs('#je-amount', b).value) || 0,
            method: UI.qs('#je-method', b).value,
            note: UI.qs('#je-note', b).value
          });
          close();
          UI.toast(existing ? 'Écriture modifiée' : 'Écriture ajoutée au journal');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      }
    });
    const b = m.body;

    const typeSwitch = h('div', { class: 'field' }, h('label', { text: 'Type d\u2019opération *' }));
    const switchWrap = h('div', { style: { display: 'flex', gap: '8px' } });
    const btnIncome = h('button', { class: 'btn btn-outline', type: 'button', html: UI.icon('trendUp', 15) + ' Recette' });
    const btnExpense = h('button', { class: 'btn btn-outline', type: 'button', html: UI.icon('trendDown', 15) + ' Dépense' });
    switchWrap.appendChild(btnIncome);
    switchWrap.appendChild(btnExpense);
    typeSwitch.appendChild(switchWrap);
    b.appendChild(typeSwitch);

    function paint() {
      btnIncome.className = 'btn ' + (type === 'income' ? 'btn-primary' : 'btn-outline');
      btnExpense.className = 'btn ' + (type === 'expense' ? 'btn-danger' : 'btn-outline');
      refreshCats();
    }
    btnIncome.addEventListener('click', function () { type = 'income'; paint(); });
    btnExpense.addEventListener('click', function () { type = 'expense'; paint(); });

    const catSel = h('select', { id: 'je-cat' });
    function refreshCats() {
      catSel.innerHTML = '';
      const cats = type === 'income' ? st.INCOME_CATEGORIES : st.EXPENSE_CATEGORIES;
      cats.forEach(function (c) {
        const o = h('option', { value: c, text: c });
        if (existing && existing.type === type && existing.category === c) o.selected = true;
        catSel.appendChild(o);
      });
    }

    b.appendChild(h('div', { class: 'form-grid' },
      field('Date *', h('input', { type: 'date', id: 'je-date', value: existing ? existing.date : L.todayISO() })),
      field('Catégorie *', catSel)
    ));
    b.appendChild(field('Libellé *', h('input', { type: 'text', id: 'je-label', value: existing ? existing.label : '', placeholder: 'Ex. : Loyer de la boutique — novembre' })));
    b.appendChild(h('div', { class: 'form-grid' },
      field('Montant *', h('input', { type: 'number', min: '0', step: 'any', id: 'je-amount', value: existing ? existing.amount : '' })),
      field('Méthode de paiement', (function () {
        const s = h('select', { id: 'je-method' });
        root.COMPTA.docs.PAYMENT_METHODS.forEach(function (mm) {
          const o = h('option', { value: mm, text: mm });
          if (existing && existing.method === mm) o.selected = true;
          s.appendChild(o);
        });
        return s;
      })())
    ));
    b.appendChild(field('Note', h('input', { type: 'text', id: 'je-note', value: existing ? (existing.note || '') : '' })));

    paint();

    function field(label, input) { return h('div', { class: 'field' }, h('label', { text: label }), input); }
  }

  /* ==================================================================== */

  function rerender() {
    const view = document.getElementById('view');
    render(view);
  }
  function option(value, label, current) {
    const o = h('option', { value: value, text: label });
    o.selected = value === current;
    return o;
  }
  function kpi(iconName, label, value, color, sub) {
    return h('div', { class: 'card kpi' },
      h('div', { class: 'kpi-ico ' + color, html: UI.icon(iconName, 22) }),
      h('div', null,
        h('div', { class: 'kpi-lbl', text: label }),
        h('div', { class: 'kpi-val' + (color === 'green' || color === 'red' ? ' ' + color : ''), text: value }),
        h('div', { class: 'kpi-sub', text: sub })
      )
    );
  }
  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.accounting = { render: render, title: 'Comptabilité', sub: 'Journal, résultat et TVA' };
})(typeof window !== 'undefined' ? window : this);
