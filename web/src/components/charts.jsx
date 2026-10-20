import { EmptyState } from './ui.jsx';

const W = 640;

function scale(values, height, pad) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.abs(max) || 1;
  return (v) => pad.t + (1 - (v - min) / range) * (height - pad.t - pad.b);
}

export function LineChart({ data, height = 230, formatValue = (v) => v, color = 'var(--accent)', fill = true }) {
  const points = (data || []).filter((d) => d && Number.isFinite(Number(d.y)));
  if (points.length < 2) {
    return <EmptyState title="Not enough data to chart" desc="Add records or market prices to build this series." />;
  }
  const pad = { l: 6, r: 6, t: 14, b: 22 };
  const y = scale(points.map((p) => Number(p.y)), height, pad);
  const x = (i) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(Number(p.y)).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height - pad.b} L${x(0).toFixed(1)},${height - pad.b} Z`;
  const gid = `g-${Math.abs(points.length * 31 + Math.round(Number(points[0].y)))}`;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${height}`} height={height} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + f * (height - pad.t - pad.b)}
            y2={pad.t + f * (height - pad.t - pad.b)}
            stroke="rgba(148,176,214,0.10)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {fill && <path d={area} fill={`url(#${gid})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="row between" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
        <span>{first.x}</span>
        <span>
          {formatValue(Number(first.y))} → <strong style={{ color: 'var(--text-2)' }}>{formatValue(Number(last.y))}</strong>
        </span>
        <span>{last.x}</span>
      </div>
    </div>
  );
}

export function BarChart({ data, height = 230, formatValue = (v) => v, posColor = 'var(--pos)', negColor = 'var(--neg)' }) {
  const points = (data || []).filter((d) => d && Number.isFinite(Number(d.value)));
  if (points.length === 0) {
    return <EmptyState title="No data for this period" desc="Add records to see this breakdown." />;
  }
  const pad = { l: 6, r: 6, t: 16, b: 30 };
  const values = points.map((p) => Number(p.value));
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const yOf = (v) => pad.t + (1 - (v - min) / range) * (height - pad.t - pad.b);
  const zeroY = yOf(0);
  const slot = (W - pad.l - pad.r) / points.length;
  const barW = Math.max(3, Math.min(slot * 0.62, 46));

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${height}`} height={height} preserveAspectRatio="none" role="img">
        <line x1={pad.l} x2={W - pad.r} y1={zeroY} y2={zeroY} stroke="rgba(148,176,214,0.28)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const v = Number(p.value);
          const cx = pad.l + slot * i + slot / 2;
          const y = yOf(v);
          const top = Math.min(y, zeroY);
          const h = Math.max(Math.abs(y - zeroY), 1.5);
          return (
            <rect
              key={`${p.label}-${i}`}
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={h}
              rx="3"
              fill={v >= 0 ? posColor : negColor}
              opacity="0.92"
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 6, fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
        {points.map((p, i) => (
          <span key={`${p.label}-lbl-${i}`} style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${p.label}: ${formatValue(p.value)}`}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 190, formatValue = (v) => v }) {
  const points = (data || []).filter((d) => Number(d.value) > 0);
  const total = points.reduce((a, d) => a + Number(d.value), 0);
  if (points.length === 0 || total <= 0) {
    return <EmptyState title="No allocation to display" desc="Holdings or priced positions are required." />;
  }
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="row wrap" style={{ gap: 18, alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Allocation">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {points.map((p, i) => {
            const frac = Number(p.value) / total;
            const dash = `${frac * c} ${c - frac * c}`;
            const el = (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="20"
                strokeDasharray={dash}
                strokeDashoffset={-offset * c}
              />
            );
            offset += frac;
            return el;
          })}
        </g>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 150 }}>
        {points.map((p) => (
          <div key={p.label} className="row between" style={{ fontSize: 12 }}>
            <span className="row" style={{ gap: 7 }}>
              <span className="swatch" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="muted">{((Number(p.value) / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
          Total {formatValue(total)}
        </div>
      </div>
    </div>
  );
}

export const PALETTE = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899', '#22c55e', '#06b6d4', '#f97316'];
