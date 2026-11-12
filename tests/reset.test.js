// Category reset: only the chosen parts go; non-summary resets can be undone.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(10) });
    const T = h.get('({ getMemory, applyReset, pushHistory, runUndo, RESET_PARTS })');
    const m = T.getMemory(true);
    m.timeline.push({ id: 'a', tier: 'episode', from: 0, to: 4, title: 't', text: 'x', importance: 3, keywords: [] });
    m.saga.text = 'story';
    m.wiki = { updatedAt: 1, pages: [{ id: 'w', type: 'person', title: 'Kang', summary: 's' }] };
    m.ledger.entries.push({ id: 'l', cat: 'item', key: 'ring', value: 'kept' });
    m.events.push({ id: 'e', episodeId: 'a', from: 1, to: 1, text: 'e' });
    m.hiddenRanges = [[0, 4]];
    for (let i = 0; i <= 4; i++) { h.context.chat[i].is_system = true; h.context.chat[i].extra = { lm_hidden: true, lm_owner: 'a' }; }

    T.pushHistory(m, '초기화: 위키');
    T.applyReset(m, ['wiki']);
    assert.strictEqual(m.wiki.pages.length, 0);
    assert.strictEqual(m.timeline.length, 1, 'summaries kept');
    assert.strictEqual(m.ledger.entries.length, 1, 'ledger kept');
    await T.runUndo();
    assert.strictEqual(T.getMemory(false).wiki.pages.length, 1, 'wiki reset undone');

    const m2 = T.getMemory(false);
    T.applyReset(m2, ['summaries', 'events'], { keepHidden: false });
    assert.strictEqual(m2.timeline.length, 0);
    assert.strictEqual(m2.saga.text, '');
    assert.strictEqual(m2.cursor, -1);
    assert.strictEqual(m2.events.length, 0);
    assert.strictEqual(m2.wiki.pages.length, 1, 'wiki untouched');
    assert.strictEqual(m2.ledger.entries.length, 1);
    assert.ok(h.context.chat.slice(0, 5).every(x => !x.is_system), 'originals shown again');
    assert.strictEqual(T.RESET_PARTS.find(p => p.id === 'wiki').count(m2), 1);
    console.log('reset ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
