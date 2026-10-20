export const RANGES = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '180d', label: 'Last 6 months' },
  { value: 'all', label: 'All time' },
];

export function rangeLabel(range) {
  return RANGES.find((r) => r.value === range)?.label || 'All time';
}

export function rangeCutoff(range) {
  if (!range || range === 'all') return null;
  const days = Number(String(range).replace('d', ''));
  if (!Number.isFinite(days)) return null;
  return new Date(Date.now() - days * 86400000).toISOString();
}

export function filterSeries(series, range, key = 'date') {
  const cut = rangeCutoff(range);
  if (!cut) return series || [];
  const out = (series || []).filter((p) => new Date(p[key]) >= new Date(cut));
  return out.length >= 2 ? out : series || [];
}

// Mirrors the server-side period bucketing so range filters line up with the API.
export function periodKeyClient(dateStr, kind) {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (kind === 'monthly') return `${y}-${m}`;
  if (kind === 'daily') return `${y}-${m}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function filterPeriods(list, range, kind) {
  const cut = rangeCutoff(range);
  if (!cut) return list || [];
  const cutKey = periodKeyClient(cut, kind);
  return (list || []).filter((p) => p.key >= cutKey);
}
