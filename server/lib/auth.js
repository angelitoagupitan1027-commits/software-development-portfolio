import crypto from 'node:crypto';

// Session secret: provided by the platform secret store at /run/base44/app.env.
// A random per-boot fallback keeps the app bootable in development if it is absent.
export const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
export const SESSION_SECRET_IS_PERSISTENT = Boolean(process.env.SESSION_SECRET);

const COOKIE_NAME = 'marco_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload, ttlMs = MAX_AGE_SECONDS * 1000) {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const data = b64u(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers?.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// The preview proxy is HTTPS but the container serves HTTP, so no Secure flag here.
export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

export function currentUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = verifyToken(token);
  if (!payload) return null;
  return { id: payload.uid, email: payload.email, name: payload.name, role: payload.role };
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthenticated', message: 'Sign in to continue.' });
  req.user = user;
  next();
}
