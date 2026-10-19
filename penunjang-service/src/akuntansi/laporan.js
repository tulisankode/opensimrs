import express from "express";
import { query, transaksi } from "../db.js";
import { kirim, permintaanSalah } from "../umum/respons.js";
import { punyaIzin, galatIzin, wajibIzin } from "../umum/izin.js";
import {
  KELOMPOK_UMUR,
  akhirHariWib,
  awalTahun,
  dariSen,
  hitungAging,
  hitungArusKasLangsung,
  hitungArusKasTidakLangsung,
  hitungLabaRugi,
  hitungNeraca,
  keSen,
  labaDari,
  periodeDari,
  rentangWajib,
  nilaiKelompok,
} from "./bersama.js";
import { audit, saldoAkun, tanganiAkuntansi } from "./dasar.js";

// Laporan keuangan (KF-14/KF-15) dari jurnal FINAL. Nominal dikirim sebagai teks 2 desimal (tanpa floating point).
//   GET /laporan/neraca?per=                    posisi keuangan per tanggal
//   GET /laporan/laba-rugi?dari=&sampai=        laba rugi / laporan operasional
//   GET /laporan/arus-kas?dari=&sampai=         metode langsung & tidak langsung (keduanya direkonsiliasi ke mutasi kas)
//   GET /laporan/perubahan-ekuitas?dari=&sampai=
//   GET /laporan/aging-piutang?per=             per penjamin (akun buku pembantu piutang), FIFO
//   GET /laporan/aging-utang?per=               per supplier (akun buku pembantu utang), FIFO
// Tambahkan ?ekspor=xlsx|pdf saat frontend membuat berkas ekspor: izin EKSPOR diperiksa dan aktivitas dicatat di Audit
// Trail (KT-13). Berkas Excel/PDF dibuat di frontend dengan pustaka yang sudah ada (xlsx, pdfmake).
const rute = express.Router();
const MODUL = "Akuntansi & Remunerasi";
rute.use(wajibIzin(MODUL, "Laporan Keuangan", "READ"));

const uang = (obj) => {
  if (Array.isArray(obj)) return obj.map(uang);
  if (obj && typeof obj === "object") return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, NILAI.has(k) && typeof v === "number" ? dariSen(v) : uang(v)]));
  return obj;
};
const NILAI = new Set([
  "nilai", "total", "total_aset", "total_kewajiban", "total_ekuitas", "surplus_tahun_lalu", "surplus_tahun_berjalan", "total_pendapatan", "total_beban",
  "surplus", "kenaikan_kas", "kas_awal", "kas_akhir", "saldo_awal", "mutasi", "saldo_akhir", "b0_30", "b31_60", "b61_90", "b90", "lebih_bayar",
]);

// Catat ekspor (izin EKSPOR) bila diminta.
const catatEkspor = async (req, jenis, parameter) => {
  const format = req.query.ekspor;
  if (!format) return;
  if (!["xlsx", "pdf"].includes(format)) throw permintaanSalah("ekspor harus xlsx atau pdf");
  if (!(await punyaIzin(req, MODUL, "Laporan Keuangan", "EKSPOR"))) throw galatIzin(MODUL, "Laporan Keuangan", "EKSPOR");
  await transaksi((k) => audit(k, req, "ekspor", "akuntansi_laporan", null, { laporan: jenis, format, ...parameter }));
};
const perWajib = (q) => akhirHariWib(q.per ? Number(q.per) : Math.floor(Date.now() / 1000));

rute.get(
  "/neraca",
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const per = perWajib(req.query);
    if (!Number.isFinite(per)) throw permintaanSalah("per harus berupa epoch detik");
    const { tahun } = periodeDari(per);
    const [saldo, sebelumTahun] = await Promise.all([saldoAkun(f, null, per), saldoAkun(f, null, awalTahun(tahun) - 1)]);
    await catatEkspor(req, "neraca", { per });
    kirim(res, { per, tahun, ...uang(hitungNeraca(saldo, sebelumTahun)) });
  }),
);

rute.get(
  "/laba-rugi",
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { dari, sampai } = rentangWajib(req.query);
    const mutasi = await saldoAkun(f, dari, sampai);
    await catatEkspor(req, "laba_rugi", { dari, sampai });
    kirim(res, { dari, sampai, ...uang(hitungLabaRugi(mutasi)) });
  }),
);

rute.get(
  "/arus-kas",
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { dari, sampai } = rentangWajib(req.query);
    const [mutasi, sebelum, baris] = await Promise.all([
      saldoAkun(f, dari, sampai),
      saldoAkun(f, null, dari - 1),
      query(
        `SELECT b.jurnal_uuid, b.akun_uuid, a.kode, a.nama, a.kelompok, a.kas_setara_kas, a.arus_kas, b.debit, b.kredit
           FROM akuntansi_jurnal_baris b JOIN akuntansi_jurnal j ON j.uuid = b.jurnal_uuid JOIN akuntansi_akun a ON a.uuid = b.akun_uuid
          WHERE j.faskes_uuid = $1 AND j.status = 'final' AND j.deleted_at IS NULL AND j.tanggal BETWEEN $2 AND $3`,
        [f, dari, sampai],
      ),
    ]);
    const langsung = hitungArusKasLangsung(baris.map((b) => ({ ...b, debit: keSen(b.debit), kredit: keSen(b.kredit) })));
    const tidakLangsung = hitungArusKasTidakLangsung(mutasi);
    const kas = (daftar) => daftar.filter((a) => a.kas_setara_kas).reduce((t, a) => t + a.debit - a.kredit, 0);
    const kasAwal = kas(sebelum);
    const mutasiKas = kas(mutasi);
    await catatEkspor(req, "arus_kas", { dari, sampai });
    kirim(res, {
      dari,
      sampai,
      kas_awal: dariSen(kasAwal),
      kas_akhir: dariSen(kasAwal + mutasiKas),
      mutasi_kas: dariSen(mutasiKas),
      langsung: uang(langsung),
      tidak_langsung: uang(tidakLangsung),
      cocok: langsung.kenaikan_kas === mutasiKas && tidakLangsung.kenaikan_kas === mutasiKas,
    });
  }),
);

rute.get(
  "/perubahan-ekuitas",
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { dari, sampai } = rentangWajib(req.query);
    const [sebelum, mutasi] = await Promise.all([saldoAkun(f, null, dari - 1), saldoAkun(f, dari, sampai)]);
    const peta = new Map(sebelum.map((a) => [a.uuid, a]));
    const akun = mutasi
      .filter((a) => a.kelompok === "ekuitas" && a.jenis === "rinci")
      .map((a) => {
        const s = peta.get(a.uuid);
        const awal = nilaiKelompok(s);
        const m = nilaiKelompok(a);
        return { uuid: a.uuid, kode: a.kode, nama: a.nama, saldo_awal: awal, mutasi: m, saldo_akhir: awal + m };
      })
      .filter((a) => a.saldo_awal || a.mutasi);
    // Surplus akumulasi (pendapatan − beban sebelum rentang) dan surplus rentang dihitung dari akun pendapatan/beban.
    const surplusAwal = labaDari(sebelum);
    const surplus = labaDari(mutasi);
    const totalAwal = akun.reduce((t, a) => t + a.saldo_awal, 0) + surplusAwal;
    const totalMutasi = akun.reduce((t, a) => t + a.mutasi, 0) + surplus;
    await catatEkspor(req, "perubahan_ekuitas", { dari, sampai });
    kirim(res, {
      dari,
      sampai,
      ...uang({
        akun,
        surplus_akumulasi: { saldo_awal: surplusAwal, mutasi: surplus, saldo_akhir: surplusAwal + surplus },
        total: { saldo_awal: totalAwal, mutasi: totalMutasi, saldo_akhir: totalAwal + totalMutasi },
      }),
    });
  }),
);

const aging = (jenis) =>
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const per = perWajib(req.query);
    const kolomPihak = jenis === "piutang" ? "b.penjamin_uuid" : "b.supplier_uuid";
    const namaPihak = jenis === "piutang" ? "(SELECT pj.name FROM penjamin pj WHERE pj.uuid = b.penjamin_uuid AND pj.faskes_uuid = b.faskes_uuid)" : "(SELECT s.name FROM master_supplier s WHERE s.uuid = b.supplier_uuid AND s.faskes_uuid = b.faskes_uuid)";
    const baris = await query(
      `SELECT j.tanggal, ${kolomPihak} AS ${jenis === "piutang" ? "penjamin_uuid" : "supplier_uuid"}, ${namaPihak} AS nama_pihak, b.debit, b.kredit
         FROM akuntansi_jurnal_baris b JOIN akuntansi_jurnal j ON j.uuid = b.jurnal_uuid JOIN akuntansi_akun a ON a.uuid = b.akun_uuid
        WHERE j.faskes_uuid = $1 AND j.status = 'final' AND j.deleted_at IS NULL AND j.tanggal <= $2 AND a.buku_pembantu = $3
        ORDER BY j.tanggal, j.created_at, b.urutan`,
      [f, per, jenis],
    );
    const hasil = hitungAging(baris.map((b) => ({ ...b, debit: keSen(b.debit), kredit: keSen(b.kredit) })), jenis, per).map((h) => ({
      ...h,
      nama: h.nama ?? (h.pihak_uuid ? "(tidak dikenal)" : jenis === "piutang" ? "Pasien Umum / Tanpa Penjamin" : "Tanpa Supplier"),
    }));
    const total = hasil.reduce(
      (t, h) => ({ b0_30: t.b0_30 + h.b0_30, b31_60: t.b31_60 + h.b31_60, b61_90: t.b61_90 + h.b61_90, b90: t.b90 + h.b90, lebih_bayar: t.lebih_bayar + h.lebih_bayar, total: t.total + h.total }),
      { b0_30: 0, b31_60: 0, b61_90: 0, b90: 0, lebih_bayar: 0, total: 0 },
    );
    await catatEkspor(req, `aging_${jenis}`, { per });
    kirim(res, { per, jenis, kelompok_umur: KELOMPOK_UMUR, pihak: uang(hasil), total: uang(total) });
  });
rute.get("/aging-piutang", aging("piutang"));
rute.get("/aging-utang", aging("utang"));

export default rute;
