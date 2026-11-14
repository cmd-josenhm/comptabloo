/*!
 * COMPTABLOO — Page « Tableau de bord » : vue d'ensemble de l'activité.
 * KPIs du mois, évolution sur 12 mois, répartition par catégorie,
 * dernières factures, alertes de stock, top clients.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;
  const CH = root.COMPTA.charts;

  function render(el) {
    const st = root.COMPTA.store;
    const S = st.state;
    const today = L.todayISO();
    const monthStart = L.startOfMonthISO(today);
    const prevMonthEnd = L.addDaysISO(monthStart, -1);
    const prevMonthStart = L.startOfMonthISO(prevMonthEnd);
    const yearStart = L.startOfYearISO(today);

    const cur = L.periodTotals(S, monthStart, L.endOfMonthISO(today));
    const prev = L.periodTotals(S, prevMonthStart, prevMonthEnd);
    const receivables = L.totalReceivables(S);
    const payables = L.totalPayables(S);
    const stock = L.stockValue(S);
    const low = L.lowStockProducts(S);
    const hasData = S.sales.length || S.purchases.length || S.journal.length || S.products.length;

    el.innerHTML = '';
    root.COMPTA.charts.reset();

    if (!hasData) {
      el.appendChild(UI.emptyState({
        icon: 'dashboard',
        title: 'Bienvenue dans COMPTABLOO !',
        text: 'Votre tableau de bord s\u2019animera dès vos premières ventes, achats et écritures.\nCommencez par créer un client et un produit, puis enregistrez votre première facture.',
        action: h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' } },
          h('button', {
            class: 'btn btn-primary', type: 'button', html: UI.icon('clients', 16) + ' Créer un client',
            onclick: function () { location.hash = '#/clients'; }
          }),
          h('button', {
            class: 'btn btn-outline', type: 'button', html: UI.icon('stock', 16) + ' Créer un produit',
            onclick: function () { location.hash = '#/stock'; }
          })
        )
      }));
      return;
    }

    /* ---------- KPIs ---------- */
    el.appendChild(h('div', { class: 'kpi-grid' },
      kpi('trendUp', 'Revenus encaissés (mois)', UI.money(cur.income), 'green',
        'Mois précédent : ' + UI.money(prev.income)),
      kpi('trendDown', 'Dépenses payées (mois)', UI.money(cur.expense), 'red',
        'Mois précédent : ' + UI.money(prev.expense)),
      kpi('wallet', 'Résultat du mois', UI.money(cur.result), cur.result >= 0 ? 'green' : 'red',
        cur.result >= 0 ? 'Bénéfice' : 'Perte'),
      kpi('coins', 'Créances clients', UI.money(receivables), receivables > 0 ? 'amber' : 'green',
        receivables > 0 ? 'À encaisser' : 'Tout est encaissé')
    ));

    /* ---------- Graphiques ---------- */
    const series = L.monthlySeries(S, 12);
    const cats = L.salesByCategory(S, yearStart, today);
    const catColors = ['#1666F1', '#01A0FC', '#0FA89A', '#8B5CF6', '#F59E0B', '#EF4444', '#334155'];

    const chartCard = h('div', { class: 'card' },
      h('div', { class: 'card-h' },
        h('h3', { text: 'Revenus et dépenses — 12 derniers mois' }),
        h('div', { class: 'chart-legend' },
          h('span', { class: 'leg' }, h('i', { style: { background: '#1666F1' } }), 'Revenus'),
          h('span', { class: 'leg' }, h('i', { style: { background: '#B6C6DC' } }), 'Dépenses')
        )
      ),
      h('div', { class: 'card-b' }, h('div', { class: 'chart-box', style: { height: '260px' } },
        h('canvas', { id: 'dash-chart' })
      ))
    );

    const donutCard = h('div', { class: 'card' },
      h('div', { class: 'card-h' }, h('h3', { text: 'Ventes par catégorie (année)' })),
      h('div', { class: 'card-b' },
        h('div', { class: 'chart-box', style: { height: '185px' } }, h('canvas', { id: 'dash-donut' })),
        h('div', { class: 'chart-legend', style: { justifyContent: 'center', marginTop: '10px' } },
          cats.slice(0, 7).map(function (c, i) {
            return h('span', { class: 'leg' }, h('i', { style: { background: catColors[i % catColors.length] } }), c.label);
          })
        )
      )
    );

    el.appendChild(h('div', { class: 'grid-2-1 mb-16' }, chartCard, donutCard));

    CH.track(function () {
      const c1 = document.getElementById('dash-chart');
      if (c1) CH.barChart(c1, {
        labels: series.map(function (m) { return m.label; }),
        series: [
          { name: 'Revenus', color: '#1666F1', values: series.map(function (m) { return m.income; }) },
          { name: 'Dépenses', color: '#B6C6DC', values: series.map(function (m) { return m.expense; }) }
        ],
        height: 260
      });
      const c2 = document.getElementById('dash-donut');
      if (c2) CH.donutChart(c2, cats.map(function (c, i) {
        return { label: c.label, value: c.value, color: catColors[i % catColors.length] };
      }), { height: 185, centerLabel: 'CA HT (année)', centerValue: CH.shorten(cats.reduce(function (s, c) { return s + c.value; }, 0)) });
    });

    /* ---------- Mini KPIs ---------- */
    el.appendChild(h('div', { class: 'grid-3 mb-16' },
      mini('box', 'Valeur du stock', UI.money(stock), 'teal', 'Au prix d\u2019achat'),
      mini('suppliers', 'Dettes fournisseurs', UI.money(payables), payables > 0 ? 'amber' : 'green', payables > 0 ? 'À payer' : 'Tout est réglé'),
      mini('alert', 'Alertes de stock', String(low.length), low.length ? 'red' : 'green', low.length ? low.filter(function (x) { return x.status === 'out'; }).length + ' rupture(s)' : 'Stocks sains')
    ));

    /* ---------- Listes ---------- */
    const recent = S.sales.slice()
      .sort(function (a, b) { return a.date === b.date ? (b.createdAt > a.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1); })
      .slice(0, 7);

    const recentCard = h('div', { class: 'card' },
      h('div', { class: 'card-h' },
        h('h3', { text: 'Dernières ventes' }),
        h('a', { href: '#/sales', class: 'btn btn-ghost btn-sm', text: 'Tout voir →' })
      ),
      h('div', { class: 'card-b', style: { paddingTop: '6px' } })
    );
    const recentBody = recentCard.querySelector('.card-b');
    if (!recent.length) {
      recentBody.appendChild(h('p', { class: 'muted small', text: 'Aucune vente enregistrée.' }));
    } else {
      recent.forEach(function (d) {
        recentBody.appendChild(h('div', { class: 'list-item' },
          h('div', { class: 'li-main' },
            h('div', { class: 'li-title', text: d.number + ' — ' + L.clientName(S, d.clientId) }),
            h('div', { class: 'li-sub', text: L.formatDate(d.date) + (d.type === 'quote' ? ' • Devis' : '') })
          ),
          h('div', { class: 'li-val', text: UI.money(L.computeDocTotals(d, S.settings).total) }),
          h('span', { html: UI.docBadge(d, S.settings, today) })
        ));
      });
    }

    const lowCard = h('div', { class: 'card' },
      h('div', { class: 'card-h' },
        h('h3', { text: 'Alertes de stock' }),
        h('a', { href: '#/stock', class: 'btn btn-ghost btn-sm', text: 'Gérer →' })
      ),
      h('div', { class: 'card-b', style: { paddingTop: '6px' } })
    );
    const lowBody = lowCard.querySelector('.card-b');
    if (!low.length) {
      lowBody.appendChild(h('p', { class: 'muted small', text: 'Aucun produit en alerte. 👍' }));
    } else {
      low.slice(0, 7).forEach(function (x) {
        lowBody.appendChild(h('div', { class: 'list-item' },
          h('div', { class: 'li-main' },
            h('div', { class: 'li-title', text: x.product.name }),
            h('div', { class: 'li-sub', text: 'Seuil : ' + L.formatNumber(x.product.stockAlert, 0) + ' ' + (x.product.unit || 'p.') })
          ),
          h('span', { html: UI.stockBadge(x.status) }),
          h('div', { class: 'li-val', text: L.formatNumber(x.qty, 0) + ' ' + (x.product.unit || 'p.') })
        ));
      });
    }

    const top = L.revenueByClient(S, yearStart, today).slice(0, 5);
    const topCard = h('div', { class: 'card' },
      h('div', { class: 'card-h' }, h('h3', { text: 'Meilleurs clients (année)' })),
      h('div', { class: 'card-b', style: { paddingTop: '6px' } })
    );
    const topBody = topCard.querySelector('.card-b');
    if (!top.length) {
      topBody.appendChild(h('p', { class: 'muted small', text: 'Aucune facture cette année.' }));
    } else {
      const max = top[0].revenue || 1;
      top.forEach(function (c, i) {
        topBody.appendChild(h('div', { class: 'cat-row' },
          h('div', { class: 'cat-label', text: (i + 1) + '. ' + c.name }),
          h('div', { class: 'progress' }, h('div', { style: { width: Math.max(4, Math.round(c.revenue / max * 100)) + '%' } })),
          h('div', { class: 'cat-val', text: UI.money(c.revenue) })
        ));
      });
    }

    el.appendChild(h('div', { class: 'grid-2-1 mb-16' }, recentCard, lowCard));
    el.appendChild(topCard);

    /* ---------- Actions rapides ---------- */
    el.appendChild(h('div', { class: 'card mt-16' },
      h('div', { class: 'card-b', style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-primary', type: 'button', html: UI.icon('sales', 16) + ' Nouvelle facture', onclick: function () { root.COMPTA.docs.openEditor({ kind: 'sale', mode: 'invoice' }); } }),
        h('button', { class: 'btn btn-outline', type: 'button', html: UI.icon('purchases', 16) + ' Nouvel achat', onclick: function () { root.COMPTA.docs.openEditor({ kind: 'purchase', mode: 'purchase' }); } }),
        h('button', { class: 'btn btn-outline', type: 'button', html: UI.icon('stock', 16) + ' Nouveau produit', onclick: function () { location.hash = '#/stock'; setTimeout(function () { root.COMPTA.stock && root.COMPTA.stock.openProductEditor(); }, 60); } }),
        h('button', { class: 'btn btn-outline', type: 'button', html: UI.icon('clients', 16) + ' Nouveau client', onclick: function () { location.hash = '#/clients'; setTimeout(function () { root.COMPTA.contacts && root.COMPTA.contacts.openContactEditor('client'); }, 60); } })
      )
    ));
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

  function mini(iconName, label, value, color, sub) {
    return h('div', { class: 'card', style: { padding: '16px 18px', display: 'flex', gap: '14px', alignItems: 'center' } },
      h('div', { class: 'kpi-ico ' + color, html: UI.icon(iconName, 22) }),
      h('div', null,
        h('div', { class: 'kpi-lbl', text: label }),
        h('div', { class: 'kpi-val', text: value }),
        h('div', { class: 'kpi-sub', text: sub })
      )
    );
  }

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.dashboard = { render: render, title: 'Tableau de bord', sub: 'Vue d\u2019ensemble de votre activité' };
})(typeof window !== 'undefined' ? window : this);
