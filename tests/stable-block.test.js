// The big memory block stays byte-identical between summaries; live changes go to [Now].
'use strict';
const assert = require('assert');
const { load } = require('./harness');

const { get, prompts } = load();
const T = get('({ getSettings, getMemory, refreshInjection, PROMPT_KEY_MAIN, PROMPT_KEY_ANCHOR })');
const s = T.getSettings();
s.vectorEnabled = false;
const m = T.getMemory(true);
m.cursor = 10;
m.timeline.push({ id: 'e1', tier: 'episode', from: 0, to: 10, title: 'Harbor', text: 'They met at the harbor.', importance: 3, keywords: [] });
m.ledger.scene = { time: 'evening', place: 'Harbor', present: 'Rin, Me', mood: 'tense' };
m.ledger.entries.push({ id: 'a', cat: 'item', key: 'Ring', value: 'Rin wears the ring', importance: 4, status: 'open', updatedAt: 5, knownBy: [], due: '' });
m.cast.push({ name: 'Rin', core: 'calm', speech: 'short, dry', growth: [], quotes: [{ text: 'Fine.' }] });

T.refreshInjection();
const main1 = prompts[T.PROMPT_KEY_MAIN];
assert.ok(main1.includes('Rin wears the ring'));
assert.ok(!main1.includes('Harbor |') && !main1.includes('Mood: tense'), 'scene is not in the stable block');
assert.ok(prompts[T.PROMPT_KEY_ANCHOR].includes('Place: Harbor'), 'scene is in [Now]');
assert.ok(prompts[T.PROMPT_KEY_ANCHOR].includes('"Fine."'), 'voice samples are in [Now]');

// live update: scene and an entry change; the stable block must not change
m.ledger.scene.place = 'Warehouse';
m.ledger.entries[0].value = 'Rin threw the ring into the sea';
m.ledger.entries.push({ id: 'b', cat: 'thread', key: 'Meet at dawn', value: 'promised', importance: 3, status: 'open', updatedAt: 9, knownBy: [], due: '' });
T.refreshInjection();
assert.strictEqual(prompts[T.PROMPT_KEY_MAIN], main1, 'stable block unchanged by live changes');
const now = prompts[T.PROMPT_KEY_ANCHOR];
assert.ok(now.includes('Place: Warehouse'));
assert.ok(now.includes('Ring: Rin threw the ring into the sea') && now.includes('Meet at dawn: promised'), now);

// a new summary changes the stable block and folds the changes in
m.timeline.push({ id: 'e2', tier: 'episode', from: 11, to: 20, title: 'Sea', text: 'The ring was lost at sea.', importance: 4, keywords: [] });
T.refreshInjection();
const main2 = prompts[T.PROMPT_KEY_MAIN];
assert.notStrictEqual(main2, main1);
assert.ok(main2.includes('Rin threw the ring into the sea'));
assert.ok(!prompts[T.PROMPT_KEY_ANCHOR].includes('Changed since'), 'diff cleared after checkpoint');

// many live changes at once: rebuild instead of a long [Now]
for (let i = 0; i < 14; i++) m.ledger.entries.push({ id: `x${i}`, cat: 'fact', key: `F${i}`, value: `v${i}`, importance: 2, status: 'open', updatedAt: 20, knownBy: [], due: '' });
T.refreshInjection();
assert.ok(prompts[T.PROMPT_KEY_MAIN].includes('F13: v13'), 'rebuilt when the diff got long');

// a hand edit (rev bump) rebuilds too
m.ledger.entries[0].value = 'edited by hand';
m.rev = (m.rev || 0) + 1;
T.refreshInjection();
assert.ok(prompts[T.PROMPT_KEY_MAIN].includes('edited by hand'));

// setting off: old layout
s.stableBlock = false;
T.refreshInjection();
assert.ok(prompts[T.PROMPT_KEY_MAIN].includes('Place: Warehouse'), 'old layout keeps the scene in the block');
console.log('stable block ok');
