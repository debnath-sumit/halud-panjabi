import { HttpError, json, readJson, handleError } from '../lib/http.js';

const recipient = 'abeshbhattacharjee@yahoo.com';
const cc = ['sumit.srijit@gmail.com', 'arindom.sarkar@gmail.com'];

function text(body, field, limit) {
  if (typeof body[field] !== 'string' || !body[field].trim() || [...body[field].trim()].length > limit) throw new HttpError(400, `Add a valid ${field}.`);
  return body[field].trim();
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const body = await readJson(req, 16_000);
    const name = text(body, 'name', 100); const email = text(body, 'email', 320); const date = text(body, 'date', 40); const location = text(body, 'location', 200); const message = text(body, 'message', 3000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Add a valid email address.');
    if (!process.env.RESEND_API_KEY || !process.env.CONTACT_FROM) throw new HttpError(503, 'Contact email is not configured yet.');
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.CONTACT_FROM, to: [recipient], cc, reply_to: email, subject: `Booking inquiry from ${name}`, text: `Name: ${name}\nEmail: ${email}\nEvent date: ${date}\nLocation: ${location}\n\n${message}` }) });
    if (!response.ok) throw new Error(`Resend returned ${response.status}`);
    return json(res, 200, { sent: true });
  } catch (error) { handleError(res, error); }
}
