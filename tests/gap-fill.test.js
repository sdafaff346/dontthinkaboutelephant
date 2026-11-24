// A memory deleted in the middle (#20-#39 of #0-#59) leaves a gap compress never goes back to.
// The gap is found, offered, filled in story order, and its originals are hidden again.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(70) });
    const T = h.get('({ getSettings, getMemory, runCompress, restoreSources, summaryGaps, runFillGaps, timelineCards })');
    const s = T.getSettings();
    Object.assign(s, { vectorEnabled: false, retries: 0, voiceEnabled: false, hooksEnabled: false, keepRecent: 10, batchMessages: 20, hideSummarized: true, canonEnabled: false, autoCompact: false, previewBeforeSave: false, verifySummaries: false });
    let k = 0;
    h.state.reply = () => `<episode>\ntitle: E${++k}\nimportance: 3\nkeywords: a\nsummary: Part ${k}.\n</episode><ledger>[{"op":"set","cat":"item","key":"ring","value":"from part ${k}"}]</ledger>`;
    await T.runCompress({ all: true });
    const m = T.getMemory(false);
    const chat = h.context.chat;
    assert.strictEqual(m.timeline.length, 3, JSON.stringify(m.timeline.map(n => [n.from, n.to])));
    assert.strictEqual(T.summaryGaps(m).length, 0, 'no gaps after a normal compress');
    const mid = m.timeline[1];
    const ringBefore = m.ledger.entries.find(e => e.key === 'ring')?.value;

    // delete the middle one in the memory window, originals kept hidden (the default)
    m.timeline.splice(1, 1);
    T.restoreSources(m, new Set([mid.id]), { show: false });
    assert.strictEqual(m.cursor, m.timeline[1].to, 'cursor stays at the end');
    const gaps = T.summaryGaps(m);
    assert.strictEqual(JSON.stringify(gaps.map(g => [g.from, g.to])), JSON.stringify([[mid.from, mid.to]]), 'the deleted part is a gap');
    assert.ok(T.timelineCards(m).includes(`#${mid.from}~#${mid.to} 요약 없음`), 'shown in the timeline');

    // plain compress has nothing after the cursor, so it would never come back here; fill it
    await T.runFillGaps({ asked: true });
    assert.strictEqual(T.summaryGaps(m).length, 0, 'gap filled');
    assert.strictEqual(JSON.stringify(m.timeline.map(n => n.from)), JSON.stringify([0, mid.from, m.timeline[2].from]), 'in story order');
    const filled = m.timeline[1];
    assert.strictEqual(filled.from, mid.from);
    assert.strictEqual(filled.to, mid.to);
    for (let i = mid.from; i <= mid.to; i++) assert.strictEqual(chat[i].extra.lm_owner, filled.id, `#${i} tagged`);
    assert.ok(chat[mid.from + 1].is_system && chat[mid.from + 1].extra.lm_hidden, 'originals hidden again');
    assert.strictEqual(m.ledger.entries.find(e => e.key === 'ring')?.value, ringBefore, 'newer ledger values are not overwritten by the old part');

    // shown again instead of kept hidden: also a gap
    const again = m.timeline[1];
    m.timeline.splice(1, 1);
    T.restoreSources(m, new Set([again.id]), { show: true });
    assert.ok(!chat[mid.from + 1].is_system, 'shown');
    assert.strictEqual(T.summaryGaps(m).length, 1, 'gap when shown too');
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
