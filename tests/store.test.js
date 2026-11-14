/*!
 * COMPTABLOO — Tests du magasin d'état (mutations métier + persistance).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/shared/logic.js');
const storeFactory = require('../src/renderer/js/store.js');

function freshStore(saved) {
  const calls = { save: 0 };
  const adapter = {
    save: function (data) { calls.save += 1; saved.data = JSON.parse(JSON.stringify(data)); return Promise.resolve({ ok: true }); }
  };
  storeFactory.init(L.emptyState(), adapter);
  return { st: storeFactory, calls: calls };
}

test('init — état vide normalisé', () => {
  const { st } = freshStore({});
  assert.strictEqual(st.state.settings.currency, 'XOF');
  assert.strictEqual(st.state.sales.length, 0);
});

test('upsertContact — création, modification, suppression, garde-fous', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'Boutique Awa', phone: '90 12 34 56' });
  const c = st.state.clients[0];
  assert.ok(c.id);
  assert.strictEqual(c.name, 'Boutique Awa');
  st.upsertContact('client', { id: c.id, name: 'Boutique Awa & Fils' });
  assert.strictEqual(st.state.clients.length, 1);
  assert.strictEqual(st.state.clients[0].name, 'Boutique Awa & Fils');
  st.deleteContact('client', c.id);
  assert.strictEqual(st.state.clients.length, 0);
  // Nom obligatoire
  assert.throws(() => st.upsertContact('client', { name: '  ' }), /nom/i);
});

test('upsertSale — création avec numéro auto, stock impacté', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'Client 1' });
  st.upsertProduct({ name: 'Riz 25kg', costPrice: 14500, salePrice: 17500, openingStock: 20 });
  const client = st.state.clients[0];
  const p = st.state.products[0];
  const doc = st.upsertSale({
    type: 'invoice',
    clientId: client.id,
    date: '2026-11-01',
    lines: [{ productId: p.id, description: 'Riz 25kg', qty: 5, unitPrice: 17500 }]
  });
  assert.strictEqual(doc.number, 'FACT-0001');
  assert.strictEqual(L.computeStock(st.state, p.id), 15);
  // deuxième facture -> FACT-0002
  const doc2 = st.upsertSale({ type: 'invoice', clientId: client.id, lines: [{ productId: p.id, description: 'Riz', qty: 1, unitPrice: 17500 }] });
  assert.strictEqual(doc2.number, 'FACT-0002');
});

test('upsertSale — validation des lignes', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'C' });
  const client = st.state.clients[0];
  assert.throws(() => st.upsertSale({ type: 'invoice', clientId: client.id, lines: [] }), /au moins une ligne/i);
  assert.throws(() => st.upsertSale({ type: 'invoice', lines: [{ description: 'x', qty: 1, unitPrice: 1 }] }), /client/i);
  assert.throws(() => st.upsertSale({ type: 'invoice', clientId: client.id, lines: [{ description: 'x', qty: -2, unitPrice: 1 }] }), /quantit/i);
});

test('edit de vente — le stock est recalculé (dérivé)', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'C' });
  st.upsertProduct({ name: 'TV', costPrice: 1, salePrice: 100, openingStock: 10 });
  const client = st.state.clients[0];
  const p = st.state.products[0];
  const doc = st.upsertSale({ type: 'invoice', clientId: client.id, lines: [{ productId: p.id, description: 'TV', qty: 4, unitPrice: 100 }] });
  assert.strictEqual(L.computeStock(st.state, p.id), 6);
  // modification : qté 4 -> 2
  st.upsertSale({ id: doc.id, type: 'invoice', clientId: client.id, date: doc.date, lines: [{ productId: p.id, description: 'TV', qty: 2, unitPrice: 100 }] });
  assert.strictEqual(L.computeStock(st.state, p.id), 8);
  // suppression : stock restauré
  st.deleteSale(doc.id);
  assert.strictEqual(L.computeStock(st.state, p.id), 10);
});

test('convertQuote — devis converti une seule fois', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'C' });
  st.upsertProduct({ name: 'TV', costPrice: 1, salePrice: 100, openingStock: 10 });
  const client = st.state.clients[0];
  const p = st.state.products[0];
  const quote = st.upsertSale({ type: 'quote', clientId: client.id, lines: [{ productId: p.id, description: 'TV', qty: 3, unitPrice: 100 }] });
  assert.strictEqual(L.computeStock(st.state, p.id), 10, 'un devis ne modifie pas le stock');
  const inv = st.convertQuote(quote.id);
  assert.strictEqual(inv.number, 'FACT-0001');
  assert.strictEqual(L.computeStock(st.state, p.id), 7, 'la conversion impacte le stock');
  assert.strictEqual(L.docStatus(quote, st.state.settings), 'converted');
  // reconvertir renvoie la même facture
  const inv2 = st.convertQuote(quote.id);
  assert.strictEqual(inv2.id, inv.id);
  assert.strictEqual(st.state.sales.filter((d) => d.type === 'invoice').length, 1);
});

test('paiements — statuts et journal dérivé', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'C' });
  st.upsertProduct({ name: 'TV', costPrice: 1, salePrice: 1000, openingStock: 10 });
  const client = st.state.clients[0];
  const p = st.state.products[0];
  const doc = st.upsertSale({ type: 'invoice', clientId: client.id, lines: [{ productId: p.id, description: 'TV', qty: 1, unitPrice: 1000 }] });
  st.addSalePayment(doc.id, { amount: 500, date: '2026-11-01', method: 'Espèces' });
  assert.strictEqual(L.docStatus(st._internal.findSale(doc.id), st.state.settings), 'partial');
  assert.strictEqual(L.deriveJournal(st.state).length, 1);
  st.addSalePayment(doc.id, { amount: 680, date: '2026-11-02', method: 'Mobile Money' }); // total = 1180
  const saved = st._internal.findSale(doc.id);
  assert.strictEqual(L.docStatus(saved, st.state.settings), 'paid');
  // suppression du dernier paiement -> retour partiel + écriture disparue
  st.deleteSalePayment(doc.id, saved.payments[1].id);
  assert.strictEqual(L.docStatus(st._internal.findSale(doc.id), st.state.settings), 'partial');
  assert.strictEqual(L.deriveJournal(st.state).length, 1);
  assert.throws(() => st.addSalePayment(doc.id, { amount: 0 }), /supérieur à zéro/i);
});

test('achats — stock incrémenté et dettes', () => {
  const { st } = freshStore({});
  st.upsertContact('supplier', { name: 'F' });
  const f = st.state.suppliers[0];
  st.upsertProduct({ name: 'Ciment', costPrice: 4900, salePrice: 5700, openingStock: 0 });
  const p = st.state.products[0];
  const a = st.upsertPurchase({ supplierId: f.id, lines: [{ productId: p.id, description: 'Ciment', qty: 50, unitPrice: 4900 }] });
  assert.strictEqual(a.number, 'ACH-0001');
  assert.strictEqual(L.computeStock(st.state, p.id), 50);
  assert.strictEqual(L.totalPayables(st.state), L.computeDocTotals(a, st.state.settings).total);
  st.addPurchasePayment(a.id, { amount: 100000, date: '2026-11-01' });
  assert.strictEqual(L.deriveJournal(st.state).length, 1);
});

test('produit référencé — suppression bloquée, archivage possible', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'C' });
  st.upsertProduct({ name: 'TV', costPrice: 1, salePrice: 100, openingStock: 10 });
  const client = st.state.clients[0];
  const p = st.state.products[0];
  st.upsertSale({ type: 'invoice', clientId: client.id, lines: [{ productId: p.id, description: 'TV', qty: 1, unitPrice: 100 }] });
  assert.throws(() => st.deleteProduct(p.id), /utilisé dans des documents/i);
  st.toggleArchiveProduct(p.id);
  assert.strictEqual(st.state.products[0].archived, true);
});

test('ajustements de stock', () => {
  const { st } = freshStore({});
  st.upsertProduct({ name: 'Sucre', costPrice: 10, salePrice: 15, openingStock: 8 });
  const p = st.state.products[0];
  st.addAdjustment({ productId: p.id, qty: -3, reason: 'casse', date: '2026-11-01' });
  assert.strictEqual(L.computeStock(st.state, p.id), 5);
  const adj = st.state.adjustments[0];
  st.deleteAdjustment(adj.id);
  assert.strictEqual(L.computeStock(st.state, p.id), 8);
  assert.throws(() => st.addAdjustment({ productId: p.id, qty: 0 }), /quantité/i);
});

test('écritures manuelles — CRUD et catégories proposées', () => {
  const { st } = freshStore({});
  st.upsertJournalEntry({ date: '2026-11-01', type: 'expense', category: 'Loyer', label: 'Loyer novembre', amount: 85000 });
  const e = st.state.journal[0];
  assert.strictEqual(st.state.journal.length, 1);
  st.upsertJournalEntry({ id: e.id, date: '2026-11-01', type: 'expense', category: 'Loyer', label: 'Loyer novembre (corrigé)', amount: 90000 });
  assert.strictEqual(st.state.journal.length, 1);
  assert.strictEqual(st.state.journal[0].amount, 90000);
  assert.throws(() => st.upsertJournalEntry({ type: 'expense', label: '', amount: 10 }), /libellé/i);
  assert.throws(() => st.upsertJournalEntry({ type: 'expense', label: 'x', amount: -5 }), /montant/i);
  assert.ok(st.EXPENSE_CATEGORIES.includes('Salaires'));
  assert.ok(st.INCOME_CATEGORIES.includes('Ventes'));
  st.deleteJournalEntry(e.id);
  assert.strictEqual(st.state.journal.length, 0);
});

test('persistance — sauvegarde différée puis remplacement d\u2019état', async () => {
  const saved = {};
  const { st, calls } = freshStore(saved);
  st.upsertContact('client', { name: 'A' });
  await new Promise(function (r) { setTimeout(r, 500); }); // debounce de 350 ms
  assert.strictEqual(calls.save, 1, 'chaque mutation déclenche une sauvegarde différée');
  assert.strictEqual(saved.data.clients.length, 1);
  st.replaceState(L.emptyState());
  assert.strictEqual(st.state.clients.length, 0);
});

test('resetAll — état vide mais paramètres par défaut conservés', () => {
  const { st } = freshStore({});
  st.upsertContact('client', { name: 'A' });
  st.resetAll();
  assert.strictEqual(st.state.clients.length, 0);
  assert.strictEqual(st.state.settings.currency, 'XOF');
  assert.strictEqual(st.state.settings.onboarded, true);
});

test('onChange — notification à chaque mutation', () => {
  const { st } = freshStore({});
  let count = 0;
  st.onChange(() => { count += 1; });
  st.upsertContact('client', { name: 'A' });
  st.upsertContact('supplier', { name: 'B' });
  assert.strictEqual(count, 2);
});
