---
name: pr-summary
description: Gera o resumo em markdown de um pull request a partir dos commits do branch atual. Use depois de commitar, quando o usuario pedir o resumo, a descricao ou o texto do PR.
---

# pr-summary

Somente leitura: nao altera o repositorio. Idioma: portugues (BR).

## Coleta

Descubra a branch base (perfil do repositorio em `.ia/skills/commit-conventions/profiles/`, senao `main`) e rode:

- `git log --oneline <base>..HEAD`
- `git diff <base>..HEAD --stat`
- `git diff <base>..HEAD --shortstat`

Leia o diff quando precisar descrever o que mudou. Se houver chave do Jira no branch ou nos commits (`[A-Z]+-\d+`), cite-a.

## Saida

Apresente o resumo dentro de **um unico bloco de codigo com quatro crases** (para nao quebrar com blocos internos), pronto para copiar:

````markdown
# <Titulo descritivo> (<CHAVE-JIRA>)

## Resumo
<2-3 linhas sobre o que foi feito>

## Objetivo
<1 paragrafo>

## Mudancas
- **Novos:** `<caminho>`: <descricao>
- **Modificados:** `<caminho>`: <descricao>
- **Removidos:** `<caminho>`: <motivo>

## Testes
- [ ] <comando de build/teste do perfil, se houver>
- [ ] Verificacao manual: <o que checar>

## Estatisticas
<N> commits, <N> arquivos, +<N> / -<N> linhas

## Commits
- `<hash>` <mensagem>

**Branch:** `<branch>` -> `<base>`
**PR:** <URL do perfil, se houver>
````

Nao marque itens de teste como feitos se nao foram executados.
