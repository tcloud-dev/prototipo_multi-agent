# Padrões da equipe: projeto TCI (T-Cloud Interface)

Site: https://totvscloud.atlassian.net. Modelo de referência: TCI-252.

Aplique estes valores quando o campo for obrigatório (ou presente no card modelo) e o usuário não disser outro. Os valores devem existir nos `allowedValues` retornados pela API.

| Campo | ID | Padrão |
|---|---|---|
| Tipo de demanda | `customfield_11369` | Iniciativa |
| Área solicitante | `customfield_11370` | T-Cloud Design |
| Produto (lista) | `customfield_11391` | T-Cloud |
| Cliente | `customfield_12848` | Interno |
| Times Envolvidos (lista) | `customfield_11242` | T-Cloud Design |
| Team | `customfield_10114` | T-Cloud Interface |
| Componente | `components` | T-Cloud |
| Prioridade | `priority` | Média |

## Notas da API (testado em TCI-253)

- Passe os campos customizados por **ID de opção** (ex.: `{"id": "11649"}`), não por nome.
- Em Tarefa, `priority: "Média"` foi rejeitado ("prioridade inválida"). Omita a prioridade na criação e ajuste depois, se precisar.

## Épico

Obrigatórios além dos da tabela acima (verificado na API em 2026-10-16):

| Campo | ID | Formato |
|---|---|---|
| Tipo de Retorno Esperado (múltipla) | `customfield_11980` | `[{"id": "..."}]` com opções do `allowedValues`; no TCI-252: "Melhorar a satisfação do cliente" (12655) e "Reduzir trabalho manual" (14284) |
| Retorno Esperado (texto) | `customfield_13192` | texto livre; no TCI-252: "Melhorar a satisfação do cliente" |

**Datas (obrigatórias por convenção da equipe):** Data de início (`customfield_10630`) e Data limite de entrega (`duedate`), ambas em `AAAA-MM-DD`. A API **não** as marca como obrigatórias, então o Jira aceita o épico sem elas; por isso a skill deve exigi-las. Sem as datas no pedido, pergunte, sem preencher por conta própria. A data limite não pode ser anterior à de início. Modelo: TCI-252 (início 2026-10-19, entrega 2026-10-30). O épico TCI-257, criado sem datas antes desta regra, é a exceção.

Outros opcionais úteis: Categorias/labels (ex.: `front-end`), Responsável (`assignee`), Times Envolvidos (`customfield_11242`, `[{"id": "12486"}]` = T-Cloud Design) e Team (`customfield_10114`, formato não validado: se for rejeitado, omita e avise).

**História e Tarefa:** as mesmas datas são opcionais. Pergunte uma vez ("com datas?") e aceite "não". **Subtarefa** não tem datas.

## Exemplos de pedido

- Épico: `Crie um épico no TCI: "[FRONT] Tela de relatórios". Início 2026-10-19, entrega 2026-10-30. Retorno esperado: Reduzir trabalho manual.`
- História: `Crie uma história no épico TCI-252: "Detectar dispositivo móvel após o login".`
- Subtarefa: `Crie uma subtarefa na história TCI-258: "Ajustar layout do modal".`
- Lote: `Crie um épico "[IAM] Acessos" (início 2026-11-03, entrega 2026-11-28) com 2 histórias, cada uma com 3 subtarefas.`

Tipo e valor do Retorno Esperado **não têm padrão**: pergunte. Se o usuário não souber, ofereça as opções do `allowedValues`.

## Subtarefa

Só 5 campos: Resumo, Relator, Projeto, Tipo de item e **Pai** (chave de uma História ou Tarefa). Sem pai informado, não crie. Não envie campos customizados, componente nem prioridade (a Subtarefa não os tem). Validado com TCI-266 a 271.

## Hierarquia (testado em 2026-10-16)

- Épico é o pai de História e Tarefa. Subtarefa é filha de História ou Tarefa.
- **Tarefa com História como pai é recusada pelo Jira** (criação e edição). Todas as Tarefas com pai que existem no site têm Épico como pai. Para ter itens dentro de uma história, use **Subtarefa**.
- Converter Tarefa em Subtarefa usa o "Mover" do Jira: o status vai de Aberto para "Análise de viabilidade" e são descartados Produto, Área solicitante, Tipo de demanda, Cliente, Link Epic, Classificação e Classes de Serviço. Prefira criar a Subtarefa nova.
- Registro opcional da ligação Tarefa -> História, quando a Tarefa fica no épico: "Relacionada a TCI-xxx" na descrição. Tipos de link existentes (`Relates`, `Polaris work item link`) não foram adotados; não crie link sem o time decidir.

## Sem padrão (perguntar)

Responsável, labels, datas e a história de referência de uma tarefa.

## Convenções de título

Prefixo entre colchetes com a área, em maiúsculas: `[FRONT]`, `[IAM]`, `[APP][ROADMAP]`. Sugira o prefixo conforme o assunto, sem impor. Cards de teste usam `[TESTE]`.

## Tipos de issue do projeto

Épico, História, Tarefa, Subtarefa, Bug, Melhoria, Incidente, Suporte, Spike, Débito Técnico. História e Bug exigem: Resumo, Relator, Tipo de demanda, Área solicitante, Produto, Cliente.
