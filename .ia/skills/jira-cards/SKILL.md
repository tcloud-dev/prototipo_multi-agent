---
name: jira-cards
description: Cria, edita, preenche campos e muda o status de cards (issues) no Jira, respeitando a hierarquia (épico, história, tarefa, subtarefa) e descobrindo os campos obrigatórios de cada projeto e tipo. Use quando o usuário pedir para criar, atualizar, mover ou consultar um card, ou perguntar quais campos são obrigatórios.
---

# jira-cards

Opera cards do Jira pelo MCP da Atlassian. Idioma: português (BR).

## Regras

1. **Nunca deletar.** Não existe exclusão de card nesta skill. Se pedirem, recuse e sugira a UI do Jira. Criar projeto também está fora do escopo.
2. **Confirmar antes de escrever.** Antes de criar, editar ou transicionar, mostre um resumo (projeto, tipo, pai, campos e valores) e espere um "sim" explícito. Leituras não precisam de confirmação.
3. **Obrigatórios vêm da API, não de memória.** Sempre descubra no momento do uso; a lista muda por projeto, tipo de issue e ao longo do tempo.
4. **Não invente valores.** Campos de lista só aceitam os `allowedValues` retornados. Se o usuário não informou e não há padrão da equipe, pergunte.
5. **Nunca escolha o pai sozinho.** Sugira candidatos, mas quem decide é o usuário.

## Hierarquia

```
Projeto Jira
  Épico                      (nível 1)
    História, Tarefa, Bug... (nível 0)
      Subtarefa              (abaixo de qualquer item de nível 0)
```

| Criar | Pai | Se o usuário não informar |
|---|---|---|
| Épico | O projeto (a chave já define) | Pergunte o projeto |
| História, Tarefa e demais tipos de nível 0 | Um épico (opcional) | Pergunte "com épico ou sem?" e liste candidatos (abaixo) |
| Subtarefa | Uma História ou Tarefa (**obrigatório**) | Peça a chave; sem ela, não crie |

- **Convenção da empresa:** História > Tarefa. No Jira nativo, História e Tarefa estão no mesmo nível, e o pai de uma Tarefa é um épico. Como a convenção é organizacional, não há campo próprio para ela: se o usuário citar a história de uma tarefa, registre na descrição ("Relacionada a TCI-123") e, se o time tiver definido um tipo de link, use-o (ver `teams/<projeto>.md`). Não invente o tipo de link.
- **Candidatos a épico:** `searchJiraIssuesUsingJql` com `project = <PROJ> AND issuetype = "Épico" AND statusCategory != Done ORDER BY created DESC`, `maxResults` 5. Mostre chave e título.
- **Validação do pai:** confirme que o pai existe (`getJiraIssue`), que o tipo dele aceita o filho e, na metadata do tipo a criar, que o campo `parent` existe. Se não existir, diga isso ao usuário em vez de forçar.
- Passe o pai em `parent` do `createJiraIssue`.

## Fluxo: criar card

1. Identifique projeto e tipo. Se faltar, pergunte.
2. Resolva o `cloudId` (a URL do site serve) e, se o relator não foi dito, use `atlassianUserInfo`.
3. `listJiraProjectIssueTypesMetadata` para o `issueTypeId`; depois `getJiraIssueTypeMetaWithFields` (via `executeRead`) para os campos obrigatórios e seus `allowedValues`.
4. **Pai:** aplique a tabela da hierarquia.
5. **Duplicidade:** busque cards abertos parecidos com `project = <PROJ> AND issuetype = "<tipo>" AND summary ~ "<palavras-chave>" AND statusCategory != Done`. Se achar, mostre e pergunte se deve criar mesmo assim.
6. Carregue `teams/<projeto>.md` e preencha o que for obrigatório com os padrões. O que não tiver padrão, pergunte. Para a **descrição**, ofereça o modelo do tipo em `templates.md` e preencha com o que o usuário já disse; não invente conteúdo.
7. **Título:** siga a convenção de `teams/<projeto>.md` (por exemplo, prefixo `[ÁREA]`). Sugira, sem impor.
8. Mostre o resumo, peça o "sim" e chame `createJiraIssue`.
9. Se for rejeitada, leia o `repairHint`, corrija e tente de novo uma vez; depois pergunte.
10. **Resposta:** liste todos os cards criados com chave, tipo, título e link (`https://<site>/browse/<CHAVE>`), mais o que ficou fora ou foi omitido (ex.: prioridade).

## Fluxo: criar em lote

Para pedidos como "um épico com 3 histórias":

1. Monte um **plano único**: lista de cards em ordem (pai primeiro), cada um com tipo, título, pai e campos.
2. Peça **um único "sim"** para o plano inteiro.
3. Crie o pai, guarde a chave devolvida e use-a como `parent` dos filhos.
4. Se uma criação falhar, **pare**, informe o que já foi criado e o que faltou. Não recrie os já criados.
5. Termine com a lista de links de todos os cards.

## Fluxo: editar / preencher campos

1. Leia o card com `getJiraIssue` e mostre o valor atual dos campos que serão alterados.
2. Confirme e aplique com `editJiraIssue`.

## Fluxo: mudar status

1. Liste as transições com `listJiraIssueTransitions` (via `executeRead`); o status desejado pode não estar disponível a partir do status atual.
2. Confirme e aplique com `transitionJiraIssue`. Se a transição exigir campos, pergunte.

## Limitação: escrita via subagente

O agente `jira-assistant` roda como subagente e só aceita o "sim" do usuário se vier em mensagem direta a ele. A confirmação repassada pelo agente principal **não** vale, então, nesse modo, ele faz só leituras (descobrir campos obrigatórios, sugerir pais, checar duplicidade, montar o resumo ou o plano com IDs). Para criar, editar ou transicionar: o agente principal mostra o resumo, o usuário confirma na sessão principal e a escrita é feita nela (validado com o TCI-254). Isso não muda a regra 2.

## Outras equipes

Para projetos sem arquivo em `teams/`, use apenas o que a API informa como obrigatório e pergunte todos os valores. Ao final, ofereça criar `teams/<projeto>.md` com os padrões usados.
