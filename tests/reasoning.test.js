// Memory calls ask for minimal thinking where SillyTavern maps it safely, and stop asking on refusal.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

(async () => {
    const profiles = [{ id: 'or', name: 'OR', model: 'm1' }, { id: 'gg', name: 'Gemini', model: 'g' }, { id: 'cl', name: 'Claude', model: 'c' }];
    const h = load({ profiles, sources: { or: 'openrouter', gg: 'makersuite', cl: 'claude' }, reply: '<x>ok</x>' });
    const T = h.get('({ getSettings, callModel })');
    const s = T.getSettings(); s.retries = 0;

    await T.callModel('sys', 'user', { profileId: 'gg' });
    assert.strictEqual(h.state.calls.at(-1).override.reasoning_effort, 'min');
    await T.callModel('sys', 'user', { profileId: 'cl' });
    assert.ok(!('reasoning_effort' in h.state.calls.at(-1).override), 'other sources are not asked');
    await T.callModel('sys', 'user', { profileId: 'or' });
    assert.strictEqual(h.state.calls.at(-1).override.reasoning_effort, 'none');

    // OpenRouter refuses "none": retry with "low", and remember it
    h.state.fail = ({ override }) => (override.reasoning_effort === 'none' ? new Error('Bad Request: Reasoning is mandatory for this endpoint') : null);
    const out = await T.callModel('sys', 'user', { profileId: 'or' });
    assert.strictEqual(out, '<x>ok</x>');
    assert.strictEqual(h.state.calls.at(-1).override.reasoning_effort, 'low');
    h.state.fail = null;
    await T.callModel('sys', 'user', { profileId: 'or' });
    assert.strictEqual(h.state.calls.at(-1).override.reasoning_effort, 'low', 'remembered');

    // preset setting: ask nothing
    s.memoryReasoning = 'preset';
    await T.callModel('sys', 'user', { profileId: 'gg' });
    assert.ok(!('reasoning_effort' in h.state.calls.at(-1).override));
    console.log('reasoning ok');
})().catch(e => { console.error(e); process.exit(1); });
