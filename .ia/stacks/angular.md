# Stack `angular` (reservada)

**Ainda não suportada** pelo plugin: não há skill de programação Angular, e o QA visual de hoje serve arquivos estáticos. O valor `angular` já é aceito em `multiAgent.stack` para o `setup` detectar e registrar a escolha, e os agentes pararem com uma mensagem clara em vez de gerar HTML puro num projeto Angular.

## Como o `setup` trata

- Detecta por `angular.json` ou `@angular/core` no `package.json` e lê a versão principal.
- Projeto novo: **não monta o `package.json`**. Sugere o comando do Angular CLI na versão escolhida pelo usuário (por exemplo `npx -p @angular/cli@<versão> ng new <nome>`), porque o CLI sabe gerar o projeto certo.
- Grava `"multiAgent": { "stack": "angular", "src": "src", "out": "dist/<projeto>/browser" }` só depois do "sim" (os caminhos reais dependem do `angular.json`).

## Para suportar de verdade (planejado)

1. Skill `angular-v<versão>` com as convenções da versão e carregada pelo `programmer` conforme `stack` e `angularVersion` (campo de `ma-config.mjs`).
2. QA sobre a saída do build ou servidor de desenvolvimento, em vez de arquivos estáticos de `src`.
3. Atenção: o Angular usa `src/app/` para os componentes, e o `vanilla` usa `src/app/` como raiz do site. Por isso `src` e `out` são configuráveis.
