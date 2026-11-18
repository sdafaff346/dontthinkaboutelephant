// Per-turn recall: a scene sent in recent turns or already echoed by the AI ranks lower, muted
// words keep a scene out, and other searches (questions, checks) are unaffected.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

(async () => {
    const h = load();
    const T = h.get('({ getSettings, getMemory, hybridRecall, noteRecallTurn, recallText })');
    const s = T.getSettings();
    s.vectorEnabled = false;
    s.queryExpansion = false;
    s.recallTopK = 1;
    s.indexRawMessages = false;
    s.indexAllMessages = false;
    const m = T.getMemory(true);
    m.cursor = 100;
    m.events = [
        { id: 'crab', from: 10, to: 10, text: 'Kang ate snow crab in Ginza with his father, 29 years ago.', keywords: ['snow crab', 'Ginza'], importance: 5 },
        { id: 'soup', from: 60, to: 60, text: 'Kang ate soup at the harbor stall.', keywords: ['soup'], importance: 3 },
    ];
    h.context.chat.length = 0;
    h.context.chat.push({ name: 'User', is_user: true, mes: 'Kang ate dinner.' });

    const top = async (opts) => (await T.hybridRecall(m, ['Kang ate'], opts)).results.map(r => r.item.display.split(' ')[2]);
    assert.strictEqual((await top({ forTurn: true }))[0], 'snow', 'the important scene wins at first');

    // sent three turns in a row: it steps aside
    for (let i = 0; i < 3; i++) T.noteRecallTurn((await T.hybridRecall(m, ['Kang ate'], { forTurn: true })).results.filter(r => r.item.display.includes('crab')));
    assert.strictEqual((await top({ forTurn: true }))[0], 'soup', 'cooled down after repeated turns');
    assert.strictEqual((await top({}))[0], 'snow', 'questions and checks are not cooled down');

    // echo: the AI just talked about Ginza
    h.load && null;
    const h2 = load();
    const U = h2.get('({ getSettings, getMemory, hybridRecall })');
    Object.assign(U.getSettings(), { vectorEnabled: false, queryExpansion: false, recallTopK: 1, indexRawMessages: false, indexAllMessages: false });
    const m2 = U.getMemory(true);
    m2.cursor = 100;
    m2.events = JSON.parse(JSON.stringify(m.events));
    h2.context.chat.length = 0;
    h2.context.chat.push({ name: 'Kang', is_user: false, mes: '맛있었다... 29년 전 Ginza에서 먹었던 그 대게처럼.' });
    h2.context.chat.push({ name: 'User', is_user: true, mes: 'Kang ate dinner.' });
    const r2 = await U.hybridRecall(m2, ['Kang ate'], { forTurn: true });
    assert.ok(r2.results[0].item.display.includes('soup'), 'already echoed in the last reply: steps aside');

    // mute words: kept out entirely, only for the per-turn recall
    m2.recallMute = '대게, snow crab';
    U.getSettings().recallTopK = 5;
    const r3 = await U.hybridRecall(m2, ['Kang ate'], { forTurn: true });
    assert.ok(r3.results.every(r => !r.item.display.includes('crab')), 'muted');
    const r4 = await U.hybridRecall(m2, ['Kang ate'], {});
    assert.ok(r4.results.some(r => r.item.display.includes('crab')), 'a question can still find it');

    assert.ok(/reminiscence, flashbacks or comparisons/.test(T.recallText(r4.results)), 'recall block says no reminiscing');
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
