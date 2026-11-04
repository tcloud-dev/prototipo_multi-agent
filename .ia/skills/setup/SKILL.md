---
name: setup
description: Prepara um repositorio que instalou o plugin multi-agent - configura atribuicao de commits e PRs no .claude/settings.json, a regra do .gitignore do figma-data, a stack da landing page (chave multiAgent do package.json, com sugestao opcional de scripts e bibliotecas de build) e confere os requisitos (Node, FIGMA_TOKEN, jq). Use quando o usuario pedir para configurar, preparar ou fazer o setup do plugin no repositorio atual.
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
   - Landing page: rode `node ${CLAUDE_PLUGIN_ROOT}/scripts/config/ma-config.mjs` (le a chave `multiAgent` do `package.json`, ou `multi-agent.config.json`, e detecta a stack por `angular.json`, `@angular/core` ou `src/app/index.html`). Anote: `stack` e de onde veio (`stackSource`), `src`, `out` e se o projeto ja define os scripts `build` e `sass`. Para o QA visual: `playwright` e `sharp` instalados (`npm ls <pacote> --depth=0`) e um Chrome ou Edge.

## 2. Plano (um unico "sim")

Mostre o que sera feito e o que ja esta correto:

- `.claude/settings.json`: garantir `"attribution": { "commit": "", "pr": "" }` (commits e PRs sem Co-Authored-By nem assinatura do Claude). Mescle com o conteudo existente; se `attribution` ja existir com outro valor, mostre a diferenca e pergunte, nao troque sozinho.
- `.gitignore`: garantir a linha `figma-data/*/raw/` (JSON bruto do Figma fica fora do git).
- `.gitignore`: garantir tambem `<out>/` (artefato do build; o deploy o gera; padrao `dist/`), `<src>/css/` (so se o projeto compila SCSS: o CSS gerado fica fora do git; padrao `src/app/css/`) e `reports/qa/` (capturas do QA).
- Stack da landing page (so se o usuario for usar o agente `programmer`): `stack` indefinida -> pergunte qual sera, `vanilla` (HTML, SCSS e JS puros) ou `angular` (e qual versao; **ainda sem suporte no plugin**, so e registrada). Mostre o perfil `${CLAUDE_PLUGIN_ROOT}/stacks/<stack>.md` e grave a escolha na chave `multiAgent` do `package.json` (ou em `multi-agent.config.json` se nao houver `package.json` e o usuario nao quiser cria-lo), **sem tocar no resto do arquivo**; se a chave ja existir com outro valor, mostre a diferenca e pergunte.
- Build da landing page: **o build e do repositorio, nao do plugin**. O contrato e o script `build` do `package.json` (e `sass`, se o projeto usa SCSS). Se o projeto **ja tem** `build`, nao mexa. Se **nao tem**, ofereca o ponto de partida do perfil (`stack: vanilla`): liste os scripts e as bibliotecas sugeridas, pergunte se quer aplicar tudo, so os scripts, ou nada; so o que for aceito e copiado (`${CLAUDE_PLUGIN_ROOT}/templates/build/build.mjs` -> `scripts/build.mjs`, sem sobrescrever; scripts e `npm i -D` das bibliotecas aceitas, `npm init -y` se faltar o `package.json`). Para `angular`, nao monte `package.json`: sugira o comando do Angular CLI da versao escolhida. Para o deploy, cite o exemplo `${CLAUDE_PLUGIN_ROOT}/templates/github-actions/deploy-example.yml` (nao instale). Dicas de ambiente (proxy da TOTVS, `npm approve-scripts`) estao no perfil. O `deny` de comandos git ja e bloqueado pelo hook do plugin; nao o copie para o repositorio.
- Requisitos que faltam (Node, token, jq, navegador): apenas liste e diga como resolver. Instale so as dependencias que o usuario aceitou, e so depois do "sim".

## 3. Aplicar

So depois do "sim": faca as edicoes minimas com a ferramenta de edicao (nao reescreva arquivos inteiros), e mostre o resultado em poucas linhas. Nao faca commit; avise que as mudancas ficaram pendentes para o usuario commitar.

## Limites

- Nao crie nem altere `~/.claude/settings.json`.
- Nao grave token em arquivo nenhum.
