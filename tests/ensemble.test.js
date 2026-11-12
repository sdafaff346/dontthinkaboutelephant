// 다인봇 / simulation / RPG cards: the card name labels every AI message but is not a character.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
const h = load({ chat: makeChat(4) });
const c = h.context; c.name1 = '유저'; c.name2 = '학원 시뮬';
const T = h.get('({ getMemory, ensembleCardName, summaryUserPrompt })');
const m = T.getMemory(true);
assert.strictEqual(T.ensembleCardName(m), '', 'no cast yet: unknown');
m.cast.push({ name: '서윤', core: 'x', speech: '', growth: [], quotes: [] }, { name: '도현', core: 'y', speech: '', growth: [], quotes: [] });
assert.strictEqual(T.ensembleCardName(m), '학원 시뮬');
const prompt = T.summaryUserPrompt(m, { from: 0, to: 3, lines: ['학원 시뮬: 서윤이 웃었다.'] });
assert.ok(prompt.includes('never to "학원 시뮬"'), 'summary told to attribute to named characters');
// a normal 1:1 card whose own character is in the cast
m.cast.push({ name: '학원 시뮬', core: 'z', speech: '', growth: [], quotes: [] });
assert.strictEqual(T.ensembleCardName(m), '');
// group chats are never this case
m.cast.pop(); c.groupId = 'g1';
assert.strictEqual(T.ensembleCardName(m), '');
console.log('ensemble ok');
