# prototipo_multi-agent
Prototipo de agente para produtos da Atlassian, como o Jira.

## Usar em outro repositório (Claude Code)

```
/plugin marketplace add tcloud-dev/prototipo_multi-agent
/plugin install multi-agent@tcloud-multi-agent
```

Atualizar: `/plugin update multi-agent`. As travas de comandos proibidos vêm no plugin (`.ia/hooks/guard.mjs`). O `designer` grava em `figma-data/` do repositório onde roda. Para o Copilot, os ponteiros de `.github/` só funcionam neste repositório.
