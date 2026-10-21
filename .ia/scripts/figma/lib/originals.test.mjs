// Rodar: node --test .ia/scripts/figma/lib/originals.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extOf, findImageFills, resolveOriginal } from './originals.mjs';

const photo = { id: '1:2', name: 'Foto', type: 'RECTANGLE', fills: [{ type: 'IMAGE', imageRef: 'abc' }] };
const button = { id: '1:3', name: 'Botao', type: 'FRAME', fills: [{ type: 'SOLID' }] };

test('findImageFills acha o fill IMAGE nos filhos e ignora os invisiveis', () => {
  const root = { id: '1:1', name: 'Card', children: [photo, button, { id: '1:4', name: 'Oculta', fills: [{ type: 'IMAGE', imageRef: 'x', visible: false }] }] };
  assert.deepEqual(findImageFills(root).map((f) => f.imageRef), ['abc']);
});

test('resolveOriginal devolve a unica imagem da subarvore (a foto, nao o botao por cima)', () => {
  const card = { id: '1:1', name: 'Depoimento', children: [photo, button] };
  assert.deepEqual(resolveOriginal(card), { imageRef: 'abc', source: '1:2' });
});

test('resolveOriginal falha sem imagem e lista candidatos quando ha varias', () => {
  assert.match(resolveOriginal(button).error, /sem fill IMAGE/);
  const two = { id: '1:1', name: 'Dois', children: [photo, { ...photo, id: '1:9', name: 'Outra', fills: [{ type: 'IMAGE', imageRef: 'def' }] }] };
  const r = resolveOriginal(two);
  assert.match(r.error, /2 imagens/);
  assert.match(r.error, /1:2/);
  assert.match(r.error, /1:9/);
});

test('mesma imagem usada em dois nos conta como uma so', () => {
  const dup = { id: '1:1', name: 'Dup', children: [photo, { ...photo, id: '1:7' }] };
  assert.equal(resolveOriginal(dup).imageRef, 'abc');
});

test('extOf reconhece png, jpg, webp e gif pelos bytes', () => {
  assert.equal(extOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'png');
  assert.equal(extOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'jpg');
  assert.equal(extOf(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'webp');
  assert.equal(extOf(Buffer.from('GIF89a')), 'gif');
  assert.equal(extOf(Buffer.from('<svg')), null);
});
