// Thin fetch wrapper with error handling and the { data, error } envelope.

const BASE = '';

async function request(method, path, body) {
  const init = {
    method,
    headers: { 'Accept': 'application/json' },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(BASE + path, init);
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    // non-JSON response
  }

  if (!response.ok) {
    const message = (payload && (payload.error || payload.detail)) || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  // FastAPI Envelope: { data, error } — return data if present, else raw payload.
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    if (payload.error) throw new Error(payload.error);
    return payload.data;
  }
  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  delete: (path) => request('DELETE', path),
};
