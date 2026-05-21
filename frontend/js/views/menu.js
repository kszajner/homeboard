// Weekly menu view — 7 day cards, debounced autosave.

import { api } from '../api.js';

const DAYS = [
  { key: 'monday',    label: 'Poniedziałek' },
  { key: 'tuesday',   label: 'Wtorek' },
  { key: 'wednesday', label: 'Środa' },
  { key: 'thursday',  label: 'Czwartek' },
  { key: 'friday',    label: 'Piątek' },
  { key: 'saturday',  label: 'Sobota' },
  { key: 'sunday',    label: 'Niedziela' },
];

function pad2(n) { return String(n).padStart(2, '0'); }

function isoWeek(date) {
  // ISO week number, returns [year, week]. Standard algorithm.
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target - firstThursday) / 86400000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return [target.getUTCFullYear(), week];
}

function mondayOf(date) {
  const dayNum = (date.getDay() + 6) % 7;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayNum);
  return d;
}

function formatShortDate(d) {
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export async function renderMenu(mount) {
  let monday = mondayOf(new Date());

  function weekKey() {
    const [y, w] = isoWeek(monday);
    return `${y}-${pad2(w)}`;
  }

  function weekRangeLabel() {
    const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return `${formatShortDate(monday)} – ${formatShortDate(end)}`;
  }

  let payload = {};
  let saveTimer = null;
  let saveStatus = null;
  let currentLoadToken = 0;

  function buildScaffold() {
    mount.innerHTML = `
      <div class="menu__header">
        <div>
          <h1 class="menu__title">Menu — tydzień <span id="menu-week-num"></span></h1>
          <div class="muted" id="menu-week-range"></div>
        </div>
        <div class="menu__nav">
          <button type="button" class="menu__nav-btn" data-action="prev" aria-label="Poprzedni tydzień">‹</button>
          <button type="button" class="menu__nav-btn" data-action="today" aria-label="Bieżący tydzień">•</button>
          <button type="button" class="menu__nav-btn" data-action="next" aria-label="Następny tydzień">›</button>
          <span class="menu__save-status" id="menu-save-status"></span>
        </div>
      </div>
      <div class="menu__grid" id="menu-grid"></div>
    `;
    saveStatus = mount.querySelector('#menu-save-status');
    mount.querySelector('[data-action="prev"]').addEventListener('click', () => {
      monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
      load();
    });
    mount.querySelector('[data-action="next"]').addEventListener('click', () => {
      monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
      load();
    });
    mount.querySelector('[data-action="today"]').addEventListener('click', () => {
      monday = mondayOf(new Date());
      load();
    });
  }

  function paint() {
    const [, week] = isoWeek(monday);
    mount.querySelector('#menu-week-num').textContent = String(week);
    mount.querySelector('#menu-week-range').textContent = weekRangeLabel();

    const grid = mount.querySelector('#menu-grid');
    grid.innerHTML = '';
    const today = new Date();

    DAYS.forEach((day, idx) => {
      const dayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      const isToday = sameLocalDay(dayDate, today);

      const dayEl = document.createElement('div');
      dayEl.className = 'menu-day' + (isToday ? ' menu-day--today' : '');
      dayEl.innerHTML = `
        <div class="menu-day__header">
          <span class="menu-day__name">${day.label}</span>
          <span class="menu-day__date">${formatShortDate(dayDate)}</span>
        </div>
        <div class="menu-day__field">
          <label class="menu-day__label" for="lunch-${day.key}">Obiad</label>
          <textarea id="lunch-${day.key}" data-field="${day.key}_lunch" rows="2"></textarea>
        </div>
        <div class="menu-day__field">
          <label class="menu-day__label" for="notes-${day.key}">Notatki</label>
          <textarea id="notes-${day.key}" data-field="${day.key}_notes" class="menu-day__notes" rows="2"></textarea>
        </div>
      `;
      const lunch = dayEl.querySelector(`[data-field="${day.key}_lunch"]`);
      const notes = dayEl.querySelector(`[data-field="${day.key}_notes"]`);
      lunch.value = payload[`${day.key}_lunch`] || '';
      notes.value = payload[`${day.key}_notes`] || '';

      [lunch, notes].forEach((el) => {
        el.addEventListener('input', () => {
          const field = el.dataset.field;
          payload[field] = el.value;
          scheduleSave();
        });
        el.addEventListener('blur', flushSave);
      });

      grid.appendChild(dayEl);
    });
  }

  function setStatus(text) {
    if (saveStatus) saveStatus.textContent = text;
  }

  function scheduleSave() {
    setStatus('Zapisywanie…');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 1000);
  }

  async function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      const body = {};
      for (const day of DAYS) {
        body[`${day.key}_lunch`] = payload[`${day.key}_lunch`] || '';
        body[`${day.key}_notes`] = payload[`${day.key}_notes`] || '';
      }
      const saved = await api.put(`/api/menu/week/${weekKey()}`, body);
      payload = saved;
      setStatus('Zapisano');
      setTimeout(() => setStatus(''), 1500);
    } catch (err) {
      setStatus(`Błąd: ${err.message}`);
    }
  }

  async function load() {
    const token = ++currentLoadToken;
    setStatus('Ładowanie…');
    try {
      const data = await api.get(`/api/menu/week/${weekKey()}`);
      if (token !== currentLoadToken) return; // a newer load started
      payload = data || {};
      setStatus('');
      paint();
    } catch (err) {
      setStatus(`Błąd: ${err.message}`);
    }
  }

  buildScaffold();
  await load();
}
