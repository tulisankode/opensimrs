import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Batas waktu HTTP HDIS dibaca saat modul dimuat — perkecil agar uji "waktu habis → tidak pasti" cepat.
process.env.HD_HDIS_TIMEOUT_MS = "300";
const { default: rute } = await import("../src/rute.js");
const { default: hemodialisa } = await import("../src/hemodialisa/rute.js");
const { ruteMasuk } = await import("../src/hemodialisa/hdis/push-rute.js");
const { buatPayloadJadwal, kirimHttp } = await import("../src/hemodialisa/hdis/kirim.js");

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// STD-0033 — Unit Hemodialisa & bridging HDIS: pemasangan router, izin per rute, kontrak payload, klasifikasi status
// pengiriman (terkirim/gagal/tidak pasti), dan kriptografi salinan baku. Tanpa koneksi database.
test("rute penunjang memasang /hemodialisa dan titik masuk HDIS tanpa login", () => {
  assert.ok(rute.stack.some((l) => l.regexp?.test("/hemodialisa/jadwal")));
  const jalur = ruteMasuk.stack.map((l) => l.route?.path).flat();
  assert.ok(jalur.includes("/adam-hdis/bridging"));
  assert.ok(jalur.includes("/api/v3/penunjang/hemodialisa/hdis/masuk"));
});

// Setiap rute modul (kecuali tidak ada) wajib memiliki middleware izin sebelum handler (KT-19).
test("setiap rute Hemodialisa memeriksa izin sebelum handler", () => {
  const kurang = [];
  const telusuri = (router, awalan = "") => {
    for (const l of router.stack) {
      if (l.route) {
        const nama = l.route.stack.map((s) => s.name);
        if (nama.length < 2) kurang.push(`${Object.keys(l.route.methods).join(",")} ${awalan}${l.route.path}`);
      } else if (l.handle?.stack) {
        const sub = l.regexp?.source.includes("hdis") ? `${awalan}/hdis` : awalan;
        if (sub.endsWith("/hdis")) assert.ok(l.handle.stack.some((s) => !s.route && s.name === "wajibFiturHdisAktif"), "router /hdis wajib memeriksa fitur hd_bridging_hdis");
        telusuri(l.handle, sub);
      }
    }
  };
  telusuri(hemodialisa);
  assert.deepEqual(kurang, []);
});

test("payload jadwal HDIS: data minimum (tanpa NIK/telepon/alamat), aksi batal untuk jadwal batal", () => {
  const j = { uuid: "j-1", tanggal: "2026-10-19", status: "terjadwal", kode_shift: "PAGI", nama_shift: "Pagi", jam_mulai: "07:00:00", jam_selesai: "12:00:00", no_rm: "RM-0001", nama_pasien: "Pasien Fiktif", gender: "female", birth_date: "1980-01-01", no_reg_hd: "HD-1", jenis: "kronis" };
  const p = buatPayloadJadwal(j, "MSN-03", "jadwal:j-1:1");
  assert.equal(p.aksi, "jadwal");
  assert.equal(p.jadwal.kode_jadwal_simrs, "j-1");
  assert.equal(p.jadwal.shift.jam_mulai, "07:00");
  assert.equal(p.pasien.jenis_kelamin, "P");
  assert.deepEqual(Object.keys(p.pasien).sort(), ["jenis_kelamin", "nama", "no_rm", "tanggal_lahir"]);
  assert.equal(buatPayloadJadwal({ ...j, status: "batal" }, "MSN-03", "k").aksi, "batal");
});

const server = (penangan) =>
  new Promise((ok) => {
    const s = http.createServer(penangan);
    s.listen(0, "127.0.0.1", () => ok(s));
  });

test("kirimHttp: 2xx terkirim, 4xx gagal, 5xx & waktu habis tidak pasti, koneksi ditolak gagal", async () => {
  const diterima = [];
  const s = await server((req, res) => {
    let isi = "";
    req.on("data", (d) => (isi += d));
    req.on("end", () => {
      diterima.push({ url: req.url, kunci: req.headers["idempotency-key"] });
      if (req.url === "/ok") return res.writeHead(202, { "content-type": "application/json" }).end(JSON.stringify({ message: "diterima" }));
      if (req.url === "/tolak") return res.writeHead(422, { "content-type": "application/json" }).end(JSON.stringify({ message: "kode mesin tidak dikenal" }));
      if (req.url === "/rusak") return res.writeHead(503).end("proksi");
      if (req.url === "/lambat") return setTimeout(() => res.writeHead(200).end("{}"), 1500);
      res.writeHead(404).end();
    });
  });
  const dasar = `http://127.0.0.1:${s.address().port}`;
  const payload = { kunci_idempoten: "jadwal:x:1" };
  try {
    assert.equal((await kirimHttp({ url_jadwal: `${dasar}/ok`, api_key: null }, payload)).status, "terkirim");
    const tolak = await kirimHttp({ url_jadwal: `${dasar}/tolak`, api_key: null }, payload);
    assert.equal(tolak.status, "gagal");
    assert.match(tolak.pesan, /kode mesin tidak dikenal/);
    assert.equal((await kirimHttp({ url_jadwal: `${dasar}/rusak`, api_key: null }, payload)).status, "tidak_pasti");
    const lambat = await kirimHttp({ url_jadwal: `${dasar}/lambat`, api_key: null }, payload);
    assert.equal(lambat.status, "tidak_pasti");
    assert.match(lambat.pesan, /Waktu habis/);
    assert.ok(diterima.every((d) => d.kunci === "jadwal:x:1"), "Idempotency-Key wajib dikirim");
  } finally {
    s.closeAllConnections?.();
    s.close();
  }
  // Port tertutup: Linux/macOS langsung ECONNREFUSED (pasti belum terkirim). Windows mengulang SYN ±2 detik sehingga
  // batas waktu uji 300 ms habis lebih dulu → tidak pasti (konservatif; kirim ulang tetap aman).
  const mati = await kirimHttp({ url_jadwal: `${dasar}/ok`, api_key: null }, payload);
  if (mati.status === "gagal") assert.match(mati.pesan, /ECONNREFUSED/);
  else assert.equal(mati.status, "tidak_pasti");
});

// Pemeriksa kebijakan SIMRS Studio: kode kriptografi di luar rahasia.js wajib salinan baku (komentar & nama variabel
// *_KUNCI_RAHASIA dinormalkan) — lihat studio-service/src/kebijakan.js normalKripto.
test("hdis/kripto.js adalah salinan baku lab-service/src/lis/rahasia.js", () => {
  const normal = (t) =>
    String(t).replace(/\r\n/g, "\n").split("\n").map((b) => b.replace(/\s+$/, "")).filter((b) => b.trim() && !/^\s*\/\//.test(b))
      .map((b) => b.replace(/\b[A-Z][A-Z0-9_]*_KUNCI_RAHASIA\b/g, "X_KUNCI_RAHASIA")).join("\n");
  const baku = normal(fs.readFileSync(path.join(AKAR, "lab-service/src/lis/rahasia.js"), "utf8"));
  const hdis = normal(fs.readFileSync(path.join(AKAR, "penunjang-service/src/hemodialisa/hdis/kripto.js"), "utf8"));
  assert.equal(hdis, baku);
});

test("enkripsi rahasia HDIS: format enc:v1, dapat didekripsi, samaran tidak memuat nilai utuh", async () => {
  process.env.SECRET_KEY = process.env.SECRET_KEY || "kunci-uji-lokal-bukan-rahasia";
  const { enkripsi, dekripsi, samarkan } = await import("../src/hemodialisa/hdis/kripto.js");
  const c = enkripsi("api-key-fiktif-1234");
  assert.match(c, /^enc:v1:/);
  assert.equal(dekripsi(c), "api-key-fiktif-1234");
  assert.equal(samarkan("api-key-fiktif-1234"), "••••••••1234");
});
