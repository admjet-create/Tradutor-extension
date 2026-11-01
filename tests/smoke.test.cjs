// Teste de fumaça: carrega a extensão num Chromium, abre um "Slack" simulado
// e responde as chamadas à API com traduções falsas.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const EXTENSION = path.join(__dirname, "..", "extension");
const PROFILE = path.join(__dirname, "..", ".test-profile");

const SLACK_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="list">
  <div><div data-qa="message-text">Dude, you're such an idiot</div></div>
  <div><div data-qa="message-text">ordinário, você viu isso?</div></div>
</div>
<div style="position:absolute;bottom:20px;left:20px;width:600px" data-qa="message_input">
  <div class="ql-editor" contenteditable="true" style="min-height:30px"></div>
</div>
</body></html>`;

// Troca o rascunho como o Slack faz ao completar uma menção, avisando com "input".
function setDraft(page, html) {
  return page.evaluate((h) => {
    const editor = document.querySelector(".ql-editor");
    editor.innerHTML = h;
    editor.focus();
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, html);
}

function editorText(page) {
  // O Chrome usa espaço não separável ao lado de menções; para o Slack é um espaço comum.
  return page.$eval(".ql-editor", (e) => e.innerText.replace(/\u00a0/g, " ").trim());
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    channel: "chromium",
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, "--no-sandbox"],
  });
  const calls = [];
  try {
    await ctx.route("https://api.anthropic.com/**", async (route) => {
      const body = JSON.parse(route.request().postData());
      calls.push({ headers: route.request().headers(), body });
      const content = body.messages[0].content;
      const text = content.match(/<texto>\n([\s\S]*)\n<\/texto>/)[1];
      const reply = text.includes("perde") ? text.replace(/⟦\d+⟧/g, "@Ana") : text;
      const tag = content.includes("inglês") ? "EN" : "PT";
      await route.fulfill({
        json: {
          content: [{ type: "thinking", thinking: "" }, { type: "text", text: `[${tag}] ${reply}` }],
          stop_reason: "end_turn",
        },
      });
    });
    await ctx.route("https://app.slack.com/**", (r) => r.fulfill({ contentType: "text/html", body: SLACK_HTML }));

    const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
    for (const p of ctx.pages()) if (p.url().startsWith("chrome-extension://")) await p.close();
    await sw.evaluate(() => chrome.storage.local.set({ apiKey: "sk-test" }));

    const page = await ctx.newPage();
    await page.goto("https://app.slack.com/client/T1/C1");
    await page.waitForSelector(".tps-translation");
    assert.deepEqual(await page.$$eval(".tps-translation", (els) => els.map((e) => e.textContent)), [
      "[PT] Dude, you're such an idiot",
    ]);

    await page.evaluate(() => {
      const d = document.createElement("div");
      d.innerHTML = '<div data-qa="message-text">Line check on stage in 5</div>';
      document.getElementById("list").append(d);
    });
    await page.waitForFunction(() => document.querySelectorAll(".tps-translation").length === 2);

    await page.click(".ql-editor");
    await page.keyboard.type("Mano, tu é idiota");
    await page.waitForSelector(".tps-insert:visible");
    assert.match(await page.$eval(".tps-panel-body", (e) => e.textContent), /^\[EN\] Mano, tu é idiota$/);

    await page.keyboard.press("Alt+T");
    assert.equal(await editorText(page), "[EN] Mano, tu é idiota");

    // Desfazer devolve o texto original.
    await page.waitForSelector(".tps-panel[data-mode=undo] .tps-insert:visible");
    await page.click(".tps-insert");
    assert.equal(await editorText(page), "Mano, tu é idiota");

    // Digitar depois da tradução e apertar Alt+T na hora não pode perder o final do texto.
    await page.waitForSelector(".tps-panel[data-mode=translate] .tps-insert:visible");
    await page.keyboard.type(" demais");
    await page.keyboard.press("Alt+T");
    await page.waitForFunction(() => document.querySelector(".ql-editor").innerText.trim().startsWith("[EN]"));
    assert.equal(await editorText(page), "[EN] Mano, tu é idiota demais");
    assert.equal(await page.evaluate(() => document.querySelector(".ql-editor").innerText.includes("†")), false);

    // Texto que some sem você apagar nem enviar: o painel oferece restaurar.
    await page.click(".ql-editor");
    await page.keyboard.press("End");
    await page.keyboard.type(" ok");
    await page.evaluate(() => (document.querySelector(".ql-editor").innerHTML = ""));
    await page.waitForSelector(".tps-panel[data-mode=restore] .tps-insert:visible");
    await page.click(".tps-insert");
    assert.equal(await editorText(page), "[EN] Mano, tu é idiota demais ok");

    // Menções: a tradução reescreve só o texto em volta e a menção continua sendo a mesma.
    await setDraft(page, '<p>Oi <ts-mention contenteditable="false" data-id="U1">@Ana</ts-mention>, você checou o mix?</p>');
    await page.waitForSelector(".tps-panel[data-mode=translate] .tps-insert:visible");
    assert.equal(await page.$eval(".tps-panel-body", (e) => e.textContent), "[EN] Oi @Ana, você checou o mix?");
    await page.evaluate(() => (window.mention = document.querySelector("ts-mention")));
    await page.keyboard.press("Alt+T");
    assert.equal(await editorText(page), "[EN] Oi @Ana, você checou o mix?");
    assert.equal(await page.evaluate(() => window.mention.isConnected && window.mention.parentElement.closest(".ql-editor") !== null), true);

    await page.waitForSelector(".tps-panel[data-mode=undo] .tps-insert:visible");
    await page.click(".tps-insert");
    assert.equal(await editorText(page), "Oi @Ana, você checou o mix?");
    assert.equal(await page.evaluate(() => window.mention.isConnected), true);

    // Se a tradução perder o marcador da menção, o texto fica como estava.
    await setDraft(page, '<p>Oi <ts-mention contenteditable="false" data-id="U1">@Ana</ts-mention>, você perde o cabo?</p>');
    await page.waitForSelector(".tps-panel[data-mode=translate] .tps-insert:visible");
    await page.keyboard.press("Alt+T");
    assert.equal(await editorText(page), "Oi @Ana, você perde o cabo?");
    assert.match(await page.$eval(".tps-panel-body", (e) => e.textContent), /Não consegui inserir/);

    // Enviar com Enter não pode disparar o aviso de texto sumido.
    await page.keyboard.press("Enter");
    await page.evaluate(() => (document.querySelector(".ql-editor").innerHTML = ""));
    await page.waitForTimeout(1200);
    assert.notEqual(await page.$eval(".tps-panel", (p) => !p.hidden && p.dataset.mode), "restore");

    const first = calls[0];
    assert.equal(first.headers["x-api-key"], "sk-test");
    assert.equal(first.headers["anthropic-version"], "2026-10-21");
    assert.equal(first.headers["anthropic-dangerous-direct-browser-access"], "true");
    assert.equal(first.body.model, "claude-haiku-5-5");
    assert.match(first.body.system, /engenharia de áudio/);
    assert.match(first.body.system, /FOH/);
    console.log("ok: tradução recebida, mensagem nova, painel de envio, Alt+T, desfazer, texto alterado e restaurar");
  } finally {
    await ctx.close();
    fs.rmSync(PROFILE, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
