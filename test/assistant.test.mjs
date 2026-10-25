import test from 'node:test';
import assert from 'node:assert/strict';
import { ask, search, findDocument, validateAnswer } from '../src/assistant.mjs';
import { users } from '../src/data.mjs';

test('document response has real section, version and source link', async () => {
  const r = await ask({ actor: users.member, question: '교육비 지원 한도' });
  assert.equal(r.mode, 'retrieval'); assert.match(r.answer, /30만원/);
  assert.equal(r.sources[0].documentId, 'expenses'); assert.equal(r.sources[0].version, '1.1');
  assert.equal(r.sources[0].path, '/api/documents/expenses');
});
test('list/count route uses permission-filtered records', async () => {
  const a = await ask({ actor: users.member, question: '대기 업무 목록' });
  const b = await ask({ actor: users.reviewer, question: '대기 업무 목록' });
  assert.equal(a.mode, 'data'); assert.equal(a.items.length, 1); assert.equal(b.items.length, 2);
});
test('restricted documents never become member search sources', () => {
  const hits = search(users.member, '내부 검토 지침 예외 승인 한도');
  assert.ok(hits.every(hit => hit.documentId !== 'review-policy'));
  assert.equal(findDocument(users.member, 'review-policy'), null);
  assert.ok(findDocument(users.reviewer, 'review-policy'));
});
test('reviewer can retrieve restricted section', async () => {
  const r = await ask({ actor: users.reviewer, question: '내부 검토 지침 예외 승인 한도' });
  assert.match(r.answer, /70만원/); assert.equal(r.sources[0].documentId, 'review-policy');
});
test('short follow-up uses previous user topic', () => {
  const hits = search(users.member, '그러면 증빙은?', [{ role: 'user', content: '교육비 지원 한도' }]);
  assert.equal(hits[0].documentId, 'expenses'); assert.match(hits[0].text, /수료증/);
});
test('provider outage retains available original evidence', async () => {
  const r = await ask({ actor: users.member, question: '휴가 신청', mode: 'outage' });
  assert.equal(r.mode, 'fallback'); assert.match(r.answer, /3영업일/); assert.ok(r.sources.length);
});
test('unknown citation is rejected and replaced with retrieval fallback', async () => {
  const r = await ask({ actor: users.member, question: '교육비 지원', mode: 'invalid-citation' });
  assert.equal(r.mode, 'fallback'); assert.doesNotMatch(r.answer, /S999/);
});
test('valid injected generator receives history and permission-filtered evidence', async () => {
  const history = [{ role: 'user', content: '교육비 한도' }];
  const r = await ask({ actor: users.member, question: '그 증빙은?', history, generator: async input => {
    assert.deepEqual(input.history, history);
    assert.ok(input.sources.every(s => s.documentId !== 'review-policy'));
    return { answer: `${input.sources[0].text} [S1]`, sourceIds: ['S1'] };
  } });
  assert.equal(r.mode, 'generated'); assert.deepEqual(r.cited, ['S1']);
});
test('malformed generator output falls back', async () => {
  const r = await ask({ actor: users.member, question: '휴가 신청', generator: async () => ({ answer: '' }) });
  assert.equal(r.mode, 'fallback');
});
test('no matching topic returns no evidence', async () => {
  const r = await ask({ actor: users.member, question: 'quasar telescope' });
  assert.equal(r.mode, 'no_result'); assert.deepEqual(r.sources, []);
});
test('input bounds and scenario validation', async () => {
  await assert.rejects(ask({ actor: users.member, question: '' }), /invalid_question/);
  await assert.rejects(ask({ actor: users.member, question: 'a'.repeat(1001) }), /invalid_question/);
  await assert.rejects(ask({ actor: users.member, question: 'hi', mode: 'unexpected' }), /invalid_mode/);
});
test('citation validation does not accept unlisted inline references', () => {
  assert.throws(() => validateAnswer({ answer: 'text [S999]', sourceIds: ['S1'] }, [{ id: 'S1' }]), /invalid_citation/);
});
