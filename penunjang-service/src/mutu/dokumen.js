import express from "express";
import config from "../config.js";
import { query, satu, ubah, sekarang, transaksi, uuidv7 } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinMutu } from "../umum/izin.js";
import {
  JENIS_DOKUMEN,
  STATUS_DOKUMEN,
  TIPE_BERKAS_DOKUMEN,
  awalHariWib,
  boolOpsional,
  cekPilihan,
  daftarUuid,
  epochOpsional,
  epochWajib,
  infoBerkas,
  konflik,
  sekarangDetik,
  teks,
  teksWajib,
  transisiDokumenSah,
  validasiBerkasMutu,
  versiBerikutnya,
  wajibPilihan,
} from "./bersama.js";
import { ambilMilik, catatAudit, sisipkanBerkas, tanganiMutu, tanpaBerkas } from "./dasar.js";

// Dokumen akreditasi (KF-3..7, KF-11, KF-13/14): metadata, berkas PDF (BYTEA), riwayat versi, pemetaan ke elemen
// penilaian, tinjau ulang, dan pembagian ke surveior.
//   GET  /dokumen?jenis=&status=&perlu_tinjau=1&cari=&elemen_uuid=&semua_versi=1   daftar (bawaan: versi terbaru saja)
//   GET  /dokumen/:uuid                                 detail + elemen + riwayat versi + jejak audit
//   POST /dokumen                                       dokumen baru (status draf) + berkas + elemen_uuid[]
//   PUT  /dokumen/:uuid                                 ubah metadata/berkas — hanya selama draf
//   POST /dokumen/:uuid/revisi                          versi baru (draf) dari versi terbaru; versi lama utuh
//   PATCH /dokumen/:uuid/status                         draf→disahkan|dicabut, disahkan→kedaluwarsa|dicabut, …
//   PATCH /dokumen/:uuid/tinjau                         catat tinjauan + tanggal tinjau ulang berikutnya
//   PUT  /dokumen/:uuid/elemen                          ganti pemetaan elemen (riwayat disimpan lunak)
//   PATCH /dokumen/:uuid/bagikan-surveior               bagikan/hentikan akses baca surveior
//   GET  /dokumen/:uuid/berkas                          unduh berkas (base64)
//   DELETE /dokumen/:uuid                               hapus lunak — hanya draf versi terbaru
// Setiap perubahan dijalankan dalam transaksi bersama jejak auditnya; baris dikunci FOR UPDATE.
const rute = express.Router();

const KOLOM = `d.uuid, d.faskes_uuid, d.jenis, d.unit_pemilik, d.nomor, d.judul, d.versi, d.tanggal_terbit, d.tanggal_tinjau_ulang,
  d.status, d.versi_sebelumnya_uuid, d.akar_uuid, d.urutan_versi, d.catatan_status, d.catatan_tinjauan, d.ditinjau_oleh, d.ditinjau_pada,
  d.disahkan_oleh, d.disahkan_pada, d.berkas_info, d.dibagikan_surveior, d.dibagikan_sampai, d.dibuat_oleh, d.created_at, d.updated_at`;
const TERBARU = `NOT EXISTS (SELECT 1 FROM mutu_dokumen n WHERE n.versi_sebelumnya_uuid = d.uuid AND n.deleted_at IS NULL)`;
const tanggal = (v, nama) => {
  const n = epochOpsional(v, nama);
  return n === undefined || n === null ? n : awalHariWib(n);
};
// Kolom BIGINT dibaca pg sebagai string → bandingkan sebagai angka.
const cekUrutanTanggal = (terbit, tinjau) => {
  if (terbit && tinjau && Number(tinjau) < Number(terbit)) throw permintaanSalah("tanggal_tinjau_ulang tidak boleh sebelum tanggal_terbit");
};
const berkasDokumen = (b) => validasiBerkasMutu(b, config.maxUploadMutuMb, TIPE_BERKAS_DOKUMEN);

const ambilDokumen = (uuid, f, k, kunci = false) => ambilMilik("mutu_dokumen", uuid, f, k, { nama: "Dokumen", kunci, kolom: KOLOM.replace(/\bd\./g, "") });
const pastikanTerbaru = async (k, dok, aksi) => {
  const anak = await satu(`SELECT versi FROM mutu_dokumen WHERE versi_sebelumnya_uuid = $1 AND deleted_at IS NULL`, [dok.uuid], k);
  if (anak) throw konflik(`Dokumen versi ${dok.versi} sudah direvisi menjadi versi ${anak.versi}; ${aksi} hanya untuk versi terbaru`);
};

// Elemen penilaian milik faskes pada instrumen/bab/standar yang belum dihapus.
const cekElemen = async (k, uuids, f) => {
  if (!uuids?.length) return [];
  const ada = await query(
    `SELECT e.uuid FROM mutu_elemen_penilaian e JOIN mutu_standar s ON s.uuid = e.standar_uuid AND s.deleted_at IS NULL
       JOIN mutu_bab b ON b.uuid = s.bab_uuid AND b.deleted_at IS NULL JOIN mutu_instrumen i ON i.uuid = b.instrumen_uuid AND i.deleted_at IS NULL
      WHERE e.uuid = ANY($1::varchar[]) AND e.faskes_uuid = $2 AND e.deleted_at IS NULL`,
    [uuids, f],
    k,
  );
  if (ada.length !== uuids.length) throw permintaanSalah("Sebagian elemen penilaian tidak ditemukan pada instrumen faskes ini");
  return uuids;
};
const elemenAktif = (k, dokumenUuid) =>
  query(`SELECT elemen_uuid FROM mutu_dokumen_elemen WHERE dokumen_uuid = $1 AND deleted_at IS NULL ORDER BY created_at`, [dokumenUuid], k).then((r) =>
    r.map((x) => x.elemen_uuid),
  );
// Ganti pemetaan: elemen yang dilepas dihapus lunak (riwayat tetap ada), elemen baru disisipkan.
const gantiPemetaan = async (k, req, dokumenUuid, baru) => {
  const lama = await elemenAktif(k, dokumenUuid);
  const lepas = lama.filter((x) => !baru.includes(x));
  const tambah = baru.filter((x) => !lama.includes(x));
  const n = sekarang();
  if (lepas.length) {
    await k.query(
      `UPDATE mutu_dokumen_elemen SET deleted_at = $1, updated_at = $1, dihapus_oleh = $2 WHERE dokumen_uuid = $3 AND elemen_uuid = ANY($4::varchar[]) AND deleted_at IS NULL`,
      [n, req.author.username ?? null, dokumenUuid, lepas],
    );
  }
  for (const e of tambah) {
    await sisipkanBerkas("mutu_dokumen_elemen", { faskes_uuid: req.author.faskesUuid, dokumen_uuid: dokumenUuid, elemen_uuid: e, dibuat_oleh: req.author.username ?? null }, k);
  }
  return { lama, baru, berubah: lepas.length > 0 || tambah.length > 0 };
};

// ── Daftar
rute.get(
  "/",
  izinMutu("Dokumen Akreditasi", "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const pg = halaman(q);
    const hariIni = awalHariWib(sekarangDetik());
    const syarat = ["d.faskes_uuid = $1", "d.deleted_at IS NULL"];
    const p = [f];
    const jenis = cekPilihan(q.jenis || undefined, JENIS_DOKUMEN, "jenis");
    const status = cekPilihan(q.status || undefined, STATUS_DOKUMEN, "status");
    const cari = teks(q.cari, "cari", 100);
    if (jenis) syarat.push(`d.jenis = $${p.push(jenis)}`);
    if (status) syarat.push(`d.status = $${p.push(status)}`);
    if (cari) syarat.push(`(d.nomor ILIKE $${p.push(`%${cari}%`)} OR d.judul ILIKE $${p.length} OR d.unit_pemilik ILIKE $${p.length})`);
    if (boolOpsional(q.perlu_tinjau)) syarat.push(`d.status = 'disahkan' AND d.tanggal_tinjau_ulang IS NOT NULL AND d.tanggal_tinjau_ulang <= $${p.push(hariIni)}`);
    if (q.elemen_uuid) syarat.push(`EXISTS (SELECT 1 FROM mutu_dokumen_elemen x WHERE x.dokumen_uuid = d.uuid AND x.elemen_uuid = $${p.push(String(q.elemen_uuid))} AND x.deleted_at IS NULL)`);
    if (!boolOpsional(q.semua_versi)) syarat.push(TERBARU);
    const where = syarat.join(" AND ");
    const total = (await satu(`SELECT COUNT(*) n FROM mutu_dokumen d WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM},
         (d.status = 'disahkan' AND d.tanggal_tinjau_ulang IS NOT NULL AND d.tanggal_tinjau_ulang <= $${p.length + 1}) AS perlu_tinjau,
         ${TERBARU} AS terbaru,
         (SELECT COUNT(*) FROM mutu_dokumen_elemen e WHERE e.dokumen_uuid = d.uuid AND e.deleted_at IS NULL)::int AS jumlah_elemen,
         (SELECT COUNT(*) FROM mutu_dokumen v WHERE v.akar_uuid = d.akar_uuid AND v.deleted_at IS NULL)::int AS jumlah_versi
       FROM mutu_dokumen d WHERE ${where}
       ORDER BY d.updated_at DESC, d.nomor LIMIT $${p.length + 2} OFFSET $${p.length + 3}`,
      [...p, hariIni, pg.limit, pg.offset],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// ── Detail
rute.get(
  "/:uuid",
  izinMutu("Dokumen Akreditasi", "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const hariIni = awalHariWib(sekarangDetik());
    const dok = await ambilDokumen(req.params.uuid, f);
    const elemen = await query(
      `SELECT e.uuid, e.kode, e.uraian, s.kode AS standar_kode, s.nama AS standar_nama, b.kode AS bab_kode, b.nama AS bab_nama,
              i.uuid AS instrumen_uuid, i.nama AS instrumen_nama, de.created_at AS dipetakan_pada, de.dibuat_oleh AS dipetakan_oleh
         FROM mutu_dokumen_elemen de JOIN mutu_elemen_penilaian e ON e.uuid = de.elemen_uuid
         JOIN mutu_standar s ON s.uuid = e.standar_uuid JOIN mutu_bab b ON b.uuid = s.bab_uuid JOIN mutu_instrumen i ON i.uuid = b.instrumen_uuid
        WHERE de.dokumen_uuid = $1 AND de.deleted_at IS NULL ORDER BY i.nama, b.urutan, b.kode, s.urutan, s.kode, e.urutan, e.kode`,
      [dok.uuid],
    );
    const riwayat = await query(
      `SELECT uuid, versi, urutan_versi, status, judul, tanggal_terbit, tanggal_tinjau_ulang, versi_sebelumnya_uuid, berkas_info, dibuat_oleh, created_at,
              (SELECT COUNT(*) FROM mutu_dokumen_elemen e WHERE e.dokumen_uuid = v.uuid AND e.deleted_at IS NULL)::int AS jumlah_elemen
         FROM mutu_dokumen v WHERE v.akar_uuid = $1 AND v.faskes_uuid = $2 AND v.deleted_at IS NULL ORDER BY v.urutan_versi DESC`,
      [dok.akar_uuid, f],
    );
    const audit = await query(
      `SELECT uuid, aksi, data_sebelum, data_sesudah, aktor, created_at FROM mutu_audit
        WHERE faskes_uuid = $1 AND entitas = 'dokumen' AND entitas_uuid = $2 ORDER BY created_at DESC, uuid DESC LIMIT 100`,
      [f, dok.uuid],
    );
    kirim(res, {
      ...dok,
      perlu_tinjau: dok.status === "disahkan" && dok.tanggal_tinjau_ulang !== null && Number(dok.tanggal_tinjau_ulang) <= hariIni,
      terbaru: riwayat[0]?.uuid === dok.uuid,
      elemen,
      riwayat_versi: riwayat,
      audit,
    });
  }),
);

// ── Buat (KT-4/KT-15): metadata + berkas + pemetaan tersimpan dalam satu transaksi, atau tidak sama sekali.
rute.post(
  "/",
  izinMutu("Dokumen Akreditasi", "CREATE"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const terbit = awalHariWib(epochWajib(b.tanggal_terbit, "tanggal_terbit"));
    const tinjau = tanggal(b.tanggal_tinjau_ulang, "tanggal_tinjau_ulang") ?? null;
    cekUrutanTanggal(terbit, tinjau);
    const data = {
      faskes_uuid: f,
      jenis: wajibPilihan(b.jenis, JENIS_DOKUMEN, "jenis"),
      nomor: teksWajib(b.nomor, "nomor", 100),
      judul: teksWajib(b.judul, "judul", 255),
      unit_pemilik: teks(b.unit_pemilik, "unit_pemilik", 255) ?? null,
      versi: teks(b.versi, "versi", 20) ?? "1",
      tanggal_terbit: terbit,
      tanggal_tinjau_ulang: tinjau,
      status: "draf",
      dibuat_oleh: req.author.username ?? null,
    };
    const elemenUuid = daftarUuid(b.elemen_uuid, "elemen_uuid") ?? [];
    const berkas = berkasDokumen(b.berkas);
    const hasil = await transaksi(async (k) => {
      await cekElemen(k, elemenUuid, f);
      const uuid = uuidv7();
      const row = await sisipkanBerkas("mutu_dokumen", { uuid, ...data, akar_uuid: uuid, urutan_versi: 1, berkas: berkas.data, berkas_info: infoBerkas(berkas) }, k);
      await gantiPemetaan(k, req, row.uuid, elemenUuid);
      await catatAudit(k, req, "dokumen", row.uuid, "buat", null, { ...row, elemen_uuid: elemenUuid });
      return tanpaBerkas(row);
    });
    kirim(res, hasil, "Dokumen berhasil disimpan sebagai draf");
  }, "Nomor dan versi dokumen sudah dipakai"),
);

// ── Ubah metadata / ganti berkas (hanya draf; dokumen yang sudah disahkan diubah lewat revisi agar versi tidak tertimpa)
rute.put(
  "/:uuid",
  izinMutu("Dokumen Akreditasi", "UPDATE"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const perubahan = {
      jenis: b.jenis === undefined ? undefined : wajibPilihan(b.jenis, JENIS_DOKUMEN, "jenis"),
      judul: b.judul === undefined ? undefined : teksWajib(b.judul, "judul", 255),
      unit_pemilik: teks(b.unit_pemilik, "unit_pemilik", 255),
      versi: b.versi === undefined ? undefined : teksWajib(b.versi, "versi", 20),
      tanggal_terbit: b.tanggal_terbit === undefined ? undefined : awalHariWib(epochWajib(b.tanggal_terbit, "tanggal_terbit")),
      tanggal_tinjau_ulang: tanggal(b.tanggal_tinjau_ulang, "tanggal_tinjau_ulang"),
    };
    const berkas = b.berkas === undefined || b.berkas === null ? null : berkasDokumen(b.berkas);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilDokumen(req.params.uuid, f, k, true);
      if (lama.status !== "draf") throw konflik("Hanya dokumen berstatus draf yang dapat diubah; buat revisi untuk dokumen yang sudah disahkan");
      cekUrutanTanggal(perubahan.tanggal_terbit ?? lama.tanggal_terbit, perubahan.tanggal_tinjau_ulang === undefined ? lama.tanggal_tinjau_ulang : perubahan.tanggal_tinjau_ulang);
      let baru = await ubah("mutu_dokumen", lama.uuid, f, perubahan, k);
      if (berkas) {
        baru = await satu(`UPDATE mutu_dokumen SET berkas = $1, berkas_info = $2::jsonb, updated_at = $3 WHERE uuid = $4 RETURNING *`, [berkas.data, JSON.stringify(infoBerkas(berkas)), sekarang(), lama.uuid], k);
      }
      await catatAudit(k, req, "dokumen", lama.uuid, berkas ? "ubah_berkas" : "ubah", lama, baru);
      return tanpaBerkas(baru);
    });
    kirim(res, hasil, "Dokumen berhasil diperbarui");
  }, "Nomor dan versi dokumen sudah dipakai"),
);

// ── Revisi (KF-6/KT-6): versi baru menunjuk versi sebelumnya, berkas baru, pemetaan disalin (atau dari elemen_uuid).
rute.post(
  "/:uuid/revisi",
  izinMutu("Dokumen Akreditasi", "REVISI"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const berkas = berkasDokumen(b.berkas);
    const terbit = awalHariWib(epochWajib(b.tanggal_terbit, "tanggal_terbit"));
    const elemenBaru = daftarUuid(b.elemen_uuid, "elemen_uuid");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilDokumen(req.params.uuid, f, k, true);
      await pastikanTerbaru(k, lama, "revisi");
      const versi = teks(b.versi, "versi", 20) ?? versiBerikutnya(lama.versi);
      if (!versi) throw permintaanSalah("versi wajib diisi (versi sebelumnya bukan angka)");
      if (versi === lama.versi) throw permintaanSalah("versi baru harus berbeda dari versi sebelumnya");
      const tinjau = b.tanggal_tinjau_ulang === undefined ? null : tanggal(b.tanggal_tinjau_ulang, "tanggal_tinjau_ulang") ?? null;
      cekUrutanTanggal(terbit, tinjau);
      const elemen = elemenBaru ?? (await elemenAktif(k, lama.uuid));
      await cekElemen(k, elemen, f);
      const row = await sisipkanBerkas(
        "mutu_dokumen",
        {
          faskes_uuid: f,
          jenis: b.jenis === undefined ? lama.jenis : wajibPilihan(b.jenis, JENIS_DOKUMEN, "jenis"),
          nomor: lama.nomor,
          judul: b.judul === undefined ? lama.judul : teksWajib(b.judul, "judul", 255),
          unit_pemilik: b.unit_pemilik === undefined ? lama.unit_pemilik : teks(b.unit_pemilik, "unit_pemilik", 255) ?? null,
          versi,
          tanggal_terbit: terbit,
          tanggal_tinjau_ulang: tinjau,
          status: "draf",
          versi_sebelumnya_uuid: lama.uuid,
          akar_uuid: lama.akar_uuid,
          urutan_versi: Number(lama.urutan_versi) + 1,
          berkas: berkas.data,
          berkas_info: infoBerkas(berkas),
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      await gantiPemetaan(k, req, row.uuid, elemen);
      await catatAudit(k, req, "dokumen", row.uuid, "revisi", { uuid: lama.uuid, versi: lama.versi }, { ...row, elemen_uuid: elemen });
      await catatAudit(k, req, "dokumen", lama.uuid, "direvisi", null, { uuid: row.uuid, versi });
      return tanpaBerkas(row);
    });
    kirim(res, hasil, `Revisi versi ${hasil.versi} berhasil dibuat (draf)`);
  }, "Nomor dan versi dokumen sudah dipakai atau versi ini sudah direvisi"),
);

// ── Ubah status (manual; perlu tinjau tidak mengubah status otomatis — KT-5)
rute.patch(
  "/:uuid/status",
  izinMutu("Dokumen Akreditasi", "UBAH STATUS"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const status = wajibPilihan(req.body?.status, STATUS_DOKUMEN, "status");
    const catatan = teks(req.body?.catatan, "catatan", 2000) ?? null;
    if (status === "dicabut" && !catatan) throw permintaanSalah("catatan (alasan pencabutan) wajib diisi");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilDokumen(req.params.uuid, f, k, true);
      if (!transisiDokumenSah(lama.status, status)) throw konflik(`Status ${STATUS_DOKUMEN[lama.status]} tidak dapat diubah menjadi ${STATUS_DOKUMEN[status]}`);
      const n = sekarang();
      const baru = await ubah(
        "mutu_dokumen",
        lama.uuid,
        f,
        {
          status,
          catatan_status: catatan,
          ...(status === "disahkan" ? { disahkan_oleh: req.author.username ?? null, disahkan_pada: n } : {}),
          ...(status !== "disahkan" ? { dibagikan_surveior: false } : {}),
        },
        k,
      );
      await catatAudit(k, req, "dokumen", lama.uuid, "ubah_status", { status: lama.status }, { status, catatan });
      return tanpaBerkas(baru);
    });
    kirim(res, hasil, `Status dokumen menjadi ${STATUS_DOKUMEN[status]}`);
  }),
);

// ── Catat tinjauan (A4): tanggal tinjau ulang berikutnya + catatan; tidak membuat versi baru.
rute.patch(
  "/:uuid/tinjau",
  izinMutu("Dokumen Akreditasi", "TINJAU"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const tinjauBaru = awalHariWib(epochWajib(b.tanggal_tinjau_ulang, "tanggal_tinjau_ulang"));
    const catatan = teksWajib(b.catatan_tinjauan, "catatan_tinjauan", 5000);
    if (tinjauBaru <= awalHariWib(sekarangDetik())) throw permintaanSalah("tanggal_tinjau_ulang berikutnya harus setelah hari ini");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilDokumen(req.params.uuid, f, k, true);
      if (lama.status !== "disahkan") throw konflik("Tinjauan hanya dicatat untuk dokumen berstatus disahkan");
      const baru = await ubah(
        "mutu_dokumen",
        lama.uuid,
        f,
        { tanggal_tinjau_ulang: tinjauBaru, catatan_tinjauan: catatan, ditinjau_oleh: req.author.username ?? null, ditinjau_pada: sekarang() },
        k,
      );
      await catatAudit(k, req, "dokumen", lama.uuid, "tinjau", { tanggal_tinjau_ulang: lama.tanggal_tinjau_ulang, catatan_tinjauan: lama.catatan_tinjauan }, { tanggal_tinjau_ulang: tinjauBaru, catatan_tinjauan: catatan });
      return tanpaBerkas(baru);
    });
    kirim(res, hasil, "Tinjauan dokumen berhasil dicatat");
  }),
);

// ── Pemetaan elemen (KF-5): hanya versi terbaru yang belum dicabut; versi lama mempertahankan pemetaannya.
rute.put(
  "/:uuid/elemen",
  izinMutu("Dokumen Akreditasi", "PETAKAN ELEMEN"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const elemen = daftarUuid(req.body?.elemen_uuid, "elemen_uuid");
    if (elemen === undefined) throw permintaanSalah("elemen_uuid wajib diisi (boleh daftar kosong)");
    const hasil = await transaksi(async (k) => {
      const dok = await ambilDokumen(req.params.uuid, f, k, true);
      if (dok.status === "dicabut") throw konflik("Dokumen yang dicabut tidak dapat dipetakan");
      await pastikanTerbaru(k, dok, "pemetaan");
      await cekElemen(k, elemen, f);
      const r = await gantiPemetaan(k, req, dok.uuid, elemen);
      if (r.berubah) {
        await k.query(`UPDATE mutu_dokumen SET updated_at = $1 WHERE uuid = $2`, [sekarang(), dok.uuid]);
        await catatAudit(k, req, "dokumen", dok.uuid, "petakan_elemen", { elemen_uuid: r.lama }, { elemen_uuid: r.baru });
      }
      return { uuid: dok.uuid, elemen_uuid: r.baru };
    });
    kirim(res, hasil, "Pemetaan elemen penilaian berhasil disimpan");
  }),
);

// ── Bagikan ke surveior (KF-11): hanya dokumen disahkan; opsional batas waktu (epoch detik, harus di masa depan).
rute.patch(
  "/:uuid/bagikan-surveior",
  izinMutu("Dokumen Akreditasi", "BAGIKAN SURVEIOR"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const dibagikan = boolOpsional(req.body?.dibagikan);
    if (dibagikan === undefined) throw permintaanSalah("dibagikan wajib diisi (true/false)");
    const sampai = dibagikan ? epochOpsional(req.body?.sampai, "sampai") ?? null : null;
    if (sampai && sampai <= sekarangDetik()) throw permintaanSalah("Batas waktu berbagi harus di masa depan");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilDokumen(req.params.uuid, f, k, true);
      if (dibagikan && lama.status !== "disahkan") throw konflik("Hanya dokumen berstatus disahkan yang dapat dibagikan ke surveior");
      const baru = await ubah("mutu_dokumen", lama.uuid, f, { dibagikan_surveior: dibagikan, dibagikan_sampai: sampai }, k);
      await catatAudit(k, req, "dokumen", lama.uuid, "bagikan_surveior", { dibagikan_surveior: lama.dibagikan_surveior, dibagikan_sampai: lama.dibagikan_sampai }, { dibagikan_surveior: dibagikan, dibagikan_sampai: sampai });
      return tanpaBerkas(baru);
    });
    kirim(res, hasil, dibagikan ? "Dokumen dibagikan ke surveior" : "Akses surveior untuk dokumen dihentikan");
  }),
);

// ── Unduh berkas (izin Dokumen › READ, diperiksa server — KF-12)
rute.get(
  "/:uuid/berkas",
  izinMutu("Dokumen Akreditasi", "READ"),
  tanganiMutu(async (req, res) => {
    const row = await satu(`SELECT berkas, berkas_info FROM mutu_dokumen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(req.params.uuid), req.author.faskesUuid]);
    if (!row?.berkas) throw tidakDitemukan("Berkas dokumen");
    kirim(res, { ...row.berkas_info, data_base64: row.berkas.toString("base64") });
  }),
);

// ── Hapus lunak: hanya draf versi terbaru (bukti yang pernah disahkan tidak boleh hilang — gunakan status dicabut).
rute.delete(
  "/:uuid",
  izinMutu("Dokumen Akreditasi", "DELETE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilDokumen(req.params.uuid, f, k, true);
      if (lama.status !== "draf") throw konflik("Hanya dokumen berstatus draf yang dapat dihapus; gunakan status dicabut untuk dokumen lain");
      await pastikanTerbaru(k, lama, "penghapusan");
      const n = sekarang();
      await k.query(`UPDATE mutu_dokumen_elemen SET deleted_at = $1, updated_at = $1, dihapus_oleh = $2 WHERE dokumen_uuid = $3 AND deleted_at IS NULL`, [n, req.author.username ?? null, lama.uuid]);
      await ubah("mutu_dokumen", lama.uuid, f, { deleted_at: n }, k);
      await catatAudit(k, req, "dokumen", lama.uuid, "hapus", lama, null);
    });
    kirim(res, { uuid: req.params.uuid }, "Dokumen draf berhasil dihapus");
  }),
);

export default rute;
