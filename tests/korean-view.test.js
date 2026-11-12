// 한국어로 보기 translates in the background: no window waits on it, the chat stays usable,
// and once done the view opens straight from the cache.
'use strict';
const assert = require('assert');
const { load, until } = require('./harness');
(async () => {
    const h = load();
    const T = h.get('({ getMemory, openKoreanView, translateTexts })');
    const m = T.getMemory(true);
    m.timeline.push({ id: 'a', tier: 'episode', from: 0, to: 3, title: 'Arrival', when: 'night', text: 'Kang arrives at the port.', importance: 3, keywords: [] });
    let calls = 0;
    let release;
    const gate = new Promise(r => { release = r; });
    h.state.reply = async (args) => { calls++; await gate; let o; try { o = JSON.parse(args.prompt); } catch { return '번역됨'; } return JSON.stringify(Object.fromEntries(Object.keys(o).map(k => [k, '번역 ' + k]))); };
    let popups = 0;
    h.context.Popup = class { constructor() { popups++; } async show() {} };
    h.context.Popup.show = { confirm: async () => true };
    h.context.POPUP_TYPE = { TEXT: 1 };
    const fake = () => { const el = { innerHTML: '', textContent: '', firstElementChild: null, addEventListener() {}, querySelectorAll: () => [], toggleAttribute() {} }; el.querySelector = () => fake(); return el; };
    h.sandbox.document.createElement = () => fake();
    const kv = new Map();
    h.sandbox.SillyTavern.libs.localforage = { getItem: async k => kv.get(k) ?? null, setItem: async (k, v) => { kv.set(k, JSON.parse(JSON.stringify(v))); } };
    const ret = await Promise.race([T.openKoreanView(m).then(() => 'returned'), new Promise(r => setTimeout(() => r('blocked'), 300))]);
    assert.strictEqual(ret, 'returned', 'does not wait for the translation');
    assert.strictEqual(popups, 0, 'no window while translating');
    assert.ok(h.toasts.some(t => /채팅해도 돼요/.test(t)));
    await T.openKoreanView(m);   // second click while running: just says it is busy
    assert.strictEqual(calls, 1);
    release();
    await until(() => h.toasts.some(t => /번역이 끝났어요/.test(t)), 3000);
    // now cached: opens right away without another request
    await T.openKoreanView(m);
    assert.strictEqual(calls, 1, 'served from cache');
    assert.strictEqual(popups, 1, 'window opened with the result');
    // the finished translation was saved with its time
    const saved = [...kv.values()][0];
    assert.ok(Array.isArray(saved) && saved.length === 1 && saved[0].at && saved[0].html.includes('번역'), 'saved version');
    // a new session (empty in-memory cache) opens the saved copy without translating again
    const T2 = h.get('({ TRANSLATE_CACHE })');
    T2.TRANSLATE_CACHE.clear();
    await T.openKoreanView(m);
    assert.strictEqual(calls, 1, 'saved copy, no request');
    assert.strictEqual(popups, 2);
    console.log('korean view ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
