// Bootstrap: register routes, wire sidebar active-state, start the router.

import { register, setNotFound, start, onRouteChange } from './router.js';
import { api } from './api.js';
import { setState } from './state.js';
import { renderHome } from './views/home.js';
import { renderKanban } from './views/kanban.js';
import { renderMenu } from './views/menu.js';
import { renderSettings } from './views/settings.js';

register('/', renderHome);
register('/kanban', renderKanban);
register('/menu', renderMenu);
register('/settings', renderSettings);

setNotFound((mount) => {
  mount.innerHTML = `<div class="placeholder">Nieznana strona</div>`;
});

function syncSidebar(path) {
  document.querySelectorAll('.sidebar__item').forEach((el) => {
    const route = el.getAttribute('data-route');
    el.classList.toggle('is-active', route === path);
  });
}

onRouteChange(syncSidebar);

// Offline banner driven by /api/calendar/status.
const banner = document.getElementById('offline-banner');
const bannerText = banner?.querySelector('.offline-banner__text');
const bannerClose = banner?.querySelector('.offline-banner__close');

let bannerDismissed = false;
bannerClose?.addEventListener('click', () => {
  bannerDismissed = true;
  banner.hidden = true;
});

function formatTimestamp(iso) {
  if (!iso) return 'nieznany czas';
  try {
    return new Date(iso).toLocaleString('pl-PL');
  } catch (_) {
    return iso;
  }
}

async function refreshCalendarStatus() {
  try {
    const status = await api.get('/api/calendar/status');
    setState({ calendarStatus: status });
    if (banner && status?.is_stale && !bannerDismissed) {
      bannerText.textContent =
        `⚠ Brak połączenia z iCloud — wyświetlam ostatnie znane wydarzenia ` +
        `(zaktualizowano: ${formatTimestamp(status.last_success_at)})`;
      banner.hidden = false;
    } else if (banner) {
      banner.hidden = true;
    }
  } catch (err) {
    console.warn('Calendar status failed:', err);
  }
}

start();
refreshCalendarStatus();
setInterval(refreshCalendarStatus, 5 * 60 * 1000);
