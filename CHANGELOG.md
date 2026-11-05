# Changelog

Formato: uma seção por versão (`## X.Y.Z - AAAA-MM-DD`), com Adicionado, Alterado e Corrigido. Processo em `RELEASING.md`.

## Não lançado

### Adicionado

- `figma-map.mjs spec`: medidas por seção em `figma-data/<fileKey>/spec/` (versionado), com coordenadas relativas, `clip`, absolutos, ocultos, textos, imagens (`scaleMode`/`imageTransform`), efeitos e "Lacunas".
- `coverage` e `index` (offline): lacunas e estado (`status`, `layoutDone`, `fxDone`) calculados do disco, não escritos pelo agente.
- `preflight` (plano e limite da conta), `--save` atômico em `layout`/`fx`, trava de uma chamada por vez (saída 4) e cache por subárvore (nó dentro de árvore já baixada não gera requisição).

### Alterado

- `fx` agrupa payloads idênticos; `variants` só considera frames de página e manda duplicatas para `alternatives` (fim das falsas variantes mobile).
- `designer` roda `preflight`, usa `--save` e só declara completo com `coverage` e `check` limpos; `programmer` lê `spec/`, confere dado a dado, pergunta decisões em lote e não inventa breakpoints; `qa-visual` não dá percentual sem critério e compara `clip`/`scaleMode`; `build-landing` exige sinais calculados e abre o relatório com "Decisões que precisam de você".

## 0.3.1 - 2026-11-05

### Corrigido

- `designer` e `figma-map.mjs` respeitam a cota da API do Figma, que conta requisições (uma conta de visualização tem cota pequena e o 429 pode vir com espera de dias). Antes, o script dormia o `Retry-After` em silêncio e a extração travava.
  - Cache em `figma-data/<fileKey>/raw/cache/`: nada é baixado duas vezes e `layout`, `fx`, `node` e `check` leem dele, inclusive sem token (`--refresh` força novo download).
  - `layout` aceita vários `--ids` numa só requisição e `image` pula o PNG que já existe (`--force` renova).
  - 429 com espera curta (até 30 s) é aguardado; com espera longa o comando para com saída 3, mostra a espera e grava o bloqueio, de modo que as chamadas seguintes não tocam a API (o cache continua servindo).
  - `designer`: uma chamada por vez, sem `run.sh` nem segundo plano; para e reporta "extração parcial por limite do Figma"; não para por "nada mudou" quando o `index.json` está `PARCIAL` e retoma do `pending`.
  - `build-landing`: com extração parcial, explica ao usuário o que houve e oferece as saídas (token de conta Dev/Full, esperar, seguir com o que existe).

### Adicionado

- `figma-map.mjs prefetch` (baixa nós em lote e em pedaços, com `--sections`, `--max-requests`, `--batch` e `--dry-run`) e `figma-map.mjs status` (offline: bloqueio, requisições recentes e cache).
- Variáveis `FIGMA_MIN_INTERVAL_MS` (padrão 1000) e `FIGMA_MAX_WAIT_SEC` (padrão 30). Registro das requisições em `raw/api-calls.log` (nunca o token).

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
