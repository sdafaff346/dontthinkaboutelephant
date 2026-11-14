// v1.9.63 review fixes: canon after rewind, broken memory shapes, divergence in [Now], unknown choices.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

(async () => {
    const h = load();
    const T = h.get('({ getSettings, getMemory, validCanon, buildNowText, cleanBundleValues, META_KEY })');
    const s = T.getSettings();

    // 1. a fact citing an episode that was rewound (archived with no owner) drops out;
    //    one citing an episode merged into a chapter stays
    const m = T.getMemory(true);
    m.timeline.push({ id: 'c1', tier: 'chapter', from: 0, to: 19, title: 'C', text: 'c', importance: 3, keywords: [] });
    m.archive.push({ id: 'merged', ownerId: 'c1', kind: 'timeline', text: 'a' }, { id: 'rewound', ownerId: null, kind: 'timeline', text: 'b' });
    m.canon.facts = [{ text: 'kept', cites: ['merged'] }, { text: 'gone', cites: ['rewound'] }];
    assert.deepStrictEqual(T.validCanon(m).map(f => f.text), ['kept']);

    // 2. a hand-edited memory with nulls and wrong shapes is repaired
    h.context.chatMetadata[T.META_KEY] = { timeline: null, archive: {}, events: 'x', wiki: { pages: null }, canon: null, ledger: { entries: [] }, saga: null, qna: null, hiddenRanges: null };
    const fixed = T.getMemory(true);
    for (const k of ['timeline', 'archive', 'events', 'qna', 'hiddenRanges']) assert.ok(Array.isArray(fixed[k]), k);
    assert.ok(Array.isArray(fixed.wiki.pages) && Array.isArray(fixed.canon.facts) && typeof fixed.saga === 'object');
    assert.strictEqual(T.validCanon(fixed).length, 0);

    // 3. the [Now] block reminds the model where the story departs from canon
    fixed.ledger.entries.push({ id: 'd', cat: 'divergence', key: 'Rin survived the flood', value: '', status: 'active', importance: 4 });
    assert.ok(T.buildNowText(fixed).includes('Story overrides canon on: Rin survived the flood'));

    // 4. unknown drop-down values are dropped when a settings panel is there to check against
    const sel = { options: [{ value: 'en' }, { value: 'ko' }] };
    const prevQS = h.sandbox.document.querySelector;
    h.sandbox.document.querySelector = (q) => (q.includes('"language"') ? sel : null);
    const out = T.cleanBundleValues({ language: 'klingon', detail: s.detail });
    assert.ok(!('language' in out), 'unknown choice dropped');
    assert.ok('detail' in out, 'no panel to check against: kept');
    assert.strictEqual(T.cleanBundleValues({ language: 'ko' }).language, 'ko');
    h.sandbox.document.querySelector = prevQS;
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
