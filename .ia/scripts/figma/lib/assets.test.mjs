// Rodar: node --test .ia/scripts/figma/lib/assets.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equivalents, parseManifest, planCalls, splitPending } from './assets.mjs';

const ok = (over = {}) => ({ id: 'logo-branco', node: '551:430', category: 'logos', ...over });

test('asset valido recebe formato svg, escala 1 e caminho categoria/id.ext', () => {
  const { assets, errors } = parseManifest({ assets: [ok()] });
  assert.deepEqual(errors, []);
  assert.deepEqual(assets[0], { id: 'logo-branco', node: '551:430', category: 'logos', format: 'svg', scale: 1, mode: 'render', file: 'logos/logo-branco.svg' });
});

test('png sem escala usa 2x', () => {
  assert.equal(parseManifest({ assets: [ok({ format: 'png' })] }).assets[0].scale, 2);
});

test('aceita node de instancia (I551:430;970:661)', () => {
  assert.deepEqual(parseManifest({ assets: [ok({ node: 'I551:430;970:661' })] }).errors, []);
});

test('manifesto sem lista reprova', () => {
  assert.match(parseManifest({}).errors[0], /sem a lista/);
});

test('id, node, categoria, formato e escala invalidos sao apontados', () => {
  const { errors } = parseManifest({ assets: [{ id: 'Logo Branco', node: 'abc', category: 'Logos', format: 'gif', scale: 9 }] });
  assert.equal(errors.length, 5);
});

test('arquivo duplicado reprova', () => {
  const { errors } = parseManifest({ assets: [ok(), ok({ node: '1:2' })] });
  assert.match(errors[0], /duplicado logos\/logo-branco\.svg/);
});

test('mesmo id em categorias ou formatos diferentes nao e duplicado', () => {
  assert.deepEqual(parseManifest({ assets: [ok(), ok({ category: 'icons' }), ok({ format: 'png' })] }).errors, []);
});

test('pedidos agrupam por formato e escala', () => {
  const { assets } = parseManifest({ assets: [ok({ id: 'a' }), ok({ id: 'b', node: '1:2' }), ok({ id: 'c', node: '1:3', format: 'png' }), ok({ id: 'd', node: '1:4', format: 'png', scale: 1 })] });
  const calls = planCalls(assets);
  assert.deepEqual(calls.map((c) => [c.format, c.scale, c.assets.length]), [['svg', 1, 2], ['png', 2, 1], ['png', 1, 1]]);
});

test('lotes de no maximo 40 ids por chamada', () => {
  const many = Array.from({ length: 85 }, (_, i) => ok({ id: `i${i}`, node: `1:${i + 1}` }));
  assert.deepEqual(planCalls(parseManifest({ assets: many }).assets).map((c) => c.assets.length), [40, 40, 5]);
});

test('splitPending pula o que ja existe, a menos que force', () => {
  const { assets } = parseManifest({ assets: [ok({ id: 'a' }), ok({ id: 'b', node: '1:2' })] });
  const exists = (f) => f === 'logos/a.svg';
  assert.deepEqual(splitPending(assets, exists).pending.map((a) => a.id), ['b']);
  assert.deepEqual(splitPending(assets, exists).skipped.map((a) => a.id), ['a']);
  assert.equal(splitPending(assets, exists, true).pending.length, 2);
});

test('versao otimizada (jpg -> webp) conta como ja existente; svg nao tem equivalente', () => {
  assert.deepEqual(equivalents('logos/a.svg'), ['logos/a.svg']);
  assert.ok(equivalents('images/foto.jpg').includes('images/foto.webp'));
  const { assets } = parseManifest({ assets: [ok({ id: 'foto', category: 'images', format: 'jpg', node: '1:2' }), ok({ id: 'logo', node: '1:3' })] });
  const exists = (f) => f === 'images/foto.webp';
  assert.deepEqual(splitPending(assets, exists).skipped.map((a) => a.id), ['foto']);
  assert.deepEqual(splitPending(assets, exists).pending.map((a) => a.id), ['logo']);
});

test('mode original: formato padrao jpg, e nao entra nos pedidos de render', () => {
  const { assets, errors } = parseManifest({ assets: [ok({ id: 'foto', category: 'imagens', mode: 'original' }), ok()] });
  assert.deepEqual(errors, []);
  assert.equal(assets[0].mode, 'original');
  assert.equal(assets[0].format, 'jpg');
  assert.deepEqual(planCalls(assets).flatMap((c) => c.assets.map((a) => a.id)), ['logo-branco']);
});

test('mode original com svg e mode desconhecido reprovam', () => {
  const svg = parseManifest({ assets: [ok({ mode: 'original', format: 'svg' })] });
  assert.match(svg.errors[0], /vetor usa mode "render"/);
  const bad = parseManifest({ assets: [ok({ mode: 'print' })] });
  assert.match(bad.errors[0], /mode "print"/);
});
