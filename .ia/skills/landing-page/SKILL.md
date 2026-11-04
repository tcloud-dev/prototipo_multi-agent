---
name: landing-page
description: Estrutura e contrato da landing page estática em HTML5, SCSS e JavaScript ES2022 puros em src/app/ - pastas, anatomia de seção, o contrato data-figma-node que liga cada seção ao Figma para o QA, e quando carregar as skills html5, css3 e javascript-es. Use ao criar ou alterar qualquer parte da landing page.
---

# landing-page

Visão geral e contrato do código em `src/app/` (padrão; o caminho real vem de `node ${CLAUDE_PLUGIN_ROOT}/scripts/config/ma-config.mjs`, campo `src`). O detalhe de cada tecnologia está nas skills **`html5`**, **`css3`** (SCSS, com `scss-guide.md`) e **`javascript-es`**: carregue a que a tarefa pede. Neutra de fornecedor. Idioma do código: inglês; textos da página: o que o brief disser.

## Estrutura

```text
src/app/
  index.html            uma página; <html lang> do brief (ex.: pt-BR); link para css/main.css
  scss/                 FONTE dos estilos (estrutura no scss-guide.md): main.scss, abstracts/, base/, sections/
  css/                  GERADO por `npm run sass` a partir do scss/ (no .gitignore; nunca editar à mão)
  js/main.js            ponto de entrada (type="module"); js/<recurso>.js um módulo por comportamento
  assets/<categoria>/   copiados de figma-data/<fileKey>/assets/ (fonte self-hosted em assets/fonts/)
```

Sem framework, sem jQuery, sem `@import` de CSS e sem fonte por URL de terceiros. Para desenvolver: `npm run sass` (ou `sass:watch`) e um servidor estático em `src/app/`; o QA e o navegador leem o **`css/` compilado**, então ele precisa estar atualizado.

## Anatomia de uma seção

```html
<section id="hero" class="hero" data-figma-node="12:34" data-figma-mobile-light="56:78" aria-labelledby="hero-title">
  <div class="hero__inner container">
    <h1 id="hero-title" class="hero__title">...</h1>
  </div>
</section>
```

- **Contrato com o QA:** `id` (nome da seção), `data-figma-node` (nó do Figma da variante `desktop-light`) e `data-figma-<variante>` para as outras (`mobile-light`, `desktop-dark`...). O `qa-visual` só enxerga seções com esse atributo.
- Cada seção ganha **um parcial SCSS** (`scss/sections/_hero.scss`, bloco `.hero`) e, se houver comportamento, **um módulo** (`js/hero.js`).
- Um `<h1>` por página; `<section>` sempre com título associado (detalhes em `html5`).

## Desempenho e acessibilidade (resumo)

Imagem com `width`/`height`, `loading="lazy"` fora da primeira dobra e herói com `fetchpriority="high"`; vídeo com `preload="none"` e `poster`; sem *layout shift*; contraste AA; alvo de toque ≥ 24px; a página funciona sem JS. Regras completas em `html5`, `css3` e `javascript-es`.

## Fora do escopo desta skill

Minificação, compilação de produção, otimização de mídia e deploy são do **repositório consumidor** (o script `build` do `package.json`, o mesmo que o deploy roda); o agente `build-check` só o executa e confere. O plugin não minifica nada. Comparação com o Figma é do `qa-visual`.
