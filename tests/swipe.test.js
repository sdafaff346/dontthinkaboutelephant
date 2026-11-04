// A new swipe does not inherit the old swipe's warning or live update; a late result stays on its swipe.
'use strict';
const assert = require('assert');
const { load, until } = require('./harness');
(async () => {
    const h = load();
    const T = h.get('({ getSettings, getMemory, afterTurn, onMessageReceived })');
    const s = T.getSettings();
    s.checkContradictions = true; s.liveStateUpdate = true; s.vectorEnabled = false; s.retries = 0; s.checkDoubleCheck = false; s.voiceEnabled = false; s.autoCompress = false;
    const m = T.getMemory(true); m.cursor = 3;
    m.ledger.entries.push({ id: 'a', cat: 'item', key: 'Cup', value: 'hot coffee', importance: 3, status: 'open', updatedAt: 3, knownBy: [], due: '' });
    const chat = h.context.chat;
    const msg = chat[29]; msg.mes = 'Rin drank cola.'; msg.swipe_id = 0; msg.swipes = [msg.mes]; msg.swipe_info = [{ extra: {} }];
    h.state.reply = '<issues>[{"quote":"drank cola","evidence":"hot coffee","source":"memory","problem":"drink changed"}]</issues><ledger>[{"op":"set","cat":"item","key":"Cup","value":"cola"}]</ledger>';
    await T.afterTurn(29);
    assert.strictEqual(msg.extra.lm_check.issues.length, 1);
    assert.strictEqual(m.ledger.entries[0].value, 'cola');
    msg.swipe_info[0].extra = structuredClone(msg.extra);
    msg.swipes.push('Rin drank coffee.'); msg.swipe_id = 1; msg.mes = msg.swipes[1];
    h.state.reply = '<issues>[]</issues><ledger>[]</ledger>';
    T.onMessageReceived(29, 'swipe');
    assert.ok(!msg.extra.lm_turn, 'carried live tag dropped');
    assert.strictEqual(m.ledger.entries[0].value, 'hot coffee', 'old swipe change rolled back');
    await until(() => msg.extra.lm_check);
    assert.strictEqual(msg.extra.lm_check.issues.length, 0);
    assert.strictEqual(msg.swipe_info[0].extra.lm_check.issues.length, 1, 'old swipe keeps its own warning');
    console.log('swipe ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
