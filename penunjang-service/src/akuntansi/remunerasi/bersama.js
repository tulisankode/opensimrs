import crypto from "crypto";
import { permintaanSalah } from "../../umum/respons.js";
import { awalHariWib, dariSen, hashData, konflik, rentangPeriode } from "../bersama.js";

// Konstanta & perhitungan murni Remunerasi — jasa pelayanan (jaspel) dokter & tenaga kesehatan (STD-0032). Tanpa
// database agar dapat diuji unit (test/remunerasi.test.js).
//
// Satuan bilangan bulat (tanpa floating point):
//   uang     → sen (Rp 1 = 100)                         persen → basis poin (bp; 100% = 10000)
//   indeks   → senti-poin (1,00 = 100)                  poin   → indeks × bobot (1,0000 = 10000)
//
// Model perhitungan (dapat dikonfigurasi per faskes, berversi; NILAI BAWAAN HANYA CONTOH yang wajib disahkan bagian
// keuangan — tidak ada rumus resmi yang dikarang di sini):
//   1. Dasar: item tagihan (bill_item) dari tagihan final yang LUNAS pada bulan periode (WIB). Nilai item = qty × harga
//      + service_fee. Porsi jaspel per (jenis layanan, kategori item) → jaspel item = nilai × porsi.
//   2. Jaspel item dibagi: porsi LANGSUNG untuk pelaksana (dokter penanggung jawab kunjungan, atau penerima yang
//      ditetapkan tim remunerasi) dan porsi KEBERSAMAAN (pool).
//   3. Pool dibagi ke semua penerima aktif yang ikut kebersamaan, proporsional poin efektif =
//      (indeks profesi + Σ indeks penerima × bobot) × capaian kinerja periode (%). Sisa pembulatan sen dibagi dengan
//      metode sisa terbesar sehingga jumlah rincian TEPAT sama dengan pool.
//   4. Koreksi (periode sebelumnya yang sudah disetujui) dicatat beralasan sebagai baris koreksi di periode draf.

// Izin: submodul baru pada modul izin "Akuntansi & Remunerasi" (auth-service permission-list.js, akuntansiPermission).
export const MODUL_IZIN = "Akuntansi & Remunerasi";
export const SUB = {
  konfigurasi: "Konfigurasi Remunerasi", // READ, CREATE, UPDATE, SAHKAN
  periode: "Periode Remunerasi", // READ, CREATE, HITUNG, UPDATE, KOREKSI
  verifikasi: "Verifikasi Remunerasi", // READ, VALIDASI, KEMBALIKAN
  persetujuan: "Persetujuan Remunerasi", // READ, SETUJUI, TOLAK
  pembayaran: "Pembayaran Remunerasi", // READ, BAYAR
  slip: "Slip Remunerasi", // READ (hanya slip milik sendiri)
  rekap: "Rekap Remunerasi", // READ, EKSPOR
};

export const STATUS_PERIODE = {
  draf: "Draf",
  dihitung: "Dihitung (menunggu verifikasi)",
  diverifikasi: "Diverifikasi (menunggu persetujuan)",
  disetujui: "Disetujui",
  dibayar: "Dibayar",
};
export const STATUS_SKEMA = { draf: "Draf (belum disahkan)", disahkan: "Disahkan" };
export const STATUS_SUMBER = {
  dihitung: "Dihitung",
  pengecualian: "Pengecualian (wajib ditangani)",
  diabaikan: "Diabaikan (beralasan)",
  tertahan_penjamin: "Tertahan — porsi penjamin belum ada data pelunasan klaim",
  periode_lain: "Sudah dihitung di periode lain",
};
export const PROFESI = {
  dokter_spesialis: "Dokter Spesialis",
  dokter_umum: "Dokter Umum",
  dokter_gigi: "Dokter Gigi",
  apoteker: "Apoteker",
  perawat: "Perawat",
  bidan: "Bidan",
  analis_lab: "Ahli Teknologi Laboratorium Medik",
  radiografer: "Radiografer",
  fisioterapis: "Fisioterapis",
  nakes_lain: "Tenaga Kesehatan Lain",
};
// category_code bill_item (payment-service) → kategori.
export const KATEGORI_ITEM = { 1: "tindakan", 2: "obat", 3: "alkes", 4: "ruangan", 5: "penunjang" };
export const KATEGORI = { tindakan: "Tindakan", obat: "Obat", alkes: "Alat Kesehatan / BHP", ruangan: "Ruangan / Akomodasi", penunjang: "Penunjang" };
// service_bill.type (enum payment-service) + "*" sebagai fallback semua jenis.
export const JENIS_LAYANAN = { RJ: "Rawat Jalan", RI: "Rawat Inap", IGD: "IGD", LAB: "Laboratorium", FISIO: "Fisioterapi", OTC: "Penjualan Bebas", "*": "Semua jenis layanan (fallback)" };
export const JENIS_INDEKS = { pendidikan: "Pendidikan", risiko: "Risiko", jabatan: "Jabatan", masa_kerja: "Masa Kerja" };
export const METODE_BAYAR = { TRANSFER: "Transfer Bank", CASH: "Tunai" };
export const PERINGATAN_CONTOH = "CONTOH — bukan aturan resmi. Porsi, indeks, dan bobot wajib ditetapkan & disahkan bagian keuangan/direksi faskes sebelum dipakai.";

const BP = 10000;
const INDEKS_MAKS = 10000; // 100,00

// ── Validasi angka (≤ 2 desimal, tidak negatif). Mengembalikan bilangan bulat ×100.
export const angkaSenti = (v, nama, maks) => {
  if (v === null || v === undefined || v === "") throw permintaanSalah(`${nama} wajib diisi`);
  if (typeof v === "number" && !Number.isFinite(v)) throw permintaanSalah(`${nama} harus berupa angka`);
  const t = typeof v === "number" ? String(v) : String(v).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) throw permintaanSalah(`${nama} harus berupa angka tidak negatif dengan paling banyak 2 desimal`);
  const [bulat, pecahan = ""] = t.split(".");
  const n = Number(bulat) * 100 + Number(pecahan.padEnd(2, "0"));
  if (maks !== undefined && n > maks) throw permintaanSalah(`${nama} maksimal ${teksSenti(maks)}`);
  return n;
};
export const teksSenti = (n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
export const persenBp = (v, nama) => angkaSenti(v, nama, BP); // 0–100,00 % → bp

// Pembulatan a/b setengah ke atas (menjauhi nol) untuk bilangan bulat.
export const bagiBulat = (a, b) => (a < 0 ? -Math.floor((-a * 2 + b) / (2 * b)) : Math.floor((a * 2 + b) / (2 * b)));

// ── Skema (konfigurasi berversi). Disimpan dalam bentuk teks 2 desimal (mudah dibaca & diaudit), dihitung dalam bulat.
export const SKEMA_CONTOH = {
  porsi: [
    { jenis_layanan: "RJ", kategori: "tindakan", persen: "40.00" },
    { jenis_layanan: "IGD", kategori: "tindakan", persen: "40.00" },
    { jenis_layanan: "RI", kategori: "tindakan", persen: "35.00" },
    { jenis_layanan: "FISIO", kategori: "tindakan", persen: "30.00" },
    { jenis_layanan: "*", kategori: "tindakan", persen: "30.00" },
    { jenis_layanan: "*", kategori: "penunjang", persen: "15.00" },
  ],
  persen_langsung: "60.00",
  persen_kebersamaan: "40.00",
  indeks_profesi: {
    dokter_spesialis: "4.00",
    dokter_umum: "3.00",
    dokter_gigi: "3.00",
    apoteker: "2.50",
    perawat: "2.00",
    bidan: "2.00",
    analis_lab: "1.50",
    radiografer: "1.50",
    fisioterapis: "1.50",
    nakes_lain: "1.00",
  },
  bobot_indeks: { pendidikan: "1.00", risiko: "1.00", jabatan: "1.00", masa_kerja: "0.50" },
  kinerja_min: "0.00",
  kinerja_maks: "150.00",
};

// Normalkan & validasi konfigurasi skema dari body → bentuk kanonis (teks 2 desimal). 400 bila tidak sah.
export const validasiKonfigurasi = (b = {}) => {
  if (!Array.isArray(b.porsi) || !b.porsi.length) throw permintaanSalah("porsi jaspel minimal satu aturan (jenis layanan × kategori)");
  if (b.porsi.length > 100) throw permintaanSalah("porsi jaspel maksimal 100 aturan");
  const kunci = new Set();
  const porsi = b.porsi.map((p, i) => {
    const jenis = String(p?.jenis_layanan ?? "").toUpperCase();
    const kategori = String(p?.kategori ?? "").toLowerCase();
    if (!JENIS_LAYANAN[jenis]) throw permintaanSalah(`porsi ${i + 1}: jenis_layanan harus salah satu dari ${Object.keys(JENIS_LAYANAN).join(", ")}`);
    if (!KATEGORI[kategori]) throw permintaanSalah(`porsi ${i + 1}: kategori harus salah satu dari ${Object.keys(KATEGORI).join(", ")}`);
    if (kunci.has(`${jenis}|${kategori}`)) throw permintaanSalah(`porsi ${i + 1}: aturan ${jenis}/${kategori} ganda`);
    kunci.add(`${jenis}|${kategori}`);
    return { jenis_layanan: jenis, kategori, persen: teksSenti(persenBp(p?.persen, `porsi ${i + 1}: persen`)) };
  });
  const langsung = persenBp(b.persen_langsung, "persen_langsung");
  const kebersamaan = persenBp(b.persen_kebersamaan, "persen_kebersamaan");
  if (langsung + kebersamaan !== BP) throw permintaanSalah("persen_langsung + persen_kebersamaan harus tepat 100");
  const indeksProfesi = {};
  for (const p of Object.keys(PROFESI)) indeksProfesi[p] = teksSenti(angkaSenti(b.indeks_profesi?.[p] ?? 0, `indeks_profesi ${PROFESI[p]}`, INDEKS_MAKS));
  const bobot = {};
  for (const j of Object.keys(JENIS_INDEKS)) bobot[j] = teksSenti(angkaSenti(b.bobot_indeks?.[j] ?? 0, `bobot_indeks ${JENIS_INDEKS[j]}`, INDEKS_MAKS));
  const kMin = persenBpLuas(b.kinerja_min ?? "0", "kinerja_min");
  const kMaks = persenBpLuas(b.kinerja_maks ?? "100", "kinerja_maks");
  if (kMin > kMaks) throw permintaanSalah("kinerja_min tidak boleh lebih besar dari kinerja_maks");
  return {
    porsi,
    persen_langsung: teksSenti(langsung),
    persen_kebersamaan: teksSenti(kebersamaan),
    indeks_profesi: indeksProfesi,
    bobot_indeks: bobot,
    kinerja_min: teksSenti(kMin),
    kinerja_maks: teksSenti(kMaks),
  };
};
// Capaian kinerja boleh > 100% (mis. 150%) — batas atas 500%.
const persenBpLuas = (v, nama) => angkaSenti(v, nama, 5 * BP);

// Konfigurasi kanonis → bilangan bulat untuk perhitungan.
export const angkaKonfigurasi = (k) => ({
  porsi: k.porsi.map((p) => ({ jenis_layanan: p.jenis_layanan, kategori: p.kategori, bp: angkaSenti(p.persen, "persen") })),
  langsung_bp: angkaSenti(k.persen_langsung, "persen_langsung"),
  indeks_profesi: Object.fromEntries(Object.entries(k.indeks_profesi ?? {}).map(([p, v]) => [p, angkaSenti(v, p)])),
  bobot: Object.fromEntries(Object.entries(k.bobot_indeks ?? {}).map(([j, v]) => [j, angkaSenti(v, j)])),
  kinerja_min_bp: angkaSenti(k.kinerja_min ?? "0", "kinerja_min"),
  kinerja_maks_bp: angkaSenti(k.kinerja_maks ?? "100", "kinerja_maks"),
});

// Porsi (bp) untuk item: aturan persis (jenis, kategori) lebih dulu, lalu ("*", kategori). 0 bila tidak ada aturan.
export const porsiUntuk = (porsi, jenisLayanan, kategori) =>
  (porsi.find((p) => p.jenis_layanan === jenisLayanan && p.kategori === kategori) ?? porsi.find((p) => p.jenis_layanan === "*" && p.kategori === kategori))?.bp ?? 0;

// Indeks penerima dari body (0–100, ≤ 2 desimal) → kanonis.
export const validasiIndeks = (v = {}) =>
  Object.fromEntries(Object.keys(JENIS_INDEKS).map((j) => [j, teksSenti(angkaSenti(v?.[j] ?? 0, `indeks ${JENIS_INDEKS[j]}`, INDEKS_MAKS))]));

// Poin dasar penerima (×10000): indeks profesi + Σ indeks × bobot.
export const poinPenerima = (konf, penerima) => {
  let poin = (konf.indeks_profesi[penerima.profesi] ?? 0) * 100;
  for (const [j, bobot] of Object.entries(konf.bobot)) poin += angkaSenti(penerima.indeks?.[j] ?? 0, j) * bobot;
  return poin;
};

// Bagi `total` (sen, ≥ 0) proporsional bobot BigInt dengan metode sisa terbesar (seri: urutan masukan). Jumlah hasil
// tepat sama dengan total. Semua bobot 0 → null (tidak dapat dibagi).
export const bagiProporsional = (total, bobot) => {
  const w = bobot.map((x) => BigInt(x));
  const jumlah = w.reduce((t, x) => t + x, 0n);
  if (total === 0) return w.map(() => 0);
  if (jumlah <= 0n) return null;
  const T = BigInt(total);
  const dasar = w.map((x) => (T * x) / jumlah);
  const sisa = w.map((x, i) => ({ i, r: (T * x) % jumlah }));
  let kurang = Number(T - dasar.reduce((t, x) => t + x, 0n));
  sisa.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of sisa) {
    if (kurang <= 0) break;
    dasar[i] += 1n;
    kurang -= 1;
  }
  return dasar.map(Number);
};

// ── Perhitungan periode (fungsi murni). Masukan:
//   sumber      [{ bill_item_uuid, jenis_layanan, kategori, nilai (sen), practitioner_uuid, penjamin (bool), periode_lain (bool) }]
//   konf        angkaKonfigurasi(skema.konfigurasi)
//   penerima    [{ practitioner_uuid, nama, profesi, unit, indeks, aktif, ikut_kebersamaan }]
//   kinerja     Map practitioner_uuid → bp (bawaan 10000)
//   koreksi     [{ practitioner_uuid, nilai (sen, boleh negatif) }]
//   penyelesaian Map bill_item_uuid → { tindakan: 'tetapkan'|'abaikan', practitioner_uuid, alasan }
export const hitungRemunerasi = ({ sumber = [], konf, penerima = [], kinerja = new Map(), koreksi = [], penyelesaian = new Map() }) => {
  const aktif = new Map(penerima.filter((p) => p.aktif !== false).map((p) => [p.practitioner_uuid, p]));
  const semua = new Map(penerima.map((p) => [p.practitioner_uuid, p]));
  const baris = new Map();
  const ambil = (uuid) => {
    if (!baris.has(uuid)) {
      const p = semua.get(uuid) ?? {};
      baris.set(uuid, { practitioner_uuid: uuid, nama: p.nama ?? null, profesi: p.profesi ?? null, unit: p.unit ?? null, langsung: 0, kebersamaan: 0, koreksi: 0, jumlah_layanan: 0, nilai_dasar: 0, rumus: null });
    }
    return baris.get(uuid);
  };
  const hasilSumber = [];
  let pool = 0;
  let tanpaPorsi = 0;
  for (const s of sumber) {
    const bp = porsiUntuk(konf.porsi, s.jenis_layanan, s.kategori);
    if (!bp) {
      tanpaPorsi += 1;
      continue;
    }
    const jaspel = bagiBulat(s.nilai * bp, BP);
    const r = { ...s, persen_bp: bp, jaspel, langsung: 0, kebersamaan: 0, status: "dihitung", alasan: null, pelaksana_uuid: null };
    const sel = penyelesaian.get(s.bill_item_uuid);
    if (s.periode_lain) Object.assign(r, { status: "periode_lain", alasan: "Item sudah dihitung pada periode remunerasi lain yang disetujui" });
    else if (s.penjamin) Object.assign(r, { status: "tertahan_penjamin", alasan: "Tagihan dibayar (sebagian) oleh penjamin; data pelunasan klaim belum tersedia sehingga belum menjadi dasar jaspel" });
    else if (sel?.tindakan === "abaikan") Object.assign(r, { status: "diabaikan", alasan: sel.alasan });
    else {
      const pelaksana = sel?.tindakan === "tetapkan" ? sel.practitioner_uuid : s.practitioner_uuid;
      if (!pelaksana) Object.assign(r, { status: "pengecualian", alasan: "Pelaksana (dokter penanggung jawab kunjungan) tidak dapat ditentukan dari data tagihan" });
      else if (!aktif.has(pelaksana)) Object.assign(r, { status: "pengecualian", alasan: "Pelaksana belum terdaftar/aktif sebagai penerima remunerasi", pelaksana_uuid: pelaksana });
      else {
        r.pelaksana_uuid = pelaksana;
        r.langsung = bagiBulat(jaspel * konf.langsung_bp, BP);
        r.kebersamaan = jaspel - r.langsung;
        const b = ambil(pelaksana);
        b.langsung += r.langsung;
        b.jumlah_layanan += 1;
        b.nilai_dasar += s.nilai;
        pool += r.kebersamaan;
      }
    }
    hasilSumber.push(r);
  }

  // Pool kebersamaan → penerima aktif yang ikut, urut practitioner_uuid (deterministik).
  const pengecualian = [];
  const ikut = [...aktif.values()].filter((p) => p.ikut_kebersamaan !== false).sort((a, b) => String(a.practitioner_uuid).localeCompare(String(b.practitioner_uuid)));
  const efektif = ikut.map((p) => {
    const poin = poinPenerima(konf, p);
    const kin = kinerja.has(p.practitioner_uuid) ? kinerja.get(p.practitioner_uuid) : BP;
    return { p, poin, kin, efektif: BigInt(poin) * BigInt(kin) };
  });
  const bagian = bagiProporsional(pool, efektif.map((e) => e.efektif));
  const totalEfektif = efektif.reduce((t, e) => t + e.efektif, 0n);
  if (bagian === null) pengecualian.push({ kode: "pool_tidak_terbagi", pesan: `Pool kebersamaan Rp ${dariSen(pool)} tidak dapat dibagi: tidak ada penerima aktif dengan poin efektif > 0` });
  efektif.forEach((e, i) => {
    const b = ambil(e.p.practitioner_uuid);
    b.kebersamaan = bagian ? bagian[i] : 0;
    b.rumus = {
      profesi: e.p.profesi,
      indeks_profesi: teksSenti(konf.indeks_profesi[e.p.profesi] ?? 0),
      indeks: e.p.indeks ?? {},
      bobot: Object.fromEntries(Object.entries(konf.bobot).map(([j, v]) => [j, teksSenti(v)])),
      poin: (e.poin / 10000).toFixed(4),
      kinerja_persen: teksSenti(e.kin),
      poin_efektif: (Number(e.efektif) / 1e8).toFixed(4),
      porsi_pool_persen: totalEfektif > 0n ? (Number((e.efektif * 1000000n) / totalEfektif) / 10000).toFixed(4) : "0.0000",
    };
  });
  for (const k of koreksi) ambil(k.practitioner_uuid).koreksi += k.nilai;

  const rincian = [...baris.values()]
    .map((b) => ({ ...b, total: b.langsung + b.kebersamaan + b.koreksi }))
    .filter((b) => b.langsung || b.kebersamaan || b.koreksi || b.jumlah_layanan)
    .sort((a, b) => b.total - a.total || String(a.practitioner_uuid).localeCompare(String(b.practitioner_uuid)));
  for (const b of rincian) if (b.total < 0) pengecualian.push({ kode: "total_negatif", pesan: `Total jasa ${b.nama ?? b.practitioner_uuid} negatif (Rp ${dariSen(b.total)}) setelah koreksi` });
  const dihitung = hasilSumber.filter((s) => s.status === "dihitung");
  const jumlahStatus = Object.fromEntries(Object.keys(STATUS_SUMBER).map((st) => [st, hasilSumber.filter((s) => s.status === st).length]));
  if (jumlahStatus.pengecualian) pengecualian.unshift({ kode: "sumber_pengecualian", pesan: `${jumlahStatus.pengecualian} item tagihan perlu ditangani (tetapkan penerima/daftarkan penerima, atau abaikan beralasan)` });
  const ringkasan = {
    jumlah_item: hasilSumber.length,
    item_tanpa_porsi: tanpaPorsi,
    jumlah_status: jumlahStatus,
    total_dasar: dihitung.reduce((t, s) => t + s.nilai, 0),
    total_jaspel: dihitung.reduce((t, s) => t + s.jaspel, 0),
    total_langsung: rincian.reduce((t, b) => t + b.langsung, 0),
    total_kebersamaan: rincian.reduce((t, b) => t + b.kebersamaan, 0),
    pool,
    total_koreksi: rincian.reduce((t, b) => t + b.koreksi, 0),
    total: rincian.reduce((t, b) => t + b.total, 0),
    jumlah_penerima: rincian.length,
  };
  return { sumber: hasilSumber, rincian, ringkasan, pengecualian };
};

// Hash masukan perhitungan (idempotensi & deteksi perubahan data sumber sebelum verifikasi/persetujuan).
export const hashMasukan = ({ skema, sumber, penerima, kinerja, koreksi, penyelesaian }) =>
  hashData({
    skema: { uuid: skema.uuid, versi: skema.versi },
    sumber: sumber.map((s) => [s.bill_item_uuid, s.nilai, s.practitioner_uuid ?? null, !!s.penjamin, !!s.periode_lain, s.jenis_layanan, s.kategori]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    penerima: penerima.map((p) => [p.practitioner_uuid, p.profesi, p.unit ?? null, p.indeks ?? {}, p.aktif !== false, p.ikut_kebersamaan !== false]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    kinerja: [...kinerja.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    koreksi: koreksi.map((k) => [k.uuid, k.practitioner_uuid, k.nilai]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    penyelesaian: [...penyelesaian.entries()].map(([u, s]) => [u, s.tindakan, s.practitioner_uuid ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });

// ── Alur status & pemisahan tugas.
export const TRANSISI = {
  hitung: ["draf", "dihitung"],
  verifikasi: ["dihitung"],
  kembalikan: ["dihitung", "diverifikasi"],
  setujui: ["diverifikasi"],
  bayar: ["disetujui"],
  ubah: ["draf", "dihitung"], // kinerja, koreksi, penyelesaian pengecualian
};
export const pastikanStatus = (periode, aksi) => {
  if (!TRANSISI[aksi].includes(periode.status))
    throw konflik(`Periode berstatus "${STATUS_PERIODE[periode.status] ?? periode.status}" — aksi ini hanya untuk status ${TRANSISI[aksi].map((s) => `"${STATUS_PERIODE[s]}"`).join(" / ")}`);
};
const sama = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();
// Verifikator ≠ penghitung; penyetuju ≠ penghitung & ≠ verifikator (segregation of duties).
export const cekPemisahanTugas = (periode, pengguna, aksi) => {
  if (!pengguna) throw permintaanSalah("Pengguna tidak dikenali");
  if (aksi === "verifikasi" && sama(periode.dihitung_oleh, pengguna)) throw konflik("Verifikator harus berbeda dari petugas yang menghitung periode");
  if (aksi === "setujui") {
    if (sama(periode.dihitung_oleh, pengguna)) throw konflik("Penyetuju tidak boleh petugas yang menghitung periode (pembuat ≠ penyetuju)");
    if (sama(periode.diverifikasi_oleh, pengguna)) throw konflik("Penyetuju harus berbeda dari verifikator");
  }
};

// Tanggal jurnal beban jaspel = hari terakhir bulan periode (WIB).
export const tanggalAkhirPeriode = (tahun, bulan) => awalHariWib(rentangPeriode(tahun, bulan).akhir);

// Penanda pasien anonim per periode (slip): tidak dapat dikaitkan ke identitas pasien maupun lintas periode.
export const refPasien = (periodeUuid, patientUuid) =>
  patientUuid ? `PSN-${crypto.createHash("sha256").update(`${periodeUuid}:${patientUuid}`).digest("hex").slice(0, 6).toUpperCase()}` : "PSN-??????";
