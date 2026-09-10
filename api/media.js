import { requireAdmin } from '../lib/auth.js';
import { HttpError, json, readJson, sameOrigin, handleError } from '../lib/http.js';
import { title, youtubeId, photoBytes, mediaPath, record } from '../lib/media.js';
import { storage } from '../lib/storage.js';

export function createMediaHandler(store = storage) {
  return async function handler(req, res) {
    try {
      if (req.method === 'GET') return json(res, 200, { items: await store.list() });
      if (!['POST', 'DELETE'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
      requireAdmin(req);
      sameOrigin(req);
      const body = await readJson(req, req.method === 'POST' ? 4_100_000 : 8192);
      if (req.method === 'DELETE') {
        if (typeof body.id !== 'string' || !record({ pathname: body.id })) throw new HttpError(400, 'Invalid media item.');
        await store.delete(body.id);
        return json(res, 200, { deleted: true });
      }
      const label = title(body.title);
      let item;
      if (body.kind === 'photos') {
        const bytes = await photoBytes(body.data);
        item = await store.put(mediaPath('photos', label), bytes, 'image/webp');
      } else if (body.kind === 'videos') {
        const id = youtubeId(body.url);
        item = await store.put(mediaPath('videos', label, id), JSON.stringify({ title: label, videoId: id }), 'application/json');
      } else throw new HttpError(400, 'Choose a photo or YouTube video.');
      return json(res, 201, { item });
    } catch (error) { handleError(res, error); }
  };
}
export default createMediaHandler();
