#!/usr/bin/env node
// Marketplace mitra tiruan untuk pengembangan & pengujian Pembelian via Marketplace (STD-0019) tanpa mitra asli
// (lihat scripts/README-marketplace-tiruan.md). Kontrak mengikuti
// inventory-service/src/services/marketplace-adapter-service.js.
//
//   node scripts/marketplace-tiruan.mjs                      # port 2414, kunci "kunci-uji-marketplace"
//   PORT=2499 MARKETPLACE_KUNCI=rahasia node scripts/marketplace-tiruan.mjs
//
// Endpoint (dipanggil SIMRS, butuh header x-api-key = API key koneksi):
//   GET  /produk?q=&limit=                    cari penawaran produk (BMHP fiktif)
//   POST /pesanan                             checkout, idempoten per header Idempotency-Key
//   GET  /pesanan/:nomor_pesanan_mitra         status & tagihan pesanan terkini
// Push status ke SIMRS (titik masuk /api/v3/inventory/marketplace/webhook/:koneksi_uuid, kunci masuk per koneksi):
//   POST /_uji/push   { nomor_pesanan_mitra, status } — kirim sekarang
// Kendali uji (tanpa kunci):
//   GET  /_uji/hitung   jumlah pesanan & percobaan checkout per Idempotency-Key
//   POST /_uji/atur     ubah pengaturan (JSON, digabung), mis. {"latensi_ms":200}
//   POST /_uji/reset    kosongkan data & hitungan (pengaturan & katalog tetap)
import http from "node:http";

const PORT = Number(process.env.PORT) || 2414;
const atur = {
  kunci: process.env.MARKETPLACE_KUNCI || "kunci-uji-marketplace",
  latensi_ms: 0,
  gagal_setiap: 0, // >0: setiap percobaan checkout ke-N dibalas 500 generik (tidak pasti) — uji G7/KT-8
  stok_habis: [], // produk_mitra_id yang stoknya dipaksa 0 (tidak bisa dipesan) — uji G5
  push_url: null, // URL webhook SIMRS, mis. http://localhost:8086/api/v3/inventory/marketplace/webhook/<koneksi_uuid>
  push_kunci: null, // kunci masuk koneksi SIMRS (dikirim sebagai x-api-key saat push)
  status_checkout: "dibayar", // status awal yang dibalas saat checkout berhasil
};

// Katalog contoh BMHP (data fiktif, bukan data faskes/pasien nyata).
const KATALOG_AWAL = [
  { produk_mitra_id: "P-001", nama: "Spuit 3 ml", kemasan: "Box isi 100", harga: 45000, stok: 500, estimasi_kirim: "1-2 hari" },
  { produk_mitra_id: "P-002", nama: "Kasa Steril 16x16", kemasan: "Box isi 50", harga: 60000, stok: 300, estimasi_kirim: "1-2 hari" },
  { produk_mitra_id: "P-003", nama: "Infus Set Dewasa", kemasan: "Box isi 25", harga: 125000, stok: 150, estimasi_kirim: "2-3 hari" },
  { produk_mitra_id: "P-004", nama: "Sarung Tangan Non Steril M", kemasan: "Box isi 100", harga: 55000, stok: 800, estimasi_kirim: "1-2 hari" },
  { produk_mitra_id: "P-005", nama: "APD Hazmat Level 2", kemasan: "Pack isi 10", harga: 350000, stok: 40, estimasi_kirim: "3-5 hari" },
];

let katalog = KATALOG_AWAL.map((p) => ({ ...p }));
let pesananByIdempotency = new Map(); // idempotency_key -> pesanan
let pesananByNomor = new Map(); // nomor_pesanan_mitra -> pesanan
let hitung = new Map(); // idempotency_key -> { checkout_coba }
let nomorPesanan = 0;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const kosong = (v) => v === undefined || v === null || String(v).trim() === "";
const hit = (key) => {
  const h = hitung.get(key) ?? { checkout_coba: 0 };
  h.checkout_coba++;
  hitung.set(key, h);
  return h;
};

const tagihanContoh = (pesanan) => ({
  referensi_tagihan: `INV-${pesanan.nomor_pesanan_mitra}`,
  nilai: pesanan.total,
  tanggal: Math.floor(Date.now() / 1000),
  status_dikonfirmasi: "belum",
});

const kirimPush = async (nomorPesananMitra, status) => {
  const pesanan = pesananByNomor.get(nomorPesananMitra);
  if (!pesanan) return { ok: false, pesan: `Pesanan ${nomorPesananMitra} tidak dikenal di marketplace tiruan` };
  if (!atur.push_url) return { ok: false, pesan: "push_url belum diatur (/_uji/atur)" };
  pesanan.status = status || pesanan.status;
  try {
    const res = await fetch(atur.push_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": atur.push_kunci ?? "" },
      body: JSON.stringify({
        nomor_pesanan_mitra: nomorPesananMitra,
        status: pesanan.status,
        peristiwa_id: `${nomorPesananMitra}:${pesanan.status}:${Date.now()}`,
        tagihan: tagihanContoh(pesanan),
      }),
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
      return balas(400, { message: "JSON tidak valid" });
    }

    // --- kendali uji ---
    if (url.pathname === "/_uji/hitung") {
      const per = Object.fromEntries([...hitung.entries()].sort());
      return balas(200, { jumlah_pesanan: pesananByNomor.size, per_idempotency_key: per });
    }
    if (url.pathname === "/_uji/atur" && req.method === "POST") {
      Object.assign(atur, body);
      return balas(200, { success: true, atur });
    }
    if (url.pathname === "/_uji/reset" && req.method === "POST") {
      katalog = KATALOG_AWAL.map((p) => ({ ...p }));
      pesananByIdempotency = new Map();
      pesananByNomor = new Map();
      hitung = new Map();
      nomorPesanan = 0;
      return balas(200, { success: true });
    }
    if (url.pathname === "/_uji/push" && req.method === "POST") {
      if (kosong(body.nomor_pesanan_mitra)) return balas(400, { message: "nomor_pesanan_mitra wajib diisi" });
      const hasil = await kirimPush(body.nomor_pesanan_mitra, body.status);
      return balas(hasil.ok ? 200 : 502, { message: hasil.pesan });
    }

    if (req.headers["x-api-key"] !== atur.kunci) return balas(401, { message: "x-api-key tidak valid" });
    if (atur.latensi_ms) await tidur(atur.latensi_ms);

    // --- cari penawaran ---
    if (url.pathname === "/produk" && req.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const limit = Number(url.searchParams.get("limit")) || 20;
      const items = katalog
        .filter((p) => !q || p.nama.toLowerCase().includes(q))
        .map((p) => ({ ...p, stok: atur.stok_habis.includes(p.produk_mitra_id) ? 0 : p.stok }))
        .slice(0, limit);
      return balas(200, { message: "Penawaran ditemukan", payload: { items } });
    }

    // --- checkout (idempoten per Idempotency-Key) ---
    if (url.pathname === "/pesanan" && req.method === "POST") {
      const idempotencyKey = req.headers["idempotency-key"];
      if (kosong(idempotencyKey)) return balas(400, { message: "Header Idempotency-Key wajib diisi" });

      const ada = pesananByIdempotency.get(idempotencyKey);
      if (ada) return balas(200, { message: "Pesanan sudah ada (idempoten)", payload: ada });

      const h = hit(idempotencyKey);
      if (atur.gagal_setiap > 0 && h.checkout_coba % atur.gagal_setiap === 0) {
        return balas(500, { message: "Internal Server Error (tiruan: hasil tidak pasti)" });
      }

      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return balas(400, { message: "items wajib diisi" });
      for (const item of items) {
        const produk = katalog.find((p) => p.produk_mitra_id === item.produk_mitra_id);
        if (!produk) return balas(404, { message: `Produk ${item.produk_mitra_id} tidak ditemukan` });
        const stokTersedia = atur.stok_habis.includes(produk.produk_mitra_id) ? 0 : produk.stok;
        if (item.jumlah > stokTersedia) return balas(409, { message: `Stok ${produk.nama} tidak mencukupi (tersedia ${stokTersedia})` });
      }

      nomorPesanan++;
      const nomorPesananMitra = `MPT-${String(nomorPesanan).padStart(6, "0")}`;
      const total = items.reduce((acc, i) => acc + Number(i.jumlah) * Number(i.harga_satuan), 0);
      const pesanan = { nomor_pesanan_mitra: nomorPesananMitra, status: atur.status_checkout, total, items, catatan: body.catatan ?? null };
      pesanan.tagihan = tagihanContoh(pesanan);
      pesananByIdempotency.set(idempotencyKey, pesanan);
      pesananByNomor.set(nomorPesananMitra, pesanan);
      return balas(200, { message: "Checkout berhasil (marketplace tiruan)", payload: pesanan });
    }

    // --- status pesanan (sinkron tarik) ---
    if (url.pathname.startsWith("/pesanan/") && req.method === "GET") {
      const nomorPesananMitra = decodeURIComponent(url.pathname.split("/").pop());
      const pesanan = pesananByNomor.get(nomorPesananMitra);
      if (!pesanan) return balas(404, { message: `Pesanan ${nomorPesananMitra} tidak ditemukan` });
      return balas(200, { message: "Status ditemukan", payload: { status: pesanan.status, tagihan: pesanan.tagihan } });
    }

    balas(404, { message: "not found" });
  });
});
server.listen(PORT, () => console.log(`Marketplace tiruan berjalan di http://localhost:${PORT} (x-api-key: ${atur.kunci})`));
