#!/usr/bin/env node
// Build de producao de uma landing page estatica: src/app/ -> dist/app/.
// Copiado para o repositorio consumidor (scripts/build.mjs) pela skill `setup` e usado igual no GitHub Actions.
//
//   node scripts/build.mjs [--src src/app] [--out dist/app] [--no-media] [--max-width 2560] [--quality 80]
//
// HTML  -> html-minifier-terser   CSS/JS -> esbuild (transform por arquivo, sem bundle: os caminhos continuam iguais)
// Imagens (jpg/png/webp/avif) -> sharp (mesmo formato e nome, so recomprime e limita a largura)
// SVG -> svgo   Videos (mp4/webm) -> ffmpeg-static   Demais arquivos (fontes, json, ico...) -> copia
// No fim confere que toda referencia local (href/src/poster/srcset) do HTML e do CSS existe em dist/.
// Dependencias (devDependencies do consumidor): esbuild html-minifier-terser sharp svgo ffmpeg-static
// Saida 0 = ok; 1 = falha (arquivo que nao processou ou referencia quebrada).

import { readdir, readFile, writeFile, mkdir, rm, copyFile, stat } from 'node:fs/promises';
import { join, extname, relative, dirname, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const SRC = resolve(opt('src', 'src/app'));
const OUT = resolve(opt('out', 'dist/app'));
const MAX_WIDTH = Number(opt('max-width', 2560));
const QUALITY = Number(opt('quality', 80));
const SKIP_MEDIA = flag('no-media');

const IMG = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const VIDEO = new Set(['.mp4', '.webm']);

async function need(name) {
  try {
    const mod = await import(name);
    return mod.default ?? mod;
  } catch {
    console.error(`Falta a dependencia "${name}". Rode: npm i -D esbuild html-minifier-terser sharp svgo ffmpeg-static`);
    process.exit(1);
  }
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

function run(cmd, cmdArgs) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, cmdArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(err.split('\n').slice(-6).join('\n')))));
  });
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const stats = {}; // tipo -> { n, before, after }
const failures = [];

function add(type, before, after) {
  const s = (stats[type] ??= { n: 0, before: 0, after: 0 });
  s.n++;
  s.before += before;
  s.after += after;
}

async function main() {
  if (!existsSync(SRC)) {
    console.error(`Pasta de origem nao existe: ${SRC}`);
    process.exit(1);
  }
  if (OUT === SRC || SRC.startsWith(OUT + sep) || OUT.startsWith(SRC + sep)) {
    console.error('src e out nao podem ser iguais nem ficar uma dentro da outra.');
    process.exit(1);
  }

  const esbuild = await need('esbuild');
  const { minify: minifyHtml } = await need('html-minifier-terser');
  const sharp = SKIP_MEDIA ? null : await need('sharp');
  const { optimize: svgo } = SKIP_MEDIA ? {} : await need('svgo');
  const ffmpeg = SKIP_MEDIA ? null : (await import('ffmpeg-static').then((m) => m.default).catch(() => null));

  await rm(OUT, { recursive: true, force: true });
  const files = await walk(SRC);

  await pool(files, 4, async (file) => {
    const rel = relative(SRC, file);
    const dest = join(OUT, rel);
    const ext = extname(file).toLowerCase();
    await mkdir(dirname(dest), { recursive: true });
    const before = (await stat(file)).size;
    try {
      if (ext === '.html') {
        const out = await minifyHtml(await readFile(file, 'utf8'), {
          collapseWhitespace: true,
          conservativeCollapse: false,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          minifyCSS: true,
          minifyJS: true,
          useShortDoctype: true,
        });
        await writeFile(dest, out);
      } else if (ext === '.css') {
        const { code } = await esbuild.transform(await readFile(file, 'utf8'), { loader: 'css', minify: true });
        await writeFile(dest, code);
      } else if (ext === '.js' || ext === '.mjs') {
        const { code } = await esbuild.transform(await readFile(file, 'utf8'), { loader: 'js', minify: true, target: 'es2020' });
        await writeFile(dest, code);
      } else if (!SKIP_MEDIA && IMG.has(ext)) {
        const img = sharp(file, { animated: true }).rotate();
        const meta = await sharp(file).metadata();
        const pipe = meta.width > MAX_WIDTH ? img.resize({ width: MAX_WIDTH }) : img;
        const buf = await (ext === '.png' ? pipe.png({ compressionLevel: 9, palette: false }) : ext === '.webp' ? pipe.webp({ quality: QUALITY }) : ext === '.avif' ? pipe.avif({ quality: QUALITY - 20 }) : pipe.jpeg({ quality: QUALITY, mozjpeg: true })).toBuffer();
        await writeFile(dest, buf.length < before ? buf : await readFile(file)); // nunca pior que o original
      } else if (!SKIP_MEDIA && ext === '.svg') {
        const { data } = svgo(await readFile(file, 'utf8'), { multipass: true, plugins: ['preset-default'] });
        await writeFile(dest, data);
      } else if (!SKIP_MEDIA && VIDEO.has(ext)) {
        if (!ffmpeg) throw new Error('ffmpeg-static nao instalado (npm i -D ffmpeg-static)');
        const tmp = `${dest}.tmp${ext}`;
        const codec = ext === '.mp4' ? ['-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-pix_fmt', 'yuv420p'] : ['-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-c:a', 'libopus', '-b:a', '96k'];
        await run(ffmpeg, ['-y', '-i', file, '-vf', 'scale=-2:min(ih\\,1080)', ...codec, tmp]);
        const small = (await stat(tmp)).size < before;
        if (small) await copyFile(tmp, dest);
        else await copyFile(file, dest);
        await rm(tmp, { force: true });
      } else {
        await copyFile(file, dest);
      }
    } catch (e) {
      failures.push(`${rel}: ${String(e.message).split('\n')[0]}`);
      return;
    }
    add(ext.slice(1) || 'outros', before, (await stat(dest)).size);
  });

  const broken = await checkReferences(OUT);

  console.log(`\nBuild ${relative(process.cwd(), SRC)} -> ${relative(process.cwd(), OUT)}\n`);
  let tb = 0;
  let ta = 0;
  for (const [type, s] of Object.entries(stats).sort()) {
    tb += s.before;
    ta += s.after;
    const pct = s.before ? Math.round((1 - s.after / s.before) * 100) : 0;
    console.log(`${type.padEnd(7)} ${String(s.n).padStart(3)} arq  ${kb(s.before).padStart(11)} -> ${kb(s.after).padStart(11)}  (-${pct}%)`);
  }
  console.log(`${'total'.padEnd(7)} ${' '.repeat(7)}${kb(tb).padStart(11)} -> ${kb(ta).padStart(11)}  (-${tb ? Math.round((1 - ta / tb) * 100) : 0}%)`);

  if (failures.length) console.log(`\nFALHAS (${failures.length}):\n${failures.map((f) => `  ${f}`).join('\n')}`);
  if (broken.length) console.log(`\nREFERENCIAS QUEBRADAS (${broken.length}):\n${broken.map((f) => `  ${f}`).join('\n')}`);
  if (failures.length || broken.length) process.exit(1);
  console.log('\nOK');
}

// href/src/poster/srcset em HTML e url() em CSS que apontam para arquivo local e nao existem em dist/.
async function checkReferences(dir) {
  const broken = [];
  const refs = (text, re) => [...text.matchAll(re)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0]));
  for (const file of await walk(dir)) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.html' && ext !== '.css') continue;
    const text = await readFile(file, 'utf8');
    const found = ext === '.html' ? [...refs(text, /\b(?:href|src|poster|srcset)=["']?([^"'>\s][^"'>]*)["']?/gi)] : [...refs(text, /url\(\s*["']?([^"')]+)["']?\s*\)/gi)];
    for (const ref of found) {
      if (!ref || /^(https?:|\/\/|data:|mailto:|tel:|#|javascript:)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!clean) continue;
      const target = clean.startsWith('/') ? join(dir, clean) : resolve(dirname(file), clean);
      if (!existsSync(target)) broken.push(`${relative(dir, file)} -> ${ref}`);
    }
  }
  return broken;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
