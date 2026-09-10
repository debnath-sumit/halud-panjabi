export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

export async function readJson(req, limit = 8192) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON content.');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > limit) throw new HttpError(413, 'Upload is too large. Please choose a smaller photo.');
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body)) > limit) throw new HttpError(413, 'Upload is too large.');
  try { body = typeof body === 'string' ? JSON.parse(body) : body; }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request.');
  return body;
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  const expected = process.env.APP_ORIGIN || 'http://localhost:3000';
  if (origin !== expected) throw new HttpError(403, 'Please use the admin page on this website.');
}

export function handleError(res, error) {
  if (!error.status) console.error('Admin service error:', error.name);
  json(res, error.status || 503, { error: error.status ? error.message : 'The media service is unavailable. Please try again shortly.' });
}
