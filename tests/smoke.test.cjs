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
      const tag = content.includes("inglês") ? "EN" : "PT";
      await route.fulfill({
        json: {
          content: [{ type: "thinking", thinking: "" }, { type: "text", text: `[${tag}] ${text}` }],
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
    assert.equal(await page.$eval(".ql-editor", (e) => e.innerText.trim()), "[EN] Mano, tu é idiota");
    assert.equal(await page.$eval(".tps-panel", (p) => p.hidden), true);

    const first = calls[0];
    assert.equal(first.headers["x-api-key"], "sk-test");
    assert.equal(first.headers["anthropic-version"], "2026-10-21");
    assert.equal(first.headers["anthropic-dangerous-direct-browser-access"], "true");
    assert.equal(first.body.model, "claude-haiku-5-5");
    assert.match(first.body.system, /engenharia de áudio/);
    assert.match(first.body.system, /FOH/);
    assert.equal(calls.length, 3);
    console.log("ok: tradução recebida, mensagem nova, painel de envio e Alt+T");
  } finally {
    await ctx.close();
    fs.rmSync(PROFILE, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
