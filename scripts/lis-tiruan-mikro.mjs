#!/usr/bin/env node
// LIS Mikrobiologi tiruan untuk pengembangan & pengujian Bridging LIS Mikrobiologi (STD-0014) tanpa LIS asli
// (lihat scripts/README-lis-tiruan-mikro.md). Berbeda dari scripts/lis-tiruan.mjs (Bridging LIS laboratorium klinik):
// kontrak payload mengikuti penunjang-service/src/mikrobiologi/lis-peta.js (buatRegistrasi), bukan format adamLIS.
//
//   node scripts/lis-tiruan-mikro.mjs
//   PORT=2612 LIS_KUNCI=kunci-uji-mikro SIMRS_CALLBACK=http://localhost:8099/adam-lis/mikrobiologi/bridging SIMRS_KUNCI_MASUK=... node scripts/lis-tiruan-mikro.mjs
//
// Endpoint LIS tiruan (otentikasi x-api-key = LIS_KUNCI, dipasang di Konfigurasi LIS Mikrobiologi):
//   POST /registrasi                     registrasi order (idempoten per no_registrasi)
//   GET  /hasil?no_registrasi=...        ambil hasil terakhir yang "diterbitkan" (dipakai tombol Ambil Hasil LIS)
// Kendali uji (tanpa kunci):
//   GET  /_uji/hitung                    daftar order terdaftar & jumlah percobaan registrasi per no_registrasi
//   POST /_uji/reset                     kosongkan data
//   POST /_uji/dorong                    kirim (push) hasil ke SIMRS_CALLBACK untuk satu no_registrasi, body:
//                                         { no_registrasi, jenis: "sementara"|"final"|"isolat_ganda"|"antibiotik_tak_dikenal",
//                                           kode_pemeriksaan_lis? }
import http from "node:http";

const PORT = Number(process.env.PORT) || 2612;
const KUNCI_LIS = process.env.LIS_KUNCI || "kunci-uji-mikro";
// URL push & kunci masuk koneksi SIMRS — dipasang saat koneksi dibuat di Setting › Konfigurasi Integrasi.
const SIMRS_CALLBACK = process.env.SIMRS_CALLBACK || "http://localhost:8099/adam-lis/mikrobiologi/bridging";
const SIMRS_KUNCI_MASUK = process.env.SIMRS_KUNCI_MASUK || "";

let order = new Map(); // no_registrasi → { payload registrasi, percobaan, hasilTerakhir }
let urutIsolat = 0;

const kosong = (v) => v === undefined || v === null || String(v).trim() === "";

const registrasikan = (body) => {
  const noReg = body?.registrasi?.no_registrasi;
  const ada = order.get(noReg);
  if (ada) {
    ada.percobaan++;
    return ada; // idempoten: percobaan bertambah, tetapi tidak membuat order baru
  }
  const d = { payload: body, percobaan: 1, hasilTerakhir: null, noRegistrasiLis: `MB${String(++urutIsolat).padStart(6, "0")}` };
  order.set(noReg, d);
  return d;
};

// Payload push sesuai kontrak penunjang-service/src/mikrobiologi/lis-peta.js (petakanIsolat).
const buatHasil = (noReg, jenis, kodePemeriksaanLis) => {
  const base = { no_registrasi: noReg, identitas_hasil_lis: `${noReg}-${jenis}-${Date.now()}`, kode_pemeriksaan_lis: kodePemeriksaanLis || undefined };
  if (jenis === "sementara") {
    return { ...base, status: "sementara", pewarnaan: { jenis: "gram", hasil_pewarnaan: "Batang Gram negatif, tunggal-berpasangan" }, laporan_sementara: "Gram negatif batang. Kultur dalam proses inkubasi." };
  }
  if (jenis === "antibiotik_tak_dikenal") {
    return {
      ...base, status: "final", kultur: { status: "tumbuh" },
      isolat: [{ identitas_isolat: "1", organisme: { kode: "ECO", nama: "Escherichia coli" }, jumlah_koloni: ">10^5 CFU/mL",
        kepekaan: [{ antibiotik: { kode: "MEM", nama: "Meropenem" }, mic: "0.25", interpretasi: "S" },
                   { antibiotik: { kode: "XX-ASING", nama: "Antibiotik Tidak Dikenal" }, zona: 18, interpretasi: "I" }] }],
    };
  }
  if (jenis === "isolat_ganda") {
    return {
      ...base, status: "final", kultur: { status: "tumbuh" },
      isolat: [
        { identitas_isolat: "1", organisme: { kode: "ECO", nama: "Escherichia coli" }, jumlah_koloni: ">10^5 CFU/mL",
          kepekaan: [{ antibiotik: { kode: "MEM", nama: "Meropenem" }, mic: "0.25", interpretasi: "S" }, { antibiotik: { kode: "CRO", nama: "Seftriakson" }, zona: 12, interpretasi: "R" }] },
        { identitas_isolat: "2", organisme: { kode: "SAU", nama: "Staphylococcus aureus" }, jumlah_koloni: "10^4 CFU/mL",
          kepekaan: [{ antibiotik: { kode: "MEM", nama: "Meropenem" }, mic: "1", interpretasi: "S" }] },
      ],
    };
  }
  // final (satu isolat)
  return {
    ...base, status: "final", kultur: { status: "tumbuh", media: "Agar darah, MacConkey" },
    isolat: [{ identitas_isolat: "1", organisme: { kode: "ECO", nama: "Escherichia coli" }, jumlah_koloni: ">10^5 CFU/mL",
      kepekaan: [{ antibiotik: { kode: "MEM", nama: "Meropenem" }, mic: "0.25", interpretasi: "S" }, { antibiotik: { kode: "CRO", nama: "Seftriakson" }, zona: 12, interpretasi: "R" }] }],
  };
};

const dorongKeSimrs = async (payload) => {
  const res = await fetch(SIMRS_CALLBACK, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": SIMRS_KUNCI_MASUK },
    body: JSON.stringify(payload),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = { success: false, message: `Respons SIMRS bukan JSON (HTTP ${res.status})` };
  }
  return { status: res.status, json };
};

const server = http.createServer((req, res) => {
  let teks = "";
  req.on("data", (c) => (teks += c));
  req.on("end", async () => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const balas = (status, json) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    };
    let body = {};
    try {
      body = teks ? JSON.parse(teks) : {};
    } catch {
      return balas(400, { success: false, message: "JSON tidak valid" });
    }

    if (url.pathname === "/_uji/hitung") {
      return balas(200, { jumlah: order.size, data: [...order.entries()].map(([k, v]) => ({ no_registrasi: k, percobaan: v.percobaan, no_registrasi_lis: v.noRegistrasiLis })) });
    }
    if (url.pathname === "/_uji/reset" && req.method === "POST") {
      order = new Map();
      return balas(200, { success: true });
    }
    if (url.pathname === "/_uji/dorong" && req.method === "POST") {
      const noReg = body?.no_registrasi;
      if (!noReg || !order.has(noReg)) return balas(404, { success: false, message: `no_registrasi ${noReg ?? "-"} belum terdaftar` });
      if (!SIMRS_KUNCI_MASUK) return balas(422, { success: false, message: "SIMRS_KUNCI_MASUK belum diatur (env) — isi kunci masuk koneksi LIS Mikrobiologi dari SIMRS" });
      const payload = buatHasil(noReg, body?.jenis || "final", body?.kode_pemeriksaan_lis);
      order.get(noReg).hasilTerakhir = payload;
      try {
        const { status, json } = await dorongKeSimrs(payload);
        return balas(200, { success: true, dikirim: payload, respons_simrs: { status, json } });
      } catch (error) {
        return balas(502, { success: false, message: `Gagal menghubungi SIMRS: ${error.message}` });
      }
    }

    if (req.headers["x-api-key"] !== KUNCI_LIS) return balas(401, { success: false, message: "x-api-key tidak valid" });

    if (url.pathname === "/registrasi" && req.method === "POST") {
      if (kosong(body?.registrasi?.no_registrasi)) return balas(400, { success: false, message: "registrasi.no_registrasi wajib diisi" });
      const d = registrasikan(body);
      return balas(200, { success: true, message: "Registrasi berhasil", payload: { no_registrasi_lis: d.noRegistrasiLis, percobaan: d.percobaan } });
    }
    if (url.pathname === "/hasil" && req.method === "GET") {
      const noReg = url.searchParams.get("no_registrasi");
      const d = order.get(noReg);
      if (!d) return balas(404, { success: false, message: `Order dengan no_registrasi ${noReg} tidak ditemukan` });
      if (!d.hasilTerakhir) return balas(404, { success: false, message: "Hasil belum tersedia" });
      return balas(200, { success: true, message: "Hasil ditemukan", payload: d.hasilTerakhir });
    }
    balas(404, { success: false, message: "not found" });
  });
});
server.listen(PORT, () => console.log(`LIS Mikrobiologi tiruan berjalan di http://localhost:${PORT} (x-api-key: ${KUNCI_LIS})`));
