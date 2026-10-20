import crypto from 'node:crypto';

// Read-only OKX Spot integration scaffold.
// Secrets are only ever read from the server environment and never returned to the client.

export function okxCredentials() {
  const key = process.env.OKX_API_KEY;
  const secret = process.env.OKX_API_SECRET;
  const passphrase = process.env.OKX_API_PASSPHRASE;
  if (!key || !secret || !passphrase) return null;
  return { key, secret, passphrase };
}

export function okxConfigured() {
  return Boolean(okxCredentials());
}

export function maskKey(key) {
  if (!key) return null;
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function sign(timestamp, method, requestPath, body, secret) {
  const message = `${timestamp}${method.toUpperCase()}${requestPath}${body || ''}`;
  return crypto.createHmac('sha256', secret).update(message).digest('base64');
}

export async function okxRequest(requestPath, method = 'GET', body = '') {
  const creds = okxCredentials();
  if (!creds) {
    const err = new Error('OKX API credentials are not configured on the server.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const timestamp = new Date().toISOString();
  const base = process.env.OKX_BASE_URL || 'https://www.okx.com';
  const headers = {
    'OK-ACCESS-KEY': creds.key,
    'OK-ACCESS-SIGN': sign(timestamp, method, requestPath, body, creds.secret),
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': creds.passphrase,
    'Content-Type': 'application/json',
  };
  if (process.env.OKX_SIMULATED === '1') headers['x-simulated-trading'] = '1';

  const res = await fetch(base + requestPath, { method, headers, body: body || undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.code && json.code !== '0')) {
    const err = new Error((json && (json.msg || `OKX error ${json.code}`)) || `HTTP ${res.status}`);
    err.code = 'OKX_ERROR';
    throw err;
  }
  return json;
}

// Read-only account balance. Never requests trading or withdrawal scopes.
export async function fetchBalances() {
  const json = await okxRequest('/api/v5/account/balance');
  const details = json?.data?.[0]?.details || [];
  return details
    .map((d) => ({ currency: d.ccy, available: Number(d.availBal || 0), equity: Number(d.eq || 0) }))
    .filter((d) => d.equity > 0);
}
