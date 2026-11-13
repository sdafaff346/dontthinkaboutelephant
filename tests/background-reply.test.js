// ST-Background-Reply: a partial reply left behind when the user switches chats is marked
// extra.bg_reply; the extension ignores it and handles the full reply when it arrives.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
const h = load({ chat: makeChat(4) });
const T = h.get('({ isPendingBackgroundReply })');
const chat = h.context.chat;
chat.push({ name: 'Bot', is_user: false, mes: 'half a rep', extra: { bg_reply: { id: 'j1' } }, swipe_id: 0, swipe_info: [{ extra: { bg_reply: { id: 'j1' } } }] });
assert.strictEqual(T.isPendingBackgroundReply(chat.length - 1), true);
// a new swipe being generated in the background: marker only on the swipe info
chat.push({ name: 'Bot', is_user: false, mes: 'old', extra: {}, swipe_id: 1, swipe_info: [{ extra: {} }, { extra: { bg_reply: { id: 'j2' } } }] });
assert.strictEqual(T.isPendingBackgroundReply(chat.length - 1), true);
// filled in: marker cleared
delete chat[chat.length - 2].extra.bg_reply; chat[chat.length - 2].swipe_info[0].extra = {};
assert.strictEqual(T.isPendingBackgroundReply(chat.length - 2), false);
assert.strictEqual(T.isPendingBackgroundReply(0), false);
console.log('background reply ok');
