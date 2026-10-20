// Contraste WCAG 2.x entre duas cores opacas. Sem rede e sem disco.
export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function ratio(fg, bg) {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return null;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// kind: "text" (4,5:1), "large" (texto grande: 18,66px bold ou 24px; 3:1) ou "ui" (componente e foco; 3:1).
export const MINIMUM = { text: 4.5, large: 3, ui: 3 };

export function evaluate(fg, bg, kind = 'text') {
  const r = ratio(fg, bg);
  if (r === null) return { ok: false, error: `cor invalida (${fg} / ${bg})` };
  const min = MINIMUM[kind];
  if (min === undefined) return { ok: false, error: `tipo "${kind}" desconhecido (text, large, ui)` };
  return { ok: r >= min, ratio: Math.round(r * 100) / 100, min };
}
