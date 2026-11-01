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
- `extension/content.js` + `content.css`: detecção simples de idioma, conversa com o service worker e tradução das mensagens recebidas (`MutationObserver`). Expõe o que é compartilhado em `globalThis.TPS`.
- `extension/composer.js`: painel acima da caixa de mensagem. Só substitui o texto se a tradução for da versão atual do rascunho (senão traduz de novo e insere quando chegar), oferece Desfazer e oferece Restaurar quando o texto some sem `input` nem envio. Menções, emojis e outros blocos `contenteditable="false"` viram marcadores `⟦1⟧` na tradução e nunca são apagados: só o texto entre eles é reescrito (`replaceSegments`).
- `extension/options.html` + `options.js`: página de opções.

## Regras

- Interface e textos para o usuário em português do Brasil.
- Não mande a chave de API para nenhum lugar além de `api.anthropic.com`, e não grave em `chrome.storage.sync`.
- O prompt base em `settings.js` é o texto do Rafael; não reescreva sem pedido dele.
- Mantenha o projeto sem etapa de build enquanto for possível. Arquivos com no máximo ~350 linhas.
- Ao mudar seletores do Slack, comportamento ou opções, atualize README.md e PRODUCT.md e rode o teste de fumaça.
- Nunca troque o texto da caixa do Slack com `document.execCommand("selectAll")`: selecione só o conteúdo do editor (`replaceEditorText` em `composer.js`).
- Revise o diff antes de entregar: chamadas à API, tratamento de erros e o que acontece sem chave configurada.
