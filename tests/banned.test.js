// Avoid-list words leave everything the extension injects, and the request copy of the chat.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const tic = ['그는 숨을 들이켰다.', '창밖에는 비가 내렸다.', '린은 고개를 끄덕였다.'];
    const chat = makeChat(40, (i) => (i % 2 ? `${tic[i % 3]} 린은 낮게 웃었다. 마치 오래된 영화처럼. 대답 ${i}` : `질문 ${i}`));
    const h = load({ chat });
    const T = h.get('({ getSettings, getMemory, scrubBanned, findRepeatedPhrases, refreshInjection, interceptor: globalThis.longMemoryInterceptor, PROMPT_KEY_MAIN })');
    const s = T.getSettings(); s.vectorEnabled = false;
    const found = T.findRepeatedPhrases().phrases.map(p => p.text);
    assert.ok(found.some(t => t.includes('마치 오래된 영화처럼')), found.join(' | '));
    s.bannedWords = '숨을 들이켰다\n마치 오래된 영화처럼';
    assert.strictEqual(T.scrubBanned('그는 숨을 들이켰다. 그리고 웃었다.'), '그는. 그리고 웃었다.');
    const m = T.getMemory(true); m.cursor = 10;
    m.timeline.push({ id: 'n', tier: 'episode', from: 0, to: 10, title: 'T', text: '마치 오래된 영화처럼 떠났다.', importance: 3, keywords: [] });
    T.refreshInjection();
    assert.ok(!h.prompts[T.PROMPT_KEY_MAIN].includes('오래된 영화'), 'memory scrubbed');
    const copy = chat.map(x => ({ ...x }));
    await T.interceptor(copy, 0, null, 'normal');
    assert.ok(!copy.some(x => x.mes.includes('오래된 영화처럼')), 'request copy masked');
    assert.ok(chat.some(x => x.mes.includes('오래된 영화처럼')), 'saved chat untouched');
    console.log('banned ok');
})().catch(e => { console.error(e); process.exit(1); });
