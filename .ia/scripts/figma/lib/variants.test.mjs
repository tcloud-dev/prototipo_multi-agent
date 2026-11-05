import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVariants, pageLikeFrames, variantOf } from './variants.mjs';

const bb = (w, h) => ({ x: 0, y: 0, width: w, height: h });
const frame = (id, name, w, h, children = [], type = 'FRAME') => ({ id, name, type, absoluteBoundingBox: bb(w, h), children });

// Pagina com uma SECTION que guarda o frame da pagina do site e uma lista de cards de 350x622 (o caso que enganava o inferidor).
const page = {
  name: 'Landing page',
  type: 'CANVAS',
  children: [
    frame('2:1', 'Pagina inicial', 2178, 5890, [frame('3:1', 'T-Cloud LP', 1920, 1080, [frame('4:1', 'header', 1920, 104), frame('4:2', 'hero', 1920, 732)]), frame('3:2', 'list', 1760, 300, [frame('5:1', 'item-1', 350, 622), frame('5:2', 'item-2', 350, 622)])], 'SECTION'),
  ],
};

test('pageLikeFrames estrito: acha frames de pagina dentro de SECTION e nao desce em FRAME (os cards 350x622 ficam de fora)', () => {
  // `list` (1760x300) e baixo demais para ser pagina; os cards de 350x622 dentro dele nao podem virar variante.
  assert.deepEqual(pageLikeFrames(page, [], true).map((f) => f.id), ['3:1']);
  // O modo antigo (usado so no map, informativo) ainda os enxerga.
  assert.deepEqual(pageLikeFrames(page, [], false).map((f) => f.id), ['3:1', '5:1', '5:2']);
});

test('variantOf: dispositivo e tema pelo nome, senao pela largura', () => {
  assert.equal(variantOf(frame('a', 'Home mobile dark', 390, 800)), 'mobile-dark');
  assert.equal(variantOf(frame('a', 'T-Cloud LP', 1920, 1080)), 'desktop-light');
  assert.equal(variantOf(frame('a', 'Tela', 390, 800)), 'mobile-light');
});

test('buildVariants: duas telas com o mesmo nome viram alternatives, nunca uma chave com "+"', () => {
  const a = frame('1:1', 'Desktop light', 1440, 900, [frame('1:2', 'hero', 1440, 600)]);
  const b = frame('2:1', 'Outra', 1920, 1080, [frame('2:2', 'hero', 1920, 600)]);
  const v = buildVariants([
    { page: 'P', frame: b, full: b },
    { page: 'P', frame: a, full: a },
  ]);
  assert.deepEqual(Object.keys(v), ['desktop-light']);
  assert.equal(v['desktop-light'].frameId, '1:1', 'o de nome explicito vence');
  assert.equal(v['desktop-light'].inferred, false);
  assert.deepEqual(v['desktop-light'].alternatives.map((x) => x.frameId), ['2:1']);
  assert.ok(!Object.keys(v).some((k) => k.includes('+')));
});
