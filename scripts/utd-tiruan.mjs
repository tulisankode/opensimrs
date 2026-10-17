#!/usr/bin/env node
// UTD tiruan untuk pengembangan & pengujian Bridging Bank Darah ke UTD (STD-0017) tanpa UTD asli
// (lihat scripts/README-utd-tiruan.md). Kontrak mengikuti penunjang-service/src/bank-darah/utd/adapter-generik.js.
//
//   node scripts/utd-tiruan.mjs                      # port 2413, kunci "kunci-uji-utd"
//   PORT=2499 UTD_KUNCI=rahasia node scripts/utd-tiruan.mjs
//
// Endpoint (dipanggil SIMRS, butuh header x-api-key = API key koneksi):
//   POST /adam-utd/permintaan              kirim permintaan darah (idempoten per no_registrasi)
//   GET  /adam-utd/status/:no_registrasi   status & data kantong terkini — dipakai "Cek Status" & "Ambil Status UTD"
//   GET  /adam-utd/stok                    stok UTD (opsional; ?golongan_abo=&rhesus=&kode_komponen=)
// Push hasil ke SIMRS (titik masuk /adam-utd/bridging, kunci masuk per koneksi):
//   POST /_uji/push   { no_registrasi, status?, kantong? } — kirim sekarang (kantong default: yang sudah diatur)
// Kendali uji (tanpa kunci):
//   GET  /_uji/hitung   jumlah "diterima"/"terdaftar"/"ditolak" per no_registrasi
//   POST /_uji/atur     ubah pengaturan (JSON, digabung), mis. {"komponen_dikenal":["PRC"],"latensi_ms":200}
//   POST /_uji/reset    kosongkan data & hitungan (pengaturan tetap)
import http from "node:http";

const PORT = Number(process.env.PORT) || 2413;
const atur = {
  kunci: process.env.UTD_KUNCI || "kunci-uji-utd",
  komponen_dikenal: null, // null = semua kode komponen dikenal; array = selain itu ditolak (422) — uji KT-19
  latensi_ms: 0,
  gagal_setiap: 0, // >0: setiap permintaan ke-N dibalas 500 generik (tidak pasti) tanpa registrasi
  gagal502_registrasi: [], // no_registrasi yang dibalas 502 (proksi) TANPA diproses → SIMRS: tidak pasti
  gantung_registrasi: [], // no_registrasi yang ditahan gantung_ms sebelum dibalas (simulasi timeout)
  gantung_ms: 120000,
  imltd_bawaan: "non_reaktif", // status IMLTD bawaan untuk kantong yang dibuat /_uji/atur-kantong
  push_url: null, // URL titik masuk hasil SIMRS, mis. http://localhost:8099/adam-utd/bridging
  push_kunci: null, // kunci masuk koneksi SIMRS (dikirim sebagai x-api-key/?key= saat push)
  push_otomatis_ms: 0, // >0: otomatis push status "siap" + kantong contoh X ms setelah permintaan terdaftar
};
let registrasi = new Map(); // no_registrasi → { ...permintaan, status, kantong: [] }
let hitung = new Map(); // no_registrasi → { diterima, terdaftar, ditolak }
let nomorRequestMasuk = 0;
let nomorUtd = 0;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const hit = (noReg, kunci) => {
  const h = hitung.get(noReg) ?? { diterima: 0, terdaftar: 0, ditolak: 0 };
  h[kunci]++;
  hitung.set(noReg, h);
};
const kosong = (v) => v === undefined || v === null || String(v).trim() === "";

// Kantong contoh yang dipakai push otomatis / /_uji/push bila body.kantong tidak diisi — satu kantong non-reaktif
// sesuai komponen & golongan yang diminta, dengan kedaluwarsa 30 hari ke depan.
const kantongContoh = (r) => [
  {
    no_kantong: `UTD-${r.no_registrasi}-1`,
    kode_komponen: r.komponen?.kode_utd,
    golongan_abo: r.pasien?.golongan_abo ?? "O",
    rhesus: r.pasien?.rhesus ?? "positif",
    volume_ml: 250,
    tanggal_produksi: Math.floor(Date.now() / 1000),
    tanggal_kedaluwarsa: Math.floor(Date.now() / 1000) + 30 * 86400,
    imltd: atur.imltd_bawaan,
    crossmatch: { hasil: "kompatibel", catatan: "Tiruan: crossmatch UTD (informasional)" },
  },
];

const kirimPush = async (noReg, { status, kantong } = {}) => {
  const r = registrasi.get(noReg);
  if (!r) return { ok: false, pesan: `No. Registrasi ${noReg} tidak dikenal di UTD tiruan` };
  if (!atur.push_url) return { ok: false, pesan: "push_url belum diatur (/_uji/atur)" };
  r.status = status || r.status || "siap";
  r.kantong = kantong ?? (r.kantong?.length ? r.kantong : kantongContoh(r));
  try {
    const url = new URL(atur.push_url);
    if (atur.push_kunci && !url.searchParams.get("key")) url.searchParams.set("key", atur.push_kunci);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": atur.push_kunci ?? "" },
      body: JSON.stringify({ no_registrasi: noReg, status: r.status, pesan: "Tiruan: status diperbarui", kantong: r.kantong }),
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
      return balas(200, { jumlah_registrasi: hitung.size, terdaftar: registrasi.size, per_registrasi: per });
    }
    if (url.pathname === "/_uji/atur" && req.method === "POST") {
      Object.assign(atur, body);
      return balas(200, { success: true, atur });
    }
    if (url.pathname === "/_uji/reset" && req.method === "POST") {
      registrasi = new Map();
      hitung = new Map();
      nomorRequestMasuk = 0;
      nomorUtd = 0;
      return balas(200, { success: true });
    }
    if (url.pathname === "/_uji/push" && req.method === "POST") {
      if (kosong(body.no_registrasi)) return balas(400, { success: false, message: "no_registrasi wajib diisi" });
      const hasil = await kirimPush(body.no_registrasi, { status: body.status, kantong: body.kantong });
      return balas(hasil.ok ? 200 : 502, { success: hasil.ok, message: hasil.pesan });
    }

    if (req.headers["x-api-key"] !== atur.kunci) return balas(401, { success: false, message: "x-api-key tidak valid" });
    if (atur.latensi_ms) await tidur(atur.latensi_ms);

    // --- kirim permintaan ---
    if (url.pathname === "/adam-utd/permintaan" && req.method === "POST") {
      if (body?.uji === true) return balas(200, { success: true, message: "Uji koneksi berhasil (UTD tiruan)" });
      const noReg = body?.no_registrasi;
      if (kosong(noReg)) return balas(400, { success: false, message: "no_registrasi wajib diisi" });
      hit(noReg, "diterima");
      nomorRequestMasuk++;

      if (atur.gagal502_registrasi.includes(noReg)) return balas(502, { message: "Bad Gateway" });
      if (atur.gagal_setiap > 0 && nomorRequestMasuk % atur.gagal_setiap === 0) return balas(500, { message: "Internal Server Error" });

      const kode = body?.komponen?.kode_utd;
      if (atur.komponen_dikenal && !atur.komponen_dikenal.includes(kode)) {
        hit(noReg, "ditolak");
        return balas(422, { success: false, message: `Kode komponen "${kode}" tidak dikenal di UTD tiruan` });
      }

      if (atur.gantung_registrasi.includes(noReg)) await tidur(atur.gantung_ms);

      let r = registrasi.get(noReg);
      if (!r) {
        r = { ...body, status: "diterima", kantong: [] };
        registrasi.set(noReg, r);
        hit(noReg, "terdaftar");
        nomorUtd++;
        r.no_registrasi_utd = `UTD-${String(nomorUtd).padStart(6, "0")}`;
        if (atur.push_otomatis_ms > 0) setTimeout(() => kirimPush(noReg, { status: "siap" }), atur.push_otomatis_ms);
      }
      return balas(200, { success: true, message: "Permintaan diterima UTD tiruan", payload: { no_registrasi_utd: r.no_registrasi_utd, status: r.status } });
    }

    // --- status/kantong (Cek Status & Ambil Status UTD) ---
    if (url.pathname.startsWith("/adam-utd/status") && req.method === "GET") {
      const noReg = url.pathname.split("/").pop() !== "status" ? decodeURIComponent(url.pathname.split("/").pop()) : url.searchParams.get("no_registrasi");
      const r = noReg ? registrasi.get(noReg) : null;
      if (!r) return balas(404, { success: false, message: `No. Registrasi ${noReg ?? "-"} tidak ditemukan` });
      return balas(200, { success: true, message: "Ditemukan", payload: { no_registrasi: noReg, status: r.status, pesan: "Tiruan: status terkini", kantong: r.kantong } });
    }

    // --- cek stok (opsional) ---
    if (url.pathname === "/adam-utd/stok" && req.method === "GET") {
      const golongan = url.searchParams.get("golongan_abo");
      const rhesus = url.searchParams.get("rhesus");
      const komponen = url.searchParams.get("kode_komponen");
      return balas(200, {
        success: true,
        payload: { stok: [{ kode_komponen: komponen || "PRC", golongan_abo: golongan || "O", rhesus: rhesus || "positif", jumlah: 5 }] },
      });
    }
    balas(404, { success: false, message: "not found" });
  });
});
server.listen(PORT, () => console.log(`UTD tiruan berjalan di http://localhost:${PORT} (x-api-key: ${atur.kunci})`));
