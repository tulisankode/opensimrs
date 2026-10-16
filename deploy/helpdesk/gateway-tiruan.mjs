#!/usr/bin/env node
// Gateway tiruan OpenClaw untuk pengembangan & uji Helpdesk tanpa VM: meniru POST /v1/chat/completions (kompatibel
// OpenAI, streaming SSE) dengan jawaban kalengan. JANGAN dipakai di produksi.
//
//   node deploy/helpdesk/gateway-tiruan.mjs            # port 18789, token "token-uji"
//   PORT=18790 TOKEN=rahasia node deploy/helpdesk/gateway-tiruan.mjs
//
// Lalu di setting-service/.env: HELPDESK_GATEWAY_URL=http://localhost:18789  HELPDESK_GATEWAY_TOKEN=token-uji
import http from "node:http";

const PORT = Number(process.env.PORT) || 18789;
const TOKEN = process.env.TOKEN || "token-uji";

const jawab = (pesan) => {
  const tanya = pesan.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const konteks = pesan.find((m) => m.role === "system")?.content ?? "";
  const halaman = konteks.match(/Halaman yang sedang dibuka: (.*)/)?.[1] ?? "-";
  return `(Gateway tiruan) Pertanyaan diterima: "${tanya}". Halaman: ${halaman}. ` +
    "Di Gateway OpenClaw sungguhan, jawaban disusun agen helpdesk dari panduan pengguna.";
};

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ object: "list", data: [{ id: "openclaw/helpdesk-opensimrs", object: "model" }] }));
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    res.writeHead(404);
    return res.end();
  }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: { message: "unauthorized" } }));
  }
  let isi = "";
  req.on("data", (d) => (isi += d));
  req.on("end", async () => {
    const body = JSON.parse(isi || "{}");
    const teks = jawab(body.messages ?? []);
    console.log(`[tiruan] ${body.model} user=${body.user} ${new Date().toISOString()}`);
    if (!body.stream) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: teks } }] }));
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    for (const kata of teks.split(/(?<= )/)) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: kata } }] })}\n\n`);
      await new Promise((r) => setTimeout(r, 15));
    }
    res.end("data: [DONE]\n\n");
  });
}).listen(PORT, () => console.log(`Gateway tiruan OpenClaw di http://localhost:${PORT} (token: ${TOKEN === "token-uji" ? "token-uji" : "dari TOKEN"})`));
