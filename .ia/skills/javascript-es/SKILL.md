---
name: javascript-es
description: Padrões de JavaScript moderno (ES2022, módulos nativos, sem framework) para a landing page - estrutura de módulos, DOM e eventos, melhoria progressiva, acessibilidade de componentes interativos, desempenho e consulta à documentação oficial. Use ao escrever ou revisar JavaScript da landing page.
---

# javascript-es

JavaScript do navegador em `src/app/js/`, **sem framework nem biblioteca**. Alvo: **ES2022** (o build usa esbuild com `target: es2022`). Complementa `landing-page` e `html5`.

## Estrutura

- `index.html` carrega **um** ponto de entrada: `<script type="module" src="js/main.js"></script>` (módulos já são adiados). `main.js` só importa e chama `init()` de cada módulo.
- Um módulo por comportamento (`menu.js`, `accordion.js`, `form.js`), exportando `init()`. Sem estado global, sem `window.x =`, sem `var`, sem handler inline.
- Importações com caminho relativo e extensão (`import { init } from './menu.js'`). Sem `import` dinâmico a menos que o módulo seja pesado e raro (ex.: um vídeo player), e então `await import()` na interação.

## Linguagem

- `const` por padrão, `let` quando reatribui. Funções pequenas e puras onde der; `async/await` com `try/catch` e `AbortController` em `fetch`.
- Recursos permitidos: encadeamento opcional `?.`, coalescência `??`, `Array.prototype.at()/flatMap()/toSorted()` (confira suporte), `structuredClone`, `Object.hasOwn`, campos privados `#x`, `replaceAll`. Sem polyfill e sem transpilar para ES5.
- Sem `eval`, `document.write`, `innerHTML` com dado que não seja seu (use `textContent` ou `createElement`); nada de `==`.

## DOM e eventos

- Selecione por **atributo de comportamento** (`data-js="menu"`, `[data-js="menu-toggle"]`), não por classe de estilo: o BEM do CSS pode mudar sem quebrar o JS.
- Delegação de eventos no contêiner quando houver muitos filhos; `addEventListener` com `{ passive: true }` em `scroll`/`touch`. Remova listeners de componentes que saem da tela.
- Observação de rolagem/visibilidade com `IntersectionObserver` (animação de entrada, lazy), nunca com `scroll` + `getBoundingClientRect` em laço. `ResizeObserver` para tamanho de elemento.
- Movimento: respeite `matchMedia('(prefers-reduced-motion: reduce)')`; animação por classe/atributo e CSS, não por estilo inline.

## Melhoria progressiva e acessibilidade

- A página tem de funcionar sem JS: o conteúdo está no HTML; o JS só melhora (menu, accordion, carrossel).
- Estado em atributos acessíveis: `aria-expanded`, `aria-controls`, `hidden`, `aria-current`. Menu e accordion: botão nativo, **Enter/Espaço**, **Esc** fecha e devolve o foco ao botão, foco preso só em modal (de preferência `<dialog>`).
- Nada de `setInterval` que muda conteúdo sem controle de pausa; carrossel automático precisa de botão de pausa.
- Controle interativo só com ação definida pelo design ou brief.

## Desempenho

- Sem trabalho no carregamento além do necessário: inicialize por `IntersectionObserver` o que está fora da primeira dobra; `requestAnimationFrame` para escrita visual; evite leitura e escrita alternadas de layout.
- Sem biblioteca para o que o navegador faz (`fetch`, `classList`, `closest`, `dialog`, `Intl`, `URL`). Dependência nova só com pedido explícito.

## Consulta à documentação oficial

`node ${CLAUDE_PLUGIN_ROOT}/scripts/docs/docs.mjs search "<termos>" --area javascript` (linguagem) ou `--area api` (APIs Web: fetch, IntersectionObserver, `<dialog>`...), e depois `show <slug> --section Syntax`. Sem cache: `docs.mjs sync` uma vez (cerca de 1 minuto; `~/.cache/multi-agent/docs`, fora do repositório). Suporte por navegador: linha `compat:` e developer.mozilla.org via `WebFetch`.
