#!/usr/bin/env node
// HDIS (Hemodialysis Information System) tiruan untuk pengembangan & pengujian Bridging HDIS Unit Hemodialisa
// (STD-0033) tanpa HDIS vendor (lihat scripts/README-hdis-tiruan.md). Kontrak mengikuti
// penunjang-service/src/hemodialisa/hdis/kirim.js (jadwal keluar) & hdis/terima.js (parameter masuk). Data fiktif saja.
//
//   node scripts/hdis-tiruan.mjs                       # port 2416, x-api-key "kunci-uji-hdis"
//   PORT=2499 HDIS_KUNCI=rahasia node scripts/hdis-tiruan.mjs
//
// Endpoint (dipanggil SIMRS, butuh header x-api-key = API key koneksi):
//   POST /api/jadwal        terima jadwal + data pasien minimum (idempoten per header Idempotency-Key / kunci_idempoten;
//                           aksi "batal" menandai jadwal batal). Body {"uji":true} = uji koneksi.
// Push parameter ke SIMRS (titik masuk /adam-hdis/bridging, kunci masuk per koneksi):
//   POST /_uji/push         { kode_jadwal_simrs?, kunci_idempoten?, parameter?, kode_mesin_hdis?, waktu_pengukuran? }
//                           kode_jadwal_simrs bawaan = jadwal terakhir yang diterima; kunci bawaan acak (pesan baru)
//   POST /_uji/push-seri    { kode_jadwal_simrs?, jumlah: 4, interval_menit: 30 } — seri pengukuran mundur dari sekarang
// Kendali uji (tanpa kunci):
//   GET  /_uji/jadwal       jadwal tersimpan + hitungan diterima/terdaftar/duplikat/ditolak
//   POST /_uji/atur         ubah pengaturan (digabung), mis. {"push_url":"http://localhost:8099/adam-hdis/bridging","push_kunci":"..."}
//   POST /_uji/reset        kosongkan data & hitungan (pengaturan tetap)
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT) || 2416;
const atur = {
  kunci: process.env.HDIS_KUNCI || "kunci-uji-hdis",
  mesin_dikenal: null, // null = semua kode mesin diterima; array = selain itu ditolak 422
  latensi_ms: 0, // jeda sebelum menjawab (uji batas waktu SIMRS → status tidak pasti)
  gagal_setiap: 0, // >0: setiap jadwal ke-N dijawab 503 TANPA diproses (uji status tidak pasti)
  push_url: null, // titik masuk SIMRS, mis. http://localhost:8099/adam-hdis/bridging
  push_kunci: null, // kunci masuk koneksi SIMRS (dikirim sebagai x-api-key)
};
let jadwal = new Map(); // kode_jadwal_simrs → jadwal terakhir
let kunciTerlihat = new Map(); // Idempotency-Key → jawaban sebelumnya
let hitung = { diterima: 0, terdaftar: 0, duplikat: 0, ditolak: 0 };
let nomorMasuk = 0;
let terakhir = null;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// Parameter contoh (satuan mengikuti skema SIMRS, lihat GET /api/v3/penunjang/hemodialisa/referensi).
const parameterContoh = () => ({
  td_sistolik: 130,
  td_diastolik: 80,
  nadi: 84,
  qb_ml_menit: 250,
  qd_ml_menit: 500,
  uf_volume_ml: 600,
  uf_rate_ml_jam: 600,
  tmp_mmhg: 120,
  tekanan_arteri_mmhg: -150,
  tekanan_vena_mmhg: 140,
});

const push = async (pesan) => {
  if (!atur.push_url) return { status: 409, json: { message: "push_url belum diatur (/_uji/atur)" } };
  try {
    const res = await fetch(atur.push_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": atur.push_kunci ?? "" },
      body: JSON.stringify(pesan),
    });
    return { status: res.status, json: await res.json().catch(() => ({ message: `SIMRS membalas HTTP ${res.status} (bukan JSON)` })) };
  } catch (error) {
    return { status: 502, json: { message: `Tidak dapat menghubungi SIMRS: ${error.message}` } };
  }
};

const pesanParameter = (body, waktu) => {
  const kode = body.kode_jadwal_simrs ?? terakhir;
  return {
    kode_jadwal_simrs: kode,
    kunci_idempoten: body.kunci_idempoten ?? `hdis-${crypto.randomUUID()}`,
    waktu_pengukuran: waktu ?? body.waktu_pengukuran ?? Math.floor(Date.now() / 1000),
    kode_mesin_hdis: body.kode_mesin_hdis ?? jadwal.get(kode)?.jadwal?.kode_mesin_hdis ?? undefined,
    parameter: body.parameter ?? parameterContoh(),
  };
};

const server = http.createServer((req, res) => {
  let teks = "";
  req.on("data", (c) => {
    teks += c;
    if (teks.length > 1024 * 1024) req.destroy();
  });
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
    if (url.pathname === "/_uji/jadwal") return balas(200, { hitung, jadwal: [...jadwal.values()] });
    if (url.pathname === "/_uji/atur" && req.method === "POST") {
      Object.assign(atur, body);
      return balas(200, { success: true, atur: { ...atur, push_kunci: atur.push_kunci ? "••••" : null } });
    }
    if (url.pathname === "/_uji/reset" && req.method === "POST") {
      jadwal = new Map();
      kunciTerlihat = new Map();
      hitung = { diterima: 0, terdaftar: 0, duplikat: 0, ditolak: 0 };
      nomorMasuk = 0;
      terakhir = null;
      return balas(200, { success: true });
    }
    if (url.pathname === "/_uji/push" && req.method === "POST") {
      const pesan = pesanParameter(body);
      if (!pesan.kode_jadwal_simrs) return balas(409, { message: "Belum ada jadwal diterima; isi kode_jadwal_simrs" });
      const hasil = await push(pesan);
      return balas(hasil.status, { dikirim: pesan, simrs: hasil.json });
    }
    if (url.pathname === "/_uji/push-seri" && req.method === "POST") {
      const jumlah = Math.min(Math.max(Number(body.jumlah) || 4, 1), 48);
      const interval = Math.max(Number(body.interval_menit) || 30, 1) * 60;
      const kini = Math.floor(Date.now() / 1000);
      const hasil = [];
      for (let i = jumlah - 1; i >= 0; i--) {
        const pesan = pesanParameter({ ...body, kunci_idempoten: undefined }, kini - i * interval);
        const r = await push(pesan);
        hasil.push({ waktu_pengukuran: pesan.waktu_pengukuran, status: r.status, pesan: r.json?.message });
      }
      return balas(200, { hasil });
    }

    if (req.headers["x-api-key"] !== atur.kunci) return balas(401, { success: false, message: "x-api-key tidak valid" });
    if (atur.latensi_ms) await tidur(atur.latensi_ms);

    if (url.pathname === "/api/jadwal" && req.method === "POST") {
      if (body?.uji === true) return balas(200, { success: true, message: "Uji koneksi berhasil (HDIS tiruan)" });
      hitung.diterima++;
      nomorMasuk++;
      if (atur.gagal_setiap > 0 && nomorMasuk % atur.gagal_setiap === 0) return balas(503, { message: "Service Unavailable" });
      const kunci = req.headers["idempotency-key"] || body?.kunci_idempoten;
      const kode = body?.jadwal?.kode_jadwal_simrs;
      if (!kunci || !kode) {
        hitung.ditolak++;
        return balas(400, { success: false, message: "kunci_idempoten dan jadwal.kode_jadwal_simrs wajib diisi" });
      }
      if (kunciTerlihat.has(kunci)) {
        hitung.duplikat++;
        return balas(200, { ...kunciTerlihat.get(kunci), duplikat: true });
      }
      const mesin = body.jadwal.kode_mesin_hdis;
      if (atur.mesin_dikenal && !atur.mesin_dikenal.includes(mesin)) {
        hitung.ditolak++;
        return balas(422, { success: false, message: `Kode mesin "${mesin}" tidak dikenal di HDIS tiruan` });
      }
      jadwal.set(kode, { ...body, status_hdis: body.aksi === "batal" ? "batal" : "terjadwal", diterima_pada: Math.floor(Date.now() / 1000) });
      if (body.aksi !== "batal") terakhir = kode;
      hitung.terdaftar++;
      const jawaban = { success: true, message: body.aksi === "batal" ? "Pembatalan jadwal diterima HDIS tiruan" : "Jadwal diterima HDIS tiruan", payload: { kode_jadwal_simrs: kode } };
      kunciTerlihat.set(kunci, jawaban);
      return balas(200, jawaban);
    }
    balas(404, { success: false, message: "Rute tiruan tidak ditemukan" });
  });
});
server.listen(PORT, () => console.log(`HDIS tiruan berjalan di http://localhost:${PORT} (x-api-key: ${atur.kunci})`));
