// 1.9.76: summary prompts built for light models, relation captions for the drama chart,
// and <changes> (relation / emotion / other changes) stored per episode.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(60) });
    const T = h.get('({ getSettings, getMemory, runCompress, resummarizeNode, summarySystemPrompt, summaryUserPrompt, parseNodeBlock, extractTag, parseJsonLenient, parseChanges, relationGraph, relationSvg, relationCards, managerHtml, runFindShifts, shiftlessEpisodes, unlabeledRelations, edgeLabel })');
    const s = T.getSettings();
    Object.assign(s, { vectorEnabled: false, retries: 0, voiceEnabled: false, hooksEnabled: false, keepRecent: 10, batchMessages: 25, hideSummarized: true, canonEnabled: false, autoCompact: false, previewBeforeSave: false, verifySummaries: false });

    // --- prompt shape
    const sys = T.summarySystemPrompt();
    assert.ok(sys.includes('=== OUTPUT FORMAT ==='), 'format section');
    assert.ok(sys.includes('=== EXAMPLE OF THE SHAPE ==='), 'filled example');
    assert.ok(sys.includes('=== COMMON MISTAKES'), 'mistakes list');
    assert.ok(sys.includes('<changes>'), 'changes block described');
    assert.ok(/"label".*drama/.test(sys) && sys.includes('"tone"'), 'relation label and tone asked for');
    assert.ok(sys.includes('[CRITICAL SYSTEM DIRECTIVE'), "the user's rules text is left as it was");
    const m0 = T.getMemory(true);
    const user = T.summaryUserPrompt(m0, { from: 0, to: 3, lines: ['a', 'b'] });
    assert.ok(/Before you answer, check:[\s\S]*Names are spelled exactly/.test(user.slice(-600)), 'checklist is the last thing');
    assert.ok(user.includes('<episode>, <ledger>, <events>, <changes>'), 'block order in the checklist');
    s.changesEnabled = false;
    assert.ok(!T.summarySystemPrompt().includes('<changes>'), 'off: no changes block');
    assert.ok(!T.summarySystemPrompt().includes('"tone"'), 'off: no label request');
    s.changesEnabled = true;

    // --- forgiving parsing
    const n = T.parseNodeBlock('**제목**: 깡의 귀환\n중요도: 4/5\n키워드: 깡, 항구\n요약:\n깡이 돌아왔다.');
    assert.strictEqual(n.title, '깡의 귀환');
    assert.strictEqual(n.importance, 4, '"4/5" reads as 4');
    assert.strictEqual(n.text, '깡이 돌아왔다.');
    assert.strictEqual(JSON.stringify(n.keywords), '["항구"]', 'Korean label for keywords');
    const runOn = '<episode>\ntitle: A\nsummary: text here\n<ledger>[{"op":"scene","time":"night"}]</ledger>';
    assert.ok(!T.extractTag(runOn, 'episode').includes('ledger'), 'an unclosed episode stops at the next block');
    assert.strictEqual(T.parseJsonLenient('[{op: "set", cat: "item", key: "k", value: "v", pinned: False}]')[0].op, 'set', 'bare keys');
    assert.strictEqual(T.parseJsonLenient('[{"a":1}\n{"a":2}]').length, 2, 'missing comma between objects');
    const ch = T.parseChanges('[{"kind":"emotion","who":"린","toward":"깡","from":"분노","to":"경계","why":"편지를 돌려받음"},{"kind":"weird","who":"깡","to":"항구 떠남"},{"who":""}]');
    assert.strictEqual(ch.length, 2);
    assert.strictEqual(ch[0].before, '분노');
    assert.strictEqual(ch[1].kind, 'change', 'unknown kind becomes change');

    // --- compress stores labels and changes
    let k = 0;
    h.state.reply = () => {
        k++;
        return `<episode>\ntitle: E${k}\nimportance: 3\nkeywords: a\nsummary: Part ${k}.\n</episode>
<ledger>[{"op":"set","cat":"relation","key":"린 -> 깡","value":"아직 용서하지 않음 ${k}","label":"${k === 1 ? '옛 연인' : '애증'}","tone":"${k === 1 ? 'complicated' : 'love'}","importance":4},{"op":"set","cat":"relation","key":"깡 -> 린","value":"용서를 바람","label":"죄책감","tone":"nonsense"}]</ledger>
<events>[]</events>
<changes>[{"kind":"relation","who":"린","toward":"깡","from":"남","to":"동료","why":"part ${k}"}]</changes>`;
    };
    await T.runCompress({ all: true });
    const m = T.getMemory(false);
    assert.strictEqual(m.timeline.length, 2);
    assert.strictEqual(m.shifts.length, 2, 'one change per episode');
    assert.ok(m.shifts.every(x => m.timeline.some(t => t.id === x.episodeId)), 'tied to its episode');
    assert.strictEqual(m.shifts[0].start, m.timeline[0].from);
    const rel = m.ledger.entries.find(e => e.key === '린 -> 깡');
    assert.strictEqual(rel.label, '애증', 'label updated by the later episode');
    assert.strictEqual(rel.tone, 'love');
    const back = m.ledger.entries.find(e => e.key === '깡 -> 린');
    assert.strictEqual(back.label, '죄책감');
    assert.ok(!back.tone, 'unknown tone dropped');
    assert.ok(m.timeline.every(t => t.shiftScan), 'episodes marked as scanned');

    // --- chart
    const g = T.relationGraph(m);
    const svg = T.relationSvg(g);
    assert.ok(svg.includes('애증') && svg.includes('죄책감'), 'captions drawn on the lines');
    assert.ok(svg.includes('tone-love') && svg.includes('lm-rel-tag'), 'colored by kind');
    assert.ok(T.relationCards(g).includes('lm-rel-wire-tag'), 'A ──caption──▶ B rows');
    assert.strictEqual(T.edgeLabel({ label: '', tone: 'rival', value: 'x' }), '라이벌', 'kind as fallback caption');
    const html = T.managerHtml(m);
    assert.ok(html.includes('data-lm-tab="shifts"') && html.includes('data-lm-pane="shifts"'), '관계·변화 tab');
    assert.ok(html.includes('data-shift-pane="emo"') && html.includes('data-shift-pane="log"'), '감정 변화 and 변화 기록 views');
    assert.ok(html.includes('lm-rlabel'), 'caption is editable in the ledger');
    assert.ok(html.includes('data-edit-entry=') && html.includes('lm-person-chip') && html.includes('lm-rel-zoom-in'), 'edit links, person chips and zoom');
    assert.ok(html.includes('lm-jump-msg'), 'ranges jump to the scene');

    // --- summarizing an episode again replaces its changes instead of adding to them
    const first = m.timeline[0];
    await T.resummarizeNode(first.id);
    assert.strictEqual(m.shifts.filter(x => x.episodeId === first.id).length, 1, 'old changes of that episode replaced');
    assert.strictEqual(m.shifts.length, 2);

    // --- backfill for older memories
    m.shifts = [];
    m.timeline.forEach(t => { delete t.shiftScan; });
    m.timeline.unshift({ id: 'old1', tier: 'chapter', from: -1, to: -1, title: 'Earlier', text: 'They met.', importance: 3, keywords: [] });
    for (const e of m.ledger.entries) { delete e.label; delete e.tone; }
    assert.strictEqual(T.shiftlessEpisodes(m).length, 3);
    assert.strictEqual(T.unlabeledRelations(m).length, 2);
    assert.ok(T.managerHtml(m).includes('lm-shift-callout'), 'the tab offers to fill older memories');
    assert.ok(h.get('typeof needsTranslation') === 'function' && h.get('typeof toggleTranslation') === 'function', 'translation helpers present');
    h.state.reply = (args) => {
        const text = JSON.stringify(args);
        if (text.includes('relationship chart')) return '<labels>[{"id":"R1","label":"애증","tone":"love"},{"id":"R2","label":"죄책감","tone":"complicated"}]</labels>';
        return '<changes>[{"kind":"emotion","who":"깡","toward":"린","from":"무심","to":"신경 쓰임","why":"재회","episode":"E1"},{"kind":"change","who":"린","from":"항구","to":"수도","episode":"E2"}]</changes>';
    };
    await T.runFindShifts();
    assert.strictEqual(m.shifts.length, 2, 'changes found from stored summaries');
    assert.strictEqual(m.shifts[0].episodeId, 'old1', 'placed on the note it came from');
    assert.strictEqual(m.shifts[0].start, -1, 'earlier-chat range kept');
    assert.strictEqual(m.ledger.entries.find(e => e.key === '린 -> 깡').label, '애증');
    assert.strictEqual(T.shiftlessEpisodes(m).length, 0, 'nothing left to scan');
    assert.strictEqual(T.unlabeledRelations(m).length, 0);
    // --- mixed feelings, said plainly; big casts; {{user}} written literally
    const T2 = h.get('({ applyLedgerOps, relationGraph, trimGraph, egoGraph, relationSvg, summarySystemPrompt })');
    assert.ok(/mixed[\s\S]*no hedging/.test(T2.summarySystemPrompt()), 'asks for the emotional core, stated plainly');
    m.ledger.entries = [];
    T2.applyLedgerOps(m, [{ op: 'set', cat: 'relation', key: '{{user}} -> 린', value: 'v', label: '미묘한 혐오 속 끌림?', tone: 'complicated' }], 5);
    assert.strictEqual(m.ledger.entries[0].label, '미묘한 혐오 속 끌림', 'question mark dropped');
    assert.ok(!T2.relationGraph(m).nodes.some(n => n.name.includes('{{')), 'macro becomes the persona name');
    for (let i = 0; i < 20; i++) T2.applyLedgerOps(m, [{ op: 'set', cat: 'relation', key: `NPC${i} -> 길드장`, value: 'v', label: '부하' }], 5);
    const big = T2.relationGraph(m);
    const shown = T2.trimGraph(big, 14);
    assert.strictEqual(shown.nodes.length, 14);
    assert.strictEqual(shown.hidden, big.nodes.length - 14);
    assert.ok(shown.nodes.some(n => n.name === '길드장'), 'best-connected kept');
    const ego = T2.egoGraph(big, big.nodes.find(n => n.name === 'NPC19').key);
    assert.strictEqual(ego.nodes.length, 2);
    assert.ok(T2.relationSvg(ego).includes(`data-edge="${ego.edges[0].idx}"`), 'edge ids stay those of the full chart');
    console.log('relation-changes ok');
})().catch(e => { console.error(e); process.exit(1); });
