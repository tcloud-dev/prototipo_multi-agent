# prototipo_agent_atlassian

Protótipo de agente para produtos da Atlassian (ex.: Jira). Repositório em fase inicial, sem código ainda.

## Memória

- Registre na memória do projeto tudo que não seja derivável do código ou do git: decisões de arquitetura e o porquê, preferências do usuário, restrições, referências externas (sites Jira/Confluence, projetos, boards, links).
- Antes de salvar, verifique se já existe uma memória sobre o assunto e atualize-a em vez de duplicar.
- Idioma de trabalho: português (BR). Código e identificadores em inglês.

## Estrutura

- **Fonte única:** tudo de IA vive em `.ia/` (`.ia/skills/`, `.ia/agents/`, ...). `.ia/` é a raiz do plugin do Claude Code (`.ia/.claude-plugin/plugin.json`, skills em `.ia/skills/` pelo padrão); testar com `claude --plugin-dir .ia`. Para o Copilot, `.github/skills/<nome>/SKILL.md` e `.github/agents/<nome>.agent.md` são **apenas ponteiros** (frontmatter + "leia `.ia/...`"), sem conteúdo próprio. Ao criar skill/agente novo em `.ia/`, crie o ponteiro correspondente em `.github/`. Nunca colocar lógica nos ponteiros.
- `.ia/.claude-plugin/plugin.json`: manifesto do plugin (a pasta `.claude-plugin` tem nome obrigatório).
- `.ia/skills/jira-cards/SKILL.md`: skill que cria, edita e transiciona cards via MCP da Atlassian. Nunca deleta; sempre confirma antes de escrever.
- `.ia/agents/jira-assistant.md`: agente que usa a skill `jira-cards`. A lista `tools` não inclui `executeDestructive`, então a proibição de deletar é imposta pelas permissões, não só pelo texto. Ponteiro do Copilot em `.github/agents/jira-assistant.agent.md`.
- `.ia/agents/atomic-commits.md` + skills `.ia/skills/commit-conventions/` (com `profiles/<repo>.md`) e `.ia/skills/pr-summary/`: commits atômicos PT-BR sem acento, com chave do Jira. Lista de comandos proibidos (rebase, reset, push forçado, amend, --no-verify, add . / -A) fica só em `commit-conventions/SKILL.md`; push automático só fora de main/master/develop.
- `.ia/skills/jira-cards/teams/<projeto>.md`: padrões de preenchimento por equipe (hoje só `tci.md`). Os campos obrigatórios são sempre descobertos pela API, não deste arquivo.
- `.vscode/mcp.json`: MCP da Atlassian para o Copilot no VS Code (OAuth no navegador, sem segredos no arquivo). No Claude Code o acesso vem do connector da conta claude.ai.
- Sem API key da Anthropic por decisão do usuário: não adicionar código que dependa de SDK pago sem confirmar.
- Manter a skill neutra de fornecedor (formato SKILL.md, MCP) para funcionar também no GitHub Copilot.

## Convenções

- Atualize este arquivo quando stack, comandos de build/teste ou estrutura forem definidos.
