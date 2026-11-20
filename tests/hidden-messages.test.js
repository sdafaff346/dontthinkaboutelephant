// Messages the user hid stay out of memory: voice samples skip them, and hiding a message that is
// already summarized marks that memory for re-summarizing.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

(async () => {
    const h = load();
    const T = h.get('({ getMemory, speakerSamples, onUserHidMessage })');
    const chat = h.context.chat;
    chat.length = 0;
    for (let i = 0; i < 8; i++) chat.push({ name: 'Kang', is_user: false, is_system: false, mes: `visible line number ${i}`, extra: {} });
    chat.push({ name: 'Kang', is_user: false, is_system: true, mes: 'SECRET line the user hid', extra: {} });
    chat.push({ name: 'Kang', is_user: false, is_system: true, mes: 'summarized original we hid', extra: { lm_hidden: true, lm_owner: 'e1' } });
    const texts = T.speakerSamples()[0].items.map(x => x.text).join('\n');
    assert.ok(!texts.includes('SECRET'), 'user-hidden reply is not a voice sample');
    assert.ok(texts.includes('summarized original'), 'our own hidden originals still count');

    const m = T.getMemory(true);
    m.timeline.push({ id: 'e1', tier: 'episode', from: 0, to: 9, title: 'x', text: 'x', importance: 3, keywords: [] });
    chat[3].extra.lm_owner = 'e1';
    chat[3].is_system = true; // the user hid #3 after it was summarized
    T.onUserHidMessage(3);
    assert.strictEqual(m.timeline[0].stale, true, 'memory marked for re-summarizing');
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
