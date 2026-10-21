// Imagens ORIGINAIS do Figma: o arquivo que foi colocado no design (fill IMAGE de um no), nao o render do no.
// O render (/images) desenha o no com tudo que esta em cima dele (botoes, selos, mascaras); para foto isso estraga o arquivo.
// Sem rede e sem disco: so decisao.

// Todos os fills IMAGE visiveis na subarvore: [{ id, name, imageRef, path }].
export function findImageFills(node, path = []) {
  const here = [...path, node.name];
  const own = (node.fills ?? [])
    .filter((f) => f.type === 'IMAGE' && f.visible !== false && f.imageRef)
    .map((f) => ({ id: node.id, name: node.name, imageRef: f.imageRef, path: here.join(' > ') }));
  return [...own, ...(node.children ?? []).flatMap((c) => findImageFills(c, here))];
}

// Escolhe a imagem original de um no do manifesto. Exige que haja exatamente uma imagem na subarvore;
// com varias, o agente precisa apontar o no certo (a mensagem lista os candidatos).
export function resolveOriginal(node) {
  const found = findImageFills(node);
  const refs = [...new Set(found.map((f) => f.imageRef))];
  if (!refs.length) return { error: 'sem fill IMAGE neste no nem nos filhos (nao e foto; use mode "render" ou aponte o no certo)' };
  if (refs.length > 1) return { error: `${refs.length} imagens diferentes na subarvore; aponte um destes nos: ${found.map((f) => `${f.id} "${f.name}"`).join(', ')}` };
  return { imageRef: refs[0], source: found[0].id };
}

// Extensao real pelos primeiros bytes (o Figma guarda o original em png, jpg, gif ou webp).
export function extOf(buf) {
  const b = Buffer.from(buf.subarray(0, 12));
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (b.length >= 4 && b.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  return null;
}
