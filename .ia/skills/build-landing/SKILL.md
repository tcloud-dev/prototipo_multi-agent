---
name: build-landing
description: Conduz o fluxo completo para criar uma landing page a partir de um design do Figma (designer → programmer → qa-visual → build-check). Hoje a stack suportada é HTML5, CSS3 (via SCSS) e JavaScript puros; o código fica em `src` e o build de produção é o do próprio repositório. Retomável - descobre a etapa pelos artefatos. Use quando pedirem para criar, continuar ou retomar uma landing page.
argument-hint: <url do Figma (/design/)>
---

# /build-landing `<url do Figma>`

Você é o orquestrador, na sessão principal. Os agentes não falam com o usuário: você repassa perguntas e respostas. O estado vive nos arquivos, não na conversa.

## Descobrir a etapa (retomável)

Leia a configuração do repositório: `node ${CLAUDE_PLUGIN_ROOT}/scripts/config/ma-config.mjs` (JSON com `stack`, `src`, `out`, `scripts.build`; padrões `src/app` e `dist/app`). Daqui em diante, `src` e `out` são esses valores, não os padrões. Saída 1 = configuração inválida: mostre os erros ao usuário e pare.

Confira, nesta ordem, o primeiro que **não** existir; é onde você está:

| Artefato | Se faltar |
|---|---|
| `reports/brief.md` | **Brief** |
| `figma-data/<fileKey>/index.json` e `design-system.md` (com as variantes do brief) | **designer** |
| `<src>/index.html` (todas as seções do brief) | **programmer** |
| `reports/qa/<id>/report.md` sem item aberto | **qa-visual** (laço de ajustes) |
| `<out>/` mais novo que `<src>/` e `reports/build-log.md` com o build (ou o log dizendo que o projeto não define build) | **build-check** |

Execute **só** a etapa indicada e volte à tabela. Nunca pule etapa, nunca rode duas em paralelo.

## Etapas

0. **Brief:** pergunte e grave em `reports/brief.md`, sem inventar: URL do Figma (`/design/`; arquivo `/site/` não é lido pela API), variantes no escopo (desktop; mobile; dark), idioma (`<html lang>`), texto **final** ou **placeholder** (nesse caso a página não vai a produção como está) e seções a gerar (padrão: todas). Confira que o token do Figma existe sem lê-lo: `test -f ~/.config/figma/.env || test -n "$FIGMA_TOKEN"`; senão, oriente o usuário e pare. **Stack:** use `stack` do `ma-config`. `vanilla` segue o fluxo. `angular` ainda não tem skill de programação neste plugin: avise o usuário e pare. `null` (indefinida): pergunte qual será (HTML/CSS/JS puro ou Angular, e a versão) e peça para rodar a skill `setup`, que grava a escolha. Confira também que o repositório foi preparado (`package.json`, dependências, `src`): senão, rode a skill `setup` antes. O build é do repositório: se `scripts.build` for `false`, avise que o projeto não gera versão de produção e que a etapa 4 será pulada (o `setup` oferece um ponto de partida).
1. **designer** (`multi-agent:designer`): extrai o arquivo para `figma-data/<fileKey>/`, incluindo variantes, assets e a seção "Contraste". Esta etapa só termina com `check` limpo **e** as medidas de **todas** as variantes do brief (sem elas o `programmer` inventaria valores e o QA consertaria tudo depois). **Limite da API do Figma** (conta de visualização tem cota pequena): se o `designer` responder "extração parcial por limite do Figma" (saída 3 do script), a etapa 1 **não terminou**. Não rode o `designer` de novo em seguida nem em laço. Diga ao usuário o que já foi extraído, o que falta e a espera informada, e ofereça: (a) esperar e retomar o `/build-landing` (o cache em `raw/cache/` evita refazer o que já veio) ou (b) seguir só com as variantes e seções já extraídas, **se ele decidir** (registre a lacuna no brief). Para extrair em pedaços, o `designer` usa `prefetch --max-requests N`. **Portão:** se houver pares de contraste reprovados, leve a lista ao usuário antes do `programmer` (a cor é do design; a decisão é dele) e repasse as trocas aprovadas.
2. **programmer** (`multi-agent:programmer`): gera `<src>/`. Passe só o `fileKey`, as seções e o conteúdo do brief; ele lê o resto. Avise o usuário antes quando houver mais de 3 seções (é a etapa mais cara).
3. **qa-visual:** siga a skill `qa-visual` (laço de até 3 rodadas, com portão do usuário).
4. **build-check** (`multi-agent:build-check`): roda o `npm run build` **do repositório** (o mesmo do deploy; o plugin não minifica nem otimiza nada) e confere que `<out>/` renderiza igual a `<src>/`. Sem `scripts.build`, a etapa é pulada e registrada em `reports/build-log.md`. Falha de build volta ao `programmer` (e depois ao QA das seções tocadas); no máximo 2 ciclos, depois pare e reporte.
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

Etapas concluídas, seções geradas, resultado do QA (rodadas, itens corrigidos, pendentes), tamanho de `<src>` → `<out>` (ou "build não configurado") e o que ainda depende do usuário (textos finais, licenças, workflow de deploy rodando `npm ci && npm run build` e publicando `<out>`, domínio e DNS).
