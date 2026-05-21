// Home page — calendar on the left, weather/today-tomorrow/bills on the right.

import { createCalendarMonth } from '../components/calendar-month.js';
import { createWeatherWidget } from '../components/weather-widget.js';
import { createTodayTomorrow } from '../components/today-tomorrow.js';
import { createBillsWidget } from '../components/bills-widget.js';

export function renderHome(mount) {
  mount.innerHTML = `
    <div class="home">
      <section class="home__left">
        <div id="calendar-month"></div>
      </section>
      <section class="home__right">
        <div id="weather"></div>
        <div id="today-tomorrow"></div>
        <div id="bills"></div>
      </section>
    </div>
  `;

  createCalendarMonth(mount.querySelector('#calendar-month'));
  createWeatherWidget(mount.querySelector('#weather'));
  createTodayTomorrow(mount.querySelector('#today-tomorrow'));
  createBillsWidget(mount.querySelector('#bills'));
}
