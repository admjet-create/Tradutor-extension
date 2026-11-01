// Painel acima da caixa de mensagem: traduz o rascunho (português -> inglês),
// insere com Inserir ou Alt+T, permite desfazer e devolve o texto se ele sumir.
(() => {
  const { EDITOR_SELECTOR, languageOf, requestTranslation, renderError } = globalThis.TPS;
  const TYPING_DELAY_MS = 800;

  const panel = document.createElement("div");
  panel.className = "tps-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="tps-panel-head"><span class="tps-dot"></span>Inglês — Alt+T insere na mensagem</div>
    <div class="tps-panel-body"></div>
    <div class="tps-panel-actions">
      <button type="button" class="tps-insert">Inserir</button>
      <button type="button" class="tps-copy">Copiar</button>
    </div>`;
  const panelBody = panel.querySelector(".tps-panel-body");
  const panelActions = panel.querySelector(".tps-panel-actions");

  let activeEditor = null;
  let currentTranslation = "";
  let translatedSource = ""; // texto da caixa que gerou currentTranslation
  let insertWhenReady = false;
  let typingTimer = 0;
  let requestSeq = 0;
  let lastInserted = "";
  let undoText = "";
  let undoTimer = 0;

  // Cópia do rascunho, para devolver o texto se ele sumir sem você apagar.
  let draft = { editor: null, text: "", url: "" };
  let lostDraft = "";
  let sentAt = 0;

  const panelHead = panel.querySelector(".tps-panel-head");
  const insertBtn = panel.querySelector(".tps-insert");
  const copyBtn = panel.querySelector(".tps-copy");
  const HEAD_TRANSLATE = panelHead.innerHTML;

  function editorText(editor) {
    return editor.innerText.replace(/\u200b/g, "").trim();
  }

  function positionPanel() {
    if (panel.hidden || !activeEditor) return;
    const anchor = activeEditor.closest('[data-qa="message_input"]') || activeEditor;
    const rect = anchor.getBoundingClientRect();
    panel.style.left = `${Math.max(8, rect.left)}px`;
    panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    panel.style.maxWidth = `${Math.max(260, rect.width)}px`;
  }

  // mode: "translate" (Inserir/Copiar), "undo" (Desfazer) ou "restore" (Restaurar)
  function setMode(mode) {
    panel.dataset.mode = mode;
    panelHead.innerHTML = HEAD_TRANSLATE;
    copyBtn.hidden = mode !== "translate";
    insertBtn.textContent = { translate: "Inserir", undo: "Desfazer", restore: "Restaurar texto" }[mode];
    if (mode !== "translate") panelHead.textContent = mode === "undo" ? "Tradução inserida" : "O texto da mensagem sumiu";
  }

  function showPanel() {
    if (!panel.isConnected) document.body.append(panel);
    panel.hidden = false;
    positionPanel();
  }

  function hidePanel() {
    panel.hidden = true;
    currentTranslation = "";
    translatedSource = "";
    insertWhenReady = false;
    requestSeq++;
  }

  function showLoading() {
    setMode("translate");
    panelActions.hidden = true;
    panelBody.classList.remove("tps-error");
    panelBody.textContent = "Traduzindo…";
    showPanel();
  }

  async function translateDraft(editor) {
    clearTimeout(typingTimer);
    const text = editorText(editor);
    if (!text || text === lastInserted || languageOf(text) === "en") {
      hidePanel();
      return;
    }

    const seq = ++requestSeq;
    currentTranslation = "";
    translatedSource = "";
    showLoading();

    const res = await requestTranslation(text, "en", true);
    if (seq !== requestSeq) return; // chegou uma tradução de um texto antigo

    if (res.ok) {
      currentTranslation = res.translation;
      translatedSource = text;
      panelBody.textContent = res.translation;
      panelActions.hidden = false;
      if (insertWhenReady) {
        insertWhenReady = false;
        insertTranslation();
        return;
      }
    } else {
      insertWhenReady = false;
      panelBody.classList.add("tps-error");
      renderError(panelBody, res);
    }
    positionPanel();
  }

  // Troca todo o conteúdo da caixa de mensagem por `text`, sem nunca mexer fora dela.
  function replaceEditorText(editor, text) {
    if (!editor?.isConnected) return false;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    if (!editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return false;
    document.execCommand("insertText", false, text);
    return true;
  }

  function insertTranslation() {
    if (!activeEditor?.isConnected) return;
    const current = editorText(activeEditor);
    if (!current) return;

    // A tradução é de uma versão antiga do texto: traduz de novo e insere quando chegar,
    // em vez de apagar o que você digitou depois.
    if (!currentTranslation || current !== translatedSource) {
      insertWhenReady = true;
      translateDraft(activeEditor);
      return;
    }

    const original = current;
    const translation = currentTranslation;
    if (!replaceEditorText(activeEditor, translation)) return;
    lastInserted = translation;
    draft = { editor: activeEditor, text: editorText(activeEditor), url: location.href };
    hidePanel();
    offerUndo(original);
  }

  function offerUndo(original) {
    undoText = original;
    setMode("undo");
    panelBody.classList.remove("tps-error");
    panelBody.textContent = original;
    panelActions.hidden = false;
    showPanel();
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      if (panel.dataset.mode === "undo") hidePanel();
    }, 8000);
  }

  function offerRestore(text) {
    lostDraft = text;
    setMode("restore");
    panelBody.classList.remove("tps-error");
    panelBody.textContent = text;
    panelActions.hidden = false;
    showPanel();
  }

  function restoreText(text) {
    if (!replaceEditorText(activeEditor, text)) return;
    lastInserted = "";
    draft = { editor: activeEditor, text: editorText(activeEditor), url: location.href };
    hidePanel();
    translateDraft(activeEditor);
  }

  function onPrimaryAction() {
    const mode = panel.dataset.mode;
    if (mode === "undo") restoreText(undoText);
    else if (mode === "restore") restoreText(lostDraft);
    else insertTranslation();
  }

  async function copyTranslation() {
    if (!currentTranslation) return;
    await navigator.clipboard.writeText(currentTranslation);
    copyBtn.textContent = "Copiado";
    setTimeout(() => (copyBtn.textContent = "Copiar"), 1200);
  }

  // Impede que o clique nos botões tire o foco da caixa de mensagem.
  panel.addEventListener("mousedown", (e) => e.preventDefault());
  insertBtn.addEventListener("click", onPrimaryAction);
  copyBtn.addEventListener("click", copyTranslation);

  document.addEventListener(
    "input",
    (e) => {
      const editor = e.target.closest?.(EDITOR_SELECTOR);
      if (!editor) return;
      activeEditor = editor;
      draft = { editor, text: editorText(editor), url: location.href };

      // Texto mudou: a tradução na tela deixou de valer até chegar a nova.
      if (!panel.hidden) {
        if (panel.dataset.mode !== "translate") hidePanel();
        currentTranslation = "";
        panelActions.hidden = true;
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => translateDraft(editor), TYPING_DELAY_MS);
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyT" && !panel.hidden) {
        // No Mac, Option+T digitaria "†" se a gente deixasse passar.
        e.preventDefault();
        e.stopPropagation();
        if (panel.dataset.mode === "translate") insertTranslation();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && e.target.closest?.(EDITOR_SELECTOR)) sentAt = Date.now();
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest?.('[data-qa="texty_send_button"], button[aria-label*="Send" i], button[aria-label*="Enviar" i]')) {
        sentAt = Date.now();
      }
    },
    true
  );

  // O Slack limpa a caixa ao enviar sem disparar "input"; checamos de tempos em tempos.
  setInterval(() => {
    const { editor, text, url } = draft;
    if (text && editor?.isConnected && url === location.href && !editorText(editor)) {
      draft = { editor: null, text: "", url: "" };
      if (Date.now() - sentAt > 3000) {
        console.warn("[Tradutor para Slack] O texto da caixa de mensagem sumiu sem ser enviado.");
        activeEditor = editor;
        offerRestore(text);
        return;
      }
    }
    if (panel.hidden || panel.dataset.mode === "restore") return;
    if (!activeEditor?.isConnected || !editorText(activeEditor)) hidePanel();
    else positionPanel();
  }, 500);
  window.addEventListener("resize", positionPanel);
})();
