---
name: branch-cleanup
description: Apaga, local e remoto, os branches de trabalho (feat, fix, bugfix, docs) do proprio usuario depois que o trabalho esta concluido e totalmente mergeado em env/dev, env/hmg e main. Use quando o usuario pedir para limpar, apagar ou remover branches.
---

# branch-cleanup

Idioma da conversa: portugues (BR). Fluxo de branches em `${CLAUDE_PLUGIN_ROOT}/skills/commit-conventions/git-flow.md`.

## Regras

1. **So branches do proprio usuario.** O branch so e candidato se o autor do ultimo commit for o usuario atual (`git config user.email`). Branch de outra pessoa nunca entra, mesmo integrado: apenas informe que existe.
2. **So branches de trabalho:** `feat/**`, `fix/**`, `bugfix/**` e `docs/**`. Nunca `main`, `env/dev`, `env/hmg` nem o branch atual.
3. **O usuario diz que o trabalho acabou.** Perguntar nunca e dispensavel: a feature, o fix ou o doc esta concluido? Sem um "sim" explicito sobre aquele branch, ele nao e apagado, mesmo estando mergeado.
4. **Tudo mergeado, nos tres ambientes.** O tip do branch precisa ser ancestral de `origin/env/dev`, `origin/env/hmg` **e** `origin/main`. Se faltar em qualquer um, nao apague e diga em qual falta.
5. **Um unico "sim" para o plano**, com a lista exata do que sera apagado (local e remoto) e o hash do tip de cada branch.
6. **Nunca** `git branch -D`, `git push --force` / `-f` nem qualquer comando da lista proibida de `commit-conventions/SKILL.md`. Se `git branch -d` recusar, pare e informe; nao force.

## Fluxo

1. **Atualizar:** `git fetch --prune origin`. Sem isso a checagem usa dados velhos.
2. **Identidade:** `git config user.email`.
3. **Listar candidatos:** branches locais e remotos (`origin/*`) que casam com `feat/`, `fix/`, `bugfix/` ou `docs/`, exceto o atual. Para cada um, `git log -1 --format=%ae <branch>` e descarte os que nao forem do usuario (liste-os a parte, como "de outra pessoa", sem agir).
4. **Perguntar:** mostre os candidatos e pergunte, por branch, se o trabalho esta concluido. Aceite uma resposta para todos ("todos") ou para alguns. Os que o usuario nao confirmar ficam de fora.
5. **Verificar a integracao** dos confirmados, nos tres destinos:
   - `git merge-base --is-ancestor <branch> origin/env/dev`
   - `git merge-base --is-ancestor <branch> origin/env/hmg`
   - `git merge-base --is-ancestor <branch> origin/main`

   O codigo de saida 0 significa integrado. Para a explicacao ao usuario, `git rev-list --count origin/<base>..<branch>` mostra quantos commits faltam. Se o PR foi feito por squash ou rebase (fora do padrao do projeto), o teste acima nao reconhece o merge: trate como nao integrado e deixe o usuario decidir.
6. **Montar o plano**, em tres grupos:
   - **Apagar** (confirmado pelo usuario e integrado nos tres): branch, onde existe (local, remoto ou ambos) e hash do tip.
   - **Nao apagar, falta integrar:** branch e em qual ambiente falta.
   - **Nao apagar, nao confirmado ou de outra pessoa.**
7. **Pedir o "sim"** para o grupo "Apagar".
8. **Sair do branch a apagar**, se for o atual: `git switch main`.
9. **Apagar**, um branch por vez, parando na primeira falha:
   - Local: `git branch -d <branch>`.
   - Remoto: `git push origin --delete <branch>`.
10. **Fechar:** `git fetch --prune origin` e `git branch -a`. Liste o que foi apagado (com o hash do tip) e o que ficou, com o motivo.

## Recuperar um branch apagado

O hash do tip fica no relatorio final. Para recriar: `git branch <nome> <hash>` e, se precisar, `git push origin <nome>`. Localmente tambem serve `git reflog`.

## Terminal

Detecte o shell pelo ambiente. PowerShell: encadeie com `;`, nunca `&&`. Git Bash: use `&&`.

## Comunicacao

Seja direto: uma linha por etapa e, no fim, a lista do que foi apagado e do que ficou. Nao apague nada antes do "sim" do passo 7, e o pedido generico "limpe os branches" nao conta como esse "sim".
