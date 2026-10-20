// Propriedades "de efeito" de um no do Figma que o layout/token comum nao mostra e que o agente precisa ler para quem implementa
// nao adivinhar: rotacao, opacidade, blend, filtros de imagem (saturacao...), efeitos (blur, sombra), raio e trechos de texto
// com estilo proprio (cor, peso, tamanho). Sem rede e sem disco: recebe o JSON do no.

const hex = (c) => {
  if (!c) return null;
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
};

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function textRuns(node) {
  const text = node.characters;
  const overrides = node.characterStyleOverrides;
  const table = node.styleOverrideTable;
  if (!text || !overrides?.length || !table) return [];
  const runs = [];
  let start = 0;
  for (let i = 1; i <= overrides.length; i++) {
    if (i === overrides.length || overrides[i] !== overrides[start]) {
      const key = overrides[start];
      if (key && table[key]) {
        const o = table[key];
        const color = o.fills?.find((f) => f.type === 'SOLID')?.color;
        runs.push({
          text: text.slice(start, i),
          start,
          end: i,
          ...(color ? { color: hex(color) } : {}),
          ...(o.fontWeight ? { fontWeight: o.fontWeight } : {}),
          ...(o.fontSize ? { fontSize: o.fontSize } : {}),
          ...(o.fontFamily ? { fontFamily: o.fontFamily } : {}),
        });
      }
      start = i;
    }
  }
  return runs;
}

// Devolve so o que existe: {} quando o no nao tem nada notavel.
export function extractFx(node) {
  const fx = {};
  // Sinal conferido contra a imagem de referencia (mao de "Sobre nos" do OrangeBank): rotation -0,6323 rad => CSS rotate(-36.23deg), mesmo sinal.
  if (node.rotation) fx.rotation = { rad: round(node.rotation, 4), deg: round((node.rotation * 180) / Math.PI), css: `rotate(${round((node.rotation * 180) / Math.PI)}deg)` };
  if (node.opacity !== undefined && node.opacity !== 1) fx.opacity = round(node.opacity);
  if (node.blendMode && !['PASS_THROUGH', 'NORMAL'].includes(node.blendMode)) fx.blendMode = node.blendMode;
  if (node.cornerRadius) fx.cornerRadius = node.cornerRadius;
  const effects = (node.effects ?? []).filter((e) => e.visible !== false).map((e) => ({ type: e.type, ...(e.radius !== undefined ? { radius: e.radius } : {}), ...(e.offset ? { offset: e.offset } : {}), ...(e.color ? { color: hex(e.color), alpha: round(e.color.a ?? 1) } : {}), ...(e.blendMode && e.blendMode !== 'NORMAL' ? { blendMode: e.blendMode } : {}) }));
  if (effects.length) fx.effects = effects;
  const fills = (node.fills ?? []).filter((f) => f.visible !== false).map((f) => ({
    type: f.type,
    ...(f.color ? { color: hex(f.color) } : {}),
    ...(f.opacity !== undefined && f.opacity !== 1 ? { opacity: round(f.opacity) } : {}),
    ...(f.blendMode && f.blendMode !== 'NORMAL' ? { blendMode: f.blendMode } : {}),
    ...(f.filters && Object.keys(f.filters).length ? { filters: f.filters } : {}),
  })).filter((f) => f.opacity !== undefined || f.blendMode || f.filters);
  if (fills.length) fx.fills = fills;
  const runs = textRuns(node);
  if (runs.length) fx.textRuns = runs;
  return fx;
}

// Percorre a subarvore ate `maxDepth` e lista so os nos com algo notavel.
export function collectFx(root, maxDepth = 4) {
  const out = [];
  const visit = (node, depth, path) => {
    const fx = extractFx(node);
    if (Object.keys(fx).length) out.push({ id: node.id, name: node.name, type: node.type, path, fx });
    if (depth < maxDepth) (node.children ?? []).forEach((c) => visit(c, depth + 1, `${path}/${c.name}`));
  };
  visit(root, 0, root.name);
  return out;
}
