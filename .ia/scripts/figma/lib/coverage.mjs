// Cobertura de um no ja baixado: o que ficou RASO demais (profundidade) ou escondido, sem rede e sem disco.
// A API do Figma devolve `children: []` num conteiner exatamente no limite da profundidade pedida (truncamento) e tambem
// num conteiner que e vazio de verdade. Pela profundidade em que aparece da para separar os dois:
//   profundidade do no >= profundidade pedida  -> TRUNCADO (os filhos existem, so nao foram baixados)
//   profundidade do no <  profundidade pedida  -> vazio de verdade (ex.: frame so com fundo de imagem)
// Conferido contra o arquivo real da landing (453 nos, --depth 7): 24 truncados, 1 vazio de verdade.

export const CONTAINERS = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET', 'SECTION', 'BOOLEAN_OPERATION']);

// root: documento do no; depth: profundidade com que foi baixado (a raiz e o nivel 0).
export function scanNode(root, depth) {
  const truncated = [];
  const empty = [];
  const hidden = [];
  let total = 0;
  const visit = (node, level, path, parentHidden) => {
    total++;
    const isHidden = node.visible === false;
    if (isHidden && !parentHidden) hidden.push({ id: node.id, name: node.name, type: node.type, path });
    if (CONTAINERS.has(node.type) && Array.isArray(node.children) && node.children.length === 0) {
      (level >= depth ? truncated : empty).push({ id: node.id, name: node.name, type: node.type, path, hidden: isHidden || parentHidden });
    }
    for (const c of node.children ?? []) visit(c, level + 1, `${path}/${c.name}`, isHidden || parentHidden);
  };
  visit(root, 0, root.name, false);
  return { total, truncated, empty, hidden };
}

// Cobertura do cache inteiro. `entries`: [{ id, depth, document }] (um por arquivo de raw/cache/nodes). Um no truncado numa arvore
// pode estar completo em outra (a secao baixada com --depth 1 e resolvida pela baixada com --depth 7): so e lacuna o que NENHUMA
// arvore em cache cobre. Ocultos truncados nao contam (nao aparecem na pagina).
export function cacheCoverage(entries) {
  const resolved = new Set();
  const candidates = [];
  let nodes = 0;
  for (const { id: rootId, depth, document } of entries) {
    const visit = (node, level, path, hidden) => {
      nodes++;
      const isHidden = hidden || node.visible === false;
      const container = CONTAINERS.has(node.type) && Array.isArray(node.children);
      if (container && node.children.length === 0 && level >= depth) candidates.push({ id: node.id, name: node.name, type: node.type, path, hidden: isHidden, from: rootId });
      else resolved.add(node.id);
      for (const c of node.children ?? []) visit(c, level + 1, `${path}/${c.name}`, isHidden);
    };
    visit(document, 0, document.name, false);
  }
  const gaps = [];
  const seen = new Set();
  for (const c of candidates) {
    if (resolved.has(c.id) || c.hidden || seen.has(c.id)) continue;
    seen.add(c.id);
    gaps.push(c);
  }
  return { trees: entries.length, nodes, gaps, hiddenTruncated: candidates.filter((c) => c.hidden && !resolved.has(c.id)).length };
}

// Ancestrais minimos a aprofundar: se um no truncado esta dentro de outro truncado, so o de cima importa.
// Devolve ids (sem repeticao) dos nos visiveis truncados; os ocultos saem a parte (nao precisam de download para programar).
export function deepenTargets(scan) {
  const visible = scan.truncated.filter((t) => !t.hidden);
  return [...new Set(visible.map((t) => t.id))];
}
