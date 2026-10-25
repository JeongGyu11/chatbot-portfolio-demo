const $ = id => document.getElementById(id);
const examples = ['교육비 지원 한도는 얼마인가요?', '휴가 신청은 언제까지 하나요?', '그 휴가는 취소할 수 있나요?', '대기 업무 목록을 보여주세요', '내부 검토 지침의 예외 승인 한도는?'];
let pending = false;
let active = false;
function el(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
async function api(path, value) {
  const response = await fetch(path, value === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  const result = await response.json();
  if (!response.ok) throw new Error('요청을 처리하지 못했습니다. 다시 시도해 주세요.');
  return result;
}
function busy(value) {
  pending = value;
  for (const id of ['send', 'reset', 'user', 'mode']) $(id).disabled = value;
  for (const button of $('examples').children) button.disabled = value;
}
async function reset() {
  busy(true);
  try {
    const session = await api('/api/session', { user: $('user').value });
    $('status').textContent = `${session.name} · 임시 세션`;
    $('messages').replaceChildren(el('div', '예시 질문을 선택하거나 업무 정보를 질문해 보세요.', 'empty'));
    active = false;
  } catch (error) { $('status').textContent = error.message; }
  finally { busy(false); }
}
function message(role, text) {
  if (!active) { $('messages').replaceChildren(); active = true; }
  const item = el('article', undefined, `message ${role}`);
  item.append(el('div', role === 'user' ? '나' : '업무 도우미', 'speaker'), el('p', text, 'answer'));
  $('messages').append(item);
  return item;
}
async function openDocument(path) {
  try {
    const doc = await api(path);
    $('doc-title').textContent = `${doc.title} · v${doc.version}`;
    $('doc-body').replaceChildren(el('p', `${doc.state} · 포트폴리오용 가상 문서`));
    for (const section of doc.sections) $('doc-body').append(el('h3', section.heading), el('p', section.text));
    $('document').showModal();
  } catch (error) { $('status').textContent = error.message; }
}
async function submit(question) {
  if (pending || !question.trim()) return;
  busy(true); $('question').value = '';
  message('user', question);
  const output = message('assistant', '조회 중입니다…');
  try {
    const result = await api('/api/ask', { question, mode: $('mode').value });
    output.querySelector('.answer').textContent = result.answer;
    for (const item of result.items) {
      const row = el('div', undefined, 'task');
      row.append(el('span', item.title), el('span', item.status)); output.append(row);
    }
    if (result.sources.length) {
      const list = el('div', undefined, 'sources');
      for (const source of result.sources) {
        const button = el('button', undefined, 'source');
        button.append(el('strong', `[${source.id}] ${source.title}`), el('span', `v${source.version} · ${source.state}`), el('span', source.heading));
        button.title = '가상 원문 확인';
        button.onclick = () => openDocument(source.path); list.append(button);
      }
      output.append(list);
    }
    output.append(el('div', `${result.diagnostic} · ${result.latencyMs}ms (로컬 처리)`, 'diagnostic'));
    const feedback = el('div', undefined, 'feedback');
    for (const [rating, label] of [['up', '도움이 돼요'], ['down', '보완이 필요해요']]) {
      const button = el('button', label);
      button.onclick = async () => {
        try {
          await api('/api/feedback', { messageId: result.messageId, rating });
          for (const sibling of feedback.children) sibling.classList.remove('selected');
          button.classList.add('selected');
        } catch (error) { $('status').textContent = error.message; }
      };
      feedback.append(button);
    }
    output.append(feedback);
  } catch (error) { output.querySelector('.answer').textContent = error.message; output.classList.add('error'); }
  finally { busy(false); $('messages').scrollTop = $('messages').scrollHeight; $('question').focus(); }
}
for (const text of examples) { const button = el('button', text); button.onclick = () => submit(text); $('examples').append(button); }
$('ask').onsubmit = event => { event.preventDefault(); void submit($('question').value); };
$('question').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void submit($('question').value); } };
$('reset').onclick = reset;
$('user').onchange = reset;
$('close-doc').onclick = () => $('document').close();
void reset();
