#!/usr/bin/env node
// adamLIS tiruan untuk pengembangan & pengujian bridging LIS tanpa server LIS asli (lihat scripts/README-lis-tiruan.md).
//
//   node scripts/lis-tiruan.mjs                 # port 2312, kunci "kunci-uji-lis"
//   PORT=2399 LIS_KUNCI=rahasia node scripts/lis-tiruan.mjs
//
// Endpoint (meniru adamLIS / gateway bridging MCU):
//   POST /adam-lis/bridging_sim_rs/registrasi                       registrasi per order
//   POST /adam-lis/api/v1/registrasi_bulk_mcu/create?kode_rs&kode_lab  registrasi bulk MCU (semua-atau-tidak-sama-sekali)
//   GET  /api/v1/arsip/bridging/read?no_reg_rs=<no_registrasi>      baca registrasi + hasil (untuk "Ambil Hasil" / "Cek Status")
// Kendali uji (tanpa kunci):
//   GET  /_uji/hitung   jumlah kemunculan per no_registrasi (diterima) & jumlah registrasi berhasil (terdaftar)
//   POST /_uji/atur     ubah pengaturan (JSON, digabung), mis. {"tindakan_dikenal":["LAB-001"],"rm_terdaftar":["RM1"],"latensi_ms":200}
//   POST /_uji/reset    kosongkan data & hitungan (pengaturan tetap)
import http from "node:http";

const PORT = Number(process.env.PORT) || 2312;
const atur = {
  kunci: process.env.LIS_KUNCI || "kunci-uji-lis",
  kode_rs: null, // null = semua kode_rs diterima
  kode_lab: null, // null = semua kode_lab diterima (bulk tetap wajib mengirim kode_lab)
  tindakan_dikenal: null, // null = semua kode tindakan dikenal; array = selain itu "Belum Dimappingkan"
  unit_dikenal: null, // null = semua unit dikenal
  rm_terdaftar: [], // no_rm yang dianggap sudah ada di LIS → 409 pada bulk
  duplikat_rm_lintas: false, // true = no_rm yang pernah terdaftar lewat bulk juga memicu 409
  latensi_ms: 0,
  gantung_noreg: [], // no_registrasi yang (bila ada dalam request) diproses tetapi responsnya ditahan gantung_ms
  gantung_ms: 120000,
  gagal502_noreg: [], // no_registrasi yang dibalas 502 (proksi) TANPA didaftarkan → SIMRS: tidak pasti, Cek Status: tidak ditemukan
  gagal500_setiap: 0, // >0: setiap request bulk ke-N dibalas 500 "Gagal membuat MCU…" (tanpa menyimpan)
  hasil_siap: true, // GET read mengembalikan hasil pemeriksaan
  hasil_item: {}, // kode_tindakan → [{ kode, nama, nilai? }] parameter hasil per tindakan (panel); bawaan: 1 parameter
  gateway_galat_500_generik: false, // true = tiru gateway asli: galat 400 dari LIS (description teks) jadi 500 generik
};
let data = new Map(); // no_registrasi → { no_lab, no_rm, nama, tindakan, kode_rs }
let hitung = new Map(); // no_registrasi → { diterima, terdaftar }
let urut = 0;
let nomorRequestBulk = 0;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const hit = (noReg, kunci) => {
  const h = hitung.get(noReg) ?? { diterima: 0, terdaftar: 0 };
  h[kunci]++;
  hitung.set(noReg, h);
};
const noLab = (kodeRs) => {
  const tgl = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `${kodeRs || "J03"}/${tgl}/${String(++urut).padStart(4, "0")}`;
};
const kosong = (v) => v === undefined || v === null || String(v).trim() === "";
const daftarkan = (r, kodeRs) => {
  const ada = data.get(r.registrasi.no_registrasi);
  if (ada) return ada; // idempoten per no_registrasi
  const d = { no_lab: noLab(kodeRs), no_rm: r.pasien.no_rm, nama: r.pasien.nama, tindakan: r.tindakan ?? [], pasien: r.pasien };
  data.set(r.registrasi.no_registrasi, d);
  hit(r.registrasi.no_registrasi, "terdaftar");
  return d;
};
const tindakanAsing = (r) => (r.tindakan ?? []).filter((t) => atur.tindakan_dikenal && !atur.tindakan_dikenal.includes(t.kode_tindakan));
const unitAsing = (r) => atur.unit_dikenal && !atur.unit_dikenal.includes(r.kode_unit_asal);

// Validasi field wajib (class-validator IsNotEmpty pada DTO gateway) → pesan "data.N.<jalur> tidak boleh kosong".
const WAJIB = {
  registrasi: ["no_registrasi", "diagnosa_awal", "keterangan_klinis", "kode_rs"],
  pasien: ["nama", "no_rm", "jenis_kelamin", "alamat", "no_telphone", "tanggal_lahir", "nik", "ras", "berat_badan", "jenis_registrasi", "m_provinsi_id", "m_kabupaten_id", "m_kecamatan_id"],
  akar: ["kode_dokter_pengirim", "nama_dokter_pengirim", "kode_unit_asal", "nama_unit_asal", "kode_penjamin", "nama_penjamin", "kode_icdt", "nama_icdt"],
};
const validasiBulk = (b) => {
  const e = [];
  if (typeof b.periksa_now !== "boolean") e.push("periksa_now harus boolean true | false");
  if (kosong(b.nama)) e.push("nama tidak boleh kosong");
  if (kosong(b.perusahaan)) e.push("perusahaan tidak boleh kosong");
  if (!Array.isArray(b.data)) e.push("data harus array");
  (Array.isArray(b.data) ? b.data : []).forEach((d, i) => {
    if (!d?.registrasi) e.push(`data.${i}.registrasi tidak boleh kosong`);
    for (const k of WAJIB.registrasi) if (d?.registrasi && kosong(d.registrasi[k])) e.push(`data.${i}.registrasi.${k} tidak boleh kosong`);
    for (const k of WAJIB.pasien) if (kosong(d?.pasien?.[k])) e.push(`data.${i}.pasien.${k} tidak boleh kosong`);
    for (const k of WAJIB.akar) if (kosong(d?.[k])) e.push(`data.${i}.${k} tidak boleh kosong`);
    if (!Array.isArray(d?.tindakan)) e.push(`data.${i}.tindakan harus array`);
    (d?.tindakan ?? []).forEach((t, j) => {
      if (kosong(t?.kode_tindakan)) e.push(`data.${i}.tindakan.${j}.kode_tindakan tidak boleh kosong`);
      if (kosong(t?.nama_tindakan)) e.push(`data.${i}.tindakan.${j}.nama_tindakan tidak boleh kosong`);
    });
  });
  return e;
};
// format galat gateway (CommonFilter): 400 { message:"Bad request", success:false, errors:[{field,message}] };
// selain 400 { messsage (3 s), code, success:false, errors:[{message}] }
const galat400 = (pesan) => ({ message: "Bad request", success: false, errors: pesan.map((p) => ({ field: p.split(" ")[0], message: p })) });
const galatLain = (code, jenis, pesan) => ({ messsage: jenis, code, success: false, errors: [{ message: pesan }] });

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
      return balas(200, { jumlah_noreg: hitung.size, terdaftar: data.size, dobel_terdaftar: dobel, request_bulk: nomorRequestBulk, per_no_registrasi: per });
    }
    if (url.pathname === "/_uji/atur" && req.method === "POST") {
      Object.assign(atur, body);
      return balas(200, { success: true, atur });
    }
    if (url.pathname === "/_uji/reset" && req.method === "POST") {
      data = new Map();
      hitung = new Map();
      nomorRequestBulk = 0;
      return balas(200, { success: true });
    }

    if (req.headers["x-api-key"] !== atur.kunci) return balas(401, { success: false, message: "x-api-key tidak valid" });
    if (atur.latensi_ms) await tidur(atur.latensi_ms);

    // --- registrasi per order (format adamLIS bridging_sim_rs) ---
    if (url.pathname === "/adam-lis/bridging_sim_rs/registrasi" && req.method === "POST") {
      const noReg = body?.registrasi?.no_registrasi;
      if (!noReg) return balas(400, { success: false, status: 400, message: "no_registrasi wajib" });
      hit(noReg, "diterima");
      if (atur.gagal502_noreg.includes(noReg)) return balas(502, { message: "Bad Gateway" });
      const asing = tindakanAsing(body);
      if (asing.length) {
        return balas(500, { success: false, status: 500, message: asing.map((t) => ({ value: t.kode_tindakan, msg: `Data Tindakan ${t.nama_tindakan}(${t.kode_tindakan})Belum Dimappingkan`, param: "Kode" })) });
      }
      if (unitAsing(body)) {
        return balas(500, { success: false, status: 500, message: "Data gagal disimpan", description: `Unit asal ${body.kode_unit_asal} (${body.nama_unit_asal}) belum terdaftar di master LIS` });
      }
      const d = daftarkan(body, body?.registrasi?.kode_rs);
      if (atur.gantung_noreg.includes(noReg)) await tidur(atur.gantung_ms);
      return balas(200, { success: true, status: 200, message: "Registrasi Berhasil", payload: { registrasi: { no_lab: d.no_lab, no_registrasi: `L${noReg}` } } });
    }

    // --- registrasi bulk MCU (kontrak gateway bridging_mcu) ---
    if (url.pathname === "/adam-lis/api/v1/registrasi_bulk_mcu/create" && req.method === "POST") {
      nomorRequestBulk++;
      const kodeRs = url.searchParams.get("kode_rs");
      const kodeLab = url.searchParams.get("kode_lab");
      for (const d of Array.isArray(body?.data) ? body.data : []) if (d?.registrasi?.no_registrasi) hit(d.registrasi.no_registrasi, "diterima");
      const salahValidasi = validasiBulk(body);
      if (salahValidasi.length) return balas(400, galat400(salahValidasi));
      if (body.data.length >= 150) return balas(400, galat400(["data terlalu banyak, maksimal data adalah 150"]));
      if (!kodeRs || !kodeLab || (atur.kode_rs && kodeRs !== atur.kode_rs) || (atur.kode_lab && kodeLab !== atur.kode_lab)) {
        return balas(404, galatLain(404, "Notfound", `Kode RS ${kodeRs ?? "-"} / Kode Lab ${kodeLab ?? "-"} tidak terdaftar di adamLIS`));
      }
      if (atur.gagal500_setiap > 0 && nomorRequestBulk % atur.gagal500_setiap === 0) {
        return balas(500, galatLain(500, "Internal Server Error", "Gagal membuat MCU, silakan coba lagi setelah 5 menit"));
      }
      // 409 semua-atau-tidak: no_rm ganda dalam request atau sudah ada di LIS
      const dilihat = new Set();
      for (const d of body.data) {
        const rm = d.pasien.no_rm;
        if (dilihat.has(rm)) return balas(409, galatLain(409, "Conflic", `Duplikat nomer RM ${rm}`));
        dilihat.add(rm);
        const sudahAda = atur.rm_terdaftar.includes(rm) || (atur.duplikat_rm_lintas && [...data.values()].some((x) => x.no_rm === rm && !data.has(d.registrasi.no_registrasi)));
        if (sudahAda) return balas(409, galatLain(409, "Conflic", `Nomer RM duplikat ditemukan: ${rm}`));
      }
      // tindakan / unit belum dipetakan: galat 400 menyebut kode (gateway asli: menjadi 500 generik)
      const pesan = [];
      for (const d of body.data) {
        for (const t of tindakanAsing(d)) pesan.push(`Data Tindakan ${t.nama_tindakan}(${t.kode_tindakan}) Belum Dimappingkan`);
        if (unitAsing(d)) pesan.push(`Unit asal ${d.kode_unit_asal} belum terdaftar (no_registrasi ${d.registrasi.no_registrasi})`);
      }
      if (pesan.length) {
        if (atur.gateway_galat_500_generik) return balas(500, { statusCode: 500, message: "Internal server error" });
        return balas(400, galat400([...new Set(pesan)]));
      }
      const payload = body.data.map((d) => {
        const r = daftarkan(d, kodeRs);
        return { nolab: r.no_lab, nama_pasien: d.pasien.nama, no_rm: d.pasien.no_rm, no_registrasi: d.registrasi.no_registrasi };
      });
      if (body.data.some((d) => atur.gantung_noreg.includes(d.registrasi.no_registrasi))) await tidur(atur.gantung_ms);
      return balas(201, { success: true, code: 201, message: "Data MCU Berhasil Ditambahkan", payload });
    }

    // --- baca registrasi + hasil ---
    if (url.pathname === "/api/v1/arsip/bridging/read" && req.method === "GET") {
      const noReg = url.searchParams.get("no_reg_rs");
      const d = data.get(noReg);
      if (!d) return balas(404, { success: false, message: `Data dengan no registrasi ${noReg} tidak ditemukan` });
      const pemeriksaan = !atur.hasil_siap
        ? []
        : d.tindakan.flatMap((t) =>
            (atur.hasil_item[t.kode_tindakan] ?? [{ kode: t.kode_tindakan, nama: t.nama_tindakan }]).map((it, i) => ({
              kode_tindakan_simrs: t.kode_tindakan,
              kode_pemeriksaan_lis: it.kode,
              nama_pemeriksaan_lis: it.nama,
              hasil: { nilai_hasil: it.nilai ?? String(10 + ((urut + i) % 7)), satuan: it.satuan ?? "-", flag_kode: "N" },
            }))
          );
      return balas(200, {
        success: true,
        message: "Data ditemukan",
        payload: { no_registrasi: noReg, no_laboratorium: d.no_lab, pasien: { nama: d.nama, no_rm: d.no_rm }, keterangan_hasil: "-", pemeriksaan },
      });
    }
    balas(404, { success: false, message: "not found" });
  });
});
server.listen(PORT, () => console.log(`LIS tiruan berjalan di http://localhost:${PORT} (x-api-key: ${atur.kunci})`));
