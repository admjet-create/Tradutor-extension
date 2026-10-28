# AGENTS.md

Extensão do Chrome (Manifest V3, JavaScript puro, sem build) que traduz o Slack entre inglês e português usando a API da Anthropic. Escopo e critérios de aceite em [PRODUCT.md](PRODUCT.md).

## Comandos

- Checar sintaxe: `for f in extension/*.js; do node --check "$f"; done`
- Teste de fumaça (Chromium + Slack simulado + API simulada): `node tests/smoke.test.cjs` (precisa do pacote `playwright` e do Chromium instalados)
- Rodar de verdade: carregar a pasta `extension/` em `chrome://extensions` no modo do desenvolvedor.

## Arquitetura

- `extension/manifest.json`: permissões mínimas (`storage` e `api.anthropic.com`); content script só em `app.slack.com`.
- `extension/settings.js`: prompt base do Rafael, glossário padrão, modelo padrão e leitura das configurações. Fonte única desses valores.
- `extension/background.js`: service worker. Recebe `{type: "translate", text, target: "pt" | "en"}`, chama `POST /v1/messages` com `fetch`, mantém cache e fila (máx. 3 em paralelo; o rascunho tem prioridade).
- `extension/content.js` + `content.css`: detecta mensagens novas com `MutationObserver`, faz uma detecção simples de idioma, mostra traduções e o painel de envio.
- `extension/options.html` + `options.js`: página de opções.

## Regras

- Interface e textos para o usuário em português do Brasil.
- Não mande a chave de API para nenhum lugar além de `api.anthropic.com`, e não grave em `chrome.storage.sync`.
- O prompt base em `settings.js` é o texto do Rafael; não reescreva sem pedido dele.
- Mantenha o projeto sem etapa de build enquanto for possível. Arquivos com no máximo ~350 linhas.
- Ao mudar seletores do Slack, comportamento ou opções, atualize README.md e PRODUCT.md e rode o teste de fumaça.
- Revise o diff antes de entregar: chamadas à API, tratamento de erros e o que acontece sem chave configurada.
