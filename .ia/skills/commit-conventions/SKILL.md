---
name: commit-conventions
description: Cria commits atomicos e semanticos (Conventional Commits em PT-BR, sem acento) a partir dos arquivos pendentes, agrupando por contexto logico, e faz o push com seguranca. Use quando o usuario pedir para commitar, organizar commits ou fazer commits atomicos.
---

# commit-conventions

Idioma da conversa: portugues (BR). **Mensagens de commit: PT-BR sem acento.**

## Comandos proibidos (trava)

Nunca execute, nem a pedido indireto. Se forem necessarios, **pare**, explique a consequencia, sugira uma alternativa e espere confirmacao explicita do usuario.

- `git rebase` (qualquer forma)
- `git reset` (`--soft`, `--mixed`, `--hard`)
- `git push --force` / `-f` / `--force-with-lease`
- `git restore`, `git checkout -- <arquivo>`, `git clean`
- `git commit --amend`, `git revert`
- `git stash drop`, `git branch -D`
- `--no-verify` em qualquer comando (hooks nao podem ser pulados; se um hook falhar, corrija a causa)
- `git add .`, `git add -A`, `git add -u` (sempre adicione caminhos explicitos)

Comandos livres: `git status`, `git diff`, `git log`, `git branch`, `git add <caminho>`, `git commit`, `git push`, `git push --set-upstream origin <branch>`.

## Fluxo

1. **Estado:** `git status`, `git branch --show-current`, `git log --oneline -5`.
2. **Entender o conteudo:** leia `git diff` (e `git diff --cached`) dos arquivos pendentes. Agrupe pelo que mudou, nao so pelo nome da pasta.
3. **Arquivos sensiveis:** nao adicione `.env*`, `*.pem`, `*.key`, credenciais ou tokens. Avise o usuario e deixe-os de fora.
4. **Agrupar:** um commit = uma mudanca logica, independente e revertivel. Separe adicoes, modificacoes e remocoes. Nao misture tipos (ex.: `docs` + `refactor`). Se o repositorio tiver perfil em `profiles/<repo>.md`, use o mapa de pastas e a ordem dele.
5. **Commitar:** para cada grupo, `git add <caminhos>` e `git commit`. Repita ate nao sobrar nada.
6. **Verificar:** `git status` (deve estar limpo) e `git log --oneline -<N>`.
7. **Push** (ver abaixo).
8. **Fechar:** liste os commits criados e ofereca o resumo de PR (skill `pr-summary`).

## Mensagem

```
<tipo>(<CHAVE>): <descricao curta, imperativo, sem acento>
```

- `<CHAVE>` e a chave do Jira (`TCI-253`), extraida do nome do branch (regex `[A-Z]+-\d+`) ou informada pelo usuario. Sem chave, omita o parenteses: `<tipo>: <descricao>`.
- Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `build`.
- Se a mudanca precisar de explicacao, adicione um corpo separado por linha em branco.
- Exemplos: `feat(TCI-253): adicionar validacao de dispositivo movel`, `docs: atualizar guia de campos obrigatorios`, `chore: remover arquivos antigos`.

## Push e upstream

- Branch de feature (qualquer um que **nao** seja `main`, `master` ou `develop`): faca `git push` direto, sem perguntar.
- Se falhar com "no upstream branch": `git push --set-upstream origin <branch>`.
- **Branch protegido (`main`, `master`, `develop`):** nao commite nem faca push sem confirmacao explicita. Sugira criar um branch de feature antes.

## Terminal

Detecte o shell pelo ambiente. PowerShell: encadeie com `;`, nunca `&&`. Git Bash: use `&&`.

## Comunicacao

Mostre o progresso em uma linha por etapa e, no fim, a lista de commits. Nao pergunte "posso commitar?" nem "posso fazer push?" em branch de feature: o pedido do usuario ja autoriza.
