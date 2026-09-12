import { requireAdmin } from '../lib/auth.js';
import { HttpError, json, readJson, sameOrigin, handleError } from '../lib/http.js';
import { title, photoBytes, mediaPath, memberProfile } from '../lib/media.js';
import { storage } from '../lib/storage.js';
import { randomUUID } from 'node:crypto';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function showInput(body) {
  for (const field of ['name', 'date', 'location', 'organisedBy']) if (typeof body[field] !== 'string' || !body[field].trim() || body[field].length > 180) throw new HttpError(400, `Add a valid show ${field}.`);
  if (!datePattern.test(body.date)) throw new HttpError(400, 'Use a valid show date.');
  return { name: body.name.trim(), date: body.date, location: body.location.trim(), organisedBy: body.organisedBy.trim(), image: body.image || '' };
}
export function createContentHandler(store = storage) {
  return async function handler(req, res) {
    try {
      const content = await store.getContent();
      if (req.method === 'GET') return json(res, 200, content);
      if (!['PATCH', 'POST', 'DELETE'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
      requireAdmin(req); sameOrigin(req);
      const body = await readJson(req, 4_100_000);
      if (body.kind === 'intro') {
        const intro = {};
        for (const field of ['bengaliTitle', 'englishTitle', 'description']) { if (typeof body[field] !== 'string' || [...body[field].trim()].length > 500) throw new HttpError(400, 'Introduction text is too long.'); intro[field] = body[field].trim(); }
        if (body.imageData) { intro.image = (await store.putAsset(mediaPath('intro', 'homepage'), await photoBytes(body.imageData), 'image/webp')).url; }
        content.intro = { ...content.intro, ...intro }; await store.saveContent(content); return json(res, 200, { intro: content.intro });
      }
      if (body.kind === 'shows') {
        if (req.method === 'POST') { const show = showInput(body); if (body.imageData) show.image = (await store.putAsset(mediaPath('shows', show.name), await photoBytes(body.imageData), 'image/webp')).url; show.id = randomUUID(); content.shows.push(show); }
        else { const index = content.shows.findIndex(show => show.id === body.id); if (index < 0) throw new HttpError(404, 'Show not found.'); if (req.method === 'DELETE') content.shows.splice(index, 1); else { const show = showInput(body); if (body.imageData) show.image = (await store.putAsset(mediaPath('shows', show.name), await photoBytes(body.imageData), 'image/webp')).url; show.id = body.id; content.shows[index] = show; } }
        await store.saveContent(content); return json(res, 200, { shows: content.shows });
      }
      if (body.kind === 'media-edit') {
        if (typeof body.id !== 'string' || typeof body.title !== 'string' || !body.title.trim()) throw new HttpError(400, 'Add a title.');
        const existing = (await store.list()).find(item => item.id === body.id);
        if (!existing || !['photos', 'clips', 'videos'].includes(existing.kind)) throw new HttpError(404, 'Media item not found.');
        const edit = { ...(content.overrides[body.id] || {}), title: title(body.title) };
        if (body.imageData) {
          if (existing.kind !== 'photos') throw new HttpError(400, 'Only photo images can be replaced here.');
          edit.url = (await store.putAsset(mediaPath('photo-edits', edit.title), await photoBytes(body.imageData), 'image/webp')).url;
        }
        content.overrides[body.id] = edit;
        await store.saveContent(content); return json(res, 200, { saved: true });
      }
      if (body.kind === 'member-edit') {
        if (typeof body.id !== 'string') throw new HttpError(400, 'Member not found.');
        const profile = memberProfile(body); const edit = { ...(content.overrides[body.id] || {}), ...profile, name: profile.name, title: profile.name };
        if (body.imageData) edit.url = (await store.putAsset(mediaPath('member-edits', profile.name), await photoBytes(body.imageData), 'image/webp')).url;
        content.overrides[body.id] = edit;
        await store.saveContent(content); return json(res, 200, { saved: true });
      }
      throw new HttpError(400, 'Unknown content type.');
    } catch (error) { handleError(res, error); }
  };
}
export default createContentHandler();
