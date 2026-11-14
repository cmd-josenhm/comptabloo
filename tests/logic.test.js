/*!
 * COMPTABLOO — Tests unitaires de la logique métier.
 * Exécution : npm test
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/shared/logic.js');

/* ==================================================================== */
/* Formatage monétaire                                                   */
/* ==================================================================== */

test('formatMoney — FCFA (XOF) sans décimales', () => {
  const s = { currency: 'XOF' };
  assert.strictEqual(L.formatMoney(1250000, s).replace(/\u202f|\u00a0/g, ' '), '1 250 000 FCFA');
  assert.strictEqual(L.formatMoney(0, s).replace(/\u202f|\u00a0/g, ' '), '0 FCFA');
});

test('formatMoney — EUR avec 2 décimales', () => {
  const s = { currency: 'EUR' };
  const out = L.formatMoney(1250.5, s).replace(/\u202f|\u00a0/g, ' ');
  assert.strictEqual(out, '1 250,50 €');
});

test('roundMoney — arrondis sûrs', () => {
  assert.strictEqual(L.roundMoney(0.1 + 0.2, 2), 0.3);
  assert.strictEqual(L.roundMoney(2.675, 2), 2.68);
  assert.strictEqual(L.roundMoney(1250000.4, 0), 1250000);
  assert.strictEqual(L.roundMoney(-5.5, 0), -6);
});

/* ==================================================================== */
/* Dates                                                                 */
/* ==================================================================== */

test('parseISO / formatDate — pas de décalage de fuseau', () => {
  const d = L.parseISO('2026-11-14');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 10);
  assert.strictEqual(d.getDate(), 14);
  assert.strictEqual(L.formatDate('2026-11-14'), '14/11/2026');
  assert.strictEqual(L.parseISO('2026-13-99'), null);
});

test('addDaysISO — passages de mois et d\u2019année', () => {
  assert.strictEqual(L.addDaysISO('2026-01-31', 1), '2026-02-01');
  assert.strictEqual(L.addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(L.addDaysISO('2026-11-14', -14), '2026-10-31');
});

test('startOfMonthISO / endOfMonthISO', () => {
  assert.strictEqual(L.startOfMonthISO('2026-11-14'), '2026-11-01');
  assert.strictEqual(L.endOfMonthISO('2026-02-10'), '2026-02-28');
  assert.strictEqual(L.endOfMonthISO('2028-02-10'), '2028-02-29'); // bissextile
});

/* ==================================================================== */
/* Totaux de documents                                                   */
/* ==================================================================== */

const SETTINGS = { currency: 'XOF', taxRate: 18 };

test('computeDocTotals — facture simple sans remise', () => {
  const doc = {
    lines: [
      { qty: 2, unitPrice: 10000, discount: 0 },
      { qty: 1, unitPrice: 5000, discount: 0 }
    ],
    taxRate: 18
  };
  const t = L.computeDocTotals(doc, SETTINGS);
  assert.strictEqual(t.subtotal, 25000);
  assert.strictEqual(t.discountTotal, 0);
  assert.strictEqual(t.taxTotal, 4500);
  assert.strictEqual(t.total, 29500);
});

test('computeDocTotals — remises par ligne', () => {
  const doc = {
    lines: [
      { qty: 10, unitPrice: 1000, discount: 10 }, // 9000
      { qty: 4, unitPrice: 2500, discount: 0 }    // 10000
    ],
    taxRate: 18
  };
  const t = L.computeDocTotals(doc, SETTINGS);
  assert.strictEqual(t.subtotal, 19000);
  assert.strictEqual(t.discountTotal, 1000);
  assert.strictEqual(t.taxTotal, L.roundMoney(19000 * 0.18, 0));
  assert.strictEqual(t.total, 19000 + L.roundMoney(19000 * 0.18, 0));
});

test('computeDocTotals — TVA 0% et arrondi FCFA', () => {
  const doc = {
    lines: [{ qty: 3, unitPrice: 3333.7, discount: 0 }],
    taxRate: 0
  };
  const t = L.computeDocTotals(doc, SETTINGS);
  assert.strictEqual(t.subtotal, 10001); // 10001.1 arrondi
  assert.strictEqual(t.taxTotal, 0);
  assert.strictEqual(t.total, 10001);
});

test('computeDocTotals — devise EUR, arrondi à 2 décimales', () => {
  const doc = {
    lines: [{ qty: 3, unitPrice: 33.33, discount: 0 }],
    taxRate: 20
  };
  const t = L.computeDocTotals(doc, { currency: 'EUR' });
  assert.strictEqual(t.subtotal, 99.99);
  assert.strictEqual(t.taxTotal, 20);
  assert.strictEqual(t.total, 119.99);
});

/* ==================================================================== */
/* Paiements et statuts                                                  */
/* ==================================================================== */

test('docStatus / dueAmount / isOverdue — cycle de paiement', () => {
  const doc = {
    type: 'invoice',
    date: '2026-10-01',
    dueDate: '2026-10-31',
    lines: [{ qty: 1, unitPrice: 100000, discount: 0 }],
    taxRate: 18,
    payments: []
  };
  // Impayée et pas encore en retard
  assert.strictEqual(L.docStatus(doc, SETTINGS), 'unpaid');
  assert.strictEqual(L.dueAmount(doc, SETTINGS), 118000);
  assert.strictEqual(L.isOverdue(doc, SETTINGS, '2026-10-15'), false);
  // En retard après échéance
  assert.strictEqual(L.isOverdue(doc, SETTINGS, '2026-11-14'), true);
  // Acompte -> partielle
  doc.payments.push({ amount: 50000, date: '2026-10-02' });
  assert.strictEqual(L.docStatus(doc, SETTINGS), 'partial');
  assert.strictEqual(L.dueAmount(doc, SETTINGS), 68000);
  // Solde -> payée, plus en retard
  doc.payments.push({ amount: 68000, date: '2026-11-01' });
  assert.strictEqual(L.docStatus(doc, SETTINGS), 'paid');
  assert.strictEqual(L.dueAmount(doc, SETTINGS), 0);
  assert.strictEqual(L.isOverdue(doc, SETTINGS, '2026-11-14'), false);
});

test('docStatus — devis : en attente puis facturé', () => {
  assert.strictEqual(L.docStatus({ type: 'quote', payments: [] }, SETTINGS), 'pending');
  assert.strictEqual(L.docStatus({ type: 'quote', convertedTo: 'x' }, SETTINGS), 'converted');
});

test('paidAmount — somme des paiements', () => {
  assert.strictEqual(L.paidAmount({ payments: [{ amount: 10 }, { amount: 5.5 }] }), 15.5);
  assert.strictEqual(L.paidAmount({}), 0);
});

/* ==================================================================== */
/* Numérotation                                                          */
/* ==================================================================== */

test('nextDocNumber — séquence et non-réutilisation', () => {
  const state = {
    settings: { invoicePrefix: 'FACT', quotePrefix: 'DEVIS', purchasePrefix: 'ACH' },
    sales: [
      { type: 'invoice', number: 'FACT-0001' },
      { type: 'invoice', number: 'FACT-0007' },
      { type: 'quote', number: 'DEVIS-0002' }
    ],
    purchases: [{ number: 'ACH-0003' }]
  };
  assert.strictEqual(L.nextDocNumber('invoice', state), 'FACT-0008');
  assert.strictEqual(L.nextDocNumber('quote', state), 'DEVIS-0003');
  assert.strictEqual(L.nextDocNumber('purchase', state), 'ACH-0004');
  // Suppression du max : pas de réutilisation
  state.sales = state.sales.filter((d) => d.number !== 'FACT-0007');
  assert.strictEqual(L.nextDocNumber('invoice', state), 'FACT-0002');
});

/* ==================================================================== */
/* Stock (dérivé)                                                        */
/* ==================================================================== */

function stockState() {
  return {
    settings: SETTINGS,
    products: [
      { id: 'p1', name: 'Riz', openingStock: 10, stockAlert: 5, costPrice: 100 },
      { id: 'p2', name: 'TV', openingStock: 2, stockAlert: 0, costPrice: 5000 }
    ],
    sales: [
      {
        id: 's1', type: 'invoice', number: 'FACT-0001', date: '2026-01-10',
        lines: [{ productId: 'p1', qty: 4, unitPrice: 150 }]
      },
      {
        id: 's2', type: 'quote', number: 'DEVIS-0001', date: '2026-01-11',
        lines: [{ productId: 'p1', qty: 5, unitPrice: 150 }] // un devis ne doit PAS bouger le stock
      }
    ],
    purchases: [
      {
        id: 'a1', number: 'ACH-0001', date: '2026-01-12',
        lines: [{ productId: 'p1', qty: 12, unitPrice: 100 }]
      }
    ],
    adjustments: [
      { id: 'adj1', date: '2026-01-13', productId: 'p1', qty: -2, reason: 'casse' }
    ]
  };
}

test('computeStock — ventes, achats, ajustements ; devis ignoré', () => {
  const st = stockState();
  // 10 - 4 (vente) + 12 (achat) - 2 (ajustement) = 16 ; devis ignoré
  assert.strictEqual(L.computeStock(st, 'p1'), 16);
  assert.strictEqual(L.computeStock(st, 'p2'), 2);
});

test('computeStock — supprimer une vente restaure le stock', () => {
  const st = stockState();
  st.sales = st.sales.filter((d) => d.id !== 's1');
  assert.strictEqual(L.computeStock(st, 'p1'), 20);
});

test('computeStock — modifier une vente recalcule correctement', () => {
  const st = stockState();
  st.sales[0].lines[0].qty = 9; // au lieu de 4
  assert.strictEqual(L.computeStock(st, 'p1'), 11);
});

test('productStockStatus — seuils', () => {
  assert.strictEqual(L.productStockStatus({ stockAlert: 5 }, 5), 'low');
  assert.strictEqual(L.productStockStatus({ stockAlert: 5 }, 6), 'ok');
  assert.strictEqual(L.productStockStatus({ stockAlert: 5 }, 0), 'out');
  assert.strictEqual(L.productStockStatus({ stockAlert: 0 }, 0), 'out');
});

test('stockValue — valorisation au prix d\u2019achat', () => {
  const st = stockState();
  // p1: 16 × 100 ; p2: 2 × 5000
  assert.strictEqual(L.stockValue(st), 1600 + 10000);
});

test('lowStockProducts — alertes uniquement', () => {
  const st = stockState();
  st.products[0].stockAlert = 20; // p1 (16) passe sous le seuil
  const low = L.lowStockProducts(st);
  assert.strictEqual(low.length, 1);
  assert.strictEqual(low[0].product.id, 'p1');
});

/* ==================================================================== */
/* Journal comptable dérivé                                              */
/* ==================================================================== */

function accState() {
  return {
    settings: SETTINGS,
    clients: [{ id: 'c1', name: 'Client A' }],
    suppliers: [{ id: 'f1', name: 'Four B' }],
    sales: [
      {
        id: 's1', type: 'invoice', number: 'FACT-0001', date: '2026-03-05', clientId: 'c1',
        lines: [{ qty: 1, unitPrice: 100000, discount: 0 }], taxRate: 18,
        payments: [
          { id: 'pay1', date: '2026-03-06', amount: 60000, method: 'Espèces' },
          { id: 'pay2', date: '2026-04-02', amount: 58000, method: 'Mobile Money' }
        ]
      },
      {
        id: 's2', type: 'quote', number: 'DEVIS-0001', date: '2026-03-10', clientId: 'c1',
        lines: [{ qty: 1, unitPrice: 50000, discount: 0 }], taxRate: 18,
        payments: [{ id: 'pay3', date: '2026-03-11', amount: 50000 }] // paiement sur devis : ignoré
      }
    ],
    purchases: [
      {
        id: 'a1', number: 'ACH-0001', date: '2026-03-07', supplierId: 'f1',
        lines: [{ qty: 10, unitPrice: 5000, discount: 0 }], taxRate: 18,
        payments: [{ id: 'pp1', date: '2026-03-08', amount: 30000 }]
      }
    ],
    journal: [
      { id: 'm1', date: '2026-03-31', type: 'expense', category: 'Loyer', label: 'Loyer mars', amount: 85000 },
      { id: 'm2', date: '2026-04-05', type: 'income', category: 'Autres revenus', label: 'Location', amount: 20000 }
    ]
  };
}

test('deriveJournal — paiements de ventes/achats + écritures manuelles, devis ignoré', () => {
  const entries = L.deriveJournal(accState());
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('sp-pay1'));
  assert.ok(ids.includes('sp-pay2'));
  assert.ok(ids.includes('pp-pp1'));
  assert.ok(ids.includes('m1'));
  assert.ok(ids.includes('m2'));
  assert.ok(!ids.includes('sp-pay3'), 'un paiement sur un devis ne doit pas créer d\u2019écriture');
  const saleEntry = entries.find((e) => e.id === 'sp-pay1');
  assert.strictEqual(saleEntry.type, 'income');
  assert.strictEqual(saleEntry.category, 'Ventes');
  assert.ok(saleEntry.label.includes('FACT-0001'));
  assert.ok(saleEntry.label.includes('Client A'));
  // tri décroissant par date
  for (let i = 1; i < entries.length; i++) {
    assert.ok(entries[i - 1].date >= entries[i].date);
  }
});

test('periodTotals — mars 2026 uniquement', () => {
  const t = L.periodTotals(accState(), '2026-03-01', '2026-03-31');
  // Recettes mars : 60000 (FACT-0001) ; dépenses : 30000 (ACH) + 85000 (loyer)
  assert.strictEqual(t.income, 60000);
  assert.strictEqual(t.expense, 115000);
  assert.strictEqual(t.result, -55000);
  assert.strictEqual(t.incomeByCat['Ventes'], 60000);
  assert.strictEqual(t.expenseByCat['Loyer'], 85000);
  assert.strictEqual(t.expenseByCat['Achats'], 30000);
  // TVA : collectée sur facture de mars (18000), déductible sur achat de mars (9000)
  assert.strictEqual(t.tvaCollected, 18000);
  assert.strictEqual(t.tvaDeductible, 9000);
  assert.strictEqual(t.tvaDue, 9000);
});

test('periodTotals — bornes incluses', () => {
  const t = L.periodTotals(accState(), '2026-03-06', '2026-03-06');
  assert.strictEqual(t.income, 60000);
  assert.strictEqual(t.expense, 0);
});

test('monthlySeries — 12 mois, cumuls par mois', () => {
  const series = L.monthlySeries(accState(), 12);
  assert.strictEqual(series.length, 12);
  const march = series.find((m) => m.key === '2026-03');
  assert.ok(march, 'mars doit être dans la fenêtre de 12 mois');
  assert.strictEqual(march.income, 60000);
  assert.strictEqual(march.expense, 115000);
});

/* ==================================================================== */
/* Balances clients / fournisseurs                                       */
/* ==================================================================== */

test('clientBalances — encours calculé sur les factures', () => {
  const st = accState();
  const bal = L.clientBalances(st).find((b) => b.contact.id === 'c1');
  // FACT-0001 : 118000 − 118000 payés = 0 ; devis ignoré
  assert.strictEqual(bal.due, 0);
  assert.strictEqual(bal.docCount, 1);
  // On retire un paiement -> encours 58000
  st.sales[0].payments.pop();
  const bal2 = L.clientBalances(st).find((b) => b.contact.id === 'c1');
  assert.strictEqual(bal2.due, 58000);
  assert.strictEqual(L.totalReceivables(st), 58000);
});

test('supplierBalances — dettes fournisseurs', () => {
  const st = accState();
  const bal = L.supplierBalances(st).find((b) => b.contact.id === 'f1');
  // ACH-0001 : 59000 total, 30000 payés
  assert.strictEqual(bal.due, 29000);
  assert.strictEqual(L.totalPayables(st), 29000);
});

/* ==================================================================== */
/* Analyses                                                              */
/* ==================================================================== */

test('topProducts / salesByCategory / revenueByClient', () => {
  const st = {
    settings: SETTINGS,
    clients: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }],
    products: [{ id: 'p1', name: 'TV', category: 'Électronique' }],
    sales: [
      { type: 'invoice', date: '2026-02-01', clientId: 'c1', lines: [{ productId: 'p1', description: 'TV', qty: 2, unitPrice: 100000 }] },
      { type: 'invoice', date: '2026-02-10', clientId: 'c2', lines: [{ productId: 'p1', description: 'TV', qty: 1, unitPrice: 100000 }, { productId: null, description: 'Livraison', qty: 1, unitPrice: 5000 }] },
      { type: 'invoice', date: '2025-12-10', clientId: 'c1', lines: [{ productId: 'p1', description: 'TV', qty: 5, unitPrice: 100000 }] },
      { type: 'quote', date: '2026-02-15', clientId: 'c2', lines: [{ productId: 'p1', description: 'TV', qty: 3, unitPrice: 100000 }] }
    ],
    purchases: []
  };
  const top = L.topProducts(st, '2026-01-01', '2026-12-31');
  assert.strictEqual(top.length, 2); // TV + ligne libre
  assert.strictEqual(top[0].description, 'TV');
  assert.strictEqual(top[0].qty, 3); // 2 + 1 (devis exclu, 2025 exclu)
  assert.strictEqual(top[0].revenue, 300000);
  assert.strictEqual(top[0].category, 'Électronique');

  const cats = L.salesByCategory(st, '2026-01-01', '2026-12-31');
  assert.strictEqual(cats[0].label, 'Électronique');
  assert.strictEqual(cats[0].value, 300000);

  const byClient = L.revenueByClient(st, '2026-01-01', '2026-12-31');
  assert.strictEqual(byClient[0].name, 'A');
  assert.strictEqual(byClient[0].revenue, 200000);
});

/* ==================================================================== */
/* Montant en lettres                                                    */
/* ==================================================================== */

test('intToWordsFr — nombres entiers', () => {
  assert.strictEqual(L.intToWordsFr(0), 'zéro');
  assert.strictEqual(L.intToWordsFr(7), 'sept');
  assert.strictEqual(L.intToWordsFr(11), 'onze');
  assert.strictEqual(L.intToWordsFr(21), 'vingt et un');
  assert.strictEqual(L.intToWordsFr(61), 'soixante et un');
  assert.strictEqual(L.intToWordsFr(71), 'soixante et onze');
  assert.strictEqual(L.intToWordsFr(75), 'soixante-quinze');
  assert.strictEqual(L.intToWordsFr(80), 'quatre-vingts');
  assert.strictEqual(L.intToWordsFr(81), 'quatre-vingt-un');
  assert.strictEqual(L.intToWordsFr(91), 'quatre-vingt-onze');
  assert.strictEqual(L.intToWordsFr(92), 'quatre-vingt-douze');
  assert.strictEqual(L.intToWordsFr(100), 'cent');
  assert.strictEqual(L.intToWordsFr(101), 'cent un');
  assert.strictEqual(L.intToWordsFr(111), 'cent onze');
  assert.strictEqual(L.intToWordsFr(200), 'deux cents');
  assert.strictEqual(L.intToWordsFr(201), 'deux cent un');
  assert.strictEqual(L.intToWordsFr(1000), 'mille');
  assert.strictEqual(L.intToWordsFr(1001), 'mille un');
  assert.strictEqual(L.intToWordsFr(21000), 'vingt et un mille');
  assert.strictEqual(L.intToWordsFr(80000), 'quatre-vingt mille');
  assert.strictEqual(L.intToWordsFr(200000), 'deux cent mille');
  assert.strictEqual(L.intToWordsFr(999999), 'neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf');
  assert.strictEqual(L.intToWordsFr(1000000), 'un million');
  assert.strictEqual(L.intToWordsFr(2000000), 'deux millions');
  assert.strictEqual(L.intToWordsFr(1250000), 'un million deux cent cinquante mille');
  assert.strictEqual(L.intToWordsFr(2000000000), 'deux milliards');
});

test('montantEnLettres — avec devise', () => {
  assert.strictEqual(L.montantEnLettres(295000, { currency: 'XOF' }), 'Deux cent quatre-vingt-quinze mille francs CFA');
  assert.strictEqual(L.montantEnLettres(1, { currency: 'XOF' }), 'Un franc CFA');
  assert.strictEqual(L.montantEnLettres(125.5, { currency: 'EUR' }), 'Cent vingt-cinq euros et cinquante centimes');
  assert.strictEqual(L.montantEnLettres(0, { currency: 'XOF' }), 'Zéro franc CFA');
});

/* ==================================================================== */
/* Normalisation                                                          */
/* ==================================================================== */

test('normalizeState — complète les champs manquants', () => {
  const st = L.normalizeState({ settings: { companyName: 'X' }, sales: [{ foo: 1 }] });
  assert.strictEqual(st.settings.companyName, 'X');
  assert.strictEqual(st.settings.currency, 'XOF');
  assert.ok(Array.isArray(st.clients));
  assert.ok(Array.isArray(st.journal));
  assert.strictEqual(st.sales.length, 1);
  assert.deepStrictEqual(L.normalizeState(null), L.emptyState());
});
