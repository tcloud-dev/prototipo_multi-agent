# Perfil: front-assets (TCloud-Design/front-assets)

Repositorio de templates de e-mail marketing da TCloud. Use junto com a skill `commit-conventions`.

- Remoto: https://github.com/tcloud-dev/front-assets (URL de PR: `.../pull/new/<branch>`)
- Branch base: `main`
- Build: `npm run build` (npm, TypeScript, GitHub Actions)
- Idiomas dos templates: PT-BR (padrao), EN-US, ES-ES
- Convencao de branches: `feat/*`, `refactor/*`, `docs/*`, `fix/*`

## Ordem sugerida dos commits

1. Scripts novos (`scripts/*.js|ts`) -> `feat`
2. Documentacao nova ou atualizada (`docs/**/*.md`) -> `docs`
3. Remocoes (`**/old/*`, arquivos deprecated) -> `chore`
4. Agentes e skills (`.ia/`, `.github/`) -> `docs`
5. Templates por componente, um commit por pasta -> `refactor` (ou `feat` se novo):
   - `src/template/00-body`, `01-header`, `03-content`, `04-promo`, `05-footer`
6. Testes (`src/mailing/test/*.html`) -> `test`
7. Templates por idioma (`src/mailing/<categoria>/`, `en-US/`, `es-ES/`) -> `feat`; renomeacoes (ex.: sufixo `_en-US`) -> `refactor`
8. Build e configuracao (`package.json`, `tsconfig.json`, workflows) -> `build`
