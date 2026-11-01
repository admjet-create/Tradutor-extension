# Produto

## Problema

Rafael trabalha num time em que toda a comunicação do Slack é em inglês. Ele precisa entender rápido o que recebe e responder em inglês natural, num vocabulário técnico de áudio ao vivo, produção musical e backstage, que tradutores genéricos erram.

## Público

Uso pessoal do Rafael, no Google Chrome, com o Slack aberto em app.slack.com.

## MVP (versão 0.1)

1. Traduzir mensagens recebidas em inglês para português, abaixo de cada mensagem (automático ou por botão).
2. Traduzir o rascunho em português para inglês num painel acima da caixa de mensagem, com Inserir, Copiar e o atalho Alt+T.
3. Página de opções com chave de API, modelo, tradução automática, glossário e prompt base.

## Critérios de aceite

- Uma mensagem em inglês recebida mostra a tradução em português sem recarregar a página.
- Mensagens já em português não são traduzidas.
- Digitar em português mostra a tradução em inglês em até poucos segundos; Alt+T substitui o texto da caixa.
- Sem chave configurada, a extensão mostra um aviso com link para as opções em vez de falhar em silêncio.
- A chave de API fica só no `chrome.storage.local` do navegador.

## Fora do escopo por enquanto

- Aplicativo de desktop do Slack (não aceita extensões).
- Outros sites além do Slack.
- Publicação na Chrome Web Store.

## Hipóteses

- O DOM do Slack usa `[data-qa="message-text"]` para o texto das mensagens e `.ql-editor[contenteditable]` para a caixa de mensagem. Se o Slack mudar isso, os seletores em `extension/content.js` precisam ser atualizados.
