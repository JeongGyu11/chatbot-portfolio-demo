import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ask, findDocument } from './src/assistant.mjs';
import { users } from './src/data.mjs';
const files = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']]]);
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 16384) throw new Error('oversize'); }
  return JSON.parse(text || '{}');
}
export function createServer() {
  // Ephemeral state only: no original database, credentials or content logging.
  const sessions = new Map();
  return http.createServer(async (req, res) => {
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && files.has(url.pathname)) {
        const [name, contentType] = files.get(url.pathname); res.writeHead(200, { 'Content-Type': contentType });
        return res.end(await readFile(new URL(`./public/${name}`, import.meta.url)));
      }
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return json(403, { error: 'cross_origin_denied' });
        if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return json(415, { error: 'json_required' });
      }
      if (url.pathname === '/api/session' && req.method === 'POST') {
        const input = await body(req);
        if (!Object.hasOwn(users, input.user)) return json(400, { error: 'invalid_demo_user' });
        if (sessions.size >= 300) sessions.delete(sessions.keys().next().value);
        const id = randomUUID(); sessions.set(id, { actor: users[input.user], history: [], messages: [] });
        res.setHeader('Set-Cookie', `demo_session=${id}; HttpOnly; SameSite=Strict; Path=/`);
        return json(200, { name: users[input.user].name });
      }
      const cookie = req.headers.cookie?.match(/(?:^|;\s*)demo_session=([^;]+)/)?.[1];
      const session = sessions.get(cookie);
      if (!session) return json(401, { error: 'demo_session_required' });
      if (req.method === 'GET' && url.pathname.startsWith('/api/documents/')) {
        const doc = findDocument(session.actor, url.pathname.slice('/api/documents/'.length));
        return doc ? json(200, { title: doc.title, version: doc.version, state: doc.state, sections: doc.sections }) : json(404, { error: 'not_found' });
      }
      if (req.method === 'POST' && url.pathname === '/api/ask') {
        const input = await body(req); const started = performance.now();
        const result = await ask({ actor: session.actor, question: input.question, mode: input.mode, history: session.history });
        const messageId = randomUUID(); session.messages.push({ id: messageId, rating: null }); session.messages = session.messages.slice(-100);
        session.history.push({ role: 'user', content: input.question }, { role: 'assistant', content: result.answer }); session.history = session.history.slice(-12);
        return json(200, { ...result, messageId, latencyMs: Math.round(performance.now() - started) });
      }
      if (req.method === 'POST' && url.pathname === '/api/feedback') {
        const input = await body(req); const message = session.messages.find(item => item.id === input.messageId);
        if (!message) return json(404, { error: 'not_found' });
        if (!['up', 'down'].includes(input.rating)) return json(400, { error: 'invalid_rating' });
        message.rating = input.rating; return json(200, { ok: true });
      }
      return json(404, { error: 'not_found' });
    } catch (error) { return json(400, { error: ['invalid_question', 'invalid_mode', 'oversize'].includes(error.message) ? error.message : 'invalid_request' }); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 5187);
  createServer().listen(port, '127.0.0.1', () => process.stdout.write(`Demo: http://127.0.0.1:${port}\n`));
}
