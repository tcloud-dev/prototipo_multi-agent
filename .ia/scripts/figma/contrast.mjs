// Contraste WCAG de pares de cor do design, para conferir o contraste antes de implementar.
// Uso: node contrast.mjs <texto> <fundo> [<tipo>] [<texto> <fundo> [<tipo>] ...]     tipo: text (padrao), large ou ui
//   node .ia/scripts/figma/contrast.mjs '#ffffff' '#ff823d' text '#1d232a' '#ff823d'
// Sai com codigo 1 se algum par reprovar (text 4,5:1; large e ui 3:1).
import { evaluate } from './lib/contrast.mjs';

const args = process.argv.slice(2);
const kinds = new Set(['text', 'large', 'ui']);
const pairs = [];
for (let i = 0; i < args.length; ) {
  const [fg, bg] = [args[i], args[i + 1]];
  if (!bg) {
    console.error('Uso: node contrast.mjs <texto> <fundo> [text|large|ui] ...');
    process.exit(2);
  }
  const kind = kinds.has(args[i + 2]) ? args[i + 2] : 'text';
  pairs.push({ fg, bg, kind });
  i += 2 + (kinds.has(args[i + 2]) ? 1 : 0);
}
if (!pairs.length) {
  console.error('Uso: node contrast.mjs <texto> <fundo> [text|large|ui] ...');
  process.exit(2);
}
let failed = 0;
for (const { fg, bg, kind } of pairs) {
  const r = evaluate(fg, bg, kind);
  if (r.error) {
    console.log(`ERRO   ${r.error}`);
    failed++;
    continue;
  }
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'OK    ' : 'FALHA '} ${fg} sobre ${bg} (${kind}): ${r.ratio}:1 (minimo ${r.min}:1)`);
}
process.exit(failed ? 1 : 0);
