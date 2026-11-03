#!/usr/bin/env node
// Captura o render de uma landing estatica, secao por secao, e mede o que da para medir.
// Cada secao e um elemento com data-figma-node="<id do no no Figma>" (e, de preferencia, id="<nome>").
//
//   node qa-capture.mjs --root src/app --out reports/qa/<id>/<variante> [--variant desktop-light] [--width N] [--sections hero,sobre]
//
// Variantes: desktop (1440), tablet (834), mobile (390) x light|dark. --width sobrescreve a largura (use a do frame do Figma).
// Gera em --out: <secao>.png, measures.json, geometry.txt e summary.md. Servidor estatico proprio em porta livre.
// Dependencia (do repositorio consumidor, nao do plugin): playwright + um Chrome/Edge instalado, ou `npx playwright install chromium`.

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { join, extname, resolve, normalize, sep } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const root = resolve(opt('root', 'src/app'));
const out = resolve(opt('out', 'reports/qa/atual/desktop-light'));
const variant = opt('variant', 'desktop-light');
const only = opt('sections')?.split(',').map((s) => s.trim());
const [device, theme] = variant.split('-');
const widths = { desktop: 1440, tablet: 834, mobile: 390 };
const width = Number(opt('width', widths[device] ?? 1440));

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
      let file = join(root, p);
      if (file !== root && !file.startsWith(root + sep)) throw new Error('fora da raiz');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end('nao encontrado');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Data do arquivo mais novo de uma pasta (0 se nao existir).
async function newest(dir) {
  let max = 0;
  try {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      max = Math.max(max, e.isDirectory() ? await newest(p) : (await stat(p)).mtimeMs);
    }
  } catch {}
  return max;
}

async function launch(playwright) {
  const errors = [];
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      return await playwright.chromium.launch(channel ? { channel } : {});
    } catch (e) {
      errors.push(`${channel ?? 'chromium'}: ${String(e.message).split('\n')[0]}`);
    }
  }
  console.error(`Nenhum navegador disponivel.\n  ${errors.join('\n  ')}\nInstale o Chrome/Edge ou rode: npx playwright install chromium`);
  process.exit(1);
}

// Roda dentro da pagina: mede uma secao e devolve achados objetivos.
function measureSection(el) {
  const rect = (e) => e.getBoundingClientRect();
  const sec = rect(el);
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  const label = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${e.classList.length ? `.${[...e.classList].slice(0, 2).join('.')}` : ''}`;
  const style = (e) => {
    const s = getComputedStyle(e);
    return { fontSize: px(s.fontSize), fontWeight: s.fontWeight, fontFamily: s.fontFamily.split(',')[0].replace(/["']/g, ''), lineHeight: s.lineHeight, color: s.color, background: s.backgroundColor, radius: s.borderRadius, padding: s.padding, gap: s.gap };
  };
  const cs = getComputedStyle(el);
  const findings = [];
  const components = [];
  for (const e of el.querySelectorAll('*')) {
    const r = rect(e);
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
    const tag = e.tagName.toLowerCase();
    const box = { x: Math.round(r.left - sec.left), y: Math.round(r.top - sec.top), w: Math.round(r.width), h: Math.round(r.height) };
    if (r.right > sec.right + 1 && s.position !== 'fixed') findings.push({ type: 'overflow-horizontal', where: label(e), detail: `ultrapassa a secao em ${Math.round(r.right - sec.right)}px` });
    if (e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(s.overflowX) && e.textContent.trim()) findings.push({ type: 'texto-cortado', where: label(e), detail: `conteudo ${e.scrollWidth}px em caixa de ${e.clientWidth}px` });
    if (tag === 'img') {
      if (e.complete && e.naturalWidth === 0) findings.push({ type: 'imagem-quebrada', where: label(e), detail: e.getAttribute('src') });
      else if (e.naturalWidth && s.objectFit === 'fill' && Math.abs(r.width / r.height - e.naturalWidth / e.naturalHeight) / (e.naturalWidth / e.naturalHeight) > 0.02) findings.push({ type: 'imagem-deformada', where: label(e), detail: `render ${Math.round(r.width)}x${Math.round(r.height)}, original ${e.naturalWidth}x${e.naturalHeight}` });
      if (!e.hasAttribute('alt')) findings.push({ type: 'img-sem-alt', where: label(e), detail: e.getAttribute('src') });
    }
    const interactive = tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || e.getAttribute('role') === 'button';
    if (interactive && Math.min(r.width, r.height) < 24) findings.push({ type: 'alvo-pequeno', where: label(e), detail: `${Math.round(r.width)}x${Math.round(r.height)}px (minimo WCAG 2.2: 24px)` });
    if (interactive || tag === 'img' || tag === 'svg' || /^h[1-6]$/.test(tag) || tag === 'p') components.push({ el: label(e), text: (e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80), ...box, ...style(e) });
  }
  const geometry = [];
  const walk = (e, depth) => {
    for (const c of e.children) {
      const r = rect(c);
      if (getComputedStyle(c).display === 'none' || r.width === 0) continue;
      geometry.push(`${'  '.repeat(depth)}${label(c)}  x=${Math.round(r.left - sec.left)} y=${Math.round(r.top - sec.top)} w=${Math.round(r.width)} h=${Math.round(r.height)}`);
      if (depth < 3) walk(c, depth + 1);
    }
  };
  walk(el, 0);
  return { box: { w: Math.round(sec.width), h: Math.round(sec.height) }, section: { padding: cs.padding, background: cs.backgroundColor }, components: components.slice(0, 80), findings, geometry };
}

async function main() {
  const req = createRequire(join(process.cwd(), 'package.json'));
  let playwright;
  try {
    playwright = req('playwright');
  } catch {
    console.error('Falta o playwright no repositorio. Rode: npm i -D playwright');
    process.exit(1);
  }
  await mkdir(out, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await launch(playwright);
  const geometryAll = [];
  const result = { variant, viewport: { width }, capturedAt: new Date().toISOString(), page: {}, sections: [], skipped: [] };
  try {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}html{scrollbar-width:none}::-webkit-scrollbar{display:none}' }); // sem barra de rolagem: o Figma nao a tem e ela tira ~16px da largura
    // percorre a pagina para disparar lazy-load e observers
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 700) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);

    result.page = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, height: document.documentElement.scrollHeight, title: document.title, lang: document.documentElement.lang }));
    result.consoleErrors = consoleErrors;

    const handles = await page.$$('[data-figma-node]');
    for (const h of handles) {
      const base = await h.getAttribute('data-figma-node');
      const id = (await h.getAttribute('id')) || base.replace(':', '-');
      // no do Figma desta variante: data-figma-<variante> (ex.: data-figma-mobile-light); desktop-light usa data-figma-node
      const node = (await h.getAttribute(`data-figma-${variant}`)) ?? (variant === 'desktop-light' ? base : null);
      if (only && !only.includes(id) && !only.includes(base) && !only.includes(node)) continue;
      if (!node) {
        result.skipped.push({ id, motivo: `sem data-figma-${variant}` });
        continue;
      }
      const m = await h.evaluate(measureSection);
      await h.screenshot({ path: join(out, `${id}.png`) });
      geometryAll.push(`# ${id} (${node})`, ...m.geometry, '');
      delete m.geometry;
      result.sections.push({ id, node, ...m });
    }
    if (!handles.length) result.warning = 'nenhum elemento com data-figma-node na pagina';
  } finally {
    await browser.close();
    server.close();
  }

  const pageFindings = [];
  if ((await newest(join(root, 'scss'))) > (await newest(join(root, 'css'))) && (await newest(join(root, 'scss'))) > 0) pageFindings.push('css/ mais antigo que scss/: rode `npm run sass` e capture de novo (a captura reflete o CSS antigo)');
  if (result.page.scrollWidth > result.page.innerWidth) pageFindings.push(`rolagem horizontal na pagina (${result.page.scrollWidth}px > ${result.page.innerWidth}px)`);
  if (!result.page.lang) pageFindings.push('<html> sem lang');
  result.consoleErrors.forEach((e) => pageFindings.push(`erro no console: ${e.slice(0, 160)}`));

  await writeFile(join(out, 'measures.json'), JSON.stringify(result, null, 2));
  await writeFile(join(out, 'geometry.txt'), geometryAll.join('\n'));
  const lines = [`# Captura ${variant} (${width}px)`, '', `Pagina: ${result.page.height}px de altura. ${result.sections.length} secao(oes).`, ''];
  if (result.warning) lines.push(`AVISO: ${result.warning}`, '');
  if (pageFindings.length) lines.push('## Achados da pagina', ...pageFindings.map((f) => `- ${f}`), '');
  lines.push('## Secoes', '', '| secao | no Figma | altura renderizada | achados |', '|---|---|---|---|');
  for (const s of result.sections) lines.push(`| ${s.id} | ${s.node} | ${s.box.h}px | ${s.findings.length} |`);
  if (result.skipped.length) lines.push('', '## Sem no do Figma nesta variante', ...result.skipped.map((s) => `- ${s.id}: ${s.motivo}`));
  for (const s of result.sections.filter((x) => x.findings.length)) lines.push('', `### ${s.id}`, ...s.findings.map((f) => `- **${f.type}** \`${f.where}\`: ${f.detail}`));
  await writeFile(join(out, 'summary.md'), lines.join('\n'));
  console.log(`${result.sections.length} secao(oes) capturada(s) em ${out}`);
  console.log(`achados: ${pageFindings.length} da pagina, ${result.sections.reduce((n, s) => n + s.findings.length, 0)} nas secoes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
