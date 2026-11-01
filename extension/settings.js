// Configurações compartilhadas entre o service worker e a página de opções.

export const BASE_PROMPT = `A partir de agora, atue como um tradutor automático entre inglês e português (brasileiro), traduzindo cada mensagem que eu enviar. O contexto das mensagens estará relacionado à engenharia de áudio, produção musical, backstage de shows, bandas, equipamentos de som, teoria e harmonia musical. Use uma linguagem natural e fluida, mantendo a terminologia técnica correta e as expressões idiomáticas específicas dessas áreas. Sempre que eu enviar uma frase ou parágrafo em inglês, traduza para o português brasileiro. Se eu enviar em português, traduza para o inglês. Não explique a tradução, apenas traduza diretamente. Se houver ambiguidade, preserve o sentido técnico mais provável para o contexto musical e de áudio.`;

export const DEFAULT_GLOSSARY =
  "FOH, monitor mix, IEM, in-ears, wedge, gain, fader, aux, matrix, DCA, snapshot, scene, patch, stage box, soundcheck, line check, click track, stems, Dante, ProPresenter, Planning Center";

export const DEFAULT_MODEL = "claude-haiku-5-5";

export const DEFAULTS = {
  apiKey: "",
  model: "",
  autoTranslate: true,
  glossary: DEFAULT_GLOSSARY,
  basePrompt: BASE_PROMPT,
};

export async function loadSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}
