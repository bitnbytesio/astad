import fs from 'node:fs';
import packageJson from './package.json' assert { type: 'json' };

fs.writeFileSync('cjs/package.json', JSON.stringify({
    "type": "commonjs"
}, null, 2));

fs.writeFileSync('esm/package.json', JSON.stringify({
    "type": "module"
}, null, 2));

const cjs = fs.readFileSync('cjs/consts.js').toString();
fs.writeFileSync('cjs/consts.js', buildConsts(cjs));

const esm = fs.readFileSync('esm/consts.js').toString();
fs.writeFileSync('esm/consts.js', buildConsts(esm));

function buildConsts(content) {
    content = content.replace("%astad_version%", packageJson.version);
    return content;
}
