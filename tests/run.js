// Runs every *.test.js in this folder: node tests/run.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
for (const f of files) {
    try {
        execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: 'pipe', timeout: 120000 });
        console.log(`ok    ${f}`);
    } catch (err) {
        failed++;
        console.log(`FAIL  ${f}\n${String(err.stdout || '')}${String(err.stderr || '').split('\n').slice(0, 12).join('\n')}`);
    }
}
console.log(`\n${files.length - failed}/${files.length} passed`);
process.exit(failed ? 1 : 0);
