// One model job at a time; a chat switch stops the old chat's work; a new reply makes background work step aside.
'use strict';
const assert = require('assert');
const { load, makeChat, until } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(80) });
    const T = h.get('({ getSettings, getMemory, afterTurn, runCompress, onChatChanged, onGenerationStarted, refreshRecall, guarded, getBusy: () => busy, getTurnBusy: () => turnBusy, getPending: () => pendingTurn, activity })');
    const s = T.getSettings();
    s.vectorEnabled = false; s.retries = 0; s.checkDoubleCheck = false; s.voiceEnabled = false; s.checkContradictions = true; s.keepRecent = 10; s.batchMessages = 20; s.autoCompact = false; s.hooksEnabled = false; s.canonEnabled = false;
    const m = T.getMemory(true); m.cursor = 30;
    const chat = h.context.chat;
    // a check waits for a running summary job
    h.state.delay = 200;
    h.state.reply = '<episode>\ntitle: A\nimportance: 3\nkeywords: a, b\nsummary: Something happened here for a while.\n</episode><ledger>[]</ledger>';
    const c = T.runCompress({ auto: true });
    await new Promise(r => setTimeout(r, 20));
    await T.afterTurn(79);
    assert.strictEqual(T.getPending(), 79);
    await c;
    h.state.reply = '<issues>[]</issues>';
    await until(() => chat[79].extra.lm_check);
    assert.ok(chat[79].extra.lm_check, 'queued check ran after the summary');
    // a new reply stops a running check
    h.state.delay = 5000; delete chat[79].extra.lm_check;
    const run = T.afterTurn(79);
    await new Promise(r => setTimeout(r, 20));
    T.onGenerationStarted('normal', {}, false);
    await run;
    assert.ok(!T.getTurnBusy() && !chat[79].extra.lm_check);
    // a chat switch stops it too
    const run2 = T.afterTurn(79);
    await new Promise(r => setTimeout(r, 20));
    h.state.chatId = 'other'; T.onChatChanged(); await run2;
    assert.ok(!T.getTurnBusy() && T.getPending() === null);
    h.state.chatId = 'c';
    // recall never waits longer than its limit
    s.queryExpansion = true; s.recallMaxWaitMs = 1000; h.state.delay = 20000;
    const t0 = Date.now(); await T.refreshRecall(chat.slice(-6));
    assert.ok(Date.now() - t0 < 2500, 'recall capped');
    // a failing handler is caught once
    const bad = T.guarded('테스트', () => { throw new Error('boom'); });
    bad(); bad();
    assert.strictEqual(T.activity.log.filter(e => e.text.includes('테스트 처리 중 오류')).length, 1);
    console.log('jobs ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
