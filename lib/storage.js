import { put, list, del, head } from '@vercel/blob';
import { digest } from './auth.js';
import { HttpError } from './http.js';
import { record } from './media.js';

export const storage = {
  async list() {
    let cursor; const records = [];
    do {
      const page = await list({ prefix: 'media/', limit: 1000, cursor });
      records.push(...page.blobs.map(record).filter(Boolean));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return records.sort((a, b) => b.createdAt - a.createdAt);
  },
  async put(pathname, body, contentType) {
    return record(await put(pathname, body, { access: 'public', contentType, addRandomSuffix: false }));
  },
  async delete(pathname) { await del(pathname); },
};

// Reserve one of eight immutable slots per IP per 15 minutes. Storage makes
// this limit apply across serverless instances and cold starts.
export function createLoginLimiter(blob = { put, list, del, head }) {
 return async function loginLimit(req) {
  const ip = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const prefix = `security/login/${digest(String(ip))}/`;
  const window = Math.floor(Date.now() / 900_000);
  const previous = await blob.list({ prefix, limit: 1000 });
  const expired = previous.blobs.filter(b => Number(b.pathname.slice(prefix.length).split('-')[0]) < window - 1);
  if (expired.length) await blob.del(expired.map(b => b.pathname));
  const used = new Set(previous.blobs.map(b => b.pathname));
  for (let slot = 0; slot < 8; slot++) {
    const pathname = `${prefix}${window}-${slot}.json`;
    if (used.has(pathname)) continue;
    try {
      await blob.put(pathname, '{}', { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false });
      return;
    } catch (error) {
      // A competing request may have reserved this slot. Other failures fail closed.
      try { await blob.head(pathname); } catch { throw error; }
    }
  }
  throw new HttpError(429, 'Too many sign-in attempts. Please try again in 15 minutes.');
 };
}
export const loginLimit = createLoginLimiter();
