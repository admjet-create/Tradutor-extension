# Tradutor para Slack

Extensão do Google Chrome que traduz mensagens do Slack entre inglês e português brasileiro, com foco em engenharia de áudio, produção musical e backstage de shows. A tradução é feita pelo Claude (API da Anthropic).

## O que ela faz

- **Mensagens recebidas em inglês** ganham a tradução em português logo abaixo, com uma barra azul ao lado. Se a tradução automática estiver desligada, cada mensagem ganha um botão 🌐 para traduzir só quando você clicar.
- **O que você digita em português** aparece traduzido para o inglês num painel acima da caixa de mensagem. Clique em **Inserir** (ou aperte **Alt+T**) para trocar o texto pela tradução, ou em **Copiar**.
- Termos do **glossário** (FOH, IEM, DCA, stems…) ficam em inglês.
- O **prompt base** do tradutor pode ser editado nas opções.

## Instalação

1. Baixe este repositório (botão **Code → Download ZIP**) e descompacte.
2. No Chrome, abra `chrome://extensions` e ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha a pasta `extension`.
4. A página de opções abre sozinha. Cole sua chave de API da Anthropic (crie uma em https://console.anthropic.com/settings/keys) e clique em **Salvar**.
5. Abra o Slack no navegador em https://app.slack.com e recarregue a aba.

> Funciona no Slack aberto no Chrome. O aplicativo de desktop do Slack não roda extensões.

Para atualizar depois de baixar uma versão nova, volte em `chrome://extensions` e clique no ícone de recarregar da extensão.

## Custo

O modelo padrão é o `claude-haiku-5-5`, o mais barato. As traduções ficam em cache enquanto o navegador está aberto, então rolar o histórico não traduz a mesma mensagem duas vezes. Para gastar menos, desligue a tradução automática nas opções.

## Estrutura

Veja [AGENTS.md](AGENTS.md) para comandos, arquitetura e regras de trabalho, e [PRODUCT.md](PRODUCT.md) para o escopo do produto.
