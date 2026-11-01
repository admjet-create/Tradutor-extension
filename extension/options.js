import { BASE_PROMPT, loadSettings } from "./settings.js";

const fields = {
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  autoTranslate: document.getElementById("autoTranslate"),
  glossary: document.getElementById("glossary"),
  basePrompt: document.getElementById("basePrompt"),
};
const status = document.getElementById("status");

function showStatus(text) {
  status.textContent = text;
  setTimeout(() => (status.textContent = ""), 2500);
}

async function init() {
  const settings = await loadSettings();
  fields.apiKey.value = settings.apiKey;
  fields.model.value = settings.model;
  fields.autoTranslate.checked = settings.autoTranslate;
  fields.glossary.value = settings.glossary;
  fields.basePrompt.value = settings.basePrompt;
}

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: fields.apiKey.value.trim(),
    model: fields.model.value.trim(),
    autoTranslate: fields.autoTranslate.checked,
    glossary: fields.glossary.value,
    basePrompt: fields.basePrompt.value.trim() || BASE_PROMPT,
  });
  showStatus("Salvo. Recarregue a aba do Slack para aplicar.");
});

document.getElementById("resetPrompt").addEventListener("click", () => {
  fields.basePrompt.value = BASE_PROMPT;
  showStatus("Prompt original restaurado. Clique em Salvar.");
});

init();
