import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Field } from '../components/ui.jsx';

const DEMO_EMAIL = 'demo@marco.ai';
const DEMO_PASSWORD = 'marco-demo-2026';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="row" style={{ gap: 13, marginBottom: 18 }}>
          <div className="login-mark">MA</div>
          <div>
            <h1 style={{ fontSize: 18 }}>MARCO AI</h1>
            <p className="muted" style={{ fontSize: 12 }}>Trading Business Management System</p>
          </div>
        </div>

        <form className="stack" onSubmit={submit} style={{ gap: 13 }}>
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <div className="banner neg">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="divider" />
        <div className="banner info">
          <div>
            <strong>Demo account (DEMO DATA)</strong>
            <div style={{ marginTop: 4 }}>
              Email <span className="mono">{DEMO_EMAIL}</span> · Password <span className="mono">{DEMO_PASSWORD}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              The workspace starts in demo mode with clearly labelled sample records. No real trading results are shown.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
