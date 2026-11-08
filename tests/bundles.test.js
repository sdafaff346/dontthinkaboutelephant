// 설정 묶음: a chat or character points at a named set of settings; edits while it is in
// use stay in that set; plain chats get the base settings back.
'use strict';
const assert = require('assert');
const { load } = require('./harness');

const h = load();
const c = h.context;
c.characters = [{ avatar: 'sim.png' }, { avatar: 'solo.png' }];
c.characterId = 0;
const T = h.get('({ getSettings, applyBundleForChat, pickBundle, cleanBundleValues, resolveBundle, BUNDLE_META_KEY })');
const s = T.getSettings();
s.keepRecent = 20; s.autoCompress = false;
// save a "시뮬봇" bundle with different values, then put the base back
s.bundles['시뮬봇'] = { values: { ...T.pickBundle(s), keepRecent: 60, autoCompress: true }, savedAt: 1 };
s.bundleByChar['char:sim.png'] = '시뮬봇';

assert.strictEqual(T.applyBundleForChat({ announce: false }), true);
assert.strictEqual(s.activeBundle, '시뮬봇');
assert.strictEqual(s.keepRecent, 60);
assert.strictEqual(s.autoCompress, true);

// edit while the bundle is in use, then open the solo bot (no bundle)
s.keepRecent = 70;
c.characterId = 1;
T.applyBundleForChat({ announce: false });
assert.strictEqual(s.activeBundle, '');
assert.strictEqual(s.keepRecent, 20, 'base settings back');
assert.strictEqual(s.autoCompress, false);
assert.strictEqual(s.bundles['시뮬봇'].values.keepRecent, 70, 'edit kept in the bundle');

// a chat-level pick beats the character
s.bundles['짧게'] = { values: { keepRecent: 8 }, savedAt: 2 };
c.chatMetadata[T.BUNDLE_META_KEY] = '짧게';
c.characterId = 0;
assert.strictEqual(T.resolveBundle().name, '짧게');
T.applyBundleForChat({ announce: false });
assert.strictEqual(s.keepRecent, 8);
assert.strictEqual(s.autoCompress, false, 'keys a bundle lacks keep the base value');

// edits to base made while no bundle is used survive a round trip
delete c.chatMetadata[T.BUNDLE_META_KEY];
c.characterId = 1;
T.applyBundleForChat({ announce: false });
s.maxUndo = 25;
c.characterId = 0;
T.applyBundleForChat({ announce: false });
c.characterId = 1;
T.applyBundleForChat({ announce: false });
assert.strictEqual(s.maxUndo, 25);

// bundles never carry the master switch, embedding setup, or junk
const clean = T.cleanBundleValues({ enabled: false, embedModel: 'x', keepRecent: 'lots', bogus: 1, detail: 'brief' });
assert.strictEqual(JSON.stringify(clean), JSON.stringify({ detail: 'brief' }));
assert.ok(!('enabled' in T.pickBundle(s)) && !('bundles' in T.pickBundle(s)));
console.log('bundles ok');
