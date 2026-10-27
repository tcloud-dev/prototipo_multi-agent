# prototipo_multi-agent
Prototipo de agente para produtos da Atlassian, como o Jira.

## Usar em outro repositório (Claude Code)

```
/plugin marketplace add tcloud-dev/prototipo_multi-agent#vX.Y.Z
/plugin install multi-agent@tcloud-multi-agent
```

Troque `vX.Y.Z` pela tag da release (ver `RELEASING.md`). Atualizar: troque a tag e rode `/plugin update multi-agent`. As travas de comandos proibidos vêm no plugin (`.ia/hooks/guard.mjs`). O `designer` grava em `figma-data/` do repositório onde roda. Para o Copilot, os ponteiros de `.github/` só funcionam neste repositório.

### Configuração necessária no repositório que instala o plugin

Rode a skill `multi-agent:setup` no repositório: ela faz o que está descrito abaixo, com a sua confirmação.

O `permissions.deny` e o `attribution` do `.claude/settings.json` não viajam com o plugin. Para commits e PRs sem `Co-Authored-By` e sem assinatura do Claude, copie para o `.claude/settings.json` do repositório:

```json
{ "attribution": { "commit": "", "pr": "" } }
```

Os comandos proibidos (rebase, reset, push forçado etc.) já são bloqueados pelo hook do plugin. Para o `designer`, o repositório precisa de Node, de `FIGMA_TOKEN` e da regra `figma-data/*/raw/` no `.gitignore`.
