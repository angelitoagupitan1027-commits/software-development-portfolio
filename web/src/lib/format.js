export const DEFAULT_FX = 58.5;

export function toCurrency(phpValue, currency = 'PHP', fx = DEFAULT_FX) {
  if (phpValue == null || Number.isNaN(Number(phpValue))) return null;
  const v = Number(phpValue);
  return currency === 'USDT' ? v / (fx || DEFAULT_FX) : v;
}

export function money(phpValue, currency = 'PHP', fx = DEFAULT_FX, decimals = 2) {
  const v = toCurrency(phpValue, currency, fx);
  if (v == null) return '—';
  const body = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = v < 0 ? '-' : '';
  return currency === 'USDT' ? `${sign}${body} USDT` : `${sign}₱${body}`;
}

export function signedMoney(phpValue, currency = 'PHP', fx = DEFAULT_FX) {
  const v = toCurrency(phpValue, currency, fx);
  if (v == null) return '—';
  const body = money(Math.abs(Number(phpValue)), currency, fx);
  return `${v >= 0 ? '+' : '-'}${body}`;
}

export function pct(value, decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value) >= 0 ? '' : ''}${Number(value).toFixed(decimals)}%`;
}

export function signedPct(value, decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const v = Number(value);
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

export function num(value, decimals = 4) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function shortDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(iso) {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'never';
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const signClass = (v) => (v == null ? '' : Number(v) > 0 ? 'pos' : Number(v) < 0 ? 'neg' : '');
