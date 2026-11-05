// Another extension rewrites a summarized message and only sends MESSAGE_UPDATED.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');

const h = load({ chat: makeChat(6) });
const T = h.get('({ getMemory, tagMessages, onMessageUpdated, onMessageEdited, ctx })');
const m = T.getMemory(true);
m.timeline.push({ id: 'n1', tier: 'episode', from: 0, to: 3, title: 't', text: 'x', importance: 3, keywords: [] });
T.tagMessages([0, 1, 2, 3], 'n1');
const chat = T.ctx().chat;
assert.ok(chat[1].extra.lm_sig, 'fingerprint stored when summarized');

T.onMessageUpdated(1);
assert.ok(!m.timeline[0].stale, 'a redraw with the same text changes nothing');

chat[1].mes = 'rewritten by another extension';
T.onMessageUpdated(1);
assert.ok(m.timeline[0].stale, 'changed text marks the episode for re-summary');

// older data without a fingerprint: first update only records it
m.timeline[0].stale = false;
delete chat[2].extra.lm_sig;
T.onMessageUpdated(2);
assert.ok(!m.timeline[0].stale && chat[2].extra.lm_sig);
T.onMessageUpdated(5);   // not summarized: nothing to do
console.log('message updated ok');
