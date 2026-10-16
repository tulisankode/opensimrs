import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { skripServer, validasiServer } from "../src/deploy.js";

const sh = process.platform === "win32" && fs.existsSync("C:/Program Files/Git/bin/bash.exe") ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const git = (cwd, ...a) => execFileSync("git", ["-c", "safe.directory=*", "-c", "user.email=uji@contoh.id", "-c", "user.name=uji", ...a], { cwd, encoding: "utf8" }).trim();
const jalankanSkrip = (skrip) => {
  try {
    return { kode: 0, keluaran: execFileSync(sh, ["-c", skrip], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { kode: e.status, keluaran: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

test("validasi server menolak isian berbahaya", () => {
  const dasar = { nama: "Server RS", host: "192.168.1.10", pengguna: "deploy", port: 22 };
  assert.doesNotThrow(() => validasiServer(dasar));
  assert.throws(() => validasiServer({ ...dasar, host: "x; rm -rf /" }));
  assert.throws(() => validasiServer({ ...dasar, repo_dir: "~/a; reboot" }));
  assert.throws(() => validasiServer({ ...dasar, perintah_deploy: "deploy.sh\nreboot" }));
  assert.throws(() => validasiServer({ ...dasar, port: 70000 }));
});

test("skrip server: clone pertama, fast-forward, berhenti bila ada perubahan lokal", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uji-deploy-"));
  const p = (x) => path.join(dir, x).replace(/\\/g, "/");
  const baca = (x) => fs.readFileSync(p(x), "utf8").trim(); // git Windows bisa mengubah akhir baris menjadi CRLF
  try {
    // "Studio": repo dengan branch rs-lokal; "server": repo penampung (bare) yang menerima push.
    fs.mkdirSync(p("studio"));
    git(p("studio"), "init", "-q", "-b", "rs-lokal");
    fs.writeFileSync(p("studio/a.txt"), "v1\n");
    git(p("studio"), "add", "-A");
    git(p("studio"), "commit", "-qm", "v1");
    git(dir, "init", "-q", "--bare", p("bare.git"));
    git(p("studio"), "push", "-q", p("bare.git"), "rs-lokal:refs/heads/rs-lokal");
    const server = { repo_bare: p("bare.git"), repo_dir: p("aplikasi"), perintah_deploy: "echo DEPLOY_JALAN" };

    const r1 = jalankanSkrip(skripServer(server, "rs-lokal", true));
    assert.equal(r1.kode, 0, r1.keluaran);
    assert.match(r1.keluaran, /Repo aplikasi dibuat/);
    assert.match(r1.keluaran, /DEPLOY_JALAN/);
    assert.equal(baca("aplikasi/a.txt"), "v1");

    // Rilis berikutnya → fast-forward.
    fs.writeFileSync(p("studio/a.txt"), "v2\n");
    git(p("studio"), "commit", "-qam", "v2");
    git(p("studio"), "push", "-q", p("bare.git"), "rs-lokal:refs/heads/rs-lokal");
    const r2 = jalankanSkrip(skripServer(server, "rs-lokal", false));
    assert.equal(r2.kode, 0, r2.keluaran);
    assert.doesNotMatch(r2.keluaran, /DEPLOY_JALAN/);
    assert.equal(baca("aplikasi/a.txt"), "v2");
    assert.match(r2.keluaran, new RegExp(`SHA_SERVER=${git(p("studio"), "rev-parse", "HEAD")}`));

    // Seseorang menyunting langsung di server → berhenti (kode 3), berkas tidak tertimpa.
    fs.writeFileSync(p("aplikasi/a.txt"), "suntingan di server\n");
    fs.writeFileSync(p("studio/a.txt"), "v3\n");
    git(p("studio"), "commit", "-qam", "v3");
    git(p("studio"), "push", "-q", p("bare.git"), "rs-lokal:refs/heads/rs-lokal");
    const r3 = jalankanSkrip(skripServer(server, "rs-lokal", true));
    assert.equal(r3.kode, 3, r3.keluaran);
    assert.equal(baca("aplikasi/a.txt"), "suntingan di server");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
