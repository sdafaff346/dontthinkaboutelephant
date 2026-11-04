// Status bars are read from replies (no model call); prose and dialogue are not mistaken for them.
'use strict';
const assert = require('assert');
const { load } = require('./harness');
const { get } = load();
const T = get('({ findStatusBars })');
let b = T.findStatusBars('[ 🌙 오후 8:15 · 1943년 12월 9일 (목) · 호그와트 → 병동 · ❄️ 눈발, -1°C ]\n\n본문');
assert.strictEqual(b.length, 1);
assert.strictEqual(b[0].place, '호그와트 → 병동');
assert.strictEqual(b[0].weather, '눈발, -1°C');
b = T.findStatusBars('[ ☀️ 오전 7:30 · 1943년 12월 10일 (금) · 대연회장 · 맑음, 1°C ]');
assert.strictEqual(b[0].when, '오전 7:30 1943년 12월 10일 (금)', 'a sun icon on a time is not weather');
b = T.findStatusBars('📅 날짜: 12월 10일\n⏰ 시간: 오전 7:30\n📍 장소: 휴게실');
assert.strictEqual(b.length, 1);
for (const t of ['"오후 8시 15분에 병동에서 만나." 그녀가 말했다.', '그는 1943년 12월 9일, 호그와트에서 처음 그녀를 보았다.', '이름: 깡\n나이: 24']) assert.strictEqual(T.findStatusBars(t).length, 0, t);
console.log('status bar ok');
