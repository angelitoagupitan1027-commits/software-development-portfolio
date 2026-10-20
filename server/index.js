import express from 'express';
import { ensureSchema } from './db.js';
import { requireAuth, SESSION_SECRET_IS_PERSISTENT } from './lib/auth.js';
import authRoutes from './routes/auth.js';
import tradeRoutes from './routes/trades.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutes from './routes/settings.js';
import aiRoutes from './routes/ai.js';
import okxRoutes from './routes/okx.js';
import reportRoutes from './routes/reports.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

// Wraps async handlers so rejections reach the error middleware.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'marco-ai-api', ts: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/trades', requireAuth, tradeRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/okx', requireAuth, okxRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[api error]', err);
  res.status(err.status || 500).json({ error: err.code || 'server_error', message: err.message || 'Unexpected server error' });
});

export { ah };

const PORT = Number(process.env.PORT || 8000);

ensureSchema()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`MARCO AI API listening on ${PORT}`);
      if (!SESSION_SECRET_IS_PERSISTENT) {
        console.warn('[auth] SESSION_SECRET not set — using an ephemeral secret. Sessions will not survive a restart.');
      }
    });
  })
  .catch((err) => {
    console.error('Failed to initialise database schema', err);
    process.exit(1);
  });
