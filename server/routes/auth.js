import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, setSessionCookie, clearSessionCookie, currentUser } from '../lib/auth.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'invalid_input', message: 'Email and password are required.' });
    }
    const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [String(email).trim()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Email or password is incorrect.' });
    }
    const token = signToken({ uid: user.id, email: user.email, name: user.name, role: user.role });
    setSessionCookie(res, token);
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }),
);

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  res.json({ user });
});

export default router;
