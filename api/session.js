import { authenticated, sessionCookie, validCredentials } from '../lib/auth.js';
import { HttpError, json, readJson, sameOrigin, handleError } from '../lib/http.js';
import { loginLimit } from '../lib/storage.js';

export function createSessionHandler(limit = loginLimit) {
  return async function handler(req, res) {
    try {
      if (req.method === 'GET') return json(res, 200, { authenticated: authenticated(req) });
      if (!['POST', 'DELETE'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
      sameOrigin(req);
      if (req.method === 'DELETE') {
        res.setHeader('Set-Cookie', sessionCookie(true));
        return json(res, 200, { authenticated: false });
      }
      const { username, password } = await readJson(req);
      if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) throw new HttpError(400, 'Enter your username and password.');
      await limit(req);
      if (!await validCredentials(username, password)) throw new HttpError(401, 'Incorrect username or password.');
      res.setHeader('Set-Cookie', sessionCookie());
      return json(res, 200, { authenticated: true });
    } catch (error) { handleError(res, error); }
  };
}
export default createSessionHandler();
