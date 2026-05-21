// Bills due this month — checkbox to mark paid, modal CRUD.

import { api } from '../api.js';
import { openModal } from './modal.js';

function pad2(n) { return String(n).padStart(2, '0'); }

function todayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateOnly(s) {
  // 'YYYY-MM-DD' → local Date at midnight
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatPLN(amount) {
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency', currency: 'PLN', maximumFractionDigits: 2,
    }).format(amount);
  } catch (_) {
    return `${amount} zł`;
  }
}

function formatShortDate(d) {
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function billForm({ initial = {}, onSubmit, onDelete }) {
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-field">
      <label for="bill-title">Tytuł</label>
      <input id="bill-title" name="title" type="text" required maxlength="200" />
    </div>
    <div class="form-field">
      <label for="bill-amount">Kwota (PLN)</label>
      <input id="bill-amount" name="amount" type="number" min="0" step="0.01" required />
    </div>
    <div class="form-field">
      <label for="bill-due">Termin</label>
      <input id="bill-due" name="due_date" type="date" required />
    </div>
    <div class="form-field">
      <label for="bill-type">Typ</label>
      <select id="bill-type" name="bill_type">
        <option value="one_time">jednorazowy</option>
        <option value="recurring">cykliczny</option>
        <option value="subscription">subskrypcja</option>
      </select>
    </div>
    <label class="form-checkbox">
      <input id="bill-recurring" type="checkbox" name="is_recurring" />
      Powtarzaj co miesiąc
    </label>
    <div class="form-actions"></div>
  `;

  form.querySelector('#bill-title').value = initial.title || '';
  form.querySelector('#bill-amount').value = initial.amount ?? '';
  form.querySelector('#bill-due').value = initial.due_date
    || new Date().toISOString().slice(0, 10);
  form.querySelector('#bill-type').value = initial.bill_type || 'one_time';
  form.querySelector('#bill-recurring').checked = !!initial.is_recurring;

  const actions = form.querySelector('.form-actions');
  if (onDelete) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--danger';
    delBtn.textContent = 'Usuń';
    delBtn.addEventListener('click', onDelete);
    actions.appendChild(delBtn);
  }
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Anuluj';
  actions.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Zapisz';
  actions.appendChild(saveBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: form.querySelector('#bill-title').value.trim(),
      amount: parseFloat(form.querySelector('#bill-amount').value),
      due_date: form.querySelector('#bill-due').value,
      bill_type: form.querySelector('#bill-type').value,
      is_recurring: form.querySelector('#bill-recurring').checked,
    };
    onSubmit(data);
  });

  return { form, cancelBtn };
}

export async function createBillsWidget(container) {
  async function load() {
    container.innerHTML = `<div class="card placeholder">Ładowanie rachunków…</div>`;
    let bills = [];
    try {
      bills = await api.get(`/api/bills?month=${currentMonthKey()}`) || [];
    } catch (err) {
      container.innerHTML = `<div class="card placeholder">Błąd: ${err.message}</div>`;
      return;
    }

    const today = todayLocal();

    // Sort: unpaid first by due date, paid at bottom by due date.
    bills.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      return a.due_date.localeCompare(b.due_date);
    });

    const card = document.createElement('div');
    card.className = 'card bills';
    card.innerHTML = `
      <div class="bills__header">
        <h3>Do zapłaty</h3>
        <button type="button" class="bills__add">+ Dodaj rachunek</button>
      </div>
      <ul class="bills__list"></ul>
      <div class="bills__empty muted" hidden>Brak rachunków w tym miesiącu.</div>
    `;

    const list = card.querySelector('.bills__list');

    if (bills.length === 0) {
      card.querySelector('.bills__empty').hidden = false;
    }

    for (const bill of bills) {
      const due = parseDateOnly(bill.due_date);
      const isToday = due.getTime() === today.getTime();
      const isOverdue = !bill.paid && due < today;

      const li = document.createElement('li');
      li.className = 'bill-row'
        + (bill.paid ? ' bill-row--paid' : '')
        + (isOverdue ? ' bill-row--overdue' : '')
        + (isToday && !bill.paid ? ' bill-row--today' : '');

      li.innerHTML = `
        <input type="checkbox" class="bill-row__check" ${bill.paid ? 'checked' : ''} aria-label="Oznacz jako zapłacone" />
        <div class="bill-row__main">
          <div class="bill-row__title"></div>
          <div class="bill-row__due"></div>
        </div>
        <div class="bill-row__amount"></div>
      `;
      li.querySelector('.bill-row__title').textContent = bill.title;
      li.querySelector('.bill-row__due').textContent = formatShortDate(due);
      li.querySelector('.bill-row__amount').textContent = formatPLN(bill.amount);

      const checkbox = li.querySelector('.bill-row__check');
      checkbox.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api.put(`/api/bills/${bill.id}`, { paid: checkbox.checked });
          await load();
        } catch (err) {
          alert(`Nie udało się zapisać: ${err.message}`);
          checkbox.checked = !checkbox.checked;
        }
      });

      li.querySelector('.bill-row__main').addEventListener('click', () => {
        openEditModal(bill);
      });

      list.appendChild(li);
    }

    card.querySelector('.bills__add').addEventListener('click', () => openCreateModal());

    container.innerHTML = '';
    container.appendChild(card);
  }

  function openCreateModal() {
    const { form, cancelBtn } = billForm({
      onSubmit: async (data) => {
        try {
          await api.post('/api/bills', data);
          modalRef?.close();
          await load();
        } catch (err) {
          alert(`Błąd: ${err.message}`);
        }
      },
    });
    cancelBtn.addEventListener('click', () => modalRef?.close());
    const modalRef = openModal({ title: 'Nowy rachunek', content: form });
  }

  function openEditModal(bill) {
    const { form, cancelBtn } = billForm({
      initial: bill,
      onSubmit: async (data) => {
        try {
          await api.put(`/api/bills/${bill.id}`, data);
          modalRef?.close();
          await load();
        } catch (err) {
          alert(`Błąd: ${err.message}`);
        }
      },
      onDelete: async () => {
        if (!confirm(`Usunąć "${bill.title}"?`)) return;
        try {
          await api.delete(`/api/bills/${bill.id}`);
          modalRef?.close();
          await load();
        } catch (err) {
          alert(`Błąd: ${err.message}`);
        }
      },
    });
    cancelBtn.addEventListener('click', () => modalRef?.close());
    const modalRef = openModal({ title: 'Edytuj rachunek', content: form });
  }

  await load();
}
