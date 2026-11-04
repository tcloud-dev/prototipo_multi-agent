# Guia de SCSS da landing page

Proposta inicial para a equipe revisar; ajuste aqui, não em cada projeto. Usa o **Dart Sass** (pacote `sass`) com o sistema de módulos: `@use`/`@forward`, **nunca `@import`** (depreciado).

## Estrutura (`src/app/scss/`)

```text
main.scss                  só @use, na ordem de cascata (base → layout → seções); compila para css/main.css
abstracts/
  _breakpoints.scss        mapa de breakpoints + mixin up()/down()
  _functions.scss          funções puras (rem(), etc.)
  _mixins.scss             mixins reutilizáveis (visually-hidden, focus-ring...)
base/
  _tokens.scss             :root com TODAS as custom properties; tema escuro
  _reset.scss              reset mínimo
  _typography.scss         @font-face (fonte self-hosted) e estilos de texto base
  _utilities.scss          .container, .sr-only
sections/
  _hero.scss               um parcial por seção da página; bloco BEM = nome do arquivo
  _pricing.scss
```

Só `main.scss` (sem `_`) vira arquivo de saída. Outros pontos de entrada (ex.: `print.scss`) viram `css/print.css` e precisam do `<link>` correspondente. A pasta `scss/` não vai para o `dist`.

## `main.scss`

```scss
@use 'base/tokens';
@use 'base/reset';
@use 'base/typography';
@use 'base/utilities';
@use 'sections/hero';
@use 'sections/pricing';
```

Parcial que precisa de breakpoint ou mixin faz o seu próprio `@use`:

```scss
// sections/_hero.scss
@use '../abstracts/breakpoints' as bp;

.hero {
  padding-block: var(--space-8);
  background: var(--color-surface);

  &__title {
    font-size: var(--font-size-xl);

    @include bp.up(md) { font-size: var(--font-size-2xl); }
  }

  &--dark { background: var(--color-surface-inverse); }
}
```

## Breakpoints

```scss
// abstracts/_breakpoints.scss  (valores = larguras das variantes do design)
@use 'sass:map';

$breakpoints: (sm: 480px, md: 768px, lg: 1200px) !default;

@mixin up($name) {
  @media (min-width: map.get($breakpoints, $name)) { @content; }
}
```

## Regras

- `@use`, não `@import`. Cada parcial declara o que usa; nada de variável global implícita. Funções internas pelos módulos (`@use 'sass:map'` → `map.get`, `sass:math` → `math.div`), nunca as globais (`map-get`, `/`), depreciadas no Dart Sass 3.
- **Tokens são CSS custom properties** em `base/_tokens.scss` (cor, espaçamento, tipografia, raio, sombra, tema escuro). Variável Sass (`$x`) só para breakpoints, escalas e cálculos de compilação.
- Um parcial por seção, nome em minúsculas com hífen, prefixo `_`. Bloco BEM = nome (`_pricing-table.scss` → `.pricing-table`).
- Aninhamento máximo de 3 níveis. `&__elemento` e `&--modificador` sim; `.a .b` por aninhamento, não. `&:hover` e pseudo-elementos sim.
- Sem `@extend`, sem `!important`, sem seletor de tag/`id` para estilo, sem cálculo de cor em valor literal (use token ou `color-mix()`).
- Sem matemática que o CSS faz sozinho: prefira `calc()`/`clamp()` com tokens a funções Sass.
- Comentários `//` não vão para o CSS; use `/* … */` só para o que deve sobreviver (e o build minifica de qualquer forma).
- Mixin só quando o bloco se repete em 3+ lugares; senão, escreva o CSS.

## Compilação

```json
"sass": "sass src/app/scss/main.scss src/app/css/main.css --no-source-map --quiet-deps",
"sass:watch": "npm run sass -- --watch"
```

`src/app/css/` é **gerado e fica no `.gitignore`**; o `scripts/build.mjs` compila os `.scss` por conta própria (não depende do `css/` local), então o deploy no GitHub Actions só precisa de `npm ci && npm run build`.

## Lint (opcional, recomendado)

`stylelint` com `stylelint-config-standard-scss`: acrescente quando a equipe quiser reforçar BEM, ordem e aninhamento automaticamente.
