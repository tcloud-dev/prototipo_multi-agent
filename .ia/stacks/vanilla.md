# Stack `vanilla` (HTML5, SCSS e JavaScript ES2022 puros)

Perfil de **sugestão**: a skill `setup` mostra este conteúdo e só aplica o que o usuário aceitar. O plugin não exige nenhuma destas ferramentas; o contrato é só o script `build` do `package.json` (e `sass`, se o projeto usa SCSS) mais a chave `multiAgent`.

## Configuração (chave `multiAgent` do `package.json`)

```json
{
  "multiAgent": { "stack": "vanilla", "src": "src/app", "out": "dist/app" }
}
```

Sem `package.json`, o mesmo objeto vai em `multi-agent.config.json` na raiz. `src` e `out` são opcionais (padrões acima).

## Scripts sugeridos

```json
{
  "scripts": {
    "sass": "sass src/app/scss/main.scss src/app/css/main.css --no-source-map --quiet-deps",
    "sass:watch": "npm run sass -- --watch",
    "build": "node scripts/build.mjs"
  }
}
```

`sass` só se o projeto escreve SCSS (o `programmer` escreve). `build` é o script que o deploy roda (`npm ci && npm run build`) e deve sair com código diferente de 0 se falhar.

## Bibliotecas sugeridas (devDependencies)

| Para quê | Pacote | Observação |
|---|---|---|
| SCSS → CSS | `sass` | Dart Sass |
| Minificar CSS e JS | `esbuild` | por arquivo, sem empacotar |
| Minificar HTML | `html-minifier-terser` | |
| Recomprimir imagens | `sharp` | mantém o formato; limita a largura |
| Otimizar SVG | `svgo` | |
| Comprimir vídeo | `ffmpeg-static` | `sharp` não processa vídeo |
| QA visual do plugin | `playwright`, `sharp` | só para o QA (`qa-visual`), não para o build |

Cada projeto decide: pode trocar, tirar ou somar ferramentas. O `build` é dele.

## Ponto de partida do build

`${CLAUDE_PLUGIN_ROOT}/templates/build/build.mjs` cumpre o contrato com as ferramentas da tabela e confere referências quebradas. É uma **cópia opcional** para `scripts/build.mjs`: depois de copiada, é código do repositório. Para o deploy, veja `${CLAUDE_PLUGIN_ROOT}/templates/github-actions/deploy-example.yml`.

## Notas de ambiente

- Atrás do proxy da TOTVS, o `npm i` pede `NODE_USE_SYSTEM_CA=1`.
- Com npm 12, scripts de instalação vêm bloqueados: se o build reclamar de `esbuild` ou `ffmpeg-static`, rode `npm approve-scripts esbuild ffmpeg-static`.
- Estrutura do código e contrato com o QA: skill `landing-page`.
