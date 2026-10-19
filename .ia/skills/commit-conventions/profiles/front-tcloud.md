# Perfil: front-tcloud (tcloud-dev/front-tcloud)

Front-end do T-Cloud. Use junto com a skill `commit-conventions`.

- Remoto: https://github.com/tcloud-dev/front-tcloud (URL de PR: `.../pull/new/<branch>`)
- Branch de producao: **`master`** (neste repositorio ela faz o papel da `main` do `git-flow.md`)
- Homologacao: `env/hmg`
- Desenvolvimento (testes): `env/dev`
- Protegidos: `master`, `env/hmg`, `env/dev`
- Onde o `git-flow.md` diz `main`, leia `master`: o branch de trabalho sai da `master`, o merge final e de `env/hmg` em `master`, e a `branch-cleanup` confere o merge em `origin/master`.
