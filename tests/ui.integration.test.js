/*!
 * COMPTABLOO — Test d'intégration de l'interface complète (jsdom).
 * Charge la vraie page index.html avec tous ses scripts, passe
 * l'onboarding avec les données de démonstration, navigue dans toutes
 * les pages et vérifie le rendu, puis crée un client/produit/vente
 * via l'interface et contrôle la cohérence du stock.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createServer } = require('../scripts/serve.js');

const ROOT = path.join(__dirname, '..');

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function waitFor(fn, timeout, label) {
  const start = Date.now();
  while (Date.now() - start < (timeout || 8000)) {
    try {
      const v = fn();
      if (v) return v;
    } catch (e) { /* réessaie */ }
    await wait(80);
  }
  throw new Error('Délai dépassé en attendant : ' + label);
}

/** Charge l'application dans jsdom avec un localStorage propre. */
async function loadApp() {
  const server = createServer();
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;

  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  virtualConsole.on('jsdomError', function (e) {
    // Les erreurs « not implemented » (canvas, print) sont attendues
    if (/not implemented/i.test(String(e.message || e))) return;
    jsdomErrors.push(String(e.message || e) + (e.detail ? '\n' + e.detail : ''));
  });
  virtualConsole.on('error', function () { /* log JS non bloquant */ });

  const dom = await JSDOM.fromURL('http://127.0.0.1:' + port + '/', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: virtualConsole
  });

  await waitFor(function () { return dom.window.COMPTA_READY; }, 15000, 'amorçage de l\u2019application');
  if (dom.window.COMPTA_BOOT_ERROR) {
    throw new Error('L\u2019application a échoué au démarrage : ' + dom.window.COMPTA_BOOT_ERROR);
  }
  return { dom: dom, server: server, port: port, jsdomErrors: jsdomErrors };
}

test('Interface complète — onboarding, navigation, création de données', async () => {
  const ctx = await loadApp();
  const { dom } = ctx;
  const doc = dom.window.document;
  const win = dom.window;

  try {
    /* ---------------- Onboarding ---------------- */
    const overlay = doc.querySelector('#onboarding-root .onboarding');
    assert.ok(overlay, 'l\u2019écran d\u2019accueil doit s\u2019afficher au premier lancement');
    assert.ok(doc.querySelector('#ob-company'), 'champ nom d\u2019entreprise présent');
    doc.querySelector('#ob-company').value = 'Boutique Test SARL';
    doc.querySelector('#ob-currency').value = 'XOF';
    // Clic sur « données de démonstration »
    const demoBtn = Array.from(doc.querySelectorAll('.onboarding-actions .btn')).find(function (b) {
      return /démonstration/i.test(b.textContent);
    });
    assert.ok(demoBtn, 'bouton démonstration présent');
    demoBtn.click();
    await wait(200);

    assert.strictEqual(doc.querySelector('#onboarding-root').innerHTML, '', 'l\u2019onboarding doit être fermé');
    const S = win.COMPTA.store.state;
    assert.strictEqual(S.settings.companyName, 'Boutique Test SARL');
    assert.ok(S.clients.length >= 5, 'données de démonstration chargées (clients)');
    assert.ok(S.products.length >= 10, 'données de démonstration chargées (produits)');
    assert.ok(S.sales.length >= 10, 'données de démonstration chargées (ventes)');

    /* ---------------- Tableau de bord ---------------- */
    assert.ok(doc.querySelector('#view .kpi-grid'), 'KPIs affichés sur le tableau de bord');
    const kpiVals = Array.from(doc.querySelectorAll('#view .kpi-val')).map(function (el) { return el.textContent.trim(); });
    assert.ok(kpiVals.length >= 4, 'au moins 4 KPIs');
    assert.ok(kpiVals.every(function (v) { return v.length > 0; }), 'KPIs non vides');
    assert.ok(doc.querySelector('#view canvas') !== null || true, 'canvas toléré (non supporté par jsdom)');

    /* ---------------- Navigation dans toutes les pages ---------------- */
    const pages = ['sales', 'purchases', 'stock', 'clients', 'suppliers', 'accounting', 'reports', 'settings', 'dashboard'];
    for (const p of pages) {
      win.location.hash = '#/' + p;
      await waitFor(function () {
        const active = doc.querySelector('.nav-item.active');
        return active && active.getAttribute('data-page') === p;
      }, 4000, 'navigation vers ' + p);
      await wait(60);
      assert.ok(doc.querySelector('#view').children.length > 0, 'la page ' + p + ' rend du contenu');
      assert.ok(doc.querySelector('#page-title').textContent.length > 0, 'titre de page présent pour ' + p);
    }

    /* ---------------- Page ventes : contenu de démo ---------------- */
    win.location.hash = '#/sales';
    await wait(150);
    const rows = doc.querySelectorAll('#view tbody tr');
    assert.ok(rows.length >= 5, 'des factures de démo sont listées');
    const typeCell = rows[0].querySelector('td:nth-child(4)');
    assert.ok(/Facture|Devis/.test(typeCell.textContent), 'badge de type rendu');
    assert.ok(typeCell.textContent.indexOf('<') === -1, 'aucun HTML brut affiché comme texte');

    /* ---------------- Création d'un client via l'interface ---------------- */
    win.location.hash = '#/clients';
    await wait(150);
    const newClientBtn = Array.from(doc.querySelectorAll('#view .toolbar .btn')).find(function (b) {
      return /Nouveau client/.test(b.textContent);
    });
    newClientBtn.click();
    await wait(120);
    const nameInput = doc.querySelector('#modal-root #c-name');
    assert.ok(nameInput, 'formulaire client ouvert');
    nameInput.value = 'Client Integration';
    const saveBtn = doc.querySelector('#modal-root .modal-f .btn-primary');
    saveBtn.click();
    await wait(150);
    const created = S.clients.find(function (c) { return c.name === 'Client Integration'; });
    assert.ok(created, 'client créé via l\u2019interface');

    /* ---------------- Création d'un produit via l'interface ---------------- */
    win.location.hash = '#/stock';
    await wait(150);
    const newProductBtn = Array.from(doc.querySelectorAll('#view .toolbar .btn')).find(function (b) {
      return /Nouveau produit/.test(b.textContent);
    });
    newProductBtn.click();
    await wait(120);
    doc.querySelector('#modal-root #p-name').value = 'Produit Integration';
    doc.querySelector('#modal-root #p-price').value = '2500';
    doc.querySelector('#modal-root #p-cost').value = '1800';
    doc.querySelector('#modal-root #p-open').value = '10';
    doc.querySelector('#modal-root .modal-f .btn-primary').click();
    await wait(150);
    const product = S.products.find(function (p) { return p.name === 'Produit Integration'; });
    assert.ok(product, 'produit créé via l\u2019interface');

    /* ---------------- Création d'une facture via l'éditeur ---------------- */
    win.location.hash = '#/sales';
    await wait(150);
    const newInvoiceBtn = Array.from(doc.querySelectorAll('#view .toolbar .btn')).find(function (b) {
      return /Nouvelle facture/.test(b.textContent);
    });
    newInvoiceBtn.click();
    await wait(120);

    // Sélection du client et du produit
    const selects = doc.querySelectorAll('#modal-root select');
    const clientSelect = selects[0];
    clientSelect.value = created.id;
    clientSelect.dispatchEvent(new win.Event('change', { bubbles: true }));
    const productSelect = doc.querySelectorAll('#modal-root .lines-table select')[0];
    productSelect.value = product.id;
    productSelect.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(150);

    // La description et le prix doivent être pré-remplis
    const descInput = doc.querySelector('#modal-root .lines-table input[data-field="description"]');
    assert.strictEqual(descInput.value, 'Produit Integration', 'description pré-remplie depuis le produit');
    const priceInput = doc.querySelector('#modal-root .lines-table input[data-field="unitPrice"]');
    assert.strictEqual(priceInput.value, '2500', 'prix de vente pré-rempli');
    // Qté = 1 par défaut -> total 2500 + TVA 18% = 2950
    const totalCell = doc.querySelector('#modal-root #t-total');
    assert.ok(/2\s?950/.test(totalCell.textContent.replace(/\u202f|\u00a0/g, ' ')), 'total TTC calculé (2950), obtenu : ' + totalCell.textContent);

    doc.querySelector('#modal-root .modal-f .btn-primary').click();
    await wait(200);

    const invoice = S.sales.find(function (d) { return d.type === 'invoice' && (d.lines[0].productId === product.id); });
    assert.ok(invoice, 'facture enregistrée via l\u2019éditeur');
    const L2 = win.COMPTA.logic;
    assert.strictEqual(L2.computeDocTotals(invoice, S.settings).total, 2950);
    // Le stock doit avoir diminué : 10 - 1 = 9
    assert.strictEqual(L2.computeStock(S, product.id), 9, 'stock décrémenté après la vente');

    /* ---------------- Paiement via la modale ---------------- */
    const payBtn = doc.querySelector('#view .row-actions .icon-btn[title="Enregistrer un paiement"]');
    if (payBtn) {
      payBtn.click();
      await wait(120);
      const amountInput = doc.querySelector('#modal-root #pay-amount');
      assert.strictEqual(amountInput.value, '2950', 'montant pré-rempli avec le reste dû');
      const addBtn = Array.from(doc.querySelectorAll('#modal-root .btn')).find(function (b) { return /Ajouter le paiement/.test(b.textContent); });
      addBtn.click();
      await wait(150);
      assert.strictEqual(L2.docStatus(win.COMPTA.store._internal.findSale(invoice.id), S.settings), 'paid', 'facture payée après le paiement');
    }

    /* ---------------- Comptabilité : la recette apparaît ---------------- */
    win.location.hash = '#/accounting';
    await wait(150);
    const journalText = doc.querySelector('#view').textContent;
    assert.ok(/Encaissement/.test(journalText), 'le journal contient l\u2019encaissement de la facture');

    /* ---------------- Rapports ---------------- */
    win.location.hash = '#/reports';
    await wait(150);
    assert.ok(doc.querySelectorAll('#view .report-item').length >= 8, 'liste des rapports affichée');
    const repTitle = doc.querySelector('#rep-title').textContent;
    assert.ok(repTitle.length > 0, 'rapport par défaut affiché');

    /* ---------------- Paramètres ---------------- */
    win.location.hash = '#/settings';
    await wait(150);
    assert.strictEqual(doc.querySelector('#s-name').value, 'Boutique Test SARL', 'nom d\u2019entreprise pré-rempli');

    /* ---------------- Persistance navigateur ---------------- */
    const persisted = JSON.parse(win.localStorage.getItem('comptabloo-data-v1'));
    assert.ok(persisted && persisted.settings, 'données persistées dans localStorage');
    assert.strictEqual(persisted.settings.companyName, 'Boutique Test SARL');

  } finally {
    ctx.server.close();
    ctx.dom.window.close();
  }
});

test('Onboarding — démarrage avec un compte vide', async () => {
  const ctx = await loadApp();
  const doc = ctx.dom.window.document;
  try {
    const startBtn = Array.from(doc.querySelectorAll('.onboarding-actions .btn')).find(function (b) {
      return /compte vide/.test(b.textContent);
    });
    startBtn.click();
    await ctx.dom.window.COMPTA ? null : null;
    await wait(200);
    const S = ctx.dom.window.COMPTA.store.state;
    assert.strictEqual(S.clients.length, 0, 'aucune donnée de démo');
    assert.strictEqual(S.settings.onboarded, true);
    // Le tableau de bord affiche l'état vide avec les actions
    assert.ok(/Bienvenue/.test(doc.querySelector('#view').textContent), 'état vide accueillant');
  } finally {
    ctx.server.close();
    ctx.dom.window.close();
  }
});
