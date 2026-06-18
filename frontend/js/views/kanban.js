// Kanban view — 3 fixed columns with SortableJS drag-and-drop and subtasks.

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

// --- Subtasks UI inside the card edit modal -------------------------------

function buildSubtaskRow(subtask, { onToggle, onRename, onDelete }) {
  const row = document.createElement('li');
  row.className = 'subtask' + (subtask.done ? ' subtask--done' : '');
  row.dataset.id = String(subtask.id);
  row.innerHTML = `
    <input type="checkbox" class="subtask__check" ${subtask.done ? 'checked' : ''} aria-label="Oznacz jako zrobione" />
    <input type="text" class="subtask__input" />
    <button type="button" class="subtask__delete" aria-label="Usuń">×</button>
  `;
  const check = row.querySelector('.subtask__check');
  const input = row.querySelector('.subtask__input');
  const del = row.querySelector('.subtask__delete');

  input.value = subtask.title;

  check.addEventListener('change', () => onToggle(check.checked));
  input.addEventListener('blur', () => {
    const v = input.value.trim();
    if (v && v !== subtask.title) onRename(v);
    else if (!v) input.value = subtask.title;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });
  del.addEventListener('click', onDelete);

  return row;
}

function buildSubtasksSection(card, { onChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'subtasks';
  wrapper.innerHTML = `
    <label class="form-field" style="margin: 0;">
      <span class="muted" style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); display:block; margin-bottom: var(--space-2);">Podzadania</span>
    </label>
    <ul class="subtasks__list"></ul>
    <div class="subtasks__add">
      <input type="text" placeholder="Dodaj podzadanie..." />
      <button type="button" class="subtasks__add-btn">Dodaj</button>
    </div>
  `;

  const list = wrapper.querySelector('.subtasks__list');
  const newInput = wrapper.querySelector('.subtasks__add input');
  const addBtn = wrapper.querySelector('.subtasks__add-btn');

  let subtasks = [...(card.subtasks || [])];

  function repaint() {
    list.innerHTML = '';
    for (const st of subtasks) {
      list.appendChild(
        buildSubtaskRow(st, {
          onToggle: async (done) => {
            try {
              const updated = await api.put(`/api/kanban/subtasks/${st.id}`, { done });
              Object.assign(st, updated);
              repaint();
              onChange?.(subtasks);
            } catch (err) {
              alert(`Błąd: ${err.message}`);
            }
          },
          onRename: async (title) => {
            try {
              const updated = await api.put(`/api/kanban/subtasks/${st.id}`, { title });
              Object.assign(st, updated);
              onChange?.(subtasks);
            } catch (err) {
              alert(`Błąd: ${err.message}`);
            }
          },
          onDelete: async () => {
            try {
              await api.delete(`/api/kanban/subtasks/${st.id}`);
              subtasks = subtasks.filter((s) => s.id !== st.id);
              repaint();
              onChange?.(subtasks);
            } catch (err) {
              alert(`Błąd: ${err.message}`);
            }
          },
        })
      );
    }
  }

  async function addNew() {
    const title = newInput.value.trim();
    if (!title) return;
    try {
      const created = await api.post(`/api/kanban/cards/${card.id}/subtasks`, { title });
      subtasks.push(created);
      newInput.value = '';
      repaint();
      onChange?.(subtasks);
      newInput.focus();
    } catch (err) {
      alert(`Błąd: ${err.message}`);
    }
  }

  addBtn.addEventListener('click', addNew);
  newInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addNew(); }
  });

  repaint();
  return wrapper;
}

// --- Card form ------------------------------------------------------------

function cardForm({ initial = {}, onSubmit, onDelete, extraSection }) {
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-field">
      <label for="card-title">Tytuł</label>
      <input id="card-title" type="text" required maxlength="200" />
    </div>
    <div class="form-field">
      <label for="card-desc">Opis</label>
      <textarea id="card-desc" rows="3"></textarea>
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

  if (extraSection) {
    form.insertBefore(extraSection, form.querySelector('.form-actions'));
  }

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

// --- Main view ------------------------------------------------------------

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
      <div class="kanban-card__meta"></div>
      <div class="kanban-card__progress" hidden><div class="kanban-card__progress-fill"></div></div>
    `;
    el.querySelector('.kanban-card__title').textContent = card.title;

    const descEl = el.querySelector('.kanban-card__desc');
    if (card.description) {
      descEl.textContent = card.description;
    } else {
      descEl.remove();
    }

    const meta = el.querySelector('.kanban-card__meta');

    const due = parseDateOnly(card.due_date);
    if (due) {
      const dueEl = document.createElement('span');
      dueEl.className = 'kanban-card__due';
      const extra = dueClass(due, today);
      if (extra) dueEl.classList.add(extra);
      dueEl.textContent = formatDueLabel(due);
      meta.appendChild(dueEl);
    }

    const subtasks = card.subtasks || [];
    if (subtasks.length > 0) {
      const done = subtasks.filter((s) => s.done).length;
      const total = subtasks.length;
      const allDone = done === total;

      const badge = document.createElement('span');
      badge.className = 'kanban-card__subtasks' + (allDone ? ' kanban-card__subtasks--done' : '');
      badge.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${done}/${total}</span>
      `;
      meta.appendChild(badge);

      const progress = el.querySelector('.kanban-card__progress');
      const fill = progress.querySelector('.kanban-card__progress-fill');
      progress.hidden = false;
      fill.style.width = `${Math.round((done / total) * 100)}%`;
    }

    if (!meta.children.length) meta.remove();

    el.addEventListener('click', () => openEditModal(card));
    return el;
  }

  async function handleDragEnd(evt) {
    const cardEl = evt.item;
    const newColumnEl = evt.to;
    const newColumn = newColumnEl.dataset.column;
    const cardId = Number(cardEl.dataset.id);

    const siblings = Array.from(newColumnEl.querySelectorAll('.kanban-card'));
    const updates = siblings.map((el, idx) => ({
      id: Number(el.dataset.id),
      position: idx + 1,
    }));

    try {
      await api.put(`/api/kanban/cards/${cardId}`, {
        column: newColumn,
        position: updates.find((u) => u.id === cardId)?.position ?? 1,
      });
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
    // Subtasks live as their own little API surface — changes there persist
    // immediately, so we just need to refresh the board after the modal closes.
    let subtasksTouched = false;

    const subtasksSection = buildSubtasksSection(card, {
      onChange: () => { subtasksTouched = true; },
    });

    const { form, cancelBtn } = cardForm({
      initial: card,
      extraSection: subtasksSection,
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
    cancelBtn.addEventListener('click', async () => {
      modalRef?.close();
      if (subtasksTouched) await load();
    });

    const modalRef = openModal({ title: 'Edytuj kartę', content: form });
  }

  mount.querySelector('#kanban-add').addEventListener('click', openCreateModal);

  await load();
}
