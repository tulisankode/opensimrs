import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi, uuidv7 } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { ALASAN_MUSNAH, GOLONGAN_DARAH, JENIS_KOMPONEN, PENERIMA_TIPE, cekPilihan, angkaOpsional, daftarNilai, hariIni, teks, waktuOpsional } from "./bersama.js";
import { izinUtd } from "../umum/izin.js";

// Penyimpanan & Distribusi: permintaan dari BDRS internal/RS lain, distribusi dengan validasi ulang status di dalam
// transaksi (KT-8), serta pemusnahan kantong/komponen reaktif/kedaluwarsa (menolak barang yang sudah terdistribusi).
const rute = express.Router();

// ── Permintaan ───────────────────────────────────────────────────────────────

rute.get(
  "/permintaan",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    const status = daftarNilai(req.query.status).filter((s) => ["menunggu", "sebagian", "terpenuhi", "ditolak"].includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND status = ANY($${p.length})`;
    }
    if (req.query.penerima_tipe) {
      p.push(cekPilihan(req.query.penerima_tipe, PENERIMA_TIPE, "penerima_tipe"));
      w += ` AND penerima_tipe = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM utd_permintaan WHERE ${w}`, p)).n;
    const rows = await query(`SELECT * FROM utd_permintaan WHERE ${w} ORDER BY created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/permintaan",
  izinUtd("Distribusi", "CREATE", "Permintaan"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["penerima_tipe", "nama_penerima", "golongan_darah", "jenis_komponen", "jumlah_diminta"]);
    const faskes = req.author.faskesUuid;
    const jumlah = angkaOpsional(b.jumlah_diminta, "jumlah_diminta");
    if (!jumlah || jumlah <= 0) throw permintaanSalah("jumlah_diminta harus lebih dari 0");
    const t = await sisipkan("utd_permintaan", {
      faskes_uuid: faskes, penerima_tipe: cekPilihan(b.penerima_tipe, PENERIMA_TIPE, "penerima_tipe"),
      nama_penerima: String(b.nama_penerima).trim(), golongan_darah: cekPilihan(b.golongan_darah, GOLONGAN_DARAH, "golongan_darah"),
      jenis_komponen: cekPilihan(b.jenis_komponen, JENIS_KOMPONEN, "jenis_komponen"), jumlah_diminta: jumlah,
      keterangan_klinis: teks(b.keterangan_klinis), status: "menunggu", dibuat_oleh: req.author.username ?? null,
    });
    kirim(res, t, "Permintaan komponen tersimpan");
  }),
);

const detailPermintaan = async (uuid, faskes) => {
  const p = await satu(`SELECT * FROM utd_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskes]);
  if (!p) throw tidakDitemukan("Permintaan");
  const distribusi = await query(
    `SELECT d.*, k.label_unik, k.jenis_komponen, k.golongan_darah FROM utd_distribusi d JOIN utd_komponen k ON k.uuid = d.komponen_uuid
      WHERE d.permintaan_uuid = $1 AND d.deleted_at IS NULL ORDER BY d.created_at`,
    [p.uuid],
  );
  return { ...p, distribusi };
};

rute.get(
  "/permintaan/:uuid",
  tangani(async (req, res) => kirim(res, await detailPermintaan(req.params.uuid, req.author.faskesUuid))),
);

// ── Distribusi ───────────────────────────────────────────────────────────────

// Titik ekstensi integrasi `bank_darah`/`bdrs_stok` (KF-29/KF-30). Modul tersebut belum diimplementasikan di repo;
// distribusi ke BDRS internal selalu tercatat "menunggu_integrasi" (bukan simulasi penerimaan berhasil) sampai
// integrasi nyata tersedia. ref dipakai sebagai kunci idempoten saat integrasi diimplementasikan.
const statusIntegrasiAwal = (penerimaTipe) => (penerimaTipe === "bdrs_internal" ? "menunggu_integrasi" : "terkirim");

rute.get(
  "/distribusi",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "d.faskes_uuid = $1 AND d.deleted_at IS NULL";
    const status = daftarNilai(req.query.status).filter((s) => ["terkirim", "menunggu_integrasi", "gagal_integrasi"].includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND d.status = ANY($${p.length})`;
    }
    const dari = `FROM utd_distribusi d JOIN utd_komponen k ON k.uuid = d.komponen_uuid`;
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT d.*, k.label_unik, k.jenis_komponen, k.golongan_darah ${dari} WHERE ${w} ORDER BY d.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Distribusi komponen atas satu permintaan. Body: { permintaan_uuid, komponen_uuid: [...], waktu_serah_terima?, petugas_uuid? }.
// Status komponen divalidasi ulang di dalam transaksi (SELECT ... FOR UPDATE) agar dua petugas tidak memilih komponen yang sama (KT-8).
rute.post(
  "/distribusi",
  izinUtd("Distribusi", "CREATE", "Distribusi"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["permintaan_uuid"]);
    const komponenUuid = [...new Set(Array.isArray(b.komponen_uuid) ? b.komponen_uuid : [])];
    if (!komponenUuid.length) throw permintaanSalah("komponen_uuid wajib diisi (minimal satu)");
    const faskes = req.author.faskesUuid;
    const waktu = waktuOpsional(b.waktu_serah_terima, "waktu_serah_terima") ?? sekarang();

    const hasil = await transaksi(async (k) => {
      const permintaan = await satu(
        `SELECT * FROM utd_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`,
        [b.permintaan_uuid, faskes], k,
      );
      if (!permintaan) throw tidakDitemukan("Permintaan");
      if (!["menunggu", "sebagian"].includes(permintaan.status)) throw new Galat(409, `Permintaan berstatus ${permintaan.status}, tidak dapat didistribusikan`);
      const sudahDikirim = await satu(
        `SELECT COUNT(*)::int n FROM utd_distribusi WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [permintaan.uuid], k,
      );
      if (sudahDikirim.n + komponenUuid.length > permintaan.jumlah_diminta)
        throw permintaanSalah(`Melebihi jumlah diminta (sisa ${permintaan.jumlah_diminta - sudahDikirim.n})`);

      const dibuat = [];
      for (const kompUuid of komponenUuid) {
        const komp = await satu(
          `SELECT * FROM utd_komponen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [kompUuid, faskes], k,
        );
        if (!komp) throw tidakDitemukan(`Komponen ${kompUuid}`);
        if (komp.status !== "tersedia") throw new Galat(409, `Komponen ${komp.label_unik} berstatus ${komp.status}, status telah berubah`);
        if (komp.tanggal_kedaluwarsa < hariIni()) throw new Galat(409, `Komponen ${komp.label_unik} sudah kedaluwarsa`);
        if (komp.golongan_darah !== permintaan.golongan_darah) throw permintaanSalah(`Komponen ${komp.label_unik} bukan golongan darah ${permintaan.golongan_darah}`);
        if (komp.jenis_komponen !== permintaan.jenis_komponen) throw permintaanSalah(`Komponen ${komp.label_unik} bukan jenis ${permintaan.jenis_komponen}`);

        const distribusiUuid = uuidv7();
        const status = statusIntegrasiAwal(permintaan.penerima_tipe);
        const ref = permintaan.penerima_tipe === "bdrs_internal" ? `UTD-DIST-${distribusiUuid}` : null;
        await ubah("utd_komponen", komp.uuid, faskes, { status: "didistribusikan" }, k);
        const d = await sisipkan(
          "utd_distribusi",
          {
            uuid: distribusiUuid, faskes_uuid: faskes, permintaan_uuid: permintaan.uuid, komponen_uuid: komp.uuid,
            penerima_tipe: permintaan.penerima_tipe, nama_penerima: permintaan.nama_penerima, waktu_serah_terima: waktu,
            petugas_uuid: teks(b.petugas_uuid), status, ref_penerimaan_bdrs: ref,
            catatan_integrasi: status === "menunggu_integrasi" ? "Modul Bank Darah (bdrs_stok) belum tersedia/aktif" : null,
            dibuat_oleh: req.author.username ?? null,
          },
          k,
        );
        dibuat.push({ ...d, label_unik: komp.label_unik });
      }
      const totalTerkirim = sudahDikirim.n + dibuat.length;
      await ubah("utd_permintaan", permintaan.uuid, faskes, { status: totalTerkirim >= permintaan.jumlah_diminta ? "terpenuhi" : "sebagian" }, k);
      return dibuat;
    });
    kirim(res, hasil, `${hasil.length} komponen berhasil didistribusikan`);
  }),
);

// Rekonsiliasi/retry pengiriman penerimaan ke bank_darah (idempoten terhadap ref_penerimaan_bdrs). Karena modul
// bank_darah belum diimplementasikan, status tidak pernah diklaim "terkirim" secara palsu (KF-30, G7).
rute.post(
  "/distribusi/:uuid/kirim-penerimaan-bdrs",
  izinUtd("Distribusi", "CREATE", "Distribusi"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const d = await satu(`SELECT * FROM utd_distribusi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!d) throw tidakDitemukan("Distribusi");
    if (d.status === "terkirim") return kirim(res, d, "Sudah terkirim sebelumnya (tidak ada penerimaan ganda)");
    if (d.penerima_tipe !== "bdrs_internal") throw permintaanSalah("Distribusi eksternal tidak memerlukan integrasi BDRS");
    const t = await ubah("utd_distribusi", d.uuid, faskes, {
      catatan_integrasi: `Menunggu integrasi bank_darah (dicoba ulang pada ${new Date(sekarang() * 1000).toISOString()})`,
    });
    kirim(res, t, "Modul Bank Darah belum tersedia/aktif; distribusi tetap menunggu integrasi");
  }),
);

// ── Pemusnahan ───────────────────────────────────────────────────────────────

rute.get(
  "/pemusnahan",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    const total = (await satu(`SELECT COUNT(*) n FROM utd_pemusnahan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, p)).n;
    const rows = await query(
      `SELECT * FROM utd_pemusnahan WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Daftar tindak lanjut pemusnahan: kantong reaktif & komponen kedaluwarsa yang belum dimusnahkan (KF-17).
rute.get(
  "/pemusnahan/tindak-lanjut",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const kantongReaktif = await query(
      `SELECT a.uuid AS kantong_uuid, a.no_kantong, d.no_donor FROM utd_aftap a JOIN utd_donor d ON d.uuid = a.donor_uuid
        WHERE a.faskes_uuid = $1 AND a.status_kantong = 'karantina_reaktif' AND a.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM utd_pemusnahan p WHERE p.kantong_uuid = a.uuid AND p.deleted_at IS NULL)
        ORDER BY a.created_at`,
      [faskes],
    );
    const komponenKedaluwarsa = await query(
      `SELECT uuid AS komponen_uuid, label_unik, jenis_komponen, tanggal_kedaluwarsa FROM utd_komponen
        WHERE faskes_uuid = $1 AND status = 'kedaluwarsa' AND deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM utd_pemusnahan p WHERE p.komponen_uuid = utd_komponen.uuid AND p.deleted_at IS NULL)
        ORDER BY tanggal_kedaluwarsa`,
      [faskes],
    );
    kirim(res, { kantong_reaktif: kantongReaktif, komponen_kedaluwarsa: komponenKedaluwarsa });
  }),
);

// Body: { kantong_uuid? | komponen_uuid?, alasan, catatan? }. Menolak barang yang sudah terdistribusi (KF-31, KT-12).
rute.post(
  "/pemusnahan",
  izinUtd("Distribusi", "CREATE", "Pemusnahan"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    if (!b.kantong_uuid && !b.komponen_uuid) throw permintaanSalah("kantong_uuid atau komponen_uuid wajib diisi");
    const alasan = cekPilihan(b.alasan, ALASAN_MUSNAH, "alasan");
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const faskes = req.author.faskesUuid;
    const waktu = sekarang();

    const t = await transaksi(async (k) => {
      if (b.komponen_uuid) {
        const komp = await satu(`SELECT * FROM utd_komponen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [b.komponen_uuid, faskes], k);
        if (!komp) throw tidakDitemukan("Komponen");
        if (komp.status === "didistribusikan") throw new Galat(409, `Komponen ${komp.label_unik} sudah didistribusikan, tidak dapat dimusnahkan`);
        await ubah("utd_komponen", komp.uuid, faskes, { status: "dimusnahkan" }, k);
      }
      if (b.kantong_uuid) {
        const aftap = await satu(`SELECT * FROM utd_aftap WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [b.kantong_uuid, faskes], k);
        if (!aftap) throw tidakDitemukan("Kantong");
        const terdistribusi = await satu(
          `SELECT COUNT(*)::int n FROM utd_komponen WHERE aftap_uuid = $1 AND status = 'didistribusikan' AND deleted_at IS NULL`, [aftap.uuid], k,
        );
        if (terdistribusi.n) throw new Galat(409, `Kantong ${aftap.no_kantong} memiliki komponen yang sudah didistribusikan, tidak dapat dimusnahkan`);
        await ubah("utd_aftap", aftap.uuid, faskes, { status_kantong: "dimusnahkan" }, k);
        await query(
          `UPDATE utd_komponen SET status = 'dimusnahkan', updated_at = $2 WHERE aftap_uuid = $1 AND status NOT IN ('didistribusikan', 'dimusnahkan') AND deleted_at IS NULL`,
          [aftap.uuid, waktu], k,
        );
      }
      return sisipkan(
        "utd_pemusnahan",
        {
          faskes_uuid: faskes, kantong_uuid: teks(b.kantong_uuid), komponen_uuid: teks(b.komponen_uuid), alasan,
          catatan: teks(b.catatan), petugas_uuid: teks(b.petugas_uuid) ?? req.author.username ?? null, waktu_musnah: waktu,
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
    });
    kirim(res, t, "Pemusnahan tercatat");
  }),
);

export default rute;
