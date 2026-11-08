// One 되돌리기 undoes a whole compress run, including the clean-up and key-fact steps after it,
// and every original that run hid comes back.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(90) });
    const T = h.get('({ getSettings, getMemory, runCompress, runUndo, pushHistory, beginUndoGroup, endUndoGroup })');
    const s = T.getSettings();
    Object.assign(s, { vectorEnabled: false, retries: 0, voiceEnabled: false, hooksEnabled: false, keepRecent: 10, batchMessages: 20, hideSummarized: true, maxUndo: 3, canonEnabled: false, autoCompact: false, previewBeforeSave: false, verifySummaries: false });
    const chat = h.context.chat;
    h.state.reply = '<episode>\ntitle: A\nimportance: 3\nkeywords: a, b\nsummary: Something happened here for a while.\n</episode><ledger>[]</ledger>';
    // an earlier action the user may still want to undo
    const m0 = T.getMemory(true);
    T.pushHistory(m0, '직접 편집');
    await T.runCompress({ all: true });
    const m = T.getMemory(false);
    assert.ok(m.timeline.length >= 3, 'several batches');
    const hidden = chat.filter(x => x.is_system).length;
    assert.ok(hidden >= 60, 'originals hidden');
    // pretend the clean-up / key-fact steps ran after it, each saving more snapshots
    const g = T.beginUndoGroup(m);
    for (let i = 0; i < 5; i++) T.pushHistory(m, '기억 정리');
    T.endUndoGroup(m, g, '기억 정리');
    assert.strictEqual(m.history.length, 3, 'within maxUndo');
    assert.strictEqual(m.history[1].label.startsWith('압축 #'), true, 'one entry for the whole compress: ' + m.history[1].label);
    assert.ok(m.history[1].label.includes('개 구간'));
    await T.runUndo();                 // undoes the clean-up
    await T.runUndo();                 // undoes the whole compress
    assert.strictEqual(chat.filter(x => x.is_system).length, 0, 'every hidden original is back');
    assert.strictEqual(T.getMemory(false).timeline.length, 0);
    assert.strictEqual(chat.filter(x => x.extra?.lm_hidden).length, 0);
    assert.strictEqual(T.getMemory(false).history[0].label, '직접 편집', 'older history kept');
    console.log('undo ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
