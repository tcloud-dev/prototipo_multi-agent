import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError, BusyError, createClient, formatWait, NODES_PER_REQUEST, RateLimitError } from './figma-api.mjs';

// Resposta simulada. `headers` aceita um objeto simples.
const res = (status, body = {}, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (n) => headers[n.toLowerCase()] ?? null },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

function setup(responses, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'figma-api-'));
  const calls = [];
  const sleeps = [];
  let clock = 1_000_000_000_000;
  const queue = [...responses];
  const client = createClient({
    getToken: () => 'tok',
    fetchFn: async (url) => {
      calls.push(url);
      const next = queue.shift();
      return typeof next === 'function' ? next(url) : next;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    stateDir: dir,
    minIntervalMs: 0,
    ...extra,
  });
  return { client, calls, sleeps, dir, advance: (ms) => (clock += ms), done: () => rmSync(dir, { recursive: true, force: true }) };
}

const nodesBody = (...ids) => ({ nodes: Object.fromEntries(ids.map((id) => [id, { document: { id, name: `n${id}`, children: [] } }])) });

test('formatWait: segundos, minutos, horas e dias', () => {
  assert.equal(formatWait(5), '5s');
  assert.equal(formatWait(61), '2min');
  assert.equal(formatWait(3600 + 60), '1h01min');
  assert.equal(formatWait(2 * 86400 + 3 * 3600), '2d 3h');
});

test('getNodes: um lote por requisicao e o segundo pedido vem do cache', async () => {
  const t = setup([res(200, nodesBody('1:1', '1:2'))]);
  const a = await t.client.getNodes('K', ['1:1', '1:2'], 4);
  assert.equal(t.calls.length, 1);
  assert.deepEqual(Object.keys(a.nodes), ['1:1', '1:2']);
  const b = await t.client.getNodes('K', ['1:1', '1:2'], 4);
  assert.equal(t.calls.length, 1, 'nao pode pedir de novo');
  assert.equal(b.nodes['1:2'].document.name, 'n1:2');
  assert.equal(t.client.stats.requests, 1);
  assert.equal(t.client.stats.cacheHits, 2);
  t.done();
});

test('getNodes: cache mais fundo serve pedido mais raso, mas nao o contrario', async () => {
  const t = setup([res(200, nodesBody('1:1')), res(200, nodesBody('1:1'))]);
  await t.client.getNodes('K', ['1:1'], 4);
  await t.client.getNodes('K', ['1:1'], 2);
  assert.equal(t.calls.length, 1);
  await t.client.getNodes('K', ['1:1'], 6);
  assert.equal(t.calls.length, 2);
  assert.match(t.calls[1], /depth=6/);
  t.done();
});

test('getNodes: pede so os nos que faltam, todos juntos', async () => {
  const t = setup([res(200, nodesBody('1:1')), res(200, nodesBody('1:2', '1:3'))]);
  await t.client.getNodes('K', ['1:1'], 4);
  await t.client.getNodes('K', ['1:1', '1:2', '1:3'], 4);
  assert.equal(t.calls.length, 2);
  assert.match(t.calls[1], /ids=1%3A2%2C1%3A3/);
  assert.doesNotMatch(t.calls[1], /1%3A1/);
  t.done();
});

test('getNodes: --refresh ignora o cache', async () => {
  const t = setup([res(200, nodesBody('1:1')), res(200, nodesBody('1:1'))]);
  await t.client.getNodes('K', ['1:1'], 4);
  await t.client.getNodes('K', ['1:1'], 4, { refresh: true });
  assert.equal(t.calls.length, 2);
  t.done();
});

test('getNodes: divide em lotes de NODES_PER_REQUEST', async () => {
  const ids = Array.from({ length: NODES_PER_REQUEST + 5 }, (_, i) => `9:${i}`);
  const t = setup([res(200, nodesBody(...ids.slice(0, NODES_PER_REQUEST))), res(200, nodesBody(...ids.slice(NODES_PER_REQUEST)))]);
  await t.client.getNodes('K', ids, 3);
  assert.equal(t.calls.length, 2);
  t.done();
});

test('getNodes: no inexistente nao entra no cache (pode ser transitorio)', async () => {
  const t = setup([res(200, { nodes: { '1:1': { document: null } } }), res(200, nodesBody('1:1'))]);
  const a = await t.client.getNodes('K', ['1:1'], 4);
  assert.equal(a.nodes['1:1'].document, null);
  await t.client.getNodes('K', ['1:1'], 4);
  assert.equal(t.calls.length, 2);
  t.done();
});

test('planNodes: informa o que esta em cache e quantas requisicoes faltam, sem chamar a API', async () => {
  const t = setup([res(200, nodesBody('1:1'))]);
  await t.client.getNodes('K', ['1:1'], 4);
  const plan = await t.client.planNodes(['1:1', '1:2', '1:3'], 4);
  assert.deepEqual(plan.cached, ['1:1']);
  assert.deepEqual(plan.missing, ['1:2', '1:3']);
  assert.equal(plan.requests, 1);
  assert.equal(t.calls.length, 1);
  t.done();
});

test('429 com espera curta: aguarda e tenta de novo', async () => {
  const t = setup([res(429, {}, { 'retry-after': '3' }), res(200, nodesBody('1:1'))]);
  const out = await t.client.getNodes('K', ['1:1'], 4);
  assert.equal(out.nodes['1:1'].document.id, '1:1');
  assert.deepEqual(t.sleeps, [3000]);
  assert.equal(t.calls.length, 2);
  t.done();
});

test('429 com espera longa: para sem dormir, grava o bloqueio e informa plano e tipo', async () => {
  const t = setup([res(429, {}, { 'retry-after': '3600', 'x-figma-plan-tier': 'starter', 'x-figma-rate-limit-type': 'low' })]);
  await assert.rejects(t.client.getNodes('K', ['1:1'], 4), (e) => {
    assert.ok(e instanceof RateLimitError);
    assert.equal(e.retryAfterSec, 3600);
    assert.equal(e.info.planTier, 'starter');
    assert.equal(e.info.limitType, 'low');
    return true;
  });
  assert.deepEqual(t.sleeps, [], 'nao pode dormir a espera longa');
  assert.equal(t.calls.length, 1);
  t.done();
});

test('apos 429 longo, as chamadas seguintes falham na hora, sem tocar na API', async () => {
  const t = setup([res(429, {}, { 'retry-after': '600' })]);
  await assert.rejects(t.client.getNodes('K', ['1:1'], 4), RateLimitError);
  await assert.rejects(t.client.getNodes('K', ['1:2'], 4), (e) => e instanceof RateLimitError && e.info.local === true);
  assert.equal(t.calls.length, 1, 'so a primeira chamada chegou a API');
  t.done();
});

test('o bloqueio expira com o tempo e as chamadas voltam', async () => {
  const t = setup([res(429, {}, { 'retry-after': '120' }), res(200, nodesBody('1:1'))]);
  await assert.rejects(t.client.getNodes('K', ['1:1'], 4), RateLimitError);
  t.advance(121_000);
  const out = await t.client.getNodes('K', ['1:1'], 4);
  assert.equal(out.nodes['1:1'].document.id, '1:1');
  t.done();
});

test('cache continua valendo enquanto a API esta bloqueada', async () => {
  const t = setup([res(200, nodesBody('1:1')), res(429, {}, { 'retry-after': '600' })]);
  await t.client.getNodes('K', ['1:1'], 4);
  await assert.rejects(t.client.getNodes('K', ['1:2'], 4), RateLimitError);
  const again = await t.client.getNodes('K', ['1:1'], 4);
  assert.equal(again.nodes['1:1'].document.id, '1:1');
  t.done();
});

test('429 sem Retry-After usa 60s e, por ser acima do limite de espera, para', async () => {
  const t = setup([res(429)]);
  await assert.rejects(t.client.request('/x'), (e) => e instanceof RateLimitError && e.retryAfterSec === 60);
  t.done();
});

test('erro HTTP vira ApiError com status', async () => {
  const t = setup([res(403, { err: 'forbidden' })]);
  await assert.rejects(t.client.request('/x'), (e) => e instanceof ApiError && e.status === 403);
  t.done();
});

test('ritmo: espera o intervalo minimo desde a ultima requisicao', async () => {
  const t = setup([res(200, {}), res(200, {})], { minIntervalMs: 1000 });
  await t.client.request('/a');
  await t.client.request('/b');
  assert.equal(t.sleeps.length, 1);
  assert.ok(t.sleeps[0] > 0 && t.sleeps[0] <= 1000);
  t.done();
});

test('getFile: exato so serve a profundidade pedida; sem exato, serve uma mais funda', async () => {
  const t = setup([res(200, { name: 'F', document: { children: [] } }), res(200, { name: 'F3', document: { children: [] } })]);
  await t.client.getFile('K', 3);
  await t.client.getFile('K', 3, { exact: true });
  assert.equal(t.calls.length, 1);
  const shallow = await t.client.getFile('K', 1);
  assert.equal(shallow.name, 'F', 'cache mais fundo serve');
  assert.equal(t.calls.length, 1);
  await t.client.getFile('K', 2, { exact: true });
  assert.equal(t.calls.length, 2, 'exato nao aceita outra profundidade');
  t.done();
});

test('registro de chamadas e status offline', async () => {
  const t = setup([res(200, nodesBody('1:1')), res(429, {}, { 'retry-after': '600', 'x-figma-plan-tier': 'starter' })]);
  await t.client.getNodes('K', ['1:1'], 4);
  await assert.rejects(t.client.getNodes('K', ['1:2'], 4), RateLimitError);
  const s = await t.client.status();
  assert.equal(s.calls.total, 2);
  assert.equal(s.calls.limited, 1);
  assert.equal(s.calls.lastHour, 2);
  assert.equal(s.cache.nodes, 1);
  assert.equal(s.retryAfterSec, 600);
  assert.equal(s.planTier, 'starter');
  assert.ok(existsSync(join(t.dir, 'api-calls.log')));
  assert.doesNotMatch(readFileSync(join(t.dir, 'api-calls.log'), 'utf8'), /tok/, 'o token nunca vai para o log');
  t.done();
});

test('getNodes em pedacos: batchSize e maxRequests; o resto fica pendente e a proxima execucao continua', async () => {
  const ids = ['1:1', '1:2', '1:3', '1:4', '1:5'];
  const t = setup([res(200, nodesBody('1:1', '1:2')), res(200, nodesBody('1:3', '1:4')), res(200, nodesBody('1:5'))]);
  const first = await t.client.getNodes('K', ids, 3, { batchSize: 2, maxRequests: 1 });
  assert.equal(t.calls.length, 1);
  assert.deepEqual(first.pending, ['1:3', '1:4', '1:5']);
  assert.equal(first.nodes['1:3'], undefined);
  const second = await t.client.getNodes('K', ids, 3, { batchSize: 2, maxRequests: 5 });
  assert.equal(t.calls.length, 3, 'so os 3 nos que faltavam, em 2 requisicoes');
  assert.deepEqual(second.pending, []);
  assert.equal(second.nodes['1:1'].document.id, '1:1');
  t.done();
});

test('planNodes respeita batchSize', async () => {
  const t = setup([]);
  const plan = await t.client.planNodes(['1:1', '1:2', '1:3', '1:4', '1:5'], 3, { batchSize: 2 });
  assert.equal(plan.requests, 3);
  t.done();
});

test('no dentro de outra arvore em cache sai de la, com a profundidade que sobra; mais fundo que isso pede a API', async () => {
  const { client, calls, dir, done } = setup([res(200, nodesBody('2:2'))]);
  const parent = { id: '1:1', name: 'pagina', type: 'FRAME', children: [{ id: '2:2', name: 'secao', type: 'FRAME', children: [{ id: '3:3', name: 'card', type: 'FRAME', children: [{ id: '4:4', name: 'texto', type: 'TEXT' }] }] }] };
  mkdirSync(join(dir, 'cache', 'nodes'), { recursive: true });
  writeFileSync(join(dir, 'cache', 'nodes', '1-1.json'), JSON.stringify({ depth: 3, document: parent }));
  // 2:2 esta no nivel 1 de uma arvore de profundidade 3: sobram 2 niveis.
  const shallow = await client.getNodes('K', ['2:2'], 2);
  assert.equal(calls.length, 0, 'servido pela arvore da pagina');
  assert.equal(shallow.nodes['2:2'].document.children[0].id, '3:3');
  assert.equal(await client.cachedDepth('2:2'), 2);
  // Pedir 3 niveis a partir da secao excede o que o cache tem: vai a API.
  await client.getNodes('K', ['2:2'], 3);
  assert.equal(calls.length, 1);
  done();
});

test('trava: segunda chamada enquanto outra esta em andamento falha na hora; trava de processo morto e retomada', async () => {
  const { client, calls, dir, done } = setup([res(200, nodesBody('1:1')), res(200, nodesBody('2:2'))]);
  mkdirSync(dir, { recursive: true });
  // Trava de outro processo vivo (o pai do teste) e recente: ocupado.
  writeFileSync(join(dir, '.lock'), JSON.stringify({ pid: process.ppid, at: 1_000_000_000_000 }));
  await assert.rejects(() => client.request('/files/K/nodes?ids=1:1'), (e) => e instanceof BusyError && e.pid === process.ppid);
  assert.equal(calls.length, 0, 'nem chegou a API');
  // Processo inexistente: trava velha, retoma.
  writeFileSync(join(dir, '.lock'), JSON.stringify({ pid: 2_000_000_000, at: 1_000_000_000_000 }));
  await client.request('/files/K/nodes?ids=2:2');
  assert.equal(calls.length, 1);
  assert.ok(!existsSync(join(dir, '.lock')), 'libera a trava no fim');
  done();
});

test('probe: devolve status, plano e tipo de limite mesmo em 429, sem gravar bloqueio', async () => {
  const { client, dir, done } = setup([res(429, {}, { 'retry-after': '398997', 'x-figma-plan-tier': 'pro', 'x-figma-rate-limit-type': 'low' }), res(200, {}, { 'x-figma-plan-tier': 'enterprise', 'x-figma-rate-limit-type': 'high' })]);
  const limited = await client.probe('K');
  assert.deepEqual({ status: limited.status, ok: limited.ok, plan: limited.planTier, type: limited.limitType, wait: limited.retryAfterSec }, { status: 429, ok: false, plan: 'pro', type: 'low', wait: 398997 });
  assert.ok(!existsSync(join(dir, 'rate-limit.json')) || !JSON.parse(readFileSync(join(dir, 'rate-limit.json'), 'utf8')).blockedUntil, 'probe nao bloqueia');
  const ok = await client.probe('K');
  assert.equal(ok.ok, true);
  assert.equal(ok.limitType, 'high');
  done();
});
