// New SillyTavern Custom key binding: an old Custom summary profile refused before sending falls
// back to the chat's connection at once, explains the fix, and "still being applied" just waits.
'use strict';
const assert = require('assert');
const { load } = require('./harness');
(async () => {
    const h = load();
    const T = h.get('({ getSettings, callModel })');
    const s = T.getSettings();
    Object.assign(s, { profileId: 'sum', retries: 1, fallbackProfileId: '' });
    h.context.extensionSettings.connectionManager = { profiles: [{ id: 'sum', name: '요약B', api: 'custom', mode: 'cc' }] };
    h.state.reply = 'done';

    const bind = new Error('API request failed', { cause: new Error('The key is not approved for this exact API root. Select it again.') });
    h.state.fail = ({ profileId }) => (profileId === 'sum' ? bind : null);
    h.state.calls.length = 0;
    const out = await T.callModel('sys', 'user');
    assert.strictEqual(out, 'done', 'the summary still happens');
    const kinds = h.state.calls.map(c => c.kind + (c.profileId ? ':' + c.profileId : ''));
    assert.strictEqual(JSON.stringify(kinds), JSON.stringify(['profile:sum', 'raw']), 'one refused try, then the chat connection');
    const notice = h.toasts.find(t => t.startsWith('warn:'));
    assert.ok(notice && /API 키를 다시 골라/.test(notice) && /프로필 저장\(업데이트\)/.test(notice), notice);

    // "still being applied": wait once and send the same profile request again
    let n = 0;
    h.state.fail = ({ profileId }) => (profileId === 'sum' && n++ === 0 ? new Error('A connection profile is still being applied.') : null);
    h.state.calls.length = 0;
    assert.strictEqual(await T.callModel('sys', 'user'), 'done');
    assert.strictEqual(JSON.stringify(h.state.calls.map(c => c.kind)), JSON.stringify(['profile', 'profile']), 'retried on the same profile');
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
