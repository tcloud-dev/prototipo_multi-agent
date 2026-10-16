# Modelos de descrição por tipo

Ofereça o modelo do tipo e preencha **só com o que o usuário informou**. Seção sem conteúdo fica como `A definir`. Escreva em markdown.

## Épico

```markdown
## Objetivo
<o que se quer alcançar e por quê>

## Entrega esperada
<resultado concreto ao final do épico>

## Escopo
- Dentro: ...
- Fora: ...
```

## História

```markdown
## Contexto
<quem precisa e por quê>

## Descrição
Como <perfil>, quero <ação>, para <benefício>.

## Critérios de aceite
- [ ] ...
- [ ] ...
```

## Tarefa

```markdown
## O que fazer
<atividade pontual>

## Resultado esperado
<como saber que acabou>

## Referências
<história, épico, links>
```

## Subtarefa

```markdown
## O que fazer
<passo curto da tarefa ou história pai>
```

## Bug

```markdown
## Comportamento atual
...

## Comportamento esperado
...

## Passos para reproduzir
1. ...

## Ambiente
<produção, homologação, versão, navegador>
```

## Melhoria, Spike, Débito Técnico, Suporte, Incidente

Use o modelo da Tarefa, trocando o título da primeira seção: Melhoria ("O que melhorar"), Spike ("Pergunta a responder" e "Formato da entrega"), Débito Técnico ("Problema técnico e risco"), Suporte ("Equipe apoiada e demanda"), Incidente (normalmente originado pela ferramenta de ITSM; confirme antes de criar à mão).
