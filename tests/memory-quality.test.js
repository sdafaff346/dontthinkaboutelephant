// 1.9.78: memory steps that small models used to break, and changes that follow merged memories.
'use strict';
const assert = require('assert');
const { load } = require('./harness');
(async () => {
    const h = load();
    const T = h.get('({ getSettings, getMemory, stepChapter, stepSaga, stepCondense, applyHookOps, summaryUserPrompt, summarySystemPrompt, parseJsonLenient, applyLedgerOps, ledgerText, buildNowText, shiftlessEpisodes, SAGA_OWNER })');
    const s = T.getSettings();
    Object.assign(s, { vectorEnabled: false, retries: 0, protectRecent: 0, chapterSize: 3, hooksEnabled: true, changesEnabled: true });
    const m = T.getMemory(true);
    const ep = (i) => ({ id: `e${i}`, tier: 'episode', from: i * 10, to: i * 10 + 9, title: `T${i}`, text: `Long enough event text number ${i}. `.repeat(12), importance: 2, keywords: [], shiftScan: true });

    // --- changes follow episodes into a chapter, and the chapter counts as already scanned
    m.timeline = [ep(0), ep(1), ep(2)];
    m.shifts = [{ id: 's1', kind: 'emotion', who: '린', toward: '깡', before: '분노', after: '경계', why: '', start: 0, end: 9, episodeId: 'e0' }];
    h.state.reply = '<chapter>\ntitle: Ch\nkeywords: a\nsummary:\nMerged.\n</chapter>';
    assert.ok(await T.stepChapter(m, true));
    const ch = m.timeline[0];
    assert.strictEqual(ch.tier, 'chapter');
    assert.strictEqual(m.shifts[0].episodeId, ch.id, 'change moved to the chapter');
    assert.ok(ch.shiftScan, 'chapter of scanned episodes is scanned');
    assert.strictEqual(T.shiftlessEpisodes(m).length, 0, 'no false "not yet scanned" notice');

    // --- folding into the story so far: a reply that drops the old story is refused
    const old = 'The old story. '.repeat(60);
    m.saga = { text: old, coversTo: -1 };
    h.state.reply = '<saga>\nOnly the new chapter.\n</saga>';
    await assert.rejects(() => T.stepSaga(m, true), /빠뜨려/);
    assert.strictEqual(m.saga.text, old, 'old story kept');
    assert.strictEqual(m.timeline.length, 1, 'chapter not folded away');
    h.state.reply = `<saga>\n${'The old story, kept. '.repeat(40)} And the chapter.\n</saga>`;
    assert.ok(await T.stepSaga(m, true));
    assert.ok(m.archive.some(a => a.text === old.trim() && a.ownerId === T.SAGA_OWNER), 'replaced version archived');
    assert.strictEqual(m.shifts[0].episodeId, T.SAGA_OWNER, 'change moved into the story so far');

    // --- condense answers with short note ids
    m.timeline = [ep(5), ep(6)];
    h.state.reply = (args) => {
        assert.ok(JSON.stringify(args).includes('id=\\"N1\\"'), 'notes numbered N1..');
        return "<note id='N2'>Short.</note><note id=N1>Shorter.</note>";
    };
    assert.ok(await T.stepCondense(m, { allowAll: true }));
    assert.strictEqual(m.timeline[0].text, 'Shorter.');
    assert.strictEqual(m.timeline[1].text, 'Short.');

    // --- hooks resolved by H-number
    m.hooks = [{ id: 'mbx3k2a9f1q2w', kind: 'hint', text: 'A locked box.', status: 'open', from: 0 }];
    const up = T.summaryUserPrompt(m, { from: 0, to: 3, lines: ['x'] });
    assert.ok(up.includes('[H1]') && !up.includes('mbx3k2a9f1q2w'), 'short hook numbers shown');
    T.applyHookOps(m, [{ op: 'resolve', id: 'H1', how: 'opened' }], { from: 0, to: 3 });
    assert.strictEqual(m.hooks[0].status, 'resolved');

    // --- the English example does not pull the summary into English
    s.language = 'chat';
    assert.ok(/not in English/.test(T.summarySystemPrompt()));
    s.language = 'ko';
    assert.ok(/relation labels, changes and events in Korean/.test(T.summarySystemPrompt()));

    // --- cut-off JSON keeps the finished objects
    const cut = T.parseJsonLenient('[\n  {\n    "text": "one, with } inside",\n    "importance": 3\n  },\n  {\n    "text": "two"\n  },\n  {\n    "text": "thr');
    assert.strictEqual(cut.length, 2, 'two complete objects kept');
    assert.strictEqual(cut[0].text, 'one, with } inside');

    // --- ledger: other names small models use, one relation per pair
    m.ledger.entries = [];
    T.applyLedgerOps(m, [
        { op: 'set', cat: 'relation', key: '깡 -> 린', value: 'v1', label: '죄책감' },
        { op: 'update', cat: 'relationship', key: '깡→린', value: 'v2' },
        { op: 'add', cat: 'characters', key: '린', value: 'tired' },
        { cat: 'items', key: 'letter', value: 'burned' },
        { op: 'scene', present: ['깡', '린'] },
        { op: 'set', cat: 'relation', key: '미루 ↔ 린', value: 'friends' },
    ], 10);
    const rel = m.ledger.entries.filter(e => e.cat === 'relation');
    assert.strictEqual(rel.length, 2, 'arrow variants are one entry');
    assert.strictEqual(rel[0].value, 'v2');
    assert.strictEqual(rel[1].key, '미루 <-> 린');
    assert.ok(m.ledger.entries.some(e => e.cat === 'character' && e.key === '린'), 'category alias');
    assert.ok(m.ledger.entries.some(e => e.cat === 'item' && e.key === 'letter'), 'no op means set');
    assert.strictEqual(m.ledger.scene.present, '깡, 린', 'list of people present');
    assert.ok(T.ledgerText(m.ledger).includes('- 깡 -> 린 [죄책감]: v2'), 'label shown so the next summary keeps it');

    // --- the newest feeling rides along with replies
    m.shifts = [
        { id: 'a', kind: 'emotion', who: '린', toward: '깡', before: '분노', after: '경계', start: 0, end: 9 },
        { id: 'b', kind: 'emotion', who: '린', toward: '깡', before: '경계', after: '누그러짐', start: 10, end: 19 },
        { id: 'c', kind: 'emotion', who: '카이', toward: '미루', before: 'x', after: '질투', start: 10, end: 19 },
    ];
    const now = T.buildNowText(m);
    assert.ok(now.includes('린 → 깡: 누그러짐') && !now.includes('린 → 깡: 경계'), 'only the latest per pair');
    assert.ok(!now.includes('카이'), 'people not in the scene left out');
    s.changesEnabled = false;
    assert.ok(!T.buildNowText(m).includes('누그러짐'), 'off: not injected');
    console.log('memory-quality ok');
})().catch(e => { console.error(e); process.exit(1); });
