# Changelog

Formato: uma seção por versão (`## X.Y.Z - AAAA-MM-DD`), com Adicionado, Alterado e Corrigido. Processo em `RELEASING.md`.

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
