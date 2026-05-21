// Tiny hash-based SPA router. Routes are exact-match paths.

const routes = new Map();
let notFound = () => null;
let onChange = () => {};

export function register(path, handler) {
  routes.set(path, handler);
}

export function setNotFound(handler) {
  notFound = handler;
}

export function onRouteChange(cb) {
  onChange = cb;
}

export function currentPath() {
  return location.hash.slice(1) || '/';
}

export function navigate(path) {
  if (currentPath() === path) {
    render();
  } else {
    location.hash = path;
  }
}

export function render() {
  const path = currentPath();
  const handler = routes.get(path) || notFound;
  const mount = document.getElementById('main');
  if (!mount) return;
  mount.innerHTML = '';
  const result = handler(mount);
  if (result instanceof Promise) {
    result.catch((err) => {
      console.error(err);
      mount.innerHTML = `<div class="placeholder">Błąd: ${err.message}</div>`;
    });
  }
  onChange(path);
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
