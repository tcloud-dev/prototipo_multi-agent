// Rodar: node --test .ia/scripts/figma/lib/contrast.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, parseHex, ratio } from './contrast.mjs';

test('preto sobre branco e 21:1', () => {
  assert.equal(Math.round(ratio('#000', '#fff')), 21);
});

test('hex de 3 digitos e com ou sem cerquilha', () => {
  assert.deepEqual(parseHex('fff'), [255, 255, 255]);
  assert.deepEqual(parseHex('#1d232a'), [29, 35, 42]);
  assert.equal(parseHex('azul'), null);
});

test('ordem das cores nao muda a razao', () => {
  assert.equal(ratio('#ff823d', '#ffffff'), ratio('#ffffff', '#ff823d'));
});

test('caso real do OrangeBank: branco sobre #ff823d reprova (2,47:1)', () => {
  assert.deepEqual(evaluate('#ffffff', '#ff823d'), { ok: false, ratio: 2.47, min: 4.5 });
});

test('caso real do OrangeBank: #1d232a sobre #ff823d passa (6,42:1)', () => {
  assert.deepEqual(evaluate('#1d232a', '#ff823d'), { ok: true, ratio: 6.42, min: 4.5 });
});

test('texto grande e componente de UI exigem 3:1', () => {
  assert.equal(evaluate('#ffffff', '#ff823d', 'large').ok, false);
  assert.equal(evaluate('#767676', '#ffffff', 'text').ok, true);
  assert.equal(evaluate('#949494', '#ffffff', 'ui').ok, true);
  assert.equal(evaluate('#949494', '#ffffff', 'text').ok, false);
});

test('cor invalida e tipo desconhecido devolvem erro', () => {
  assert.match(evaluate('x', '#fff').error, /cor invalida/);
  assert.match(evaluate('#000', '#fff', 'foo').error, /desconhecido/);
});
