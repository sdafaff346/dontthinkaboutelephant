// Per-job models: off = everything on the summary model; on = a job's own pick, '' follows the
// summary model, '@current' is the chat's own API, a deleted profile falls back.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

(async () => {
    const h = load();
    const T = h.get('({ getSettings, taskProfile, callModel, MODEL_TASKS })');
    const s = T.getSettings();
    h.context.extensionSettings.connectionManager = { profiles: [{ id: 'big', name: 'Big', mode: 'cc' }, { id: 'cheap', name: 'Cheap', mode: 'cc' }] };
    s.profileId = 'big';
    s.taskProfiles = { check: 'cheap', recall: '@current', helper: 'gone' };

    s.perTaskModels = false;
    for (const t of Object.keys(T.MODEL_TASKS)) assert.strictEqual(T.taskProfile(t), 'big', `off: ${t} uses the summary model`);

    s.perTaskModels = true;
    assert.strictEqual(T.taskProfile('compress'), 'big', 'no pick: summary model');
    assert.strictEqual(T.taskProfile('check'), 'cheap');
    assert.strictEqual(T.taskProfile('recall'), '', 'chat API');
    assert.strictEqual(T.taskProfile('helper'), 'big', 'deleted profile falls back');
    assert.strictEqual(T.taskProfile(''), 'big', 'untagged call (connection test)');

    // every model call except the connection test names its job
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
    const calls = src.split('\n').filter(l => l.includes('callModel(') && !l.includes('function callModel') && !/profileId: (primary|fallback)/.test(l));
    const untagged = calls.filter(l => !/task: '(\w+)'/.test(l));
    assert.strictEqual(untagged.length, 1, untagged.join('\n'));
    assert.ok(untagged[0].includes('connection test'));
    for (const l of calls) { const m = l.match(/task: '(\w+)'/); if (m) assert.ok(T.MODEL_TASKS[m[1]], `unknown job ${m[1]}`); }
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
