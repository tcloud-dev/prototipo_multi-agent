---
name: css3
description: Padrões de CSS3 moderno escrito em SCSS (Sass) para a landing page - tokens como custom properties, BEM aninhado, mobile-first, Grid/Flexbox, tema escuro, movimento reduzido, e o guia de estrutura SCSS da equipe. O build compila para CSS puro minificado. Use ao escrever ou revisar estilos da landing page.
---

# css3 (em SCSS)

Escrevemos **SCSS** em `src/app/scss/`; o `sass` compila para `src/app/css/main.css` (gerado, fora do git) e o build entrega CSS3 puro e minificado em `dist/app/css/`. Estrutura de pastas, `@use`, mixins e convenções de Sass: **`scss-guide.md`** (nesta pasta). Leia-o ao criar a base ou uma seção nova. Complementa `landing-page` e `html5`.

## Fluxo de trabalho

1. Edite os `.scss`. 2. `npm run sass` (ou `npm run sass:watch`) gera o `css/main.css`. 3. Só então o QA e o navegador enxergam a mudança: **o QA lê o `css/` compilado**, nunca o `.scss`. CSS compilado desatualizado é a primeira causa de "ajustei e nada mudou".

## Regras

- **Tokens em custom properties** (`:root { --color-primary: … }`), não em variáveis Sass: o tema escuro e qualquer ajuste em tempo de execução dependem disso. Variáveis e mapas Sass só para o que existe em tempo de compilação (breakpoints, escalas, funções).
- **BEM** com bloco = nome do parcial da seção (`_hero.scss` → `.hero`), elementos com `&__`, modificadores com `&--`. Aninhamento no máximo 3 níveis; nunca aninhar para criar descendente (`.hero .title`). Sem seletor de tag nem de `id` para estilo, sem `!important`, sem `@extend`.
- **Mobile-first:** estilo base para a menor largura e `@include bp.up(md)` para crescer. Os breakpoints vêm das larguras das variantes do design e vivem num só lugar (`abstracts/_breakpoints.scss`).
- **Layout** com Grid e Flexbox; `gap` em vez de margens entre irmãos; `min-width: 0` em filho de grid/flex com texto longo; `aspect-ratio`, `clamp()` para tipografia e espaçamento fluidos quando o design for fluido; propriedades lógicas (`margin-inline`, `padding-block`) preferidas.
- **Imagens:** `max-width: 100%; height: auto`; `object-fit` explícito quando a proporção do contêiner difere da imagem; nunca esticar.
- **Tema escuro:** só troca valores dos tokens (`[data-theme="dark"]` e/ou `@media (prefers-color-scheme: dark)`); o componente não conhece o tema.
- **Movimento e foco:** animação só de `transform`/`opacity`; todo `transition`/`animation` respeita `@media (prefers-reduced-motion: reduce)`; foco visível nunca removido (`:focus-visible`).
- **Recursos modernos** (container queries, `:has()`, `color-mix()`, `@layer`, `subgrid`): permitidos quando forem Baseline. Confirme em `docs.mjs show` (linha `compat:`) e deixe uma alternativa segura quando o recurso for só "newly available".
- **Valores:** sem hex, sem `px` solto fora de borda/sombra pontual: use token. Valor que o design usa e o token não tem: acrescente o token (e avise o `designer`), não cole o número.

## Consulta à documentação oficial

`node ${CLAUDE_PLUGIN_ROOT}/scripts/docs/docs.mjs search "<termos>" --area css` (ou `--area sass`) e depois `show <slug> --section Syntax`. Sem cache: `docs.mjs sync` uma vez. Suporte por navegador: linha `compat:` e developer.mozilla.org via `WebFetch`; Sass: sass-lang.com.
