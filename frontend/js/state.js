// Minimal pub/sub store. One object, subscribers fire on every patch.

const subscribers = new Set();

export const state = {
  route: location.hash.slice(1) || '/',
  calendarStatus: null,
};

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of subscribers) {
    try { fn(state); } catch (err) { console.error(err); }
  }
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
