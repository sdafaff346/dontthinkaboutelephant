// <thinking> blocks are removed without eating the reply; stray </thinking> in model output.
'use strict';
const assert = require('assert');
const { load } = require('./harness');
const { get } = load();
const T = get('({ stripMessage, cleanOutput, removeBlocks })');
assert.strictEqual(T.stripMessage('<thinking>plan</thinking>\n깡이 웃었다.'), '깡이 웃었다.');
assert.strictEqual(T.stripMessage('앞 <thinking>a</thinking> 중간 <think>b</think> 끝'), '앞  중간  끝');
assert.strictEqual(T.stripMessage('<THINKING type="x">x</THINKING >본문'), '본문');
assert.strictEqual(T.removeBlocks('<header>메뉴</header><p>본문</p>', 'head'), '<header>메뉴</header><p>본문</p>');
assert.strictEqual(T.cleanOutput('plan only</thinking>\n<episode>x</episode>'), '<episode>x</episode>');
assert.strictEqual(T.cleanOutput('<think>a</think><episode>x</episode>'), '<episode>x</episode>');
console.log('thinking ok');
