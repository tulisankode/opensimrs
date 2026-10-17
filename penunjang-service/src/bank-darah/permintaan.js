import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { cariKunjungan, kunjunganDariRekamMedis, pasien } from "../umum/kunjungan.js";
import { pastikanIzin, izinBdrs } from "../umum/izin.js";
import { GOLONGAN_ABO, RHESUS, STATUS_PERMINTAAN, SUMBER_KUNJUNGAN, cekPilihan, daftarNilai, rentangOpsional, teks, tglLokal } from "./bersama.js";

// Permintaan Darah dari ruangan (Rawat Jalan/Rawat Inap/IGD): diajukan pada kunjungan aktif pasien, diproses BDRS,
// lalu dilanjutkan ke pemeriksaan golongan & crossmatch (./pemeriksaan.js, ./crossmatch.js) dan serah terima
// (./serah-terima.js). Alur status: baru → diproses → (perlu_dilengkapi → diproses) → dipenuhi_sebagian/diserahkan,
// atau baru/diproses → dibatalkan/ditolak.
const rute = express.Router();

const KOLOM = `
  pm.uuid, pm.no_permintaan, pm.patient_uuid, pm.no_rm, pm.no_reg, pm.rekam_medis_uuid, pm.sumber_kunjungan,
  pm.lokasi_asal_uuid, pm.komponen_uuid, pm.golongan_diminta, pm.rhesus_diminta, pm.jumlah_diminta, pm.jumlah_dipenuhi,
  pm.indikasi, pm.cito, pm.status, pm.alasan_kembali, pm.alasan_batal, pm.dokter_peminta_uuid, pm.dokter_peminta_nama,
  pm.dibuat_oleh, pm.diproses_oleh, pm.waktu_diproses, pm.created_at, pm.updated_at,
  p.name AS nama_pasien, p.gender, bd.birth_date, l.name AS lokasi_asal, k.kode AS komponen_kode, k.nama AS komponen_nama`;
const JOIN = `
  LEFT JOIN patients p ON p.uuid = pm.patient_uuid
  LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
  LEFT JOIN lokasi l ON l.uuid = pm.lokasi_asal_uuid
  LEFT JOIN bdrs_komponen_darah k ON k.uuid = pm.komponen_uuid`;

export const detailPermintaan = async (uuid, faskesUuid, k) => {
  const pm = await satu(`SELECT ${KOLOM} FROM bdrs_permintaan pm ${JOIN} WHERE pm.uuid = $1 AND pm.faskes_uuid = $2 AND pm.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!pm) throw tidakDitemukan("Permintaan darah");
  const [pemeriksaan, crossmatch, serahTerima] = await Promise.all([
    satu(`SELECT * FROM bdrs_pemeriksaan WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [pm.uuid], k),
    query(
      `SELECT c.uuid, c.stok_uuid, s.no_kantong, s.golongan_abo, s.rhesus, s.tanggal_kedaluwarsa, s.status AS status_stok,
              c.hasil_mayor, c.hasil_minor, c.kompatibel, c.status_validasi, c.petugas, c.waktu_periksa, c.catatan
         FROM bdrs_crossmatch c JOIN bdrs_stok s ON s.uuid = c.stok_uuid
        WHERE c.permintaan_uuid = $1 AND c.deleted_at IS NULL ORDER BY c.created_at`,
      [pm.uuid],
      k,
    ),
    query(
      `SELECT st.uuid, st.status, st.petugas_penyerah, st.waktu_konfirmasi_penyerah, st.petugas_penerima, st.waktu_konfirmasi_penerima,
              st.status_tagihan, st.pesan_tagihan, st.created_at,
              (SELECT json_agg(json_build_object('uuid', i.uuid, 'stok_uuid', i.stok_uuid, 'no_kantong', s2.no_kantong) ORDER BY i.created_at)
                 FROM bdrs_serah_terima_item i JOIN bdrs_stok s2 ON s2.uuid = i.stok_uuid
                WHERE i.serah_terima_uuid = st.uuid AND i.deleted_at IS NULL) AS items
         FROM bdrs_serah_terima st WHERE st.permintaan_uuid = $1 AND st.deleted_at IS NULL ORDER BY st.created_at`,
      [pm.uuid],
      k,
    ),
  ]);
  return { ...pm, pemeriksaan, crossmatch, serah_terima: serahTerima };
};

export const kunciPermintaan = async (uuid, faskes, k) => {
  const pm = await satu(`SELECT * FROM bdrs_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskes], k);
  if (!pm) throw tidakDitemukan("Permintaan darah");
  return pm;
};

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "pm.faskes_uuid = $1 AND pm.deleted_at IS NULL";
    const status = daftarNilai(req.query.status).filter((s) => STATUS_PERMINTAAN[s]);
    if (status.length) {
      p.push(status);
      w += ` AND pm.status = ANY($${p.length})`;
    }
    if (req.query.lokasi_asal_uuid) {
      p.push(req.query.lokasi_asal_uuid);
      w += ` AND pm.lokasi_asal_uuid = $${p.length}`;
    }
    if (["1", "true"].includes(String(req.query.cito))) w += " AND pm.cito";
    const rentang = rentangOpsional(req.query);
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("pm.created_at")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (p.name ILIKE $${p.length} OR pm.no_rm ILIKE $${p.length} OR pm.no_permintaan ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM bdrs_permintaan pm ${JOIN} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM} FROM bdrs_permintaan pm ${JOIN} WHERE ${w} ORDER BY pm.cito DESC, pm.created_at ASC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Permintaan darah satu kunjungan (RME/ruangan): ?no_reg= atau ?rekam_medis_uuid= atau ?patient_uuid= (riwayat pasien).
rute.get(
  "/kunjungan",
  tangani(async (req, res) => {
    const { no_reg: noReg, rekam_medis_uuid: rm, patient_uuid: patientUuid } = req.query;
    if (!noReg && !rm && !patientUuid) throw permintaanSalah("no_reg, rekam_medis_uuid, atau patient_uuid wajib diisi");
    const p = [req.author.faskesUuid];
    const syarat = [];
    for (const [kolom, nilai] of [["pm.no_reg", noReg], ["pm.rekam_medis_uuid", rm], ["pm.patient_uuid", patientUuid]]) {
      if (!nilai) continue;
      p.push(nilai);
      syarat.push(`${kolom} = $${p.length}`);
    }
    kirim(
      res,
      await query(
        `SELECT ${KOLOM} FROM bdrs_permintaan pm ${JOIN}
          WHERE pm.faskes_uuid = $1 AND pm.deleted_at IS NULL AND (${syarat.join(" OR ")})
          ORDER BY pm.created_at DESC LIMIT 100`,
        p,
      ),
    );
  }),
);

rute.get("/:uuid", tangani(async (req, res) => kirim(res, await detailPermintaan(req.params.uuid, req.author.faskesUuid))));

rute.post(
  "/",
  izinBdrs("Permintaan Darah", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    wajib(b, ["komponen_uuid", "golongan_diminta", "rhesus_diminta", "jumlah_diminta", "dokter_peminta_uuid"]);
    if (!b.no_reg && !b.rekam_medis_uuid) throw permintaanSalah("no_reg atau rekam_medis_uuid wajib diisi");
    const kunjungan = b.no_reg ? await cariKunjungan(b.no_reg, faskes) : await kunjunganDariRekamMedis(b.rekam_medis_uuid, faskes);
    if (!kunjungan) throw permintaanSalah("Kunjungan (No. Reg / rekam medis) tidak ditemukan");
    if (!SUMBER_KUNJUNGAN[kunjungan.pelayanan]) throw permintaanSalah("Permintaan darah hanya dapat diajukan dari kunjungan Rawat Jalan, Rawat Inap, atau IGD");
    const p = await pasien(kunjungan.patient_uuid, faskes);
    if (!p) throw permintaanSalah("Pasien tidak ditemukan di faskes ini");
    const jumlah = Number(b.jumlah_diminta);
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 20) throw permintaanSalah("jumlah_diminta harus bilangan bulat 1–20");
    const komponen = await satu(`SELECT uuid FROM bdrs_komponen_darah WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [b.komponen_uuid, faskes]);
    if (!komponen) throw permintaanSalah("Komponen darah tidak ditemukan atau tidak aktif");
    const indikasi = teks(b.indikasi);
    if (!indikasi) throw permintaanSalah("indikasi wajib diisi");
    // Dokter peminta (KF-14): validasi UUID terhadap referensi faskes token & ambil nama snapshot dari server,
    // bukan dari body klien.
    const dokter = await satu(
      `SELECT pr.uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
         FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
        WHERE pr.uuid = $1 AND pr.faskes_uuid = $2 AND pr.deleted_at IS NULL AND pr.is_doctor AND COALESCE(pr.status, true)`,
      [b.dokter_peminta_uuid, faskes],
    );
    if (!dokter) throw permintaanSalah("Dokter peminta tidak ditemukan atau tidak aktif di faskes ini");

    const permintaan = await sisipkan("bdrs_permintaan", {
      faskes_uuid: faskes,
      no_permintaan: await nomorBaru(faskes, "BDRS"),
      patient_uuid: kunjungan.patient_uuid,
      no_rm: p.no_rm,
      no_reg: kunjungan.no_reg,
      rekam_medis_uuid: b.rekam_medis_uuid || kunjungan.rekam_medis_uuid || null,
      sumber_kunjungan: kunjungan.pelayanan,
      lokasi_asal_uuid: b.lokasi_asal_uuid || kunjungan.lokasi_uuid || null,
      komponen_uuid: b.komponen_uuid,
      golongan_diminta: cekPilihan(b.golongan_diminta, GOLONGAN_ABO, "golongan_diminta"),
      rhesus_diminta: cekPilihan(b.rhesus_diminta, RHESUS, "rhesus_diminta"),
      jumlah_diminta: jumlah,
      jumlah_dipenuhi: 0,
      indikasi,
      cito: Boolean(b.cito),
      status: "baru",
      dokter_peminta_uuid: dokter.uuid,
      dokter_peminta_nama: dokter.nama,
      dibuat_oleh: req.author.username ?? null,
    });
    kirim(res, await detailPermintaan(permintaan.uuid, faskes), `Permintaan darah ${permintaan.no_permintaan} berhasil diajukan`);
  }),
);

rute.patch(
  "/:uuid/status",
  tangani(async (req, res) => {
    const aksi = String(req.body?.aksi ?? "");
    if (!["proses", "kembalikan", "tolak", "batalkan"].includes(aksi)) throw permintaanSalah("aksi harus salah satu: proses, kembalikan, tolak, batalkan");
    const alasan = teks(req.body?.alasan);
    if (["kembalikan", "tolak", "batalkan"].includes(aksi) && !alasan) throw permintaanSalah("alasan wajib diisi");
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const pm = await kunciPermintaan(req.params.uuid, faskes, k);
      if (aksi === "batalkan") {
        if (!["baru", "diproses", "perlu_dilengkapi", "dipenuhi_sebagian"].includes(pm.status))
          throw new Galat(409, `Permintaan berstatus ${STATUS_PERMINTAAN[pm.status]}, tidak dapat dibatalkan`);
        const aktif = await satu(`SELECT COUNT(*)::int n FROM bdrs_serah_terima WHERE permintaan_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL`, [pm.uuid], k);
        if (aktif.n) throw new Galat(409, "Sudah ada transaksi serah terima untuk permintaan ini, batalkan transaksi tersebut terlebih dahulu");
        if (pm.dibuat_oleh !== req.author.username) await pastikanIzin(req, "Bank Darah RS (BDRS)", "Permintaan Darah", "BATAL");
        await ubah("bdrs_permintaan", pm.uuid, faskes, { status: "dibatalkan", alasan_batal: alasan }, k);
        return;
      }
      // Proses/kembalikan/tolak adalah tindakan petugas BDRS terhadap antrean permintaan.
      await pastikanIzin(req, "Bank Darah RS (BDRS)", "Permintaan Darah", "UPDATE");
      if (aksi === "proses") {
        if (pm.status !== "baru") throw new Galat(409, `Permintaan berstatus ${STATUS_PERMINTAAN[pm.status]}, tidak dapat diproses`);
        await ubah("bdrs_permintaan", pm.uuid, faskes, { status: "diproses", diproses_oleh: req.author.username ?? null, waktu_diproses: sekarang() }, k);
      } else if (aksi === "kembalikan") {
        if (!["baru", "diproses"].includes(pm.status)) throw new Galat(409, `Permintaan berstatus ${STATUS_PERMINTAAN[pm.status]}, tidak dapat dikembalikan`);
        await ubah("bdrs_permintaan", pm.uuid, faskes, { status: "perlu_dilengkapi", alasan_kembali: alasan }, k);
      } else if (aksi === "tolak") {
        if (!["baru", "diproses"].includes(pm.status)) throw new Galat(409, `Permintaan berstatus ${STATUS_PERMINTAAN[pm.status]}, tidak dapat ditolak`);
        await ubah("bdrs_permintaan", pm.uuid, faskes, { status: "ditolak", alasan_kembali: alasan }, k);
      }
    });
    kirim(res, await detailPermintaan(req.params.uuid, faskes), "Status permintaan darah berhasil diperbarui");
  }),
);

// Ruangan melengkapi permintaan yang dikembalikan BDRS (A2), lalu mengirim ulang untuk diproses.
rute.patch(
  "/:uuid/lengkapi",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const pm = await kunciPermintaan(req.params.uuid, faskes, k);
      if (pm.status !== "perlu_dilengkapi") throw new Galat(409, "Permintaan tidak sedang menunggu kelengkapan");
      if (pm.dibuat_oleh !== req.author.username) await pastikanIzin(req, "Bank Darah RS (BDRS)", "Permintaan Darah", "LENGKAPI");
      const perubahan = { status: "diproses", alasan_kembali: null };
      if (b.komponen_uuid !== undefined) {
        const komponen = await satu(`SELECT uuid FROM bdrs_komponen_darah WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [b.komponen_uuid, faskes], k);
        if (!komponen) throw permintaanSalah("Komponen darah tidak ditemukan atau tidak aktif");
        perubahan.komponen_uuid = b.komponen_uuid;
      }
      if (b.golongan_diminta !== undefined) perubahan.golongan_diminta = cekPilihan(b.golongan_diminta, GOLONGAN_ABO, "golongan_diminta");
      if (b.rhesus_diminta !== undefined) perubahan.rhesus_diminta = cekPilihan(b.rhesus_diminta, RHESUS, "rhesus_diminta");
      if (b.jumlah_diminta !== undefined) {
        const jumlah = Number(b.jumlah_diminta);
        if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 20) throw permintaanSalah("jumlah_diminta harus bilangan bulat 1–20");
        perubahan.jumlah_diminta = jumlah;
      }
      if (b.indikasi !== undefined) {
        const indikasi = teks(b.indikasi);
        if (!indikasi) throw permintaanSalah("indikasi wajib diisi");
        perubahan.indikasi = indikasi;
      }
      if (b.cito !== undefined) perubahan.cito = Boolean(b.cito);
      await ubah("bdrs_permintaan", pm.uuid, faskes, perubahan, k);
    });
    kirim(res, await detailPermintaan(req.params.uuid, faskes), "Permintaan berhasil dilengkapi & dikirim kembali ke BDRS");
  }),
);

export default rute;
