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

Uma Tarefa nunca tem uma História como pai (ver abaixo).

- **"Tarefa dentro de história" não existe no Jira deste site.** História e Tarefa estão no mesmo nível (0): o Jira recusa uma História como pai de Tarefa, na criação ("Selecione um item pai válido") e na edição ("não pertence à hierarquia apropriada"). Testado no TCI; só um administrador mudando a hierarquia de tipos de item alteraria isso. Quando o usuário pedir uma tarefa dentro de uma história, **não tente** e responda com as opções:
  1. **Subtarefa** da história (pai real no Jira). É a recomendada.
  2. **Tarefa no épico**, citando a história na descrição ("Relacionada a TCI-123").
- **Subtarefa:** só tem 5 campos (Resumo, Relator, Projeto, Tipo de item e Pai). Crie-a **sem** os campos customizados (Tipo de demanda, Área solicitante, Produto, Cliente), sem componente e sem prioridade: ela não os tem. O status inicial é o padrão do workflow.
- **Não converta** Tarefa em Subtarefa (`convertJiraIssueHierarchy`): o Jira usa o "Mover", que muda o status (no TCI, de Aberto para "Análise de viabilidade") e descarta campos. Prefira criar a Subtarefa nova e, se preciso, deixar a Tarefa antiga para o usuário remover. Só converta se o usuário pedir e aceitar essas perdas, após ver a prévia.
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
6a. **Datas:** em **Épico**, Data de início e Data limite são obrigatórias por convenção do time (ver `teams/<projeto>.md`), mesmo que a API não as exija. Se faltarem no pedido, pergunte; não as invente nem as omita. Valide `AAAA-MM-DD` e que a data limite não seja anterior à de início. Em História e Tarefa são opcionais (pergunte uma vez); Subtarefa não tem datas. Vale também para cada épico de um lote.
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
