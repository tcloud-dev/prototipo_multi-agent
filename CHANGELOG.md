# Changelog

Formato: uma seção por versão (`## X.Y.Z - AAAA-MM-DD`), com Adicionado, Alterado e Corrigido. Processo em `RELEASING.md`.

## 0.3.0 - 2026-11-04

### Adicionado

- Contrato de build agnóstico: o plugin espera só o script `build` do `package.json` do consumidor (e `sass`, se houver) e a chave `multiAgent` (`stack`, `src`, `out`; padrões `src/app` e `dist/app`), com fallback em `multi-agent.config.json`. Leitor em `.ia/scripts/config/ma-config.mjs`, com testes.
- Detecção de stack (`vanilla` ou `angular`) por `angular.json`, `@angular/core` ou `src/app/index.html`. `vanilla` é suportada; `angular` fica reservada (sem skill de programação ainda) e os agentes param com aviso.
- Perfis de sugestão em `.ia/stacks/` (`vanilla` com bibliotecas e scripts, `angular` reservado) e exemplo de workflow de deploy do GitHub Actions em `.ia/templates/github-actions/` (não instalado pelo plugin).

### Alterado

- **Quebra:** o agente `multi-agent:minifier` foi renomeado para `multi-agent:build-check`. Ele não minifica nada: roda o `npm run build` do próprio repositório, interpreta falhas, confere que a saída renderiza igual ao código-fonte e registra os tamanhos. Sem `scripts.build`, a etapa é pulada.
- A skill `setup` deixou de instalar o build sozinha: detecta a stack, grava `multiAgent` e oferece scripts e bibliotecas como sugestão, só depois da confirmação.
- `programmer`, `qa-visual`, `build-landing` e `landing-page` leem `src`, `out` e `stack` da configuração e só rodam `sass` e `build` se o projeto os define.
- `.ia/templates/build/build.mjs` passa a ser um ponto de partida opcional (copiado só se o usuário aceitar) e lê `src` e `out` da mesma configuração.

## 0.2.0 - 2026-11-03

### Adicionado

- Fluxo de landing page a partir do Figma: agentes `programmer`, `qa-visual` e `minifier`, orquestrados pela skill `build-landing` (designer → programmer → qa-visual → minifier).
- Skills `landing-page`, `qa-visual`, `html5`, `css3` (com `scss-guide.md`) e `javascript-es`. CSS escrito em SCSS; JavaScript ES2022 sem framework.
- Build do consumidor (`.ia/templates/build/build.mjs`, copiado para `scripts/build.mjs` pela skill `setup`): `src/app/` → `dist/app/` com minificação, Sass, otimização de imagens, SVG e vídeo, e checagem de referências quebradas.
- Scripts de QA (`qa-capture.mjs`, `qa-compose.mjs`) com Playwright e sharp, e índice local da documentação oficial (`docs.mjs`: MDN e Sass).

### Alterado

- Skill `setup` também prepara o `.gitignore` (`dist/`, `src/app/css/`, `reports/qa/`), copia o build e instala as dependências.
- Descrições do plugin e do marketplace passam a citar a landing page.

## 0.1.0 - 2026-10-27

- Primeira versão publicável como marketplace: agentes `jira-assistant`, `atomic-commits` e `designer`, skills `jira-cards`, `commit-conventions`, `pr-summary` e `branch-cleanup`, hook de guarda de comandos git e skill `setup`.
