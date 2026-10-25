import { documents, tasks } from './data.mjs';
export function accessible(actor, item) {
  return Boolean(actor?.permissions?.includes(item.permission));
}
export function findDocument(actor, id) {
  return documents.find(doc => doc.id === id && accessible(actor, doc)) ?? null;
}
function score(question, text) {
  const body = text.toLowerCase();
  let total = 0;
  for (const term of question.toLowerCase().match(/[a-z0-9가-힣]+/g) ?? []) {
    if (term.length < 2) continue;
    if (body.includes(term)) total += term.length;
    else if (term.length >= 3) {
      for (let i = 0; i < term.length - 1; i++) if (body.includes(term.slice(i, i + 2))) total += 0.25;
    }
  }
  return total;
}
export function search(actor, question, history = []) {
  const previous = [...history].reverse().find(turn => turn.role === 'user')?.content ?? '';
  const followup = /그|해당|그러면|취소|증빙/.test(question);
  return documents.filter(doc => accessible(actor, doc)).flatMap(doc => doc.sections.map(section => ({
    documentId: doc.id, title: doc.title, version: doc.version, state: doc.state,
    heading: section.heading, text: section.text,
    score: score(question, `${doc.title} ${section.heading} ${section.text}`)
      + (followup ? 0.35 * score(previous, doc.title) : 0),
  }))).filter(hit => hit.score > 0.7).sort((a, b) => b.score - a.score).slice(0, 3)
    .map((hit, i) => ({ ...hit, id: `S${i + 1}`, path: `/api/documents/${hit.documentId}` }));
}
function fallback(sources) {
  return sources.map(source => `${source.text} [${source.id}]`).join('\n\n');
}
export function validateAnswer(output, sources) {
  const valid = new Set(sources.map(source => source.id));
  if (!output || typeof output.answer !== 'string' || !output.answer.trim()
      || !Array.isArray(output.sourceIds)) throw new Error('invalid_format');
  const inline = [...output.answer.matchAll(/\[(S\d+)\]/g)].map(match => match[1]);
  const all = [...inline, ...output.sourceIds];
  if (!all.length || all.some(id => !valid.has(id))) throw new Error('invalid_citation');
  return { answer: output.answer, cited: [...new Set(all)] };
}
export async function ask({ actor, question, history = [], mode = 'retrieval', generator }) {
  if (typeof question !== 'string' || !question.trim() || question.length > 1000) throw new Error('invalid_question');
  if (!['retrieval', 'outage', 'invalid-citation'].includes(mode)) throw new Error('invalid_mode');
  // Lists use actual in-memory records, not model-generated counts.
  if (/목록|현황|몇\s*건/.test(question)) {
    const items = tasks.filter(item => accessible(actor, item)).filter(item => !/대기/.test(question) || item.status === '대기');
    return { mode: 'data', answer: `조회 가능한 업무는 ${items.length}건입니다.`, items, sources: [], diagnostic: '등록 데이터 직접 조회' };
  }
  const sources = search(actor, question, history);
  if (!sources.length) return { mode: 'no_result', answer: '조회 가능한 자료에서 근거를 찾지 못했습니다. 문서명이나 주제를 구체적으로 질문해 주세요.', sources: [], items: [], diagnostic: '검색 결과 없음 · 권한 필터 적용' };
  const base = { sources, items: [] };
  if (mode === 'retrieval' && !generator) return { ...base, mode: 'retrieval', answer: fallback(sources), diagnostic: '검색 근거 기반 데모 응답 · 외부 LLM 미사용' };
  try {
    if (mode === 'outage') throw new Error('simulated_outage');
    const output = mode === 'invalid-citation' ? { answer: '허용되지 않은 출처 예시 [S999]', sourceIds: ['S999'] }
      : await generator({ question, history, sources });
    return { ...base, ...validateAnswer(output, sources), mode: 'generated', diagnostic: '주입된 생성기 응답 · 인용 ID 검증 통과' };
  } catch {
    return { ...base, mode: 'fallback', answer: fallback(sources), diagnostic: mode === 'invalid-citation'
      ? '잘못된 인용 감지 → 검색 근거 안내로 전환' : '생성 실패 → 검색 근거 안내로 전환' };
  }
}
