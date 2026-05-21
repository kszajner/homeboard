// Kanban view — 3 fixed columns with SortableJS drag-and-drop.

import { api } from '../api.js';
import { openModal } from './../components/modal.js';

const COLUMNS = [
  { key: 'todo', label: 'Do zrobienia' },
  { key: 'in_progress', label: 'W trakcie' },
  { key: 'done', label: 'Zrobione' },
];

const SORTABLE_CDN = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js';

function pad2(n) { return String(n).padStart(2, '0'); }

function parseDateOnly(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDueLabel(date) {
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function dueClass(dueDate, today) {
  if (!dueDate) return null;
  const diffDays = Math.round((dueDate - today) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'kanban-card__due--danger';
  if (diffDays === 0) return 'kanban-card__due--danger';
  if (diffDays === 1) return 'kanban-card__due--warning';
  return null;
}

async function ensureSortable() {
  if (window.Sortable) return window.Sortable;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SORTABLE_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = SORTABLE_CDN;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.Sortable;
}

function cardForm({ initial = {}, onSubmit, onDelete }) {
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-field">
      <label for="card-title">Tytuł</label>
      <input id="card-title" type="text" required maxlength="200" />
    </div>
    <div class="form-field">
      <label for="card-desc">Opis</label>
      <textarea id="card-desc" rows="4"></textarea>
    </div>
    <div class="form-field">
      <label for="card-due">Termin</label>
      <input id="card-due" type="date" />
    </div>
    <div class="form-actions"></div>
  `;

  form.querySelector('#card-title').value = initial.title || '';
  form.querySelector('#card-desc').value = initial.description || '';
  form.querySelector('#card-due').value = initial.due_date || '';

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
    onSubmit({
      title: form.querySelector('#card-title').value.trim(),
      description: form.querySelector('#card-desc').value.trim() || null,
      due_date: form.querySelector('#card-due').value || null,
    });
  });

  return { form, cancelBtn };
}

export async function renderKanban(mount) {
  mount.innerHTML = `
    <div class="kanban__header">
      <h1>Zadania</h1>
      <button type="button" class="btn btn--primary" id="kanban-add">+ Nowa karta</button>
    </div>
    <div class="kanban__board" id="kanban-board"></div>
  `;

  const board = mount.querySelector('#kanban-board');
  const Sortable = await ensureSortable();
  const today = todayLocal();

  async function load() {
    board.innerHTML = `<div class="card placeholder">Ładowanie…</div>`;
    let cards = [];
    try {
      cards = await api.get('/api/kanban/cards') || [];
    } catch (err) {
      board.innerHTML = `<div class="card placeholder">Błąd: ${err.message}</div>`;
      return;
    }

    const byColumn = new Map(COLUMNS.map((c) => [c.key, []]));
    for (const card of cards) {
      if (byColumn.has(card.column)) byColumn.get(card.column).push(card);
    }
    for (const list of byColumn.values()) {
      list.sort((a, b) => a.position - b.position);
    }

    board.innerHTML = '';
    for (const col of COLUMNS) {
      const list = byColumn.get(col.key) || [];
      const columnEl = document.createElement('div');
      columnEl.className = 'kanban__column';
      columnEl.dataset.column = col.key;
      columnEl.innerHTML = `
        <div class="kanban__column-header">
          <span class="kanban__column-title">${col.label}</span>
          <span class="kanban__count">${list.length}</span>
        </div>
        <div class="kanban__cards" data-column="${col.key}"></div>
      `;
      const cardsEl = columnEl.querySelector('.kanban__cards');

      for (const card of list) {
        cardsEl.appendChild(buildCardEl(card));
      }

      Sortable.create(cardsEl, {
        group: 'kanban',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: handleDragEnd,
      });

      board.appendChild(columnEl);
    }
  }

  function buildCardEl(card) {
    const el = document.createElement('div');
    el.className = 'kanban-card';
    el.dataset.id = String(card.id);
    el.innerHTML = `
      <div class="kanban-card__title"></div>
      <div class="kanban-card__desc"></div>
      <div class="kanban-card__due-wrapper"></div>
    `;
    el.querySelector('.kanban-card__title').textContent = card.title;
    const descEl = el.querySelector('.kanban-card__desc');
    if (card.description) {
      descEl.textContent = card.description;
    } else {
      descEl.remove();
    }
    const dueWrap = el.querySelector('.kanban-card__due-wrapper');
    const due = parseDateOnly(card.due_date);
    if (due) {
      const dueEl = document.createElement('span');
      dueEl.className = 'kanban-card__due';
      const extra = dueClass(due, today);
      if (extra) dueEl.classList.add(extra);
      dueEl.textContent = formatDueLabel(due);
      dueWrap.appendChild(dueEl);
    } else {
      dueWrap.remove();
    }
    el.addEventListener('click', () => openEditModal(card));
    return el;
  }

  async function handleDragEnd(evt) {
    const cardEl = evt.item;
    const newColumnEl = evt.to;
    const newColumn = newColumnEl.dataset.column;
    const cardId = Number(cardEl.dataset.id);

    // Recompute positions for every card in the target column.
    const siblings = Array.from(newColumnEl.querySelectorAll('.kanban-card'));
    const updates = siblings.map((el, idx) => ({
      id: Number(el.dataset.id),
      position: idx + 1,
    }));

    try {
      // First the moved card (so its column is updated too).
      await api.put(`/api/kanban/cards/${cardId}`, {
        column: newColumn,
        position: updates.find((u) => u.id === cardId)?.position ?? 1,
      });
      // Then the rest of the column gets re-positioned.
      await Promise.all(
        updates
          .filter((u) => u.id !== cardId)
          .map((u) => api.put(`/api/kanban/cards/${u.id}`, { position: u.position }))
      );
    } catch (err) {
      alert(`Nie udało się zapisać zmiany: ${err.message}`);
      await load();
    }
  }

  function openCreateModal() {
    const { form, cancelBtn } = cardForm({
      onSubmit: async (data) => {
        try {
          await api.post('/api/kanban/cards', { ...data, column: 'todo' });
          modalRef?.close();
          await load();
        } catch (err) {
          alert(`Błąd: ${err.message}`);
        }
      },
    });
    cancelBtn.addEventListener('click', () => modalRef?.close());
    const modalRef = openModal({ title: 'Nowa karta', content: form });
  }

  function openEditModal(card) {
    const { form, cancelBtn } = cardForm({
      initial: card,
      onSubmit: async (data) => {
        try {
          await api.put(`/api/kanban/cards/${card.id}`, data);
          modalRef?.close();
          await load();
        } catch (err) {
          alert(`Błąd: ${err.message}`);
        }
      },
      onDelete: async () => {
        if (!confirm(`Usunąć "${card.title}"?`)) return;
        try {
          await api.delete(`/api/kanban/cards/${card.id}`);
          modalRef?.close();
          await load();
        } catch (err) {
          alert(`Błąd: ${err.message}`);
        }
      },
    });
    cancelBtn.addEventListener('click', () => modalRef?.close());
    const modalRef = openModal({ title: 'Edytuj kartę', content: form });
  }

  mount.querySelector('#kanban-add').addEventListener('click', openCreateModal);

  await load();
}
