---
name: setup
description: Prepara um repositorio que instalou o plugin multi-agent - configura atribuicao de commits e PRs no .claude/settings.json, a regra do .gitignore do figma-data e confere os requisitos (Node, FIGMA_TOKEN, jq). Use quando o usuario pedir para configurar, preparar ou fazer o setup do plugin no repositorio atual.
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

## 2. Plano (um unico "sim")

Mostre o que sera feito e o que ja esta correto:

- `.claude/settings.json`: garantir `"attribution": { "commit": "", "pr": "" }` (commits e PRs sem Co-Authored-By nem assinatura do Claude). Mescle com o conteudo existente; se `attribution` ja existir com outro valor, mostre a diferenca e pergunte, nao troque sozinho.
- `.gitignore`: garantir a linha `figma-data/*/raw/` (JSON bruto do Figma fica fora do git).
- Os comandos git proibidos ja sao bloqueados pelo hook do plugin; nao copie o `deny` para o repositorio.
- Requisitos que faltam: apenas liste e diga como resolver (nao instale nada).

## 3. Aplicar

So depois do "sim": faca as edicoes minimas com a ferramenta de edicao (nao reescreva arquivos inteiros), e mostre o resultado em poucas linhas. Nao faca commit; avise que as mudancas ficaram pendentes para o usuario commitar.

## Limites

- Nao crie nem altere `~/.claude/settings.json`.
- Nao grave token em arquivo nenhum.
