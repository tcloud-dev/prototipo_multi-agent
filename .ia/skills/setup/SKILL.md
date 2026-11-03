---
name: setup
description: Prepara um repositorio que instalou o plugin multi-agent - configura atribuicao de commits e PRs no .claude/settings.json, a regra do .gitignore do figma-data, o build da landing page (scripts/build.mjs e suas dependencias) e confere os requisitos (Node, FIGMA_TOKEN, jq). Use quando o usuario pedir para configurar, preparar ou fazer o setup do plugin no repositorio atual.
---

# setup

Idioma da conversa: portugues (BR). Roda uma vez por repositorio consumidor. Sempre confirme antes de escrever e nunca sobrescreva configuracao existente.

## 1. Diagnostico (somente leitura)

1. Confirme que o diretorio atual e um repositorio git (`git rev-parse --show-toplevel`); senao, pare e avise.
2. Leia `.claude/settings.json` (se existir) e `.gitignore` (se existir).
3. Confira os requisitos sem exibir segredos:
   - `node --version` (precisa ser recente; ver `${CLAUDE_PLUGIN_ROOT}/scripts/figma/figma-map.mjs`).
   - `FIGMA_TOKEN`: so diga se existe como variavel de ambiente ou se o arquivo `~/.config/figma/.env` existe. **Nunca leia nem exiba o valor.**
   - `jq` (`command -v jq`): so necessario fora do Windows.
   - Landing page: existem `package.json`, `scripts/build.mjs` e as devDependencies `esbuild`, `html-minifier-terser`, `sharp`, `svgo`, `ffmpeg-static`, `sass` e `playwright` (`npm ls <pacote> --depth=0`)? Existe um Chrome ou Edge (o QA usa `playwright`)?

## 2. Plano (um unico "sim")

Mostre o que sera feito e o que ja esta correto:

- `.claude/settings.json`: garantir `"attribution": { "commit": "", "pr": "" }` (commits e PRs sem Co-Authored-By nem assinatura do Claude). Mescle com o conteudo existente; se `attribution` ja existir com outro valor, mostre a diferenca e pergunte, nao troque sozinho.
- `.gitignore`: garantir a linha `figma-data/*/raw/` (JSON bruto do Figma fica fora do git).
- `.gitignore`: garantir tambem `dist/` (artefato do build; o deploy o gera), `src/app/css/` (CSS compilado do Sass, sempre gerado) e `reports/qa/` (capturas do QA).
- Build da landing page (so se o usuario for usar o agente `programmer`/`minifier`): copiar `${CLAUDE_PLUGIN_ROOT}/templates/build/build.mjs` para `scripts/build.mjs` do repositorio (**nao sobrescrever** um existente: mostre o diff e pergunte), garantir os scripts `"build": "node scripts/build.mjs"`, `"sass": "sass src/app/scss/main.scss src/app/css/main.css --no-source-map --quiet-deps"` e `"sass:watch": "npm run sass -- --watch"` no `package.json` (criar com `npm init -y` se nao houver) e instalar `npm i -D esbuild html-minifier-terser sharp svgo ffmpeg-static sass playwright`. O script fica no repositorio de proposito: o workflow de deploy no GitHub Actions roda o mesmo `npm ci && npm run build` e publica `dist/app/`. Atras do proxy da TOTVS, o `npm i` pede `NODE_USE_SYSTEM_CA=1`; com npm 12 os scripts de instalacao vem bloqueados: se o build reclamar de `esbuild` ou `ffmpeg-static`, rode `npm approve-scripts esbuild ffmpeg-static`. ja sao bloqueados pelo hook do plugin; nao copie o `deny` para o repositorio.
- Requisitos que faltam (Node, token, jq, navegador): apenas liste e diga como resolver. Instale so as dependencias do build, e so depois do "sim".

## 3. Aplicar

So depois do "sim": faca as edicoes minimas com a ferramenta de edicao (nao reescreva arquivos inteiros), e mostre o resultado em poucas linhas. Nao faca commit; avise que as mudancas ficaram pendentes para o usuario commitar.

## Limites

- Nao crie nem altere `~/.claude/settings.json`.
- Nao grave token em arquivo nenhum.
