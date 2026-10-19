# Fluxo de branches (padrao TOTVS)

## Branches permanentes (protegidos)

| Branch | Ambiente |
|---|---|
| `main` | producao |
| `env/hmg` | homologacao |
| `env/dev` | desenvolvimento |

Excecao: no repositorio `front-tcloud` a branch de producao e `master`, nao `main` (ver `profiles/front-tcloud.md`). Onde este documento diz `main`, leia a branch de producao do repositorio.

Nunca commitar nem fazer push direto neles. A protecao tecnica no GitHub sera ativada pela equipe responsavel; ate la, a convencao vale por disciplina.

## Branches de trabalho (temporarios)

- Novos recursos: `feat/**`
- Correcoes: `fix/**` ou `bugfix/**`
- Sempre saem da `main`, para nao levar mudancas de outros desenvolvedores para homologacao.
- Padrao de nome: `<tipo>/<CHAVE>-<descricao-curta>`, minusculo, sem acento, hifens. Exemplo: `feat/TCI-253-validacao-dispositivo`. Sem chave do Jira: `feat/validacao-dispositivo`.

## Caminho de uma mudanca

1. O desenvolvedor cria o branch `feat/**` ou `fix/**` a partir da `main` e faz os commits nele.
2. Merge do **branch de trabalho** em `env/dev`; testes em desenvolvimento.
3. Se os testes passarem, merge do **mesmo branch de trabalho** (nao de `env/dev`) em `env/hmg`; testes em homologacao.
4. Se a homologacao passar, merge de `env/hmg` em `main`.
5. Hotfix em producao: ainda nao definido; perguntar ao usuario antes de agir.

`env/dev` nunca e promovido para `env/hmg`: cada mudanca sobe isolada, pelo seu branch de trabalho.

## Merge

Sempre **merge** (merge commit), por PR. Nao usar squash nem rebase.
