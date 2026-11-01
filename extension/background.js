import { BASE_PROMPT, DEFAULT_MODEL, loadSettings } from "./settings.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_PARALLEL = 3;
const CACHE_LIMIT = 500;

const TARGETS = {
  pt: "português brasileiro",
  en: "inglês",
};

// Mesmas mensagens aparecem várias vezes (o Slack recria a lista ao rolar),
// então guardamos as traduções em memória para não pagar duas vezes.
const cache = new Map();
const queue = [];
let running = 0;

function cacheKey(text, target) {
  return `${target}\u0000${text}`;
}

function remember(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

function buildSystem(settings) {
  const base = settings.basePrompt?.trim() || BASE_PROMPT;
  const terms = settings.glossary
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const glossary = terms.length
    ? `\n\nGlossário: mantenha estes termos em inglês, sem traduzir: ${terms.join(", ")}.`
    : "";
  return `${base}${glossary}\n\nResponda somente com o texto traduzido, sem aspas, comentários ou explicações. Preserve emojis, menções (@nome), links e quebras de linha. Marcadores como ⟦1⟧ representam menções ou emojis: mantenha cada um exatamente como está, uma vez só e na mesma ordem.`;
}

function friendlyError(status, body) {
  if (status === 401) return "Chave de API inválida. Confira nas opções da extensão.";
  if (status === 403) return "Essa chave não tem permissão para usar o modelo escolhido.";
  if (status === 404) return "Modelo não encontrado. Deixe o campo Modelo em branco nas opções.";
  if (status === 429) return "Limite de uso da API atingido. Tente de novo em instantes.";
  if (status >= 500) return "A API da Anthropic está instável. Tente de novo em instantes.";
  return body?.error?.message || `Erro ${status} na API.`;
}

async function callClaude(text, target) {
  const settings = await loadSettings();
  if (!settings.apiKey) {
    const err = new Error("Configure sua chave de API nas opções da extensão.");
    err.code = "NO_KEY";
    throw err;
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2026-10-21",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.model?.trim() || DEFAULT_MODEL,
      max_tokens: 4096,
      output_config: { effort: "low" },
      system: buildSystem(settings),
      messages: [
        {
          role: "user",
          content: `Traduza para o ${TARGETS[target]} o texto dentro de <texto>.\n<texto>\n${text}\n</texto>`,
        },
      ],
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(friendlyError(res.status, body));
  if (body.stop_reason === "refusal") throw new Error("O modelo recusou traduzir esse texto.");

  const translation = body.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!translation) throw new Error("A API respondeu sem tradução.");
  return translation;
}

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const job = queue.shift();
    running++;
    callClaude(job.text, job.target)
      .then((translation) => {
        remember(job.key, translation);
        job.resolve({ ok: true, translation });
      })
      .catch((err) => job.resolve({ ok: false, error: err.message, code: err.code }))
      .finally(() => {
        running--;
        pump();
      });
  }
}

function translate(text, target, priority) {
  const key = cacheKey(text, target);
  if (cache.has(key)) return Promise.resolve({ ok: true, translation: cache.get(key) });
  return new Promise((resolve) => {
    const job = { key, text, target, resolve };
    // O texto que o usuário está digitando passa na frente das mensagens recebidas.
    if (priority) queue.unshift(job);
    else queue.push(job);
    pump();
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "translate" && TARGETS[msg.target]) {
    translate(String(msg.text), msg.target, Boolean(msg.priority)).then(sendResponse);
    return true;
  }
  if (msg?.type === "openOptions") {
    chrome.runtime.openOptionsPage();
  }
  return false;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  const { apiKey } = await loadSettings();
  if (!apiKey) chrome.runtime.openOptionsPage();
});
