import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scryptSync, randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createSessionHandler } from '../api/session.js';
import { createMediaHandler } from '../api/media.js';
import { createVideoUploadHandler, MAX_VIDEO_BYTES } from '../api/video-upload.js';
import { authenticated, sessionCookie } from '../lib/auth.js';
import { youtubeId, record, memberRecord } from '../lib/media.js';
import { createLoginLimiter } from '../lib/storage.js';
import { applyMemberOrder } from '../lib/member-order.js';

let server, base, cookie;
const uploadPermissions = [];
const records = new Map();
let savedMemberOrder = [];
const store = {
  async list() { return applyMemberOrder([...records.values()], savedMemberOrder); },
  async setMemberOrder(ids) { savedMemberOrder = [...ids]; },
  async put(pathname, bytes) {
    const item = record({ pathname, url: `https://example.public.blob.vercel-storage.com/${pathname}` });
    records.set(pathname, item); return item;
  },
  async delete(pathname) { records.delete(pathname); },
  async putMember(profile) {
    const id = randomUUID();
    const pathname = `media/members/${Date.now()}-${id}.json`;
    const item = memberRecord({ pathname, url: `https://example.public.blob.vercel-storage.com/${pathname}` }, { ...profile, imagePath: `member-photos/${id}.webp` });
    records.set(pathname, item); return item;
  },
};
before(async () => {
  process.env.ADMIN_USERNAME = 'test-admin';
  process.env.ADMIN_PASSWORD_HASH = `testsalt:${scryptSync('test-password', 'testsalt', 64).toString('hex')}`;
  process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');
  const session = createSessionHandler(async () => {});
  const media = createMediaHandler(store);
  const videoUpload = createVideoUploadHandler({
    async issueSignedToken(options) { uploadPermissions.push(options); return { scoped: options.pathname }; },
    async presignUrl(token, options) {
      assert.equal(token.scoped, options.pathname);
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.operation, 'put');
      assert.equal(options.access, 'public');
      assert.equal(options.maximumSizeInBytes, MAX_VIDEO_BYTES);
      assert.deepEqual(options.allowedContentTypes, ['video/mp4']);
      return { presignedUrl: 'https://example.blob.vercel-storage.com/signed-upload' };
    },
  });
  server = createServer((req, res) => req.url === '/api/session' ? session(req, res) : req.url === '/api/video-upload' ? videoUpload(req, res) : media(req, res));
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
  assert.equal((await request('/api/media', 'POST', { kind: 'members', name: 'Anyone' })).status, 401);
  assert.equal((await request('/api/media', 'PATCH', { kind: 'members', ids: [] })).status, 401);
  assert.equal((await request('/api/video-upload', 'POST', { title: 'Video', size: 100, contentType: 'video/mp4' })).status, 401);
  assert.equal((await request('/api/session', 'POST', { username: 'test-admin', password: 'wrong' })).status, 401);
  assert.equal((await request('/api/session', 'POST', { username: 'test-admin', password: 'test-password' }, { Origin: 'https://attacker.example' })).status, 403);
  const login = await request('/api/session', 'POST', { username: 'test-admin', password: 'test-password' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await (await request('/api/session')).json(), { authenticated: true });

  const clipBody = { title: 'ঢাকের তালে', size: MAX_VIDEO_BYTES, contentType: 'video/mp4', pathname: 'security/overwrite.json' };
  assert.equal((await request('/api/video-upload', 'GET')).status, 405);
  assert.equal((await request('/api/video-upload', 'POST', clipBody, { Origin: 'https://attacker.example' })).status, 403);
  for (const size of [0, -1, 1.5, MAX_VIDEO_BYTES + 1, '100']) assert.equal((await request('/api/video-upload', 'POST', { ...clipBody, size })).status, 400);
  assert.equal((await request('/api/video-upload', 'POST', { ...clipBody, contentType: 'text/html' })).status, 400);
  assert.equal((await request('/api/video-upload', 'POST', { ...clipBody, title: '' })).status, 400);
  assert.equal(uploadPermissions.length, 0);
  const uploadResponse = await request('/api/video-upload', 'POST', clipBody);
  assert.equal(uploadResponse.status, 200);
  assert.ok((await uploadResponse.json()).uploadUrl);
  assert.equal(uploadPermissions.length, 1);
  const permission = uploadPermissions[0];
  assert.deepEqual(permission.operations, ['put']);
  assert.deepEqual(permission.allowedContentTypes, ['video/mp4']);
  assert.equal(permission.maximumSizeInBytes, 100_000_000);
  assert.ok(permission.validUntil > Date.now() && permission.validUntil <= Date.now() + 30 * 60 * 1000);
  assert.match(permission.pathname, /^media\/clips\/[0-9]{13}-[a-f0-9-]+~[A-Za-z0-9_-]+\.mp4$/);
  const clip = await store.put(permission.pathname, Buffer.from('test video record'));
  assert.equal(clip.kind, 'clips');
  assert.equal(clip.title, clipBody.title);

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
  const memberBody = { kind: 'members', name: 'সুমিত <script>', role: 'Captain · Band Director', note: 'Brings the band together.\nঢাকের তালে আমাদের গল্প।', data: image.toString('base64') };
  assert.equal((await request('/api/media', 'POST', { ...memberBody, role: '' })).status, 400);
  assert.equal((await request('/api/media', 'POST', { ...memberBody, note: 'x'.repeat(301) })).status, 400);
  assert.equal((await request('/api/media', 'POST', { ...memberBody, data: invalid })).status, 400);
  assert.equal((await request('/api/media', 'POST', memberBody, { Origin: 'https://attacker.example' })).status, 403);
  const memberResponse = await request('/api/media', 'POST', memberBody);
  assert.equal(memberResponse.status, 201);
  const { item: member } = await memberResponse.json();
  assert.equal(member.name, memberBody.name);
  assert.equal(member.role, memberBody.role);
  assert.equal(member.note, memberBody.note);
  assert.match(member.url, /^https:\/\/example.public.blob.vercel-storage.com\/member-photos\/[a-f0-9-]+\.webp$/);
  const second = (await (await request('/api/media', 'POST', { ...memberBody, name: 'Second member' })).json()).item;
  const orderBody = { kind: 'members', ids: [second.id, member.id] };
  assert.equal((await request('/api/media', 'PATCH', orderBody, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request('/api/media', 'PATCH', { ...orderBody, ids: [member.id, member.id] })).status, 400);
  assert.equal((await request('/api/media', 'PATCH', { ...orderBody, ids: [photoItem.id, member.id] })).status, 400);
  assert.equal((await request('/api/media', 'PATCH', { ...orderBody, ids: [member.id] })).status, 409);
  assert.equal((await request('/api/media', 'PATCH', orderBody)).status, 200);
  assert.deepEqual((await (await request('/api/media')).json()).items.filter(item => item.kind === 'members').map(item => item.id), orderBody.ids);
  const publicResponse = await request('/api/media', 'GET', undefined, { Cookie: '' });
  const publicItems = (await publicResponse.json()).items;
  assert.equal(publicItems.length, 5);
  assert.deepEqual(publicItems.filter(item => item.kind === 'members'), [second, member]);
  assert.equal((await request('/api/media', 'DELETE', { id: 'security/login/example.json' })).status, 400);
  assert.equal((await request('/api/media', 'DELETE', { id: photoItem.id })).status, 200);
  assert.equal((await request('/api/media', 'DELETE', { id: videoItem.id })).status, 200);
  assert.equal((await request('/api/media', 'DELETE', { id: member.id })).status, 200);
  assert.equal((await request('/api/media', 'DELETE', { id: second.id })).status, 200);
  assert.equal((await request('/api/media', 'DELETE', { id: clip.id })).status, 200);
  assert.equal((await (await request('/api/media')).json()).items.length, 0);
  const logout = await request('/api/session', 'DELETE');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  cookie = undefined;
  assert.equal((await request('/api/media', 'POST', { kind: 'videos' })).status, 401);
});

test('saved member order keeps new members and ignores removed members', () => {
  const members = ['new', 'captain', 'dhaki'].map(id => ({ id, kind: 'members' }));
  const photo = { id: 'photo', kind: 'photos' };
  const result = applyMemberOrder([photo, ...members], ['captain', 'removed', 'dhaki']);
  assert.deepEqual(result.map(item => item.id), ['photo', 'captain', 'dhaki', 'new']);
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
