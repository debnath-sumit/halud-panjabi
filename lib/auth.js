import { createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './http.js';

const scrypt = promisify(scryptCallback);
const COOKIE = 'hp_admin';
const MAX_AGE = 8 * 60 * 60;

function secret() {
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) throw new HttpError(503, 'Admin login is not configured.');
  return process.env.ADMIN_SESSION_SECRET;
}
export function digest(value) { return createHmac('sha256', secret()).update(value).digest('hex'); }
function equal(a, b) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function validCredentials(username, password) {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) throw new HttpError(503, 'Admin login is not configured.');
  const [salt, expected] = process.env.ADMIN_PASSWORD_HASH.split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(expected || '')) throw new HttpError(503, 'Admin login is not configured.');
  const actual = (await scrypt(password, salt, 64)).toString('hex');
  return equal(actual, expected) && equal(username, process.env.ADMIN_USERNAME);
}

export function sessionCookie(clear = false, now = Date.now()) {
  const expires = String(now + MAX_AGE * 1000);
  const value = clear ? '' : `${expires}.${digest(expires)}`;
  const secure = (process.env.APP_ORIGIN || '').startsWith('https://') ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : MAX_AGE}${secure}`;
}

export function authenticated(req, now = Date.now()) {
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, signature] = token.split('.');
  return Number(expires) > now && Number(expires) <= now + MAX_AGE * 1000 && equal(signature, digest(expires));
}

export function requireAdmin(req) {
  if (!authenticated(req)) throw new HttpError(401, 'Please sign in to continue.');
}
