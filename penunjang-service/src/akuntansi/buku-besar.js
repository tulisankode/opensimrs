import express from "express";
import { query, satu } from "../db.js";
import { kirim, tidakDitemukan } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { dariSen, keSen, rentangWajib, saldoNormal, teksWajib } from "./bersama.js";
import { saldoAkun, tanganiAkuntansi } from "./dasar.js";

// Buku besar & neraca saldo (KF-11) dari jurnal FINAL saja; setiap baris tertelusur ke jurnal & dokumen sumbernya.
//   GET /buku-besar?akun_uuid=&dari=&sampai=   saldo awal, mutasi berjalan, saldo akhir satu akun
//   GET /neraca-saldo?dari=&sampai=            per akun rinci: saldo awal, mutasi debit/kredit, saldo akhir; total D = K
const rute = express.Router();
const izin = wajibIzin("Akuntansi & Remunerasi", "Buku Besar", "READ");

rute.get(
  "/buku-besar",
  izin,
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const akunUuid = teksWajib(req.query.akun_uuid, "akun_uuid", 255);
    const { dari, sampai } = rentangWajib(req.query);
    const akun = await satu(`SELECT uuid, kode, nama, kelompok, saldo_normal, jenis FROM akuntansi_akun WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [akunUuid, f]);
    if (!akun) throw tidakDitemukan("Akun");
    const awal = await satu(
      `SELECT COALESCE(SUM(b.debit), 0) AS d, COALESCE(SUM(b.kredit), 0) AS k FROM akuntansi_jurnal_baris b JOIN akuntansi_jurnal j ON j.uuid = b.jurnal_uuid
        WHERE b.faskes_uuid = $1 AND b.akun_uuid = $2 AND j.status = 'final' AND j.deleted_at IS NULL AND j.tanggal < $3`,
      [f, akun.uuid, dari],
    );
    const rows = await query(
      `SELECT b.uuid, b.debit, b.kredit, b.uraian AS uraian_baris, b.penjamin_uuid, b.supplier_uuid, j.uuid AS jurnal_uuid, j.nomor, j.tanggal, j.jenis,
              j.uraian, j.jenis_event, j.sumber_tabel, j.sumber_uuid, j.sumber_nomor
         FROM akuntansi_jurnal_baris b JOIN akuntansi_jurnal j ON j.uuid = b.jurnal_uuid
        WHERE b.faskes_uuid = $1 AND b.akun_uuid = $2 AND j.status = 'final' AND j.deleted_at IS NULL AND j.tanggal BETWEEN $3 AND $4
        ORDER BY j.tanggal, j.created_at, b.urutan LIMIT 20000`,
      [f, akun.uuid, dari, sampai],
    );
    const tanda = akun.saldo_normal === "kredit" ? -1 : 1;
    let saldo = tanda * (keSen(awal.d) - keSen(awal.k));
    const saldoAwal = saldo;
    let td = 0;
    let tk = 0;
    const mutasi = rows.map((r) => {
      const d = keSen(r.debit);
      const k = keSen(r.kredit);
      td += d;
      tk += k;
      saldo += tanda * (d - k);
      return { ...r, saldo: dariSen(saldo) };
    });
    kirim(res, { akun, dari, sampai, saldo_awal: dariSen(saldoAwal), total_debit: dariSen(td), total_kredit: dariSen(tk), saldo_akhir: dariSen(saldo), mutasi });
  }),
);

rute.get(
  "/neraca-saldo",
  izin,
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { dari, sampai } = rentangWajib(req.query);
    const [sebelum, berjalan] = await Promise.all([saldoAkun(f, null, dari - 1), saldoAkun(f, dari, sampai)]);
    const peta = new Map(sebelum.map((a) => [a.uuid, a]));
    const sisi = (sen) => ({ debit: sen > 0 ? sen : 0, kredit: sen < 0 ? -sen : 0 });
    const total = { awal_debit: 0, awal_kredit: 0, mutasi_debit: 0, mutasi_kredit: 0, akhir_debit: 0, akhir_kredit: 0 };
    const akun = berjalan
      .filter((a) => a.jenis === "rinci")
      .map((a) => {
        const s = peta.get(a.uuid);
        const awal = sisi(s.debit - s.kredit);
        const akhir = sisi(s.debit - s.kredit + a.debit - a.kredit);
        total.awal_debit += awal.debit;
        total.awal_kredit += awal.kredit;
        total.mutasi_debit += a.debit;
        total.mutasi_kredit += a.kredit;
        total.akhir_debit += akhir.debit;
        total.akhir_kredit += akhir.kredit;
        return {
          uuid: a.uuid,
          kode: a.kode,
          nama: a.nama,
          kelompok: a.kelompok,
          saldo_normal: a.saldo_normal,
          aktif: a.aktif,
          awal_debit: dariSen(awal.debit),
          awal_kredit: dariSen(awal.kredit),
          mutasi_debit: dariSen(a.debit),
          mutasi_kredit: dariSen(a.kredit),
          akhir_debit: dariSen(akhir.debit),
          akhir_kredit: dariSen(akhir.kredit),
          saldo_akhir_normal: dariSen(saldoNormal({ ...a, debit: s.debit + a.debit, kredit: s.kredit + a.kredit })),
          ada_saldo: !!(s.debit || s.kredit || a.debit || a.kredit),
        };
      });
    kirim(res, {
      dari,
      sampai,
      akun: req.query.semua === "1" ? akun : akun.filter((a) => a.ada_saldo),
      total: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, dariSen(v)])),
      seimbang: total.awal_debit === total.awal_kredit && total.mutasi_debit === total.mutasi_kredit && total.akhir_debit === total.akhir_kredit,
    });
  }),
);

export default rute;
