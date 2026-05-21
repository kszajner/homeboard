// Weather widget — big temperature, icon, city, condition.

import { api } from '../api.js';

const ICONS = {
  'clear': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>`,
  'mostly-clear': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="3"/><path d="M10 2v2M16 4l-1.41 1.41M2 10h2M18 10h2M3.93 3.93l1.41 1.41"/>
      <path d="M22 18a4 4 0 0 0-7.78-1.34A4 4 0 1 0 13 22h7a2 2 0 0 0 2-2 2 2 0 0 0 0-2z"/>
    </svg>`,
  'partly-cloudy': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="8" r="3"/>
      <path d="M20 18a4 4 0 0 0-7.78-1.34A4 4 0 1 0 11 22h7a2 2 0 0 0 2-2 2 2 0 0 0 0-2z"/>
    </svg>`,
  'cloudy': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 18a4 4 0 0 0-7.78-1.34A4 4 0 1 0 11 22h7a2 2 0 0 0 2-2 2 2 0 0 0 0-2z"/>
    </svg>`,
  'rain': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 14a4 4 0 0 0-7.78-1.34A4 4 0 1 0 11 18h7a2 2 0 0 0 2-2 2 2 0 0 0 0-2z"/>
      <path d="M8 19l-1 3M13 19l-1 3M18 19l-1 3"/>
    </svg>`,
  'drizzle': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 14a4 4 0 0 0-7.78-1.34A4 4 0 1 0 11 18h7a2 2 0 0 0 2-2 2 2 0 0 0 0-2z"/>
      <path d="M9 20v1M14 20v1M19 20v1"/>
    </svg>`,
  'snow': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 14a4 4 0 0 0-7.78-1.34A4 4 0 1 0 11 18h7a2 2 0 0 0 2-2 2 2 0 0 0 0-2z"/>
      <path d="M8 20h.01M12 22h.01M16 20h.01"/>
    </svg>`,
  'thunderstorm': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 14a4 4 0 0 0-7.78-1.34A4 4 0 1 0 11 18h7a2 2 0 0 0 2-2 2 2 0 0 0 0-2z"/>
      <polyline points="13 16 11 20 14 20 12 23"/>
    </svg>`,
  'fog': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 10h18M3 14h18M3 18h18"/>
    </svg>`,
  'unknown': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
    </svg>`,
};

export async function createWeatherWidget(container) {
  container.innerHTML = `<div class="card placeholder">Ładowanie pogody…</div>`;
  try {
    const data = await api.get('/api/weather');
    const temp = data.temperature != null ? Math.round(data.temperature) : '—';
    const icon = ICONS[data.icon] || ICONS.unknown;
    container.innerHTML = `
      <div class="card weather">
        <div class="weather__main">
          <div class="weather__temp">${temp}°</div>
          <div class="weather__icon" aria-hidden="true">${icon}</div>
        </div>
        <div class="weather__meta">
          <div class="weather__city">${data.city || ''}</div>
          <div class="weather__desc muted">${data.description || ''}</div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card placeholder">Brak danych pogodowych: ${err.message}</div>`;
  }
}
