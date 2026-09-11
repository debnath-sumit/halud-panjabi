import { issueSignedToken, presignUrl } from '@vercel/blob';
import { requireAdmin } from '../lib/auth.js';
import { HttpError, json, readJson, sameOrigin, handleError } from '../lib/http.js';
import { title, mediaPath } from '../lib/media.js';

export const MAX_VIDEO_BYTES = 100_000_000;

export function createVideoUploadHandler(blob = { issueSignedToken, presignUrl }) {
  return async function handler(req, res) {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      requireAdmin(req);
      sameOrigin(req);
      const body = await readJson(req);
      const label = title(body.title);
      if (body.contentType !== 'video/mp4') throw new HttpError(400, 'Choose an MP4 video.');
      if (!Number.isSafeInteger(body.size) || body.size < 1 || body.size > MAX_VIDEO_BYTES) throw new HttpError(400, 'Choose a video up to 100 MB.');
      const pathname = mediaPath('clips', label);
      const constraints = { allowedContentTypes: ['video/mp4'], maximumSizeInBytes: MAX_VIDEO_BYTES, validUntil: Date.now() + 30 * 60 * 1000 };
      const token = await blob.issueSignedToken({ pathname, operations: ['put'], ...constraints });
      const { presignedUrl } = await blob.presignUrl(token, { pathname, operation: 'put', access: 'public', addRandomSuffix: false, allowOverwrite: false, ...constraints });
      return json(res, 200, { uploadUrl: presignedUrl });
    } catch (error) { handleError(res, error); }
  };
}
export default createVideoUploadHandler();
