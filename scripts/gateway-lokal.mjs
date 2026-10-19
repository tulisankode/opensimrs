#!/usr/bin/env node
// Konfigurasi gateway nginx untuk instalasi lokal (layanan berjalan langsung di mesin, bukan di kontainer).
// Dibuat dari deploy/server/gateway.nginx.conf: upstream "<nama>-service:<port>" diganti "<host>:<port>", sehingga semua
// API bisa diakses lewat satu port (8080) — mis. untuk domain API di Cloudflare Tunnel atau reverse proxy.
//
//   node scripts/gateway-lokal.mjs --keluar ~/.opensimrs/gateway-lokal.conf [--host host.containers.internal]
//     --host  alamat mesin dilihat dari nginx: host.containers.internal (Podman), host.docker.internal (Docker),
//             127.0.0.1 (nginx terpasang langsung di mesin). Bawaan: host.containers.internal.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (nama, bawaan) => {
  const i = process.argv.indexOf(nama);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
};
const host = arg("--host", "host.containers.internal");
const keluar = arg("--keluar", null);
if (!keluar) {
  console.error("Pemakaian: node scripts/gateway-lokal.mjs --keluar <berkas.conf> [--host <alamat>]");
  process.exit(1);
}
if (!/^[A-Za-z0-9.-]+$/.test(host)) {
  console.error(`Host tidak sah: ${host}`);
  process.exit(1);
}

let s = fs.readFileSync(path.join(ROOT, "deploy", "server", "gateway.nginx.conf"), "utf8").replace(/\r\n/g, "\n");
// Upstream tetap (bukan variabel): nama host di-resolve sekali saat start lewat /etc/hosts, tanpa resolver DNS.
s = s.replace(/^.*resolver .*\n/m, "");
s = s.replace(/set \$up [a-z-]+:(\d+);\s+proxy_pass http:\/\/\$up;/g, (_, port) => `proxy_pass http://${host}:${port};`);
if (s.includes("$up")) {
  console.error("Format deploy/server/gateway.nginx.conf berubah — perbarui scripts/gateway-lokal.mjs");
  process.exit(1);
}
s = `# Gateway lokal OpenSIMRS — dibuat oleh scripts/gateway-lokal.mjs dari deploy/server/gateway.nginx.conf (host: ${host}).\n${s}`;
fs.mkdirSync(path.dirname(path.resolve(keluar)), { recursive: true });
fs.writeFileSync(keluar, s);
console.log(`Gateway lokal: ${keluar} (${(s.match(/proxy_pass/g) ?? []).length} upstream ke ${host})`);
