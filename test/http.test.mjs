import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
let server, base;
before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
async function post(path, value, cookie = '') {
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(value) });
}
async function login(user = 'member') {
  const r = await post('/api/session', { user });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
test('HTTP serves UI and defensive browser headers', async () => {
  const r = await fetch(base);
  assert.equal(r.status, 200); assert.match(await r.text(), /Grounded Workspace/);
  assert.match(r.headers.get('content-security-policy'), /object-src 'none'/);
});
test('HTTP requires a valid session', async () => {
  assert.equal((await post('/api/ask', { question: '교육비' })).status, 401);
});
test('HTTP source endpoint applies access filters independently', async () => {
  const member = await login(); const reviewer = await login('reviewer');
  assert.equal((await fetch(base + '/api/documents/review-policy', { headers: { cookie: member } })).status, 404);
  assert.equal((await fetch(base + '/api/documents/review-policy', { headers: { cookie: reviewer } })).status, 200);
});
test('HTTP cannot forge role in ask body', async () => {
  const cookie = await login();
  const r = await post('/api/ask', { question: '대기 업무 목록', actor: { permissions: ['review', 'general'] } }, cookie);
  assert.equal((await r.json()).items.length, 1);
});
test('HTTP source link resolves to cited version', async () => {
  const cookie = await login();
  const result = await (await post('/api/ask', { question: '교육비 지원 한도' }, cookie)).json();
  const source = result.sources[0];
  const doc = await (await fetch(base + source.path, { headers: { cookie } })).json();
  assert.equal(doc.version, source.version); assert.equal(doc.title, source.title);
});
test('HTTP feedback is accepted only in original session', async () => {
  const a = await login(); const b = await login();
  const result = await (await post('/api/ask', { question: '휴가 신청' }, a)).json();
  assert.equal((await post('/api/feedback', { messageId: result.messageId, rating: 'up' }, b)).status, 404);
  assert.equal((await post('/api/feedback', { messageId: result.messageId, rating: 'up' }, a)).status, 200);
});
test('HTTP rejects unknown user without exposing internal object properties', async () => {
  assert.equal((await post('/api/session', { user: '__proto__' })).status, 400);
});
test('HTTP rejects cross-origin writes', async () => {
  const r = await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid' }, body: '{"user":"member"}' });
  assert.equal(r.status, 403);
});
test('HTTP rejects invalid question and oversized request', async () => {
  const cookie = await login();
  assert.equal((await post('/api/ask', { question: '' }, cookie)).status, 400);
  assert.equal((await post('/api/ask', { question: 'a'.repeat(18000) }, cookie)).status, 400);
});
