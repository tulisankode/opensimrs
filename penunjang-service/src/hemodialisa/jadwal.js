import express from "express";
import { query, satu, transaksi, uuidv7, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinHd } from "../umum/izin.js";
import { POLA_JADWAL, hariIni, pilihan, ramah, tambahHari, tanggalRutin, tanggalValid, teks } from "./bersama.js";
import { validasiKunjungan } from "./registrasi.js";
import { kirimJadwalHdis } from "./hdis/kirim.js";

// Jadwal HD per mesin × shift × tanggal (KF-2/KF-3, KT-2/KT-3): satu kali atau rutin (hari dalam seminggu + periode).
// Bentrok mesin/shift dan pasien ganda di shift yang sama ditolak sebelum menyimpan (seluruh rangkaian rutin batal bila
// satu tanggal bentrok) dan dijaga indeks unik parsial di database (hd_jadwal_slot_uq, hd_jadwal_pasien_uq) untuk
// permintaan bersamaan. Setelah tersimpan, jadwal dikirim ke HDIS (best-effort, lihat hdis/kirim.js).
const rute = express.Router();
const izin = (aksi) => izinHd("Registrasi & Jadwal", aksi);

export const KOLOM_JADWAL = `j.uuid, j.registrasi_uuid, j.mesin_uuid, j.shift_uuid, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, j.pola, j.rencana_uuid,
  j.no_reg, j.status, j.catatan, j.hadir_pada, j.alasan_batal, j.dibatalkan_oleh, j.dibuat_oleh, j.created_at, j.updated_at,
  m.kode AS kode_mesin, m.nama AS nama_mesin, s.kode AS kode_shift, s.nama AS nama_shift, to_char(s.jam_mulai, 'HH24:MI') AS jam_mulai,
  to_char(s.jam_selesai, 'HH24:MI') AS jam_selesai, s.urutan AS urutan_shift, r.no_reg_hd, r.jenis, r.patient_uuid, p.no_rm, p.name AS nama_pasien,
  se.uuid AS sesi_uuid, se.status AS status_sesi,
  (SELECT h.status FROM hd_hdis_pesan h WHERE h.jadwal_uuid = j.uuid AND h.arah = 'keluar' ORDER BY h.updated_at DESC LIMIT 1) AS status_hdis`;
const DARI = `hd_jadwal j JOIN hd_mesin m ON m.uuid = j.mesin_uuid JOIN hd_shift s ON s.uuid = j.shift_uuid
  JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid JOIN patients p ON p.uuid = r.patient_uuid
  LEFT JOIN hd_sesi se ON se.jadwal_uuid = j.uuid AND se.status <> 'batal' AND se.deleted_at IS NULL`;

export const ambilJadwal = async (uuid, faskes, k, kunci = false) => {
  const j = await satu(`SELECT *, to_char(tanggal, 'YYYY-MM-DD') AS tanggal_teks FROM hd_jadwal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${kunci ? "FOR UPDATE" : ""}`, [uuid, faskes], k);
  if (!j) throw tidakDitemukan("Jadwal HD");
  return j;
};
export const detailJadwal = (uuid, faskes, k) => satu(`SELECT ${KOLOM_JADWAL} FROM ${DARI} WHERE j.uuid = $1 AND j.faskes_uuid = $2`, [uuid, faskes], k);

// Pemeriksaan bentrok untuk sekumpulan tanggal (kecuali jadwal `kecuali`). Mengembalikan daftar pesan bentrok.
const cariBentrok = async (k, faskes, { mesinUuid, shiftUuid, registrasiUuid, tanggal, kecuali = null }) => {
  const rows = await query(
    `SELECT to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, (j.mesin_uuid = $2) AS mesin_sama, (j.registrasi_uuid = $4) AS pasien_sama, p.name AS nama_pasien
       FROM hd_jadwal j JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid JOIN patients p ON p.uuid = r.patient_uuid
      WHERE j.faskes_uuid = $1 AND j.shift_uuid = $3 AND j.tanggal = ANY($5::date[]) AND j.status <> 'batal' AND j.deleted_at IS NULL
        AND (j.mesin_uuid = $2 OR j.registrasi_uuid = $4) AND ($6::text IS NULL OR j.uuid <> $6)
      ORDER BY j.tanggal`,
    [faskes, mesinUuid, shiftUuid, registrasiUuid, tanggal, kecuali],
    k,
  );
  return rows.map((b) => (b.pasien_sama ? `${b.tanggal}: pasien sudah dijadwalkan pada shift ini` : `${b.tanggal}: mesin sudah dipakai ${b.nama_pasien}`));
};

const validasiMesinShift = async (k, faskes, mesinUuid, shiftUuid) => {
  const mesin = await satu(`SELECT uuid, kode, status FROM hd_mesin WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [mesinUuid, faskes], k);
  if (!mesin) throw tidakDitemukan("Mesin HD");
  if (mesin.status !== "aktif") throw new Galat(409, `Mesin ${mesin.kode} berstatus ${mesin.status}, tidak dapat dijadwalkan`);
  const shift = await satu(`SELECT uuid, nama, aktif FROM hd_shift WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [shiftUuid, faskes], k);
  if (!shift) throw tidakDitemukan("Shift HD");
  if (!shift.aktif) throw new Galat(409, `Shift ${shift.nama} nonaktif`);
};

// Penjadwalan diserialkan per faskes agar dua petugas yang memesan slot sama bersamaan mendapat pesan bentrok yang jelas.
const kunciJadwalFaskes = (faskes, k) => query(`SELECT pg_advisory_xact_lock(hashtext('hd_jadwal:' || $1))`, [faskes], k);

const kirimHdisBanyak = async (faskes, uuids, pengguna) => {
  const hasil = [];
  for (const uuid of uuids) {
    try {
      hasil.push({ jadwal_uuid: uuid, ...(await kirimJadwalHdis(faskes, uuid, pengguna)) });
    } catch (e) {
      hasil.push({ jadwal_uuid: uuid, status: "gagal", pesan: e.message });
    }
  }
  return hasil;
};

rute.get(
  "/jadwal",
  izin("READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const mulai = q.tanggal_mulai ? tanggalValid(q.tanggal_mulai, "tanggal_mulai") : hariIni();
    const selesai = q.tanggal_selesai ? tanggalValid(q.tanggal_selesai, "tanggal_selesai") : tambahHari(mulai, 6);
    if (selesai < mulai) throw permintaanSalah("tanggal_selesai tidak boleh sebelum tanggal_mulai");
    if (selesai > tambahHari(mulai, 92)) throw permintaanSalah("Rentang tampilan jadwal maksimal 93 hari");
    const p = [req.author.faskesUuid, mulai, selesai];
    let w = "j.faskes_uuid = $1 AND j.deleted_at IS NULL AND j.tanggal BETWEEN $2::date AND $3::date";
    for (const [param, kolom] of [["mesin_uuid", "j.mesin_uuid"], ["shift_uuid", "j.shift_uuid"], ["status", "j.status"], ["registrasi_uuid", "j.registrasi_uuid"]]) {
      if (q[param]) {
        p.push(String(q[param]));
        w += ` AND ${kolom} = $${p.length}`;
      }
    }
    if (!q.status && !["1", "true"].includes(String(q.termasuk_batal))) w += " AND j.status <> 'batal'";
    kirim(res, await query(`SELECT ${KOLOM_JADWAL} FROM ${DARI} WHERE ${w} ORDER BY j.tanggal, s.urutan, s.jam_mulai, m.kode LIMIT 2000`, p));
  }),
);

// Antrean harian (KF-3): jadwal satu tanggal (bawaan hari ini) urut shift → mesin, beserta status sesi.
rute.get(
  "/antrean",
  izin("READ"),
  tangani(async (req, res) => {
    const tanggal = req.query.tanggal ? tanggalValid(req.query.tanggal) : hariIni();
    const rows = await query(
      `SELECT ${KOLOM_JADWAL} FROM ${DARI} WHERE j.faskes_uuid = $1 AND j.deleted_at IS NULL AND j.tanggal = $2::date AND j.status <> 'batal'
        ORDER BY s.urutan, s.jam_mulai, m.kode`,
      [req.author.faskesUuid, tanggal],
    );
    kirim(res, { tanggal, antrean: rows.map((r, i) => ({ ...r, nomor_antrean: i + 1 })) });
  }),
);

// Pengingat (KF-3): jadwal terjadwal dalam N hari ke depan (bawaan 1 = hari ini & besok, maks. 7) yang belum hadir.
rute.get(
  "/pengingat",
  izin("READ"),
  tangani(async (req, res) => {
    const hari = Math.min(Math.max(Number(req.query.hari) || 1, 0), 7);
    const mulai = hariIni();
    kirim(
      res,
      await query(
        `SELECT ${KOLOM_JADWAL} FROM ${DARI} WHERE j.faskes_uuid = $1 AND j.deleted_at IS NULL AND j.status = 'terjadwal'
            AND j.tanggal BETWEEN $2::date AND $3::date ORDER BY j.tanggal, s.urutan, m.kode`,
        [req.author.faskesUuid, mulai, tambahHari(mulai, hari)],
      ),
    );
  }),
);

rute.get(
  "/jadwal/:uuid",
  izin("READ"),
  tangani(async (req, res) => {
    const j = await detailJadwal(req.params.uuid, req.author.faskesUuid);
    if (!j) throw tidakDitemukan("Jadwal HD");
    kirim(res, j);
  }),
);

// POST /jadwal { registrasi_uuid, mesin_uuid, shift_uuid, pola: satu_kali|rutin, tanggal | hari[] + tanggal_mulai + tanggal_selesai, catatan? }
rute.post(
  "/jadwal",
  izin("CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["registrasi_uuid", "mesin_uuid", "shift_uuid"]);
    const f = req.author.faskesUuid;
    const pola = pilihan(b.pola ?? "satu_kali", POLA_JADWAL, "pola");
    const daftarTanggal = pola === "rutin" ? tanggalRutin(b.hari, b.tanggal_mulai, b.tanggal_selesai) : [tanggalValid(b.tanggal)];
    if (daftarTanggal[0] < hariIni()) throw permintaanSalah("Tanggal jadwal tidak boleh sebelum hari ini");

    const dibuat = await transaksi(async (k) => {
      await kunciJadwalFaskes(f, k);
      const reg = await satu(`SELECT uuid, status FROM hd_registrasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.registrasi_uuid, f], k);
      if (!reg) throw tidakDitemukan("Registrasi HD");
      if (reg.status !== "aktif") throw new Galat(409, "Registrasi HD nonaktif");
      await validasiMesinShift(k, f, b.mesin_uuid, b.shift_uuid);
      const bentrok = await cariBentrok(k, f, { mesinUuid: b.mesin_uuid, shiftUuid: b.shift_uuid, registrasiUuid: reg.uuid, tanggal: daftarTanggal });
      if (bentrok.length) {
        const e = new Galat(409, `Jadwal bentrok, tidak ada yang disimpan: ${bentrok.slice(0, 5).join("; ")}${bentrok.length > 5 ? ` (+${bentrok.length - 5} lainnya)` : ""}`);
        throw e;
      }
      const rencana = pola === "rutin" ? uuidv7() : null;
      const t = sekarang();
      const uuids = [];
      for (const tanggal of daftarTanggal) {
        const baris = await satu(
          `INSERT INTO hd_jadwal (uuid, faskes_uuid, registrasi_uuid, mesin_uuid, shift_uuid, tanggal, pola, rencana_uuid, status, catatan, dibuat_oleh, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'terjadwal',$9,$10,$11,$11) RETURNING uuid`,
          [uuidv7(), f, reg.uuid, b.mesin_uuid, b.shift_uuid, tanggal, pola, rencana, teks(b.catatan), req.author.username ?? null, t],
          k,
        ).catch((e) => ramah(e, `Jadwal ${tanggal} bentrok dengan jadwal lain`));
        uuids.push(baris.uuid);
      }
      return uuids;
    });

    const integrasi = await kirimHdisBanyak(f, dibuat, req.author.username ?? null);
    const jadwal = await query(`SELECT ${KOLOM_JADWAL} FROM ${DARI} WHERE j.uuid = ANY($1) AND j.faskes_uuid = $2 ORDER BY j.tanggal`, [dibuat, f]);
    kirim(res, { jadwal, integrasi }, `${dibuat.length} jadwal HD berhasil dibuat`);
  }),
);

// PUT /jadwal/:uuid { mesin_uuid?, shift_uuid?, tanggal?, catatan? } — pindah slot (cek ulang bentrok) sebelum sesi dibuka.
rute.put(
  "/jadwal/:uuid",
  izin("UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const pindah = await transaksi(async (k) => {
      await kunciJadwalFaskes(f, k);
      const j = await ambilJadwal(req.params.uuid, f, k, true);
      if (!["terjadwal", "hadir"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status}, tidak dapat diubah`);
      const sesi = await satu(`SELECT 1 FROM hd_sesi WHERE jadwal_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL`, [j.uuid], k);
      const mesin = b.mesin_uuid ?? j.mesin_uuid;
      const shift = b.shift_uuid ?? j.shift_uuid;
      const tanggal = b.tanggal ? tanggalValid(b.tanggal) : j.tanggal_teks;
      const slotBerubah = mesin !== j.mesin_uuid || shift !== j.shift_uuid || tanggal !== j.tanggal_teks;
      if (slotBerubah) {
        if (sesi) throw new Galat(409, "Sesi HD sudah dibuka untuk jadwal ini; slot tidak dapat dipindah");
        if (tanggal < hariIni()) throw permintaanSalah("Tanggal jadwal tidak boleh sebelum hari ini");
        await validasiMesinShift(k, f, mesin, shift);
        const bentrok = await cariBentrok(k, f, { mesinUuid: mesin, shiftUuid: shift, registrasiUuid: j.registrasi_uuid, tanggal: [tanggal], kecuali: j.uuid });
        if (bentrok.length) throw new Galat(409, `Jadwal bentrok: ${bentrok.join("; ")}`);
      }
      await query(
        `UPDATE hd_jadwal SET mesin_uuid = $3, shift_uuid = $4, tanggal = $5, catatan = COALESCE($6, catatan), versi = versi + CASE WHEN $8 THEN 1 ELSE 0 END, updated_at = $7 WHERE uuid = $1 AND faskes_uuid = $2`,
        [j.uuid, f, mesin, shift, tanggal, b.catatan === undefined ? null : teks(b.catatan) ?? "", sekarang(), slotBerubah],
        k,
      ).catch((e) => ramah(e, "Jadwal bentrok dengan jadwal lain"));
      return slotBerubah;
    });
    const integrasi = pindah ? await kirimHdisBanyak(f, [req.params.uuid], req.author.username ?? null) : [];
    kirim(res, { jadwal: await detailJadwal(req.params.uuid, f), integrasi }, "Jadwal HD diperbarui");
  }),
);

// Pasien hadir (masuk antrean pelayanan). no_reg opsional: kunjungan RJ/RI/IGD hari itu untuk penjamin & tagihan.
rute.post(
  "/jadwal/:uuid/hadir",
  izin("UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k, true);
      if (!["terjadwal", "hadir"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status}`);
      const reg = await satu(`SELECT patient_uuid FROM hd_registrasi WHERE uuid = $1`, [j.registrasi_uuid], k);
      const kunjungan = req.body?.no_reg ? await validasiKunjungan(req.body.no_reg, reg.patient_uuid, f) : null;
      await query(`UPDATE hd_jadwal SET status = 'hadir', hadir_pada = COALESCE(hadir_pada, $3), no_reg = COALESCE($4, no_reg), updated_at = $3 WHERE uuid = $1 AND faskes_uuid = $2`, [
        j.uuid, f, sekarang(), kunjungan?.no_reg ?? null,
      ], k);
    });
    kirim(res, await detailJadwal(req.params.uuid, f), "Kehadiran pasien dicatat");
  }),
);

// Batal jadwal (alasan wajib). Sesi yang masih tahap asesmen ikut dibatalkan; sesi berjalan/selesai tidak dapat dibatalkan.
rute.post(
  "/jadwal/:uuid/batal",
  izin("BATAL"),
  tangani(async (req, res) => {
    const alasan = teks(req.body?.alasan);
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k, true);
      if (!["terjadwal", "hadir"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status}, tidak dapat dibatalkan`);
      const t = sekarang();
      const sesi = await satu(`SELECT uuid, status FROM hd_sesi WHERE jadwal_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL FOR UPDATE`, [j.uuid], k);
      if (sesi && sesi.status !== "asesmen") throw new Galat(409, `Sesi HD berstatus ${sesi.status}; jadwal tidak dapat dibatalkan`);
      if (sesi) await query(`UPDATE hd_sesi SET status = 'batal', alasan_batal = $2, updated_at = $3 WHERE uuid = $1`, [sesi.uuid, `Jadwal dibatalkan: ${alasan}`, t], k);
      await query(`UPDATE hd_jadwal SET status = 'batal', alasan_batal = $3, dibatalkan_oleh = $4, versi = versi + 1, updated_at = $5 WHERE uuid = $1 AND faskes_uuid = $2`, [
        j.uuid, f, alasan, req.author.username ?? null, t,
      ], k);
    });
    const integrasi = await kirimHdisBanyak(f, [req.params.uuid], req.author.username ?? null);
    kirim(res, { jadwal: await detailJadwal(req.params.uuid, f), integrasi }, "Jadwal HD dibatalkan");
  }),
);

export default rute;
