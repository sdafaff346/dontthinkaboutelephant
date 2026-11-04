// Established facts: exactly N picked from the whole record, each citing records.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

(async () => {
    const h = load();
    const T = h.get('({ getSettings, getMemory, parseCanon, validCanon, pickCanon, maybePickCanon, refreshInjection, PROMPT_KEY_MAIN })');
    const s = T.getSettings();
    s.vectorEnabled = false; s.retries = 0; s.canonCount = 3; s.canonEvery = 2;
    const m = T.getMemory(true);
    for (let i = 0; i < 4; i++) m.timeline.push({ id: `n${i}`, tier: 'episode', from: i * 10, to: i * 10 + 9, title: `T${i}`, text: `Event ${i}.`, importance: 3, keywords: [] });

    const ids = new Set(['n0', 'n1', 'n2', 'n3', 'saga']);
    const parsed = T.parseCanon('<facts>\n- [n0, n2] Her brother drowned in the flood.\n- [zz] Uncited fact.\n- [n1] Her brother drowned in the flood.\n3. [n3] They swore an oath at the lighthouse.\n</facts>', ids, 5);
    assert.strictEqual(parsed.length, 2, 'uncited and duplicate facts are refused');
    assert.strictEqual(JSON.stringify(parsed[0].cites), JSON.stringify(['n0', 'n2']));

    h.state.reply = '<facts>\n- [n1] Rin owes the guild 300 gold.\n- [n2] Kai is Rin\'s half-brother.\n- [n3] They swore to meet at dawn.\n- [n0] Extra one.\n</facts>';
    await T.pickCanon(m);
    assert.strictEqual(m.canon.facts.length, 3, 'exactly N kept');
    T.refreshInjection();
    const main = h.prompts[T.PROMPT_KEY_MAIN];
    assert.ok(main.includes('[Established facts the story rests on]') && main.indexOf('Established facts') < main.indexOf('[Timeline'), 'facts sit above the timeline');

    // a fact whose records are gone drops out
    m.timeline = m.timeline.filter(n => n.id !== 'n2');
    assert.strictEqual(T.validCanon(m).length, 2);

    // cadence: no new pick until canonEvery new summaries
    const calls = h.state.calls.length;
    await T.maybePickCanon(m, 'c');
    assert.ok(h.state.calls.length > calls, 'stale facts trigger a new pick');
    const after = h.state.calls.length;
    await T.maybePickCanon(m, 'c');
    assert.strictEqual(h.state.calls.length, after, 'no pick without new summaries');
    m.timeline.push({ id: 'n4', tier: 'episode', from: 50, to: 59, title: 'T4', text: 'x', importance: 3, keywords: [] });
    m.timeline.push({ id: 'n5', tier: 'episode', from: 60, to: 69, title: 'T5', text: 'y', importance: 3, keywords: [] });
    await T.maybePickCanon(m, 'c');
    assert.ok(h.state.calls.length > after, 'picks again after canonEvery summaries');
    s.canonEnabled = false;
    T.refreshInjection();
    assert.ok(!h.prompts[T.PROMPT_KEY_MAIN].includes('Established facts'), 'off: not injected');
    console.log('canon ok');
})().catch(e => { console.error(e); process.exit(1); });
