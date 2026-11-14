/*!
 * COMPTABLOO — Logique métier partagée.
 * Module UMD : utilisable dans le navigateur (window.COMPTA.logic)
 * et dans Node.js pour les tests automatisés (require).
 *
 * Règles de conception :
 *  - Aucune fonction ici ne touche au DOM ni au stockage.
 *  - Le stock, le journal comptable et les soldes sont TOUJOURS recalculés
 *    (dérivés) à partir des documents : impossible de désynchroniser les données.
 *  - Comptabilité de trésorerie (simplifiée pour débutants) :
 *      · une "recette"  = un encaissement sur une facture de vente (ou une écriture manuelle de revenu)
 *      · une "dépense"  = un paiement sur un achat (ou une écriture manuelle de charge)
 *  - La TVA est calculée sur les documents (facturée), pas sur les encaissements.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.COMPTA = root.COMPTA || {};
    root.COMPTA.logic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ======================================================================
   * 1. DEVISES & FORMATAGE
   * ==================================================================== */

  const CURRENCIES = {
    XOF: { code: 'XOF', symbol: 'FCFA', decimals: 0, suffix: true,  words: ['franc CFA', 'francs CFA'],        cents: ['centime', 'centimes'] },
    XAF: { code: 'XAF', symbol: 'FCFA', decimals: 0, suffix: true,  words: ['franc CFA', 'francs CFA'],        cents: ['centime', 'centimes'] },
    EUR: { code: 'EUR', symbol: '€',    decimals: 2, suffix: true,  words: ['euro', 'euros'],                   cents: ['centime', 'centimes'] },
    USD: { code: 'USD', symbol: '$',    decimals: 2, suffix: false, words: ['dollar américain', 'dollars américains'], cents: ['cent', 'cents'] },
    GBP: { code: 'GBP', symbol: '£',    decimals: 2, suffix: true,  words: ['livre sterling', 'livres sterling'],     cents: ['penny', 'pence'] },
    CAD: { code: 'CAD', symbol: '$ CA', decimals: 2, suffix: true,  words: ['dollar canadien', 'dollars canadiens'],  cents: ['cent', 'cents'] },
    CHF: { code: 'CHF', symbol: 'CHF',  decimals: 2, suffix: true,  words: ['franc suisse', 'francs suisses'],        cents: ['centime', 'centimes'] },
    GNF: { code: 'GNF', symbol: 'GNF',  decimals: 0, suffix: true,  words: ['franc guinéen', 'francs guinéens'],      cents: ['centime', 'centimes'] },
    GHS: { code: 'GHS', symbol: 'GH₵',  decimals: 2, suffix: true,  words: ['cedi', 'cedis'],                          cents: ['pesewa', 'pesewas'] },
    MAD: { code: 'MAD', symbol: 'DH',   decimals: 2, suffix: true,  words: ['dirham marocain', 'dirhams marocains'],  cents: ['centime', 'centimes'] },
    DZD: { code: 'DZD', symbol: 'DA',   decimals: 2, suffix: true,  words: ['dinar algérien', 'dinars algériens'],    cents: ['centime', 'centimes'] },
    NGN: { code: 'NGN', symbol: '₦',    decimals: 2, suffix: true,  words: ['naira', 'nairas'],                       cents: ['kobo', 'kobos'] }
  };

  function currencyOf(settings) {
    const code = (settings && settings.currency) || 'XOF';
    return CURRENCIES[code] || CURRENCIES.XOF;
  }

  function currencyDecimals(settings) {
    return currencyOf(settings).decimals;
  }

  /** Arrondi monétaire sûr (évite les erreurs à virgule flottante, demi-unités away from zero). */
  function roundMoney(value, decimals) {
    const d = decimals == null ? 2 : decimals;
    const f = Math.pow(10, d);
    const v = Number(value) || 0;
    return (v >= 0 ? Math.round(v * f + Number.EPSILON) : -Math.round(-v * f + Number.EPSILON)) / f;
  }

  function formatNumber(value, decimals) {
    const d = decimals == null ? 0 : decimals;
    const n = Number(value) || 0;
    try {
      return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    } catch (e) {
      return String(n);
    }
  }

  /** Formate un montant selon la devise configurée. Ex. « 1 250 000 FCFA », « 1 250,00 € ». */
  function formatMoney(value, settings) {
    const c = currencyOf(settings);
    const n = formatNumber(roundMoney(value, c.decimals), c.decimals);
    return c.suffix ? n + '\u202f' + c.symbol : c.symbol + n;
  }

  /** Alias court pour un montant + devise, avec signe optionnel. */
  function formatSignedMoney(value, settings) {
    const v = roundMoney(value, currencyDecimals(settings));
    return (v > 0 ? '+' : '') + formatMoney(v, settings);
  }

  /* ======================================================================
   * 2. DATES (locale, sans surprises de fuseau horaire)
   * ==================================================================== */

  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  /** '2026-11-14' -> Date locale (15h évité : new Date('2026-11-14') serait en UTC). Rejette les dates invalides. */
  function parseISO(iso) {
    if (typeof iso !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (isNaN(d.getTime())) return null;
    if (d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null; // ex. 31 février
    return d;
  }

  function toISODate(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDaysISO(iso, days) {
    const d = parseISO(iso);
    if (!d) return iso;
    d.setDate(d.getDate() + (Number(days) || 0));
    return toISODate(d);
  }

  function monthKey(iso) {
    return typeof iso === 'string' ? iso.slice(0, 7) : '';
  }

  function monthLabel(key) {
    const parts = String(key || '').split('-');
    const m = +parts[1];
    return (MONTHS_SHORT[m - 1] || parts[1] || '') + ' ' + (parts[0] || '');
  }

  function formatDate(iso) {
    const d = parseISO(iso);
    if (!d) return iso || '';
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function formatDateLong(iso) {
    const d = parseISO(iso);
    if (!d) return iso || '';
    return DAYS_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear();
  }

  function startOfMonthISO(iso) {
    const base = iso || todayISO();
    return base.slice(0, 7) + '-01';
  }

  function endOfMonthISO(iso) {
    const d = parseISO(startOfMonthISO(iso));
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return toISODate(d);
  }

  function startOfYearISO(iso) {
    return (iso || todayISO()).slice(0, 4) + '-01-01';
  }

  function daysBetween(isoA, isoB) {
    const a = parseISO(isoA);
    const b = parseISO(isoB);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }

  /* ======================================================================
   * 3. IDENTIFIANTS
   * ==================================================================== */

  let uidCounter = 0;
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    uidCounter += 1;
    return 'id-' + Date.now().toString(36) + '-' + uidCounter + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* ======================================================================
   * 4. DOCUMENTS (ventes & achats)
   * ==================================================================== */

  /** Net HT d'une ligne, remise déduite, arrondi à la devise. */
  function lineNet(line, settings) {
    const dec = currencyDecimals(settings);
    const gross = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
    const net = gross * (1 - (Number(line.discount) || 0) / 100);
    return roundMoney(net, dec);
  }

  function lineGross(line, settings) {
    const dec = currencyDecimals(settings);
    return roundMoney((Number(line.qty) || 0) * (Number(line.unitPrice) || 0), dec);
  }

  /**
   * Totaux d'un document (facture, devis ou achat).
   * @returns {{subtotal:number, discountTotal:number, taxTotal:number, total:number}}
   */
  function computeDocTotals(doc, settings) {
    const dec = currencyDecimals(settings);
    let subtotal = 0;
    let discountTotal = 0;
    (doc && doc.lines ? doc.lines : []).forEach(function (l) {
      const gross = lineGross(l, settings);
      const net = lineNet(l, settings);
      subtotal += net;
      discountTotal += gross - net;
    });
    subtotal = roundMoney(subtotal, dec);
    discountTotal = roundMoney(discountTotal, dec);
    const taxRate = Number(doc && doc.taxRate) || 0;
    const taxTotal = roundMoney(subtotal * taxRate / 100, dec);
    return {
      subtotal: subtotal,
      discountTotal: discountTotal,
      taxTotal: taxTotal,
      total: roundMoney(subtotal + taxTotal, dec)
    };
  }

  /** Somme des paiements déjà enregistrés sur un document. */
  function paidAmount(doc) {
    let s = 0;
    (doc && doc.payments ? doc.payments : []).forEach(function (p) { s += Number(p.amount) || 0; });
    return s;
  }

  /** Reste à payer (jamais négatif). */
  function dueAmount(doc, settings) {
    const dec = currencyDecimals(settings);
    const total = computeDocTotals(doc, settings).total;
    return Math.max(0, roundMoney(total - paidAmount(doc), dec));
  }

  /**
   * Statut dérivé d'un document (jamais stocké : toujours recalculé).
   * Ventes  : unpaid | partial | paid
   * Devis   : pending | converted
   */
  function docStatus(doc, settings) {
    if (!doc) return '';
    if (doc.type === 'quote') return doc.convertedTo ? 'converted' : 'pending';
    const dec = currencyDecimals(settings);
    const total = computeDocTotals(doc, settings).total;
    const paid = roundMoney(paidAmount(doc), dec);
    if (paid <= 0) return 'unpaid';
    if (paid >= total) return 'paid';
    return 'partial';
  }

  /** Facture en retard de paiement ? (échéance dépassée et reste dû) */
  function isOverdue(doc, settings, todayIso) {
    if (!doc || doc.type === 'quote') return false;
    if (dueAmount(doc, settings) <= 0) return false;
    if (!doc.dueDate) return false;
    return doc.dueDate < (todayIso || todayISO());
  }

  function clientName(state, clientId) {
    const c = (state.clients || []).find(function (x) { return x.id === clientId; });
    return c ? c.name : '—';
  }

  function supplierName(state, supplierId) {
    const s = (state.suppliers || []).find(function (x) { return x.id === supplierId; });
    return s ? s.name : '—';
  }

  function findProduct(state, productId) {
    return (state.products || []).find(function (p) { return p.id === productId; }) || null;
  }

  function findClient(state, clientId) {
    return (state.clients || []).find(function (c) { return c.id === clientId; }) || null;
  }

  function findSupplier(state, supplierId) {
    return (state.suppliers || []).find(function (s) { return s.id === supplierId; }) || null;
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Prochain numéro de document disponible (ne réutilise jamais un numéro).
   * @param {'invoice'|'quote'|'purchase'} kind
   */
  function nextDocNumber(kind, state) {
    const s = state.settings || {};
    let prefix;
    let list;
    if (kind === 'invoice') { prefix = s.invoicePrefix || 'FACT'; list = (state.sales || []).filter(function (d) { return d.type === 'invoice'; }); }
    else if (kind === 'quote') { prefix = s.quotePrefix || 'DEVIS'; list = (state.sales || []).filter(function (d) { return d.type === 'quote'; }); }
    else { prefix = s.purchasePrefix || 'ACH'; list = state.purchases || []; }
    const re = new RegExp('^' + escapeRegExp(prefix) + '-(\\d+)$');
    let max = 0;
    list.forEach(function (d) {
      const m = re.exec(d.number || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return prefix + '-' + String(max + 1).padStart(4, '0');
  }

  /* ======================================================================
   * 5. STOCK (totalement dérivé : aucune désynchronisation possible)
   * ==================================================================== */

  /**
   * Journal complet des mouvements de stock, dérivé des documents :
   *  - factures de vente (les devis ne bougent PAS le stock)
   *  - achats
   *  - ajustements manuels (entrées / sorties / régularisations)
   * @returns {Array<{id,date,productId,delta,kind,docNumber,label}>} trié chronologiquement
   */
  function deriveStockMoves(state) {
    const moves = [];
    (state.sales || []).forEach(function (doc) {
      if (doc.type !== 'invoice') return;
      (doc.lines || []).forEach(function (l, i) {
        if (!l.productId) return;
        moves.push({
          id: 's-' + doc.id + '-' + (l.id || i),
          date: doc.date,
          productId: l.productId,
          delta: -(Number(l.qty) || 0),
          kind: 'sale',
          docNumber: doc.number,
          label: 'Vente ' + doc.number
        });
      });
    });
    (state.purchases || []).forEach(function (doc) {
      (doc.lines || []).forEach(function (l, i) {
        if (!l.productId) return;
        moves.push({
          id: 'p-' + doc.id + '-' + (l.id || i),
          date: doc.date,
          productId: l.productId,
          delta: Number(l.qty) || 0,
          kind: 'purchase',
          docNumber: doc.number,
          label: 'Achat ' + doc.number
        });
      });
    });
    (state.adjustments || []).forEach(function (a) {
      moves.push({
        id: 'a-' + a.id,
        date: a.date,
        productId: a.productId,
        delta: Number(a.qty) || 0,
        kind: 'adjustment',
        docNumber: '',
        label: a.reason || 'Ajustement'
      });
    });
    moves.sort(function (x, y) {
      if (x.date === y.date) return String(x.id).localeCompare(String(y.id));
      return x.date < y.date ? -1 : 1;
    });
    return moves;
  }

  /** Stock actuel d'un produit = stock initial + tous les mouvements dérivés. */
  function computeStock(state, productId) {
    const p = findProduct(state, productId);
    let qty = (p && Number(p.openingStock)) || 0;
    deriveStockMoves(state).forEach(function (m) {
      if (m.productId === productId) qty += m.delta;
    });
    return qty;
  }

  /** Statut de stock d'un produit. */
  function productStockStatus(product, qty) {
    const q = qty == null ? 0 : qty;
    if (q <= 0) return 'out';
    const alert = Number(product && product.stockAlert) || 0;
    if (alert > 0 && q <= alert) return 'low';
    return 'ok';
  }

  /** Valeur du stock au prix d'achat (PA × quantité). */
  function stockValue(state) {
    const dec = currencyDecimals(state.settings);
    let total = 0;
    (state.products || []).forEach(function (p) {
      total += computeStock(state, p.id) * (Number(p.costPrice) || 0);
    });
    return roundMoney(total, dec);
  }

  /** Produits en alerte (stock faible ou rupture), hors produits archivés. */
  function lowStockProducts(state) {
    return (state.products || [])
      .filter(function (p) { return !p.archived; })
      .map(function (p) {
        const qty = computeStock(state, p.id);
        return { product: p, qty: qty, status: productStockStatus(p, qty) };
      })
      .filter(function (x) { return x.status !== 'ok'; })
      .sort(function (a, b) { return a.qty - b.qty; });
  }

  /* ======================================================================
   * 6. COMPTABILITÉ (journal dérivé des paiements + écritures manuelles)
   * ==================================================================== */

  /**
   * Journal comptable complet, dérivé :
   *  - chaque encaissement de facture  -> recette  (catégorie « Ventes »)
   *  - chaque paiement d'achat         -> dépense  (catégorie « Achats »)
   *  - écritures manuelles (loyer, salaires, etc.)
   * @returns {Array} trié par date décroissante
   */
  function deriveJournal(state) {
    const dec = currencyDecimals(state.settings);
    const entries = [];
    (state.sales || []).forEach(function (doc) {
      if (doc.type !== 'invoice') return;
      (doc.payments || []).forEach(function (p) {
        entries.push({
          id: 'sp-' + p.id,
          date: p.date,
          type: 'income',
          category: 'Ventes',
          amount: roundMoney(p.amount, dec),
          label: 'Encaissement ' + doc.number + ' — ' + clientName(state, doc.clientId),
          origin: 'sale',
          ref: doc.number,
          method: p.method || ''
        });
      });
    });
    (state.purchases || []).forEach(function (doc) {
      (doc.payments || []).forEach(function (p) {
        entries.push({
          id: 'pp-' + p.id,
          date: p.date,
          type: 'expense',
          category: 'Achats',
          amount: roundMoney(p.amount, dec),
          label: 'Paiement ' + doc.number + ' — ' + supplierName(state, doc.supplierId),
          origin: 'purchase',
          ref: doc.number,
          method: p.method || ''
        });
      });
    });
    (state.journal || []).forEach(function (e) {
      entries.push({
        id: e.id,
        date: e.date,
        type: e.type === 'income' ? 'income' : 'expense',
        category: e.category || 'Divers',
        amount: roundMoney(e.amount, dec),
        label: e.label || 'Écriture manuelle',
        origin: 'manual',
        ref: '',
        method: e.method || ''
      });
    });
    entries.sort(function (a, b) {
      if (a.date === b.date) return String(b.id).localeCompare(String(a.id));
      return a.date < b.date ? 1 : -1;
    });
    return entries;
  }

  function inPeriod(iso, from, to) {
    if (!iso) return false;
    if (from && iso < from) return false;
    if (to && iso > to) return false;
    return true;
  }

  /**
   * Agrégats comptables d'une période (bornes incluses).
   * Recettes/dépenses = trésorerie (encaissements/paiements).
   * TVA = sur documents datés de la période.
   */
  function periodTotals(state, from, to) {
    const dec = currencyDecimals(state.settings);
    const res = {
      from: from || '',
      to: to || '',
      income: 0,
      expense: 0,
      incomeByCat: {},
      expenseByCat: {},
      tvaCollected: 0,
      tvaDeductible: 0,
      result: 0,
      tvaDue: 0
    };
    deriveJournal(state).forEach(function (e) {
      if (!inPeriod(e.date, from, to)) return;
      if (e.type === 'income') {
        res.income += e.amount;
        res.incomeByCat[e.category] = (res.incomeByCat[e.category] || 0) + e.amount;
      } else {
        res.expense += e.amount;
        res.expenseByCat[e.category] = (res.expenseByCat[e.category] || 0) + e.amount;
      }
    });
    (state.sales || []).forEach(function (d) {
      if (d.type === 'invoice' && inPeriod(d.date, from, to)) {
        res.tvaCollected += computeDocTotals(d, state.settings).taxTotal;
      }
    });
    (state.purchases || []).forEach(function (d) {
      if (inPeriod(d.date, from, to)) res.tvaDeductible += computeDocTotals(d, state.settings).taxTotal;
    });
    res.income = roundMoney(res.income, dec);
    res.expense = roundMoney(res.expense, dec);
    res.result = roundMoney(res.income - res.expense, dec);
    res.tvaCollected = roundMoney(res.tvaCollected, dec);
    res.tvaDeductible = roundMoney(res.tvaDeductible, dec);
    res.tvaDue = roundMoney(res.tvaCollected - res.tvaDeductible, dec);
    return res;
  }

  /** Série mensuelle recettes/dépenses des N derniers mois (mois courant inclus). */
  function monthlySeries(state, months) {
    const n = months || 12;
    const dec = currencyDecimals(state.settings);
    const now = parseISO(todayISO());
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(toISODate(d).slice(0, 7));
    }
    const map = {};
    keys.forEach(function (k) { map[k] = { key: k, label: monthLabel(k), income: 0, expense: 0 }; });
    deriveJournal(state).forEach(function (e) {
      const k = monthKey(e.date);
      if (!map[k]) return;
      if (e.type === 'income') map[k].income += e.amount;
      else map[k].expense += e.amount;
    });
    return keys.map(function (k) {
      map[k].income = roundMoney(map[k].income, dec);
      map[k].expense = roundMoney(map[k].expense, dec);
      return map[k];
    });
  }

  /* ======================================================================
   * 7. BALANCES CLIENTS / FOURNISSEURS
   * ==================================================================== */

  /** Encours (reste à recevoir) d'un client. */
  function clientBalance(state, clientId) {
    const dec = currencyDecimals(state.settings);
    let due = 0;
    let docs = 0;
    (state.sales || []).forEach(function (d) {
      if (d.type === 'invoice' && d.clientId === clientId) {
        docs += 1;
        due += dueAmount(d, state.settings);
      }
    });
    return { due: roundMoney(due, dec), docCount: docs };
  }

  function clientBalances(state) {
    return (state.clients || []).map(function (c) {
      const b = clientBalance(state, c.id);
      return {
        contact: c,
        due: b.due,
        docCount: b.docCount,
        unpaidCount: (state.sales || []).filter(function (d) {
          return d.type === 'invoice' && d.clientId === c.id && dueAmount(d, state.settings) > 0;
        }).length
      };
    });
  }

  /** Total des créances clients (tout ce que l'on doit recevoir). */
  function totalReceivables(state) {
    const dec = currencyDecimals(state.settings);
    let t = 0;
    clientBalances(state).forEach(function (b) { t += b.due; });
    return roundMoney(t, dec);
  }

  function supplierBalance(state, supplierId) {
    const dec = currencyDecimals(state.settings);
    let due = 0;
    let docs = 0;
    (state.purchases || []).forEach(function (d) {
      if (d.supplierId === supplierId) {
        docs += 1;
        due += dueAmount(d, state.settings);
      }
    });
    return { due: roundMoney(due, dec), docCount: docs };
  }

  function supplierBalances(state) {
    return (state.suppliers || []).map(function (s) {
      const b = supplierBalance(state, s.id);
      return { contact: s, due: b.due, docCount: b.docCount, unpaidCount: (state.purchases || []).filter(function (d) { return d.supplierId === s.id && dueAmount(d, state.settings) > 0; }).length };
    });
  }

  /** Total des dettes fournisseurs. */
  function totalPayables(state) {
    const dec = currencyDecimals(state.settings);
    let t = 0;
    supplierBalances(state).forEach(function (b) { t += b.due; });
    return roundMoney(t, dec);
  }

  /* ======================================================================
   * 8. ANALYSES (tableau de bord & rapports)
   * ==================================================================== */

  /** Meilleurs produits vendus sur une période (quantités et CA HT). */
  function topProducts(state, from, to, limit) {
    const dec = currencyDecimals(state.settings);
    const map = {};
    const order = [];
    (state.sales || []).forEach(function (d) {
      if (d.type !== 'invoice' || !inPeriod(d.date, from, to)) return;
      (d.lines || []).forEach(function (l) {
        const key = l.productId || 'free:' + (l.description || '');
        if (!map[key]) {
          map[key] = { productId: l.productId || null, description: l.description || '(libre)', qty: 0, revenue: 0 };
          order.push(key);
        }
        map[key].qty += Number(l.qty) || 0;
        map[key].revenue += lineNet(l, state.settings);
      });
    });
    const list = order.map(function (k) {
      const item = map[k];
      const p = item.productId ? findProduct(state, item.productId) : null;
      item.category = p ? (p.category || 'Autres') : 'Divers';
      item.revenue = roundMoney(item.revenue, dec);
      return item;
    });
    list.sort(function (a, b) { return b.revenue - a.revenue; });
    return typeof limit === 'number' ? list.slice(0, limit) : list;
  }

  /** Répartition du chiffre d'affaires HT par catégorie de produits. */
  function salesByCategory(state, from, to) {
    const dec = currencyDecimals(state.settings);
    const map = {};
    topProducts(state, from, to).forEach(function (t) {
      map[t.category] = (map[t.category] || 0) + t.revenue;
    });
    return Object.keys(map)
      .map(function (k) { return { label: k, value: roundMoney(map[k], dec) }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /** Chiffre d'affaires encaissé par client sur une période. */
  function revenueByClient(state, from, to) {
    const dec = currencyDecimals(state.settings);
    const map = {};
    (state.sales || []).forEach(function (d) {
      if (d.type !== 'invoice' || !inPeriod(d.date, from, to)) return;
      const k = d.clientId || 'none';
      if (!map[k]) map[k] = { clientId: k, name: clientName(state, d.clientId), invoices: 0, revenue: 0, due: 0 };
      map[k].invoices += 1;
      map[k].revenue += computeDocTotals(d, state.settings).total;
      map[k].due += dueAmount(d, state.settings);
    });
    return Object.keys(map).map(function (k) {
      map[k].revenue = roundMoney(map[k].revenue, dec);
      map[k].due = roundMoney(map[k].due, dec);
      return map[k];
    }).sort(function (a, b) { return b.revenue - a.revenue; });
  }

  /** Achats par fournisseur sur une période. */
  function purchasesBySupplier(state, from, to) {
    const dec = currencyDecimals(state.settings);
    const map = {};
    (state.purchases || []).forEach(function (d) {
      if (!inPeriod(d.date, from, to)) return;
      const k = d.supplierId || 'none';
      if (!map[k]) map[k] = { supplierId: k, name: supplierName(state, d.supplierId), purchases: 0, total: 0, due: 0 };
      map[k].purchases += 1;
      map[k].total += computeDocTotals(d, state.settings).total;
      map[k].due += dueAmount(d, state.settings);
    });
    return Object.keys(map).map(function (k) {
      map[k].total = roundMoney(map[k].total, dec);
      map[k].due = roundMoney(map[k].due, dec);
      return map[k];
    }).sort(function (a, b) { return b.total - a.total; });
  }

  /* ======================================================================
   * 9. MONTANT EN LETTRES (français)
   * ==================================================================== */

  const W_UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const W_TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  function wordsBelow100(n) {
    if (n < 20) return W_UNITS[n];
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 7 || t === 9) {
      if (t === 7 && u === 1) return 'soixante et onze';
      return W_TENS[t] + '-' + wordsBelow100(10 + u);
    }
    if (u === 0) return t === 8 ? 'quatre-vingts' : W_TENS[t];
    if (u === 1 && t !== 8) return W_TENS[t] + ' et un';
    return W_TENS[t] + '-' + W_UNITS[u];
  }

  function wordsBelow1000(n) {
    const c = Math.floor(n / 100);
    const r = n % 100;
    if (c === 0) return wordsBelow100(r);
    if (c === 1) return r ? 'cent ' + wordsBelow100(r) : 'cent';
    const head = W_UNITS[c] + ' cent' + (r === 0 ? 's' : '');
    return r ? head + ' ' + wordsBelow100(r) : head;
  }

  /** « quatre-vingts » / « deux cents » perdent le « s » devant « mille ». */
  function noPluralSBeforeMille(words) {
    if (words.endsWith('quatre-vingts')) return words.slice(0, -1);
    if (words.endsWith('cents')) return words.slice(0, -1);
    return words;
  }

  function intToWordsFr(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zéro';
    if (n >= 1e12) return String(n); // au-delà de 999 milliards : chiffres bruts
    const groups = [[1e9, 'milliard', 'milliards'], [1e6, 'million', 'millions'], [1e3, 'mille', 'mille']];
    const parts = [];
    groups.forEach(function (g) {
      const q = Math.floor(n / g[0]);
      if (q > 0) {
        n -= q * g[0];
        if (g[0] === 1e3) parts.push(q > 1 ? noPluralSBeforeMille(wordsBelow1000(q)) + ' mille' : 'mille');
        else parts.push(wordsBelow1000(q) + ' ' + (q > 1 ? g[2] : g[1]));
      }
    });
    if (n > 0) parts.push(wordsBelow1000(n));
    return parts.join(' ');
  }

  /** « 125 500 FCFA » -> « Cent vingt-cinq mille cinq cents francs CFA ». */
  function montantEnLettres(amount, settings) {
    const c = currencyOf(settings);
    const dec = c.decimals;
    const v = roundMoney(Math.abs(Number(amount) || 0), dec);
    const intPart = Math.floor(v);
    const centsPart = dec > 0 ? Math.round((v - intPart) * Math.pow(10, dec)) : 0;
    let s = (intPart === 0 ? 'zéro' : intToWordsFr(intPart)) + ' ' + (intPart > 1 ? c.words[1] : c.words[0]);
    if (centsPart > 0) {
      s += ' et ' + intToWordsFr(centsPart) + ' ' + (centsPart > 1 ? c.cents[1] : c.cents[0]);
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ======================================================================
   * 10. NORMALISATION / ÉTAT PAR DÉFAUT
   * ==================================================================== */

  function defaultSettings() {
    return {
      companyName: 'Mon Entreprise',
      address: '',
      phone: '',
      email: '',
      taxId: '',
      currency: 'XOF',
      taxRate: 18,
      invoicePrefix: 'FACT',
      quotePrefix: 'DEVIS',
      purchasePrefix: 'ACH',
      paymentTermDays: 30,
      invoiceFooter: 'Merci de votre confiance.',
      logoDataUrl: null,
      onboarded: false
    };
  }

  function emptyState() {
    return {
      settings: defaultSettings(),
      clients: [],
      suppliers: [],
      products: [],
      sales: [],
      purchases: [],
      adjustments: [],
      journal: []
    };
  }

  /** Complète/nettoie un état chargé depuis le disque (migration douce). */
  function normalizeState(raw) {
    const st = raw && typeof raw === 'object' ? raw : {};
    const out = emptyState();
    out.settings = Object.assign(out.settings, st.settings || {});
    ['clients', 'suppliers', 'products', 'sales', 'purchases', 'adjustments', 'journal'].forEach(function (k) {
      if (Array.isArray(st[k])) out[k] = st[k];
    });
    return out;
  }

  function deepClone(obj) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }

  /* ---------------------------------------------------------------------- */

  return {
    CURRENCIES: CURRENCIES,
    currencyOf: currencyOf,
    currencyDecimals: currencyDecimals,
    roundMoney: roundMoney,
    formatNumber: formatNumber,
    formatMoney: formatMoney,
    formatSignedMoney: formatSignedMoney,
    parseISO: parseISO,
    toISODate: toISODate,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    monthKey: monthKey,
    monthLabel: monthLabel,
    formatDate: formatDate,
    formatDateLong: formatDateLong,
    startOfMonthISO: startOfMonthISO,
    endOfMonthISO: endOfMonthISO,
    startOfYearISO: startOfYearISO,
    daysBetween: daysBetween,
    uid: uid,
    lineNet: lineNet,
    lineGross: lineGross,
    computeDocTotals: computeDocTotals,
    paidAmount: paidAmount,
    dueAmount: dueAmount,
    docStatus: docStatus,
    isOverdue: isOverdue,
    clientName: clientName,
    supplierName: supplierName,
    findProduct: findProduct,
    findClient: findClient,
    findSupplier: findSupplier,
    nextDocNumber: nextDocNumber,
    deriveStockMoves: deriveStockMoves,
    computeStock: computeStock,
    productStockStatus: productStockStatus,
    stockValue: stockValue,
    lowStockProducts: lowStockProducts,
    deriveJournal: deriveJournal,
    inPeriod: inPeriod,
    periodTotals: periodTotals,
    monthlySeries: monthlySeries,
    clientBalance: clientBalance,
    clientBalances: clientBalances,
    totalReceivables: totalReceivables,
    supplierBalance: supplierBalance,
    supplierBalances: supplierBalances,
    totalPayables: totalPayables,
    topProducts: topProducts,
    salesByCategory: salesByCategory,
    revenueByClient: revenueByClient,
    purchasesBySupplier: purchasesBySupplier,
    intToWordsFr: intToWordsFr,
    montantEnLettres: montantEnLettres,
    defaultSettings: defaultSettings,
    emptyState: emptyState,
    normalizeState: normalizeState,
    deepClone: deepClone
  };
});
