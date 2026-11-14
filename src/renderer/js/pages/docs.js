/*!
 * COMPTABLOO — Composants partagés des documents (ventes & achats) :
 * éditeur (facture / devis / achat), paiements, vue détaillée, impression A4.
 */
(function (root) {
  'use strict';
  const L = root.COMPTA.logic;
  const UI = root.COMPTA.ui;
  const store = () => root.COMPTA.store;

  const PAYMENT_METHODS = ['Espèces', 'Mobile Money', 'Virement', 'Chèque', 'Carte bancaire'];

  const DOC_LABELS = {
    invoice: { one: 'Facture', article: 'facture de vente', print: 'FACTURE', color: 'blue' },
    quote: { one: 'Devis', article: 'devis', print: 'DEVIS', color: 'grey' },
    purchase: { one: 'Achat', article: 'bon d\u2019achat', print: 'BON D\u2019ACHAT', color: 'purple' }
  };

  /* ================================================================== */
  /* ÉDITEUR DE DOCUMENT                                                 */
  /* ================================================================== */

  /**
   * Ouvre l'éditeur.
   * @param {Object} opts {kind:'sale'|'purchase', mode:'invoice'|'quote'|'purchase', doc?, onSaved(doc)}
   */
  function openEditor(opts) {
    const st = store();
    const S = st.state;
    const kind = opts.kind;                    // 'sale' | 'purchase'
    const mode = opts.mode || (kind === 'purchase' ? 'purchase' : 'invoice');
    const existing = opts.doc || null;
    const isPurchase = kind === 'purchase';
    const contacts = isPurchase ? S.suppliers : S.clients;
    const label = DOC_LABELS[mode];
    const money = UI.money;

    const today = L.todayISO();
    const form = {
      contactId: existing ? (existing.clientId || existing.supplierId) : '',
      date: existing ? existing.date : today,
      dueDate: existing ? existing.dueDate : (mode === 'quote' ? L.addDaysISO(today, 15) : L.addDaysISO(today, Number(S.settings.paymentTermDays) || 30)),
      number: existing ? existing.number : L.nextDocNumber(mode, S),
      taxRate: existing ? existing.taxRate : (Number(S.settings.taxRate) || 0),
      notes: existing ? (existing.notes || '') : '',
      lines: existing ? L.deepClone(existing.lines) : [newLine()]
    };

    function newLine() {
      return { id: L.uid(), productId: null, description: '', qty: 1, unitPrice: 0, discount: 0 };
    }

    const m = UI.modal({
      title: (existing ? 'Modifier ' : 'Nouvelle ') + label.article,
      subtitle: existing ? existing.number : 'Les champs marqués * sont obligatoires',
      wide: true,
      cancelText: 'Annuler',
      okText: existing ? 'Enregistrer les modifications' : 'Créer le document',
      okIcon: 'save',
      onOk: function (close) { save(close, false); }
    });
    const b = m.body;

    /* ---------- En-tête du formulaire ---------- */
    const partnerLabel = isPurchase ? 'Fournisseur *' : 'Client *';
    const partnerField = h('div', { class: 'field' },
      h('label', { html: UI.escapeHtml(partnerLabel) }),
      partnerSelect()
    );

    b.appendChild(h('div', { class: 'form-grid' },
      partnerField,
      h('div', { class: 'field' },
        h('label', { text: 'Numéro' }),
        h('input', { type: 'text', value: form.number, oninput: function (e) { form.number = e.target.value; } })
      ),
      h('div', { class: 'field' },
        h('label', { text: 'Date *' }),
        h('input', { type: 'date', value: form.date, onchange: function (e) { form.date = e.target.value || today; } })
      ),
      h('div', { class: 'field' },
        h('label', { text: mode === 'quote' ? 'Valable jusqu\u2019au' : (isPurchase ? 'Échéance (facultatif)' : 'Échéance de paiement') }),
        h('input', { type: 'date', value: form.dueDate || '', onchange: function (e) { form.dueDate = e.target.value || null; } })
      )
    ));

    function partnerSelect() {
      const sel = h('select');
      sel.appendChild(h('option', { value: '', text: '— Sélectionner —' }));
      contacts.forEach(function (c) {
        const o = h('option', { value: c.id, text: c.name });
        if (c.id === form.contactId) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { form.contactId = sel.value; });
      return sel;
    }

    /* ---------- Lignes ---------- */
    const linesWrap = h('div', { class: 'field' });
    b.appendChild(linesWrap);
    renderLines();

    function renderLines() {
      linesWrap.innerHTML = '';
      linesWrap.appendChild(h('label', { text: 'Articles / prestations *' }));
      const table = h('table', { class: 'lines-table' });
      const thead = h('thead', null, h('tr', null,
        h('th', { style: { width: '22%' }, text: 'Produit' }),
        h('th', { text: 'Description' }),
        h('th', { style: { width: '8%' }, text: 'Qté' }),
        h('th', { style: { width: '12%' }, text: 'P.U.' }),
        h('th', { style: { width: '9%' }, text: 'Rem. %' }),
        h('th', { style: { width: '12%' }, text: 'Total' }),
        h('th', { style: { width: '34px' } })
      ));
      const tbody = h('tbody');
      form.lines.forEach(function (line, idx) { tbody.appendChild(lineRow(line, idx)); });
      table.appendChild(thead);
      table.appendChild(tbody);
      linesWrap.appendChild(table);
      linesWrap.appendChild(h('div', { style: { marginTop: '8px' } },
        h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          html: UI.icon('plus', 14) + ' Ajouter une ligne',
          onclick: function () { form.lines.push(newLine()); renderLines(); }
        })
      ));
      updateTotals();
    }

    function lineRow(line, idx) {
      const tr = h('tr');

      const prodSel = h('select');
      prodSel.appendChild(h('option', { value: '', text: '— Libre —' }));
      store().state.products.forEach(function (p) {
        if (p.archived && p.id !== line.productId) return;
        const o = h('option', { value: p.id, text: p.name + (p.sku ? ' (' + p.sku + ')' : '') });
        if (p.id === line.productId) o.selected = true;
        prodSel.appendChild(o);
      });
      prodSel.addEventListener('change', function () {
        const p = L.findProduct(store().state, prodSel.value);
        if (p) {
          line.productId = p.id;
          if (!line.description || isFreeDesc(line)) line.description = p.name;
          line.unitPrice = isPurchase ? p.costPrice : p.salePrice;
          renderLines();
          const qtyInputs = linesWrap.querySelectorAll('input[data-field="qty"]');
          if (qtyInputs[idx]) qtyInputs[idx].focus();
        } else {
          line.productId = null;
        }
      });

      function isFreeDesc(l) {
        const p = l.productId ? L.findProduct(store().state, l.productId) : null;
        return !p || l.description === p.name;
      }

      const cells = [
        h('td', null, prodSel),
        h('td', null, input('description', line.description, 'text')),
        h('td', null, input('qty', line.qty, 'number', '1')),
        h('td', null, input('unitPrice', line.unitPrice, 'number', 'any')),
        h('td', null, input('discount', line.discount || '', 'number', 'any')),
        h('td', { class: 'line-total', text: money(L.lineNet(line, S.settings)) }),
        h('td', null, h('button', {
          class: 'icon-btn danger', type: 'button', title: 'Supprimer la ligne',
          html: UI.icon('trash', 15),
          onclick: function () {
            form.lines.splice(idx, 1);
            if (!form.lines.length) form.lines.push(newLine());
            renderLines();
          }
        }))
      ];
      cells.forEach(function (c) { tr.appendChild(c); });
      return tr;
    }

    function input(field, value, type, step) {
      return h('input', {
        type: type, value: value, step: step || 'any', min: '0',
        'data-field': field,
        oninput: function (e) {
          const tr = e.target.closest('tr');
          const idx = Array.prototype.indexOf.call(tr.parentNode.children, tr);
          const line = form.lines[idx];
          if (field === 'description') line.description = e.target.value;
          else line[field] = e.target.value === '' ? 0 : Number(e.target.value);
          tr.querySelector('.line-total').textContent = money(L.lineNet(line, S.settings));
          updateTotals();
        }
      });
    }

    /* ---------- Totaux ---------- */
    b.appendChild(totalsWrap());
    updateTotals();

    function totalsWrap() {
      const taxInput = h('input', {
        type: 'number', min: '0', step: 'any', value: form.taxRate,
        style: { width: '64px', padding: '2px 6px', textAlign: 'right' },
        oninput: function (e) { form.taxRate = Number(e.target.value) || 0; updateTotals(true); }
      });
      const box = h('div', { class: 'totals-box' },
        h('div', { class: 'totals-row', id: 't-subtotal' }),
        h('div', { class: 'totals-row', id: 't-discount' }),
        h('div', { class: 'totals-row' },
          h('span', null, 'TVA ', taxInput, ' %'),
          h('span', { id: 't-tax' })
        ),
        h('div', { class: 'totals-row grand' },
          h('span', { text: 'TOTAL TTC' }),
          h('span', { id: 't-total' })
        )
      );
      return box;
    }

    function updateTotals(skipTax) {
      const totals = L.computeDocTotals({ lines: form.lines, taxRate: form.taxRate }, S.settings);
      const set = function (id, v) {
        const el = b.querySelector('#' + id);
        if (el) el.textContent = v;
      };
      set('t-subtotal', money(totals.subtotal));
      const dRow = b.querySelector('#t-discount');
      if (dRow) {
        dRow.style.display = totals.discountTotal > 0 ? 'flex' : 'none';
        dRow.innerHTML = '<span>Remise</span><span class="neg">−' + UI.escapeHtml(money(totals.discountTotal)) + '</span>';
      }
      set('t-tax', money(totals.taxTotal));
      set('t-total', money(totals.total));
    }

    /* ---------- Notes ---------- */
    b.appendChild(h('div', { class: 'field' },
      h('label', { text: 'Notes (visibles sur le document)' }),
      h('textarea', {
        placeholder: 'Conditions, mention particulière…',
        oninput: function (e) { form.notes = e.target.value; }
      }, form.notes)
    ));

    // Valeur initiale des notes après ajout au DOM
    setTimeout(function () {
      const ta = b.querySelector('textarea');
      if (ta) ta.value = form.notes;
    }, 0);

    /* ---------- Enregistrement ---------- */
    function save(close, thenPrint) {
      try {
        const payload = {
          id: existing ? existing.id : undefined,
          number: form.number,
          date: form.date,
          dueDate: form.dueDate || null,
          lines: form.lines,
          taxRate: form.taxRate,
          notes: form.notes
        };
        let doc;
        if (isPurchase) {
          payload.supplierId = form.contactId;
          doc = st.upsertPurchase(payload);
        } else {
          payload.clientId = form.contactId;
          payload.type = mode;
          doc = st.upsertSale(payload);
        }
        close();
        UI.toast((existing ? 'Document modifié : ' : 'Document créé : ') + doc.number);
        if (thenPrint) printDoc(doc);
        if (opts.onSaved) opts.onSaved(doc);
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    }

    // Bouton « Enregistrer et imprimer » ajouté au pied de modale
    const foot = m.root.querySelector('.modal-f');
    const printBtn = h('button', {
      class: 'btn btn-outline', type: 'button',
      html: UI.icon('print', 16) + ' Enregistrer et imprimer',
      onclick: function () { save(m.close, true); }
    });
    foot.insertBefore(printBtn, foot.firstChild);
  }

  /* ================================================================== */
  /* PAIEMENTS                                                           */
  /* ================================================================== */

  /** @param {{doc:object, kind:'sale'|'purchase'}} opts */
  function openPayments(opts) {
    const st = store();
    const S = st.state;
    const kind = opts.kind;
    const doc = opts.doc;
    const isPurchase = kind === 'purchase';
    const refreshModal = render;

    function render() {
      const d = isPurchase ? st._internal.findPurchase(doc.id) : st._internal.findSale(doc.id);
      if (!d) return;
      const totals = L.computeDocTotals(d, S.settings);
      const paid = L.paidAmount(d);
      const due = L.dueAmount(d, S.settings);

      const m = UI.modal({
        title: 'Paiements — ' + d.number,
        subtitle: (isPurchase ? L.supplierName(S, d.supplierId) : L.clientName(S, d.clientId)) + ' • Total ' + UI.money(totals.total),
        okText: null,
        cancelText: 'Fermer'
      });

      // Solde
      m.body.appendChild(h('div', { class: 'kpi-grid', style: { gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '14px' } },
        kpi('Encaissé / payé', UI.money(paid), 'green'),
        kpi('Reste dû', UI.money(due), due > 0 ? 'red' : 'green'),
        kpi('Total TTC', UI.money(totals.total), '')
      ));

      // Nouveau paiement
      m.body.appendChild(h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', { text: 'Enregistrer un paiement' })),
        h('div', { class: 'card-b' },
          h('div', { class: 'form-grid' },
            field('Date', h('input', { type: 'date', value: L.todayISO(), id: 'pay-date' })),
            field('Montant *', h('input', { type: 'number', min: '0', step: 'any', value: due || '', id: 'pay-amount' })),
            field('Méthode', selectEl(PAYMENT_METHODS, 'Espèces', 'pay-method')),
            field('Note', h('input', { type: 'text', placeholder: 'Acompte, référence…', id: 'pay-note' }))
          ),
          h('button', {
            class: 'btn btn-primary btn-sm', type: 'button',
            html: UI.icon('plus', 14) + ' Ajouter le paiement',
            onclick: function () {
              try {
                const payment = {
                  date: UI.qs('#pay-date', m.body).value || L.todayISO(),
                  amount: Number(UI.qs('#pay-amount', m.body).value) || 0,
                  method: UI.qs('#pay-method', m.body).value,
                  note: UI.qs('#pay-note', m.body).value
                };
                if (isPurchase) st.addPurchasePayment(d.id, payment);
                else st.addSalePayment(d.id, payment);
                UI.toast('Paiement enregistré');
                m.close();
                render();
              } catch (err) {
                UI.toast(err.message, 'error');
              }
            }
          })
        )
      ));

      // Historique
      const list = h('div', { class: 'card mt-16' },
        h('div', { class: 'card-h' }, h('h3', { text: 'Historique des paiements' })),
        h('div', { class: 'card-b' })
      );
      const listBody = list.querySelector('.card-b');
      if (!d.payments || !d.payments.length) {
        listBody.appendChild(UI.emptyState({ icon: 'payment', title: 'Aucun paiement', text: 'Les paiements apparaîtront ici.' }));
      } else {
        d.payments.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (p) {
          listBody.appendChild(h('div', { class: 'list-item' },
            h('div', { class: 'li-main' },
              h('div', { class: 'li-title', text: (p.method || '—') + (p.note ? ' — ' + p.note : '') }),
              h('div', { class: 'li-sub', text: L.formatDate(p.date) })
            ),
            h('div', { class: 'li-val', text: UI.money(p.amount) }),
            h('button', {
              class: 'icon-btn danger', type: 'button', title: 'Supprimer ce paiement',
              html: UI.icon('trash', 15),
              onclick: async function () {
                const ok = await UI.confirm({
                  title: 'Supprimer ce paiement ?',
                  message: 'Le journal comptable sera mis à jour automatiquement.',
                  danger: true, okText: 'Supprimer'
                });
                if (!ok) return;
                if (isPurchase) st.deletePurchasePayment(d.id, p.id);
                else st.deleteSalePayment(d.id, p.id);
                UI.toast('Paiement supprimé');
                m.close();
                render();
              }
            })
          ));
        });
      }
      m.body.appendChild(list);
    }

    function kpi(lbl, val, color) {
      return h('div', { class: 'card', style: { padding: '12px 14px' } },
        h('div', { class: 'kpi-lbl', text: lbl }),
        h('div', { class: 'kpi-val' + (color ? ' ' + color : ''), text: val })
      );
    }
    function field(lbl, input) {
      return h('div', { class: 'field' }, h('label', { text: lbl }), input);
    }
    function selectEl(options, selected, id) {
      const s = h('select', { id: id });
      options.forEach(function (o) {
        const op = h('option', { value: o, text: o });
        if (o === selected) op.selected = true;
        s.appendChild(op);
      });
      return s;
    }

    render();
  }

  /* ================================================================== */
  /* VUE DÉTAILLÉE                                                       */
  /* ================================================================== */

  /** @param {{doc:object, kind:'sale'|'purchase'}} opts */
  function openDetail(opts) {
    const st = store();
    const S = st.state;
    const kind = opts.kind;
    const isPurchase = kind === 'purchase';
    const d = opts.doc;
    const mode = isPurchase ? 'purchase' : d.type;
    const label = DOC_LABELS[mode];
    const totals = L.computeDocTotals(d, S.settings);
    const paid = L.paidAmount(d);
    const due = L.dueAmount(d, S.settings);

    const m = UI.modal({
      title: label.one + ' ' + d.number,
      subtitle: (isPurchase ? L.supplierName(S, d.supplierId) : L.clientName(S, d.clientId)) + ' • ' + L.formatDate(d.date),
      okText: null,
      cancelText: 'Fermer'
    });
    const b = m.body;

    b.appendChild(h('div', { style: { marginBottom: '12px' }, html: UI.docBadge(d, S.settings) }));

    const table = h('table', { class: 'data', style: { fontSize: '12.5px' } });
    const thead = h('thead', null, h('tr', null,
      h('th', { text: 'Description' }), h('th', { class: 'num', text: 'Qté' }),
      h('th', { class: 'num', text: 'P.U.' }), h('th', { class: 'num', text: 'Remise' }),
      h('th', { class: 'num', text: 'Total HT' })
    ));
    const tbody = h('tbody');
    d.lines.forEach(function (l) {
      tbody.appendChild(h('tr', null,
        h('td', { class: 'cell-main', text: l.description }),
        h('td', { class: 'num', text: L.formatNumber(l.qty, 0) }),
        h('td', { class: 'num', text: UI.money(l.unitPrice) }),
        h('td', { class: 'num', text: l.discount ? l.discount + '%' : '—' }),
        h('td', { class: 'num bold', text: UI.money(L.lineNet(l, S.settings)) })
      ));
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    b.appendChild(h('div', { class: 'table-wrap', style: { maxHeight: '300px' } }, table));

    b.appendChild(h('div', { class: 'divider' }));
    const infoRows = h('div', { class: 'form-grid' });
    infoRows.appendChild(h('div', null,
      row('Sous-total HT', UI.money(totals.subtotal)),
      row('Remise', totals.discountTotal ? '−' + UI.money(totals.discountTotal) : '—'),
      row('TVA (' + d.taxRate + '%)', UI.money(totals.taxTotal))
    ));
    infoRows.appendChild(h('div', null,
      row('Total TTC', UI.money(totals.total), true),
      row('Déjà payé', UI.money(paid)),
      row('Reste dû', UI.money(due), true)
    ));
    b.appendChild(infoRows);

    if (d.notes) {
      b.appendChild(h('div', { class: 'note-box mt-16', text: d.notes }));
    }
    if (!isPurchase && d.type === 'quote' && d.dueDate) {
      b.appendChild(h('div', { class: 'small muted mt-16', text: 'Valable jusqu\u2019au ' + L.formatDate(d.dueDate) }));
    }

    function row(lbl, val, strong) {
      return h('div', { class: 'totals-row' + (strong ? ' grand' : '') },
        h('span', { text: lbl }), h('span', { text: val }));
    }

    /* Pied : actions */
    const foot = m.root.querySelector('.modal-f');
    if (!isPurchase && d.type === 'invoice' && due > 0) {
      foot.insertBefore(h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('payment', 16) + ' Paiement',
        onclick: function () { m.close(); openPayments({ doc: d, kind: kind }); }
      }), foot.firstChild);
    }
    if (!isPurchase && d.type === 'quote' && !d.convertedTo) {
      foot.insertBefore(h('button', {
        class: 'btn btn-primary', type: 'button',
        html: UI.icon('convert', 16) + ' Convertir en facture',
        onclick: async function () {
          const ok = await UI.confirm({
            title: 'Convertir le devis ' + d.number + ' ?',
            message: 'Une facture sera créée avec les mêmes lignes.\nLe devis restera consultable, marqué « Facturé ».'
          });
          if (!ok) return;
          try {
            const inv = st.convertQuote(d.id);
            m.close();
            UI.toast('Facture créée : ' + inv.number);
          } catch (err) { UI.toast(err.message, 'error'); }
        }
      }), foot.firstChild);
    }
    foot.insertBefore(h('button', {
      class: 'btn btn-outline', type: 'button',
      html: UI.icon('print', 16) + ' Imprimer',
      onclick: function () { printDoc(d); }
    }), foot.firstChild);
    foot.insertBefore(h('button', {
      class: 'btn btn-outline', type: 'button',
      html: UI.icon('edit', 16) + ' Modifier',
      onclick: function () {
        m.close();
        openEditor({ kind: kind, mode: mode, doc: d });
      }
    }), foot.firstChild);
  }

  /* ================================================================== */
  /* IMPRESSION A4                                                       */
  /* ================================================================== */

  function printDoc(doc) {
    const st = store();
    const S = st.state;
    const isPurchase = doc.type === 'purchase';
    const mode = isPurchase ? 'purchase' : doc.type;
    const label = DOC_LABELS[mode];
    const totals = L.computeDocTotals(doc, S.settings);
    const paid = L.paidAmount(doc);
    const due = L.dueAmount(doc, S.settings);
    const esc = UI.escapeHtml;
    const partner = isPurchase
      ? (L.findSupplier(S, doc.supplierId) || {})
      : (L.findClient(S, doc.clientId) || {});
    const logo = S.settings.logoDataUrl
      ? '<img src="' + S.settings.logoDataUrl + '" alt="">'
      : '';

    const companyLines = [
      '<div class="name">' + esc(S.settings.companyName) + '</div>',
      S.settings.address ? esc(S.settings.address) : '',
      S.settings.phone ? 'Tél : ' + esc(S.settings.phone) : '',
      S.settings.email ? esc(S.settings.email) : '',
      S.settings.taxId ? 'IFU / NIF : ' + esc(S.settings.taxId) : ''
    ].filter(Boolean).join('<br>');

    const partnerLines = [
      '<strong>' + esc(partner.name || '—') + '</strong>',
      partner.contact ? esc(partner.contact) : '',
      partner.address ? esc(partner.address) : '',
      partner.phone ? 'Tél : ' + esc(partner.phone) : '',
      partner.email ? esc(partner.email) : ''
    ].filter(Boolean).join('<br>');

    const rowsHtml = doc.lines.map(function (l) {
      return '<tr>' +
        '<td>' + esc(l.description) + '</td>' +
        '<td class="num">' + L.formatNumber(l.qty, 0) + '</td>' +
        '<td class="num">' + esc(UI.money(l.unitPrice)) + '</td>' +
        '<td class="num">' + (l.discount ? l.discount + '%' : '—') + '</td>' +
        '<td class="num">' + esc(UI.money(L.lineNet(l, S.settings))) + '</td>' +
        '</tr>';
    }).join('');

    const paymentsHtml = (doc.payments && doc.payments.length)
      ? '<div class="print-payments"><h4>Paiements enregistrés</h4><table>' +
        doc.payments.map(function (p) {
          return '<tr><td>' + L.formatDate(p.date) + '</td><td>' + esc(p.method) + '</td><td>' + esc(p.note || '') + '</td><td class="num">' + esc(UI.money(p.amount)) + '</td></tr>';
        }).join('') +
        '<tr><td colspan="3"><strong>Reste dû</strong></td><td class="num"><strong>' + esc(UI.money(due)) + '</strong></td></tr>' +
        '</table></div>'
      : '';

    const html =
      '<div class="print-doc">' +
      '<div class="print-head">' +
      '<div>' + logo + '</div>' +
      '<div class="print-company">' + companyLines + '</div>' +
      '<div class="print-doc-type">' +
      '<div class="type">' + label.print + '</div>' +
      '<div class="num">N° ' + esc(doc.number) + '</div>' +
      '<div class="num">Date : ' + L.formatDate(doc.date) + '</div>' +
      (doc.dueDate ? '<div class="num">' + (mode === 'quote' ? 'Valable jusqu\u2019au : ' : 'Échéance : ') + L.formatDate(doc.dueDate) + '</div>' : '') +
      '</div>' +
      '</div>' +
      '<div class="print-parties">' +
      '<div class="party"><h4>' + (isPurchase ? 'Fournisseur' : 'Client') + '</h4><div class="box">' + partnerLines + '</div></div>' +
      '</div>' +
      '<table class="print-table">' +
      '<thead><tr><th style="width:46%">Description</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Remise</th><th class="num">Total HT</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<div class="print-totals">' +
      '<div class="letters">Arrêté le présent document à la somme de : <strong>' + esc(L.montantEnLettres(totals.total, S.settings)) + '</strong></div>' +
      '<table>' +
      '<tr><td>Sous-total HT</td><td class="num">' + esc(UI.money(totals.subtotal)) + '</td></tr>' +
      (totals.discountTotal ? '<tr><td>Remise</td><td class="num">−' + esc(UI.money(totals.discountTotal)) + '</td></tr>' : '') +
      '<tr><td>TVA (' + esc(doc.taxRate) + '%)</td><td class="num">' + esc(UI.money(totals.taxTotal)) + '</td></tr>' +
      '<tr class="grand"><td>TOTAL TTC</td><td class="num">' + esc(UI.money(totals.total)) + '</td></tr>' +
      '</table>' +
      '</div>' +
      paymentsHtml +
      (doc.notes ? '<div class="print-notes"><h4>Notes</h4>' + esc(doc.notes) + '</div>' : '') +
      '<div class="print-footer">' + esc(S.settings.invoiceFooter || '') + '<br>Document généré par COMPTABLOO — la comptabilité simple des PME.</div>' +
      '</div>';

    UI.printHTML(html);
  }

  /* ================================================================== */

  function h(tag, attrs) { return UI.h.apply(null, arguments); }

  root.COMPTA = root.COMPTA || {};
  root.COMPTA.docs = {
    openEditor: openEditor,
    openPayments: openPayments,
    openDetail: openDetail,
    printDoc: printDoc,
    PAYMENT_METHODS: PAYMENT_METHODS,
    DOC_LABELS: DOC_LABELS
  };
})(typeof window !== 'undefined' ? window : this);
