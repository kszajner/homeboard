# CLAUDE.md — Home Dashboard

Ten plik to **persistent context** dla Claude Code. Czytaj go w całości na początku każdej sesji. Zawiera specyfikację projektu, konwencje i etapy implementacji.

> **Krytyczne zasady (przeczytaj zanim cokolwiek napiszesz):**
> 1. **Buduj iteracyjnie**, etapami opisanymi w sekcji *Implementation Roadmap*. Nie skacz do przodu.
> 2. Po każdym etapie: **pokaż użytkownikowi co działa**, poczekaj na akceptację, dopiero potem następny.
> 3. **Pytaj** zanim dodasz zależność (bibliotekę), której nie ma w tym pliku.
> 4. **Nie wymyślaj featurów**, których tu nie ma. Jeśli czegoś brakuje — zapytaj.
> 5. **Polski język w UI** — wszystkie napisy widoczne dla użytkownika po polsku.

---

## 1. Kontekst projektu

**Co**: Self-hosted home dashboard — webowa aplikacja do montażu na ścianie (tablet) i przeglądania z telefonu/laptopa przez VPN.

**Dla kogo**: Domowe użycie (single-user, bez auth). Dostęp tylko z sieci LAN lub przez WireGuard VPN.

**Cel**: Jedno miejsce na:
- kalendarz (agregacja wielu iCloud `.ics`)
- tracker rachunków (cykliczne + jednorazowe + subskrypcje)
- prosty Kanban (jedna tablica, stałe kolumny: To Do / In Progress / Done)
- planer menu tygodniowego (obiady na 7 dni)
- widget pogody (Sopot)

**Środowisko docelowe**: Raspberry Pi 5 (8GB RAM, Debian 13), `/mnt/ssd/docker/dashboard/`, port `8089`, Docker Compose. Dostęp przez `http://192.168.1.32:8089` (LAN) lub `http://10.8.0.1:8089` (WireGuard).

**Open source**: Repo na GitHubie, licencja **MIT**. Dodaj `LICENSE`, `README.md`, `.gitignore`, `.env.example`.

**Workflow developmentu**: Cały kod piszemy lokalnie (na laptopie z Dockerem), testujemy lokalnie, dopiero potem `scp` na RPI i `docker compose up -d`.

---

## 2. Stack technologiczny

**Backend**
- Python 3.12+
- FastAPI + Uvicorn
- SQLAlchemy 2.x (async) + SQLite (plik `data/dashboard.db`)
- Alembic (migracje — przygotuj nawet jeśli zaczynamy od jednej)
- `icalendar` (parsowanie `.ics`)
- `httpx` (pobieranie `.ics` z iCloud, OpenMeteo API)
- `apscheduler` (cyklicze odświeżanie kalendarza co godzinę)
- `python-dotenv`

**Frontend**
- **Vanilla JavaScript** (ES modules, bez frameworka)
- Mały router własny (`router.js`, ~50 linii) lub Navigo jeśli wygodniej
- **SortableJS** — drag-and-drop Kanban (CDN lub npm)
- **CSS Custom Properties** (zmienne) — bez Tailwinda, bez Sass
- Czcionka **Inter** (self-hosted przez `@font-face`, nie z Google Fonts — privacy)

**Deployment**
- Docker Compose (produkcja: `docker-compose.yml`, dev: `docker-compose.dev.yml`)
- Multi-stage Dockerfile jeśli sensownie, ale priorytet to prostota
- `Makefile` z targetami: `dev`, `build`, `deploy-rpi`, `backup`, `restore`

**Brak**: TypeScript, React/Vue, Tailwind, build-stepy frontu (żadnego webpacka/vite dla MVP — wszystko statyczne pliki serwowane przez FastAPI).

---

## 3. Struktura katalogów

```
dashboard/
├── CLAUDE.md                    # ten plik
├── README.md                    # dla GitHuba — opis, screenshots, deploy
├── LICENSE                      # MIT
├── .gitignore                   # data/, .env, __pycache__/, *.db
├── .env.example                 # template — ICAL_URL_*, WEATHER_LAT, WEATHER_LON
├── docker-compose.yml           # produkcja (RPI)
├── docker-compose.dev.yml       # dev (hot-reload, volume mounty)
├── Dockerfile                   # backend image
├── Makefile                     # dev/deploy/backup
├── backend/
│   ├── main.py                  # FastAPI app + mount frontend
│   ├── config.py                # ładowanie .env, settings
│   ├── database.py              # SQLAlchemy engine, session
│   ├── models.py                # SQLAlchemy modele (Bill, KanbanCard, Menu, EventCache)
│   ├── schemas.py               # Pydantic schemas (request/response)
│   ├── scheduler.py             # APScheduler — odświeżanie .ics co godzinę
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── calendar.py          # GET /api/calendar/events, /api/calendar/month/{YYYY-MM}
│   │   ├── bills.py             # CRUD /api/bills
│   │   ├── kanban.py            # CRUD /api/kanban/cards
│   │   ├── menu.py              # GET/PUT /api/menu/week/{YYYY-WW}
│   │   └── weather.py           # GET /api/weather
│   ├── services/
│   │   ├── ical.py              # pobieranie + parsowanie .ics, cache w DB
│   │   └── weather.py           # OpenMeteo API client
│   ├── requirements.txt
│   └── alembic/                 # migracje
├── frontend/
│   ├── index.html               # entry point, sidebar + <main> wrapper
│   ├── manifest.json            # PWA manifest (przyda się później)
│   ├── css/
│   │   ├── tokens.css           # design tokens (kolory, spacing, typography)
│   │   ├── base.css             # reset, body, font
│   │   ├── layout.css           # sidebar, main grid
│   │   └── components/          # per-komponent
│   │       ├── calendar.css
│   │       ├── bills.css
│   │       ├── kanban.css
│   │       └── menu.css
│   ├── js/
│   │   ├── app.js               # bootstrap, router init
│   │   ├── router.js            # SPA routing
│   │   ├── api.js               # fetch wrapper (GET/POST/PUT/DELETE + error handling)
│   │   ├── state.js             # prosty store (jeden obiekt + subskrypcje)
│   │   ├── views/
│   │   │   ├── home.js          # strona główna (dashboard)
│   │   │   ├── kanban.js
│   │   │   └── menu.js
│   │   └── components/
│   │       ├── calendar-month.js
│   │       ├── today-tomorrow.js
│   │       ├── bills-widget.js
│   │       ├── weather-widget.js
│   │       └── modal.js
│   └── assets/
│       ├── fonts/Inter-*.woff2  # self-hosted
│       └── icons/               # SVG dla sidebaru
├── scripts/
│   ├── backup.sh                # dump SQLite + .env do tar.gz, rotacja 7 dni
│   └── deploy-rpi.sh            # rsync + ssh "docker compose up -d --build"
└── data/                        # gitignored — SQLite, cache, backupy
    ├── dashboard.db
    └── backups/
```

---

## 4. UI/UX — specyfikacja wizualna

### Design tokens (`css/tokens.css`)

```css
:root {
  /* Kolory */
  --color-bg: #ffffff;
  --color-surface: #f8f9fb;          /* tło kart, lekko offset od bg */
  --color-surface-hover: #f1f3f7;
  --color-border: #e5e7eb;
  --color-text: #111827;             /* główny tekst */
  --color-text-muted: #6b7280;       /* daty, opisy */
  --color-text-subtle: #9ca3af;

  --color-accent: #1e3a8a;           /* GRANATOWY — główny akcent */
  --color-accent-hover: #1e40af;
  --color-accent-light: #dbeafe;     /* tło zaznaczonego dnia, badge */
  --color-accent-on: #ffffff;        /* tekst na akcencie */

  --color-success: #059669;          /* zapłacone */
  --color-danger:  #dc2626;          /* zaległy rachunek, due dziś */
  --color-warning: #d97706;          /* due jutro */

  /* Typografia */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 22px;
  --font-size-2xl: 28px;
  --font-size-3xl: 36px;             /* duży zegar, temperatura */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  /* Shadow (lekkie, minimalistyczne) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06);

  /* Layout */
  --sidebar-width: 88px;
}
```

### Styl wizualny — zasady

- **Minimalizm w stylu Apple/iOS**: dużo białego, lekkie cienie, zaokrąglenia, ostre kontrasty tekstu (text na bg AAA gdzie się da).
- **Granat (`#1e3a8a`) jako akcent** — używany OSZCZĘDNIE: aktywna ikona w sidebarze, dzisiejszy dzień w kalendarzu, primary button, checkbox checked. Nie zalewaj kolorem — białe tło jest gwiazdą.
- **Granat na białym** — kontrast 12:1+ (WCAG AAA). Granat na granatowym tle jasnym (`--color-accent-light`) — tylko jako badge.
- **Nigdy granat jako tło dla długiego tekstu** — tylko akcenty.
- **Czcionka Inter**, weight 400/500/600. Self-hosted, 4 pliki `.woff2` w `assets/fonts/`.
- **Czytelność z dystansu (tablet na ścianie 1-2m)** — minimalne rozmiary fontów dla widgetów: `--font-size-lg` (18px). Zegar/temperatura: `--font-size-3xl`.
- **Bez emoji w UI** (chyba że ikona z biblioteki SVG). Bez gradientów. Bez animacji innych niż subtelne fade/transition (200ms).

### Layout — landscape tablet (1280×800 lub 1920×1200)

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │                                                          │
│  S   │                         MAIN AREA                        │
│  I   │                                                          │
│  D   │                                                          │
│  E   │                  (kontent zależny od route)              │
│  B   │                                                          │
│  A   │                                                          │
│  R   │                                                          │
│      │                                                          │
│ 88px │                                                          │
└──────┴──────────────────────────────────────────────────────────┘
```

**Sidebar** (zawsze widoczny, 88px szeroki, białe tło, prawa krawędź `--color-border` 1px):
- 4 ikony SVG pionowo, od góry: 🏠 Home, 📋 Kanban, 🍽 Menu, ⚙️ Settings (settings = placeholder, na razie pusty)
- Każda ikona = 56×56px klikalny obszar, ikona ~24×24px, podpis tekstowy pod ikoną (12px, polski: "Start", "Zadania", "Menu", "Ustawienia")
- Aktywna ikona: tło `--color-accent-light`, ikona/tekst `--color-accent`
- Hover: tło `--color-surface-hover`
- **Miejsce na rozszerzenie**: pod ikonami separator + sekcja "Inne narzędzia" (linki do HabitTrove/Paperless/Actual) — przygotuj kontener w HTML, ale **nie wypełniaj** w MVP. Komentarz `<!-- TODO: external services links -->`.

### Strona główna (`/`) — układ

Lewa połowa (50%): **Kalendarz miesięczny** (zajmuje całą wysokość).
Prawa połowa (50%): trzy widgety w kolumnie (pionowy stack):

```
┌──────────────────────────┬─────────────────────────────────────┐
│                          │   ┌─────────────────────────────┐   │
│                          │   │  POGODA (mała sekcja)       │   │
│                          │   │  duża temp, ikona, "Sopot"  │   │
│      KALENDARZ           │   └─────────────────────────────┘   │
│      MIESIĘCZNY          │                                     │
│      (cała wysokość)     │   ┌─────────────────────────────┐   │
│                          │   │  DZIŚ / JUTRO               │   │
│                          │   │  lista wydarzeń z godz.     │   │
│                          │   │  (kalendarzowych)           │   │
│                          │   └─────────────────────────────┘   │
│                          │                                     │
│                          │   ┌─────────────────────────────┐   │
│                          │   │  DO ZAPŁATY W TYM MIES.     │   │
│                          │   │  lista rachunków z checkbox │   │
│                          │   └─────────────────────────────┘   │
└──────────────────────────┴─────────────────────────────────────┘
```

### Komponenty — specyfikacja

**Kalendarz miesięczny**
- Header: nazwa miesiąca po polsku + rok (`maj 2026`), strzałki ‹ › do nawigacji, przycisk "Dziś"
- Grid 7×6 (pn-niedz, polski pierwszy dzień tygodnia = poniedziałek). Nazwy dni skrócone: Pn Wt Śr Cz Pt Sb Nd
- Każda komórka dnia: numer w górnym lewym rogu, poniżej **pełen mini-tekst wydarzeń** (jak Apple Calendar) — max 3 widoczne, dalej `+N więcej`
- Wydarzenie = mała "pigułka" `padding: 2px 6px`, font 12px, kolor tła zależny od kalendarza (z palety 8 kolorów; przypisanie po `calendar_name` z `.ics`)
- Dzień **dzisiejszy**: numer w kółku granatowym `--color-accent`, tekst biały
- Dni z poprzedniego/następnego miesiąca: numer w `--color-text-subtle`, bez wydarzeń lub wyszarzony
- **Kliknięcie na dzień** → modal z pełną listą wydarzeń tego dnia (godziny, tytuły, opisy, kalendarz źródłowy)
- **Brak edycji** — kalendarz jest read-only, dane z iCloud

**Widget pogody**
- Wysokość ~120px, środek prawej kolumny u góry
- Duża temperatura (3xl, np. "14°"), ikona pogodowa SVG po prawej (32×32px), pod spodem szare "Sopot" + skrócony opis (np. "częściowe zachmurzenie")
- Dane z **OpenMeteo API** (`https://api.open-meteo.com/v1/forecast?latitude=54.4418&longitude=18.5601&current=temperature_2m,weather_code`)
- Odświeżaj co 30 minut po stronie backendu, cache w pamięci (nie w DB)
- Mapowanie `weather_code` → SVG ikona (8-10 stanów: słońce, chmury, deszcz, burza, śnieg, mgła itd.)

**Widget Dziś/Jutro**
- Tytuł sekcji: "Dziś" (data wytłuszczona), poniżej lista wydarzeń (czas + tytuł)
- Separator, potem "Jutro" — to samo
- Tylko wydarzenia kalendarzowe (zgodnie z decyzją — rachunki są w osobnym widgecie poniżej)
- Brak wydarzeń: subtelny tekst "Brak wydarzeń"
- Klik na wydarzenie → modal z detalami (jak z kalendarza)

**Widget rachunków "Do zapłaty w tym miesiącu"**
- Lista wszystkich `Bill` z `due_date` w bieżącym miesiącu kalendarzowym, sortowane po dacie rosnąco
- Każdy wiersz: checkbox + tytuł + kwota (po prawej) + data (mniejsza, szara)
- Kliknięcie checkboxa = `PUT /api/bills/{id}` z `paid: true`, wiersz przekreślony i wyszarzony (przeniesiony na dół listy)
- Rachunek z `due_date` < dzisiaj i `paid=false` → tytuł w `--color-danger`
- Rachunek `due_date === today` → tytuł bold
- Pod listą przycisk "+ Dodaj rachunek" (prowadzi do modalu CRUD)
- Modal CRUD: pola **Tytuł, Kwota (PLN), Termin (date picker), Typ (cykliczny / jednorazowy / subskrypcja)**, dla cyklicznych dodatkowo "Powtarzaj co miesiąc?" (checkbox)
- **Cykliczne i subskrypcje**: po oznaczeniu `paid=true`, system automatycznie tworzy następny "egzemplarz" rachunku na +1 miesiąc od oryginalnego `due_date`. Zaimplementuj jako pole `template_id` (self-reference) lub osobny `BillTemplate` — wybierz prostsze (sugestia: `Bill.is_recurring=True` + `Bill.parent_id` żeby trackować łańcuch).

### Widok Kanban (`/kanban`)

- Header: tytuł "Zadania", po prawej `+ Nowa karta`
- 3 stałe kolumny obok siebie: **Do zrobienia / W trakcie / Zrobione**. Każda kolumna ma własną szerokość ~33%, scroll w pionie wewnątrz kolumny
- Karta: tytuł (semibold), opis (jeśli jest, max 2 linie ellipsis), due date jako mała etykieta na dole (granatowa jeśli > 2 dni, pomarańczowa = `--color-warning` jeśli jutro, czerwona = `--color-danger` jeśli dziś/po terminie)
- **Drag-and-drop**: SortableJS, działa na touch (tablet). Po przeniesieniu karty → `PUT /api/kanban/cards/{id}` z nową `column` i `position`
- Klik na kartę → modal edycji: Tytuł / Opis (textarea) / Due date / przycisk "Usuń"
- Nowa karta: modal, pola jak wyżej, domyślnie ląduje w "Do zrobienia"
- Brak: priorytetów, tagów, checklist, multi-board (tylko jedna tablica globalna)

### Widok Menu tygodniowe (`/menu`)

- Header: "Menu — tydzień {numer} ({pn} – {nd})", strzałki ‹ › do nawigacji po tygodniach (poprzedni / następny tydzień)
- 7 kart (pn, wt, śr, cz, pt, sb, nd) w siatce — landscape: 7 w rzędzie, ewentualnie 4+3 jeśli za wąsko
- Każda karta dnia: nazwa dnia + data, pole textarea "Obiad", pole textarea "Notatki" (mniejsze, opcjonalne)
- **Reset co poniedziałek**: każdy tydzień ma własny rekord (`week_start: YYYY-MM-DD`). Po przejściu na nowy tydzień (real time) pola są puste. Stare tygodnie są nadal w bazie — strzałka ‹ pozwala je obejrzeć.
- **Autozapis** — `PUT /api/menu/week/{YYYY-WW}` po blur lub debounce 1s

---

## 5. Model danych (SQLite)

```python
# backend/models.py — szkielet

class Bill(Base):
    id: int
    title: str
    amount: float            # PLN
    due_date: date
    paid: bool = False
    paid_at: datetime | None
    bill_type: str           # 'one_time' | 'recurring' | 'subscription'
    is_recurring: bool       # True dla recurring i subscription
    parent_id: int | None    # FK na poprzedni rachunek w łańcuchu
    created_at: datetime

class KanbanCard(Base):
    id: int
    title: str
    description: str | None
    column: str              # 'todo' | 'in_progress' | 'done'
    position: int            # kolejność w kolumnie (do sortowania)
    due_date: date | None
    created_at: datetime
    updated_at: datetime

class MenuWeek(Base):
    id: int
    week_start: date         # poniedziałek danego tygodnia, UNIQUE
    monday_lunch: str
    monday_notes: str
    tuesday_lunch: str
    tuesday_notes: str
    # ... wt-nd
    sunday_lunch: str
    sunday_notes: str
    updated_at: datetime
    # Alternatywa: tabela MenuDay (week_start, day_of_week, lunch, notes) — wybierz tę, która prościej

class CachedEvent(Base):
    """Cache wydarzeń z .ics — żeby przeżyć offline iCloud."""
    id: int
    uid: str                 # UID z .ics
    calendar_name: str       # nazwa kalendarza źródłowego
    title: str
    description: str | None
    location: str | None
    start: datetime
    end: datetime
    all_day: bool
    fetched_at: datetime     # kiedy ostatnio odświeżone
```

**Backup**: skrypt `scripts/backup.sh` wykonuje `sqlite3 dashboard.db ".backup data/backups/dashboard-YYYYMMDD-HHMM.db"`, gzipuje, rotuje (zostaw 7 ostatnich). Uruchamiany przez **cron na RPI** (nie w kontenerze) — przykład crontaba w README.

---

## 6. API endpoints

```
GET    /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
GET    /api/calendar/month/{YYYY-MM}             # wszystkie eventy danego miesiąca
GET    /api/calendar/status                      # ostatnie odświeżenie .ics, success/error

GET    /api/bills                                # ?month=YYYY-MM albo wszystkie
POST   /api/bills
GET    /api/bills/{id}
PUT    /api/bills/{id}
DELETE /api/bills/{id}

GET    /api/kanban/cards                         # wszystkie z 3 kolumn
POST   /api/kanban/cards
PUT    /api/kanban/cards/{id}                    # zmiana kolumny/position/treści
DELETE /api/kanban/cards/{id}

GET    /api/menu/week/{YYYY-WW}                  # iso week
PUT    /api/menu/week/{YYYY-WW}                  # upsert

GET    /api/weather                              # current dla Sopotu
```

**Response shape**: zawsze `{ "data": ..., "error": null }` lub `{ "data": null, "error": "..." }`. Konsekwentnie.

**Error handling iCloud**:
- Jeśli `httpx` failuje przy pobraniu `.ics`: nie czyść cache, zostaw poprzednie eventy, ustaw flagę `is_stale=True` w response `/api/calendar/status`.
- Frontend: jeśli `status.is_stale === true`, pokaż **banner u góry**: `"⚠ Brak połączenia z iCloud — wyświetlam ostatnie znane wydarzenia (zaktualizowano: {data})"`. Banner zamykalny (×).

---

## 7. Konwencje kodu

**Backend (Python)**
- Type hints WSZĘDZIE (`def foo(x: int) -> str:`)
- Pydantic schemas dla request/response — nie zwracaj modeli ORM bezpośrednio
- Async wszędzie gdzie się da (FastAPI, SQLAlchemy 2.x async, httpx)
- Routes w `routes/`, logika biznesowa w `services/`, nie mieszać
- Konfiguracja przez `pydantic-settings` (klasa `Settings` w `config.py`)
- Loguj przez `logging` (nie print), format `[%(asctime)s] %(levelname)s %(name)s: %(message)s`
- `ruff` jako linter + formatter (config w `pyproject.toml`)

**Frontend (Vanilla JS)**
- ES modules (`import`/`export`), nie CommonJS
- Brak globalnych zmiennych poza `window.app` (jeśli już musi być)
- Komponenty jako funkcje zwracające DOM lub HTML string + binding eventów po `appendChild`
- State management: jeden obiekt `state` w `state.js` z funkcją `subscribe(callback)` — prosty pub/sub
- Fetch przez `api.js` — wrapper z error handlingiem, JSON parsing, optimistic updates gdzie sensownie
- Brak inline event handlerów w HTML (`onclick="..."`). Wszystko przez `addEventListener`
- Każdy JS plik ma na górze komentarz `// What this module does — one line`

**CSS**
- BEM-ish (`.calendar`, `.calendar__day`, `.calendar__day--today`) — czytelne i bez kolizji
- Wszystkie kolory/spacingi/fonty wyłącznie z `tokens.css` przez `var(--...)`. **Nigdy hardkodowane wartości**.
- Mobile-first NIE — jesteśmy tablet/desktop first. Media query dla mniejszych breakpointów dodajemy później.

**Wspólne**
- Commity: konwencjonalne (`feat:`, `fix:`, `chore:`, `docs:`)
- Komentarze tylko tam, gdzie kod nie tłumaczy się sam. Nie komentuj oczywistego.
- Brak `TODO` w commitach bez kontekstu — jeśli zostawiasz TODO, opisz w issue na GitHubie

---

## 8. Implementation roadmap (etapy)

> **Każdy etap = osobna sesja Claude Code z wyraźnym `STOP` na końcu.** Po każdym etapie: zatrzymaj się, podsumuj co zostało zrobione, poczekaj na akceptację użytkownika przed następnym.

### Etap 0 — Inicjalizacja repo (5 min użytkownika)

User wykona ręcznie:
- `git init`, dodaj remote
- Skopiuj `.env.example` → `.env`, wypełnij `ICAL_URL_*`, `WEATHER_LAT`, `WEATHER_LON`

### Etap 1 — Szkielet backendu + Docker dev

**Cel**: postawić FastAPI na `localhost:8089` w trybie dev, return `{"status": "ok"}` na `GET /api/health`.

**Robisz**:
1. `backend/main.py` z `/api/health`
2. `backend/config.py` (pydantic-settings)
3. `Dockerfile` + `docker-compose.dev.yml` (volume mount backendu, `--reload`)
4. `Makefile` z `make dev`
5. `.gitignore`, `.env.example`, `README.md` (na razie placeholder)

**Walidacja**: `make dev` → `curl localhost:8089/api/health` → `{"status":"ok"}`

**STOP. Pokaż użytkownikowi, poczekaj na akceptację.**

### Etap 2 — Baza danych + modele + Alembic

1. `database.py` (async engine, sessionmaker)
2. `models.py` (wszystkie 4 modele)
3. Konfiguracja Alembic, pierwsza migracja (`alembic revision --autogenerate -m "initial"`)
4. Endpoint `/api/health` rozszerz — sprawdza też że DB odpowiada

**Walidacja**: `make dev` startuje, baza się tworzy, `data/dashboard.db` istnieje.

**STOP.**

### Etap 3 — Integracja kalendarza .ics + cache + scheduler

1. `services/ical.py` — pobierz `.ics` z URL, parsuj `icalendar`, zwróć listę wydarzeń
2. Obsługa wielu URL z `.env` (ICAL_URL_1, ICAL_URL_2, ...) — czytaj wszystkie env z prefixem `ICAL_URL_`
3. Zapis do `CachedEvent` (upsert po `uid`)
4. `scheduler.py` — APScheduler, job co godzinę, na starcie też raz
5. Endpoint `GET /api/calendar/events?from=...&to=...` + `GET /api/calendar/month/{YYYY-MM}` + `GET /api/calendar/status`
6. Error handling — jeśli któryś URL failuje, NIE czyść cache, log warning, flaga `is_stale`

**Walidacja**: `/api/calendar/month/2026-05` zwraca eventy z prawdziwych iCloud-ów.

**STOP.**

### Etap 4 — Frontend szkielet: sidebar + routing + strona główna pusta

1. `index.html` — sidebar (4 ikony placeholder), główny obszar
2. `css/tokens.css`, `css/base.css`, `css/layout.css` — z designu wyżej
3. Self-hosted Inter (`assets/fonts/Inter-*.woff2`, pobrane z https://rsms.me/inter/)
4. `js/router.js`, `js/app.js`, `js/api.js`, `js/state.js`
5. Routes: `/`, `/kanban`, `/menu` — wszystkie pokazują "Soon" na razie
6. FastAPI mount `StaticFiles` na `/` z `frontend/`

**Walidacja**: w przeglądarce `localhost:8089` widać sidebar i prawą część z napisem "Strona główna — soon". Kliknięcie ikon zmienia route.

**STOP.**

### Etap 5 — Kalendarz miesięczny (widok główny — lewa połowa)

1. `components/calendar-month.js` — generuje grid, fetch `/api/calendar/month/...`
2. Pigułki wydarzeń, kolory per kalendarz (deterministyczne mapowanie nazwa → kolor z palety 8)
3. Modal po kliknięciu w dzień (`components/modal.js` — uniwersalny)
4. Nawigacja miesiącami, przycisk "Dziś"
5. Banner offline gdy `status.is_stale`

**Walidacja**: prawdziwe wydarzenia z iCloud się wyświetlają.

**STOP.**

### Etap 6 — Widgety prawej kolumny: pogoda + dziś/jutro

1. `services/weather.py` — OpenMeteo, cache w pamięci (30 min)
2. `routes/weather.py`, `GET /api/weather`
3. `components/weather-widget.js` — temperatura, ikona (SVG inline lub z `assets/icons/weather/`)
4. `components/today-tomorrow.js` — fetch eventów dla dziś i jutro, render listy z godzinami

**Walidacja**: widget pogody pokazuje aktualną temp dla Sopotu, dziś/jutro pokazuje eventy.

**STOP.**

### Etap 7 — Rachunki: model + CRUD + widget

1. Endpoints `/api/bills` (GET listy z filtrem month, POST, PUT, DELETE)
2. Logika auto-tworzenia kolejnego egzemplarza dla `is_recurring=True` po `paid=true`
3. `components/bills-widget.js` — lista, checkbox, sortowanie
4. Modal CRUD (re-use `components/modal.js`)

**Walidacja**: dodanie/oznaczenie/edycja rachunku działa, recurring tworzą następny po opłaceniu.

**STOP.**

### Etap 8 — Kanban (widok `/kanban`)

1. Endpoints `/api/kanban/cards`
2. `views/kanban.js` — 3 kolumny, render kart
3. Integracja SortableJS, persist position+column do API
4. Modal edycji karty
5. Due date kolorystyka

**Walidacja**: drag-and-drop działa na desktopie i na tablecie (touch).

**STOP.**

### Etap 9 — Menu tygodniowe (widok `/menu`)

1. Endpoint `/api/menu/week/{YYYY-WW}` (GET + PUT upsert)
2. `views/menu.js` — grid 7 dni, textarea z debounced autozapisem
3. Nawigacja między tygodniami
4. Reset visualny w poniedziałek — wystarczy że nowy week_start = pusty rekord

**Walidacja**: edycja zapisuje się, przełączanie tygodni działa, w poniedziałek pola są puste.

**STOP.**

### Etap 10 — Polish + produkcja

1. `docker-compose.yml` produkcyjny (bez volume mountów kodu, build image)
2. `scripts/backup.sh` + przykład crontaba w README
3. `scripts/deploy-rpi.sh` (rsync + ssh restart)
4. `Makefile` targety: `build`, `deploy-rpi`, `backup`, `restore`
5. `README.md` pełny: opis, screenshots placeholder, instalacja, deploy, zmienne `.env`, troubleshooting
6. `LICENSE` (MIT)
7. Sprawdzenie końcowe: czysty build, brak warningów, lighthouse score na frontendzie

**Walidacja**: `make deploy-rpi` na świeżym RPI startuje dashboard.

**STOP. DONE.**

---

## 9. Gotchas, ograniczenia, decyzje

- **iCloud `.ics` URLs**: format `https://p09-caldav.icloud.com/published/.../...ics`. Można też `webcal://` — backend musi rozpoznać i zamienić na `https://`.
- **iCloud może rate-limitować** — odświeżanie co godzinę powinno być bezpieczne, częściej nie. Loguj failed fetches z exponential backoff (nie hammeruj).
- **SQLite + async** — używaj `aiosqlite` driver, `sqlalchemy.ext.asyncio`. Bez tego async FastAPI + sync SQLite = deadlock risk.
- **Daty i strefy czasowe**: cały backend operuje w **Europe/Warsaw**. Eventy z `.ics` w UTC — konwertuj przy zapisie do cache. Frontend wyświetla zawsze lokalnie.
- **Tablet kiosk**: aplikacja będzie wyświetlana w Fully Kiosk Browser na Androidzie. **Bez auth = bez sesji = bez ciasteczek do problemu**. Ale: nie używaj `localStorage` dla nic krytycznego (kiosk czasem czyści).
- **Czcionka Inter** — pobierz z https://rsms.me/inter/ wersje `Inter-Regular.woff2`, `Inter-Medium.woff2`, `Inter-SemiBold.woff2`. Self-hosted, brak Google Fonts (privacy).
- **OpenMeteo nie wymaga klucza API** — darmowe, ale nie spam (1 req/30min wystarczy).
- **Multi-user/auth jest poza scope MVP**, ale: nie pisz kodu który by to uniemożliwił. Struktura DB powinna pozwolić dodanie `user_id` w przyszłości bez refactoru.
- **Eksponowanie**: kontener słucha na `8089`. **Nie eksponuj na zewnątrz**. WireGuard ma już dostęp do całego LAN-u — wystarczy.

---

## 10. Komendy (cheat sheet)

```bash
# Development
make dev                       # docker-compose -f docker-compose.dev.yml up
make logs                      # docker-compose logs -f
make shell                     # docker exec -it dashboard /bin/bash
make migrate                   # alembic upgrade head
make migration name="..."      # alembic revision --autogenerate -m "..."

# Produkcja / deploy
make build                     # docker build
make deploy-rpi                # rsync + ssh restart na 192.168.1.32

# Backup / restore
make backup                    # dump SQLite + .env do data/backups/
make restore file=backup.tar.gz

# Lint
ruff check backend/
ruff format backend/
```

---

## 11. Kontekst dla Ciebie, Claude Code

**Środowisko developera**:
- Laptop z Linuksem, Docker zainstalowany
- Praca lokalnie, push do GitHuba, deploy na RPI przez `scp/rsync + ssh`
- RPI ma już Docker, WireGuard, kilka usług (Paperless 8087, Actual 8088, HabitTrove 8085, Wger 8086). Port **8089** jest **wolny i zarezerwowany** dla dashboardu.
- **Nie ruszaj innych usług na RPI**. Operuj wyłącznie w `/mnt/ssd/docker/dashboard/`.

**Styl pracy ze mną (developerem)**:
- Mówię po polsku. Odpowiadaj po polsku w komentarzach do mnie, ale **kod, komentarze w kodzie, nazwy zmiennych, commit messages — po angielsku** (open source!).
- Lubię konkrety. Nie pisz "ten kod robi X" — pokaż diff i powiedz co się zmieniło.
- Jeśli coś nie pasuje (np. wymyślona biblioteka, gotcha, której nie znałeś) — **zatrzymaj się i zapytaj**, nie zgaduj.
- Po każdym etapie pokaż **co dokładnie się dzieje** — `curl`, screenshot opis, output.
- Nie generuj 2000 linii naraz. Wolę 200 linii × 10 razy z weryfikacją niż 2000 raz.

**Czego NIE rób**:
- Nie dodawaj uwierzytelniania, użytkowników, JWT — to MVP single-user
- Nie dodawaj Reacta/Vue/Tailwinda — decyzja świadoma
- Nie używaj Google Fonts CDN ani innych zewnętrznych CDN-ów (privacy) — wyjątek: SortableJS może być z jsDelivr lub bundle lokalnie
- Nie pisz testów w MVP (Etap 1-9). Testy dopiero w Etapie 10 albo po MVP — to świadoma decyzja
- Nie kombinuj z PWA, service workers, offline mode — to po MVP
- Nie eksponuj portów poza `8089` lokalnie

---

**Ostatnia rzecz przed startem każdej sesji**: jeśli to pierwsza sesja, zacznij od Etapu 1 i powiedz "Zaczynam Etap 1 — szkielet backendu". Jeśli już coś istnieje, zorientuj się w `frontend/` i `backend/` (ls + krótki view) i powiedz na którym etapie jesteśmy i co dalej.

Powodzenia.
