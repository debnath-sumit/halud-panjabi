import { HttpError, json, readJson, handleError } from '../lib/http.js';
import { storage } from '../lib/storage.js';

const model = 'gpt-5.6-luna';
function answerText(response) { return (response.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim(); }

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const body = await readJson(req, 8_000);
    if (typeof body.message !== 'string' || !body.message.trim() || [...body.message.trim()].length > 500) throw new HttpError(400, 'Please ask a short question.');
    if (!process.env.OPENAI_API_KEY) throw new HttpError(503, 'The band assistant is not configured yet.');
    const [content, items] = await Promise.all([storage.getContent(), storage.list()]);
    const facts = { intro: content.intro, shows: content.shows, members: items.filter(item => item.kind === 'members').map(({ id, kind, ...member }) => member), photos: items.filter(item => item.kind === 'photos').map(item => ({ title: item.title })), videos: items.filter(item => ['videos', 'clips'].includes(item.kind)).map(item => ({ title: item.title })) };
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, store: false, max_output_tokens: 350, input: [{ role: 'system', content: `You are the Holud Panjabi band website assistant. Answer only using the current website facts below. Be warm, concise, and helpful. If the facts do not answer a question, say you do not have that information and direct the visitor to Contact Us. Never invent dates, names, roles, contact details, prices, or availability.\n\nCURRENT WEBSITE FACTS:\n${JSON.stringify(facts)}` }, { role: 'user', content: body.message.trim() }] }) });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const answer = answerText(await response.json()); if (!answer) throw new Error('Empty assistant response');
    return json(res, 200, { answer });
  } catch (error) { handleError(res, error); }
}
