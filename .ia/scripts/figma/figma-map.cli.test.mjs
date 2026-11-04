// Teste de ponta a ponta do CLI contra uma API simulada em 127.0.0.1 (nunca toca o Figma real).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'figma-map.mjs');
const KEY = 'TESTKEY';
let server;
let port;
let hits = [];
let limited = false;
let work;
let home;

const doc = (id) => ({
  id,
  name: `Secao ${id}`,
  type: 'FRAME',
  absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 600 },
  children: [{ id: `${id}-c`, name: 'Titulo', type: 'TEXT', absoluteBoundingBox: { x: 10, y: 20, width: 300, height: 40 } }],
});

before(async () => {
  server = createServer((req, res) => {
    hits.push(req.url);
    if (limited) {
      res.writeHead(429, { 'Retry-After': '3600', 'X-Figma-Plan-Tier': 'starter' });
      return res.end('{}');
    }
    const u = new URL(req.url, 'http://x');
    res.setHeader('content-type', 'application/json');
    if (u.pathname === `/v1/files/${KEY}/nodes`) {
      const ids = u.searchParams.get('ids').split(',');
      return res.end(JSON.stringify({ nodes: Object.fromEntries(ids.map((id) => [id, { document: doc(id) }])) }));
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  work = mkdtempSync(join(tmpdir(), 'figma-cli-work-'));
  home = mkdtempSync(join(tmpdir(), 'figma-cli-home-'));
});
after(() => {
  server.close();
  rmSync(work, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

function run(args, { token = 'tok' } = {}) {
  hits = [];
  return new Promise((resolve) => {
    const env = { ...process.env, HOME: home, USERPROFILE: home, FIGMA_API_URL: `http://127.0.0.1:${port}/v1`, FIGMA_MIN_INTERVAL_MS: '0' };
    delete env.FIGMA_TOKEN;
    if (token) env.FIGMA_TOKEN = token;
    const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: work, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr, hits: hits.length }));
  });
}

test('layout com varios nos: uma unica requisicao', async () => {
  const r = await run(['layout', '--url', KEY, '--ids', '1:1,1:2', '--depth', '2']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.hits, 1);
  assert.match(r.stdout, /Secao 1:1 \[1:1\]/);
  assert.match(r.stdout, /Secao 1:2 \[1:2\]/);
  assert.match(r.stderr, /1 requisicao\(oes\) a API/);
});

test('fx e node nos mesmos nos saem do cache: zero requisicoes e funciona sem token', async () => {
  const fx = await run(['fx', '--url', KEY, '--ids', '1:1,1:2', '--depth', '2'], { token: null });
  assert.equal(fx.code, 0, fx.stderr);
  assert.equal(fx.hits, 0);
  const node = await run(['node', '--url', KEY, '--ids', '1:1', '--depth', '1'], { token: null });
  assert.equal(node.code, 0, node.stderr);
  assert.equal(node.hits, 0);
  assert.match(node.stdout, /Secao 1:1/);
  assert.ok(existsSync(join(work, 'figma-data', KEY, 'raw', 'cache', 'nodes')));
});

test('prefetch --dry-run mostra o plano sem requisicao; em pedacos, faz so o permitido e lista o pendente', async () => {
  const dry = await run(['prefetch', '--url', KEY, '--ids', '2:1,2:2,2:3,2:4,2:5', '--depth', '2', '--batch', '2', '--dry-run']);
  assert.equal(dry.code, 0, dry.stderr);
  assert.equal(dry.hits, 0);
  assert.match(dry.stdout, /5 a baixar em 3 requisicao/);

  const part = await run(['prefetch', '--url', KEY, '--ids', '2:1,2:2,2:3,2:4,2:5', '--depth', '2', '--batch', '2', '--max-requests', '1']);
  assert.equal(part.code, 0, part.stderr);
  assert.equal(part.hits, 1);
  assert.match(part.stdout, /PENDENTES \(3/);

  const rest = await run(['prefetch', '--url', KEY, '--ids', '2:1,2:2,2:3,2:4,2:5', '--depth', '2', '--batch', '2']);
  assert.equal(rest.hits, 2, 'so o que faltava');
  assert.doesNotMatch(rest.stdout, /PENDENTES/);
});

test('429 longo: sai com 3, mensagem clara, e as proximas chamadas nem chegam a API', async () => {
  limited = true;
  const first = await run(['layout', '--url', KEY, '--ids', '9:1', '--depth', '2']);
  assert.equal(first.code, 3);
  assert.equal(first.hits, 1);
  assert.match(first.stderr, /LIMITE DA API DO FIGMA/);
  assert.match(first.stderr, /PARE e reporte/);
  assert.match(first.stderr, /Plano: starter/);

  const second = await run(['layout', '--url', KEY, '--ids', '9:2', '--depth', '2']);
  assert.equal(second.code, 3);
  assert.equal(second.hits, 0, 'bloqueio gravado: nao toca a API');

  const cached = await run(['layout', '--url', KEY, '--ids', '1:1', '--depth', '2']);
  assert.equal(cached.code, 0, 'o cache continua servindo enquanto bloqueado');

  const st = await run(['status', '--url', KEY], { token: null });
  assert.equal(st.code, 0);
  assert.match(st.stdout, /BLOQUEADO/);
  assert.match(st.stdout, /1 com 429/);
  limited = false;
});

test('prefetch --sections le raw/variants.json, filtra por variante e nao repete id', async () => {
  const dir = join(work, 'figma-data', KEY, 'raw');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'variants.json'),
    JSON.stringify({ variants: { 'desktop-light': { sections: [{ id: '5:1' }, { id: '5:2' }] }, 'mobile-light': { sections: [{ id: '5:2' }, { id: '5:3' }] } } }),
  );
  const all = await run(['prefetch', '--url', KEY, '--sections', '--depth', '2', '--dry-run']);
  assert.equal(all.code, 0, all.stderr);
  assert.match(all.stdout, /3 no\(s\)/, '5:2 aparece nas duas variantes e conta uma vez');
  const one = await run(['prefetch', '--url', KEY, '--sections', '--variants', 'mobile-light', '--depth', '2', '--dry-run']);
  assert.match(one.stdout, /2 no\(s\)/);
  const missing = await run(['prefetch', '--url', 'OUTRA', '--sections', '--dry-run']);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /rode antes/);
});
