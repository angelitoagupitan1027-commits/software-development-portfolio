import { useEffect, useRef, useState } from 'react';
import { Card, Banner, Badge, Loading } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const SUGGESTIONS = [
  'Marco, how is my trading business performing this month?',
  'What are my biggest sources of losses?',
  'How much have I paid in trading fees?',
  'Which strategy has the best verified performance?',
  'What is my current portfolio exposure?',
  'Compare my performance with the previous month.',
  'Summarize my daily trading report.',
];

export default function MarcoAdvisor() {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [digest, setDigest] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, h] = await Promise.all([api.get('/api/ai/status'), api.get('/api/ai/history')]);
        setStatus(s);
        setMessages(h.messages);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, busy]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: question }]);
    try {
      const data = await api.post('/api/ai/chat', { message: question });
      setDigest(data.digest);
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: data.configured ? data.answer : data.notice }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: `e-${Date.now()}`, role: 'assistant', content: `Marco AI could not answer: ${e.message}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    await api.del('/api/ai/history');
    setMessages([]);
    setDigest(null);
  };

  if (loading) return <Loading label="Loading Marco AI…" />;

  return (
    <div className="stack">
      <Banner tone={status?.configured ? 'info' : 'warn'}>
        <div style={{ flex: 1 }}>
          <div className="row between">
            <strong>{status?.configured ? `Marco AI is connected (${status.provider} · ${status.model})` : 'Marco AI is not connected'}</strong>
            <Badge tone={status?.configured ? 'pos' : 'demo'}>{status?.configured ? 'AI provider configured' : 'No AI provider'}</Badge>
          </div>
          <div style={{ marginTop: 4 }}>
            {status?.configured
              ? 'Marco AI reasons over verified metrics computed by the application. It will distinguish facts from hypotheses and flag missing data.'
              : 'No AI provider is configured, so no conversational analysis can be generated. Add an OPENAI_API_KEY in the app secrets to enable it. The verified metrics below are always available, and Marco never invents balances or results.'}
          </div>
        </div>
      </Banner>

      <div className="grid cols-2-1">
        <Card
          title="Marco AI"
          desc="Trading Business Analyst · Financial Performance Analyst · Risk Analyst · Strategy Reviewer · BI Advisor"
          actions={
            <button className="btn ghost sm" type="button" onClick={clear} disabled={messages.length === 0}>
              Clear
            </button>
          }
        >
          <div className="chat">
            {messages.length === 0 && (
              <div className="msg assistant">
                <div className="avatar">MA</div>
                <div className="msg-body">
                  {status?.configured
                    ? 'Ask me about your trading business. I will only use your verified metrics and will tell you when data is missing or uncertain.'
                    : 'No AI provider is configured yet, so I cannot generate conversational analysis. Add an OPENAI_API_KEY to enable me. In the meantime, the verified metrics panel on the right shows what I would reason over.'}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="avatar">{m.role === 'user' ? 'YOU' : 'MA'}</div>
                <div className="msg-body">{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className="msg assistant">
                <div className="avatar">MA</div>
                <div className="msg-body">
                  <span className="loading-row" style={{ padding: 0 }}>
                    <span className="spinner" /> Analysing verified metrics…
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="divider" />

          <div className="row wrap" style={{ marginBottom: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" type="button" onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>

          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="input"
              placeholder="Ask Marco about your trading business…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </Card>

        <Card
          title="Verified metrics context"
          desc="Exactly what Marco AI is given"
          actions={
            <button className="btn ghost sm" type="button" onClick={() => setShowContext((v) => !v)}>
              {showContext ? 'Hide' : 'Show'}
            </button>
          }
        >
          <div className="stack" style={{ gap: 10 }}>
            <div className="banner info">
              <div>
                Accounting is performed by deterministic application code. The AI model never calculates your balances or P&amp;L.
              </div>
            </div>
            {showContext ? (
              digest ? (
                <pre className="mono" style={{ fontSize: 11, whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-2)' }}>
                  {digest}
                </pre>
              ) : (
                <p className="muted" style={{ fontSize: 12 }}>
                  Ask a question to generate the current metrics context, or open the dashboard pages for the same figures.
                </p>
              )
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>
                Context is generated from stored records on each question. Marco distinguishes facts from hypotheses, explains reasoning
                with supporting metrics, identifies missing data, and communicates uncertainty.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
