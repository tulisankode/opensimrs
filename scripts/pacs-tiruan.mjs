#!/usr/bin/env node
// PACS/RIS tiruan untuk pengembangan & pengujian Bridging PACS/RIS Radiologi tanpa PACS asli
// (lihat scripts/README-pacs-tiruan.md). Kontrak mengikuti penunjang-service/src/pacs/pacs-service.js.
//
//   node scripts/pacs-tiruan.mjs                      # port 2412, kunci "kunci-uji-pacs"
//   PORT=2499 PACS_KUNCI=rahasia node scripts/pacs-tiruan.mjs
//
// Endpoint (dipanggil SIMRS, butuh header x-api-key = API key koneksi):
//   POST /adam-pacs/order    kirim order per item pemeriksaan (idempoten per accession_number)
//   GET  /adam-pacs/hasil    ambil hasil/status (?accession_number=...) — dipakai "Cek Status" & "Ambil Hasil PACS"
// Push hasil ke SIMRS (titik masuk /adam-pacs/bridging, kunci masuk per koneksi):
//   POST /_uji/push          { accession_number, status?, hasil?, kesan? } — kirim sekarang
// Kendali uji (tanpa kunci):
//   GET  /_uji/hitung   jumlah "diterima" (tiap POST order), "terdaftar" (studi unik), "ditolak" per accession_number
//   POST /_uji/atur     ubah pengaturan (JSON, digabung), mis. {"kode_prosedur_dikenal":["CR-THX"],"latensi_ms":200}
//   POST /_uji/reset    kosongkan data & hitungan (pengaturan tetap)
import http from "node:http";

const PORT = Number(process.env.PORT) || 2412;
const atur = {
  kunci: process.env.PACS_KUNCI || "kunci-uji-pacs",
  kode_prosedur_dikenal: null, // null = semua kode prosedur dikenal; array = selain itu ditolak (422)
  latensi_ms: 0,
  gagal_setiap: 0, // >0: setiap order ke-N dibalas 500 generik (tidak pasti) tanpa registrasi
  gagal502_accession: [], // accession yang dibalas 502 (proksi) TANPA registrasi → SIMRS: tidak pasti
  gantung_accession: [], // accession yang ditahan gantung_ms sebelum dibalas (simulasi timeout)
  gantung_ms: 120000,
  url_viewer_dasar: "http://localhost:2412/viewer?acc=",
  push_url: null, // URL titik masuk hasil SIMRS, mis. http://localhost:8099/adam-pacs/bridging
  push_kunci: null, // kunci masuk koneksi SIMRS (dikirim sebagai x-api-key saat push)
  push_otomatis_ms: 0, // >0: otomatis push hasil X ms setelah studi terdaftar
};
let studi = new Map(); // accession_number → { no_order, pasien, pemeriksaan, kode_rs, status, hasil, kesan, url_viewer }
let hitung = new Map(); // accession_number → { diterima, terdaftar, ditolak }
let nomorRequestOrder = 0;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const hit = (acc, kunci) => {
  const h = hitung.get(acc) ?? { diterima: 0, terdaftar: 0, ditolak: 0 };
  h[kunci]++;
  hitung.set(acc, h);
};
const kosong = (v) => v === undefined || v === null || String(v).trim() === "";

// Kirim hasil ke titik masuk SIMRS (push). Dipanggil manual lewat /_uji/push atau otomatis (push_otomatis_ms).
const kirimPush = async (acc) => {
  const s = studi.get(acc);
  if (!s) return { ok: false, pesan: `Accession Number ${acc} tidak dikenal di PACS tiruan` };
  if (!atur.push_url) return { ok: false, pesan: "push_url belum diatur (/_uji/atur)" };
  try {
    const res = await fetch(atur.push_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": atur.push_kunci ?? "" },
      body: JSON.stringify({ accession_number: acc, status: s.status, hasil: s.hasil, kesan: s.kesan, url_viewer: s.url_viewer }),
    });
    return { ok: res.ok, pesan: `SIMRS membalas HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, pesan: `Tidak dapat menghubungi SIMRS: ${error.message}` };
  }
};

const server = http.createServer((req, res) => {
  let teks = "";
  req.on("data", (c) => (teks += c));
  req.on("end", async () => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const balas = (status, json) => {
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    };
    let body = {};
    try {
      body = teks ? JSON.parse(teks) : {};
    } catch {
      return balas(400, { success: false, message: "JSON tidak valid" });
    }

    // --- kendali uji ---
    if (url.pathname === "/_uji/hitung") {
      const per = Object.fromEntries([...hitung.entries()].sort());
      const dobel = Object.entries(per).filter(([, h]) => h.terdaftar > 1).map(([k]) => k);
      return balas(200, { jumlah_accession: hitung.size, terdaftar: studi.size, dobel_terdaftar: dobel, per_accession_number: per });
    }
    if (url.pathname === "/_uji/atur" && req.method === "POST") {
      Object.assign(atur, body);
      return balas(200, { success: true, atur });
    }
    if (url.pathname === "/_uji/reset" && req.method === "POST") {
      studi = new Map();
      hitung = new Map();
      nomorRequestOrder = 0;
      return balas(200, { success: true });
    }
    if (url.pathname === "/_uji/push" && req.method === "POST") {
      if (kosong(body.accession_number)) return balas(400, { success: false, message: "accession_number wajib diisi" });
      const s = studi.get(body.accession_number);
      if (!s) return balas(404, { success: false, message: `Accession Number ${body.accession_number} tidak dikenal di PACS tiruan` });
      s.status = body.status || "selesai";
      s.hasil = body.hasil ?? s.hasil ?? "Tiruan: tidak ditemukan kelainan radiologis yang bermakna.";
      s.kesan = body.kesan ?? s.kesan ?? "Tiruan: dalam batas normal.";
      const hasil = await kirimPush(body.accession_number);
      return balas(hasil.ok ? 200 : 502, { success: hasil.ok, message: hasil.pesan });
    }

    if (req.headers["x-api-key"] !== atur.kunci) return balas(401, { success: false, message: "x-api-key tidak valid" });
    if (atur.latensi_ms) await tidur(atur.latensi_ms);

    // --- kirim order (satu item pemeriksaan) ---
    if (url.pathname === "/adam-pacs/order" && req.method === "POST") {
      if (body?.uji === true) return balas(200, { success: true, message: "Uji koneksi berhasil (PACS tiruan)" });
      const acc = body?.accession_number;
      if (kosong(acc)) return balas(400, { success: false, message: "accession_number wajib diisi" });
      hit(acc, "diterima");
      nomorRequestOrder++;

      if (atur.gagal502_accession.includes(acc)) return balas(502, { message: "Bad Gateway" });
      if (atur.gagal_setiap > 0 && nomorRequestOrder % atur.gagal_setiap === 0) return balas(500, { message: "Internal Server Error" });

      const kode = body?.pemeriksaan?.kode_prosedur_pacs;
      if (atur.kode_prosedur_dikenal && !atur.kode_prosedur_dikenal.includes(kode)) {
        hit(acc, "ditolak");
        return balas(422, { success: false, message: `Kode prosedur "${kode}" tidak dikenal di PACS tiruan` });
      }

      if (atur.gantung_accession.includes(acc)) await tidur(atur.gantung_ms);

      let s = studi.get(acc);
      if (!s) {
        s = {
          no_order: body.no_order, pasien: body.pasien, pemeriksaan: body.pemeriksaan, kode_rs: body.kode_rs,
          status: "terdaftar", hasil: null, kesan: null, url_viewer: `${atur.url_viewer_dasar}${encodeURIComponent(acc)}`,
        };
        studi.set(acc, s);
        hit(acc, "terdaftar");
        if (atur.push_otomatis_ms > 0) setTimeout(() => kirimPush(acc), atur.push_otomatis_ms);
      }
      return balas(200, { success: true, message: "Order diterima PACS tiruan", payload: { accession_number: acc, url_viewer: s.url_viewer } });
    }

    // --- ambil hasil / cek status ---
    if (url.pathname === "/adam-pacs/hasil" && req.method === "GET") {
      const acc = url.searchParams.get("accession_number");
      const s = acc ? studi.get(acc) : null;
      if (!s) return balas(404, { success: false, message: `Accession Number ${acc ?? "-"} tidak ditemukan` });
      return balas(200, { success: true, message: "Ditemukan", payload: { status: s.status, hasil: s.hasil, kesan: s.kesan, url_viewer: s.url_viewer } });
    }
    balas(404, { success: false, message: "not found" });
  });
});
server.listen(PORT, () => console.log(`PACS tiruan berjalan di http://localhost:${PORT} (x-api-key: ${atur.kunci})`));
