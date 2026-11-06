import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { db } from './db.js';
import { registerApi } from './api.js';
import { runSeed } from './seed.js';

const production = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET ?? (production ? '' : 'development-only-change-this-session-secret-now');
if (sessionSecret.length < 32 || (production && /replace-with|change-this/i.test(sessionSecret))) {
  throw new Error('Set SESSION_SECRET to a private random value of at least 32 characters.');
}

const defaultOrigin = 'http://127.0.0.1:5173';
const configuredOrigin = process.env.APP_ORIGIN ?? (production ? process.env.RENDER_EXTERNAL_URL ?? '' : defaultOrigin);
let appOrigin = '';
if (production) {
  try {
    const parsed = new URL(configuredOrigin);
    if (!['https:'].includes(parsed.protocol) || parsed.origin !== configuredOrigin) throw new Error();
    appOrigin = parsed.origin;
  } catch {
    throw new Error('Set APP_ORIGIN to the exact public HTTPS origin, for example https://campus.example.edu.');
  }
}

declare module 'express-session' {
  interface SessionData { userId?: number; activeClubId?: number; csrfToken?: string }
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'https:'] } } }));
app.use(express.json({ limit: '100kb' }));

class SqliteSessionStore extends session.Store {
  get(sid: string, cb: (err: any, sess?: session.SessionData | null) => void) {
    try {
      const row = db.prepare('SELECT sess,expires FROM sessions WHERE sid=?').get(sid) as { sess: string; expires: number } | undefined;
      if (!row || row.expires < Date.now()) {
        if (row) db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.sess));
    } catch (error) { cb(error as Error); }
  }
  set(sid: string, sess: session.SessionData, cb?: (err?: any) => void) {
    try {
      const expires = sess.cookie.expires?.getTime() ?? Date.now() + 8 * 60 * 60 * 1000;
      db.prepare('INSERT INTO sessions(sid,sess,expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expires=excluded.expires').run(sid, JSON.stringify(sess), expires);
      cb?.();
    } catch (error) { cb?.(error); }
  }
  destroy(sid: string, cb?: (err?: any) => void) {
    try { db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); cb?.(); }
    catch (error) { cb?.(error); }
  }
  touch(sid: string, sess: session.SessionData, cb?: (err?: any) => void) { this.set(sid, sess, cb); }
}

app.use(session({
  name: 'campussphere.sid',
  store: new SqliteSessionStore(),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 8 * 60 * 60 * 1000 },
}));

if (process.env.CAMPUSSPHERE_DEMO_MODE === 'true') runSeed(true, process.env.CAMPUSSPHERE_SEED_PASSWORD ?? '');

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (safeMethods.has(req.method)) return next();

  const originHeader = req.get('origin');
  const refererHeader = req.get('referer');
  let requestOrigin = originHeader;
  if (!requestOrigin && refererHeader) {
    try { requestOrigin = new URL(refererHeader).origin; } catch { requestOrigin = undefined; }
  }
  let originAllowed = requestOrigin === appOrigin;
  if (!production && requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      originAllowed = parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
    } catch { originAllowed = false; }
  }
  if (!originAllowed) return res.status(403).json({ error: 'This request origin is not allowed.' });
  if (!req.is('application/json')) return res.status(415).json({ error: 'State-changing API requests must use JSON.' });

  const expected = req.session.csrfToken;
  const supplied = req.get('x-csrf-token');
  if (!expected || !supplied) return res.status(403).json({ error: 'Refresh the page and try again.' });
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return res.status(403).json({ error: 'Refresh the page and try again.' });
  }
  next();
});

app.get('/api/auth/csrf', (req, res) => {
  req.session.csrfToken ??= randomBytes(32).toString('base64url');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ token: req.session.csrfToken });
});

registerApi(app);

if (production) {
  const frontendPath = fileURLToPath(new URL('../../Frontend/dist/', import.meta.url));
  const indexPath = path.join(frontendPath, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error('Frontend build is missing. Run npm run build before starting in production.');
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use(express.static(frontendPath, { index: false, maxAge: '1y', immutable: true }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(indexPath);
  });
}

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.message);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'The server could not complete that request.' });
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1');
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  const server = app.listen(port, host, () => console.log(`CampusSphere API listening on ${host}:${port}`));
  const shutdown = () => server.close(() => { db.close(); process.exit(0); });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export { app };
