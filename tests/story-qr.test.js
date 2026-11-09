// A QR side-story inside an already-compressed range is switched to 이야기 later:
// it gets summarized into its own episode in story order and hidden, without touching neighbours.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(60) });
    const T = h.get('({ getSettings, getMemory, runCompress, storyQrGaps, runAbsorbStoryQrs, runUndo })');
    const s = T.getSettings();
    Object.assign(s, { vectorEnabled: false, retries: 0, voiceEnabled: false, hooksEnabled: false, keepRecent: 10, batchMessages: 20, hideSummarized: true, canonEnabled: false, autoCompact: false, previewBeforeSave: false, verifySummaries: false, qrMessages: 'aside' });
    const chat = h.context.chat;
    for (const i of [24, 25, 26]) { chat[i].extra = { ...(chat[i].extra || {}), lm_qr: 'aside', model: 'slash command' }; }
    h.state.reply = '<episode>\ntitle: A\nimportance: 3\nkeywords: a\nsummary: Main story part.\n</episode><ledger>[]</ledger>';
    await T.runCompress({ all: true });
    const m = T.getMemory(false);
    const before = m.timeline.map(n => n.id);
    assert.ok(m.cursor >= 30, 'compressed past the QR');
    assert.ok(!chat[25].is_system, 'aside QR left visible and unsummarized');
    assert.strictEqual(T.storyQrGaps().length, 0, 'asides are not gaps');

    for (const i of [24, 25, 26]) chat[i].extra.lm_qr = 'story';
    assert.strictEqual(JSON.stringify(T.storyQrGaps()), '[24,25,26]');

    h.state.reply = '<episode>\ntitle: Auto hunt\nimportance: 3\nkeywords: hunt\nsummary: They hunted through the forest.\n</episode><ledger>[{"op":"set","cat":"scene","key":"place","value":"forest"}]</ledger>';
    await T.runAbsorbStoryQrs(undefined, { ask: false });
    const added = m.timeline.find(n => n.title === 'Auto hunt');
    assert.ok(added, 'new episode');
    assert.strictEqual(added.from, 24); assert.strictEqual(added.to, 26);
    const idx = m.timeline.indexOf(added);
    assert.ok(m.timeline.slice(0, idx).every(n => n.from <= 24) && m.timeline.slice(idx + 1).every(n => n.from > 24), 'in story order');
    assert.ok([24, 25, 26].every(i => chat[i].is_system && chat[i].extra.lm_hidden && chat[i].extra.lm_owner === added.id));
    assert.ok(before.every(id => m.timeline.some(n => n.id === id)), 'neighbours untouched');
    assert.ok(!(m.ledger.scene && m.ledger.scene.place === 'forest'), 'past scene does not overwrite the present');
    assert.strictEqual(T.storyQrGaps().length, 0);

    await T.runUndo();
    assert.ok(!T.getMemory(false).timeline.some(n => n.title === 'Auto hunt'));
    assert.ok([24, 25, 26].every(i => !chat[i].is_system), 'one undo brings them back');
    console.log('story qr ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
