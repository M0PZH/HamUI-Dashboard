// Inline the HamUI dist build into the mockup so it is one self-contained page.
// usage: node design/build-mockup.mjs ../HamUI/dist
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.argv[2] || resolve(here, '../../../HamUI/dist'));
const css = readFileSync(resolve(dist, 'hamui.css'), 'utf8');
const js = readFileSync(resolve(dist, 'hamui.umd.cjs'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');
const src = readFileSync(resolve(here, 'mockup.src.html'), 'utf8');
const out = src.replace('/*HAMUI_CSS*/', () => css).replace('/*HAMUI_JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
writeFileSync(resolve(here, 'mockup.html'), out);
console.log(`mockup.html: ${(out.length / 1024).toFixed(0)} KB`);
