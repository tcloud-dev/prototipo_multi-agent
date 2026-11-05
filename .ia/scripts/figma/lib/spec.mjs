// Especificacao de uma secao para quem programa: texto, tipografia, imagens, corte (clip), nos ocultos e absolutos,
// efeitos e lacunas, TUDO lido do JSON ja baixado (sem rede). Substitui as tabelas que o agente montava a mao.
// Coordenadas relativas ao no pedido (a secao), nunca a raiz da pagina: e o referencial de quem implementa.
import { scanNode } from './coverage.mjs';

const hex = (c) => {
  if (!c) return null;
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
};
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const solid = (node) => (node.fills ?? []).find((f) => f.type === 'SOLID' && f.visible !== false);
const imageFill = (node) => (node.fills ?? []).find((f) => f.type === 'IMAGE' && f.visible !== false);
const isAbsolute = (n) => n.layoutPositioning === 'ABSOLUTE';
const LEAF_VECTORS = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'POLYGON']);

function box(node, origin) {
  const b = node.absoluteBoundingBox;
  return b ? { x: Math.round(b.x - origin.x), y: Math.round(b.y - origin.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
}

// Efeito/opacidade/raio de um no, em forma comparavel (para agrupar valores iguais).
function effectsOf(node) {
  const out = [];
  if (node.opacity !== undefined && node.opacity !== 1) out.push(`opacity ${round(node.opacity)}`);
  if (node.cornerRadius) out.push(`radius ${node.cornerRadius}`);
  if (node.rotation) out.push(`rotate ${round((node.rotation * 180) / Math.PI)}deg`);
  if (node.blendMode && !['PASS_THROUGH', 'NORMAL'].includes(node.blendMode)) out.push(`blend ${node.blendMode}`);
  for (const e of node.effects ?? []) {
    if (e.visible === false) continue;
    const bits = [e.type, e.radius !== undefined ? `r${e.radius}` : null, e.offset ? `off ${e.offset.x},${e.offset.y}` : null, e.color ? `${hex(e.color)} a${round(e.color.a ?? 1)}` : null];
    out.push(bits.filter(Boolean).join(' '));
  }
  return out;
}

function treeLine(node, level, origin) {
  const b = box(node, origin);
  const bits = [node.type.toLowerCase()];
  if (b) bits.push(`${b.x},${b.y} ${b.w}×${b.h}`);
  if (node.visible === false) bits.push('OCULTO');
  if (isAbsolute(node)) bits.push('ABSOLUTE');
  if (node.clipsContent) bits.push('clip');
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    bits.push(node.layoutMode === 'HORIZONTAL' ? 'row' : node.layoutMode === 'VERTICAL' ? 'col' : node.layoutMode.toLowerCase());
    if (node.itemSpacing) bits.push(`gap ${node.itemSpacing}`);
    if (node.counterAxisAlignItems && node.counterAxisAlignItems !== 'MIN') bits.push(`cross ${node.counterAxisAlignItems.toLowerCase()}`);
    if (node.primaryAxisAlignItems && node.primaryAxisAlignItems !== 'MIN') bits.push(`main ${node.primaryAxisAlignItems.toLowerCase()}`);
  }
  const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((v) => v ?? 0);
  if (pad.some(Boolean)) bits.push(`pad ${pad.join('/')}`);
  if (node.layoutGrow) bits.push(`grow ${node.layoutGrow}`);
  if (node.layoutAlign === 'STRETCH') bits.push('stretch');
  const img = imageFill(node);
  if (img) bits.push(`img ${img.scaleMode ?? ''}`.trim());
  if (node.type === 'TEXT') bits.push(`"${clip(cell(node.characters), 40)}"`);
  return `${'  '.repeat(level)}${clip(node.name, 28)} [${node.id}] ${bits.join(' · ')}`;
}

export function buildSpec(root, { depth, key = '', generatedAt = null } = {}) {
  const origin = root.absoluteBoundingBox ?? { x: 0, y: 0 };
  const scan = depth === undefined ? { total: 0, truncated: [], empty: [], hidden: [] } : scanNode(root, depth);
  const tree = [];
  const texts = [];
  const images = [];
  const absolute = [];
  const effects = new Map();
  const fonts = new Map();

  const visit = (node, level, parentHidden = false) => {
    // Vetores soltos viram contagem no pai; so entram na arvore se tiverem imagem, efeito ou forem absolutos/ocultos.
    const interesting = !LEAF_VECTORS.has(node.type) || isAbsolute(node) || node.visible === false || effectsOf(node).length || imageFill(node);
    if (level > 0 && node.absoluteBoundingBox !== undefined && interesting) tree.push(treeLine(node, level, origin));
    if (level === 0) tree.push(treeLine(node, 0, origin));

    if (node.type === 'TEXT') {
      const st = node.style ?? {};
      const color = hex(solid(node)?.color);
      texts.push({ id: node.id, text: node.characters ?? '', family: st.fontFamily, weight: st.fontWeight, size: st.fontSize, lh: st.lineHeightPx && round(st.lineHeightPx), ls: st.letterSpacing || 0, color, align: st.textAlignHorizontal?.[0] ?? '', flags: [node.visible === false ? 'oculto' : null, node.characterStyleOverrides?.some(Boolean) ? 'trechos' : null].filter(Boolean) });
      const k = `${st.fontFamily ?? '?'} ${st.fontWeight ?? '?'}`;
      fonts.set(k, (fonts.get(k) ?? 0) + 1);
    }
    const img = imageFill(node);
    if (img) {
      const b = box(node, origin);
      images.push({ id: node.id, name: node.name, size: b ? `${b.w}×${b.h}` : '', mode: img.scaleMode, transform: img.imageTransform ? JSON.stringify(img.imageTransform.map((r) => r.map((v) => round(v, 4)))) : '', radius: node.cornerRadius ?? '', clip: node.clipsContent ? 'sim' : 'não', abs: isAbsolute(node) });
    }
    // Oculto dentro de oculto nao interessa a quem implementa: lista so o de cima.
    if (isAbsolute(node) || (node.visible === false && !parentHidden)) {
      const b = box(node, origin);
      // Id com prefixo "I" = no interno de uma instancia: oculto ali quase sempre e uma propriedade desligada (icone, rotulo).
      absolute.push({ id: node.id, name: node.name, type: node.type, pos: b ? `${b.x},${b.y} ${b.w}×${b.h}` : '', abs: isAbsolute(node), hidden: node.visible === false, internal: node.id.startsWith('I') });
    }
    const fx = effectsOf(node);
    if (fx.length) {
      const k = fx.join(' + ');
      if (!effects.has(k)) effects.set(k, []);
      effects.get(k).push(node.id);
    }
    const kids = node.children ?? [];
    const vectors = kids.filter((c) => LEAF_VECTORS.has(c.type) && !(isAbsolute(c) || c.visible === false || effectsOf(c).length || imageFill(c))).length;
    if (vectors) tree.push(`${'  '.repeat(level + 1)}(+${vectors} vetor${vectors > 1 ? 'es' : ''})`);
    kids.forEach((c) => visit(c, level + 1, parentHidden || node.visible === false));
  };
  visit(root, 0);

  const md = [];
  md.push(`# ${root.name} [${root.id}]`, '');
  md.push(`Gerado a partir do cache${key ? ` (arquivo \`${key}\`)` : ''}${depth !== undefined ? `, profundidade ${depth}` : ''}${generatedAt ? `, em ${generatedAt}` : ''}. Coordenadas \`x,y\` relativas a ESTE nó (a seção); \`clip\` = clipsContent verdadeiro.`, '');

  md.push('## Lacunas', '');
  if (!scan.truncated.length && !scan.hidden.length) md.push('Nenhuma: nada truncado nem oculto.', '');
  else {
    const visible = scan.truncated.filter((t) => !t.hidden);
    if (visible.length) md.push(`- **${visible.length} contêiner(es) visíveis truncados** na profundidade ${depth} (os filhos existem e não foram lidos; baixe o nó de novo com profundidade maior): ${visible.slice(0, 8).map((t) => `${t.name} [${t.id}]`).join('; ')}${visible.length > 8 ? '; …' : ''}`);
    const hiddenTrunc = scan.truncated.length - visible.length;
    if (hiddenTrunc) md.push(`- ${hiddenTrunc} contêiner(es) ocultos truncados (não afetam o visual).`);
    if (scan.hidden.length) md.push(`- ${scan.hidden.length} nó(s) ocultos (visible:false) no topo da cadeia: ver a seção "Ocultos e absolutos".`);
    md.push('');
  }
  if (scan.empty.length) md.push(`Contêineres realmente vazios (fundo/imagem sem filhos): ${scan.empty.map((e) => `${e.name} [${e.id}]`).join('; ')}`, '');

  md.push('## Árvore', '', '```', ...tree, '```', '');

  md.push('## Textos', '', `Famílias: ${[...fonts].map(([k, n]) => `${k} (${n})`).join(', ') || '—'}`, '', '| nó | texto | fonte | peso | px | lh | ls | cor | al | obs |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const t of texts) md.push(`| ${t.id} | ${cell(clip(t.text, 70))} | ${cell(t.family)} | ${t.weight ?? ''} | ${t.size ?? ''} | ${t.lh ?? ''} | ${t.ls} | ${t.color ?? ''} | ${t.align} | ${t.flags.join(', ')} |`);
  md.push('');

  md.push('## Imagens (fill IMAGE)', '');
  if (!images.length) md.push('Nenhuma.', '');
  else {
    md.push('| nó | nome | tamanho | scaleMode | imageTransform | raio | clip | absoluto |', '|---|---|---|---|---|---|---|---|');
    for (const i of images) md.push(`| ${i.id} | ${cell(i.name)} | ${i.size} | ${i.mode ?? ''} | ${i.transform} | ${i.radius} | ${i.clip} | ${i.abs ? 'sim' : ''} |`);
    md.push('', 'STRETCH com imageTransform escala e recorta a imagem (não é `object-fit: cover`): reproduza a escala; FILL equivale a cover.', '');
  }

  md.push('## Ocultos e absolutos', '');
  const individual = absolute.filter((a) => !(a.hidden && a.internal && !a.abs));
  const toggled = absolute.filter((a) => a.hidden && a.internal && !a.abs);
  if (!absolute.length) md.push('Nenhum.', '');
  else {
    if (individual.length) {
      md.push('| nó | nome | tipo | posição e tamanho | absoluto | oculto |', '|---|---|---|---|---|---|');
      for (const a of individual) md.push(`| ${a.id} | ${cell(a.name)} | ${a.type} | ${a.pos} | ${a.abs ? 'sim' : ''} | ${a.hidden ? 'sim' : ''} |`);
      md.push('');
    }
    if (toggled.length) {
      const byName = new Map();
      for (const a of toggled) byName.set(a.name, (byName.get(a.name) ?? 0) + 1);
      md.push(`Ocultos dentro de instâncias (propriedade desligada no componente, não desenhe): ${[...byName].map(([n, c]) => `${n} ×${c}`).join(', ')}.`, '');
    }
  }

  md.push('## Efeitos, opacidade, raio e rotação (agrupados por valor)', '');
  if (!effects.size) md.push('Nenhum.', '');
  else for (const [k, ids] of [...effects].sort((a, b) => b[1].length - a[1].length)) md.push(`- ${k}: ${ids.length} nó(s)${ids.length <= 6 ? ` (${ids.join(', ')})` : ` (${ids.slice(0, 4).join(', ')}, …)`}`);
  md.push('');
  return { markdown: md.join('\n'), gaps: scan };
}
