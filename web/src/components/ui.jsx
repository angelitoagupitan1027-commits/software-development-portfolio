export function Card({ title, desc, actions, children, className = '', ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || actions) && (
        <header className="card-head">
          <div style={{ flex: 1 }}>
            {title && <h3 className="card-title">{title}</h3>}
            {desc && <p className="card-desc">{desc}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function KpiCard({ label, value, sub, tone = '', badge }) {
  return (
    <div className="card kpi-card">
      <div className="row between">
        <span className="kpi-label">{label}</span>
        {badge}
      </div>
      <div className={`kpi-value ${tone}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function DemoBadge() {
  return <span className="badge demo">DEMO DATA</span>;
}

export function EmptyState({ title, desc, action }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading-row">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function Banner({ tone = '', children }) {
  return <div className={`banner ${tone}`}>{children}</div>;
}

export function MetricRow({ label, value, tone = '' }) {
  return (
    <div className="metric-row">
      <span className="k">{label}</span>
      <span className={`v ${tone}`}>{value}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3 className="card-title">{title}</h3>
          <button className="btn ghost sm" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
        {footer && <div className="row between" style={{ marginTop: 18 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, full }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
