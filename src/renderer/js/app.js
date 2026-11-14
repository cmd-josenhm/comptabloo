/*!
 * COMPTABLOO — Application : amorçage, routeur, onboarding, actions du menu.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  const PAGES = ['dashboard', 'sales', 'purchases', 'stock', 'clients', 'suppliers', 'accounting', 'reports', 'settings'];
  let currentPage = null;
  let appInfo = { version: '1.0.0' };

  /* ------------------------------------------------------------------ */
  /* Amorçage                                                            */
  /* ------------------------------------------------------------------ */

  async function boot() {
    try {
      await bootInner();
    } catch (e) {
      console.error('Erreur au démarrage :', e);
      root.COMPTA_BOOT_ERROR = (e && e.message) || String(e);
      root.COMPTA_READY = true;
    }
  }

  async function bootInner() {
    // Icônes de la barre latérale
    UI.qsa('#side-nav .nav-item, .side-foot .nav-item').forEach(function (item) {
      const ico = item.querySelector('.nav-ico');
      const name = ico ? ico.getAttribute('data-icon') : null;
      if (ico && name) ico.innerHTML = UI.icon(name, 18);
    });

    // Chargement des données
    const adapter = root.COMPTA.db.detect();
    let data = null;
    try {
      data = await adapter.load();
    } catch (e) {
      console.error('Chargement impossible :', e);
      UI.toast('Impossible de lire le fichier de données. Une sauvegarde quotidienne sera utilisée si disponible.', 'error');
    }
    root.COMPTA.store.init(data, adapter);

    if (root.COMPTA.db.isElectron() && root.comptablooAPI.getAppInfo) {
      try { appInfo = await root.comptablooAPI.getAppInfo(); } catch (e) { /* ignore */ }
    }

    // Rendu de l'ossature
    decorateTopbar();
    root.COMPTA.store.onChange(function () { decorateTopbar(); route(); });

    // Actions du menu (Electron)
    if (root.comptablooAPI && root.comptablooAPI.onMenuAction) {
      root.comptablooAPI.onMenuAction(function (action) { menuAction(action); });
    }

    window.addEventListener('hashchange', route);

    // Onboarding au premier lancement
    if (!root.COMPTA.store.state.settings.onboarded) {
      showOnboarding();
    }

    route();

    // Avertissement mode navigateur
    if (!root.COMPTA.db.isElectron()) {
      UI.toast('Mode navigateur : les données restent dans ce navigateur. Utilisez l\u2019application installée pour un usage réel.', 'info');
    }

    root.COMPTA_READY = true;
  }

  function decorateTopbar() {
    const S = root.COMPTA.store.state;
    const dateEl = document.getElementById('chip-date');
    if (dateEl) dateEl.textContent = L.formatDateLong(L.todayISO());
    const coEl = document.getElementById('chip-company');
    if (coEl) coEl.textContent = S.settings.companyName || 'Mon Entreprise';
    const sideCo = document.getElementById('side-company');
    if (sideCo) sideCo.textContent = (S.settings.companyName || '') + ' • COMPTABLOO';
  }

  /* ------------------------------------------------------------------ */
  /* Routeur                                                             */
  /* ------------------------------------------------------------------ */

  function route() {
    let id = (location.hash || '#/dashboard').replace(/^#\//, '').split('?')[0];
    if (PAGES.indexOf(id) === -1) id = 'dashboard';
    currentPage = id;

    const page = root.COMPTA.pages[id];
    const view = document.getElementById('view');
    UI.qsa('.side-nav .nav-item, .side-foot .nav-item').forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-page') === id);
    });
    document.getElementById('page-title').textContent = page.title;
    document.getElementById('page-sub').textContent = page.sub || '';

    try {
      page.render(view);
    } catch (e) {
      console.error(e);
      view.innerHTML = '';
      view.appendChild(UI.emptyState({
        icon: 'alert',
        title: 'Une erreur est survenue',
        text: (e && e.message) || 'Erreur inconnue'
      }));
    }
    view.scrollTop = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Actions du menu applicatif                                          */
  /* ------------------------------------------------------------------ */

  function menuAction(action) {
    switch (action) {
      case 'new-invoice':
        location.hash = '#/sales';
        setTimeout(function () { root.COMPTA.docs.openEditor({ kind: 'sale', mode: 'invoice' }); }, 80);
        break;
      case 'new-purchase':
        location.hash = '#/purchases';
        setTimeout(function () { root.COMPTA.docs.openEditor({ kind: 'purchase', mode: 'purchase' }); }, 80);
        break;
      case 'print':
        // Une impression de document est déjà en cours (boîte de dialogue ouverte) : rien à faire.
        if (document.body.classList.contains('printing')) break;
        UI.toast('Pour imprimer : ouvrez une facture, un devis, un achat ou un rapport, puis cliquez sur le bouton Imprimer.', 'info');
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Onboarding (premier lancement)                                      */
  /* ------------------------------------------------------------------ */

  function showOnboarding() {
    const rootEl = document.getElementById('onboarding-root');
    rootEl.innerHTML = '';

    const card = h('div', { class: 'onboarding-card' },
      h('img', { src: 'assets/brand.png', alt: 'COMPTABLOO' }),
      h('h2', { text: 'Bienvenue dans COMPTABLOO !' }),
      h('p', { class: 'lead' },
        'La comptabilité simple pour votre entreprise : factures, achats, stock, clients et rapports. ',
        'Tout fonctionne hors ligne, vos données restent sur cet ordinateur.'
      ),
      h('div', { class: 'onboarding-feats' },
        h('span', { text: '💰 Ventes & devis' }),
        h('span', { text: '📦 Stock automatique' }),
        h('span', { text: '📊 Comptabilité simplifiée' }),
        h('span', { text: '🔒 100% hors ligne' })
      ),
      h('div', { class: 'form-grid', style: { marginTop: '22px', textAlign: 'left' } },
        h('div', { class: 'field' },
          h('label', { text: 'Nom de votre entreprise' }),
          h('input', { type: 'text', id: 'ob-company', placeholder: 'Ex. : Ma Boutique SARL', value: root.COMPTA.store.state.settings.companyName !== 'Mon Entreprise' ? root.COMPTA.store.state.settings.companyName : '' })
        ),
        h('div', { class: 'field' },
          h('label', { text: 'Votre devise' }),
          (function () {
            const sel = h('select', { id: 'ob-currency' });
            ['XOF', 'EUR', 'USD', 'GNF', 'GHS', 'CAD'].forEach(function (code) {
              const o = h('option', { value: code, text: L.CURRENCIES[code].symbol + ' — ' + code });
              if (code === 'XOF') o.selected = true;
              sel.appendChild(o);
            });
            return sel;
          })()
        )
      ),
      h('div', { class: 'onboarding-actions' },
        h('button', {
          class: 'btn btn-primary', type: 'button',
          html: UI.icon('check', 18) + ' Démarrer avec un compte vide',
          onclick: function () {
            finishOnboarding(false);
          }
        }),
        h('button', {
          class: 'btn btn-outline', type: 'button',
          html: UI.icon('info', 18) + ' Découvrir avec des données de démonstration',
          onclick: function () {
            finishOnboarding(true);
          }
        }),
        h('p', { class: 'muted small', style: { margin: '4px 0 0' }, text: 'La démonstration peut être effacée à tout moment depuis les Paramètres.' })
      )
    );

    rootEl.appendChild(h('div', { class: 'onboarding' }, card));

    function finishOnboarding(withDemo) {
      const company = (UI.qs('#ob-company').value || '').trim() || 'Mon Entreprise';
      const currency = UI.qs('#ob-currency').value;
      if (withDemo) {
        root.COMPTA.store.loadDemo(company);
        root.COMPTA.store.saveSettings({ currency: currency });
        root.COMPTA.store.state.settings.onboarded = true;
        root.COMPTA.store.persistNow();
        UI.toast('Bienvenue ! Des données de démonstration ont été chargées.');
      } else {
        root.COMPTA.store.saveSettings({ companyName: company, currency: currency, onboarded: true });
        UI.toast('Bienvenue ' + company + ' ! Créez votre premier client pour démarrer.');
      }
      rootEl.innerHTML = '';
      route();
    }
  }

  /* ------------------------------------------------------------------ */

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this);
