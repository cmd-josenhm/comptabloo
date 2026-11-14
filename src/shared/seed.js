/*!
 * COMPTABLOO — Données de démonstration.
 * Module UMD (navigateur + Node). Génère un jeu de données réaliste sur les
 * 8 derniers mois, avec des dates RELATIVES à aujourd'hui : le tableau de bord
 * est toujours vivant, quel que soit le jour où on charge la démo.
 *
 * Générateur pseudo-aléatoire à graine fixe => données reproductibles.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./logic.js'));
  } else {
    root.COMPTA = root.COMPTA || {};
    root.COMPTA.seed = factory(root.COMPTA.logic);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L) {
  'use strict';

  /** Générateur pseudo-aléatoire déterministe (mulberry32). */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildDemoState(companyName) {
    const rand = rng(20260101);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

    const today = L.todayISO();
    const day = (offsetDays) => L.addDaysISO(today, offsetDays);

    const state = L.emptyState();
    state.settings.onboarded = true;
    if (companyName) state.settings.companyName = companyName;

    /* ---------------- Clients ---------------- */
    const clientSeeds = [
      ['Boutique Awa', 'Mme Awa Lawson', 'Lomé', '90 12 34 56', 'awa.boutique@example.tg'],
      ['Éts Kodjo & Frères', 'M. Kodjo Mensah', 'Lomé', '90 23 45 67', 'kodjo.freres@example.tg'],
      ['Pharmacie du Plateau', 'Dr Sika Amégan', 'Lomé', '90 34 56 78', 'pharmacie.plateau@example.tg'],
      ['École Les Palmiers', 'M. Koffi Adjé', 'Tsévié', '90 45 67 89', 'ecole.palmiers@example.tg'],
      ['Hôtel Le Lac', 'Mme Abra Tetteh', 'Lomé', '90 56 78 90', 'contact@hotellelac.example.tg'],
      ['Quincaillerie Adjé & Fils', 'M. Yao Adjé', 'Atakpamé', '90 67 89 01', 'quincaillerie.adje@example.tg'],
      ['Restaurant Mama Akou', 'Mme Akouvi Doe', 'Lomé', '90 78 90 12', 'mama.akou@example.tg'],
      ['Cyber Café Espoir', 'M. Sena Bodjona', 'Kpalimé', '90 89 01 23', 'espoir.cyber@example.tg']
    ];
    const clients = clientSeeds.map(function (c, i) {
      return {
        id: 'cli-' + (i + 1),
        name: c[0],
        contact: c[1],
        address: c[2],
        phone: c[3],
        email: c[4],
        notes: '',
        createdAt: day(-240 + i * 5) + 'T09:00:00.000Z'
      };
    });
    state.clients = clients;

    /* ---------------- Fournisseurs ---------------- */
    const supplierSeeds = [
      ['Grossiste Adjinaku', 'M. Adjinaku Sènou', 'Grand Marché, Lomé', '91 11 22 33', 'adjinaku.grossiste@example.tg'],
      ['Socopime Import', 'Mme Grâce Amouzou', 'Zone portuaire, Lomé', '91 22 33 44', 'commandes@socopime.example.tg'],
      ['Tecno Distribution TG', 'M. Ibrahim Farouk', 'Agbalépédogan, Lomé', '91 33 44 55', 'ventes@tecnodist.example.tg'],
      ['Comptoir Commercial du Golfe', 'M. Étienne Ahyi', 'Bè-Kpota, Lomé', '91 44 55 66', 'ccg@example.tg'],
      ['Africa Paper SARL', 'Mme Fanta K.', 'Agoè, Lomé', '91 55 66 77', 'afripaper@example.tg']
    ];
    const suppliers = supplierSeeds.map(function (s, i) {
      return {
        id: 'fou-' + (i + 1),
        name: s[0],
        contact: s[1],
        address: s[2],
        phone: s[3],
        email: s[4],
        notes: '',
        createdAt: day(-238 + i * 7) + 'T09:00:00.000Z'
      };
    });
    state.suppliers = suppliers;

    /* ---------------- Produits ---------------- */
    const productSeeds = [
      // [nom, catégorie, unité, PA, PV, stock initial, seuil alerte]
      ['Téléviseur LED 43"', 'Électronique', 'pièce', 95000, 145000, 6, 2],
      ['Smartphone Tecno Spark 10', 'Électronique', 'pièce', 52000, 78000, 12, 4],
      ['Ordinateur portable HP 15', 'Électronique', 'pièce', 285000, 379000, 3, 2],
      ['Écouteurs Bluetooth', 'Électronique', 'pièce', 4500, 8500, 45, 10],
      ['Ventilateur sur pied', 'Électroménager', 'pièce', 18000, 27000, 9, 3],
      ['Groupe électrogène 2 kVA', 'Électroménager', 'pièce', 210000, 275000, 2, 1],
      ['Riz parfumé 25 kg', 'Alimentation', 'sac', 14500, 17500, 40, 10],
      ['Huile végétale 20 L', 'Alimentation', 'bidon', 22000, 26500, 15, 5],
      ['Sucre granulé 50 kg', 'Alimentation', 'sac', 32000, 37500, 8, 4],
      ['Farine de blé 50 kg', 'Alimentation', 'sac', 21000, 25000, 11, 4],
      ['Ciment (sac 50 kg)', 'Quincaillerie', 'sac', 4900, 5700, 120, 30],
      ['Tôle bac alu (unité)', 'Quincaillerie', 'pièce', 7800, 9500, 60, 20],
      ['Ramette papier A4 (500 f.)', 'Papeterie', 'paquet', 3200, 4500, 35, 10],
      ['Cartouche d\u2019encre noire', 'Papeterie', 'pièce', 8500, 12500, 4, 6]
    ];
    const products = productSeeds.map(function (p, i) {
      return {
        id: 'prd-' + (i + 1),
        sku: 'ART-' + String(i + 1).padStart(3, '0'),
        name: p[0],
        category: p[1],
        unit: p[2],
        costPrice: p[3],
        salePrice: p[4],
        openingStock: p[5],
        stockAlert: p[6],
        archived: false,
        notes: '',
        createdAt: day(-235 + i) + 'T09:00:00.000Z'
      };
    });
    state.products = products;

    /* ---------------- Achats ---------------- */
    const sales = [];
    const purchases = [];
    const METHODS = ['Espèces', 'Mobile Money', 'Virement', 'Chèque'];

    let purchaseNo = 0;
    for (let m = 7; m >= 0; m--) {
      const monthStart = L.addDaysISO(today, -m * 30);
      const nPurchases = between(1, 3);
      for (let k = 0; k < nPurchases; k++) {
        purchaseNo += 1;
        const supplier = pick(suppliers);
        const nLines = between(1, 3);
        const lines = [];
        for (let j = 0; j < nLines; j++) {
          const p = pick(products);
          const qty = p.category === 'Quincaillerie' || p.category === 'Alimentation' ? between(10, 50) : between(1, 8);
          lines.push({
            id: 'pl-' + purchaseNo + '-' + j,
            productId: p.id,
            description: p.name,
            qty: qty,
            unitPrice: p.costPrice,
            discount: rand() < 0.2 ? 5 : 0
          });
        }
        const date = L.addDaysISO(monthStart, between(1, 26));
        if (date > today) continue;
        const doc = {
          id: 'ach-' + purchaseNo,
          number: 'ACH-' + String(purchaseNo).padStart(4, '0'),
          type: 'purchase',
          date: date,
          supplierId: supplier.id,
          lines: lines,
          taxRate: 18,
          notes: '',
          payments: [],
          createdAt: date + 'T10:00:00.000Z'
        };
        const total = L.computeDocTotals(doc, state.settings).total;
        const r = rand();
        if (r < 0.75) {
          doc.payments.push({ id: 'ppay-' + purchaseNo, date: L.addDaysISO(date, between(0, 6)), amount: total, method: pick(METHODS), note: 'Règlement complet' });
        } else if (r < 0.9) {
          doc.payments.push({ id: 'ppay-' + purchaseNo, date: L.addDaysISO(date, between(0, 4)), amount: L.roundMoney(total * 0.5, 0), method: 'Espèces', note: 'Acompte 50%' });
        }
        purchases.push(doc);
      }
    }
    state.purchases = purchases;

    /* ---------------- Ventes (factures + devis) ---------------- */
    let saleNo = 0;
    let quoteNo = 0;
    for (let m = 7; m >= 0; m--) {
      const monthStart = L.addDaysISO(today, -m * 30);
      const nSales = between(2, 5);
      for (let k = 0; k < nSales; k++) {
        saleNo += 1;
        const client = pick(clients);
        const nLines = between(1, 4);
        const lines = [];
        for (let j = 0; j < nLines; j++) {
          const p = pick(products);
          const qty = p.category === 'Quincaillerie' || p.category === 'Alimentation' ? between(2, 20) : between(1, 4);
          lines.push({
            id: 'sl-' + saleNo + '-' + j,
            productId: p.id,
            description: p.name,
            qty: qty,
            unitPrice: p.salePrice,
            discount: rand() < 0.25 ? pick([2, 5, 10]) : 0
          });
        }
        const date = L.addDaysISO(monthStart, between(1, 27));
        if (date > today) continue;
        const isQuote = m <= 1 && rand() < 0.3;
        if (isQuote) {
          quoteNo += 1;
          sales.push({
            id: 'dev-' + quoteNo,
            number: 'DEVIS-' + String(quoteNo).padStart(4, '0'),
            type: 'quote',
            date: date,
            dueDate: L.addDaysISO(date, 15),
            clientId: client.id,
            lines: lines,
            taxRate: 18,
            notes: 'Devis en attente de confirmation du client.',
            payments: [],
            createdAt: date + 'T11:00:00.000Z'
          });
        } else {
          const doc = {
            id: 'fac-' + saleNo,
            number: 'FACT-' + String(saleNo).padStart(4, '0'),
            type: 'invoice',
            date: date,
            dueDate: L.addDaysISO(date, 30),
            clientId: client.id,
            lines: lines,
            taxRate: 18,
            notes: '',
            payments: [],
            createdAt: date + 'T11:00:00.000Z'
          };
          const total = L.computeDocTotals(doc, state.settings).total;
          const r = rand();
          if (r < 0.62) {
            doc.payments.push({ id: 'pay-' + saleNo, date: L.addDaysISO(date, between(0, 5)), amount: total, method: pick(METHODS), note: '' });
          } else if (r < 0.82) {
            doc.payments.push({ id: 'pay-' + saleNo, date: L.addDaysISO(date, between(0, 3)), amount: L.roundMoney(total * pick([0.3, 0.5, 0.6]), 0), method: pick(METHODS), note: 'Acompte' });
          } else if (m > 0) {
            // facture impayée ancienne -> en retard
          }
          sales.push(doc);
        }
      }
    }
    state.sales = sales;

    /* ---------------- Ajustements de stock ---------------- */
    state.adjustments = [
      { id: 'adj-1', date: day(-120), productId: 'prd-13', qty: 5, reason: 'Réception commande Africa Paper (hors facture)', createdAt: day(-120) + 'T08:00:00.000Z' },
      { id: 'adj-2', date: day(-60), productId: 'prd-7', qty: -2, reason: 'Sacs endommagés lors du transport', createdAt: day(-60) + 'T08:00:00.000Z' },
      { id: 'adj-3', date: day(-15), productId: 'prd-1', qty: 1, reason: 'Téléviseur de démonstration rendu au stock', createdAt: day(-15) + 'T08:00:00.000Z' }
    ];

    /* ---------------- Écritures manuelles (charges courantes) ---------------- */
    const manual = [];
    let manNo = 0;
    for (let m = 7; m >= 0; m--) {
      const base = L.addDaysISO(today, -m * 30);
      const entries = [
        ['Loyer de la boutique', 'Loyer', 85000, 2],
        ['Salaires du personnel', 'Salaires', between(140000, 180000), 28],
        ['Facture CEET (électricité)', 'Électricité & eau', between(12000, 22000), 9],
        ['Forfait internet', 'Communication & internet', 15000, 12],
        ['Carburant livraisons', 'Transport', between(9000, 16000), 18]
      ];
      entries.forEach(function (e) {
        manNo += 1;
        const date = L.addDaysISO(base, e[3]);
        if (date > today) return;
        manual.push({
          id: 'man-' + manNo,
          date: date,
          type: 'expense',
          category: e[1],
          label: e[0] + ' — ' + L.monthLabel(L.monthKey(base)),
          amount: e[2],
          method: pick(['Espèces', 'Mobile Money', 'Virement']),
          note: '',
          createdAt: date + 'T08:30:00.000Z'
        });
      });
    }
    // un peu de revenu divers
    manual.push({ id: 'man-901', date: day(-45), type: 'income', category: 'Autres revenus', label: 'Location d\u2019un local annexe', amount: 60000, method: 'Espèces', note: '', createdAt: day(-45) + 'T08:30:00.000Z' });
    manual.push({ id: 'man-902', date: day(-100), type: 'income', category: 'Autres revenus', label: 'Commission de courtage', amount: 45000, method: 'Virement', note: '', createdAt: day(-100) + 'T08:30:00.000Z' });
    state.journal = manual;

    return state;
  }

  return { buildDemoState: buildDemoState };
});
