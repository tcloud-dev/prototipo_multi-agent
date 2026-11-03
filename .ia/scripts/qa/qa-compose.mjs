#!/usr/bin/env node
// Monta a imagem lado a lado (Figma a esquerda, site a direita) de cada secao capturada pelo qa-capture.
//
//   node qa-compose.mjs --ref figma-data/<fileKey>/refs --shots reports/qa/<id>/<variante> --out reports/qa/<id> [--bg '#ffffff'] [--col 720]
//
// A referencia de cada secao e <ref>/<no com ':' trocado por '-'>.png (gerada por `figma-map.mjs image --ids <no>`, escala 1).
// Gera <secao>-lado-a-lado.png e comparison.md (altura no Figma x renderizada). Dependencia: sharp (do repositorio consumidor).

import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const refDir = resolve(opt('ref', ''));
const shots = resolve(opt('shots', ''));
const out = resolve(opt('out', shots));
const bg = opt('bg', '#ffffff');
const col = Number(opt('col', 720));
const LABEL = 30;
const GAP = 16;

const req = createRequire(join(process.cwd(), 'package.json'));
let sharp;
try {
  sharp = req('sharp');
} catch {
  console.error('Falta o sharp no repositorio. Rode: npm i -D sharp');
  process.exit(1);
}
if (!opt('ref') || !opt('shots')) {
  console.error('uso: qa-compose.mjs --ref <pasta de refs do Figma> --shots <pasta da captura> [--out <pasta>] [--bg cor] [--col 720]');
  process.exit(2);
}

const label = (text, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${LABEL}"><rect width="100%" height="100%" fill="#20242a"/><text x="10" y="20" font-family="Arial" font-size="14" fill="#fff">${text}</text></svg>`);

// Encaixa a imagem na largura da coluna (so reduz, nunca amplia mais que 1x).
async function fit(file) {
  const meta = await sharp(file).metadata();
  const w = Math.min(col, meta.width);
  const buf = await sharp(file).resize({ width: w }).png().toBuffer();
  const m = await sharp(buf).metadata();
  return { buf, w: m.width, h: m.height, origW: meta.width, origH: meta.height };
}

async function main() {
  const measures = JSON.parse(await readFile(join(shots, 'measures.json'), 'utf8'));
  await mkdir(out, { recursive: true });
  const rows = [];
  for (const s of measures.sections) {
    const ref = join(refDir, `${s.node.replace(':', '-')}.png`);
    const shot = join(shots, `${s.id}.png`);
    if (!existsSync(ref)) {
      rows.push({ id: s.id, node: s.node, status: 'sem referencia do Figma (rode figma-map.mjs image)' });
      continue;
    }
    const [a, b] = await Promise.all([fit(ref), fit(shot)]);
    const h = Math.max(a.h, b.h);
    const width = col * 2 + GAP;
    const base = sharp({ create: { width, height: h + LABEL, channels: 3, background: bg } });
    const file = join(out, `${s.id}-lado-a-lado.png`);
    await base
      .composite([
        { input: label(`Figma ${s.node} (${a.origW}x${a.origH})`, col), left: 0, top: 0 },
        { input: label(`Site ${s.id} (${b.origW}x${b.origH})`, col), left: col + GAP, top: 0 },
        { input: a.buf, left: 0, top: LABEL },
        { input: b.buf, left: col + GAP, top: LABEL },
      ])
      .png()
      .toFile(file);
    const diff = b.origH - a.origH;
    rows.push({ id: s.id, node: s.node, figmaH: a.origH, siteH: b.origH, diff, widthDiff: b.origW - a.origW, file });
    console.log(`OK  ${s.id}  figma ${a.origW}x${a.origH}  site ${b.origW}x${b.origH}  (${diff >= 0 ? '+' : ''}${diff}px de altura)`);
  }
  const md = ['# Figma x site', '', `Captura: ${measures.variant} (${measures.viewport.width}px)`, '', '| secao | no | altura Figma | altura site | diferenca | largura (site-Figma) |', '|---|---|---|---|---|---|'];
  for (const r of rows) md.push(r.status ? `| ${r.id} | ${r.node} | - | - | ${r.status} | - |` : `| ${r.id} | ${r.node} | ${r.figmaH}px | ${r.siteH}px | ${r.diff >= 0 ? '+' : ''}${r.diff}px | ${r.widthDiff >= 0 ? '+' : ''}${r.widthDiff}px |`);
  await writeFile(join(out, 'comparison.md'), md.join('\n'));
  console.log(`\ncomparison.md em ${out}`);
  if (rows.some((r) => r.status)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
