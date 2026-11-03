#!/usr/bin/env node
// Documentacao oficial local (HTML, CSS, JavaScript e Sass) para consulta barata, sem rede nem embeddings.
//
//   node docs.mjs sync [--refresh]                       baixa o conteudo e monta o indice (so na primeira vez ou para atualizar)
//   node docs.mjs search "<termos>" [--area css|html|javascript|api|accessibility|sass] [--limit 8]
//   node docs.mjs show <slug> [--section "Syntax"] [--max 80]
//
// Fontes (somente consulta local, nao redistribuimos o conteudo; respeite a licenca de cada uma ao citar):
//   MDN  github.com/mdn/content        (areas html, css, javascript, api = APIs Web como fetch e IntersectionObserver, accessibility = ARIA)
//   Sass github.com/sass/sass-site     (area sass)
// Cache fora do repositorio: ~/.cache/multi-agent/docs (ou MULTI_AGENT_DOCS). Precisa so de Node e git.
// Economia de tokens: `search` devolve uma linha por pagina; `show` devolve so a secao pedida.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

const run = promisify(execFile);
const CACHE = process.env.MULTI_AGENT_DOCS ?? join(homedir(), '.cache', 'multi-agent', 'docs');
const SOURCES = [
  { name: 'mdn', url: 'https://github.com/mdn/content', sparse: ['files/en-us/web/html', 'files/en-us/web/css', 'files/en-us/web/javascript', 'files/en-us/web/api', 'files/en-us/web/accessibility'], root: 'files/en-us/web', areaOf: (rel) => (rel.includes('/') ? rel.split('/')[0] : null) },
  { name: 'sass', url: 'https://github.com/sass/sass-site', sparse: ['source/documentation'], root: 'source/documentation', areaOf: () => 'sass' },
];

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const positional = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1]?.startsWith('--') && opt(all[i - 1].slice(2)) === a));

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// Front matter simples (chave: valor, sem YAML aninhado) + corpo.
function parse(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  if (!m) return { meta, body: text };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}

const clean = (s) => s.replace(/\{\{[^}]*\}\}/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();

async function sync() {
  if (opt('refresh') !== undefined || args.includes('--refresh')) await rm(CACHE, { recursive: true, force: true });
  await mkdir(CACHE, { recursive: true });
  const index = [];
  const meta = { syncedAt: new Date().toISOString(), sources: {} };
  for (const src of SOURCES) {
    const dir = join(CACHE, src.name);
    if (!existsSync(dir)) {
      console.log(`baixando ${src.url} ...`);
      await run('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', src.url, dir], { maxBuffer: 1 << 26 });
    }
    await run('git', ['-C', dir, 'sparse-checkout', 'set', ...src.sparse], { maxBuffer: 1 << 26 }); // idempotente: tambem pega pastas novas
    meta.sources[src.name] = (await run('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'])).stdout.trim();
    const base = join(dir, src.root);
    for (const file of await walk(base)) {
      const rel = relative(base, file).split(sep).join('/');
      const { meta: m, body } = parse(await readFile(file, 'utf8'));
      const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((h) => clean(h[1])).slice(0, 16);
      const para = body.split(/\r?\n\r?\n/).map(clean).find((p) => p.length > 30 && !p.startsWith('#') && !p.startsWith('```'));
      const area = src.areaOf(rel);
      if (!area) continue;
      const slug = (m.slug ?? rel.replace(/(\/index)?\.md$/, '')).toLowerCase();
      index.push({ a: area, s: slug, t: clean(m.title ?? slug), p: `${src.name}/${src.root}/${rel}`, h: headings, d: (para ?? '').slice(0, 240), c: m['browser-compat'] ?? '' });
    }
  }
  await writeFile(join(CACHE, 'index.json'), JSON.stringify(index));
  await writeFile(join(CACHE, 'meta.json'), JSON.stringify({ ...meta, pages: index.length }, null, 2));
  const per = {};
  for (const e of index) per[e.a] = (per[e.a] ?? 0) + 1;
  console.log(`indice pronto: ${index.length} paginas (${Object.entries(per).map(([k, v]) => `${k} ${v}`).join(', ')}) em ${CACHE}`);
}

async function loadIndex() {
  try {
    return JSON.parse(await readFile(join(CACHE, 'index.json'), 'utf8'));
  } catch {
    console.error('Sem cache de documentacao. Rode: node docs.mjs sync');
    process.exit(1);
  }
}

async function search() {
  const query = positional.join(' ').toLowerCase().trim();
  if (!query) {
    console.error('uso: docs.mjs search "<termos>" [--area css|html|javascript|api|accessibility|sass] [--limit 8]');
    process.exit(2);
  }
  const area = opt('area');
  const limit = Number(opt('limit', 8));
  const tokens = [...new Set(query.split(/[^a-z0-9]+/).filter((t) => t.length > 1))];
  const phrase = query.replace(/\s+/g, '-');
  const scored = [];
  for (const e of await loadIndex()) {
    if (area && e.a !== area) continue;
    const last = e.s.split('/').pop();
    const title = e.t.toLowerCase();
    const heads = e.h.join(' ').toLowerCase();
    const desc = e.d.toLowerCase();
    let score = last === phrase ? 40 : 0;
    let hit = 0;
    for (const t of tokens) {
      const s = (last === t ? 12 : 0) + (e.s.includes(t) ? 4 : 0) + (title.includes(t) ? 5 : 0) + (heads.includes(t) ? 2 : 0) + (desc.includes(t) ? 1 : 0);
      if (s) hit++;
      score += s;
    }
    if (hit === tokens.length && score > 0) scored.push({ e, score });
  }
  scored.sort((x, y) => y.score - x.score || x.e.s.length - y.e.s.length);
  if (!scored.length) {
    console.log('nada encontrado (tente menos termos ou outra --area)');
    return;
  }
  for (const { e, score } of scored.slice(0, limit)) console.log(`${String(score).padStart(3)}  [${e.a}] ${e.s}  - ${e.t}${e.d ? `: ${e.d.slice(0, 110)}` : ''}`);
}

async function show() {
  const key = (positional[0] ?? '').toLowerCase().replace(/^\/?(en-us\/docs\/)?/, '');
  if (!key) {
    console.error('uso: docs.mjs show <slug> [--section "Syntax"] [--max 80]');
    process.exit(2);
  }
  const index = await loadIndex();
  const exact = index.filter((e) => e.s === key);
  const found = exact.length ? exact : index.filter((e) => e.s.endsWith(`/${key}`));
  if (found.length !== 1) {
    console.error(found.length ? `ambiguo (${found.length}): ${found.slice(0, 8).map((e) => e.s).join(', ')}` : `slug nao encontrado: ${key} (use search)`);
    process.exit(1);
  }
  const e = found[0];
  const { body } = parse(await readFile(join(CACHE, e.p), 'utf8'));
  let lines = body.split(/\r?\n/).filter((l) => !/^\s*\{\{[^}]*\}\}\s*$/.test(l));
  const section = opt('section');
  if (section) {
    const start = lines.findIndex((l) => /^#{2,4}\s/.test(l) && clean(l.replace(/^#+/, '')).toLowerCase() === section.toLowerCase());
    if (start < 0) {
      console.error(`secao "${section}" nao existe. Secoes: ${e.h.join(' | ')}`);
      process.exit(1);
    }
    const level = lines[start].match(/^#+/)[0].length;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) if (new RegExp(`^#{1,${level}}\\s`).test(lines[i])) { end = i; break; }
    lines = lines.slice(start, end);
  }
  const max = Number(opt('max', 80));
  console.log(`# ${e.t}  [${e.a}] ${e.s}${e.c ? `  (compat: ${e.c})` : ''}`);
  console.log(lines.slice(0, max).join('\n'));
  if (lines.length > max) console.log(`\n... (${lines.length - max} linhas omitidas; use --section ou --max)`);
}

const commands = { sync, search, show };
if (!commands[cmd]) {
  console.error('Uso: node docs.mjs <sync|search|show> (ver cabecalho do arquivo)');
  process.exit(2);
}
commands[cmd]().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
