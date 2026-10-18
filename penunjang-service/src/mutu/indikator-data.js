import express from "express";
import { query, satu, ubah, sisipkan, sekarang, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah } from "../umum/respons.js";
import { izinMutu } from "../umum/izin.js";
import { awalHariWib, boolOpsional, cekPilihan, epochWajib, konflik, sekarangDetik, teks, wajibPilihan } from "./bersama.js";
import {
  KODE_OTOMATIS,
  STATUS_DATA,
  bulanDariEpoch,
  dataDapatDiubah,
  hitungCapaian,
  nilaiData,
  parameterOtomatis,
  ringkasWaktuTunggu,
  tanggalData,
  transisiDataSah,
  uraiBulan,
  validatorSah,
} from "./indikator-bersama.js";
import { ambilMilik, catatAudit, tanganiMutu } from "./dasar.js";
import { ambilIndikator, cekUnit } from "./indikator.js";
import { modulKatalogAktif } from "../sarpras/fitur.js";

// Pengumpulan data Indikator Mutu (STD-0025) — izin "Mutu & Akreditasi › Indikator Mutu":
//   GET    /indikator/data?indikator_uuid=&unit_uuid=&bulan=YYYY-MM&status=                     READ
//   GET    /indikator/data/:uuid                         data + jejak audit                     READ
//   POST   /indikator/data                               input manual per tanggal & unit        INPUT DATA
//   POST   /indikator/data/hitung-otomatis               hitung dari data SIMRS (pratinjau/simpan) INPUT DATA
//   PUT    /indikator/data/:uuid                         ubah — hanya draf/dikembalikan          INPUT DATA
//   POST   /indikator/data/:uuid/ajukan                  draf|dikembalikan → diajukan            INPUT DATA
//   POST   /indikator/data/:uuid/validasi                diajukan → tervalidasi|dikembalikan     VALIDASI
//   POST   /indikator/data/:uuid/buka                    tervalidasi → draf (alasan wajib)       VALIDASI
//   DELETE /indikator/data/:uuid                         hapus lunak — hanya draf/dikembalikan   INPUT DATA
// Satu baris per (indikator, unit, tanggal); unit kosong = tingkat faskes. Validator tidak boleh pengisi/pengaju data
// yang sama (pemisahan tugas). Setiap perubahan & transisi dicatat di mutu_audit dalam transaksi yang sama.
const rute = express.Router();
const SUB = "Indikator Mutu";

const KOLOM = `d.uuid, d.faskes_uuid, d.indikator_uuid, d.unit_uuid, d.tanggal, d.periode_bulan, d.numerator, d.denominator, d.catatan,
  d.sumber, d.rincian_otomatis, d.status, d.diisi_oleh, d.diajukan_oleh, d.diajukan_pada, d.divalidasi_oleh, d.divalidasi_pada,
  d.catatan_validasi, d.created_at, d.updated_at`;
const ambilData = (uuid, f, k, kunci = false) => ambilMilik("mutu_indikator_data", uuid, f, k, { nama: "Data indikator", kunci, kolom: KOLOM.replace(/\bd\./g, "") });

// Tanggal data (awal hari WIB / awal bulan) dari body; tidak boleh di masa depan.
const tanggalMasuk = (v, ind) => {
  const t = tanggalData(epochWajib(v, "tanggal"), ind.frekuensi);
  if (t > awalHariWib(sekarangDetik())) throw permintaanSalah("tanggal data tidak boleh di masa depan");
  return t;
};
const pastikanAktif = (ind) => {
  if (!ind.aktif) throw konflik(`Indikator ${ind.kode} nonaktif; aktifkan dulu untuk mengisi data`);
};
const pastikanDapatDiubah = (d) => {
  if (!dataDapatDiubah(d.status)) throw konflik(`Data berstatus ${STATUS_DATA[d.status] ?? d.status} tidak dapat diubah${d.status === "tervalidasi" ? " (buka kembali oleh validator terlebih dahulu)" : ""}`);
};

// Transisi status + audit dalam satu transaksi; `cek(d)` boleh melempar galat tambahan.
const transisi = (req, ke, aksi, isi, cek) =>
  transaksi(async (k) => {
    const f = req.author.faskesUuid;
    const lama = await ambilData(req.params.uuid, f, k, true);
    if (!transisiDataSah(lama.status, ke)) throw konflik(`Data berstatus ${STATUS_DATA[lama.status] ?? lama.status} tidak dapat diubah menjadi ${STATUS_DATA[ke]}`);
    if (cek) cek(lama);
    const row = await ubah("mutu_indikator_data", lama.uuid, f, { status: ke, ...isi }, k);
    await catatAudit(k, req, "indikator_data", row.uuid, aksi, lama, row);
    return row;
  });

// ── Sumber otomatis (baca saja). Mengembalikan { numerator, denominator, tidak_lengkap, rincian }.
const hitungOtomatis = async (ind, unitUuid, tanggal, f) => {
  const def = KODE_OTOMATIS[ind.kode_otomatis];
  if (ind.sumber_data !== "otomatis" || !def) throw konflik(`Indikator ${ind.kode} tidak memakai sumber data otomatis`);
  if (!(await modulKatalogAktif(def.modul_sumber, f))) throw konflik(`Modul sumber (${def.modul_sumber}) tidak aktif untuk faskes ini; isi data secara manual`);
  const param = parameterOtomatis(ind.kode_otomatis, ind.parameter_otomatis);
  if (ind.kode_otomatis === "waktu_tunggu_rj") {
    const akhir = ind.frekuensi === "bulanan" ? uraiBulan(bulanDariEpoch(tanggal)).akhir : tanggal + 86400;
    const baris = await query(
      `SELECT tanggal_checkin, tanggal_periksa FROM rawat_jalans
        WHERE faskes_uuid = $1 AND deleted_at IS NULL AND COALESCE(status_rj, 1) <> 0
          AND tanggal_checkin >= $2 AND tanggal_checkin < $3 AND ($4::varchar IS NULL OR lokasi_uuid = $4)`,
      [f, tanggal, akhir, unitUuid],
    );
    const r = ringkasWaktuTunggu(baris, param.ambang_menit);
    return { ...r, rincian: { kode_otomatis: ind.kode_otomatis, sumber: def.sumber, parameter: param, jumlah_kunjungan: baris.length, tidak_lengkap: r.tidak_lengkap, dihitung_pada: sekarang() } };
  }
  throw konflik(`Sumber otomatis ${ind.kode_otomatis} belum didukung`);
};

rute.get(
  "/data",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const pg = halaman(q);
    const syarat = ["d.faskes_uuid = $1", "d.deleted_at IS NULL", "i.deleted_at IS NULL"];
    const p = [f];
    if (q.indikator_uuid) syarat.push(`d.indikator_uuid = $${p.push(String(q.indikator_uuid))}`);
    if (q.unit_uuid === "-") syarat.push("d.unit_uuid IS NULL");
    else if (q.unit_uuid) syarat.push(`d.unit_uuid = $${p.push(String(q.unit_uuid))}`);
    if (q.bulan) syarat.push(`d.periode_bulan = $${p.push(uraiBulan(q.bulan).kode)}`);
    const status = cekPilihan(q.status || undefined, STATUS_DATA, "status");
    if (status) syarat.push(`d.status = $${p.push(status)}`);
    const where = syarat.join(" AND ");
    const dari = `FROM mutu_indikator_data d JOIN mutu_indikator i ON i.uuid = d.indikator_uuid AND i.faskes_uuid = d.faskes_uuid
      LEFT JOIN lokasi l ON l.uuid = d.unit_uuid AND l.faskes_uuid = d.faskes_uuid`;
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM}, i.kode AS indikator_kode, i.judul AS indikator_judul, i.satuan, i.frekuensi, i.target_nilai, i.arah, l.name AS unit_nama
         ${dari} WHERE ${where} ORDER BY d.tanggal DESC, i.kode, l.name NULLS FIRST LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, pg.limit, pg.offset],
    );
    kirim(res, denganHalaman(rows.map((r) => ({ ...r, capaian: hitungCapaian(r.numerator, r.denominator, r.satuan) })), total, pg));
  }),
);

rute.get(
  "/data/:uuid",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const d = await ambilData(req.params.uuid, f);
    const ind = await ambilIndikator(d.indikator_uuid, f);
    const audit = await query(
      `SELECT uuid, aksi, data_sebelum, data_sesudah, aktor, created_at FROM mutu_audit
        WHERE faskes_uuid = $1 AND entitas = 'indikator_data' AND entitas_uuid = $2 ORDER BY created_at DESC, uuid DESC LIMIT 100`,
      [f, d.uuid],
    );
    kirim(res, { ...d, capaian: hitungCapaian(d.numerator, d.denominator, ind.satuan), indikator: ind, audit });
  }),
);

rute.post(
  "/data",
  izinMutu(SUB, "INPUT DATA"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const ind = await ambilIndikator(b.indikator_uuid, f, k);
      pastikanAktif(ind);
      const tanggal = tanggalMasuk(b.tanggal, ind);
      const ajukan = boolOpsional(b.ajukan) === true;
      const n = sekarang();
      const row = await sisipkan(
        "mutu_indikator_data",
        {
          faskes_uuid: f,
          indikator_uuid: ind.uuid,
          unit_uuid: (await cekUnit(b.unit_uuid, f, k)) ?? null,
          tanggal,
          periode_bulan: bulanDariEpoch(tanggal),
          ...nilaiData(b.numerator, b.denominator, ind),
          catatan: teks(b.catatan, "catatan", 2000) ?? null,
          sumber: "manual",
          status: ajukan ? "diajukan" : "draf",
          diisi_oleh: req.author.username ?? null,
          ...(ajukan ? { diajukan_oleh: req.author.username ?? null, diajukan_pada: n } : {}),
        },
        k,
      );
      await catatAudit(k, req, "indikator_data", row.uuid, ajukan ? "buat_ajukan" : "buat", null, row);
      return row;
    });
    kirim(res, hasil, "Data indikator berhasil disimpan");
  }, "Data indikator untuk unit & tanggal ini sudah ada; ubah data yang ada"),
);

rute.post(
  "/data/hitung-otomatis",
  izinMutu(SUB, "INPUT DATA"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const simpan = boolOpsional(b.simpan) === true;
    const hasil = await transaksi(async (k) => {
      const ind = await ambilIndikator(b.indikator_uuid, f, k);
      pastikanAktif(ind);
      const tanggal = tanggalMasuk(b.tanggal, ind);
      const unit = (await cekUnit(b.unit_uuid, f, k)) ?? null;
      const hitung = await hitungOtomatis(ind, unit, tanggal, f);
      const pratinjau = { indikator_uuid: ind.uuid, unit_uuid: unit, tanggal, numerator: hitung.numerator, denominator: hitung.denominator, capaian: hitungCapaian(hitung.numerator, hitung.denominator, ind.satuan), rincian_otomatis: hitung.rincian };
      if (!simpan) return { ...pratinjau, disimpan: false };
      // Simpan sebagai draf untuk ditinjau pengumpul: baris baru, atau timpa baris draf/dikembalikan yang ada.
      const lama = await satu(
        `SELECT ${KOLOM.replace(/\bd\./g, "")} FROM mutu_indikator_data
          WHERE faskes_uuid = $1 AND indikator_uuid = $2 AND COALESCE(unit_uuid, '') = COALESCE($3::varchar, '') AND tanggal = $4 AND deleted_at IS NULL FOR UPDATE`,
        [f, ind.uuid, unit, tanggal],
        k,
      );
      const nilai = { numerator: hitung.numerator, denominator: hitung.denominator, sumber: "otomatis", rincian_otomatis: hitung.rincian };
      let row;
      if (lama) {
        pastikanDapatDiubah(lama);
        row = await ubah("mutu_indikator_data", lama.uuid, f, { ...nilai, diisi_oleh: req.author.username ?? null }, k);
        await catatAudit(k, req, "indikator_data", row.uuid, "hitung_ulang_otomatis", lama, row);
      } else {
        row = await sisipkan(
          "mutu_indikator_data",
          { faskes_uuid: f, indikator_uuid: ind.uuid, unit_uuid: unit, tanggal, periode_bulan: bulanDariEpoch(tanggal), ...nilai, status: "draf", diisi_oleh: req.author.username ?? null },
          k,
        );
        await catatAudit(k, req, "indikator_data", row.uuid, "hitung_otomatis", null, row);
      }
      return { ...pratinjau, uuid: row.uuid, status: row.status, disimpan: true };
    });
    kirim(res, hasil, hasil.disimpan ? "Hasil hitung otomatis disimpan sebagai draf" : "Pratinjau hitung otomatis");
  }),
);

rute.put(
  "/data/:uuid",
  izinMutu(SUB, "INPUT DATA"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const lama = await ambilData(req.params.uuid, f, k, true);
      pastikanDapatDiubah(lama);
      const ind = await ambilIndikator(lama.indikator_uuid, f, k);
      const nilai = nilaiData(b.numerator ?? lama.numerator, b.denominator ?? lama.denominator, ind);
      const berubahNilai = nilai.numerator !== Number(lama.numerator) || nilai.denominator !== Number(lama.denominator);
      const row = await ubah(
        "mutu_indikator_data",
        lama.uuid,
        f,
        {
          ...nilai,
          catatan: teks(b.catatan, "catatan", 2000),
          // Angka hasil otomatis yang diubah tangan menjadi data manual (rincian asal tetap disimpan untuk penelusuran).
          ...(berubahNilai && lama.sumber === "otomatis" ? { sumber: "manual" } : {}),
          diisi_oleh: req.author.username ?? lama.diisi_oleh,
        },
        k,
      );
      await catatAudit(k, req, "indikator_data", row.uuid, "ubah", lama, row);
      return row;
    });
    kirim(res, hasil, "Data indikator berhasil diubah");
  }),
);

rute.post(
  "/data/:uuid/ajukan",
  izinMutu(SUB, "INPUT DATA"),
  tanganiMutu(async (req, res) => {
    const row = await transisi(req, "diajukan", "ajukan", { diajukan_oleh: req.author.username ?? null, diajukan_pada: sekarang() });
    kirim(res, row, "Data diajukan untuk validasi");
  }),
);

rute.post(
  "/data/:uuid/validasi",
  izinMutu(SUB, "VALIDASI"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const keputusan = wajibPilihan(b.keputusan, { setujui: "Setujui", kembalikan: "Kembalikan" }, "keputusan");
    const catatan = teks(b.catatan, "catatan", 2000) ?? null;
    if (keputusan === "kembalikan" && !catatan) throw permintaanSalah("catatan wajib diisi saat mengembalikan data");
    const ke = keputusan === "setujui" ? "tervalidasi" : "dikembalikan";
    const row = await transisi(
      req,
      ke,
      keputusan === "setujui" ? "validasi" : "kembalikan",
      { divalidasi_oleh: req.author.username ?? null, divalidasi_pada: sekarang(), catatan_validasi: catatan },
      (d) => {
        if (!validatorSah(d, req.author.username)) throw konflik("Validator tidak boleh orang yang mengisi atau mengajukan data ini");
      },
    );
    kirim(res, row, keputusan === "setujui" ? "Data tervalidasi" : "Data dikembalikan ke pengumpul");
  }),
);

rute.post(
  "/data/:uuid/buka",
  izinMutu(SUB, "VALIDASI"),
  tanganiMutu(async (req, res) => {
    const alasan = teks(req.body?.alasan, "alasan", 2000);
    if (!alasan) throw permintaanSalah("alasan membuka kembali data wajib diisi");
    const row = await transisi(req, "draf", "buka_kembali", { catatan_validasi: alasan, divalidasi_oleh: null, divalidasi_pada: null, diajukan_oleh: null, diajukan_pada: null });
    kirim(res, row, "Data dibuka kembali menjadi draf");
  }),
);

rute.delete(
  "/data/:uuid",
  izinMutu(SUB, "INPUT DATA"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilData(req.params.uuid, f, k, true);
      pastikanDapatDiubah(lama);
      const n = sekarang();
      await k.query(`UPDATE mutu_indikator_data SET deleted_at = $1, updated_at = $1 WHERE uuid = $2 AND faskes_uuid = $3`, [n, lama.uuid, f]);
      await catatAudit(k, req, "indikator_data", lama.uuid, "hapus", lama, null);
    });
    kirim(res, { uuid: req.params.uuid }, "Data indikator berhasil dihapus");
  }),
);

export default rute;
