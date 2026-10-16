---
name: jira-cards
description: Cria, edita, preenche campos e muda o status de cards (issues) no Jira, descobrindo os campos obrigatórios de cada projeto e tipo de issue. Use quando o usuário pedir para criar, atualizar, mover ou consultar um card, ou perguntar quais campos são obrigatórios.
---

# jira-cards

Opera cards do Jira pelo MCP da Atlassian. Idioma: português (BR).

## Regras

1. **Nunca deletar.** Não existe exclusão de card nesta skill. Se pedirem, recuse e sugira a UI do Jira.
2. **Confirmar antes de escrever.** Antes de criar, editar ou transicionar, mostre um resumo (projeto, tipo, campos e valores) e espere um "sim" explícito. Leituras não precisam de confirmação.
3. **Obrigatórios vêm da API, não de memória.** Sempre descubra no momento do uso; a lista muda por projeto, tipo de issue e ao longo do tempo.
4. **Não invente valores.** Campos de lista só aceitam os `allowedValues` retornados. Se o usuário não informou e não há padrão da equipe, pergunte.

## Fluxo: criar card

1. Identifique o projeto (chave) e o tipo. Se não informados, pergunte.
2. Resolva o `cloudId` com `getAccessibleAtlassianResources` (ou use a URL do site).
3. `listJiraProjectIssueTypesMetadata` para obter o `issueTypeId`; depois `getJiraIssueTypeMetaWithFields` (via `executeRead`) para listar os campos obrigatórios e seus `allowedValues`.
4. Carregue os padrões da equipe em `teams/<projeto>.md` (ex.: `teams/tci.md`), se existir, e preencha com eles o que for obrigatório. O que não tiver padrão, pergunte.
5. `Relator`: use o usuário atual (`atlassianUserInfo`), salvo pedido em contrário.
6. Mostre o resumo, peça confirmação e então chame `createJiraIssue`. Devolva a chave e o link do card.
7. Se a criação for rejeitada, leia o `repairHint`, corrija e tente de novo uma vez; depois pergunte ao usuário.

## Fluxo: editar / preencher campos

1. Leia o card com `getJiraIssue` e mostre o valor atual dos campos que serão alterados.
2. Confirme e aplique com `editJiraIssue`.

## Fluxo: mudar status

1. Liste as transições possíveis do card com `listJiraIssueTransitions` (via `executeRead`); o status desejado pode não estar disponível a partir do status atual.
2. Confirme e aplique com `transitionJiraIssue`. Se a transição exigir campos, pergunte.

## Outras equipes

Para projetos sem arquivo em `teams/`, use apenas o que a API informa como obrigatório e pergunte todos os valores. Ao final, ofereça criar `teams/<projeto>.md` com os padrões usados.
