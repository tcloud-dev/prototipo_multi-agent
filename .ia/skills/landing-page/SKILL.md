---
name: landing-page
description: Convenções para construir uma landing page estática em HTML5, CSS3 e JavaScript ES6+ puros em src/app/ - estrutura de pastas, anatomia de seção, tokens, BEM, acessibilidade, SEO, desempenho e o contrato data-figma-node que liga cada seção ao Figma para o QA. Use ao criar ou alterar qualquer parte da landing page.
---

# landing-page

Padrão obrigatório para o código em `src/app/`. Neutro de fornecedor: vale para qualquer IA. Idioma do código: inglês; textos da página: o que o brief disser.

## Estrutura

```text
src/app/
  index.html            uma página; <html lang> do brief (ex.: pt-BR)
  css/tokens.css        :root com TODAS as variáveis (cor, espaço, tipografia, raio, sombra); tema escuro em [data-theme="dark"] e/ou @media (prefers-color-scheme)
  css/base.css          reset mínimo, tipografia base, foco visível, .sr-only, container
  css/sections/<secao>.css
  js/main.js            ponto de entrada (type="module"); importa os módulos
  js/<recurso>.js       um módulo por comportamento (menu, accordion, formulário...)
  assets/<categoria>/   copiados de figma-data/<fileKey>/assets/
```

Nada de framework, jQuery, `@import` de CSS nem fonte por URL de terceiros: fonte self-hosted em `assets/fonts/` com `@font-face` e `font-display: swap`. Sem etapa de build para desenvolver: `index.html` abre direto num servidor estático.

## Anatomia de uma seção

```html
<section id="hero" class="hero" data-figma-node="12:34" data-figma-mobile-light="56:78" aria-labelledby="hero-title">
  <div class="hero__inner container">
    <h1 id="hero-title" class="hero__title">...</h1>
  </div>
</section>
```

- **Contrato com o QA:** `id` (nome da seção), `data-figma-node` (nó do Figma da variante `desktop-light`) e `data-figma-<variante>` para as outras (`mobile-light`, `desktop-dark`...). O `qa-visual` só enxerga seções com esse atributo.
- Um `<h1>` por página; títulos sem pular nível; landmarks (`header`, `nav`, `main`, `footer`); `<section>` sempre com título associado.

## CSS

- **BEM**, bloco = nome do arquivo (`hero.css` → `.hero`, `.hero__title`, `.hero--dark`). Seletor de tag ou de `id` para estilo: não.
- Só tokens (`var(--space-4)`): sem hex, sem `px` solto fora de borda/sombra pontual, sem `!important`.
- **Mobile-first**: base para a menor largura, `@media (min-width: …)` para crescer. Breakpoints vêm das larguras das variantes do design e ficam listados num comentário no topo de `tokens.css` (variável CSS não funciona em media query).
- Layout com Flexbox/Grid; `min-width: 0` em filho de grid/flex que contém texto longo; imagens `max-width: 100%; height: auto`; `object-fit` explícito quando a proporção do contêiner difere da imagem.
- Respeite `@media (prefers-reduced-motion: reduce)` em toda animação; foco visível nunca removido.

## JavaScript (ES6+)

- Módulos (`<script type="module" src="js/main.js">`, já adiado por padrão), `const`/`let`, funções pequenas, sem globais, sem `eval`, sem handler inline.
- Selecione por `data-js="menu"` (não por classe de estilo). Cada módulo exporta `init()`; `main.js` só chama os `init()`.
- Melhoria progressiva: sem JS o conteúdo continua legível e navegável. Estado em `aria-expanded`/`hidden`, não em estilo inline.
- Controle interativo só com ação definida (ver regra do agente `programmer`).

## Acessibilidade, SEO e desempenho

- `alt` em toda imagem (vazio e `role="presentation"` se decorativa); `button` para ação, `a` para navegação; alvo de toque ≥ 24px (ideal 44px no mobile); contraste AA (4,5:1 texto; 3:1 grande/UI).
- `<title>`, `<meta name="description">`, `<meta name="viewport">`, Open Graph básico e `<link rel="icon">` no `<head>`.
- Imagem com `width`/`height`; `loading="lazy"` fora da primeira dobra; imagem do herói com `fetchpriority="high"`; vídeo com `preload="none"` e `poster`, `muted playsinline` se autoplay.
- Sem layout shift: reserve o espaço de imagem, vídeo e fonte.

## Fora do escopo desta skill

Minificação, otimização de mídia e deploy são do agente `minifier` e do `scripts/build.mjs` do repositório. Comparação com o Figma é do `qa-visual`.
