# prototipo_multi-agent

Protótipo de sistema multi-agent. Hoje há dois agentes (`jira-assistant` para Jira/Atlassian e `atomic-commits` para commits e PRs) e as skills que eles usam; a ideia é crescer para mais agentes por domínio, coordenados entre si. Nome anterior do repositório: `prototipo_agent_atlassian`.

## Direção multi-agent

- **Decidido:** o repositório é multi-agent; cada agente tem uma responsabilidade e usa skills próprias, tudo em `.ia/` (fonte única).
- **Em aberto (não assumir):** se haverá um agente orquestrador, quais agentes novos entram, como eles se comunicam e como o aviso periódico a usuários será entregue (hoje não há agendador nem canal de envio; ver `jira-assistant` abaixo). Pergunte ao usuário antes de criar agente ou orquestrador novo.
- O plugin continua com o nome `atlassian-agent` em `.ia/.claude-plugin/plugin.json`; renomeá-lo muda o prefixo das skills e dos agentes (`atlassian-agent:jira-cards`), então só com pedido do usuário.

## Memória

- Registre na memória do projeto tudo que não seja derivável do código ou do git: decisões de arquitetura e o porquê, preferências do usuário, restrições, referências externas (sites Jira/Confluence, projetos, boards, links).
- Antes de salvar, verifique se já existe uma memória sobre o assunto e atualize-a em vez de duplicar.
- Idioma de trabalho: português (BR). Código e identificadores em inglês.

## Estrutura

- **Fonte única:** tudo de IA vive em `.ia/` (`.ia/skills/`, `.ia/agents/`, ...). `.ia/` é a raiz do plugin do Claude Code (`.ia/.claude-plugin/plugin.json`, skills em `.ia/skills/` pelo padrão); testar com `claude --plugin-dir .ia`. Para o Copilot, `.github/skills/<nome>/SKILL.md` e `.github/agents/<nome>.agent.md` são **apenas ponteiros** (frontmatter + "leia `.ia/...`"), sem conteúdo próprio. Ao criar skill/agente novo em `.ia/`, crie o ponteiro correspondente em `.github/`. Nunca colocar lógica nos ponteiros.
- `.ia/.claude-plugin/plugin.json`: manifesto do plugin (a pasta `.claude-plugin` tem nome obrigatório).
- `.ia/skills/jira-cards/SKILL.md`: skill que cria, edita e transiciona cards via MCP da Atlassian. Nunca deleta, não cria projetos e sempre confirma antes de escrever. Trata a hierarquia (épico > história/tarefa > subtarefa; subtarefa exige pai; o pai nunca é escolhido sozinho), checa duplicidade, cria em lote com plano único e usa `templates.md` para descrições.
- `.ia/agents/jira-assistant.md`: agente que usa a skill `jira-cards`. Proibido deletar: a lista `tools` do agente **não** é uma trava (testado: comando fora da lista foi executado); a trava real é a regra `deny` de `executeDestructive` em `.claude/settings.json`. Limitação: como subagente, ele não aceita confirmação repassada pelo agente principal, então só lê; criar/editar/transicionar é feito na sessão principal após o "sim" do usuário (ver `jira-cards/SKILL.md`). Ponteiro do Copilot em `.github/agents/jira-assistant.agent.md`.
- `.ia/agents/atomic-commits.md` + skills `.ia/skills/commit-conventions/` (com `profiles/<repo>.md`), `.ia/skills/pr-summary/` e `.ia/skills/branch-cleanup/`: commits atômicos PT-BR sem acento, com chave do Jira. A `branch-cleanup` apaga, local e remoto, só branches `feat/fix/bugfix/docs` do próprio usuário, depois que ele confirma que o trabalho acabou e o tip está em `env/dev`, `env/hmg` e `main` (nunca `-D`; plano com um único "sim"). Ponteiro do Copilot em `.github/skills/branch-cleanup/`. Lista de comandos proibidos (rebase, reset, push forçado, amend, --no-verify, add . / -A) fica em `commit-conventions/SKILL.md` (regra de texto, vale para qualquer IA) e é bloqueada tecnicamente no Claude Code por `permissions.deny` em `.claude/settings.json`; no Copilot só vale o texto; push automático só em `feat/**`, `fix/**`, `bugfix/**`. Fluxo de branches TOTVS em `commit-conventions/git-flow.md`: protegidos `main`, `env/hmg`, `env/dev`; merge commit (sem squash/rebase).
- `.ia/agents/designer.md` + scripts `.ia/scripts/figma/` (`figma-map.mjs`, `contrast.mjs`, `lib/` com testes: `node --test .ia/scripts/figma/lib/*.test.mjs`): extrai tudo que o Figma expõe pela API REST (nunca pelo MCP; não escreve no Figma) e guarda em `figma-data/<fileKey>/` (`index.json`, `README.md`, `design-system.md`, `pages/`, `assets.json`, `assets/`, `refs/`; `raw/` é JSON bruto e fica fora do git). Token em `FIGMA_TOKEN` ou `~/.config/figma/.env` (fora do repo, nunca lido nem exibido). Atrás do proxy da TOTVS o HTTPS usa CA própria: o script já confia nas CAs do sistema (`tls.setDefaultCACertificates`); em Node sem essa API, rodar com `NODE_USE_SYSTEM_CA=1`; nunca desligar a validação de certificado. Economia de tokens é requisito: os scripts gravam em arquivo e o agente consulta com `jq`/`grep`. Ponteiro do Copilot em `.github/agents/designer.agent.md`. Origem: agente de outro repositório, desacoplado do `site-spec`/`builder`.
- `.ia/skills/jira-cards/teams/<projeto>.md`: padrões de preenchimento por equipe (hoje só `tci.md`). Os campos obrigatórios são sempre descobertos pela API, não deste arquivo.
- `.vscode/mcp.json`: MCP da Atlassian para o Copilot no VS Code (OAuth no navegador, sem segredos no arquivo). No Claude Code o acesso vem do connector da conta claude.ai.
- Sem API key da Anthropic por decisão do usuário: não adicionar código que dependa de SDK pago sem confirmar.
- Manter a skill neutra de fornecedor (formato SKILL.md, MCP) para funcionar também no GitHub Copilot.

## Convenções

- Atualize este arquivo quando stack, comandos de build/teste ou estrutura forem definidos.
