---
name: html5
description: Padrões de HTML5 para landing pages - semântica, landmarks, hierarquia de títulos, formulários, mídia, head com SEO e Open Graph, acessibilidade (ARIA só quando necessário) e consulta à documentação oficial. Use ao escrever ou revisar qualquer marcação HTML da landing page.
---

# html5

Complementa a skill `landing-page` (estrutura e contrato com o QA). Marcação vive em `src/app/index.html`. Neutra de fornecedor.

## Semântica

- Landmarks: um `header`, um `main`, um `footer`; `nav` com `aria-label` quando houver mais de um. Cada `<section>` tem um título (`aria-labelledby` apontando para ele); sem título, use `div`.
- Um único `<h1>`; títulos em ordem, sem pular nível por causa de tamanho (tamanho é do CSS).
- Elemento certo para a ação: `a[href]` navega, `button` age (`type="button"` fora de formulário), `ul/ol` para listas, `figure/figcaption`, `blockquote` com `cite`, `time[datetime]`, `address`. Nada de `div` clicável.
- `<html lang="…">` do brief; `<meta charset>` e `<meta name="viewport" content="width=device-width, initial-scale=1">` primeiro no `<head>`.

## Head (SEO e compartilhamento)

`<title>` único e descritivo; `meta description` (140 a 160 caracteres); `link rel="canonical"` quando houver URL final; Open Graph (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`) e `twitter:card`; `link rel="icon"`; `meta name="theme-color"` se o design definir. Fontes: `link rel="preload" as="font" type="font/woff2" crossorigin` só da fonte crítica.

## Imagem, vídeo e mídia

- `<img>` com `alt` (vazio e sem `role` se decorativa), `width` e `height` reais, `loading="lazy"` fora da primeira dobra, `decoding="async"`; herói com `fetchpriority="high"` e sem `lazy`.
- Responsiva: `srcset` + `sizes` ou `<picture>` com `<source type="image/avif|webp">` e `<img>` de reserva.
- `<video>`: `poster`, `preload="none"` (ou `metadata`), `playsinline`; autoplay só com `muted loop` e sem informação essencial; legendas (`<track>`) se houver fala.
- SVG inline só quando precisar estilizar por CSS; senão `<img>`. Ícone decorativo `aria-hidden="true"`.

## Formulários

`label` associado (`for`/`id`) em todo campo, nunca só `placeholder`; `type` e `autocomplete` corretos (`email`, `tel`, `name`...); `required` e mensagens de erro ligadas por `aria-describedby`; agrupar com `fieldset`/`legend`; botão `type="submit"` com texto de ação. A ação do formulário (`action`, endpoint) vem do brief; sem ela, não invente.

## Acessibilidade

- Primeira regra de ARIA: não use ARIA se existe elemento nativo. Quando precisar: `aria-expanded` + `aria-controls` em disclosure/menu, `aria-current="page"` na navegação, `aria-live="polite"` em mensagem dinâmica.
- Ordem do DOM = ordem de leitura e de foco. Link "pular para o conteúdo" no início quando houver cabeçalho longo. Foco visível (CSS) e alvo de toque ≥ 24px.
- Texto de link descritivo ("Ver planos", não "clique aqui"). Idioma de trechos em outra língua com `lang`.

## O que não fazer

`<br>` para espaçamento, `<center>`/`<font>`, atributo de estilo (`style=`), handler inline (`onclick=`), `id` duplicado, tabela para layout, `<div>` no lugar de `button`/`a`, texto dentro de imagem.

## Consulta à documentação oficial

Dúvida de elemento, atributo ou suporte: `node ${CLAUDE_PLUGIN_ROOT}/scripts/docs/docs.mjs search "<termos>" --area html` (ou `--area accessibility` para ARIA) e depois `docs.mjs show <slug> --section Syntax`. Sem cache, rode `docs.mjs sync` uma vez (cerca de 1 minuto; fica em `~/.cache/multi-agent/docs`, fora do repositório). A linha `compat:` do `show` indica a chave de suporte por navegador; a página completa está em developer.mozilla.org (use `WebFetch`). Antes de usar um recurso novo, confirme que é "Baseline" (disponível nos navegadores atuais).
