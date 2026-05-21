// "Today / Tomorrow" widget — calendar events for today and tomorrow.

import { api } from '../api.js';
import { openModal } from './modal.js';

function pad2(n) { return String(n).padStart(2, '0'); }

function isoDateOnly(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function eventsForDay(allEvents, dayLocal) {
  const out = [];
  for (const ev of allEvents) {
    const startUtc = new Date(ev.start + 'Z');
    const endUtc = new Date(ev.end + 'Z');
    // Event occupies the day if [start,end] intersects this local day.
    const dayStart = new Date(dayLocal.getFullYear(), dayLocal.getMonth(), dayLocal.getDate());
    const dayEnd = new Date(dayLocal.getFullYear(), dayLocal.getMonth(), dayLocal.getDate() + 1);
    if (endUtc > dayStart && startUtc < dayEnd) {
      out.push({ ...ev, _start: startUtc, _end: endUtc });
    }
  }
  out.sort((a, b) => a._start - b._start);
  return out;
}

function renderEventDetail(ev) {
  const wrapper = document.createElement('div');
  const time = ev.all_day ? 'Cały dzień' : `${formatTime(ev._start)}–${formatTime(ev._end)}`;
  wrapper.innerHTML = `
    <div class="event-item__time">${time}</div>
    <div class="event-item__body">
      <div class="event-item__title"></div>
      <div class="event-item__meta"></div>
      <div class="event-item__desc muted"></div>
    </div>
  `;
  wrapper.querySelector('.event-item__title').textContent = ev.title || '(bez tytułu)';
  wrapper.querySelector('.event-item__meta').textContent =
    [ev.calendar_name, ev.location].filter(Boolean).join(' · ');
  if (ev.description) {
    wrapper.querySelector('.event-item__desc').textContent = ev.description;
  }
  openModal({ title: ev.title || '(bez tytułu)', content: wrapper });
}

export async function createTodayTomorrow(container) {
  container.innerHTML = `<div class="card placeholder">Ładowanie wydarzeń…</div>`;
  try {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const after = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    const events = await api.get(
      `/api/calendar/events?from=${isoDateOnly(today)}&to=${isoDateOnly(after)}`
    );

    const todayEvents = eventsForDay(events || [], today);
    const tomorrowEvents = eventsForDay(events || [], tomorrow);

    const card = document.createElement('div');
    card.className = 'card today-tomorrow';

    const dateFmt = (d) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });

    card.innerHTML = `
      <h3>Dziś <span class="muted">· ${dateFmt(today)}</span></h3>
      <ul class="today-tomorrow__list" data-section="today"></ul>
      <h3 style="margin-top: var(--space-4);">Jutro <span class="muted">· ${dateFmt(tomorrow)}</span></h3>
      <ul class="today-tomorrow__list" data-section="tomorrow"></ul>
    `;

    const fill = (ul, list) => {
      if (!list.length) {
        const li = document.createElement('li');
        li.className = 'subtle';
        li.textContent = 'Brak wydarzeń';
        ul.appendChild(li);
        return;
      }
      for (const ev of list) {
        const li = document.createElement('li');
        const time = ev.all_day ? 'Cały dzień' : formatTime(ev._start);
        li.innerHTML = `<span class="today-tomorrow__time"></span><span class="today-tomorrow__title"></span>`;
        li.querySelector('.today-tomorrow__time').textContent = time;
        li.querySelector('.today-tomorrow__title').textContent = ev.title || '(bez tytułu)';
        li.addEventListener('click', () => renderEventDetail(ev));
        ul.appendChild(li);
      }
    };

    fill(card.querySelector('[data-section="today"]'), todayEvents);
    fill(card.querySelector('[data-section="tomorrow"]'), tomorrowEvents);

    container.innerHTML = '';
    container.appendChild(card);
  } catch (err) {
    container.innerHTML = `<div class="card placeholder">Nie udało się pobrać wydarzeń: ${err.message}</div>`;
  }
}
