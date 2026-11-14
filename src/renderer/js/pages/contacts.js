/*!
 * COMPTABLOO — Page « Clients » / « Fournisseurs » (composant partagé).
 * Liste, recherche, création, historique des documents et soldes.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;

  const filters = { clients: '', suppliers: '' };

  function makePage(kind) {
    const isClient = kind === 'client';
    const pageId = isClient ? 'clients' : 'suppliers';

    function render(el) {
      const st = root.COMPTA.store;
      const S = st.state;
      const list = isClient ? S.clients : S.suppliers;
      const q = (filters[pageId] || '').trim().toLowerCase();

      el.innerHTML = '';

      el.appendChild(h('div', { class: 'toolbar' },
        h('div', { class: 'search-box' },
          h('span', { html: UI.icon('search', 15) }),
          h('input', {
            type: 'search', placeholder: isClient ? 'Rechercher un client…' : 'Rechercher un fournisseur…',
            value: filters[pageId],
            oninput: function (e) { filters[pageId] = e.target.value; renderTable(); }
          })
        ),
        h('div', { class: 'spacer' }),
        h('button', {
          class: 'btn btn-outline', type: 'button',
          html: UI.icon('download', 16) + ' Exporter CSV',
          onclick: exportCSV
        }),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          html: UI.icon('plus', 16) + (isClient ? ' Nouveau client' : ' Nouveau fournisseur'),
          onclick: function () { openContactEditor(kind); }
        })
      ));

      const wrap = h('div', { class: 'table-wrap' });
      el.appendChild(wrap);

      function filtered() {
        return list.filter(function (c) {
          if (!q) return true;
          const hay = ((c.name || '') + ' ' + (c.contact || '') + ' ' + (c.phone || '') + ' ' + (c.email || '') + ' ' + (c.address || '')).toLowerCase();
          return hay.indexOf(q) !== -1;
        }).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'fr'); });
      }

      function renderTable() {
        const rows = filtered();
        wrap.innerHTML = '';
        if (!list.length) {
          wrap.appendChild(UI.emptyState({
            icon: isClient ? 'clients' : 'suppliers',
            title: isClient ? 'Aucun client enregistré' : 'Aucun fournisseur enregistré',
            text: isClient
              ? 'Créez vos clients pour leur adresser des factures et suivre leurs règlements.'
              : 'Créez vos fournisseurs pour enregistrer vos achats et suivre vos dettes.',
            action: h('button', {
              class: 'btn btn-primary', type: 'button',
              html: UI.icon('plus', 16) + (isClient ? ' Créer un client' : ' Créer un fournisseur'),
              onclick: function () { openContactEditor(kind); }
            })
          }));
          return;
        }
        if (!rows.length) {
          wrap.appendChild(UI.emptyState({ icon: 'search', title: 'Aucun résultat', text: 'Modifiez votre recherche.' }));
          return;
        }
        const table = h('table', { class: 'data' });
        table.appendChild(h('thead', null, h('tr', null,
          h('th', { text: 'Nom' }),
          h('th', { text: 'Contact' }),
          h('th', { text: 'Téléphone' }),
          h('th', { text: 'Email' }),
          h('th', { class: 'num', text: isClient ? 'Factures' : 'Achats' }),
          h('th', { class: 'num', text: isClient ? 'Encours' : 'Dette' }),
          h('th', { style: { textAlign: 'right' }, text: 'Actions' })
        )));
        const tbody = h('tbody');
        rows.forEach(function (c) {
          const bal = isClient ? L.clientBalance(S, c.id) : L.supplierBalance(S, c.id);
          tbody.appendChild(h('tr', null,
            h('td', null,
              h('div', { class: 'cell-main', text: c.name }),
              (c.address ? h('div', { class: 'cell-sub', text: c.address }) : null)
            ),
            h('td', { text: c.contact || '—' }),
            h('td', { text: c.phone || '—' }),
            h('td', { text: c.email || '—' }),
            h('td', { class: 'num', text: String(bal.docCount) }),
            h('td', {
              class: 'num',
              html: bal.due > 0 ? '<span class="bold money-neg">' + UI.escapeHtml(UI.money(bal.due)) + '</span>' : '—'
            }),
            h('td', null, h('div', { class: 'row-actions' },
              h('button', { class: 'icon-btn', type: 'button', title: 'Documents', html: UI.icon('eye', 16), onclick: function () { openContactHistory(kind, c); } }),
              h('button', { class: 'icon-btn', type: 'button', title: 'Modifier', html: UI.icon('edit', 16), onclick: function () { openContactEditor(kind, c); } }),
              h('button', { class: 'icon-btn danger', type: 'button', title: 'Supprimer', html: UI.icon('trash', 16), onclick: async function () {
                const ok = await UI.confirm({
                  title: 'Supprimer « ' + c.name + ' » ?',
                  message: 'Cette action est définitive.',
                  danger: true, okText: 'Supprimer'
                });
                if (!ok) return;
                try { st.deleteContact(kind, c.id); UI.toast('Contact supprimé'); }
                catch (err) { UI.toast(err.message, 'error'); }
              } })
            ))
          ));
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
      }

      function exportCSV() {
        const rows = [['Nom', 'Contact', 'Téléphone', 'Email', 'Adresse', isClient ? 'Factures' : 'Achats', isClient ? 'Encours' : 'Dette']];
        filtered().forEach(function (c) {
          const bal = isClient ? L.clientBalance(S, c.id) : L.supplierBalance(S, c.id);
          rows.push([c.name, c.contact, c.phone, c.email, c.address, bal.docCount, bal.due]);
        });
        UI.exportCSV(pageId + '-' + L.todayISO() + '.csv', rows);
      }

      renderTable();
    }

    return {
      render: render,
      title: isClient ? 'Clients' : 'Fournisseurs',
      sub: isClient ? 'Répertoire et encours clients' : 'Répertoire et dettes fournisseurs'
    };
  }

  /* ==================================================================== */
  /* Éditeur contact                                                       */
  /* ==================================================================== */

  function openContactEditor(kind, existing) {
    const st = root.COMPTA.store;
    const isClient = kind === 'client';
    const isEdit = !!existing;

    const m = UI.modal({
      title: isEdit
        ? 'Modifier ' + (isClient ? 'le client' : 'le fournisseur')
        : (isClient ? 'Nouveau client' : 'Nouveau fournisseur'),
      okText: isEdit ? 'Enregistrer' : 'Créer',
      okIcon: 'save',
      onOk: function (close) {
        try {
          st.upsertContact(kind, {
            id: isEdit ? existing.id : undefined,
            name: val('c-name'),
            contact: val('c-contact'),
            phone: val('c-phone'),
            email: val('c-email'),
            address: val('c-address'),
            notes: val('c-notes')
          });
          close();
          UI.toast(isEdit ? 'Modifications enregistrées' : (isClient ? 'Client créé' : 'Fournisseur créé'));
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      }
    });
    const b = m.body;

    b.appendChild(h('div', { class: 'form-grid' },
      field((isClient ? 'Nom du client' : 'Nom du fournisseur') + ' *', h('input', { type: 'text', id: 'c-name', value: existing ? existing.name : '', placeholder: isClient ? 'Ex. : Boutique Awa' : 'Ex. : Grossiste Adjinaku' })),
      field('Personne de contact', h('input', { type: 'text', id: 'c-contact', value: existing ? (existing.contact || '') : '' })),
      field('Téléphone', h('input', { type: 'tel', id: 'c-phone', value: existing ? (existing.phone || '') : '', placeholder: 'Ex. : 90 12 34 56' })),
      field('Email', h('input', { type: 'email', id: 'c-email', value: existing ? (existing.email || '') : '' }))
    ));
    b.appendChild(field('Adresse', h('input', { type: 'text', id: 'c-address', value: existing ? (existing.address || '') : '', placeholder: 'Ville, quartier…' })));
    b.appendChild(field('Notes', h('textarea', { id: 'c-notes' }, existing ? (existing.notes || '') : '')));

    function field(label, input) { return h('div', { class: 'field' }, h('label', { text: label }), input); }
    function val(id) { return UI.qs('#' + id, b).value; }
  }

  /* ==================================================================== */
  /* Historique des documents d'un contact                                 */
  /* ==================================================================== */

  function openContactHistory(kind, contact) {
    const st = root.COMPTA.store;
    const S = st.state;
    const isClient = kind === 'client';
    const docs = (isClient ? S.sales : S.purchases)
      .filter(function (d) { return isClient ? (d.clientId === contact.id && d.type === 'invoice') : d.supplierId === contact.id; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    const bal = isClient ? L.clientBalance(S, contact.id) : L.supplierBalance(S, contact.id);

    const m = UI.modal({
      title: contact.name,
      subtitle: (isClient ? 'Factures et encours' : 'Achats et dette') + ' • ' + bal.docCount + ' document(s)',
      okText: null,
      cancelText: 'Fermer',
      mid: true
    });
    const b = m.body;

    b.appendChild(h('div', { class: 'kpi-grid', style: { gridTemplateColumns: 'repeat(2,1fr)' } },
      h('div', { class: 'card', style: { padding: '14px 16px' } },
        h('div', { class: 'kpi-lbl', text: isClient ? 'Encours à encaisser' : 'Dette à payer' }),
        h('div', { class: 'kpi-val' + (bal.due > 0 ? ' red' : ' green'), text: UI.money(bal.due) })
      ),
      h('div', { class: 'card', style: { padding: '14px 16px' } },
        h('div', { class: 'kpi-lbl', text: 'Coordonnées' }),
        h('div', { class: 'small', style: { lineHeight: 1.6 } },
          (contact.phone || '—') + (contact.email ? ' • ' + contact.email : ''),
          contact.address ? h('div', { class: 'muted', text: contact.address }) : null
        )
      )
    ));

    if (!docs.length) {
      b.appendChild(UI.emptyState({ icon: 'book', title: 'Aucun document', text: 'Les documents apparaîtront ici.' }));
      return;
    }
    const table = h('table', { class: 'data' });
    table.appendChild(h('thead', null, h('tr', null,
      h('th', { text: 'N°' }), h('th', { text: 'Date' }), h('th', { class: 'num', text: 'Total' }),
      h('th', { class: 'num', text: 'Payé' }), h('th', { class: 'num', text: 'Reste' }), h('th', { text: 'Statut' })
    )));
    const tbody = h('tbody');
    docs.forEach(function (d) {
      tbody.appendChild(h('tr', null,
        h('td', { class: 'cell-main', text: d.number }),
        h('td', { text: L.formatDate(d.date) }),
        h('td', { class: 'num', text: UI.money(L.computeDocTotals(d, S.settings).total) }),
        h('td', { class: 'num', text: UI.money(L.paidAmount(d)) }),
        h('td', { class: 'num', text: UI.money(L.dueAmount(d, S.settings)) }),
        h('td', { html: UI.docBadge(d, S.settings) })
      ));
    });
    table.appendChild(tbody);
    b.appendChild(h('div', { class: 'table-wrap mt-16', style: { maxHeight: '46vh' } }, table));
  }

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA.pages = root.COMPTA.pages || {};
  root.COMPTA.pages.clients = makePage('client');
  root.COMPTA.pages.suppliers = makePage('supplier');
  root.COMPTA.contacts = { openContactEditor: openContactEditor };
})(typeof window !== 'undefined' ? window : this);
