// Timeline table: scene and event rows, inherited times, markdown/CSV export.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

const h = load();
const T = h.get('({ getMemory, timelineTableRows, timelineTableText, timelineTableBody })');
const m = T.getMemory(true);
m.timeline.push(
    { id: 'a', tier: 'episode', from: 0, to: 9, title: '항구 도착', when: '1일째 밤', text: '깡이 항구에 도착했다.', importance: 4, keywords: [] },
    { id: 'b', tier: 'episode', from: 10, to: 19, title: '등대', when: '', text: '등대에서 | 맹세.\n둘째 줄', importance: 5, keywords: [], starred: true },
);
m.events.push(
    { id: 'e1', episodeId: 'a', from: 2, to: 2, text: '배에서 내림', characters: ['깡'], place: '항구', when: '', importance: 3 },
    { id: 'e2', episodeId: 'a', from: 5, to: 5, text: '길드 빚', characters: ['깡', '길드장'], place: '길드', when: '1일째 자정', importance: 4 },
    { id: 'e3', episodeId: 'b', from: 12, to: 12, text: '맹세', characters: ['깡', '린'], place: '등대', when: '', importance: 5 },
);

const scenes = T.timelineTableRows(m, 'scene');
assert.strictEqual(scenes.length, 2);
assert.strictEqual(scenes[0].place, '항구, 길드');
assert.ok(scenes[0].who.startsWith('깡'));
assert.strictEqual(scenes[1].when, '1일째 밤', 'scene without time inherits the previous one');
assert.ok(scenes[1].carried);

const events = T.timelineTableRows(m, 'event');
assert.strictEqual(events.length, 3);
assert.strictEqual(events[0].when, '1일째 밤', 'event without time takes its scene time');
assert.ok(events[0].carried);
assert.strictEqual(events[2].when, '1일째 자정', 'event in a timeless scene carries the last known time');
assert.strictEqual(events[1].when, '1일째 자정');
assert.strictEqual(events[2].scene, '등대');

const md = T.timelineTableText(scenes, 'scene', 'md');
assert.ok(md.startsWith('| 순서 | 작중 시간 |'));
assert.ok(md.includes('등대에서 \\| 맹세. 둘째 줄'), 'pipes escaped, newlines flattened');
const csv = T.timelineTableText(events, 'event', 'csv');
assert.ok(csv.startsWith('﻿순서,'), 'BOM for Excel');
assert.ok(csv.includes('"깡, 길드장"'), 'commas quoted');

const html = T.timelineTableBody(scenes, 'scene');
assert.ok(html.includes('data-jump="10"') && html.includes('carried'));
assert.ok(T.timelineTableBody([], 'event').includes('사건이 없어요'));
console.log('timeline table ok');
