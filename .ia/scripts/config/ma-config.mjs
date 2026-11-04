#!/usr/bin/env node
// Le a configuracao do plugin no repositorio consumidor e imprime JSON.
//
//   node ma-config.mjs [--dir <pasta>] [--get <campo>]
//
// Ordem: chave "multiAgent" do package.json  ->  multi-agent.config.json  ->  padroes.
// Campos: stack ("vanilla" | "angular"), src, out. O comando de build NAO e configuravel:
// o contrato e o script `build` do package.json (e `sass`, se existir).
// Sem stack configurada, tenta detectar (angular.json / @angular/core -> angular; src/index.html -> vanilla).
// Saida 0 = ok; 1 = configuracao invalida (os erros vao no campo "errors").

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STACKS = ['vanilla', 'angular'];
export const DEFAULTS = { src: 'src/app', out: 'dist/app' };

function readJson(file) {
  if (!existsSync(file)) return { found: false };
  try {
    return { found: true, data: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (e) {
    return { found: true, error: `${file}: JSON invalido (${e.message})` };
  }
}

const isRelativeInside = (p) => {
  if (typeof p !== 'string' || !p.trim() || isAbsolute(p)) return false;
  const n = normalize(p).replaceAll('\\', '/');
  return n !== '..' && !n.startsWith('../') && n !== '.';
};

function detectStack(dir, pkg, src) {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  if (existsSync(join(dir, 'angular.json')) || deps['@angular/core']) {
    const m = /(\d+)/.exec(deps['@angular/core'] ?? '');
    return { stack: 'angular', angularVersion: m ? Number(m[1]) : null };
  }
  if (existsSync(join(dir, src, 'index.html'))) return { stack: 'vanilla' };
  return null;
}

export function readConfig(dirArg = '.') {
  const dir = resolve(dirArg);
  const errors = [];
  const pkgRead = readJson(join(dir, 'package.json'));
  if (pkgRead.error) errors.push(pkgRead.error);
  const pkg = pkgRead.data;
  const fileRead = readJson(join(dir, 'multi-agent.config.json'));
  if (fileRead.error) errors.push(fileRead.error);

  let source = 'defaults';
  let raw = {};
  if (pkg && typeof pkg.multiAgent === 'object' && pkg.multiAgent !== null) {
    source = 'package.json';
    raw = pkg.multiAgent;
  } else if (fileRead.data && typeof fileRead.data === 'object') {
    source = 'multi-agent.config.json';
    raw = fileRead.data;
  }

  const src = raw.src ?? DEFAULTS.src;
  const out = raw.out ?? DEFAULTS.out;
  for (const [k, v] of [['src', src], ['out', out]]) {
    if (!isRelativeInside(v)) errors.push(`"${k}" precisa ser um caminho relativo dentro do repositorio (recebido: ${JSON.stringify(v)})`);
  }
  if (isRelativeInside(src) && isRelativeInside(out) && normalize(src) === normalize(out)) {
    errors.push('"src" e "out" nao podem ser a mesma pasta');
  }
  if (raw.stack !== undefined && !STACKS.includes(raw.stack)) {
    errors.push(`"stack" deve ser um de: ${STACKS.join(', ')} (recebido: ${JSON.stringify(raw.stack)})`);
  }

  let stack = STACKS.includes(raw.stack) ? raw.stack : null;
  let stackSource = stack ? 'config' : 'indefinida';
  let angularVersion = null;
  if (!stack) {
    const found = detectStack(dir, pkg, isRelativeInside(src) ? src : DEFAULTS.src);
    if (found) {
      stack = found.stack;
      angularVersion = found.angularVersion ?? null;
      stackSource = 'detectada';
    }
  } else if (stack === 'angular') {
    const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
    const m = /(\d+)/.exec(deps['@angular/core'] ?? '');
    angularVersion = m ? Number(m[1]) : null;
  }

  const scripts = pkg?.scripts ?? {};
  return {
    source,
    stack,
    stackSource,
    angularVersion,
    src,
    out,
    scripts: { build: typeof scripts.build === 'string', sass: typeof scripts.sass === 'string' },
    errors,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const cfg = readConfig(opt('dir') ?? '.');
  const get = opt('get');
  if (get) console.log(cfg[get] === undefined ? '' : typeof cfg[get] === 'object' ? JSON.stringify(cfg[get]) : cfg[get] ?? '');
  else console.log(JSON.stringify(cfg, null, 2));
  if (cfg.errors.length) {
    for (const e of cfg.errors) console.error(`ERRO: ${e}`);
    process.exit(1);
  }
}
