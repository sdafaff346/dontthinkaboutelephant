// 1.9.81: cards that play many people (다인봇, simulation, RPG game master).
'use strict';
const assert = require('assert');
const { load } = require('./harness');
(async () => {
    // The card "Rin" is played as a game master; its messages speak for Kai, Miru and others.
    const chat = Array.from({ length: 12 }, (_, i) => ({ name: i % 2 ? 'Rin' : 'Me', is_user: !(i % 2), mes: `Line ${i}: "Hello there, a long enough line."`, extra: {} }));
    const h = load({ chat });
    const T = h.get('({ getSettings, getMemory, ensembleCardName, speakerSamples, frameText, managerHtml, relationGraph, applyLedgerOps })');
    const m = T.getMemory(true);
    m.cast = [{ name: 'Kai', core: 'a', quotes: [] }, { name: 'Miru', core: 'b', quotes: [] }];
    assert.strictEqual(T.ensembleCardName(m), 'Rin', 'detected from the cast');
    // Collecting voices used to add a "Rin" entry, which switched the detection off for good.
    m.cast.push({ name: 'Rin', core: '', speech: 'mixed voices', quotes: [] });
    assert.strictEqual(T.ensembleCardName(m), 'Rin', 'a voice-only entry for the card does not make it one person');
    assert.ok(!T.speakerSamples().some(sp => sp.name === 'Rin'), "the narrator's mixed lines are nobody's voice sample");
    assert.ok(T.frameText(m.frame).includes('"Rin" is not a character'), 'every task is told');
    // Seen from the card text even before there is a cast.
    m.cast = [];
    assert.strictEqual(T.ensembleCardName(m), '');
    m.ensembleSeen = 'Rin';
    assert.strictEqual(T.ensembleCardName(m), 'Rin', 'remembered from reading the card');
    // The user decides.
    m.frame.cardKind = 'single';
    assert.strictEqual(T.ensembleCardName(m), '', 'set to one person');
    m.ensembleSeen = '';
    m.frame.cardKind = 'ensemble';
    assert.strictEqual(T.ensembleCardName(m), 'Rin', 'set to many people');
    assert.ok(T.managerHtml(m).includes('id="lm_f_cardkind"'), 'choice in 작품 설정');
    // The narrator never shows up in the relationship chart.
    T.applyLedgerOps(m, [{ op: 'set', cat: 'relation', key: 'Rin -> Me', value: 'narrates' }, { op: 'set', cat: 'relation', key: 'Kai -> Miru', value: 'rivals' }], 3);
    const g = T.relationGraph(m);
    assert.ok(!g.nodes.some(n => n.name === 'Rin') && g.edges.length === 1);
    // An ordinary card whose own personality came from the card stays one person.
    m.frame.cardKind = 'auto';
    m.cast = [{ name: 'Rin', core: 'a cheerful sailor', quotes: [] }, { name: 'Kai', core: 'x', quotes: [] }, { name: 'Miru', core: 'y', quotes: [] }];
    assert.strictEqual(T.ensembleCardName(m), '', 'side characters do not turn a normal card into a narrator');
    console.log('ensemble ok');
})().catch(e => { console.error(e); process.exit(1); });
