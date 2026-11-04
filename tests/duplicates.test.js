// index.js is loaded as an ES module, where two top-level declarations with the same
// name are a SyntaxError that kills the whole extension. The vm harness can't see that.
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const seen = new Map();
const dups = [];
for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (seen.has(m[1])) dups.push(m[1]);
    seen.set(m[1], true);
}
if (dups.length) { console.error('duplicate top-level names:', dups.join(', ')); process.exit(1); }
console.log('no duplicate top-level names');
