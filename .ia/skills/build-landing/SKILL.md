---
name: build-landing
description: Conduz o fluxo completo para criar uma landing page em HTML5, CSS3 (via SCSS) e JavaScript a partir de um design do Figma (designer → programmer → qa-visual → minifier), com src/app/ como código e dist/app/ como versão otimizada. Retomável - descobre a etapa pelos artefatos. Use quando pedirem para criar, continuar ou retomar uma landing page.
argument-hint: <url do Figma (/design/)>
---

# /build-landing `<url do Figma>`

Você é o orquestrador, na sessão principal. Os agentes não falam com o usuário: você repassa perguntas e respostas. O estado vive nos arquivos, não na conversa.

## Descobrir a etapa (retomável)

Confira, nesta ordem, o primeiro que **não** existir; é onde você está:

| Artefato | Se faltar |
|---|---|
| `reports/brief.md` | **Brief** |
| `figma-data/<fileKey>/index.json` e `design-system.md` (com as variantes do brief) | **designer** |
| `src/app/index.html` (todas as seções do brief) | **programmer** |
| `reports/qa/<id>/report.md` sem item aberto | **qa-visual** (laço de ajustes) |
| `dist/app/` mais novo que `src/app/` e `reports/build-log.md` com o build | **minifier** |

Execute **só** a etapa indicada e volte à tabela. Nunca pule etapa, nunca rode duas em paralelo.

## Etapas

0. **Brief:** pergunte e grave em `reports/brief.md`, sem inventar: URL do Figma (`/design/`; arquivo `/site/` não é lido pela API), variantes no escopo (desktop; mobile; dark), idioma (`<html lang>`), texto **final** ou **placeholder** (nesse caso a página não vai a produção como está) e seções a gerar (padrão: todas). Confira que o token do Figma existe sem lê-lo: `test -f ~/.config/figma/.env || test -n "$FIGMA_TOKEN"`; senão, oriente o usuário e pare. Confira também que o repositório foi preparado (`scripts/build.mjs`, dependências): senão, rode a skill `setup` antes.
1. **designer** (`multi-agent:designer`): extrai o arquivo para `figma-data/<fileKey>/`, incluindo variantes, assets e a seção "Contraste". Esta etapa só termina com `check` limpo **e** as medidas de **todas** as variantes do brief (sem elas o `programmer` inventaria valores e o QA consertaria tudo depois). **Portão:** se houver pares de contraste reprovados, leve a lista ao usuário antes do `programmer` (a cor é do design; a decisão é dele) e repasse as trocas aprovadas.
2. **programmer** (`multi-agent:programmer`): gera `src/app/`. Passe só o `fileKey`, as seções e o conteúdo do brief; ele lê o resto. Avise o usuário antes quando houver mais de 3 seções (é a etapa mais cara).
3. **qa-visual:** siga a skill `qa-visual` (laço de até 3 rodadas, com portão do usuário).
4. **minifier** (`multi-agent:minifier`): `npm run build` gera `dist/app/` (SCSS compilado, tudo minificado e com mídia otimizada) e confere que renderiza igual ao `src/app/`. Falha de build volta ao `programmer` (e depois ao QA das seções tocadas); no máximo 2 ciclos, depois pare e reporte.
5. **Pronto:** relate.

## Regras

- Nunca `git commit`/`git push`: o usuário comita pelo fluxo dele (agente `atomic-commits`). `dist/` não vai para o git; o deploy o gera.
- Cada agente recebe só o que a etapa pede (fileKey, respostas do usuário, relatório do QA); não cole documentos grandes no prompt.
- Não altere os scripts do plugin para fazer uma página passar. Se o motor não der conta, diga ao usuário.
- Decisões do usuário: pergunte em lote, com a sua recomendação em cada item e no máximo ~7 por vez; item de baixo impacto vai como "ignorado" (uma linha). Cada decisão é registrada pelo `designer` em "Decisões e divergências intencionais".

## Pontos que o fluxo não pega sozinho (leve ao usuário)

- Fotos de banco de imagem ou de ferramenta externa: a licença é do dono; registre como pendência antes de publicar.
- Texto sobre imagem: o QA não mede contraste; peça a medida com `contrast.mjs` e leve os casos reprovados.
- Controles sem ação definida e links `href="#"`: liste no relatório final.
- Texto placeholder: **não publicar em produção** com ele.

## Relatório final

Etapas concluídas, seções geradas, resultado do QA (rodadas, itens corrigidos, pendentes), tamanho de `src/app` → `dist/app` e o que ainda depende do usuário (textos finais, licenças, workflow de deploy rodando `npm ci && npm run build` e publicando `dist/app`, domínio e DNS).
