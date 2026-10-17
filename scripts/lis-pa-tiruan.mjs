#!/usr/bin/env node
// Sistem PA tiruan untuk pengembangan & pengujian Bridging LIS Patologi Anatomi tanpa sistem PA asli
// (lihat scripts/README-lis-pa-tiruan.md). Pola sama dengan scripts/lis-tiruan.mjs (Bridging LIS Laboratorium).
//
//   node scripts/lis-pa-tiruan.mjs                 # port 2313, x-api-key "kunci-uji-pa"
//   PORT=2399 PA_LIS_KUNCI=rahasia node scripts/lis-pa-tiruan.mjs
//
// Endpoint:
//   POST /adam-pa-lis/registrasi                      registrasi kasus (idempoten per no_registrasi)
//   GET  /adam-pa-lis/hasil?no_registrasi=<..>         baca hasil (untuk "Ambil Hasil" / "Cek Status")
// Kendali uji (tanpa kunci):
//   GET  /_uji/hitung   jumlah kemunculan per no_registrasi (diterima) & jumlah registrasi berhasil (terdaftar)
//   POST /_uji/atur     ubah pengaturan (JSON, digabung), mis. {"pemeriksaan_dikenal":["HP-001"],"latensi_ms":200}
//   POST /_uji/reset    kosongkan data & hitungan (pengaturan tetap)
//   POST /_uji/push     dorong hasil/addendum/penolakan ke SIMRS (callback_url & callback_key harus diatur lewat /_uji/atur)
import http from "node:http";

const PORT = Number(process.env.PORT) || 2313;
const atur = {
  kunci: process.env.PA_LIS_KUNCI || "kunci-uji-pa",
  pemeriksaan_dikenal: null, // null = semua kode pemeriksaan dikenal; array = selain itu ditolak "Belum Dimappingkan"
  beri_no_pa_langsung: true, // true = no_pa tersedia langsung di respons registrasi
  latensi_ms: 0,
  gantung_noreg: [], // no_registrasi yang (bila ada) diproses tapi respons ditahan gantung_ms
  gantung_ms: 120000,
  gagal502_noreg: [], // no_registrasi yang dibalas 502 TANPA didaftarkan → SIMRS: tidak pasti, Cek Status: tidak ditemukan
  hasil_siap: true, // GET hasil mengembalikan laporan
  // callback push (POST /_uji/push): alamat & kunci masuk koneksi SIMRS yang dituju
  callback_url: null, // mis. http://localhost:8099/adam-pa-lis/bridging
  callback_key: null,
};
let data = new Map(); // no_registrasi → { no_pa, registrasi }
let hitung = new Map(); // no_registrasi → { diterima, terdaftar }
let urut = 0;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const hit = (noReg, kunci) => {
  const h = hitung.get(noReg) ?? { diterima: 0, terdaftar: 0 };
  h[kunci]++;
  hitung.set(noReg, h);
};
const noPaBaru = (jenis) => {
  const tahun = new Date().getFullYear().toString().slice(2);
  const prefiks = { histopatologi: "PA", sitologi: "SIT", potong_beku: "FS", ihk: "IHK" }[jenis] ?? "PA";
  return `${prefiks}-${tahun}-${String(++urut).padStart(5, "0")}-SIM`;
};
const daftarkan = (body) => {
  const noReg = body?.registrasi?.no_registrasi;
  const ada = data.get(noReg);
  if (ada) return ada; // idempoten per no_registrasi
  const d = { no_pa: atur.beri_no_pa_langsung ? noPaBaru(body?.registrasi?.jenis_pemeriksaan) : null, registrasi: body };
  data.set(noReg, d);
  hit(noReg, "terdaftar");
  return d;
};
const pemeriksaanAsing = (body) => {
  const kode = body?.pemeriksaan?.kode;
  return atur.pemeriksaan_dikenal && kode && !atur.pemeriksaan_dikenal.includes(kode);
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
      return balas(200, { jumlah_noreg: hitung.size, terdaftar: data.size, dobel_terdaftar: dobel, per_no_registrasi: per });
    }
    if (url.pathname === "/_uji/atur" && req.method === "POST") {
      Object.assign(atur, body);
      return balas(200, { success: true, atur });
    }
    if (url.pathname === "/_uji/reset" && req.method === "POST") {
      data = new Map();
      hitung = new Map();
      return balas(200, { success: true });
    }
    // Dorong hasil/addendum/penolakan ke SIMRS: { no_registrasi, ...payload hasil }
    if (url.pathname === "/_uji/push" && req.method === "POST") {
      if (!atur.callback_url || !atur.callback_key) return balas(400, { success: false, message: "callback_url & callback_key belum diatur (POST /_uji/atur)" });
      try {
        const res2 = await fetch(atur.callback_url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": atur.callback_key },
          body: JSON.stringify(body),
        });
        return balas(200, { success: true, status_simrs: res2.status, respons: await res2.json().catch(() => null) });
      } catch (error) {
        return balas(502, { success: false, message: `Gagal memanggil SIMRS: ${error.message}` });
      }
    }

    if (req.headers["x-api-key"] !== atur.kunci) return balas(401, { success: false, message: "x-api-key tidak valid" });
    if (atur.latensi_ms) await tidur(atur.latensi_ms);

    // --- registrasi kasus ---
    if (url.pathname === "/adam-pa-lis/registrasi" && req.method === "POST") {
      const noReg = body?.registrasi?.no_registrasi;
      if (!noReg) return balas(400, { success: false, message: "registrasi.no_registrasi wajib" });
      hit(noReg, "diterima");
      if (atur.gagal502_noreg.includes(noReg)) return balas(502, { message: "Bad Gateway" });
      if (pemeriksaanAsing(body)) {
        return balas(500, { success: false, message: `Pemeriksaan ${body?.pemeriksaan?.nama ?? "-"} (${body?.pemeriksaan?.kode ?? "-"}) Belum Dimappingkan` });
      }
      const d = daftarkan(body);
      if (atur.gantung_noreg.includes(noReg)) await tidur(atur.gantung_ms);
      return balas(200, { success: true, message: "Registrasi berhasil", payload: { no_pa: d.no_pa } });
    }

    // --- baca hasil (ambil hasil / cek status) ---
    if (url.pathname === "/adam-pa-lis/hasil" && req.method === "GET") {
      const noReg = url.searchParams.get("no_registrasi");
      const d = data.get(noReg);
      if (!d) return balas(404, { success: false, message: `Data dengan no_registrasi ${noReg} tidak ditemukan` });
      if (!atur.hasil_siap) return balas(200, { success: true, message: "Belum ada hasil", payload: { no_registrasi: noReg, no_pa: d.no_pa, status: "diproses" } });
      return balas(200, {
        success: true,
        message: "Data ditemukan",
        payload: {
          no_registrasi: noReg, no_pa: d.no_pa, status: "selesai",
          makroskopis: "Jaringan diterima sesuai formulir, difiksasi formalin 10%.",
          mikroskopis: "Gambaran histologik sesuai kasus tiruan.",
          diagnosis: "Diagnosis tiruan server lis-pa-tiruan.mjs",
          icd_o_topografi: "C50.9", icd_o_morfologi: "8500/3",
          dokter_verifikator: { nama: "dr. Tiruan, Sp.PA", sip: "SIP-TIRUAN" },
        },
      });
    }
    balas(404, { success: false, message: "not found" });
  });
});
server.listen(PORT, () => console.log(`Sistem PA tiruan berjalan di http://localhost:${PORT} (x-api-key: ${atur.kunci})`));
