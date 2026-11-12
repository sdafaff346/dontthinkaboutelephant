// Repeated-phrase finder: names, grammar words and story nouns are left out; the model pass keeps
// only tics that really occur in the replies.
'use strict';
const assert = require('assert');
const { load, makeChat } = require('./harness');
(async () => {
    const h = load({ chat: makeChat(2) });
    const c = h.context; c.name2 = '톰'; c.name1 = '멜리아';
    const lines = [
        '톰은 소파 위에 앉아 입꼬리가 미세하게 올라갔다. 멜리아의 손을 잡았다. 공기 중에 오존 냄새가 감돌았다. 서늘한 바람이 불었다.',
        '톰의 시선이 멜리아에게 닿았다. 그는 낮게 웃었다. 입꼬리가 미세하게 올라갔다. 교복 차림의 그녀가 천천히 다가왔다.',
        '톰이 마법약을 내려놓았다. 서늘한 공기 속에 오존 냄새가 났다. 그는 나지막이 말했다. 다른 손가락으로 교복을 정리했다.',
        '톰은 가볍게 웃었다. 입꼬리가 미세하게 올라갔다. 소파 위에 있던 마법약이 빛났다. 서늘한 눈빛이었다.',
        '멜리아의 손을 잡은 톰이 숨을 들이켰다. 오존 냄새. 그는 나지막이 속삭였다. 내가 없이도 괜찮겠어?',
        '톰은 천천히 고개를 끄덕였다. 입꼬리가 미세하게 올라갔다. 서늘한 시선이 교복에 닿았다.',
    ];
    c.chat = lines.map(t => ({ name: '톰', is_user: false, mes: t, extra: {} }));
    const T = h.get('({ findRepeatedPhrases, pickTicsWithModel })');
    const f = T.findRepeatedPhrases({ top: 30 });
    const texts = f.phrases.map(p => p.text);
    for (const bad of ['톰은', '톰의', '멜리아의', '소파', '교복', '마법약', '있던', '내가', '손을', '시선이', '다른', '위에']) {
        assert.ok(!texts.some(t => t === bad || t.split(' ').includes(bad)), `should skip ${bad}: ${texts.join(', ')}`);
    }
    assert.ok(texts.includes('오존 냄새'), 'particle variants merged');
    assert.ok(texts.includes('서늘한'));
    assert.ok(texts.some(t => t.startsWith('입꼬리가 미세하게')));

    h.state.reply = '- 오존 냄새 | 감각 묘사 | 공기 묘사마다 나와요\n- 입꼬리가 미세하게 | 몸짓·표정 | 표정 묘사가 늘 같아요\n- 은은한 달빛 | 상투적 비유 | 없는 말\n- 톰 | 기타 | 이름\nnoise line';
    const pool = T.findRepeatedPhrases({ top: 120, pool: true });
    const picks = await T.pickTicsWithModel(pool);
    assert.strictEqual(JSON.stringify(picks.map(p => p.text)), JSON.stringify(['오존 냄새', '입꼬리가 미세하게']), 'only real phrases, no names');
    assert.strictEqual(picks[0].kind, '감각 묘사');
    console.log('repeat ok');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
