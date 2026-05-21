// Monthly calendar grid — fetches events, paints pills, opens day modal.

import { api } from '../api.js';
import { openModal } from './modal.js';

const MONTH_NAMES_PL = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

const WEEKDAY_SHORT_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

// 8-color palette for calendar pills. Deterministic mapping by name.
const CALENDAR_PALETTE = [
  { bg: '#dbeafe', fg: '#1e3a8a' }, // blue
  { bg: '#dcfce7', fg: '#14532d' }, // green
  { bg: '#fef3c7', fg: '#78350f' }, // amber
  { bg: '#fee2e2', fg: '#7f1d1d' }, // red
  { bg: '#ede9fe', fg: '#4c1d95' }, // violet
  { bg: '#cffafe', fg: '#155e75' }, // cyan
  { bg: '#fce7f3', fg: '#831843' }, // pink
  { bg: '#e0e7ff', fg: '#3730a3' }, // indigo
];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorFor(calendarName) {
  return CALENDAR_PALETTE[hashString(calendarName || 'default') % CALENDAR_PALETTE.length];
}

function pad2(n) { return String(n).padStart(2, '0'); }

function ymKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function isoDateOnly(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Build the 6×7 grid that starts on Monday and contains the given year/month.
function buildGridDays(year, month) {
  const first = new Date(year, month, 1);
  // 0 = Sun … 6 = Sat → convert to Mon=0 … Sun=6
  const dayOfWeek = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - dayOfWeek);
  const days = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

// Group fetched events by local YYYY-MM-DD. All-day events may span multiple days.
function groupEventsByDay(events) {
  const map = new Map();
  for (const ev of events) {
    // Backend stores naive UTC; the +'Z' parses as UTC and Date converts to local.
    const startUtc = new Date(ev.start + 'Z');
    const endUtc = new Date(ev.end + 'Z');

    const cursor = new Date(startUtc.getFullYear(), startUtc.getMonth(), startUtc.getDate());
    const endLocal = new Date(endUtc.getFullYear(), endUtc.getMonth(), endUtc.getDate());

    // For multi-day all-day events, iCal end is exclusive; for timed events
    // include the day they end on if it differs from start.
    while (cursor <= endLocal) {
      const key = isoDateOnly(cursor);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...ev, _start: startUtc, _end: endUtc });
      cursor.setDate(cursor.getDate() + 1);

      // Cap multi-day expansion to a reasonable length.
      if (map.size > 500) break;
    }
  }
  // Sort each day by start time.
  for (const list of map.values()) {
    list.sort((a, b) => a._start - b._start);
  }
  return map;
}

function renderDayModal(dateObj, events) {
  const titleStr = dateObj.toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const wrapper = document.createElement('div');
  if (!events || events.length === 0) {
    wrapper.innerHTML = `<p class="muted">Brak wydarzeń.</p>`;
  } else {
    for (const ev of events) {
      const time = ev.all_day
        ? 'Cały dzień'
        : `${formatTime(ev._start)}–${formatTime(ev._end)}`;
      const item = document.createElement('div');
      item.className = 'event-item';
      item.innerHTML = `
        <div class="event-item__time">${time}</div>
        <div class="event-item__body">
          <div class="event-item__title"></div>
          <div class="event-item__meta">
            <span class="event-item__calendar"></span>
            <span class="event-item__location"></span>
          </div>
          <div class="event-item__desc muted"></div>
        </div>
      `;
      item.querySelector('.event-item__title').textContent = ev.title || '(bez tytułu)';
      item.querySelector('.event-item__calendar').textContent = ev.calendar_name || '';
      const locEl = item.querySelector('.event-item__location');
      locEl.textContent = ev.location ? ` · ${ev.location}` : '';
      const descEl = item.querySelector('.event-item__desc');
      if (ev.description) {
        descEl.textContent = ev.description;
        descEl.style.marginTop = '4px';
      }
      wrapper.appendChild(item);
    }
  }

  openModal({ title: titleStr, content: wrapper });
}

export function createCalendarMonth(container) {
  let viewDate = new Date();
  viewDate.setDate(1);
  let eventsByDay = new Map();

  async function load() {
    container.innerHTML = `<div class="card placeholder">Ładowanie kalendarza…</div>`;
    try {
      const ym = ymKey(viewDate);
      const events = await api.get(`/api/calendar/month/${ym}`);
      eventsByDay = groupEventsByDay(events || []);
      paint();
    } catch (err) {
      container.innerHTML = `<div class="card placeholder">Nie udało się pobrać wydarzeń: ${err.message}</div>`;
    }
  }

  function paint() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();

    const days = buildGridDays(year, month);
    const monthLabel = `${MONTH_NAMES_PL[month]} ${year}`;

    container.innerHTML = `
      <div class="card calendar">
        <div class="calendar__header">
          <h2 class="calendar__title">${monthLabel}</h2>
          <div class="calendar__nav">
            <button type="button" class="calendar__nav-btn" data-action="prev" aria-label="Poprzedni miesiąc">‹</button>
            <button type="button" class="calendar__today-btn" data-action="today">Dziś</button>
            <button type="button" class="calendar__nav-btn" data-action="next" aria-label="Następny miesiąc">›</button>
          </div>
        </div>
        <div class="calendar__weekdays">
          ${WEEKDAY_SHORT_PL.map((d) => `<div class="calendar__weekday">${d}</div>`).join('')}
        </div>
        <div class="calendar__grid"></div>
      </div>
    `;

    const grid = container.querySelector('.calendar__grid');

    for (const date of days) {
      const isOtherMonth = date.getMonth() !== month;
      const isToday = sameDay(date, today);
      const key = isoDateOnly(date);
      const events = eventsByDay.get(key) || [];

      const cell = document.createElement('div');
      cell.className = 'calendar__day'
        + (isOtherMonth ? ' calendar__day--other-month' : '')
        + (isToday ? ' calendar__day--today' : '');
      cell.dataset.date = key;

      const numberEl = document.createElement('div');
      numberEl.className = 'calendar__day-number';
      numberEl.textContent = String(date.getDate());
      cell.appendChild(numberEl);

      const eventsEl = document.createElement('div');
      eventsEl.className = 'calendar__events';

      const visible = events.slice(0, 3);
      for (const ev of visible) {
        const pill = document.createElement('div');
        const c = colorFor(ev.calendar_name);
        pill.className = 'calendar__pill';
        pill.style.backgroundColor = c.bg;
        pill.style.color = c.fg;
        const prefix = ev.all_day ? '' : `${formatTime(ev._start)} `;
        pill.textContent = prefix + (ev.title || '(bez tytułu)');
        pill.title = ev.title || '';
        eventsEl.appendChild(pill);
      }
      if (events.length > 3) {
        const more = document.createElement('div');
        more.className = 'calendar__more';
        more.textContent = `+${events.length - 3} więcej`;
        eventsEl.appendChild(more);
      }
      cell.appendChild(eventsEl);

      cell.addEventListener('click', () => renderDayModal(date, events));
      grid.appendChild(cell);
    }

    container.querySelector('[data-action="prev"]').addEventListener('click', () => {
      viewDate = new Date(year, month - 1, 1);
      load();
    });
    container.querySelector('[data-action="next"]').addEventListener('click', () => {
      viewDate = new Date(year, month + 1, 1);
      load();
    });
    container.querySelector('[data-action="today"]').addEventListener('click', () => {
      const now = new Date();
      viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
      load();
    });
  }

  load();
  return { reload: load };
}
