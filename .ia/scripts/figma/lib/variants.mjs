// Variantes do design (desktop/mobile x light/dark): quais frames sao "a pagina" e como nomear cada variante. Sem rede e sem disco.
// Regra aprendida num arquivo real: cards de 350x622 DENTRO de uma lista foram tomados por "mobile". Frame de pagina mora no topo:
// numa pagina, ou dentro de SECTION/GROUP (organizacao), nunca dentro de outro FRAME de conteudo.

const PAGE_FRAME_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET'];
const ORGANIZERS = new Set(['CANVAS', 'DOCUMENT', 'SECTION', 'GROUP']);

const looksLikePage = (b) => b && b.width >= 320 && b.width <= 1920 && b.height >= 400;

// strict (variants): desce so por organizadores. Nao-strict (map, so informativo): desce por qualquer no, como antes.
export function pageLikeFrames(node, acc = [], strict = false) {
  for (const c of node.children ?? []) {
    if (PAGE_FRAME_TYPES.includes(c.type) && looksLikePage(c.absoluteBoundingBox)) acc.push(c);
    else if (!strict || ORGANIZERS.has(c.type)) pageLikeFrames(c, acc, strict);
  }
  return acc;
}

export function variantOf(frame) {
  const n = frame.name.toLowerCase();
  const w = frame.absoluteBoundingBox?.width ?? 0;
  const device = /mobile|iphone|android|phone|celular/.test(n) ? 'mobile' : /tablet|ipad/.test(n) ? 'tablet' : /desktop|laptop|web|notebook/.test(n) ? 'desktop' : w <= 480 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop';
  const theme = /dark|escuro/.test(n) ? 'dark' : 'light';
  const overlay = /\b(menu|modal|overlay|drawer)\b/.test(n) ? '-menu' : '';
  return `${device}-${theme}${overlay}`;
}

// Nome com dispositivo E tema escritos vale mais que o inferido pela largura.
export const explicitness = (f) => Number(/mobile|iphone|android|phone|celular|tablet|ipad|desktop|laptop|web|notebook/i.test(f.name)) + Number(/dark|escuro|light|claro/i.test(f.name));

const round = (n) => Math.round(n ?? 0);

// entries: [{ page, frame, full }] (full = frame com os filhos diretos). Devolve { variants, alternatives-in-variants }.
// O primeiro frame de cada nome de variante (o mais explicito) fica como variante; os demais com o mesmo nome entram em
// `alternatives` dessa variante, nunca viram outra chave (nada de "desktop-light+").
export function buildVariants(entries) {
  const ordered = [...entries].sort((a, b) => explicitness(b.full) - explicitness(a.full));
  const variants = {};
  for (const { page, frame, full } of ordered) {
    const v = variantOf(full);
    const info = {
      inferred: explicitness(full) < 2,
      frameId: frame.id,
      frameName: full.name,
      page,
      width: round(full.absoluteBoundingBox?.width),
      height: round(full.absoluteBoundingBox?.height),
      sections: (full.children ?? []).map((c) => ({ name: c.name, id: c.id, type: c.type, width: round(c.absoluteBoundingBox?.width), height: round(c.absoluteBoundingBox?.height) })),
    };
    if (variants[v]) (variants[v].alternatives ??= []).push({ frameId: info.frameId, frameName: info.frameName, page: info.page, width: info.width, height: info.height });
    else variants[v] = info;
  }
  return variants;
}
