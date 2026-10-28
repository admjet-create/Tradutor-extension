// Roda dentro do app.slack.com: traduz mensagens recebidas (inglês -> português)
// e mostra a tradução do que você digita (português -> inglês) acima da caixa de mensagem.
(() => {
  const MESSAGE_SELECTOR = '[data-qa="message-text"]';
  const EDITOR_SELECTOR = '.ql-editor[contenteditable="true"]';
  const TYPING_DELAY_MS = 800;

  let autoTranslate = true;

  // ---------- Detecção simples de idioma ----------

  const PT_WORDS = new Set(
    "você voce vc não nao que está esta isso pra para com uma um tá ta mano cara tô to também tambem obrigado obrigada mas por favor aqui agora então entao fazer tem meu minha seu sua já ja só so ele ela nós nos eles vou vai foi ser ter bom boa dia noite hoje amanhã amanha ontem quando onde porque como mais muito tudo nada isso essa esse".split(" ")
  );
  const EN_WORDS = new Set(
    "the and is are you to of it that for this with have be on not was we they i'm it's don't can will just what your our please thanks thank hey hi there here when where how why all".split(" ")
  );

  function languageOf(text) {
    const words = text.toLowerCase().match(/[\p{L}']+/gu) || [];
    if (!words.length) return "none";
    let pt = (text.match(/[ãõçáéíóúâêôà]/gi) || []).length;
    let en = 0;
    for (const w of words) {
      if (PT_WORDS.has(w)) pt++;
      if (EN_WORDS.has(w)) en++;
    }
    if (pt > en) return "pt";
    if (en > pt) return "en";
    return "unknown";
  }

  // ---------- Conversa com o service worker ----------

  function requestTranslation(text, target, priority = false) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "translate", text, target, priority }, (res) => {
          if (chrome.runtime.lastError || !res) {
            resolve({ ok: false, error: "Extensão recarregada. Atualize a aba do Slack." });
          } else {
            resolve(res);
          }
        });
      } catch {
        resolve({ ok: false, error: "Extensão recarregada. Atualize a aba do Slack." });
      }
    });
  }

  function openOptions() {
    chrome.runtime.sendMessage({ type: "openOptions" });
  }

  function renderError(container, res) {
    container.textContent = res.error;
    if (res.code === "NO_KEY") {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "tps-link";
      link.textContent = "Abrir opções";
      link.addEventListener("mousedown", (e) => e.preventDefault());
      link.addEventListener("click", openOptions);
      container.append(" ", link);
    }
  }

  // ---------- Mensagens recebidas ----------

  function textOf(el) {
    return el.innerText.trim();
  }

  function translationBox(el) {
    const next = el.nextElementSibling;
    if (next?.classList.contains("tps-translation")) return next;
    const box = document.createElement("div");
    box.className = "tps-translation";
    el.after(box);
    return box;
  }

  async function translateMessage(el, text) {
    const box = translationBox(el);
    box.classList.remove("tps-error");
    box.textContent = "Traduzindo…";
    const res = await requestTranslation(text, "pt");
    if (el.dataset.tpsText !== text) return; // a mensagem mudou enquanto traduzia
    if (res.ok) {
      box.textContent = res.translation;
    } else {
      box.classList.add("tps-error");
      renderError(box, res);
    }
  }

  function addTranslateButton(el, text) {
    if (el.nextElementSibling?.classList.contains("tps-translate-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tps-translate-btn";
    btn.title = "Traduzir para português";
    btn.textContent = "🌐";
    btn.addEventListener("click", () => {
      btn.remove();
      translateMessage(el, text);
    });
    el.after(btn);
  }

  function processMessage(el) {
    if (el.closest(EDITOR_SELECTOR)) return;
    const text = textOf(el);
    if (!text || el.dataset.tpsText === text) return;
    el.dataset.tpsText = text;

    const lang = languageOf(text);
    if (lang === "pt" || lang === "none") return;

    if (autoTranslate) translateMessage(el, text);
    else addTranslateButton(el, text);
  }

  function scanMessages(root = document) {
    if (root.matches?.(MESSAGE_SELECTOR)) processMessage(root);
    root.querySelectorAll?.(MESSAGE_SELECTOR).forEach(processMessage);
  }

  // ---------- Painel de tradução do que você digita ----------

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
  let typingTimer = 0;
  let requestSeq = 0;
  let lastInserted = "";

  function editorText(editor) {
    return editor.innerText.replace(/​/g, "").trim();
  }

  function positionPanel() {
    if (panel.hidden || !activeEditor) return;
    const anchor = activeEditor.closest('[data-qa="message_input"]') || activeEditor;
    const rect = anchor.getBoundingClientRect();
    panel.style.left = `${Math.max(8, rect.left)}px`;
    panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    panel.style.maxWidth = `${Math.max(260, rect.width)}px`;
  }

  function showPanel() {
    if (!panel.isConnected) document.body.append(panel);
    panel.hidden = false;
    positionPanel();
  }

  function hidePanel() {
    panel.hidden = true;
    currentTranslation = "";
    requestSeq++;
  }

  async function translateDraft(editor) {
    const text = editorText(editor);
    if (!text || text === lastInserted || languageOf(text) === "en") {
      hidePanel();
      return;
    }

    const seq = ++requestSeq;
    currentTranslation = "";
    panelActions.hidden = true;
    panelBody.classList.remove("tps-error");
    panelBody.textContent = "Traduzindo…";
    showPanel();

    const res = await requestTranslation(text, "en", true);
    if (seq !== requestSeq) return; // chegou uma tradução de um texto antigo

    if (res.ok) {
      currentTranslation = res.translation;
      panelBody.textContent = res.translation;
      panelActions.hidden = false;
    } else {
      panelBody.classList.add("tps-error");
      renderError(panelBody, res);
    }
    positionPanel();
  }

  function insertTranslation() {
    if (!currentTranslation || !activeEditor?.isConnected) return;
    const translation = currentTranslation;
    activeEditor.focus();
    document.execCommand("selectAll");
    document.execCommand("insertText", false, translation);
    lastInserted = translation;
    hidePanel();
  }

  async function copyTranslation() {
    if (!currentTranslation) return;
    await navigator.clipboard.writeText(currentTranslation);
    const btn = panel.querySelector(".tps-copy");
    btn.textContent = "Copiado";
    setTimeout(() => (btn.textContent = "Copiar"), 1200);
  }

  // Impede que o clique nos botões tire o foco da caixa de mensagem.
  panel.addEventListener("mousedown", (e) => e.preventDefault());
  panel.querySelector(".tps-insert").addEventListener("click", insertTranslation);
  panel.querySelector(".tps-copy").addEventListener("click", copyTranslation);

  document.addEventListener(
    "input",
    (e) => {
      const editor = e.target.closest?.(EDITOR_SELECTOR);
      if (!editor) return;
      activeEditor = editor;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => translateDraft(editor), TYPING_DELAY_MS);
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyT" && currentTranslation) {
        e.preventDefault();
        e.stopPropagation();
        insertTranslation();
      }
    },
    true
  );

  // O Slack limpa a caixa ao enviar sem disparar "input"; checamos de tempos em tempos.
  setInterval(() => {
    if (panel.hidden) return;
    if (!activeEditor?.isConnected || !editorText(activeEditor)) hidePanel();
    else positionPanel();
  }, 500);
  window.addEventListener("resize", positionPanel);

  // ---------- Inicialização ----------

  chrome.storage.local.get({ autoTranslate: true }, (s) => {
    autoTranslate = s.autoTranslate;
    scanMessages();
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1 || node.closest?.(".tps-panel, .tps-translation")) continue;
          scanMessages(node);
          const message = node.parentElement?.closest(MESSAGE_SELECTOR);
          if (message) processMessage(message); // mensagem editada
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoTranslate) autoTranslate = changes.autoTranslate.newValue;
  });
})();
