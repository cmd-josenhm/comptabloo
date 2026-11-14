/*!
 * COMPTABLOO — Page « Paramètres » : entreprise, devise et facturation,
 * logo, sauvegardes (export/import), données de démonstration, à propos.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  function render(el) {
    const st = root.COMPTA.store;
    const S = st.state;

    el.innerHTML = '';

    /* ================================================================== */
    /* Entreprise                                                          */
    /* ================================================================== */
    const companyCard = h('div', { class: 'card mb-16' },
      h('div', { class: 'card-h' }, h('h3', { text: 'Mon entreprise' })),
      h('div', { class: 'card-b' })
    );
    const cb = companyCard.querySelector('.card-b');
    cb.appendChild(h('div', { class: 'form-grid' },
      field('Nom de l\u2019entreprise *', h('input', { type: 'text', id: 's-name', value: S.settings.companyName || '' })),
      field('IFU / NIF / N° fiscal', h('input', { type: 'text', id: 's-taxid', value: S.settings.taxId || '' })),
      field('Téléphone', h('input', { type: 'tel', id: 's-phone', value: S.settings.phone || '' })),
      field('Email', h('input', { type: 'email', id: 's-email', value: S.settings.email || '' }))
    ));
    cb.appendChild(field('Adresse', h('input', { type: 'text', id: 's-address', value: S.settings.address || '' })));

    // Logo d'entreprise (affiché sur les documents imprimés)
    const logoWrap = h('div', { class: 'field' },
      h('label', { text: 'Logo (affiché sur vos factures)' }),
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        h('img', {
          id: 's-logo-preview', alt: 'Logo',
          src: S.settings.logoDataUrl || '',
          style: { width: '64px', height: '64px', objectFit: 'contain', border: '1px solid #E3E9F2', borderRadius: '10px', background: '#fff', display: S.settings.logoDataUrl ? 'block' : 'none' }
        }),
        h('div', null,
          h('input', {
            type: 'file', accept: 'image/png,image/jpeg', class: 'compact',
            onchange: function (e) {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              if (file.size > 400 * 1024) { UI.toast('Image trop lourde (400 Ko maximum).', 'error'); return; }
              const reader = new FileReader();
              reader.onload = function () {
                const img = UI.qs('#s-logo-preview');
                img.src = String(reader.result);
                img.style.display = 'block';
                st.saveSettings({ logoDataUrl: String(reader.result) });
                UI.toast('Logo enregistré');
              };
              reader.readAsDataURL(file);
            }
          }),
          S.settings.logoDataUrl
            ? h('button', {
              class: 'btn btn-ghost btn-sm', type: 'button', text: 'Retirer le logo',
              onclick: function () {
                st.saveSettings({ logoDataUrl: null });
                const img = UI.qs('#s-logo-preview');
                img.style.display = 'none';
                UI.toast('Logo retiré');
              }
            })
            : h('span', { class: 'help', text: 'PNG ou JPG, 400 Ko max.' })
        )
      )
    );
    cb.appendChild(logoWrap);
    cb.appendChild(field('Pied de page des documents', h('input', { type: 'text', id: 's-footer', value: S.settings.invoiceFooter || '', placeholder: 'Merci de votre confiance.' })));

    cb.appendChild(h('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
      h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('save', 16) + ' Enregistrer les informations',
        onclick: function () {
          st.saveSettings({
            companyName: v('s-name') || 'Mon Entreprise',
            taxId: v('s-taxid'),
            phone: v('s-phone'),
            email: v('s-email'),
            address: v('s-address'),
            invoiceFooter: v('s-footer')
          });
          UI.toast('Informations enregistrées');
        }
      })
    ));
    el.appendChild(companyCard);

    /* ================================================================== */
    /* Facturation & devise                                                */
    /* ================================================================== */
    const invoicingCard = h('div', { class: 'card mb-16' },
      h('div', { class: 'card-h' }, h('h3', { text: 'Facturation et devise' })),
      h('div', { class: 'card-b' })
    );
    const ib = invoicingCard.querySelector('.card-b');

    const currencySel = h('select', { id: 's-currency' });
    Object.keys(L.CURRENCIES).forEach(function (code) {
      const c = L.CURRENCIES[code];
      const o = h('option', { value: code, text: c.symbol + ' — ' + code + (c.decimals ? ' (2 décimales)' : ' (entiers)') });
      if (code === (S.settings.currency || 'XOF')) o.selected = true;
      currencySel.appendChild(o);
    });

    ib.appendChild(h('div', { class: 'form-grid-3' },
      field('Devise', currencySel),
      field('Taux de TVA par défaut (%)', h('input', { type: 'number', min: '0', step: 'any', id: 's-tax', value: S.settings.taxRate })),
      field('Délai de paiement par défaut (jours)', h('input', { type: 'number', min: '0', step: '1', id: 's-term', value: S.settings.paymentTermDays || 30 }))
    ));
    ib.appendChild(h('div', { class: 'form-grid-3' },
      field('Préfixe des factures', h('input', { type: 'text', id: 's-pinv', value: S.settings.invoicePrefix || 'FACT' })),
      field('Préfixe des devis', h('input', { type: 'text', id: 's-pquo', value: S.settings.quotePrefix || 'DEVIS' })),
      field('Préfixe des achats', h('input', { type: 'text', id: 's-pach', value: S.settings.purchasePrefix || 'ACH' }))
    ));
    ib.appendChild(h('div', { class: 'note-box', style: { marginBottom: '14px' } },
      'Le changement de devise modifie l\u2019affichage et les arrondis de TOUS les montants. ',
      'Vos montants saisis restent numériquement identiques : changez de devise uniquement au démarrage ou si vous savez ce que vous faites.'
    ));
    ib.appendChild(h('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
      h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('save', 16) + ' Enregistrer',
        onclick: function () {
          st.saveSettings({
            currency: v('s-currency'),
            taxRate: Number(v('s-tax')) || 0,
            paymentTermDays: Number(v('s-term')) || 0,
            invoicePrefix: (v('s-pinv') || 'FACT').toUpperCase(),
            quotePrefix: (v('s-pquo') || 'DEVIS').toUpperCase(),
            purchasePrefix: (v('s-pach') || 'ACH').toUpperCase()
          });
          UI.toast('Paramètres de facturation enregistrés');
        }
      })
    ));
    el.appendChild(invoicingCard);

    /* ================================================================== */
    /* Données & sauvegardes                                               */
    /* ================================================================== */
    const dataCard = h('div', { class: 'card mb-16' },
      h('div', { class: 'card-h' }, h('h3', { text: 'Mes données' }), h('span', { class: 'hint', text: '100% local — rien ne quitte cet ordinateur' })),
      h('div', { class: 'card-b' })
    );
    const db2 = dataCard.querySelector('.card-b');
    db2.appendChild(h('div', { class: 'note-box', style: { marginBottom: '14px' } },
      'Vos données sont enregistrées automatiquement sur cet ordinateur. Une copie de sécurité quotidienne est conservée automatiquement (10 derniers jours). ',
      'Exportez régulièrement une sauvegarde sur une clé USB pour sécuriser votre activité.'
    ));
    db2.appendChild(h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('download', 16) + ' Exporter une sauvegarde',
        onclick: async function () {
          const res = await root.COMPTA.db.detect().exportBackup(root.COMPTA.store.state);
          if (res && res.ok) UI.toast('Sauvegarde créée' + (res.path ? ' : ' + res.path : ''));
          else if (res && res.error) UI.toast('Export impossible : ' + res.error, 'error');
        }
      }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('upload', 16) + ' Restaurer une sauvegarde',
        onclick: async function () {
          const ok = await UI.confirm({
            title: 'Restaurer une sauvegarde ?',
            message: 'Toutes les données actuelles seront remplacées par le contenu du fichier choisi.\nPensez à exporter vos données actuelles avant.',
            danger: true, okText: 'Choisir un fichier'
          });
          if (!ok) return;
          const res = await root.COMPTA.db.detect().importBackup();
          if (!res || !res.ok) {
            if (res && res.error) UI.toast(res.error, 'error');
            return;
          }
          root.COMPTA.store.replaceState(res.data, { keepOnboarded: true });
          UI.toast('Sauvegarde restaurée avec succès');
        }
      }),
      h('button', {
        class: 'btn btn-outline', type: 'button',
        html: UI.icon('info', 16) + ' Charger les données de démonstration',
        onclick: async function () {
          const ok = await UI.confirm({
            title: 'Charger la démonstration ?',
            message: 'Vos données actuelles seront remplacées par un jeu de démonstration complet.\nExportez d\u2019abord une sauvegarde si nécessaire.',
            danger: true, okText: 'Charger la démo'
          });
          if (!ok) return;
          root.COMPTA.store.loadDemo();
          UI.toast('Données de démonstration chargées');
        }
      }),
      h('button', {
        class: 'btn btn-danger', type: 'button',
        html: UI.icon('reset', 16) + ' Tout réinitialiser',
        onclick: async function () {
          const ok = await UI.confirm({
            title: '⚠ Réinitialiser TOUTES les données ?',
            message: 'Clients, produits, ventes, achats, comptabilité : tout sera effacé définitivement.\nCette action ne peut pas être annulée.',
            danger: true, okText: 'J\u2019ai compris, tout effacer'
          });
          if (!ok) return;
          const ok2 = await UI.confirm({
            title: 'Dernière confirmation',
            message: 'Voulez-vous vraiment effacer toutes vos données ?',
            danger: true, okText: 'Oui, tout effacer'
          });
          if (!ok2) return;
          root.COMPTA.store.resetAll();
          UI.toast('Données réinitialisées');
        }
      })
    ));
    el.appendChild(dataCard);

    /* ================================================================== */
    /* À propos                                                            */
    /* ================================================================== */
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'card-b', style: { display: 'flex', gap: '18px', alignItems: 'center' } },
        h('img', { src: 'assets/brand.png', alt: 'COMPTABLOO', style: { width: '58px', height: '58px' } }),
        h('div', null,
          h('div', { class: 'bold', style: { fontSize: '16px' }, text: 'COMPTABLOO 1.0.0' }),
          h('div', { class: 'small muted', style: { marginTop: '4px', lineHeight: 1.6 } },
            'La comptabilité simple des PME — 100% hors ligne, aucune donnée envoyée sur Internet. ',
            'Conçu pour les entrepreneurs débutants : ventes, achats, stock, clients, fournisseurs, comptabilité et rapports.',
            h('div', { style: { marginTop: '6px' } },
              h('span', { class: 'kbd', text: 'Ctrl+N' }), ' nouvelle facture · ',
              h('span', { class: 'kbd', text: 'Ctrl+P' }), ' imprimer · ',
              h('span', { class: 'kbd', text: 'F11' }), ' plein écran'
            )
          )
        )
      )
    ));

    function field(label, input) { return h('div', { class: 'field' }, h('label', { text: label }), input); }
    function v(id) { return UI.qs('#' + id, el).value; }
  }

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.settings = { render: render, title: 'Paramètres', sub: 'Entreprise, devise et sauvegardes' };
})(typeof window !== 'undefined' ? window : this);
