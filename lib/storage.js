import { put, list, del, head } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { digest } from './auth.js';
import { HttpError } from './http.js';
import { record, isMemberPath, memberRecord } from './media.js';
import { applyMemberOrder } from './member-order.js';

async function readMember(blob) {
  const response = await fetch(blob.url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Unable to read member profile');
  const data = await response.json();
  return { item: memberRecord(blob, data), imagePath: data.imagePath };
}

export const storage = {
  async list() {
    let cursor; const records = []; let latestOrder;
    do {
      const page = await list({ prefix: 'media/', limit: 1000, cursor });
      for (const blob of page.blobs) {
        if (/^media\/member-order\/\d{13}-[a-f0-9-]{36}\.json$/.test(blob.pathname) && (!latestOrder || blob.pathname > latestOrder.pathname)) latestOrder = blob;
      }
      records.push(...(await Promise.all(page.blobs.map(async blob => isMemberPath(blob.pathname) ? (await readMember(blob)).item : record(blob)))).filter(Boolean));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    let ids = [];
    if (latestOrder) {
      const response = await fetch(latestOrder.url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error('Unable to read member order');
      ids = (await response.json()).ids;
      if (!Array.isArray(ids)) throw new Error('Invalid member order');
    }
    return applyMemberOrder(records.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)), ids);
  },
  async setMemberOrder(ids) {
    // A fresh path makes the new order visible immediately without stale CDN reads.
    await put(`media/member-order/${Date.now()}-${randomUUID()}.json`, JSON.stringify({ ids }), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
  },
  async put(pathname, body, contentType) {
    return record(await put(pathname, body, { access: 'public', contentType, addRandomSuffix: false }));
  },
  async putMember(profile, bytes) {
    const id = randomUUID();
    const imagePath = `member-photos/${id}.webp`;
    await put(imagePath, bytes, { access: 'public', contentType: 'image/webp', addRandomSuffix: false });
    const data = { ...profile, imagePath };
    try {
      const blob = await put(`media/members/${Date.now()}-${id}.json`, JSON.stringify(data), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
      return memberRecord(blob, data);
    } catch (error) { await del(imagePath); throw error; }
  },
  async delete(pathname) {
    if (isMemberPath(pathname)) {
      const { imagePath } = await readMember(await head(pathname));
      await del([pathname, imagePath]);
    } else await del(pathname);
  },
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
