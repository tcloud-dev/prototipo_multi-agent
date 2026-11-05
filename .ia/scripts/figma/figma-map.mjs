// Mapa recursivo de um arquivo Figma via API REST (todas as paginas, nao so a aberta no Desktop).
// Uso:
//   node figma-map.mjs map  --url <url|fileKey> [--depth 3] [--out <dir>]    lista paginas e frames
//   node figma-map.mjs find --file <file.json> --name <regex> [--type FRAME,COMPONENT]
//                                                                            busca nos nos ja baixados
//   node figma-map.mjs node --url <url|fileKey> --ids 316:588,316:194 [--depth 4] [--out <dir>]
//   node figma-map.mjs layout --url <url|fileKey> --ids 316:229 [--depth 4]   geometria e auto-layout de cada bloco, relativos ao no (x, y, largura, altura, layoutGrow, espaco, padding)
//   node figma-map.mjs variants --url <url|fileKey> [--out <dir>]            variantes do design (desktop/mobile x light/dark) e as secoes de cada uma
//   node figma-map.mjs image --url <url|fileKey> --ids 316:588,316:194 [--scale 1] [--out <dir>]
//                                                                            renderiza em PNG cada no (referencia visual) em figma-data/<fileKey>/refs/
//   node figma-map.mjs assets --url <url|fileKey> [--manifest <assets.json>] [--out <dir>] [--force]
//                                                                            exporta icones, logos e imagens listados em figma-data/<fileKey>/assets.json (SVG/PNG/JPG) para figma-data/<fileKey>/assets/<categoria>/
//   node figma-map.mjs fx --url <url|fileKey> --ids 846:1072,1044:500 [--depth 4] [--json]
//                                                                            rotacao, blend, opacidade, filtros (saturacao), efeitos (blur, sombra) e trechos de texto com cor/peso/tamanho proprios
//   node figma-map.mjs check --url <url|fileKey> --ids 316:588,316:194       confere se cada no existe no arquivo Figma (codigo 1 se faltar)
//   node figma-map.mjs prefetch --url <url|fileKey> (--ids a,b,c | --sections [--variants desktop-light,mobile-light]) [--depth 4] [--batch 20] [--max-requests N] [--dry-run]
//                                                                            baixa nos em LOTE para o cache (raw/cache/); layout, fx e node passam a ler dele sem chamar a API. --sections usa raw/variants.json
//   node figma-map.mjs status --url <url|fileKey>                            offline: bloqueio do Figma (429), requisicoes das ultimas 24h e o que ja esta em cache
//   node figma-map.mjs spec --url <url|fileKey> --ids <secao>[,<secao>...] [--depth 4] [--stdout]
//                                                                            especificacao por secao em figma-data/<fileKey>/spec/ (vai para o git): arvore com coordenadas relativas a secao, textos com tipografia, imagens (scaleMode/imageTransform), clip, absolutos e ocultos, efeitos agrupados e lacunas. Le do cache (sem API se ja baixado)
//   node figma-map.mjs coverage --url <url|fileKey> [--roots id,id]          offline: une as arvores do cache e lista os conteineres visiveis que NENHUMA cobre (truncados pela profundidade), arquivos vazios em raw/ e itens "feitos" invalidos; grava coverage.json; saida 1 se houver lacuna
//   (layout e fx aceitam --save <arquivo>: gravam so se o comando terminou bem, sem deixar arquivo vazio; use no lugar de `> arquivo`. Um no que esta dentro de outra arvore em cache e servido de la sem requisicao)
//   (map/node aceitam --from-file <json> para trabalhar offline com uma resposta ja salva)
// Limite de requisicoes (assento de visualizacao tem cota baixa): tudo que e baixado fica em figma-data/<fileKey>/raw/cache/ e nada e pedido duas vezes
// (--refresh forca novo download); nos vao em lote; 429 curto espera, 429 longo PARA com codigo 3 e grava o bloqueio (chamadas seguintes falham na hora).
// Variaveis: FIGMA_MIN_INTERVAL_MS (padrao 1000, intervalo entre requisicoes) e FIGMA_MAX_WAIT_SEC (padrao 30, maior espera aceita num 429).
// Codigos de saida: 0 ok, 1 falha, 2 uso/token, 3 limite de requisicoes do Figma.
// Saida padrao: figma-data/<fileKey>/ na raiz do repositorio (raw/ = JSON bruto, refs/ = PNGs, assets/ = arquivos exportados).
// Token: variavel de ambiente FIGMA_TOKEN ou, se ela nao existir, o arquivo
// ~/.config/figma/.env (fora do repositorio, chmod 600), com a linha FIGMA_TOKEN=...
// (Figma > Settings > Security > Personal access tokens, escopo file_content:read).
// Nunca grave o token em arquivo do repositorio.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseManifest, planCalls, splitPending } from './lib/assets.mjs';
import { ApiError, RateLimitError, createClient, formatWait, NODES_PER_REQUEST } from './lib/figma-api.mjs';
import { writeAtomic } from './lib/atomic.mjs';
import { cacheCoverage } from './lib/coverage.mjs';
import { collectFx } from './lib/fx.mjs';
import { buildSpec } from './lib/spec.mjs';
import { buildVariants, pageLikeFrames } from './lib/variants.mjs';
import { extOf, resolveOriginal } from './lib/originals.mjs';
import tls from 'node:tls';

// Proxy corporativo (TOTVS) reassina o HTTPS com uma CA propria, instalada no repositorio de certificados do SO.
// Confia nessas CAs alem das embutidas no Node (equivale a NODE_USE_SYSTEM_CA=1). Nao desliga a validacao.
try {
  tls.setDefaultCACertificates([...tls.getCACertificates('bundled'), ...tls.getCACertificates('system')]);
} catch {
  // Node sem essa API: use NODE_USE_SYSTEM_CA=1 ao rodar o comando.
}

// Raiz do repositorio que esta usando o script (nao a do script: instalado como plugin, ele fica no cache do Claude Code).
// Vem do git a partir do diretorio atual; fora de um repositorio git, usa o diretorio atual.
const REPO_ROOT = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.cwd();
  }
})();
const dataDir = (key, ...sub) => join(REPO_ROOT, 'figma-data', key, ...sub);
const [command, ...rest] = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

// FIGMA_API_URL existe so para teste e so aceita endereco local (o token nunca vai para outro host).
const LOCAL_API = /^http:\/\/(127\.0\.0\.1|localhost):\d+\//;
const API = LOCAL_API.test(process.env.FIGMA_API_URL ?? '') ? process.env.FIGMA_API_URL.replace(/\/$/, '') : 'https://api.figma.com/v1';
const COVER = /\b(cover|capa|thumbnail|index|intro|welcome)\b/i;
const LIBRARY = /(component|style|icon|design system|library|tokens|biblioteca|componente)/i;

function fileKeyOf(input) {
  if (!input) return null;
  return input.match(/figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)/)?.[1] ?? (/^[A-Za-z0-9]+$/.test(input) ? input : null);
}

const normalizeId = (id) => id.replace('-', ':');

// A variavel de ambiente tem prioridade; o arquivo so e lido se ela nao existir.
function loadTokenFile() {
  const file = join(homedir(), '.config', 'figma', '.env');
  if (process.env.FIGMA_TOKEN || !existsSync(file)) return;
  if (process.platform !== 'win32' && statSync(file).mode & 0o077) console.error(`Aviso: ${file} e legivel por outros usuarios; rode chmod 600 nele.`);
  process.loadEnvFile(file);
}

const REFRESH = rest.includes('--refresh');

function getToken() {
  loadTokenFile();
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    console.error('FIGMA_TOKEN nao definido. Crie um Personal access token (Figma > Settings > Security, escopo file_content:read) e guarde em ~/.config/figma/.env (linha FIGMA_TOKEN=..., chmod 600) ou rode `export FIGMA_TOKEN=...` no terminal antes de abrir o Claude Code. Nao salve o token em arquivos do repositorio.');
    process.exit(2);
  }
  return token;
}

// Um cliente por execucao (um arquivo Figma por vez). Cache, ritmo e bloqueio por 429 ficam em figma-data/<key>/raw/.
let client = null;
const clientFor = (key) =>
  (client ??= createClient({
    baseUrl: API,
    getToken,
    stateDir: dataDir(key, 'raw'),
    minIntervalMs: Number(process.env.FIGMA_MIN_INTERVAL_MS ?? 1000),
    maxWaitSec: Number(process.env.FIGMA_MAX_WAIT_SEC ?? 30),
    log: (m) => console.error(m),
  }));

function reportUsage() {
  if (client && (client.stats.requests || client.stats.cacheHits)) {
    console.error(`[figma] ${client.stats.requests} requisicao(oes) a API, ${client.stats.cacheHits} item(ns) vindo(s) do cache`);
  }
}

function reportRateLimit(e) {
  const at = new Date(Date.now() + e.retryAfterSec * 1000).toLocaleString('pt-BR');
  console.error(`LIMITE DA API DO FIGMA (429). Tente de novo em ~${formatWait(e.retryAfterSec)} (a partir de ${at}).`);
  if (e.info?.planTier || e.info?.limitType) console.error(`Plano: ${e.info.planTier ?? '?'}; tipo de limite: ${e.info.limitType ?? '?'}.`);
  if (e.retryAfterSec > 3600) console.error('Espera longa: costuma ser conta SEM assento Dev/Full (cota pequena). Opcoes: usar o token de uma conta com Dev/Full (o figma-data/ extraido por ela vale para todos) ou esperar.');
  console.error('O que ja foi baixado continua em cache (figma-data/<fileKey>/raw/cache/); `status` mostra o estado. PARE e reporte: nao insista, nao rode em segundo plano e nao crie laco de repeticao.');
}

const size = (n) => (n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : '');

const countNodes = (node) => (node.children ?? []).reduce((sum, c) => sum + 1 + countNodes(c), 0);

// O tipo da pagina e so uma DICA para o humano/agente; nenhuma pagina e ignorada por causa dele.
// Regras (conteudo vence o nome, para nao rotular como capa uma pagina que tem o site inteiro):
//  - arquivo com uma unica pagina: sempre `content` (ela e o conteudo, seja qual for o nome);
//  - pagina com mais que SMALL nos: `content`, mesmo que o nome sugira capa/biblioteca;
//  - pagina pequena: nome de biblioteca -> `library`; nome de capa ou <= 1 no -> `cover?`.
const SMALL = 8;
function pageKind(page, totalPages) {
  const nodes = countNodes(page);
  const nameHint = LIBRARY.test(page.name) ? 'library' : COVER.test(page.name) ? 'cover?' : null;
  if (totalPages === 1) return nameHint ? `content (nome sugere ${nameHint === 'library' ? 'biblioteca' : 'capa'}, mas e a unica pagina)` : 'content';
  if (nodes > SMALL) return nameHint ? `content (nome sugere ${nameHint === 'library' ? 'biblioteca' : 'capa'}, mas tem ${nodes} nos)` : 'content';
  if (nameHint) return nameHint;
  return nodes <= 1 ? 'cover?' : 'content';
}

function tree(node, maxDepth, depth = 0, lines = []) {
  const pad = '  '.repeat(depth);
  lines.push(`${pad}- ${node.name} [${node.type} ${node.id}${size(node) ? ` ${size(node)}` : ''}]`);
  if (depth < maxDepth) for (const c of node.children ?? []) tree(c, maxDepth, depth + 1, lines);
  else if (node.children?.length) lines.push(`${pad}  ... ${node.children.length} filho(s) alem da profundidade`);
  return lines;
}

function* walk(node, path = []) {
  const here = [...path, node.name];
  yield { node, path: here };
  for (const c of node.children ?? []) yield* walk(c, here);
}

async function load(label) {
  const fromFile = opt('from-file');
  if (fromFile) return JSON.parse(await readFile(resolve(fromFile), 'utf8'));
  const key = fileKeyOf(opt('url'));
  if (!key) {
    console.error(`${label}: informe --url <url do Figma|fileKey> ou --from-file <json>`);
    process.exit(2);
  }
  return { key, fetch: true };
}

async function cmdMap() {
  const depth = Number(opt('depth', 3));
  const src = await load('map');
  const file = src.fetch ? await clientFor(src.key).getFile(src.key, depth, { exact: true, refresh: REFRESH }) : src;
  const key = src.key ?? fileKeyOf(opt('url')) ?? 'offline';
  const out = resolve(opt('out', dataDir(key, 'raw')));
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'file.json'), JSON.stringify(file));

  const pages = file.document.children;
  const md = [`# ${file.name}`, '', `- Arquivo: \`${key}\``, `- Ultima modificacao: ${file.lastModified ?? '?'}`, `- Paginas: ${pages.length} (profundidade ${depth})`, ''];
  for (const page of pages) {
    const likely = pageLikeFrames(page).map((f) => `  - ${f.name} [${f.id} ${size(f)}]`);
    md.push(`## ${page.name} [${page.id}] - ${pageKind(page, pages.length)}`, '', ...tree(page, depth - 1).slice(1), '');
    if (likely.length) md.push(`Frames com cara de pagina do site (use \`node --ids <id>\` para ver as secoes):`, ...likely, '');
  }
  await writeFile(join(out, 'map.md'), md.join('\n'));

  console.log(`${file.name}: ${pages.length} pagina(s)`);
  for (const page of pages) {
    const frames = (page.children ?? []).filter((c) => ['FRAME', 'SECTION', 'COMPONENT_SET'].includes(c.type)).length;
    const likely = pageLikeFrames(page);
    console.log(`  ${page.id.padEnd(8)} ${pageKind(page, pages.length).padEnd(8)} ${page.name} (${(page.children ?? []).length} no(s) de topo, ${frames} frame/secao, ${likely.length} frame(s) com cara de pagina)`);
  }
  console.log('\nNenhuma pagina e ignorada pelo tipo: ele e so uma dica. Procure secoes em TODAS com `find`; se nao achar, aumente --depth antes de concluir que nao existe.');
  console.log(`\nMapa completo: ${join(out, 'map.md')}\nJSON bruto (para o comando find): ${join(out, 'file.json')}`);
}

async function cmdFind() {
  const file = opt('file');
  const name = opt('name');
  if (!file || !name) {
    console.error('find: informe --file <file.json> e --name <regex>');
    process.exit(2);
  }
  const data = JSON.parse(await readFile(resolve(file), 'utf8'));
  const re = new RegExp(name, 'i');
  const types = opt('type')?.split(',').map((t) => t.trim().toUpperCase());
  let hits = 0;
  for (const { node, path } of walk(data.document ?? data)) {
    if (!re.test(node.name) || (types && !types.includes(node.type))) continue;
    hits++;
    console.log(`${node.id.padEnd(10)} ${node.type.padEnd(14)} ${path.slice(1).join(' > ')}${size(node) ? `  (${size(node)})` : ''}`);
  }
  console.log(hits ? `\n${hits} resultado(s)` : 'nenhum resultado (o JSON foi baixado com profundidade suficiente? use map --depth maior ou o comando node)');
}

async function cmdNode() {
  const ids = opt('ids')?.split(',').map(normalizeId);
  const depth = Number(opt('depth', 4));
  const src = await load('node');
  if (!ids?.length) {
    console.error('node: informe --ids 316:588,316:194');
    process.exit(2);
  }
  const data = src.fetch ? await clientFor(src.key).getNodes(src.key, ids, depth, { refresh: REFRESH }) : { nodes: Object.fromEntries(ids.map((id) => [id, { document: [...walk(src.document ?? src)].find((w) => w.node.id === id)?.node }])) };
  const out = resolve(opt('out', dataDir(src.key ?? 'offline', 'raw')));
  await mkdir(out, { recursive: true });
  for (const id of ids) {
    const doc = data.nodes?.[id]?.document;
    if (!doc) {
      console.log(`${id}: nao encontrado`);
      continue;
    }
    const file = join(out, `node-${id.replace(':', '-')}.json`);
    await writeFile(file, JSON.stringify(doc));
    console.log(tree(doc, depth).join('\n'), `\n-> ${file}\n`);
  }
}

// ---------- geometria e auto-layout (fonte da verdade escrita para comparar com o DOM) ----------
function layoutText(root, depth) {
  const ox = root.absoluteBoundingBox.x;
  const oy = root.absoluteBoundingBox.y;
  const lines = [`${root.name} [${root.id}] ${Math.round(root.absoluteBoundingBox.width)}x${Math.round(root.absoluteBoundingBox.height)}  (x,y relativos ao no)`];
  (function visit(n, d) {
    const b = n.absoluteBoundingBox;
    if (b && d > 0 && ['FRAME', 'TEXT', 'GROUP', 'INSTANCE', 'COMPONENT', 'RECTANGLE'].includes(n.type)) {
      const bits = [`x=${Math.round(b.x - ox)}`, `y=${Math.round(b.y - oy)}`, `w=${Math.round(b.width)}`, `h=${Math.round(b.height)}`];
      if (n.layoutMode && n.layoutMode !== 'NONE') bits.push(`layout=${n.layoutMode.toLowerCase()}`);
      if (n.layoutGrow) bits.push(`grow=${n.layoutGrow}`);
      if (n.layoutMode && n.layoutMode !== 'NONE' && n.itemSpacing) bits.push(`gap=${n.itemSpacing}`);
      const pad = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].map((v) => v ?? 0);
      if (pad.some(Boolean)) bits.push(`padding=${pad.join('/')}`);
      if (n.layoutAlign && n.layoutAlign !== 'INHERIT') bits.push(`align=${n.layoutAlign.toLowerCase()}`);
      if (n.counterAxisAlignItems && n.layoutMode && n.layoutMode !== 'NONE') bits.push(`cross=${n.counterAxisAlignItems.toLowerCase()}`);
      lines.push(`${'  '.repeat(d - 1)}${n.name.slice(0, 26).padEnd(26)} ${bits.join(' ')}`);
    }
    if (d < depth) for (const c of n.children ?? []) visit(c, d + 1);
  })(root, 0);
  return lines.join('\n');
}

// Com --save <arquivo> o resultado e gravado so se o comando terminou bem (nunca sobra arquivo vazio) e a tela mostra uma linha.
// Sem --save, imprime. O agente usa --save em vez de redirecionar a saida (`> arquivo`).
async function emitOrSave(text, label) {
  const file = opt('save');
  if (!file) {
    console.log(text);
    return;
  }
  await writeAtomic(resolve(file), `${text}\n`);
  console.log(`${label}: ${text.split('\n').length} linha(s) -> ${resolve(file)}`);
}

// Aceita varios nos em --ids: vao numa unica requisicao (e ficam em cache para o fx e o node).
async function cmdLayout() {
  const ids = opt('ids', '').split(',').map((s) => s.trim()).filter(Boolean).map(normalizeId);
  const depth = Number(opt('depth', 4));
  const src = await load('layout');
  if (!ids.length) {
    console.error('layout: informe --ids <node>[,<node>...] (secoes)');
    process.exit(2);
  }
  const data = src.fetch ? await clientFor(src.key).getNodes(src.key, ids, depth, { refresh: REFRESH }) : { nodes: Object.fromEntries(ids.map((id) => [id, { document: [...walk(src.document ?? src)].find((w) => w.node.id === id)?.node }])) };
  let missing = 0;
  const blocks = [];
  ids.forEach((id) => {
    const root = data.nodes?.[id]?.document;
    if (!root) {
      console.error(`layout: no ${id} nao encontrado`);
      missing++;
      return;
    }
    blocks.push(layoutText(root, depth));
  });
  if (blocks.length) await emitOrSave(blocks.join('\n\n'), 'layout');
  if (missing) process.exit(1);
}

// ---------- variantes do design ----------
// Um arquivo de design costuma ter a mesma pagina em varias variantes (desktop/mobile x light/dark), lado a lado
// na pagina de conteudo. Infere o dispositivo e o tema pelo nome do frame (e pela largura) e lista as secoes de cada um.
async function cmdVariants() {
  const src = await load('variants');
  const file = src.fetch ? await clientFor(src.key).getFile(src.key, 3, { exact: true, refresh: REFRESH }) : src;
  const key = src.key ?? fileKeyOf(opt('url')) ?? 'offline';
  const out = resolve(opt('out', dataDir(key, 'raw')));
  await mkdir(out, { recursive: true });
  const pages = file.document.children;
  // Variante vem de frame de pagina no topo (pagina, SECTION, GROUP); pagina de capa/biblioteca nao entra (fica em "ignoradas").
  const skippedPages = [];
  const usable = pages.filter((p) => {
    const kind = pageKind(p, pages.length);
    if (kind === 'cover?' || kind === 'library') skippedPages.push(`${p.name} (${kind})`);
    return !(kind === 'cover?' || kind === 'library');
  });
  let frames = usable.flatMap((p) => pageLikeFrames(p, [], true).map((f) => ({ page: p.name, frame: f })));
  let fallback = false;
  if (!frames.length) {
    // Design com as paginas dentro de um FRAME de embrulho: procura em qualquer profundidade, mas avisa (pode pegar cards).
    frames = usable.flatMap((p) => pageLikeFrames(p, [], false).map((f) => ({ page: p.name, frame: f })));
    fallback = frames.length > 0;
  }
  const ids = frames.map((x) => x.frame.id);
  // Pedido em lote com profundidade 2 para ter os filhos diretos (as secoes) de todos os frames.
  const detail = src.fetch && ids.length ? await clientFor(src.key).getNodes(src.key, ids, 2, { refresh: REFRESH }) : null;
  const result = { fileKey: key, name: file.name, variants: buildVariants(frames.map((x) => ({ ...x, full: detail?.nodes?.[x.frame.id]?.document ?? x.frame }))), ...(skippedPages.length ? { skippedPages } : {}), ...(fallback ? { warning: 'nenhum frame de pagina no topo; busca em qualquer profundidade (pode incluir cards e componentes): confira cada variante' } : {}) };
  await writeFile(join(out, 'variants.json'), JSON.stringify(result, null, 2));
  console.log(`${file.name}: ${Object.keys(result.variants).length} variante(s)\n`);
  for (const [k, v] of Object.entries(result.variants)) {
    console.log(`${k.padEnd(18)} ${v.frameId.padEnd(9)} ${v.width}x${v.height}  "${v.frameName}"  (pagina "${v.page}")${v.inferred ? '  [inferido: nome sem dispositivo/tema explicitos]' : ''}`);
    console.log(`  secoes: ${v.sections.map((s) => `${s.name} [${s.id} ${s.height}px]`).join(', ') || '(nenhuma no nivel direto)'}`);
    if (v.alternatives?.length) console.log(`  outros frames com o mesmo nome de variante (ignorados no prefetch): ${v.alternatives.map((a) => `${a.frameName} [${a.frameId}]`).join(', ')}`);
  }
  if (skippedPages.length) console.log(`\nPaginas ignoradas (capa/biblioteca): ${skippedPages.join(', ')}`);
  if (result.warning) console.log(`\nATENCAO: ${result.warning}`);
  console.log(`\nJSON: ${join(out, 'variants.json')}`);
}

// ---------- efeitos (rotacao, blend, filtros, trechos de texto com estilo) ----------
// O que o `layout` e o `node` nao mostram e quem implementa nao deve adivinhar. Lista so os nos notaveis da subarvore.
async function cmdFx() {
  const ids = opt('ids')?.split(',').map(normalizeId);
  const depth = Number(opt('depth', 4));
  if (!ids?.length) {
    console.error('fx: informe --url <url|fileKey> --ids 846:1072,1044:500 [--depth 4] [--json]');
    process.exit(2);
  }
  const src = await load('fx');
  const data = await clientFor(src.key).getNodes(src.key, ids, depth, { refresh: REFRESH });
  const lines = [];
  for (const id of ids) {
    const doc = data.nodes?.[id]?.document;
    if (!doc) {
      lines.push(`${id}: nao encontrado`);
      continue;
    }
    const found = collectFx(doc, depth);
    if (rest.includes('--json')) lines.push(JSON.stringify({ id, found }, null, 2));
    else if (!found.length) lines.push(`${id} ${doc.name}: nada notavel (sem rotacao, blend, filtro, efeito nem trecho de texto com estilo proprio)`);
    else {
      // Mesmo efeito em varios nos (ex.: cornerRadius 16 em 28 botoes) vira uma linha so: as excecoes ficam visiveis.
      const groups = new Map();
      for (const n of found) {
        const k = JSON.stringify(n.fx);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(n);
      }
      for (const [k, nodes] of groups) {
        if (nodes.length === 1) lines.push(`${nodes[0].id}  ${nodes[0].type}  ${nodes[0].path}\n    ${k}`);
        else lines.push(`${nodes.length} nos iguais: ${k}\n    ${nodes.map((n) => n.id).join(', ')}`);
      }
    }
  }
  await emitOrSave(lines.join('\n'), 'fx');
}

// ---------- imagem de referencia (render do Figma) ----------
// Renderiza em PNG cada no informado em --ids (ex.: telas, secoes, componentes), todos numa requisicao. Pula o PNG que ja existe em refs/ (--force renova).
async function cmdImage() {
  const ids = opt('ids')?.split(',').map(normalizeId);
  const key = fileKeyOf(opt('url'));
  if (!key || !ids?.length) {
    console.error('image: informe --url <url|fileKey> --ids 316:588,316:194 [--scale 1] [--out <dir>]');
    process.exit(2);
  }
  const out = resolve(opt('out', dataDir(key, 'refs')));
  await mkdir(out, { recursive: true });
  const scale = opt('scale', '1');
  const force = rest.includes('--force');
  const todo = ids.filter((id) => {
    if (!force && existsSync(join(out, `${id.replace(':', '-')}.png`))) {
      console.log(`PULOU  ${id} (ja existe; --force para renovar)`);
      return false;
    }
    return true;
  });
  if (!todo.length) return;
  const data = await clientFor(key).request(`/images/${key}?ids=${encodeURIComponent(todo.join(','))}&format=png&scale=${scale}`);
  let missing = 0;
  for (const id of todo) {
    const url = data.images?.[id];
    if (!url) {
      missing++;
      console.log(`FALTA  ${id} (o Figma nao renderizou)`);
      continue;
    }
    const res = await fetch(url); // URL pre-assinada de curta duracao: sem o token
    const file = join(out, `${id.replace(':', '-')}.png`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    console.log(`OK     ${id.padEnd(10)} -> ${file}`);
  }
  if (missing) process.exit(1);
}

// ---------- assets (icones, logos, imagens) ----------
// O manifesto `figma-data/<fileKey>/assets.json` (escrito pelo agente) diz o que exportar:
//   { "assets": [ { "id": "logo-branco", "node": "551:430", "category": "logos", "format": "svg" },
//                 { "id": "foto-hero", "node": "1:2", "category": "imagens", "format": "jpg", "mode": "original" } ] }
//   mode "render" (padrao): o Figma desenha o no (icones, logos). mode "original": baixa o arquivo da imagem colocada no design (fotos), sem o que estiver por cima dela.
// Cada arquivo vai para figma-data/<fileKey>/assets/<categoria>/<id>.<formato>. Nao sobrescreve arquivo que ja existe (use --force). Sai com 1 se algum asset falhar.
async function cmdAssets() {
  const key = fileKeyOf(opt('url'));
  if (!key) {
    console.error('assets: informe --url <url|fileKey> [--manifest <assets.json>] [--out <dir>] [--force]');
    process.exit(2);
  }
  const manifestPath = resolve(opt('manifest', dataDir(key, 'assets.json')));
  if (!existsSync(manifestPath)) {
    console.error(`assets: manifesto nao encontrado (${manifestPath}). O agente cria o assets.json antes de exportar.`);
    process.exit(1);
  }
  const { assets, errors } = parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  if (errors.length) {
    console.error(`assets: manifesto invalido:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  const out = resolve(opt('out', dataDir(key, 'assets')));
  const { pending, skipped } = splitPending(assets, (file) => existsSync(join(out, file)), rest.includes('--force'));
  skipped.forEach((a) => console.log(`PULOU  ${a.file.padEnd(34)} ${a.node} (ja existe; --force para sobrescrever)`));
  let failed = 0;
  // mode "original": baixa o arquivo da imagem colocada no design (fill IMAGE), sem o que estiver por cima dela.
  const originals = pending.filter((a) => a.mode === 'original');
  if (originals.length) {
    const imageUrls = (await clientFor(key).request(`/files/${key}/images`)).meta?.images ?? {};
    for (let i = 0; i < originals.length; i += 20) {
      const batch = originals.slice(i, i + 20);
      const data = await clientFor(key).getNodes(key, batch.map((a) => a.node), 6, { refresh: REFRESH });
      for (const a of batch) {
        const doc = data.nodes?.[a.node]?.document;
        const picked = doc ? resolveOriginal(doc) : { error: 'no nao encontrado' };
        const url = picked.imageRef ? imageUrls[picked.imageRef] : null;
        if (!url) {
          failed++;
          console.log(`FALTA  ${a.file.padEnd(34)} ${a.node} (${picked.error ?? 'o Figma nao devolveu a URL da imagem original'})`);
          continue;
        }
        const res = await fetch(url); // URL pre-assinada de curta duracao: sem o token
        if (!res.ok) {
          failed++;
          console.log(`FALHA  ${a.file.padEnd(34)} ${a.node} (download ${res.status})`);
          continue;
        }
        const bytes = Buffer.from(await res.arrayBuffer());
        const ext = extOf(bytes) ?? a.format;
        const file = join(out, a.category, `${a.id}.${ext}`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, bytes);
        console.log(`OK     ${`${a.category}/${a.id}.${ext}`.padEnd(34)} ${a.node} (original${picked.source !== a.node ? `, no ${picked.source}` : ''}${ext !== a.format ? `; formato real ${ext}, manifesto dizia ${a.format}` : ''})`);
      }
    }
  }
  for (const call of planCalls(pending)) {
    const ids = call.assets.map((a) => a.node).join(',');
    const data = await clientFor(key).request(`/images/${key}?ids=${encodeURIComponent(ids)}&format=${call.format}&scale=${call.scale}`);
    for (const a of call.assets) {
      const url = data.images?.[a.node];
      if (!url) {
        failed++;
        console.log(`FALTA  ${a.file.padEnd(34)} ${a.node} (o Figma nao renderizou)`);
        continue;
      }
      const res = await fetch(url); // URL pre-assinada de curta duracao: sem o token
      if (!res.ok) {
        failed++;
        console.log(`FALHA  ${a.file.padEnd(34)} ${a.node} (download ${res.status})`);
        continue;
      }
      const file = join(out, a.file);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      console.log(`OK     ${a.file.padEnd(34)} ${a.node}`);
    }
  }
  console.log(`${pending.length - failed}/${pending.length} asset(s) exportado(s), ${skipped.length} ja existia(m), em ${out}`);
  if (failed) process.exit(1);
}

// Teste de obtencao de dados: cada no de --ids precisa existir no arquivo.
// Sai com codigo 1 se algum faltar; nos que existem mostra nome e tamanho para conferencia humana.
async function cmdCheck() {
  const key = fileKeyOf(opt('url'));
  const ids = opt('ids')?.split(',').map(normalizeId);
  if (!key || !ids?.length) {
    console.error('check: informe --url <url|fileKey> --ids 316:588,316:194');
    process.exit(2);
  }
  const meta = await clientFor(key).getFile(key, 1, { refresh: REFRESH });
  console.log(`Arquivo ${key}: "${meta.name}" (${meta.document.children.length} pagina(s)), ultima modificacao ${meta.lastModified}`);
  const data = await clientFor(key).getNodes(key, ids, 1, { refresh: REFRESH });
  let missing = 0;
  for (const id of ids) {
    const doc = data.nodes?.[id]?.document;
    if (!doc) {
      missing++;
      console.log(`FALTA  ${id}  (nao existe no arquivo)`);
    } else {
      console.log(`OK     ${id.padEnd(9)} ${doc.type.padEnd(10)} "${doc.name}" ${size(doc)}`);
    }
  }
  console.log(missing ? `\n${missing} de ${ids.length} no(s) nao encontrado(s)` : `\nTodos os ${ids.length} no(s) existem no Figma`);
  if (missing) process.exit(1);
}

// ---------- prefetch: baixa nos em lote para o cache ----------
// Com cota baixa (assento de visualizacao) o que importa e o NUMERO de requisicoes: aqui os nos vao juntos, em lotes, e o que ja
// esta em cache nao e pedido de novo. --max-requests N trabalha em pedacos: faz no maximo N requisicoes e diz o que ficou; rodar de
// novo continua de onde parou. --dry-run so mostra o plano (nenhuma requisicao).
function sectionIdsFromVariants(key, only) {
  const file = dataDir(key, 'raw', 'variants.json');
  if (!existsSync(file)) {
    console.error(`prefetch: ${file} nao existe; rode antes: node figma-map.mjs variants --url ${key}`);
    process.exit(2);
  }
  const wanted = only?.split(',').map((s) => s.trim());
  const variants = JSON.parse(readFileSync(file, 'utf8')).variants;
  const ids = [];
  for (const [name, v] of Object.entries(variants)) {
    if (wanted && !wanted.includes(name)) continue;
    for (const s of v.sections) if (!ids.includes(s.id)) ids.push(s.id);
  }
  return ids;
}

async function cmdPrefetch() {
  const key = fileKeyOf(opt('url'));
  let ids = opt('ids')?.split(',').map(normalizeId);
  if (!key || (!ids?.length && !rest.includes('--sections'))) {
    console.error('prefetch: informe --url <url|fileKey> e --ids a,b,c ou --sections [--variants desktop-light,mobile-light]; opcoes: --depth 4 --batch 20 --max-requests N --dry-run --refresh');
    process.exit(2);
  }
  if (!ids?.length) ids = sectionIdsFromVariants(key, opt('variants'));
  const depth = Number(opt('depth', 4));
  const batchSize = Math.max(1, Number(opt('batch', NODES_PER_REQUEST)));
  const maxRequests = opt('max-requests') ? Math.max(1, Number(opt('max-requests'))) : Infinity;
  const c = clientFor(key);
  const plan = await c.planNodes(ids, depth, { refresh: REFRESH, batchSize });
  console.log(`${ids.length} no(s) a profundidade ${depth}: ${plan.cached.length} ja em cache, ${plan.missing.length} a baixar em ${plan.requests} requisicao(oes) de ate ${batchSize}.`);
  if (rest.includes('--dry-run') || !plan.missing.length) return;
  const out = await c.getNodes(key, ids, depth, { refresh: REFRESH, batchSize, maxRequests });
  const notFound = plan.missing.filter((id) => !out.pending.includes(id) && !out.nodes[id]?.document);
  notFound.forEach((id) => console.log(`FALTA  ${id} (nao encontrado no arquivo)`));
  console.log(`Baixados: ${plan.missing.length - out.pending.length - notFound.length}.`);
  if (out.pending.length) console.log(`PENDENTES (${out.pending.length}, limite --max-requests ${maxRequests}): rode o mesmo comando de novo para continuar: ${out.pending.join(',')}`);
}

// ---------- spec: especificacao por secao, lida do cache ----------
// Gera figma-data/<fileKey>/spec/<secao>-<id>.md (vai para o git; o raw/ nao): arvore com coordenadas relativas a secao, textos com
// tipografia, imagens (scaleMode/imageTransform), clip, absolutos e ocultos, efeitos agrupados e as lacunas de profundidade.
// O programmer le SO isso. Baixa o que faltar no cache (uma requisicao em lote); com tudo em cache nao usa a API nem o token.
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'no';

async function cmdSpec() {
  const key = fileKeyOf(opt('url'));
  const ids = opt('ids', '').split(',').map((s) => s.trim()).filter(Boolean).map(normalizeId);
  if (!key || !ids.length) {
    console.error('spec: informe --url <url|fileKey> --ids <secao>[,<secao>...] [--depth 4] [--stdout]');
    process.exit(2);
  }
  const depth = Number(opt('depth', 4));
  const c = clientFor(key);
  const data = await c.getNodes(key, ids, depth, { refresh: REFRESH });
  let missing = 0;
  for (const id of ids) {
    const doc = data.nodes?.[id]?.document;
    if (!doc) {
      console.error(`spec: no ${id} nao encontrado`);
      missing++;
      continue;
    }
    const { markdown, gaps } = buildSpec(doc, { depth: (await c.cachedDepth(id)) ?? depth, key, generatedAt: new Date().toISOString().slice(0, 10) });
    if (rest.includes('--stdout')) {
      console.log(markdown);
      continue;
    }
    const file = dataDir(key, 'spec', `${slug(doc.name)}-${id.replace(':', '-')}.md`);
    await writeAtomic(file, markdown);
    const open = gaps.truncated.filter((t) => !t.hidden).length;
    console.log(`${id.padEnd(10)} ${doc.name}: ${markdown.split('\n').length} linhas -> ${file}${open ? `  [${open} contêiner(es) truncado(s): veja "Lacunas"]` : ''}`);
  }
  if (missing) process.exit(1);
}

// ---------- coverage: o que ainda falta, calculado do que existe em disco (offline) ----------
// Une todas as arvores do cache: so e lacuna o conteiner visivel truncado que NENHUMA arvore cobre. Alem disso aponta arquivos vazios
// em raw/ e itens marcados como feitos no index.json sem o arquivo correspondente. Grava coverage.json. Saida 1 se houver lacuna.
async function cmdCoverage() {
  const key = fileKeyOf(opt('url'));
  if (!key) {
    console.error('coverage: informe --url <url|fileKey> [--roots id,id]');
    process.exit(2);
  }
  const roots = opt('roots')?.split(',').map((s) => normalizeId(s.trim()));
  const entries = (await clientFor(key).loadAllCachedNodes()).filter((e) => !roots || roots.includes(e.id));
  const cov = cacheCoverage(entries);
  const raw = dataDir(key, 'raw');
  const emptyFiles = [];
  if (existsSync(raw)) for (const f of await readdir(raw)) if (/\.(txt|json|md)$/.test(f) && statSync(join(raw, f)).size === 0) emptyFiles.push(f);
  const missingDone = [];
  const indexFile = dataDir(key, 'index.json');
  if (existsSync(indexFile)) {
    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    for (const [list, prefix] of [['layoutDone', 'layout'], ['fxDone', 'fx']]) {
      for (const id of index[list] ?? []) {
        const f = join(raw, `${prefix}-${id.replace(':', '-')}.txt`);
        if (existsSync(f) && statSync(f).size === 0) missingDone.push(`${list}: ${id} (arquivo vazio)`);
      }
    }
  }
  const byRoot = new Map();
  for (const g of cov.gaps) byRoot.set(g.from, (byRoot.get(g.from) ?? 0) + 1);
  const complete = !cov.gaps.length && !emptyFiles.length && !missingDone.length;
  const report = { generatedAt: new Date().toISOString(), status: complete ? 'complete' : 'partial', trees: cov.trees, nodes: cov.nodes, gaps: cov.gaps.map(({ id, name, type, path, from }) => ({ id, name, type, path, from })), hiddenTruncated: cov.hiddenTruncated, emptyFiles, missingDone };
  await writeAtomic(dataDir(key, 'coverage.json'), JSON.stringify(report, null, 2));
  console.log(`${cov.trees} arvore(s) em cache, ${cov.nodes} no(s) lidos. Status: ${report.status.toUpperCase()}.`);
  console.log(`Contêineres visíveis sem cobertura: ${cov.gaps.length}${byRoot.size ? ` (${[...byRoot].map(([r, n]) => `${r}: ${n}`).join('; ')})` : ''}. Ocultos truncados (ignorados): ${cov.hiddenTruncated}.`);
  if (cov.gaps.length) console.log(`  Exemplos: ${cov.gaps.slice(0, 5).map((g) => `${g.name} [${g.id}]`).join('; ')}. Para cobrir, baixe a raiz ("de") com --depth maior (1 requisicao) e rode o coverage de novo.`);
  if (emptyFiles.length) console.log(`Arquivos vazios em raw/ (refaça com --save): ${emptyFiles.join(', ')}`);
  missingDone.forEach((m) => console.log(`Marcado como feito mas inválido: ${m}`));
  console.log(`Relatório: ${dataDir(key, 'coverage.json')}`);
  if (!complete) process.exit(1);
}

// Offline: nao usa token nem rede.
async function cmdStatus() {
  const key = fileKeyOf(opt('url'));
  if (!key) {
    console.error('status: informe --url <url|fileKey>');
    process.exit(2);
  }
  const s = await clientFor(key).status();
  console.log(s.blockedUntil ? `BLOQUEADO pelo limite do Figma por mais ~${formatWait(s.retryAfterSec)} (ate ${new Date(s.blockedUntil).toLocaleString('pt-BR')}).${s.planTier || s.limitType ? ` Plano: ${s.planTier ?? '?'}; tipo: ${s.limitType ?? '?'}.` : ''}` : 'Sem bloqueio registrado.');
  console.log(`Requisicoes a API: ${s.calls.lastHour} na ultima hora, ${s.calls.last24h} nas ultimas 24h, ${s.calls.total} no total (${s.calls.limited} com 429).`);
  console.log(`Cache: ${s.cache.nodes} no(s)${s.cache.fileDepths.length ? `, arquivo em profundidade ${s.cache.fileDepths.join(', ')}` : ''}. Pasta: ${dataDir(key, 'raw', 'cache')}`);
}

const commands = { spec: cmdSpec, coverage: cmdCoverage, map: cmdMap, find: cmdFind, node: cmdNode, layout: cmdLayout, variants: cmdVariants, image: cmdImage, assets: cmdAssets, fx: cmdFx, check: cmdCheck, prefetch: cmdPrefetch, status: cmdStatus };
if (!commands[command]) {
  console.error('Uso: node figma-map.mjs <map|find|node|layout|variants|image|assets|fx|check|prefetch|status|spec|coverage> [opcoes]  (ver cabecalho do arquivo)');
  process.exit(2);
}
try {
  await commands[command]();
  reportUsage();
} catch (e) {
  reportUsage();
  if (e instanceof RateLimitError) {
    reportRateLimit(e);
    process.exit(3);
  }
  if (e instanceof ApiError) {
    const hint = { 403: 'token invalido/sem acesso ao arquivo', 404: 'arquivo ou node nao encontrado' }[e.status] ?? '';
    console.error(`Figma API ${e.status} ${hint}: ${e.body}`);
    process.exit(1);
  }
  throw e;
}
