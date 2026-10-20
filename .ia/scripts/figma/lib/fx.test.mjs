// Rodar: node --test .ia/scripts/figma/lib/fx.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectFx, extractFx } from './fx.mjs';

test('no sem nada notavel devolve objeto vazio', () => {
  assert.deepEqual(extractFx({ id: '1:1', name: 'x', type: 'FRAME', opacity: 1, blendMode: 'PASS_THROUGH' }), {});
});

test('rotacao vem em radianos, graus e CSS com o mesmo sinal (caso comprovado do OrangeBank)', () => {
  const fx = extractFx({ rotation: -0.6323 });
  assert.equal(fx.rotation.deg, -36.23);
  assert.equal(fx.rotation.css, 'rotate(-36.23deg)');
});

test('blend, opacidade, blur e filtro de saturacao do fill (caso do glow e do fundo do hero)', () => {
  const glow = extractFx({ blendMode: 'LINEAR_DODGE', opacity: 0.69, effects: [{ type: 'LAYER_BLUR', radius: 200 }], fills: [{ type: 'SOLID', color: { r: 0.9137, g: 0.3686, b: 0.1765 } }] });
  assert.equal(glow.blendMode, 'LINEAR_DODGE');
  assert.equal(glow.opacity, 0.69);
  assert.deepEqual(glow.effects, [{ type: 'LAYER_BLUR', radius: 200 }]);
  const img = extractFx({ fills: [{ type: 'IMAGE', filters: { saturation: -0.06 } }] });
  assert.deepEqual(img.fills, [{ type: 'IMAGE', filters: { saturation: -0.06 } }]);
});

test('efeito invisivel e fill sem nada notavel sao ignorados', () => {
  const fx = extractFx({ effects: [{ type: 'DROP_SHADOW', visible: false }], fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }] });
  assert.deepEqual(fx, {});
});

test('trechos de texto com estilo proprio (titulo com destaque e item com negrito)', () => {
  const fx = extractFx({
    characters: 'Cartao sem anuidade',
    characterStyleOverrides: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7],
    styleOverrideTable: { 7: { fontWeight: 600, fontSize: 20, fills: [{ type: 'SOLID', color: { r: 0.9137, g: 0.3686, b: 0.1765 } }] } },
  });
  assert.deepEqual(fx.textRuns, [{ text: 'anuidade', start: 11, end: 19, color: '#E95E2D', fontWeight: 600, fontSize: 20 }]);
});

test('collectFx lista so os nos notaveis e respeita a profundidade', () => {
  const tree = { id: '1:1', name: 'raiz', type: 'FRAME', children: [{ id: '1:2', name: 'filho', type: 'FRAME', rotation: 0.5, children: [{ id: '1:3', name: 'neto', type: 'VECTOR', opacity: 0.2 }] }] };
  assert.deepEqual(collectFx(tree, 4).map((n) => n.id), ['1:2', '1:3']);
  assert.deepEqual(collectFx(tree, 1).map((n) => n.id), ['1:2']);
  assert.equal(collectFx(tree, 4)[1].path, 'raiz/filho/neto');
});
