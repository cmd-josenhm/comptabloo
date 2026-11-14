/*!
 * COMPTABLOO — Magasin d'état central (UMD : rendu + tests Node).
 * Toutes les modifications de données passent par des méthodes explicites.
 * Après chaque mutation : sauvegarde différée (debounce) + notification
 * de l'interface pour re-rendre la page courante.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../../shared/logic.js'), globalThis);
  } else {
    root.COMPTA = root.COMPTA || {};
    root.COMPTA.store = factory(root.COMPTA.logic, root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L, root) {
  'use strict';

  let state = L.emptyState();
  let adapter = null;
  const listeners = [];
  let saveTimer = null;
  let saveSeq = 0;

  /* ------------------------------------------------------------------ */
  /* Persistance                                                         */
  /* ------------------------------------------------------------------ */

  function init(rawData, persistAdapter) {
    adapter = persistAdapter || null;
    state = L.normalizeState(rawData);
    return state;
  }

  function getState() { return state; }

  function scheduleSave() {
    if (!adapter || !adapter.save) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { persistNow(); }, 350);
  }

  async function persistNow() {
    if (!adapter || !adapter.save) return;
    const seq = ++saveSeq;
    try {
      const res = await adapter.save(state);
      if (res && res.ok === false && root.COMPTA && root.COMPTA.ui && seq === saveSeq) {
        root.COMPTA.ui.toast('Impossible d\u2019enregistrer les données : ' + (res.error || 'erreur inconnue'), 'error');
      }
    } catch (e) {
      // silencieux en mode test (pas d'UI)
    }
  }

  /** Applique un état entier (restauration de sauvegarde / démo / réinitialisation). */
  function replaceState(next, opts) {
    const o = opts || {};
    const previousOnboarded = state.settings.onboarded;
    state = L.normalizeState(next);
    if (o.keepOnboarded) state.settings.onboarded = previousOnboarded;
    scheduleSave();
    emit();
  }

  /* ------------------------------------------------------------------ */
  /* Notifications                                                       */
  /* ------------------------------------------------------------------ */

  function onChange(cb) {
    listeners.push(cb);
    return function () {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function emit() {
    listeners.slice().forEach(function (cb) {
      try { cb(); } catch (e) { if (root.console) console.error(e); }
    });
  }

  function commit() {
    state.updatedAt = new Date().toISOString();
    scheduleSave();
    emit();
  }

  /* ------------------------------------------------------------------ */
  /* Recherche                                                           */
  /* ------------------------------------------------------------------ */

  function findDoc(list, id) { return list.find(function (d) { return d.id === id; }) || null; }
  function findSale(id) { return findDoc(state.sales, id); }
  function findPurchase(id) { return findDoc(state.purchases, id); }

  /* ------------------------------------------------------------------ */
  /* Paramètres                                                          */
  /* ------------------------------------------------------------------ */

  function saveSettings(patch) {
    Object.assign(state.settings, patch || {});
    commit();
  }

  /* ------------------------------------------------------------------ */
  /* Clients & fournisseurs                                              */
  /* ------------------------------------------------------------------ */

  function upsertContact(kind, data) {
    const list = kind === 'client' ? state.clients : state.suppliers;
    const existing = findDoc(list, data.id);
    const clean = {
      name: String(data.name || '').trim(),
      contact: String(data.contact || '').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      address: String(data.address || '').trim(),
      notes: String(data.notes || '').trim()
    };
    if (!clean.name) throw new Error('Le nom est obligatoire.');
    if (existing) {
      Object.assign(existing, clean);
    } else {
      list.push(Object.assign({
        id: L.uid(),
        createdAt: new Date().toISOString()
      }, clean));
    }
    commit();
  }

  function deleteContact(kind, id) {
    const list = kind === 'client' ? state.clients : state.suppliers;
    const used = kind === 'client'
      ? state.sales.some(function (d) { return d.clientId === id; })
      : state.purchases.some(function (d) { return d.supplierId === id; });
    if (used) {
      throw new Error(kind === 'client'
        ? 'Ce client possède des documents (ventes). Supprimez d\u2019abord ses factures et devis.'
        : 'Ce fournisseur possède des achats. Supprimez d\u2019abord ses achats.');
    }
    const i = list.findIndex(function (c) { return c.id === id; });
    if (i >= 0) list.splice(i, 1);
    commit();
  }

  /* ------------------------------------------------------------------ */
  /* Produits                                                            */
  /* ------------------------------------------------------------------ */

  function upsertProduct(data) {
    const existing = findDoc(state.products, data.id);
    const clean = {
      sku: String(data.sku || '').trim(),
      name: String(data.name || '').trim(),
      category: String(data.category || '').trim(),
      unit: String(data.unit || 'pièce').trim(),
      costPrice: Number(data.costPrice) || 0,
      salePrice: Number(data.salePrice) || 0,
      stockAlert: Number(data.stockAlert) || 0,
      notes: String(data.notes || '').trim()
    };
    if (!clean.name) throw new Error('Le nom du produit est obligatoire.');
    if (clean.costPrice < 0 || clean.salePrice < 0) throw new Error('Les prix ne peuvent pas être négatifs.');
    if (existing) {
      Object.assign(existing, clean);
      if (data.openingStock != null && data.openingStock !== '') {
        existing.openingStock = Number(data.openingStock) || 0;
      }
    } else {
      state.products.push(Object.assign({
        id: L.uid(),
        openingStock: Number(data.openingStock) || 0,
        archived: false,
        createdAt: new Date().toISOString()
      }, clean));
    }
    commit();
  }

  function deleteProduct(id) {
    const used =
      state.sales.some(function (d) { return (d.lines || []).some(function (l) { return l.productId === id; }); }) ||
      state.purchases.some(function (d) { return (d.lines || []).some(function (l) { return l.productId === id; }); }) ||
      state.adjustments.some(function (a) { return a.productId === id; });
    if (used) {
      throw new Error('Ce produit est utilisé dans des documents. Archivez-le plutôt que de le supprimer : il disparaîtra des sélecteurs mais restera dans l\u2019historique.');
    }
    const i = state.products.findIndex(function (p) { return p.id === id; });
    if (i >= 0) state.products.splice(i, 1);
    commit();
  }

  function toggleArchiveProduct(id) {
    const p = findDoc(state.products, id);
    if (p) {
      p.archived = !p.archived;
      commit();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Documents : ventes (factures & devis) et achats                     */
  /* ------------------------------------------------------------------ */

  function cleanLines(rawLines) {
    const lines = (rawLines || [])
      .map(function (l) {
        return {
          id: l.id || L.uid(),
          productId: l.productId || null,
          description: String(l.description || '').trim(),
          qty: Number(l.qty) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          discount: Math.min(100, Math.max(0, Number(l.discount) || 0))
        };
      })
      .filter(function (l) { return l.description && l.qty !== 0; });
    if (!lines.length) throw new Error('Ajoutez au moins une ligne (description et quantité).');
    lines.forEach(function (l) {
      if (l.qty <= 0) throw new Error('Les quantités doivent être supérieures à zéro.');
      if (l.unitPrice < 0) throw new Error('Les prix ne peuvent pas être négatifs.');
    });
    return lines;
  }

  /**
   * Crée ou modifie une vente (facture ou devis).
   * Le stock et le journal comptable étant dérivés, aucune compensation
   * n'est nécessaire : l'état reste toujours cohérent.
   */
  function upsertSale(data) {
    const type = data.type === 'quote' ? 'quote' : 'invoice';
    const existing = data.id ? findSale(data.id) : null;
    const doc = {
      type: type,
      date: data.date || L.todayISO(),
      dueDate: data.dueDate || null,
      clientId: data.clientId || null,
      lines: cleanLines(data.lines),
      taxRate: Math.max(0, Number(data.taxRate) || 0),
      notes: String(data.notes || '').trim()
    };
    if (!doc.clientId) throw new Error('Sélectionnez un client.');
    if (existing) {
      Object.assign(existing, doc);
      return existing;
    }
    const created = Object.assign({
      id: L.uid(),
      number: String(data.number || '').trim() || L.nextDocNumber(type, state),
      payments: [],
      createdAt: new Date().toISOString()
    }, doc);
    state.sales.push(created);
    commit();
    return created;
  }

  function deleteSale(id) {
    const i = state.sales.findIndex(function (d) { return d.id === id; });
    if (i >= 0) state.sales.splice(i, 1);
    commit();
  }

  /** Convertit un devis en facture (le devis est conservé, marqué « Facturé »). */
  function convertQuote(id) {
    const quote = findSale(id);
    if (!quote || quote.type !== 'quote') throw new Error('Devis introuvable.');
    if (quote.convertedTo) {
      const existing = findSale(quote.convertedTo);
      if (existing) return existing;
    }
    const invoice = {
      id: L.uid(),
      number: L.nextDocNumber('invoice', state),
      type: 'invoice',
      date: L.todayISO(),
      dueDate: L.addDaysISO(L.todayISO(), Number(state.settings.paymentTermDays) || 30),
      clientId: quote.clientId,
      lines: L.deepClone(quote.lines).map(function (l) { l.id = L.uid(); return l; }),
      taxRate: quote.taxRate,
      notes: quote.notes,
      payments: [],
      convertedFrom: quote.id,
      createdAt: new Date().toISOString()
    };
    state.sales.push(invoice);
    quote.convertedTo = invoice.id;
    commit();
    return invoice;
  }

  function addSalePayment(saleId, payment) {
    const doc = findSale(saleId);
    if (!doc || doc.type !== 'invoice') throw new Error('Facture introuvable.');
    const amount = Number(payment.amount) || 0;
    if (amount <= 0) throw new Error('Le montant du paiement doit être supérieur à zéro.');
    doc.payments = doc.payments || [];
    doc.payments.push({
      id: L.uid(),
      date: payment.date || L.todayISO(),
      amount: amount,
      method: payment.method || 'Espèces',
      note: String(payment.note || '').trim()
    });
    commit();
  }

  function deleteSalePayment(saleId, paymentId) {
    const doc = findSale(saleId);
    if (!doc || !doc.payments) return;
    doc.payments = doc.payments.filter(function (p) { return p.id !== paymentId; });
    commit();
  }

  /* ---------------- Achats ---------------- */

  function upsertPurchase(data) {
    const existing = data.id ? findPurchase(data.id) : null;
    const doc = {
      date: data.date || L.todayISO(),
      supplierId: data.supplierId || null,
      lines: cleanLines(data.lines),
      taxRate: Math.max(0, Number(data.taxRate) || 0),
      notes: String(data.notes || '').trim()
    };
    if (!doc.supplierId) throw new Error('Sélectionnez un fournisseur.');
    if (existing) {
      Object.assign(existing, doc);
      return existing;
    }
    const created = Object.assign({
      id: L.uid(),
      number: String(data.number || '').trim() || L.nextDocNumber('purchase', state),
      payments: [],
      createdAt: new Date().toISOString()
    }, doc);
    state.purchases.push(created);
    commit();
    return created;
  }

  function deletePurchase(id) {
    const i = state.purchases.findIndex(function (d) { return d.id === id; });
    if (i >= 0) state.purchases.splice(i, 1);
    commit();
  }

  function addPurchasePayment(purchaseId, payment) {
    const doc = findPurchase(purchaseId);
    if (!doc) throw new Error('Achat introuvable.');
    const amount = Number(payment.amount) || 0;
    if (amount <= 0) throw new Error('Le montant du paiement doit être supérieur à zéro.');
    doc.payments = doc.payments || [];
    doc.payments.push({
      id: L.uid(),
      date: payment.date || L.todayISO(),
      amount: amount,
      method: payment.method || 'Espèces',
      note: String(payment.note || '').trim()
    });
    commit();
  }

  function deletePurchasePayment(purchaseId, paymentId) {
    const doc = findPurchase(purchaseId);
    if (!doc || !doc.payments) return;
    doc.payments = doc.payments.filter(function (p) { return p.id !== paymentId; });
    commit();
  }

  /* ------------------------------------------------------------------ */
  /* Ajustements de stock                                                */
  /* ------------------------------------------------------------------ */

  function addAdjustment(data) {
    const qty = Number(data.qty) || 0;
    if (!data.productId) throw new Error('Sélectionnez un produit.');
    if (!qty) throw new Error('Indiquez une quantité (positive pour une entrée, négative pour une sortie).');
    state.adjustments.push({
      id: L.uid(),
      date: data.date || L.todayISO(),
      productId: data.productId,
      qty: qty,
      reason: String(data.reason || '').trim(),
      createdAt: new Date().toISOString()
    });
    commit();
  }

  function deleteAdjustment(id) {
    const i = state.adjustments.findIndex(function (a) { return a.id === id; });
    if (i >= 0) state.adjustments.splice(i, 1);
    commit();
  }

  /* ------------------------------------------------------------------ */
  /* Écritures manuelles                                                 */
  /* ------------------------------------------------------------------ */

  const INCOME_CATEGORIES = ['Ventes', 'Autres revenus', 'Subventions', 'Revenus divers'];
  const EXPENSE_CATEGORIES = ['Achats', 'Salaires', 'Loyer', 'Électricité & eau', 'Transport', 'Communication & internet', 'Taxes & impôts', 'Marketing & publicité', 'Entretien & réparations', 'Frais bancaires', 'Divers'];

  function upsertJournalEntry(data) {
    const clean = {
      date: data.date || L.todayISO(),
      type: data.type === 'income' ? 'income' : 'expense',
      category: String(data.category || 'Divers').trim(),
      label: String(data.label || '').trim(),
      amount: Number(data.amount) || 0,
      method: data.method || 'Espèces',
      note: String(data.note || '').trim()
    };
    if (!clean.label) throw new Error('Le libellé est obligatoire.');
    if (clean.amount <= 0) throw new Error('Le montant doit être supérieur à zéro.');
    const existing = data.id ? findDoc(state.journal, data.id) : null;
    if (existing) {
      Object.assign(existing, clean);
    } else {
      state.journal.push(Object.assign({ id: L.uid(), createdAt: new Date().toISOString() }, clean));
    }
    commit();
  }

  function deleteJournalEntry(id) {
    const i = state.journal.findIndex(function (e) { return e.id === id; });
    if (i >= 0) state.journal.splice(i, 1);
    commit();
  }

  /* ------------------------------------------------------------------ */
  /* Jeux de données                                                     */
  /* ------------------------------------------------------------------ */

  /** Charge la démo (remplace tout, en gardant le nom d'entreprise saisi). */
  function loadDemo(companyName) {
    const demo = root.COMPTA && root.COMPTA.seed
      ? root.COMPTA.seed.buildDemoState(companyName)
      : null;
    if (demo) replaceState(demo);
  }

  function resetAll() {
    const fresh = L.emptyState();
    fresh.settings.onboarded = true;
    replaceState(fresh);
  }

  /* ------------------------------------------------------------------ */

  return {
    init: init,
    getState: getState,
    get state() { return state; },
    replaceState: replaceState,
    persistNow: persistNow,
    onChange: onChange,
    saveSettings: saveSettings,
    upsertContact: upsertContact,
    deleteContact: deleteContact,
    upsertProduct: upsertProduct,
    deleteProduct: deleteProduct,
    toggleArchiveProduct: toggleArchiveProduct,
    upsertSale: upsertSale,
    deleteSale: deleteSale,
    convertQuote: convertQuote,
    addSalePayment: addSalePayment,
    deleteSalePayment: deleteSalePayment,
    upsertPurchase: upsertPurchase,
    deletePurchase: deletePurchase,
    addPurchasePayment: addPurchasePayment,
    deletePurchasePayment: deletePurchasePayment,
    addAdjustment: addAdjustment,
    deleteAdjustment: deleteAdjustment,
    upsertJournalEntry: upsertJournalEntry,
    deleteJournalEntry: deleteJournalEntry,
    INCOME_CATEGORIES: INCOME_CATEGORIES,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    loadDemo: loadDemo,
    resetAll: resetAll,
    _internal: {
      commit: commit,
      setAdapter: function (a) { adapter = a; },
      findSale: findSale,
      findPurchase: findPurchase
    }
  };
});
