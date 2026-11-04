---
name: qa-visual
description: Conduz o ciclo de QA visual da landing page em src/app/ - captura o render, compara com o Figma, mostra os achados ao usuário e aplica os ajustes aprovados pelo programmer, repetindo só nas seções alteradas. Use quando pedirem para conferir o visual, comparar com o Figma ou ajustar o layout de uma landing já programada.
argument-hint: <fileKey> [variante] [secoes]
---

# /qa-visual `<fileKey>` `[variante]` `[secoes]`

Orquestrador do laço **olhar → decidir → ajustar → repetir**, rodando na sessão principal (subagente não fala com o usuário). O `qa-visual` analisa, o **usuário decide**, o `programmer` aplica, o `designer` entra só se faltar dado do Figma. Você repassa perguntas e respostas.

Variante padrão: `desktop-light` (economia de tokens). `dark`, `mobile` e `tablet` entram quando o usuário pedir.

## Pré-condições

1. `src/app/index.html` existe e as seções têm `data-figma-node` (e `data-figma-<variante>` para a variante pedida). Senão, volte ao `/build-landing`.
2. `figma-data/<fileKey>/` tem as medidas da variante. Faltando, acione o `designer` para extraí-las. Sem referência, não prossiga.
3. Token do Figma disponível sem lê-lo: `test -f ~/.config/figma/.env || test -n "$FIGMA_TOKEN"`.
4. `playwright` e `sharp` instalados no repositório (skill `setup`) e um Chrome/Edge (ou `npx playwright install chromium`).
5. CSS compilado atualizado: `npm run sass` (o QA lê o `css/` gerado, não o SCSS). Depois de cada rodada de ajustes do `programmer`, compile de novo antes da reanálise.

## Laço (no máximo 3 rodadas; depois pare e reporte o que resta, e só continue com pedido explícito do dono; ajuste aprovado que cause efeito colateral visível volta como item novo)

1. **Analisar:** agente `multi-agent:qa-visual` (fileKey, variante, seções). Grava `reports/qa/<id>/report.md` (preservando a rodada anterior em `<id>-rodada-N`), classificando cada item como **automática**, **depende do usuário** ou **ignorada**.
2. **Corrigir o automático, sem perguntar:** entregue os itens automáticos ao `multi-agent:programmer` em **modo ajustes** (no máximo 5 por rodada).
3. **Reanalisar só o que mudou:** `qa-visual` apenas nas seções alteradas (`--sections`). Surgiu item automático novo: volte ao passo 2.
4. **Portão do usuário (uma vez, no fim do laço automático):** apresente só o que **depende dele**, agrupado, com a sua recomendação em cada item e no máximo ~7 decisões por vez, mais o que foi corrigido sozinho e o que foi ignorado (uma linha cada, para ele contestar ou pedir para desfazer).
   - **O usuário só decide bem o que vê.** Com a ferramenta `Artifact`, publique uma página privada com o lado a lado de cada seção (Figma à esquerda, site à direita), os achados e as decisões como opções (capacidade `db`, coleção `decisions`, um documento por decisão com `choice` e `note`); as respostas voltam por `ArtifactData`. Cada rodada atualiza a mesma página. Sem a ferramenta, mostre no terminal os caminhos dos `<secao>-lado-a-lado.png` e pergunte item a item.
   - Quando ele disser que respondeu, **leia as respostas** (não suponha) e confira os horários.
   - **Cada decisão vira registro:** peça ao `designer` para acrescentá-la em "Decisões e divergências intencionais" de `figma-data/<fileKey>/design-system.md`.
5. **Conferir conflito entre decisões ANTES de aplicar** (trabalho seu, não do `programmer`): duas respostas podem puxar em sentidos opostos na mesma área (ex.: "brilho do hero como o Figma" + "gradiente escuro sob o texto" → o gradiente vence e o brilho some). Ao detectar, **não aplique**: devolva ao usuário com o efeito previsto e uma proposta (prioridade sugerida: acessibilidade, depois a decisão explícita mais recente, depois a fidelidade ao Figma; e o mínimo de cada efeito que satisfaz os dois).
6. **Aplicar as decisões:** se exigirem dado do Figma que o documento não tem (rotação, blend, filtro, trecho de texto estilizado, posição exata), o `designer` mede antes (`figma-map.mjs fx`/`layout`); o `programmer` não consulta o Figma nem adivinha. Depois, `programmer` em modo ajustes com a lista aprovada; volte ao passo 3. Decisão que conflita com contraste WCAG: o contraste vence e o `programmer` registra o motivo.
7. **Fechar:** sem item aberto, relate o resultado. Qualquer mudança de código depois disso exige nova rodada de `qa-visual` nas seções tocadas antes do build.

## Regras

- A correção automática vale **só** para o que a regra do agente `qa-visual` permite. Tudo o mais espera o usuário. Como nada é commitado, qualquer correção pode ser desfeita pelo git.
- O `programmer` é o único que edita `src/app/`; o `qa-visual` só lê e reporta; ninguém faz `git commit`/`git push`.
- Conteúdo placeholder: diferença de altura ou de tamanho de texto não é defeito por si só.
- Custo: imagens consomem tokens. Comece por uma variante e poucas seções; avise o usuário antes de abrir dark e mobile.

## Relatório final

Rodadas feitas, itens corrigidos, divergências intencionais registradas e o que ficou pendente.
