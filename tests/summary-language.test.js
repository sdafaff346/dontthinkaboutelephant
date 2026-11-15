// Summary language: the reminder reaches memory-writing calls only, and "맞추기" translates
// Korean notes into English in place, skipping text that is already English.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

(async () => {
    const h = load();
    const T = h.get('({ getSettings, getMemory, callModel, languageReminder, rewriteLanguageRule, foreignFields, runAlignLanguage })');
    const s = T.getSettings();

    // follows the chat: no reminder, condense keeps the text's language
    s.language = 'chat';
    assert.strictEqual(T.languageReminder(), '');
    assert.ok(T.rewriteLanguageRule('the text').includes('same language'));

    s.language = 'en';
    let seen = '';
    h.state.reply = (args) => { seen = args.prompt; return 'ok'; };
    await T.callModel('sys', 'TRANSCRIPT', { writesMemory: true });
    assert.ok(seen.includes('TRANSCRIPT') && /write everything in English/.test(seen), 'reminder at the end');
    assert.ok(seen.trim().endsWith('stay in the original.'));
    await T.callModel('sys', 'QUESTION');
    assert.ok(!/write everything in English/.test(seen), 'other calls untouched');
    await T.callModel('sys', 'REPLY', { writesMemory: 'ledger' });
    assert.ok(/ledger value in English/.test(seen) && /"quote" and "evidence" stay exact/.test(seen));
    assert.ok(T.rewriteLanguageRule('each entry').includes('Write the result in English'));

    // 맞추기
    const m = T.getMemory(true);
    m.saga.text = 'Kang owes the guild 300 gold.';
    m.timeline.push({ id: 'e1', tier: 'episode', from: 0, to: 9, title: '등대의 약속', when: '', text: '깡과 린이 새벽 등대에서 만나기로 맹세했다.', importance: 3, keywords: [] });
    m.ledger.entries.push({ id: 'l1', cat: 'relation', key: '깡 -> 린', value: '믿지만 거리를 둔다', status: 'active', importance: 3 });
    m.cast.push({ name: '깡', core: 'A quiet sailor.', speech: '반말, 짧게 끊어 말함', growth: [], quotes: [{ text: '늦었네.' }] });
    const before = T.foreignFields(m, 'English').map(f => f.key);
    assert.strictEqual(JSON.stringify(before.sort()), JSON.stringify(['speech', 'text', 'title', 'value']));
    h.state.reply = (args) => {
        let o; try { o = JSON.parse(args.prompt.split('\n\n')[0]); } catch { return 'Translated.'; }
        return JSON.stringify(Object.fromEntries(Object.keys(o).map(k => [k, 'EN ' + k])));
    };
    await T.runAlignLanguage();
    assert.strictEqual(T.foreignFields(m, 'English').length, 0, 'all Korean notes moved to English');
    assert.strictEqual(m.saga.text, 'Kang owes the guild 300 gold.', 'English text untouched');
    assert.strictEqual(m.ledger.entries[0].key, '깡 -> 린', 'relation keys (names) untouched');
    assert.strictEqual(m.cast[0].quotes[0].text, '늦었네.', 'quotes untouched');
    assert.ok(m.history.some(x => /언어 맞추기/.test(x.label)), 'undo point');
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });

// Every tool button in the memory window has to be on the click handler's list, or it does nothing.
{
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
    const list = src.match(/const tool = event\.target\.closest\('([^']+)'\)/)[1];
    const cases = [...src.matchAll(/case '(lm_[a-z_]+)':/g)].map(m => m[1]);
    const menuIds = [...src.matchAll(/\$\{tool\('(lm_[a-z_]+)'/g)].map(m => m[1]);
    for (const id of menuIds) {
        if (!cases.includes(id)) continue;
        assert.ok(list.includes(`#${id},`) || list.includes(`#${id}'`) || list.includes(`#${id} `), `${id} missing from the click list`);
    }
}
