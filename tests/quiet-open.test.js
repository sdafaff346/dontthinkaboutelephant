// Opening a chat makes no embedding/model call; the first action in it does.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

let vectorCalls = 0;
const h = load({ fetchImpl: async (url) => { if (String(url).includes('/api/vector/')) vectorCalls++; return { ok: true, json: async () => [] }; } });
const T = h.get('({ getSettings, getMemory, onChatChanged, runDeferredSync })');
const s = T.getSettings();
s.vectorEnabled = true; s.embedSource = 'openai'; s.autoIndex = true;
T.getMemory(true).timeline.push({ id: 'e', tier: 'episode', from: 0, to: 5, title: 't', text: 'x', importance: 3, keywords: [] });
T.onChatChanged();
setTimeout(() => {
    assert.strictEqual(vectorCalls, 0, 'nothing on open');
    T.runDeferredSync();
    setTimeout(() => {
        assert.ok(vectorCalls > 0, 'indexing starts after the first action');
        console.log('quiet open ok');
        process.exit(0);
    }, 300);
}, 300);
