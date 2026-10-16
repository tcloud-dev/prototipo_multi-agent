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

## Sem padrão (perguntar)

- Épico: **Tipo de Retorno Esperado** (`customfield_11980`, múltipla) e **Retorno Esperado** (`customfield_13192`) são obrigatórios. No TCI-252: "Melhorar a satisfação do cliente" e "Reduzir trabalho manual".
- Labels (ex.: `front-end`), responsável, data de início e data de entrega.

## Convenções de título

Prefixo entre colchetes com a área: `[FRONT]`, `[IAM]`, `[APP][ROADMAP]`.

## Tipos de issue do projeto

Épico, História, Tarefa, Subtarefa, Bug, Melhoria, Incidente, Suporte, Spike, Débito Técnico. História e Bug exigem: Resumo, Relator, Tipo de demanda, Área solicitante, Produto, Cliente.
