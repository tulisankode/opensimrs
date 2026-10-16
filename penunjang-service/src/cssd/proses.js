import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { METODE, KONDISI_SERAH, STATUS_SET, STATUS_LOAD, AMBANG_KEDALUWARSA_HARI, cekPilihan, daftarNilai, ramah, teks, angkaOpsional, hitungKedaluwarsa } from "./bersama.js";
import { izinCssd } from "../umum/izin.js";
import { bowieDickHariIni } from "./master.js";

// Penerimaan alat kotor, dekontaminasi & pengemasan, serta siklus sterilisasi (load) dan penetapan kelayakan.

const ambilSet = (uuid, faskes) =>
  satu(
    `SELECT s.uuid, s.kode_set_fisik, s.kode_barcode, s.status, s.lokasi_tipe, s.lokasi_uuid, s.tanggal_kedaluwarsa_steril,
            s.load_terakhir_uuid, s.master_set_uuid, ms.nama_set, ms.kode_set, ms.masa_berlaku_steril_jam
       FROM cssd_set s JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid
      WHERE s.uuid = $1 AND s.faskes_uuid = $2 AND s.deleted_at IS NULL`,
    [uuid, faskes],
  );

const setDariBarcode = (barcode, faskes) =>
  satu(
    `SELECT s.uuid, s.status FROM cssd_set s WHERE s.kode_barcode = $1 AND s.faskes_uuid = $2 AND s.deleted_at IS NULL`,
    [barcode, faskes],
  );

// Identitas set dari body: set_uuid langsung, atau kode_barcode hasil pindaian (G4: barcode tak dikenal → 404 ramah).
const idSet = async (b, faskes) => {
  if (b.set_uuid) return b.set_uuid;
  if (b.kode_barcode) {
    const s = await setDariBarcode(String(b.kode_barcode).trim(), faskes);
    if (!s) throw permintaanSalah(`Barcode ${b.kode_barcode} tidak dikenal; periksa label atau cari set secara manual`);
    return s.uuid;
  }
  throw permintaanSalah("set_uuid atau kode_barcode wajib diisi");
};

export const rute = express.Router();

rute.get(
  "/set",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "s.faskes_uuid = $1 AND s.deleted_at IS NULL";
    const status = daftarNilai(req.query.status);
    if (status.length) {
      p.push(status);
      w += ` AND s.status = ANY($${p.length})`;
    }
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND s.lokasi_uuid = $${p.length}`;
    }
    if (req.query.q) {
      p.push(`%${String(req.query.q).trim()}%`);
      w += ` AND (s.kode_set_fisik ILIKE $${p.length} OR s.kode_barcode ILIKE $${p.length} OR ms.nama_set ILIKE $${p.length})`;
    }
    if (req.query.hampir_kedaluwarsa === "1" || req.query.hampir_kedaluwarsa === "true") {
      p.push(sekarang() + AMBANG_KEDALUWARSA_HARI * 86400);
      w += ` AND s.status = 'layak' AND s.tanggal_kedaluwarsa_steril IS NOT NULL AND s.tanggal_kedaluwarsa_steril <= $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM cssd_set s JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT s.uuid, s.kode_set_fisik, s.kode_barcode, s.status, s.lokasi_tipe, s.lokasi_uuid, s.tanggal_kedaluwarsa_steril,
              ms.uuid AS master_set_uuid, ms.nama_set, ms.kode_set
         FROM cssd_set s JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid
        WHERE ${w} ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/set/:uuid",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const s = await ambilSet(req.params.uuid, faskes);
    if (!s) throw tidakDitemukan("Set");
    const [serahTerima, dekontaminasi, load, pemakaian] = await Promise.all([
      query(`SELECT uuid, jenis, unit_asal_uuid, unit_tujuan_uuid, kondisi, catatan_kondisi, petugas_serah_uuid, petugas_terima_uuid, waktu,
                    dikonfirmasi_oleh, dikonfirmasi_pada
               FROM cssd_serah_terima WHERE set_uuid = $1 ORDER BY waktu DESC`, [s.uuid]),
      query(`SELECT uuid, petugas_uuid, waktu_mulai, waktu_selesai, hasil_kelengkapan, instrumen_kurang, catatan, waktu_pengemasan, petugas_pengemasan_uuid
               FROM cssd_dekontaminasi WHERE set_uuid = $1 ORDER BY waktu_mulai DESC`, [s.uuid]),
      query(`SELECT l.uuid, l.nomor_load, l.metode, l.status, l.hasil_indikator_kimia, l.hasil_indikator_biologi, l.waktu_mulai, l.waktu_selesai
               FROM cssd_load_set ls JOIN cssd_load l ON l.uuid = ls.load_uuid WHERE ls.set_uuid = $1 ORDER BY l.created_at DESC`, [s.uuid]),
      query(`SELECT uuid, kunjungan_uuid, pasien_uuid, nama_tindakan, unit_uuid, waktu_pakai, load_asal_uuid
               FROM cssd_pemakaian WHERE set_uuid = $1 AND deleted_at IS NULL ORDER BY waktu_pakai DESC`, [s.uuid]),
    ]);
    kirim(res, { ...s, serah_terima: serahTerima, dekontaminasi, load, pemakaian });
  }),
);

// Set berstatus & lokasi manual (dikarantina/hilang/rusak/menunggu_tindakan) — bukan hasil otomatis load.
rute.put(
  "/set/:uuid/status",
  izinCssd("Penyimpanan & Distribusi", "UPDATE STATUS"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const status = cekPilihan(b.status, { dikarantina: "", hilang: "", rusak: "", kotor: "" }, "status");
    if (!status) throw permintaanSalah("status wajib diisi: dikarantina, hilang, rusak, atau kotor");
    const t = await satu(
      `UPDATE cssd_set SET status = $1, updated_at = $2 WHERE uuid = $3 AND faskes_uuid = $4 AND deleted_at IS NULL RETURNING uuid, status`,
      [status, sekarang(), req.params.uuid, faskes],
    );
    if (!t) throw tidakDitemukan("Set");
    kirim(res, t, `Status set diubah menjadi ${STATUS_SET[status]}`);
  }),
);

// ── Penerimaan alat kotor ─────────────────────────────────────────────────────

rute.post(
  "/penerimaan-kotor",
  izinCssd("Penerimaan & Dekontaminasi", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["unit_asal_uuid"]);
    const setUuid = await idSet(b, faskes);
    const s = await ambilSet(setUuid, faskes);
    if (!s) throw tidakDitemukan("Set");
    const kondisi = cekPilihan(b.kondisi || "baik", KONDISI_SERAH, "kondisi");
    const waktu = Number(b.waktu) || sekarang();
    const hasil = await transaksi(async (k) => {
      const serah = await sisipkan(
        "cssd_serah_terima",
        {
          faskes_uuid: faskes,
          set_uuid: s.uuid,
          jenis: "terima_kotor",
          unit_asal_uuid: teks(b.unit_asal_uuid),
          kondisi,
          catatan_kondisi: teks(b.catatan_kondisi),
          petugas_serah_uuid: teks(b.petugas_serah_uuid),
          petugas_terima_uuid: teks(b.petugas_terima_uuid),
          waktu,
        },
        k,
      );
      await query(`UPDATE cssd_set SET status = 'kotor', lokasi_tipe = 'cssd', lokasi_uuid = NULL, updated_at = $2 WHERE uuid = $1`, [s.uuid, sekarang()], k);
      return serah;
    });
    kirim(res, hasil, "Serah terima alat kotor tercatat");
  }),
);

// ── Dekontaminasi, kelengkapan & pengemasan ───────────────────────────────────

rute.post(
  "/set/:uuid/dekontaminasi",
  izinCssd("Penerimaan & Dekontaminasi", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const s = await ambilSet(req.params.uuid, faskes);
    if (!s) throw tidakDitemukan("Set");
    const b = req.body ?? {};
    wajib(b, ["waktu_mulai", "hasil_kelengkapan"]);
    const hasilKelengkapan = cekPilihan(b.hasil_kelengkapan, { lengkap: "", tidak_lengkap: "" }, "hasil_kelengkapan");
    const instrumenKurang = Array.isArray(b.instrumen_kurang) ? b.instrumen_kurang.map((i) => teks(i)).filter(Boolean) : [];
    if (hasilKelengkapan === "tidak_lengkap" && !instrumenKurang.length && !teks(b.catatan)) {
      throw permintaanSalah("instrumen_kurang atau catatan wajib diisi bila hasil_kelengkapan tidak_lengkap");
    }
    // Set dengan kelengkapan tidak lengkap/rusak ditahan dari alur load normal (alur alternatif A1).
    const statusBaru = hasilKelengkapan === "lengkap" && teks(b.waktu_pengemasan ?? b.waktu_selesai) ? "dikemas" : hasilKelengkapan === "lengkap" ? "dekontaminasi" : "menunggu_tindakan";
    const catat = await transaksi(async (k) => {
      const d = await sisipkan(
        "cssd_dekontaminasi",
        {
          faskes_uuid: faskes,
          set_uuid: s.uuid,
          petugas_uuid: teks(b.petugas_uuid),
          waktu_mulai: Number(b.waktu_mulai),
          waktu_selesai: angkaOpsional(b.waktu_selesai, "waktu_selesai") ?? null,
          hasil_kelengkapan: hasilKelengkapan,
          instrumen_kurang: JSON.stringify(instrumenKurang),
          catatan: teks(b.catatan),
          waktu_pengemasan: angkaOpsional(b.waktu_pengemasan, "waktu_pengemasan") ?? null,
          petugas_pengemasan_uuid: teks(b.petugas_pengemasan_uuid),
        },
        k,
      );
      await query(`UPDATE cssd_set SET status = $2, updated_at = $3 WHERE uuid = $1`, [s.uuid, statusBaru, sekarang()], k);
      return d;
    });
    kirim(res, { ...catat, status_set: statusBaru }, "Dekontaminasi tercatat");
  }),
);

// ── Siklus sterilisasi (load) ─────────────────────────────────────────────────

const detailLoad = async (uuid, faskes) => {
  const l = await satu(
    `SELECT uuid, mesin_uuid, nomor_load, metode, parameter_suhu, parameter_tekanan, parameter_durasi_menit,
            waktu_mulai, waktu_selesai, hasil_indikator_kimia, hasil_indikator_biologi, status, petugas_uuid, catatan
       FROM cssd_load WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
    [uuid, faskes],
  );
  if (!l) return null;
  const set = await query(
    `SELECT s.uuid, s.kode_set_fisik, s.kode_barcode, s.status, ms.nama_set
       FROM cssd_load_set ls JOIN cssd_set s ON s.uuid = ls.set_uuid JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid
      WHERE ls.load_uuid = $1 ORDER BY s.kode_set_fisik`,
    [l.uuid],
  );
  return { ...l, set };
};

rute.get(
  "/load",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "l.faskes_uuid = $1 AND l.deleted_at IS NULL";
    const status = daftarNilai(req.query.status);
    if (status.length) {
      p.push(status);
      w += ` AND l.status = ANY($${p.length})`;
    }
    if (req.query.mesin_uuid) {
      p.push(String(req.query.mesin_uuid));
      w += ` AND l.mesin_uuid = $${p.length}`;
    }
    if (req.query.dari) {
      p.push(Number(req.query.dari));
      w += ` AND l.waktu_mulai >= $${p.length}`;
    }
    if (req.query.sampai) {
      p.push(Number(req.query.sampai));
      w += ` AND l.waktu_mulai <= $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM cssd_load l WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT l.uuid, l.nomor_load, l.metode, l.status, l.hasil_indikator_kimia, l.hasil_indikator_biologi, l.waktu_mulai, l.waktu_selesai,
              m.nama_mesin, (SELECT COUNT(*) FROM cssd_load_set ls WHERE ls.load_uuid = l.uuid)::int AS jumlah_set
         FROM cssd_load l JOIN cssd_mesin m ON m.uuid = l.mesin_uuid
        WHERE ${w} ORDER BY l.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/load/:uuid",
  tangani(async (req, res) => {
    const l = await detailLoad(req.params.uuid, req.author.faskesUuid);
    if (!l) throw tidakDitemukan("Load");
    kirim(res, l);
  }),
);

rute.post(
  "/load",
  izinCssd("Siklus Sterilisasi", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["mesin_uuid", "nomor_load", "metode"]);
    const metode = cekPilihan(b.metode, METODE, "metode");
    const setUuid = Array.isArray(b.set_uuid) ? [...new Set(b.set_uuid.filter(Boolean))] : [];
    if (!setUuid.length) throw permintaanSalah("set_uuid wajib diisi minimal satu set");
    const m = await satu(`SELECT uuid, status_aktif FROM cssd_mesin WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.mesin_uuid, faskes]);
    if (!m) throw tidakDitemukan("Mesin");
    if (!m.status_aktif) throw permintaanSalah("Mesin nonaktif tidak dapat dipakai untuk load baru");
    // Mesin autoklaf harus lulus uji Bowie-Dick hari ini sebelum dipakai untuk load baru (G2).
    if (metode === "autoklaf") {
      const tanggal = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
      const bd = await bowieDickHariIni(m.uuid, tanggal);
      if (!bd || bd.hasil !== "lulus") {
        throw permintaanSalah("Mesin tidak boleh dipakai: uji Bowie-Dick hari ini belum tercatat lulus");
      }
    }
    const set = await query(`SELECT uuid, status FROM cssd_set WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [setUuid, faskes]);
    if (set.length !== setUuid.length) throw permintaanSalah("Sebagian set tidak ditemukan");
    const belumSiap = set.filter((s) => s.status !== "dikemas");
    if (belumSiap.length) throw permintaanSalah(`Set berikut belum berstatus dikemas: ${belumSiap.map((s) => s.uuid).join(", ")}`);

    const l = await transaksi(async (k) => {
      const baru = await sisipkan(
        "cssd_load",
        {
          faskes_uuid: faskes,
          mesin_uuid: m.uuid,
          nomor_load: String(b.nomor_load).trim(),
          metode,
          parameter_suhu: angkaOpsional(b.parameter_suhu, "parameter_suhu") ?? null,
          parameter_tekanan: angkaOpsional(b.parameter_tekanan, "parameter_tekanan") ?? null,
          parameter_durasi_menit: angkaOpsional(b.parameter_durasi_menit, "parameter_durasi_menit") ?? null,
          waktu_mulai: angkaOpsional(b.waktu_mulai, "waktu_mulai") ?? sekarang(),
          waktu_selesai: angkaOpsional(b.waktu_selesai, "waktu_selesai") ?? null,
          status: "menunggu_hasil",
          petugas_uuid: teks(b.petugas_uuid),
          catatan: teks(b.catatan),
        },
        k,
      ).catch((e) => ramah(e, `Nomor load ${b.nomor_load} sudah dipakai pada mesin ini`));
      for (const s of setUuid) await sisipkan("cssd_load_set", { load_uuid: baru.uuid, set_uuid: s }, k);
      await query(`UPDATE cssd_set SET status = 'menunggu_keputusan', load_terakhir_uuid = $2, updated_at = $3 WHERE uuid = ANY($1)`, [setUuid, baru.uuid, sekarang()], k);
      return baru;
    });
    kirim(res, await detailLoad(l.uuid, faskes), "Load tercatat; set berstatus menunggu keputusan");
  }),
);

// Hasil indikator kimia/biologi: satu kegagalan → seluruh set dalam load otomatis tidak layak (KF-13/NF-3),
// transaksional agar tidak ada set yang tertinggal berstatus lama. Bila keduanya lulus → set layak + kedaluwarsa.
rute.put(
  "/load/:uuid/hasil",
  izinCssd("Siklus Sterilisasi", "INPUT HASIL"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const kimia = b.hasil_indikator_kimia === undefined ? undefined : cekPilihan(b.hasil_indikator_kimia, { lulus: "", gagal: "" }, "hasil_indikator_kimia");
    const biologi = b.hasil_indikator_biologi === undefined ? undefined : cekPilihan(b.hasil_indikator_biologi, { lulus: "", gagal: "" }, "hasil_indikator_biologi");
    if (kimia === undefined && biologi === undefined) throw permintaanSalah("hasil_indikator_kimia atau hasil_indikator_biologi wajib diisi");

    await transaksi(async (k) => {
      const l = await satu(`SELECT uuid, waktu_selesai, status FROM cssd_load WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes], k);
      if (!l) throw tidakDitemukan("Load");
      if (["lulus", "gagal"].includes(l.status)) throw permintaanSalah("Hasil load ini sudah ditetapkan dan tidak dapat diubah");

      const kimiaBaru = kimia ?? (await satu(`SELECT hasil_indikator_kimia FROM cssd_load WHERE uuid = $1`, [l.uuid], k)).hasil_indikator_kimia;
      const biologiBaru = biologi ?? (await satu(`SELECT hasil_indikator_biologi FROM cssd_load WHERE uuid = $1`, [l.uuid], k)).hasil_indikator_biologi;
      const adaGagal = kimiaBaru === "gagal" || biologiBaru === "gagal";
      const lengkapLulus = kimiaBaru === "lulus" && biologiBaru === "lulus";
      const waktuSelesai = l.waktu_selesai ?? sekarang();
      const statusLoad = adaGagal ? "gagal" : lengkapLulus ? "lulus" : "menunggu_hasil";

      await query(
        `UPDATE cssd_load SET hasil_indikator_kimia = $2, hasil_indikator_biologi = $3, status = $4,
                catatan = COALESCE($5, catatan), waktu_selesai = COALESCE(waktu_selesai, $6), updated_at = $7
          WHERE uuid = $1`,
        [l.uuid, kimiaBaru, biologiBaru, statusLoad, teks(b.catatan), waktuSelesai, sekarang()],
        k,
      );

      if (statusLoad === "gagal") {
        await query(`UPDATE cssd_set SET status = 'tidak_layak', updated_at = $2 WHERE uuid IN (SELECT set_uuid FROM cssd_load_set WHERE load_uuid = $1)`, [l.uuid, sekarang()], k);
        // Susun recall otomatis (satu per load gagal) agar CSSD/Komite PPI dapat langsung menindaklanjuti (KF-22).
        const recall = await sisipkan("cssd_recall", { faskes_uuid: faskes, load_uuid: l.uuid, status: "dibuka", dibuka_oleh: req.author.username, waktu_dibuka: sekarang() }, k).catch(
          (e) => ramah(e, "Recall untuk load ini sudah ada"),
        );
        const setLoad = await query(`SELECT set_uuid FROM cssd_load_set WHERE load_uuid = $1`, [l.uuid], k);
        for (const { set_uuid } of setLoad) await sisipkan("cssd_recall_set", { recall_uuid: recall.uuid, set_uuid, status_penanganan: "belum_ditindaklanjuti" }, k);
      } else if (statusLoad === "lulus") {
        const setLoad = await query(
          `SELECT s.uuid, ms.masa_berlaku_steril_jam FROM cssd_load_set ls JOIN cssd_set s ON s.uuid = ls.set_uuid JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid
            WHERE ls.load_uuid = $1`,
          [l.uuid],
          k,
        );
        for (const s of setLoad) {
          const kedaluwarsa = hitungKedaluwarsa(waktuSelesai, s.masa_berlaku_steril_jam);
          await query(`UPDATE cssd_set SET status = 'layak', tanggal_kedaluwarsa_steril = $2, updated_at = $3 WHERE uuid = $1`, [s.uuid, kedaluwarsa, sekarang()], k);
        }
      }
    });
    kirim(res, await detailLoad(req.params.uuid, faskes), "Hasil load tercatat");
  }),
);
