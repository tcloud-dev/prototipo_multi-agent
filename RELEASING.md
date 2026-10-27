# Release do plugin multi-agent

Decisões (2026-10-27): uma release a cada merge na `main`; os repositórios que usam o plugin seguem uma **tag**, não a `main`.

## Fluxo

1. O trabalho segue o fluxo de branches de `.ia/skills/commit-conventions/git-flow.md` (`feat/**` ou `fix/**` -> `env/dev` -> `env/hmg` -> `main`).
2. A cada merge na `main`, faça uma release:
   1. Em um branch `docs/release-X.Y.Z`, suba `version` em `.ia/.claude-plugin/plugin.json` e acrescente a entrada em `CHANGELOG.md`.
   2. A PR da release segue o mesmo fluxo até a `main`.
   3. No commit da release na `main`, crie a tag `vX.Y.Z` e o GitHub Release com as notas do CHANGELOG.
3. Os repositórios consumidores instalam uma tag: `/plugin marketplace add tcloud-dev/prototipo_multi-agent#vX.Y.Z`. Para atualizar, trocam a tag.

## Versão (semver)

- **patch** (`0.1.1`): `fix`, `docs`, `refactor`.
- **minor** (`0.2.0`): `feat` compatível.
- **major** (`1.0.0`): muda o que o repositório consumidor precisa fazer (renomear agente ou skill, mudar variável ou configuração).
- Enquanto estiver em `0.x`, mudanças que quebram sobem o minor.

## Workflow a criar (ainda não criado)

Arquivo `.github/workflows/release-check.yml`, a ser criado quando decidirmos. Objetivo: ao subir uma tag `v*`, garantir que ela é coerente.

```yaml
name: release-check
on:
  push:
    tags: ['v*']
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - name: Tag igual à versão do plugin.json
        run: |
          v=$(node -p "require('./.ia/.claude-plugin/plugin.json').version")
          test "v$v" = "${GITHUB_REF_NAME}" || { echo "tag ${GITHUB_REF_NAME} != plugin.json $v"; exit 1; }
      - name: Testes dos scripts
        run: node --test .ia/scripts/figma/lib/*.test.mjs
      - name: Tag está na main
        run: |
          git fetch origin main
          git merge-base --is-ancestor "$GITHUB_SHA" origin/main
```

Pontos em aberto: validar o plugin no CI (`claude plugin validate`) exige o CLI instalado; criar o GitHub Release automaticamente a partir do CHANGELOG; trocar os testes quando os scripts migrarem para Python.
