import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scryptSync, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { createSessionHandler } from '../api/session.js';
import { createMediaHandler } from '../api/media.js';
import { authenticated, sessionCookie } from '../lib/auth.js';
import { youtubeId, record } from '../lib/media.js';
import { createLoginLimiter } from '../lib/storage.js';

let server, base, cookie;
const records = new Map();
const store = {
  async list() { return [...records.values()]; },
  async put(pathname, bytes) {
    const item = record({ pathname, url: `https://example.public.blob.vercel-storage.com/${pathname}` });
    records.set(pathname, item); return item;
  },
  async delete(pathname) { records.delete(pathname); },
};
before(async () => {
  process.env.ADMIN_USERNAME = 'test-admin';
  process.env.ADMIN_PASSWORD_HASH = `testsalt:${scryptSync('test-password', 'testsalt', 64).toString('hex')}`;
  process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');
  const session = createSessionHandler(async () => {});
  const media = createMediaHandler(store);
  server = createServer((req, res) => req.url === '/api/session' ? session(req, res) : media(req, res));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN = base;
});
after(() => new Promise(resolve => server.close(resolve)));
function request(path, method = 'GET', body, extra = {}) {
  return fetch(base + path, { method, headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('admin workflow and access protection', async () => {
  assert.equal((await request('/api/session')).status, 200);
  assert.equal((await request('/api/media', 'POST', { kind: 'videos' })).status, 401);
  assert.equal((await request('/api/media', 'DELETE', { id: 'anything' })).status, 401);
  assert.equal((await request('/api/session', 'POST', { username: 'test-admin', password: 'wrong' })).status, 401);
  assert.equal((await request('/api/session', 'POST', { username: 'test-admin', password: 'test-password' }, { Origin: 'https://attacker.example' })).status, 403);
  const login = await request('/api/session', 'POST', { username: 'test-admin', password: 'test-password' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await (await request('/api/session')).json(), { authenticated: true });

  assert.equal((await request('/api/media', 'POST', { kind: 'videos', title: 'Unsafe', url: 'https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ' })).status, 400);
  assert.equal((await request('/api/media', 'POST', { kind: 'videos', title: 'A title', url: 'https://youtu.be/dQw4w9WgXcQ' }, { Origin: 'https://attacker.example' })).status, 403);
  const video = await request('/api/media', 'POST', { kind: 'videos', title: 'পূজার সুর <script>', url: 'https://youtu.be/dQw4w9WgXcQ?t=10' });
  assert.equal(video.status, 201);
  const { item: videoItem } = await video.json();
  assert.equal(videoItem.title, 'পূজার সুর <script>');
  assert.equal(videoItem.videoId, 'dQw4w9WgXcQ');
  const invalid = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
  assert.equal((await request('/api/media', 'POST', { kind: 'photos', title: 'Fake image', data: invalid })).status, 400);
  const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#f6bf38' } }).png().toBuffer();
  const photo = await request('/api/media', 'POST', { kind: 'photos', title: 'Band photo', data: image.toString('base64') });
  assert.equal(photo.status, 201);
  const { item: photoItem } = await photo.json();
  assert.match(photoItem.id, /\.webp$/);
  const publicResponse = await request('/api/media', 'GET', undefined, { Cookie: '' });
  assert.equal((await publicResponse.json()).items.length, 2);
  assert.equal((await request('/api/media', 'DELETE', { id: 'security/login/example.json' })).status, 400);
  assert.equal((await request('/api/media', 'DELETE', { id: photoItem.id })).status, 200);
  assert.equal((await request('/api/media', 'DELETE', { id: videoItem.id })).status, 200);
  assert.equal((await (await request('/api/media')).json()).items.length, 0);
  const logout = await request('/api/session', 'DELETE');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  cookie = undefined;
  assert.equal((await request('/api/media', 'POST', { kind: 'videos' })).status, 401);
});

test('session rejects expired, forged, and malformed cookies', () => {
  const now = Date.now();
  const valid = sessionCookie(false, now).split(';')[0];
  assert.equal(authenticated({ headers: { cookie: valid } }, now), true);
  assert.equal(authenticated({ headers: { cookie: valid } }, now + 9 * 60 * 60 * 1000), false);
  assert.equal(authenticated({ headers: { cookie: valid.slice(0, -4) + '0000' } }, now), false);
  assert.equal(authenticated({ headers: { cookie: 'hp_admin=broken' } }), false);
});

test('YouTube validation accepts supported formats and rejects other sites', () => {
  for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://youtube.com/live/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ']) assert.equal(youtubeId(url), 'dQw4w9WgXcQ');
  for (const url of ['javascript:alert(1)', 'https://evil.example/dQw4w9WgXcQ', 'https://youtube.com/playlist?list=abc', 'https://youtube.com/watch?v=x', 'https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ']) assert.throws(() => youtubeId(url));
});

test('sign-in limit holds across concurrent requests and independent instances', async () => {
  const slots = new Set();
  const blob = {
    async list({ prefix }) { return { blobs: [...slots].filter(pathname => pathname.startsWith(prefix)).map(pathname => ({ pathname })) }; },
    async put(pathname) { if (slots.has(pathname)) throw new Error('exists'); slots.add(pathname); },
    async head(pathname) { if (!slots.has(pathname)) throw new Error('missing'); return {}; },
    async del(paths) { paths.forEach(path => slots.delete(path)); },
  };
  const instances = [createLoginLimiter(blob), createLoginLimiter(blob)];
  const req = { headers: { 'x-vercel-forwarded-for': '192.0.2.10' } };
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => instances[i % 2](req)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 8);
  assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.status === 429));
  await assert.rejects(createLoginLimiter(blob)(req), { status: 429 });
  await createLoginLimiter(blob)({ headers: { 'x-vercel-forwarded-for': '192.0.2.11' } });
});
