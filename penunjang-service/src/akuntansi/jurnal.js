import express from "express";
import { query, satu, sekarang, transaksi, uuidv7 } from "../db.js";
import { kirim, halaman, denganHalaman } from "../umum/respons.js";
import { punyaIzin, wajibIzin, wajibSalahSatu, galatIzin } from "../umum/izin.js";
import {
  JENIS_JURNAL,
  STATUS_JURNAL,
  akhirHariWib,
  awalHariWib,
  balikBaris,
  cekBolehSetujui,
  cekPilihan,
  dariSen,
  keSen,
  konflik,
  pastikanSeimbang,
  tanggalWajib,
  teks,
  teksWajib,
  tingkatWajib,
  validasiBarisManual,
} from "./bersama.js";
import { JENIS_EVENT } from "./event.js";
import { ambilJurnal, audit, barisJurnal, cekAkunJurnal, pastikanPeriodeTerbuka, pengaturan, simpanJurnal, tanganiAkuntansi } from "./dasar.js";

// Jurnal (KF-5, KF-8..KF-11).
//   GET  /jurnal?dari=&sampai=&jenis=&status=&q=&akun_uuid=&page=&limit=   daftar
//   GET  /jurnal/:uuid                 detail: baris, persetujuan, event & dokumen sumber, jurnal koreksi terkait
//   POST /jurnal                       jurnal manual/penyesuaian { jenis, tanggal, uraian, alasan, referensi, baris[] } → menunggu
//   POST /jurnal/:uuid/setujui         { catatan? }  tingkat 1 (SETUJUI) / tingkat 2 (SETUJUI TINGKAT 2); pembuat ≠ penyetuju
//   POST /jurnal/:uuid/tolak           { alasan }
//   POST /jurnal/:uuid/batalkan        pembuat membatalkan jurnal yang masih menunggu
//   POST /jurnal/:uuid/koreksi         { alasan, tanggal, baris_pengganti?[] }  jurnal koreksi = pembalik (+ pengganti)
// Jurnal menunggu/ditolak/dibatalkan tidak memengaruhi saldo (laporan hanya membaca status final). Jurnal final tidak
// pernah diubah/dihapus; koreksi selalu jurnal baru yang tertaut ke jurnal asal (KF-10).
const rute = express.Router();
const MODUL = "Akuntansi & Remunerasi";
const izin = (aksi) => wajibIzin(MODUL, "Jurnal", aksi);

rute.get(
  "/",
  wajibSalahSatu([MODUL, "Jurnal", "READ"], [MODUL, "Persetujuan Jurnal", "READ"]),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const p = [f];
    const syarat = ["j.faskes_uuid = $1", "j.deleted_at IS NULL"];
    if (q.dari) syarat.push(`j.tanggal >= $${p.push(awalHariWib(Number(q.dari) || 0))}`);
    if (q.sampai) syarat.push(`j.tanggal <= $${p.push(akhirHariWib(Number(q.sampai) || 0))}`);
    const jenis = cekPilihan(q.jenis || undefined, JENIS_JURNAL, "jenis");
    if (jenis) syarat.push(`j.jenis = $${p.push(jenis)}`);
    const status = cekPilihan(q.status || undefined, STATUS_JURNAL, "status");
    if (status) syarat.push(`j.status = $${p.push(status)}`);
    if (q.jenis_event) syarat.push(`j.jenis_event = $${p.push(String(q.jenis_event))}`);
    const cari = teks(q.q, "q", 100);
    if (cari) syarat.push(`(j.nomor ILIKE $${p.push(`%${cari}%`)} OR j.uraian ILIKE $${p.length} OR j.sumber_nomor ILIKE $${p.length} OR j.referensi ILIKE $${p.length})`);
    if (q.akun_uuid) syarat.push(`EXISTS (SELECT 1 FROM akuntansi_jurnal_baris b WHERE b.jurnal_uuid = j.uuid AND b.akun_uuid = $${p.push(String(q.akun_uuid))})`);
    const pg = halaman(q);
    const where = syarat.join(" AND ");
    const total = (await satu(`SELECT COUNT(*)::int AS n FROM akuntansi_jurnal j WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT j.uuid, j.nomor, j.jenis, j.status, j.tanggal, j.uraian, j.alasan, j.referensi, j.jenis_event, j.sumber_tabel, j.sumber_nomor,
              j.total_debit, j.total_kredit, j.tingkat_wajib, j.tingkat_disetujui, j.dibuat_oleh, j.created_at, j.jurnal_asal_uuid
         FROM akuntansi_jurnal j WHERE ${where} ORDER BY j.tanggal DESC, j.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  wajibSalahSatu([MODUL, "Jurnal", "READ"], [MODUL, "Persetujuan Jurnal", "READ"], [MODUL, "Buku Besar", "READ"]),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const j = await ambilJurnal(undefined, f, req.params.uuid);
    const [baris, persetujuan, event, terkait, asal] = await Promise.all([
      barisJurnal(undefined, f, j.uuid),
      query(`SELECT tingkat, keputusan, oleh, alasan, created_at FROM akuntansi_persetujuan WHERE jurnal_uuid = $1 AND faskes_uuid = $2 ORDER BY created_at`, [j.uuid, f]),
      j.kunci_sumber ? satu(`SELECT uuid, status, alasan, percobaan, updated_at FROM akuntansi_event WHERE faskes_uuid = $1 AND kunci = $2`, [f, j.kunci_sumber]) : null,
      query(`SELECT uuid, nomor, status, tanggal, alasan FROM akuntansi_jurnal WHERE faskes_uuid = $1 AND jurnal_asal_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`, [f, j.uuid]),
      j.jurnal_asal_uuid ? satu(`SELECT uuid, nomor, tanggal, status FROM akuntansi_jurnal WHERE uuid = $1 AND faskes_uuid = $2`, [j.jurnal_asal_uuid, f]) : null,
    ]);
    kirim(res, { ...j, nama_event: JENIS_EVENT[j.jenis_event]?.nama ?? null, baris, persetujuan, event, koreksi: terkait, jurnal_asal: asal });
  }),
);

// Jurnal manual / penyesuaian (KF-8): selalu masuk antrean persetujuan; periode tanggal transaksi harus terbuka.
rute.post(
  "/",
  izin("CREATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const jenis = cekPilihan(b.jenis ?? "manual", { manual: 1, penyesuaian: 1 }, "jenis");
    const tanggal = tanggalWajib(b.tanggal);
    const uraian = teksWajib(b.uraian, "uraian", 1000);
    const alasan = jenis === "penyesuaian" ? teksWajib(b.alasan, "alasan penyesuaian", 1000) : (teks(b.alasan, "alasan", 1000) ?? null);
    const referensi = teks(b.referensi, "referensi", 255) ?? null;
    const baris = validasiBarisManual(b.baris);
    const hasil = await transaksi(async (k) => {
      await pastikanPeriodeTerbuka(k, f, tanggal);
      await cekAkunJurnal(k, f, baris.map((x) => x.akun_uuid));
      const atur = await pengaturan(f, k);
      const total = pastikanSeimbang(baris).debit;
      const jurnal = await simpanJurnal(
        k,
        f,
        { jenis, status: "menunggu", tanggal, uraian, alasan, referensi, tingkat_wajib: tingkatWajib(total, atur.ambang_tingkat_2), dibuat_oleh: req.author.username ?? null, diajukan_pada: sekarang() },
        baris,
      );
      await audit(k, req, "buat", "akuntansi_jurnal", jurnal.uuid, { nomor: jurnal.nomor, jenis, tanggal, total: dariSen(total), tingkat_wajib: jurnal.tingkat_wajib });
      return jurnal;
    });
    kirim(res, hasil, "Jurnal diajukan untuk persetujuan");
  }),
);

rute.post(
  "/:uuid/setujui",
  wajibSalahSatu([MODUL, "Persetujuan Jurnal", "SETUJUI"], [MODUL, "Persetujuan Jurnal", "SETUJUI TINGKAT 2"]),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const catatan = teks(req.body?.catatan, "catatan", 1000) ?? null;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJurnal(k, f, req.params.uuid, true);
      const sebelumnya = (await query(`SELECT oleh FROM akuntansi_persetujuan WHERE jurnal_uuid = $1 AND keputusan = 'setuju'`, [j.uuid], k)).map((r) => r.oleh);
      const tingkat = cekBolehSetujui(j, req.author.username, sebelumnya);
      const aksi = tingkat === 1 ? "SETUJUI" : "SETUJUI TINGKAT 2";
      if (!(await punyaIzin(req, MODUL, "Persetujuan Jurnal", aksi))) throw galatIzin(MODUL, "Persetujuan Jurnal", aksi);
      await query(
        `INSERT INTO akuntansi_persetujuan (uuid, faskes_uuid, jurnal_uuid, tingkat, keputusan, oleh, alasan, created_at) VALUES ($1, $2, $3, $4, 'setuju', $5, $6, $7)`,
        [uuidv7(), f, j.uuid, tingkat, req.author.username, catatan, sekarang()],
        k,
      );
      const final = tingkat >= Number(j.tingkat_wajib || 1);
      // Finalisasi masuk buku besar → periode tanggal transaksi harus masih terbuka (KT-9).
      if (final) await pastikanPeriodeTerbuka(k, f, Number(j.tanggal));
      const baru = await satu(
        `UPDATE akuntansi_jurnal SET tingkat_disetujui = $3, status = $4, difinalkan_pada = $5, updated_at = $6 WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [j.uuid, f, tingkat, final ? "final" : "menunggu", final ? sekarang() : null, sekarang()],
        k,
      );
      await audit(k, req, "ubah", "akuntansi_jurnal_persetujuan", j.uuid, { nomor: j.nomor, keputusan: "setuju", tingkat, final, catatan });
      return baru;
    });
    kirim(res, hasil, hasil.status === "final" ? "Jurnal disetujui dan masuk buku besar" : "Persetujuan tingkat 1 tercatat; menunggu persetujuan tingkat 2");
  }),
);

rute.post(
  "/:uuid/tolak",
  wajibIzin(MODUL, "Persetujuan Jurnal", "TOLAK"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 1000);
    const hasil = await transaksi(async (k) => {
      const j = await ambilJurnal(k, f, req.params.uuid, true);
      if (j.status !== "menunggu") throw konflik("Jurnal tidak sedang menunggu persetujuan");
      if (String(j.dibuat_oleh ?? "").toLowerCase() === String(req.author.username ?? "").toLowerCase())
        throw konflik("Pembuat jurnal tidak dapat menolak jurnalnya sendiri; gunakan Batalkan");
      const tingkat = Number(j.tingkat_disetujui || 0) + 1;
      await query(
        `INSERT INTO akuntansi_persetujuan (uuid, faskes_uuid, jurnal_uuid, tingkat, keputusan, oleh, alasan, created_at) VALUES ($1, $2, $3, $4, 'tolak', $5, $6, $7)`,
        [uuidv7(), f, j.uuid, tingkat, req.author.username, alasan, sekarang()],
        k,
      );
      const baru = await satu(
        `UPDATE akuntansi_jurnal SET status = 'ditolak', ditolak_oleh = $3, ditolak_pada = $4, alasan_tolak = $5, updated_at = $4 WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [j.uuid, f, req.author.username, sekarang(), alasan],
        k,
      );
      await audit(k, req, "ubah", "akuntansi_jurnal_persetujuan", j.uuid, { nomor: j.nomor, keputusan: "tolak", tingkat, alasan });
      return baru;
    });
    kirim(res, hasil, "Jurnal ditolak");
  }),
);

rute.post(
  "/:uuid/batalkan",
  wajibSalahSatu([MODUL, "Jurnal", "CREATE"], [MODUL, "Jurnal", "KOREKSI"]),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJurnal(k, f, req.params.uuid, true);
      if (j.status !== "menunggu") throw konflik("Hanya jurnal yang menunggu persetujuan yang dapat dibatalkan");
      if (String(j.dibuat_oleh ?? "").toLowerCase() !== String(req.author.username ?? "").toLowerCase()) throw konflik("Hanya pembuat jurnal yang dapat membatalkan");
      const baru = await satu(`UPDATE akuntansi_jurnal SET status = 'dibatalkan', updated_at = $3 WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`, [j.uuid, f, sekarang()], k);
      await audit(k, req, "ubah", "akuntansi_jurnal", j.uuid, { nomor: j.nomor, status: ["menunggu", "dibatalkan"] });
      return baru;
    });
    kirim(res, hasil, "Jurnal dibatalkan");
  }),
);

// Koreksi (KF-10/KT-8): baris pembalik jurnal asal (+ baris pengganti opsional) sebagai jurnal baru beralasan pada
// periode terbuka — jalur resmi memperbaiki jurnal di periode yang sudah ditutup. Melalui persetujuan seperti jurnal manual.
rute.post(
  "/:uuid/koreksi",
  izin("KOREKSI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const alasan = teksWajib(b.alasan, "alasan koreksi", 1000);
    const tanggal = tanggalWajib(b.tanggal);
    const pengganti = Array.isArray(b.baris_pengganti) && b.baris_pengganti.length ? validasiBarisManual(b.baris_pengganti) : [];
    const hasil = await transaksi(async (k) => {
      const asal = await ambilJurnal(k, f, req.params.uuid, true);
      if (asal.status !== "final") throw konflik("Hanya jurnal final yang dapat dikoreksi");
      const aktif = await satu(`SELECT nomor FROM akuntansi_jurnal WHERE faskes_uuid = $1 AND jurnal_asal_uuid = $2 AND status IN ('menunggu','final') AND deleted_at IS NULL LIMIT 1`, [f, asal.uuid], k);
      if (aktif) throw konflik(`Jurnal ini sudah dikoreksi oleh ${aktif.nomor}`);
      await pastikanPeriodeTerbuka(k, f, tanggal);
      const lama = (await barisJurnal(k, f, asal.uuid)).map((x) => ({
        akun_uuid: x.akun_uuid,
        debit: keSen(x.debit),
        kredit: keSen(x.kredit),
        uraian: `Pembalik ${asal.nomor}`,
        komponen: x.komponen,
        penjamin_uuid: x.penjamin_uuid,
        supplier_uuid: x.supplier_uuid,
      }));
      if (pengganti.length) await cekAkunJurnal(k, f, pengganti.map((x) => x.akun_uuid));
      const baris = [...balikBaris(lama), ...pengganti];
      const total = pastikanSeimbang(baris).debit;
      const atur = await pengaturan(f, k);
      const jurnal = await simpanJurnal(
        k,
        f,
        {
          jenis: "koreksi",
          status: "menunggu",
          tanggal,
          uraian: `Koreksi ${asal.nomor}${asal.uraian ? ` — ${asal.uraian}` : ""}`.slice(0, 1000),
          alasan,
          referensi: asal.nomor,
          jurnal_asal_uuid: asal.uuid,
          tingkat_wajib: tingkatWajib(total, atur.ambang_tingkat_2),
          dibuat_oleh: req.author.username ?? null,
          diajukan_pada: sekarang(),
        },
        baris,
      );
      await audit(k, req, "buat", "akuntansi_jurnal_koreksi", jurnal.uuid, { nomor: jurnal.nomor, jurnal_asal: asal.nomor, alasan, pengganti: pengganti.length });
      return jurnal;
    });
    kirim(res, hasil, "Jurnal koreksi diajukan untuk persetujuan");
  }),
);

export default rute;
