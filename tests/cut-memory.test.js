// Branch / cut: memory made up to #299, branch at #150. Everything that happened from #150 on goes,
// merged summaries that run past the cut are taken apart, and what can't be put back is shown again.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

const ep = (id, from, to, extra = {}) => ({ id, tier: 'episode', from, to, title: id, text: `text ${id}`, importance: 3, keywords: [], msgCount: to - from + 1, ...extra });
const arch = (id, from, to, ownerId, tier = 'episode') => ({ id, ownerId, kind: 'timeline', tier, title: id, text: `text ${id}`, keywords: [], importance: 3, from, to });

function makeChat(h, len, owners, hiddenTo) {
    h.context.chat.length = 0;
    for (let i = 0; i < len; i++) {
        const owner = owners(i);
        h.context.chat.push({ name: i % 2 ? 'Kang' : 'User', is_user: !(i % 2), is_system: i <= hiddenTo && !!owner, mes: `m${i}`, extra: owner ? { lm_owner: owner, ...(i <= hiddenTo ? { lm_hidden: true } : {}) } : {} });
    }
}

(async () => {
    const h = load();
    const T = h.get('({ getMemory, foreignTailCut, planCut, cutMemoryAt, getSettings })');

    // ---- A: episodes only. Branch kept #0-#149 and added 10 new messages.
    {
        const m = T.getMemory(true);
        for (let k = 0; k < 15; k++) m.timeline.push(ep(`e${k}`, k * 20, k * 20 + 19));
        m.cursor = 299;
        m.hiddenRanges = [[0, 279]];
        m.events = [{ id: 'v1', episodeId: 'e1', from: 30, to: 30, text: 'early' }, { id: 'v2', episodeId: 'e12', from: 250, to: 250, text: 'later' }, { id: 'v3', episodeId: 'e7', from: 145, to: 145, text: 'redone' }];
        m.hooks = [{ id: 'h1', text: 'old', from: 10, status: 'resolved', resolvedAt: 220, how: 'x' }, { id: 'h2', text: 'new', from: 200, status: 'open' }];
        m.ledger.entries = [
            { id: 'l1', cat: 'item', key: 'ring', value: 'old', updatedAt: 50, status: 'active' },
            { id: 'l2', cat: 'relation', key: 'Kang -> Rin', value: 'trusts after the fight', updatedAt: 250, status: 'active' },
            { id: 'l3', cat: 'fact', key: 'new thing', value: 'v', updatedAt: 260, status: 'active' },
        ];
        // an undo snapshot from when memory reached #139 knows l2's earlier value
        m.history = [{ label: 'old', at: 1, snap: JSON.stringify({ cursor: 139, ledger: { entries: [{ id: 'l2', cat: 'relation', key: 'Kang -> Rin', value: 'wary', updatedAt: 120, status: 'active' }], scene: { place: 'harbor' } } }) }];
        m.cast = [{ name: 'Kang', growth: [{ text: 'early', at: 40 }, { text: 'late', at: 230 }], quotes: [{ text: 'a', at: 12 }, { text: 'b', at: 270 }] }];
        m.canon.facts = [{ text: 'early fact', cites: ['e1'] }, { text: 'late fact', cites: ['e12'] }];
        makeChat(h, 160, i => (i < 150 ? `e${Math.floor(i / 20)}` : null), 279);

        assert.strictEqual(T.foreignTailCut(m), 150, 'branch point found from tags');
        const done = T.cutMemoryAt(m, 150);
        assert.strictEqual(JSON.stringify(m.timeline.map(n => n.id)), JSON.stringify(['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6']));
        assert.strictEqual(m.cursor, 139);
        assert.strictEqual(done.resummarize, 10, '#140-#149 summarized again');
        const chat = h.context.chat;
        assert.ok(!chat[145].is_system && !chat[145].extra.lm_hidden && !chat[145].extra.lm_owner, 'straddling originals shown');
        assert.ok(chat[100].is_system && chat[100].extra.lm_owner === 'e5', 'kept part stays hidden');
        assert.strictEqual(JSON.stringify(m.hiddenRanges), JSON.stringify([[0, 139]]));
        assert.strictEqual(m.events.map(e => e.id).join(), 'v1');
        assert.strictEqual(m.hooks.map(x => x.id).join(), 'h1');
        assert.strictEqual(m.hooks[0].status, 'open', 'paid off after the cut: open again');
        assert.strictEqual(m.ledger.entries.map(e => `${e.id}:${e.value}`).join(), 'l1:old,l2:wary', 'older value back, new entry gone');
        assert.strictEqual(m.ledger.scene.place, 'harbor');
        assert.strictEqual(m.cast[0].growth.map(g => g.text).join(), 'early');
        assert.strictEqual(m.cast[0].quotes.map(q => q.text).join(), 'a');
        assert.strictEqual(m.canon.facts.map(f => f.text).join(), 'early fact');
        assert.strictEqual(T.foreignTailCut(m), -1, 'nothing left to cut');
        assert.ok(m.history.some(x => /#150 이후/.test(x.label)), 'undo point');
    }

    // ---- B: story-so-far covers #0-#199 (chapters c1 #0-#99, c2 #100-#199 and their episodes are
    //      archived under it), episodes after that. Cut at #150.
    {
        h.context.chatMetadata.long_memory = undefined;
        const m = T.getMemory(true);
        m.saga = { text: 'everything up to 199, including the betrayal at 180', coversTo: 199 };
        m.archive = [arch('c1', 0, 99, 'saga', 'chapter'), arch('c2', 100, 199, 'saga', 'chapter')];
        for (let k = 0; k < 10; k++) m.archive.push(arch(`a${k}`, k * 20, k * 20 + 19, 'saga'));
        m.archive.push({ id: 'old-ledger', ownerId: null, kind: 'ledger', title: 'x', text: 'y', keywords: [], importance: 2 });
        for (let k = 10; k < 15; k++) m.timeline.push(ep(`e${k}`, k * 20, k * 20 + 19));
        m.cursor = 299;
        m.hiddenRanges = [[0, 279]];
        m.canon.facts = [{ text: 'saga fact', cites: ['saga'] }, { text: 'c1 fact', cites: ['c1'] }, { text: 'a8 fact', cites: ['a8'] }];
        makeChat(h, 150, i => 'saga', 279);

        assert.strictEqual(T.foreignTailCut(m), 150, 'branch point found under the story-so-far too');
        const plan = T.planCut(m, 150);
        assert.ok(plan.sagaGoes);
        const done = T.cutMemoryAt(m, 150);
        // c1 comes back whole, c2 is taken apart: a5 (#100-#119), a6 (#120-#139); a7 crosses the cut
        assert.strictEqual(JSON.stringify(m.timeline.map(n => `${n.id}:${n.tier}`)), JSON.stringify(['c1:chapter', 'a5:episode', 'a6:episode']));
        assert.strictEqual(m.saga.text, '');
        assert.strictEqual(m.cursor, 139);
        assert.strictEqual(done.restored, 3);
        assert.strictEqual(JSON.stringify(m.archive.map(a => `${a.id}>${a.ownerId}`).sort()), JSON.stringify(['a0>c1', 'a1>c1', 'a2>c1', 'a3>c1', 'a4>c1', 'old-ledger>null']), 'c1 keeps its parts; future pieces gone');
        assert.strictEqual(m.canon.facts.map(f => f.text).join(), 'c1 fact', 'facts from the dropped story-so-far and after the cut go');
        const chat = h.context.chat;
        assert.strictEqual(chat[50].extra.lm_owner, 'c1');
        assert.strictEqual(chat[125].extra.lm_owner, 'a6');
        assert.ok(!chat[145].is_system && !chat[145].extra.lm_owner, '#140-#149 shown again');
    }
    console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
