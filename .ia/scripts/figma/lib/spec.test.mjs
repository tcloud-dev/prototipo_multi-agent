import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanNode, deepenTargets } from './coverage.mjs';
import { buildSpec } from './spec.mjs';

const bb = (x, y, w, h) => ({ x, y, width: w, height: h });

// Secao de teste (raiz em 100,200): um card com foto STRETCH absoluta, texto, botao oculto (com filho oculto truncado),
// um icone truncado e dois vetores soltos.
const section = {
  id: '1:1',
  name: 'section-hero',
  type: 'FRAME',
  absoluteBoundingBox: bb(100, 200, 1920, 700),
  clipsContent: true,
  layoutMode: 'VERTICAL',
  itemSpacing: 32,
  paddingTop: 32,
  paddingRight: 80,
  paddingBottom: 0,
  paddingLeft: 80,
  children: [
    {
      id: '1:2',
      name: 'card',
      type: 'FRAME',
      absoluteBoundingBox: bb(180, 232, 1760, 600),
      clipsContent: false,
      cornerRadius: 32,
      children: [
        { id: '1:3', name: 'foto', type: 'FRAME', layoutPositioning: 'ABSOLUTE', absoluteBoundingBox: bb(1309, 334, 917, 518), cornerRadius: 32, fills: [{ type: 'IMAGE', scaleMode: 'STRETCH', imageTransform: [[1, 0, 0.0002], [0, 0.46971, 0]], imageRef: 'abc' }], children: [] },
        { id: '1:4', name: 'titulo', type: 'TEXT', characters: 'Conheça a TOTVS Cloud', absoluteBoundingBox: bb(200, 300, 800, 112), style: { fontFamily: 'TOTVS', fontWeight: 600, fontSize: 48, lineHeightPx: 56, textAlignHorizontal: 'LEFT' }, fills: [{ type: 'SOLID', color: { r: 0.0078, g: 0.0431, b: 0.0706, a: 1 } }] },
        { id: '1:5', name: 'button', type: 'INSTANCE', visible: false, absoluteBoundingBox: bb(200, 700, 200, 56), children: [{ id: 'I1:5;9', name: 'bloquear', type: 'INSTANCE', visible: false, absoluteBoundingBox: bb(210, 710, 24, 24), children: [] }] },
        { id: '1:6', name: 'icone', type: 'INSTANCE', absoluteBoundingBox: bb(300, 700, 24, 24), children: [] },
        { id: '1:7', name: 'v1', type: 'VECTOR', absoluteBoundingBox: bb(300, 700, 4, 4) },
        { id: '1:8', name: 'v2', type: 'VECTOR', absoluteBoundingBox: bb(310, 700, 4, 4) },
      ],
    },
  ],
};

test('scanNode: children vazio no limite e truncamento; antes do limite e vazio de verdade', () => {
  // Profundidade 2: raiz=0, card=1, filhos do card=2 (limite), filhos deles=3.
  const scan = scanNode(section, 2);
  assert.deepEqual(scan.truncated.map((t) => t.id).sort(), ['1:3', '1:6', 'I1:5;9']);
  // Profundidade 3: so o neto (nivel 3) esta no limite; os de nivel 2 sao vazios de verdade.
  const deeper = scanNode(section, 3);
  assert.deepEqual(deeper.truncated.map((t) => t.id), ['I1:5;9']);
  assert.deepEqual(deeper.empty.map((t) => t.id).sort(), ['1:3', '1:6']);
});

test('scanNode: oculto filho de oculto conta uma vez e fica fora da lista a aprofundar', () => {
  const scan = scanNode(section, 3);
  assert.deepEqual(scan.hidden.map((h) => h.id), ['1:5']);
  assert.equal(scan.truncated[0].hidden, true);
  assert.deepEqual(deepenTargets(scan), []);
  assert.deepEqual(deepenTargets(scanNode(section, 2)), ['1:3', '1:6']);
});

test('buildSpec: coordenadas relativas a secao, texto com tipografia, imagem STRETCH, absoluto e oculto', () => {
  const { markdown, gaps } = buildSpec(section, { depth: 2, key: 'K', generatedAt: '2026-11-05' });
  assert.match(markdown, /# section-hero \[1:1\]/);
  assert.match(markdown, /card \[1:2\] frame · 80,32 1760×600/, 'relativo a raiz: 180-100, 232-200');
  assert.match(markdown, /foto \[1:3\] frame · 1209,134 917×518 · ABSOLUTE .*img STRETCH/);
  assert.match(markdown, /\| 1:4 \| Conheça a TOTVS Cloud \| TOTVS \| 600 \| 48 \| 56 \| 0 \| #020B12 \| L \|/);
  assert.match(markdown, /\| 1:3 \| foto \| 917×518 \| STRETCH \| \[\[1,0,0\.0002\],\[0,0\.4697,0\]\] \| 32 \| não \| sim \|/);
  assert.match(markdown, /\| 1:5 \| button \| INSTANCE \| 100,500 200×56 \|\s+\| sim \|/);
  assert.doesNotMatch(markdown, /\| I1:5;9 \|/, 'oculto dentro de oculto nao entra na tabela');
  assert.match(markdown, /radius 32: 2 nó\(s\)/);
  assert.match(markdown, /\(\+2 vetores\)/, 'vetores soltos viram contagem no pai');
  assert.match(markdown, /2 contêiner\(es\) visíveis truncados\*\* na profundidade 2/);
  assert.equal(gaps.truncated.length, 3);
});

test('buildSpec sem profundidade informada nao inventa lacunas', () => {
  const { markdown } = buildSpec(section);
  assert.match(markdown, /Nenhuma: nada truncado nem oculto/);
});
