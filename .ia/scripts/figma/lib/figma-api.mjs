// Cliente da API REST do Figma pensado para contas com cota baixa (assento de visualizacao).
// O limite do Figma conta REQUISICOES, nao o tamanho da resposta. Por isso:
//  - tudo que e baixado fica em cache em disco (raw/cache/) e e reaproveitado por layout, fx, node, check e variants;
//  - nos sao pedidos em lote (ate NODES_PER_REQUEST por requisicao) e so os que faltam no cache;
//  - um 429 com espera curta e aguardado; com espera longa o comando PARA (RateLimitError) e o bloqueio fica
//    gravado (rate-limit.json), de modo que as chamadas seguintes falham na hora, sem tocar na API;
//  - cada requisicao real e registrada em api-calls.log, para o agente saber quanto da cota ja gastou.
// Tudo que depende do ambiente (fetch, relogio, espera, token) e injetavel, para teste.
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const NODES_PER_REQUEST = 20;
const LOCK_STALE_MS = 10 * 60 * 1000;

export class RateLimitError extends Error {
  constructor(retryAfterSec, info = {}) {
    super('limite de requisicoes da API do Figma (429)');
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
    this.info = info;
  }
}

export class BusyError extends Error {
  constructor(pid) {
    super('outra chamada ao Figma esta em andamento');
    this.name = 'BusyError';
    this.pid = pid;
  }
}

export class ApiError extends Error {
  constructor(status, body) {
    super(`Figma API ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function formatWait(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.ceil(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h${String(Math.ceil((s % 3600) / 60)).padStart(2, '0')}min`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

const fileNameOf = (id) => id.replace(/[^A-Za-z0-9]/g, '-');

async function readJsonSafe(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export function createClient({
  baseUrl = 'https://api.figma.com/v1',
  getToken,
  fetchFn = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
  stateDir = null,
  minIntervalMs = 1000,
  maxWaitSec = 30,
  retries = 2,
  log = () => {},
} = {}) {
  const cacheDir = stateDir ? join(stateDir, 'cache') : null;
  const statePath = stateDir ? join(stateDir, 'rate-limit.json') : null;
  const logPath = stateDir ? join(stateDir, 'api-calls.log') : null;
  const stats = { requests: 0, cacheHits: 0 };

  async function loadState() {
    return (statePath && (await readJsonSafe(statePath))) || {};
  }
  async function saveState(patch) {
    if (!statePath) return;
    await mkdir(stateDir, { recursive: true });
    await writeFile(statePath, JSON.stringify({ ...(await loadState()), ...patch }, null, 2));
  }

  async function assertNotBlocked() {
    const st = await loadState();
    if (st.blockedUntil && st.blockedUntil > now()) {
      throw new RateLimitError(Math.ceil((st.blockedUntil - now()) / 1000), { ...st, local: true });
    }
  }

  async function pace() {
    if (!minIntervalMs) return;
    const st = await loadState();
    const wait = (st.lastRequestAt ?? 0) + minIntervalMs - now();
    if (wait > 0) await sleep(wait);
  }

  // Uma chamada por vez por arquivo Figma: o arquivo .lock em raw/ impede que dois comandos (ex.: o agente disparando em paralelo)
  // gastem a cota juntos. Trava velha (processo morto ou mais de LOCK_STALE_MS) e retomada.
  const lockPath = stateDir ? join(stateDir, '.lock') : null;
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e.code === 'EPERM';
    }
  };
  async function acquireLock() {
    if (!lockPath) return () => {};
    await mkdir(stateDir, { recursive: true });
    for (let tries = 0; tries < 2; tries++) {
      try {
        await writeFile(lockPath, JSON.stringify({ pid: process.pid, at: now() }), { flag: 'wx' });
        return () => rm(lockPath, { force: true });
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const held = await readJsonSafe(lockPath);
        const stale = !held || !alive(held.pid) || now() - (held.at ?? 0) > LOCK_STALE_MS;
        if (!stale && held.pid !== process.pid) throw new BusyError(held.pid);
        await rm(lockPath, { force: true });
      }
    }
    throw new BusyError(null);
  }

  async function request(path) {
    const release = await acquireLock();
    try {
      return await requestLocked(path);
    } finally {
      await release();
    }
  }

  async function requestLocked(path) {
    const token = getToken();
    for (let attempt = 0; ; attempt++) {
      await assertNotBlocked();
      await pace();
      const res = await fetchFn(`${baseUrl}${path}`, { headers: { 'X-Figma-Token': token } });
      stats.requests++;
      const at = now();
      if (logPath) {
        await mkdir(stateDir, { recursive: true });
        await appendFile(logPath, `${new Date(at).toISOString()}\t${res.status}\t${path}\n`);
      }
      await saveState({ lastRequestAt: at });
      if (res.status === 429) {
        const header = (name) => res.headers?.get?.(name) ?? null;
        const raw = Number(header('retry-after'));
        const retryAfter = Number.isFinite(raw) && raw > 0 ? raw : 60;
        if (retryAfter <= maxWaitSec && attempt < retries) {
          log(`Figma: 429, aguardando ${formatWait(retryAfter)} (tentativa ${attempt + 1} de ${retries + 1})`);
          await sleep(retryAfter * 1000);
          continue;
        }
        const info = { planTier: header('x-figma-plan-tier'), limitType: header('x-figma-rate-limit-type') };
        await saveState({ blockedUntil: now() + retryAfter * 1000, retryAfterSec: retryAfter, ...info });
        throw new RateLimitError(retryAfter, info);
      }
      if (!res.ok) throw new ApiError(res.status, (await res.text()).slice(0, 200));
      return res.json();
    }
  }

  // ---------- nos (layout, fx, node, check, variants, assets) ----------
  // Um no que esta DENTRO de outra arvore em cache (a secao dentro da pagina baixada com --depth 7) tambem e servido de la, com a
  // profundidade que sobra (profundidade da arvore - nivel do no). O indice e montado uma vez por execucao, so no primeiro erro de cache.
  let subtreeIndex = null;
  async function subtree(id) {
    if (!cacheDir) return null;
    if (!subtreeIndex) {
      subtreeIndex = new Map();
      const dir = join(cacheDir, 'nodes');
      if (existsSync(dir)) {
        for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json'))) {
          const hit = await readJsonSafe(join(dir, f));
          if (!hit?.document) continue;
          const visit = (node, level) => {
            const remaining = hit.depth - level;
            if (remaining < 0) return;
            const prev = subtreeIndex.get(node.id);
            if (!prev || prev.remaining < remaining) subtreeIndex.set(node.id, { document: node, remaining });
            for (const c of node.children ?? []) visit(c, level + 1);
          };
          visit(hit.document, 0);
        }
      }
    }
    return subtreeIndex.get(id) ?? null;
  }
  async function readCachedNode(id, depth) {
    if (!cacheDir) return null;
    const hit = await readJsonSafe(join(cacheDir, 'nodes', `${fileNameOf(id)}.json`));
    if (hit && hit.depth >= depth && hit.document) return hit.document;
    const inner = await subtree(id);
    return inner && inner.remaining >= depth ? inner.document : null;
  }
  async function writeCachedNode(id, depth, document) {
    if (!cacheDir) return;
    await mkdir(join(cacheDir, 'nodes'), { recursive: true });
    await writeFile(join(cacheDir, 'nodes', `${fileNameOf(id)}.json`), JSON.stringify({ depth, fetchedAt: new Date(now()).toISOString(), document }));
    subtreeIndex = null;
  }

  // Que nos ja estao em cache (com profundidade suficiente) e quais precisariam de requisicao.
  async function planNodes(ids, depth, { refresh = false, batchSize = NODES_PER_REQUEST } = {}) {
    const cached = [];
    const missing = [];
    for (const id of ids) ((!refresh && (await readCachedNode(id, depth))) ? cached : missing).push(id);
    return { cached, missing, requests: Math.ceil(missing.length / batchSize) };
  }

  // Devolve { nodes: { [id]: { document } } } (mesmo formato da API). Um no cacheado a uma profundidade maior serve
  // para pedidos mais rasos. Os que faltam vao juntos, em lotes de `batchSize` (padrao NODES_PER_REQUEST).
  // `maxRequests` limita as requisicoes desta chamada (trabalho em pedacos: o que ficou de fora vem em `pending`;
  // rodar de novo continua de onde parou, pois o que ja veio esta em cache).
  async function getNodes(key, ids, depth, { refresh = false, batchSize = NODES_PER_REQUEST, maxRequests = Infinity } = {}) {
    const nodes = {};
    const missing = [];
    for (const id of ids) {
      const hit = refresh ? null : await readCachedNode(id, depth);
      if (hit) {
        nodes[id] = { document: hit };
        stats.cacheHits++;
      } else missing.push(id);
    }
    let used = 0;
    const pending = [];
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      if (used >= maxRequests) {
        pending.push(...batch);
        continue;
      }
      used++;
      const data = await request(`/files/${key}/nodes?ids=${encodeURIComponent(batch.join(','))}&depth=${depth}`);
      for (const id of batch) {
        const document = data.nodes?.[id]?.document;
        nodes[id] = { document };
        if (document) await writeCachedNode(id, depth, document);
      }
    }
    return { nodes, pending };
  }

  // ---------- arquivo inteiro em profundidade N (map, variants, check) ----------
  async function cachedFileDepths() {
    if (!cacheDir || !existsSync(cacheDir)) return [];
    return (await readdir(cacheDir))
      .map((f) => /^file-d(\d+)\.json$/.exec(f))
      .filter(Boolean)
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b);
  }
  // exact: so serve a profundidade pedida (map e variants dependem dela); sem exact, qualquer cache mais fundo serve.
  async function getFile(key, depth, { exact = false, refresh = false } = {}) {
    if (!refresh) {
      const depths = await cachedFileDepths();
      const d = exact ? depths.find((x) => x === depth) : depths.find((x) => x >= depth);
      if (d !== undefined) {
        const data = await readJsonSafe(join(cacheDir, `file-d${d}.json`));
        if (data) {
          stats.cacheHits++;
          return data;
        }
      }
    }
    const data = await request(`/files/${key}?depth=${depth}`);
    if (cacheDir) {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(join(cacheDir, `file-d${depth}.json`), JSON.stringify(data));
    }
    return data;
  }

  // Resumo offline: bloqueio atual, requisicoes recentes e tamanho do cache.
  async function status() {
    const st = await loadState();
    const calls = [];
    if (logPath && existsSync(logPath)) {
      for (const line of (await readFile(logPath, 'utf8')).split('\n').filter(Boolean)) {
        const [at, code] = line.split('\t');
        calls.push({ at: Date.parse(at), code: Number(code) });
      }
    }
    const t = now();
    const nodesCached = cacheDir && existsSync(join(cacheDir, 'nodes')) ? (await readdir(join(cacheDir, 'nodes'))).length : 0;
    return {
      blockedUntil: st.blockedUntil && st.blockedUntil > t ? st.blockedUntil : null,
      retryAfterSec: st.blockedUntil && st.blockedUntil > t ? Math.ceil((st.blockedUntil - t) / 1000) : 0,
      planTier: st.planTier ?? null,
      limitType: st.limitType ?? null,
      calls: {
        lastHour: calls.filter((c) => c.at > t - 3600e3).length,
        last24h: calls.filter((c) => c.at > t - 86400e3).length,
        total: calls.length,
        limited: calls.filter((c) => c.code === 429).length,
      },
      cache: { nodes: nodesCached, fileDepths: await cachedFileDepths() },
    };
  }

  // Uma chamada leve ao arquivo para saber, ANTES de extrair, se o token funciona e que cota ele tem. Devolve status e os cabecalhos
  // de plano/limite (mesmo em 429); nao grava bloqueio nem espera: quem decide o que fazer e o chamador.
  async function probe(key) {
    const release = await acquireLock();
    try {
      await assertNotBlocked();
      await pace();
      const res = await fetchFn(`${baseUrl}/files/${key}?depth=1`, { headers: { 'X-Figma-Token': getToken() } });
      stats.requests++;
      const at = now();
      if (logPath) {
        await mkdir(stateDir, { recursive: true });
        await appendFile(logPath, `${new Date(at).toISOString()}	${res.status}	/files/${key}?depth=1 (preflight)
`);
      }
      await saveState({ lastRequestAt: at });
      const header = (name) => res.headers?.get?.(name) ?? null;
      const retryAfter = Number(header('retry-after'));
      return { status: res.status, ok: res.ok, planTier: header('x-figma-plan-tier'), limitType: header('x-figma-rate-limit-type'), retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null };
    } finally {
      await release();
    }
  }

  // Profundidade com que o no foi baixado (a que vale para saber o que ficou truncado), ou null se nao esta em cache.
  async function cachedDepth(id) {
    if (!cacheDir) return null;
    const hit = await readJsonSafe(join(cacheDir, 'nodes', `${fileNameOf(id)}.json`));
    if (hit?.document) return hit.depth;
    return (await subtree(id))?.remaining ?? null;
  }

  // Todos os nos em cache, para a conferencia de cobertura (offline). O id e o da raiz de cada arquivo (com "-" no lugar de ":").
  async function loadAllCachedNodes() {
    const dir = cacheDir && join(cacheDir, 'nodes');
    if (!dir || !existsSync(dir)) return [];
    const entries = [];
    for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json'))) {
      const hit = await readJsonSafe(join(dir, f));
      if (hit?.document) entries.push({ id: hit.document.id, depth: hit.depth, document: hit.document });
    }
    return entries;
  }

  return { request, getNodes, planNodes, getFile, status, stats, cachedDepth, loadAllCachedNodes, probe };
}
