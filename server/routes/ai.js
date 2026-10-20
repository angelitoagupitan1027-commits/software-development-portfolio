import { Router } from 'express';
import { query } from '../db.js';
import { loadModel } from '../lib/model.js';
import { aiStatus, buildDigest, askMarco } from '../lib/ai.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/status', (req, res) => {
  res.json(aiStatus());
});

router.get(
  '/history',
  ah(async (req, res) => {
    const rows = (await query('SELECT id, role, content, created_at FROM ai_messages ORDER BY id ASC LIMIT 200')).rows;
    res.json({ messages: rows });
  }),
);

router.delete(
  '/history',
  ah(async (req, res) => {
    await query('DELETE FROM ai_messages');
    res.json({ ok: true });
  }),
);

router.post(
  '/chat',
  ah(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'invalid_input', message: 'A question is required.' });

    const metrics = await loadModel();
    const digest = buildDigest(metrics);
    const history = (await query('SELECT role, content FROM ai_messages ORDER BY id DESC LIMIT 8')).rows.reverse();

    await query('INSERT INTO ai_messages (role, content) VALUES ($1, $2)', ['user', message.slice(0, 4000)]);

    let result;
    try {
      result = await askMarco({ question: message, digest, history });
    } catch (err) {
      const text = `Marco AI could not complete the request: ${err.message}`;
      await query('INSERT INTO ai_messages (role, content) VALUES ($1, $2)', ['assistant', text]);
      return res.status(502).json({ error: 'ai_error', message: err.message, digest, configured: true });
    }

    const answerText = result.configured ? result.answer : result.notice;
    await query('INSERT INTO ai_messages (role, content) VALUES ($1, $2)', ['assistant', answerText]);

    res.json({
      configured: result.configured,
      answer: result.answer,
      notice: result.notice,
      digest,
      model: result.model || null,
      dataQuality: metrics.dataQuality,
    });
  }),
);

export default router;
