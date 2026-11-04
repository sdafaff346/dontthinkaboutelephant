// Timeline graph: era band from free-text times, lanes by character/place, shared-event connectors.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

const h = load();
const T = h.get('({ getMemory, storyEra, timelineGraphData, timelineGraphSvg, timelineGraphDetail })');
assert.strictEqual(T.storyEra('1943년 12월 9일 (목) 오후 8:15'), '1943년');
assert.strictEqual(T.storyEra('3일째 저녁'), '3일째');
assert.strictEqual(T.storyEra('Day 4, dusk'), '4일째');
assert.strictEqual(T.storyEra('밤'), '');

const m = T.getMemory(true);
m.timeline.push(
    { id: 'a', tier: 'episode', from: 0, to: 9, title: '항구', when: '1943년 12월 9일', text: 'x', importance: 3, keywords: [] },
    { id: 'b', tier: 'episode', from: 10, to: 19, title: '등대', when: '1943년 12월 10일', text: 'y', importance: 5, keywords: [] },
    { id: 'c', tier: 'episode', from: 20, to: 29, title: '귀환', when: '1944년 1월', text: 'z', importance: 2, keywords: [] },
);
m.events.push(
    { id: 'e1', episodeId: 'a', from: 2, to: 2, text: '도착', characters: ['깡'], place: '항구', importance: 3 },
    { id: 'e2', episodeId: 'b', from: 12, to: 12, text: '맹세', characters: ['깡', '린'], place: '등대', importance: 5 },
    { id: 'e3', episodeId: 'c', from: 22, to: 22, text: '편지', characters: [], place: '', importance: 2 },
);
const d = T.timelineGraphData(m, 'who');
assert.strictEqual(d.slots.length, 3);
assert.strictEqual(d.slots.map(s => s.era).join(), '1943년,1943년,1944년');
assert.strictEqual(JSON.stringify(d.lanes), JSON.stringify(['깡', '린', '그 밖의 인물']));
assert.strictEqual(JSON.stringify(d.events[1].lanes), JSON.stringify([0, 1]), 'shared event spans both lanes');
assert.strictEqual(JSON.stringify(d.events[2].lanes), JSON.stringify([2]), 'no-character event goes to the other lane');

const svg = T.timelineGraphSvg(d, { minImp: 4 });
assert.strictEqual((svg.match(/lm-tg-link/g) || []).length, 1, 'one connector for the shared event');
assert.ok(svg.includes('1943년') && svg.includes('1944년'));
assert.ok((svg.match(/lm-tg-ev imp-3 dim/g) || []).length === 1, 'below min importance is dimmed');

const p = T.timelineGraphData(m, 'place');
assert.ok(p.lanes.includes('등대') && p.lanes.includes('그 밖의 곳'));
assert.ok(T.timelineGraphDetail(d, 'e1').includes('data-jump="12"'));
assert.ok(T.timelineGraphDetail(d, 's0').includes('항구'));
assert.ok(svg.includes('>12월 9일<') || svg.includes('12월 9일'), 'year dropped from column header');
console.log('timeline graph ok');
