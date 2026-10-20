async function handle(res) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const opts = (method, body) => ({
  method,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  get: (path) => fetch(path, { credentials: 'include' }).then(handle),
  post: (path, body) => fetch(path, opts('POST', body)).then(handle),
  put: (path, body) => fetch(path, opts('PUT', body)).then(handle),
  del: (path) => fetch(path, opts('DELETE')).then(handle),
  download: async (path) => {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return res.blob();
  },
};
