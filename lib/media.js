import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from './http.js';

export function title(value) {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > 120) throw new HttpError(400, 'Add a title of 1–120 characters.');
  return value.trim();
}

export function memberProfile(body) {
  const fields = { name: 100, role: 80, note: 500 };
  const profile = {};
  for (const [field, limit] of Object.entries(fields)) {
    if (typeof body[field] !== 'string' || !body[field].trim() || [...body[field].trim()].length > limit) throw new HttpError(400, `Add a member ${field} of 1–${limit} characters.`);
    profile[field] = body[field].trim();
  }
  return profile;
}

export function isMemberPath(value) {
  return typeof value === 'string' && /^media\/members\/\d{13}-[a-f0-9-]{36}\.json$/.test(value);
}

export function memberRecord(blob, data) {
  if (!isMemberPath(blob.pathname) || !/^member-photos\/[a-f0-9-]{36}\.webp$/.test(data.imagePath || '')) throw new Error('Invalid member record');
  const profile = memberProfile(data);
  return { id: blob.pathname, kind: 'members', title: profile.name, ...profile, url: new URL('/' + data.imagePath, blob.url).href, createdAt: Number(blob.pathname.split('/')[2].slice(0, 13)) };
}

export function youtubeId(value) {
  let url;
  try { url = new URL(value); } catch { throw new HttpError(400, 'Enter a valid YouTube video link.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new HttpError(400, 'Enter a valid YouTube video link.');
  let id;
  if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) id = url.pathname.slice(1);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/)?.[1];
  }
  if (!/^[\w-]{11}$/.test(id || '')) throw new HttpError(400, 'Use a YouTube watch, share, Shorts, or live video link.');
  return id;
}

export async function photoBytes(value) {
  if (typeof value !== 'string' || value.length > 4_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new HttpError(400, 'Choose a JPEG, PNG, or WebP photo.');
  const input = Buffer.from(value, 'base64');
  try {
    const options = { limitInputPixels: 40_000_000, animated: false };
    const metadata = await sharp(input, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Unsupported format');
    return await sharp(input, options).rotate().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new HttpError(400, 'This photo could not be read. Choose a JPEG, PNG, or WebP image under 40 megapixels.'); }
}

export function mediaPath(kind, label, videoId = '') {
  const encoded = Buffer.from(label).toString('base64url');
  return `media/${kind}/${Date.now()}-${randomUUID()}~${encoded}${kind === 'videos' ? `~${videoId}.json` : kind === 'clips' ? '.mp4' : '.webp'}`;
}

export function record(blob) {
  const clip = blob.pathname?.match(/^media\/clips\/(\d{13})-([a-f0-9-]{36})~([A-Za-z0-9_-]+)\.mp4$/);
  if (clip) return { id: blob.pathname, kind: 'clips', title: Buffer.from(clip[3], 'base64url').toString('utf8'), url: blob.url, createdAt: Number(clip[1]) };
  const match = blob.pathname?.match(/^media\/(photos|videos)\/(\d{13})-([a-f0-9-]{36})~([A-Za-z0-9_-]+)(?:~([\w-]{11})\.json|\.webp)$/);
  if (!match || (match[1] === 'videos') !== Boolean(match[5])) return null;
  return { id: blob.pathname, kind: match[1], title: Buffer.from(match[4], 'base64url').toString('utf8'), url: blob.url, videoId: match[5] || null, createdAt: Number(match[2]) };
}
