---
description: Confere o build de producao do repositorio (roda o npm run build do proprio projeto, interpreta falhas e confere que a saida renderiza igual ao codigo-fonte). Nao minifica nada por conta propria.
---

# build-check (referencia)

Este arquivo e so um ponteiro para o Copilot. A fonte unica esta em `.ia/`.

Antes de qualquer acao, leia e siga integralmente `.ia/agents/build-check.md` (ignore o cabecalho especifico do Claude Code, como `tools` e `model`). A configuracao do repositorio vem de `.ia/scripts/config/ma-config.mjs`; o script de build e do repositorio consumidor.

Atencao: aqui a lista `tools` do agente nao se aplica. Nao edite `src/`, a saida do build nem o script de build, e nunca faca commit.

Nao edite este arquivo para mudar o comportamento; edite o de `.ia/`.
