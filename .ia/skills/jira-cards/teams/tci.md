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

Opcionais úteis: Data de início (`customfield_10630`, `YYYY-MM-DD`), Data limite (`duedate`), Categorias/labels (ex.: `front-end`), Responsável (`assignee`), Times Envolvidos (`customfield_11242`, `[{"id": "12486"}]` = T-Cloud Design) e Team (`customfield_10114`, formato não validado: se for rejeitado, omita e avise).

Tipo e valor do Retorno Esperado **não têm padrão**: pergunte. Se o usuário não souber, ofereça as opções do `allowedValues`.

## Subtarefa

Só 5 campos obrigatórios: Resumo, Relator, Projeto, Tipo de item e **Pai** (chave de uma História ou Tarefa). Não exige os campos customizados das outras. Sem pai informado, não crie.

## Hierarquia e convenção História > Tarefa

- Épico é o pai de História e Tarefa. A convenção "tarefa dentro de história" é organizacional.
- **A definir:** como registrar a ligação Tarefa -> História. Tipos de link existentes: `Relates` (relates to) e `Polaris work item link` (implements / is implemented by). Até o time decidir, registre "Relacionada a TCI-xxx" na descrição e **não crie link**.

## Sem padrão (perguntar)

Responsável, labels, datas e a história de referência de uma tarefa.

## Convenções de título

Prefixo entre colchetes com a área, em maiúsculas: `[FRONT]`, `[IAM]`, `[APP][ROADMAP]`. Sugira o prefixo conforme o assunto, sem impor. Cards de teste usam `[TESTE]`.

## Tipos de issue do projeto

Épico, História, Tarefa, Subtarefa, Bug, Melhoria, Incidente, Suporte, Spike, Débito Técnico. História e Bug exigem: Resumo, Relator, Tipo de demanda, Área solicitante, Produto, Cliente.
