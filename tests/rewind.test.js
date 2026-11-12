// Deleting replies back into an already-summarized episode: that episode is rewound so the chat
// can continue from there with the original lines visible. Unhide-all shows everything we hid.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(60) });
    const T = h.get('({ getSettings, getMemory, runCompress, reconcileAfterDeletion, runUnhideAll, ctx })');
    const s = T.getSettings();
    Object.assign(s, { vectorEnabled: false, retries: 0, voiceEnabled: false, hooksEnabled: false, keepRecent: 10, batchMessages: 20, hideSummarized: true, canonEnabled: false, autoCompact: false, previewBeforeSave: false, verifySummaries: false });
    let k = 0;
    h.state.reply = () => `<episode>\ntitle: E${++k}\nimportance: 3\nkeywords: a\nsummary: Part ${k}.\n</episode><ledger>[]</ledger>`;
    await T.runCompress({ all: true });
    const m = T.getMemory(false);
    const chat = h.context.chat;
    const eps = m.timeline.map(n => [n.title, n.from, n.to]);
    assert.ok(eps.length >= 2, JSON.stringify(eps));
    const lastEp = m.timeline[m.timeline.length - 1];
    // user deletes everything after the middle of the last summarized episode
    const cut = lastEp.from + 3;
    chat.splice(cut + 1);
    assert.ok(chat[chat.length - 1].is_system, 'tail is hidden before reconcile');
    await T.reconcileAfterDeletion();
    assert.ok(!T.getMemory(false).timeline.some(n => n.title === lastEp.title), 'tail episode rewound');
    assert.ok(T.getMemory(false).archive.some(a => a.title === lastEp.title), 'kept in the archive');
    for (let i = lastEp.from; i <= cut; i++) assert.ok(!chat[i].is_system && !chat[i].extra.lm_hidden && !chat[i].extra.lm_owner, `#${i} visible again`);
    assert.strictEqual(T.getMemory(false).cursor, lastEp.from - 1, 'compress resumes from there');
    assert.ok(chat[lastEp.from - 1].is_system, 'earlier episodes stay hidden');
    assert.ok(h.toasts.some(t => /이어 채팅하면 돼요/.test(t)));

    // messages hidden by hand / another extension, and a /sys note that must stay as it is
    chat[1].is_system = true; delete chat[1].extra.lm_hidden;
    chat.push({ name: 'Narrator', is_user: false, is_system: true, mes: 'note', extra: { type: 'narrator' } });
    // unhide everything (confirm popup answered yes; checkbox stub)
    h.context.Popup = class { constructor() {} async show() { return 1; } };
    h.context.POPUP_RESULT = { AFFIRMATIVE: 1 }; h.context.POPUP_TYPE = { CONFIRM: 2 };
    const fake = () => { const el = { innerHTML: '', firstElementChild: null, querySelector: (q) => (q.includes('scope') ? { value: 'all' } : { checked: false }) }; return el; };
    h.sandbox.document.createElement = () => fake();
    await T.runUnhideAll();
    assert.strictEqual(chat.filter(x => x.is_system && !x.extra?.type).length, 0, 'all hidden messages shown, ours and others');
    assert.ok(chat[chat.length - 1].is_system, 'system note left alone');
    assert.strictEqual(T.getMemory(false).hiddenRanges.length, 0);
    assert.ok(T.getMemory(false).timeline.length >= 1, 'memory kept');
    console.log('rewind ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
