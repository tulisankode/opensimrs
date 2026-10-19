import express from "express";
import { query, satu, sekarang, transaksi } from "../db.js";
import { kirim, permintaanSalah } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { dariSen, keSen, konflik, periodeWajib, rentangPeriode, teks, teksWajib } from "./bersama.js";
import { audit, kunciPeriode, namaPeriode, pengaturan, tanganiAkuntansi } from "./dasar.js";
import { pratinjau } from "./proses.js";

// Periode akuntansi bulanan & tutup buku (KF-12/KF-13).
//   GET  /periode?tahun=            12 bulan: status, jumlah jurnal final/menunggu, event tertahan/konflik
//   GET  /periode/kesiapan?tahun=&bulan=   pemeriksaan sebelum tutup buku (tanpa mengubah data)
//   POST /periode/tutup             { tahun, bulan, catatan? }  izin TUTUP BUKU; ditolak bila belum siap
//   POST /periode/buka              { tahun, bulan, alasan }    izin BUKA KEMBALI (kewenangan khusus, beralasan, diaudit)
//   GET/PUT /pengaturan             ambang nominal persetujuan tingkat 2 (izin Periode › PENGATURAN)
// Periode tutup menolak jurnal baru/persetujuan/proses otomatis bertanggal di dalamnya (lihat pastikanPeriodeTerbuka).
const rute = express.Router();
const MODUL = "Akuntansi & Remunerasi";
const izin = (aksi) => wajibIzin(MODUL, "Periode", aksi);

rute.get(
  "/periode",
  izin("READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const tahun = Number(req.query.tahun) || new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear();
    if (tahun < 2000 || tahun > 2100) throw permintaanSalah("tahun tidak valid");
    const [periode, jurnal, event] = await Promise.all([
      query(`SELECT * FROM akuntansi_periode WHERE faskes_uuid = $1 AND tahun = $2 AND deleted_at IS NULL`, [f, tahun]),
      query(
        `SELECT bulan, COUNT(*) FILTER (WHERE status = 'final')::int AS final, COUNT(*) FILTER (WHERE status = 'menunggu')::int AS menunggu
           FROM akuntansi_jurnal WHERE faskes_uuid = $1 AND tahun = $2 AND deleted_at IS NULL GROUP BY bulan`,
        [f, tahun],
      ),
      query(
        `SELECT bulan, COUNT(*) FILTER (WHERE status = 'tertahan')::int AS tertahan, COUNT(*) FILTER (WHERE status = 'konflik')::int AS konflik
           FROM akuntansi_event WHERE faskes_uuid = $1 AND tahun = $2 GROUP BY bulan`,
        [f, tahun],
      ),
    ]);
    const daftar = Array.from({ length: 12 }, (_, i) => {
      const bulan = i + 1;
      const p = periode.find((x) => x.bulan === bulan);
      const j = jurnal.find((x) => x.bulan === bulan);
      const e = event.find((x) => x.bulan === bulan);
      return {
        tahun,
        bulan,
        nama: namaPeriode(tahun, bulan),
        status: p?.status ?? "terbuka",
        ditutup_oleh: p?.ditutup_oleh ?? null,
        ditutup_pada: p?.ditutup_pada ?? null,
        dibuka_oleh: p?.dibuka_oleh ?? null,
        dibuka_pada: p?.dibuka_pada ?? null,
        alasan_buka: p?.alasan_buka ?? null,
        ringkasan: p?.ringkasan ?? null,
        jurnal_final: j?.final ?? 0,
        jurnal_menunggu: j?.menunggu ?? 0,
        event_tertahan: e?.tertahan ?? 0,
        event_konflik: e?.konflik ?? 0,
      };
    });
    kirim(res, daftar);
  }),
);

// Pemeriksaan kesiapan tutup buku (KT-10): tidak ada jurnal menunggu, tidak ada event tertahan/konflik, semua dokumen
// sumber periode sudah diproses (dijurnal/dilewati), dan mutasi jurnal final seimbang.
export const periksaKesiapan = async (f, tahun, bulan, k) => {
  const { awal, akhir } = rentangPeriode(tahun, bulan);
  const [menunggu, event, saldo, sumber] = await Promise.all([
    satu(`SELECT COUNT(*)::int AS n FROM akuntansi_jurnal WHERE faskes_uuid = $1 AND tahun = $2 AND bulan = $3 AND status = 'menunggu' AND deleted_at IS NULL`, [f, tahun, bulan], k),
    satu(
      `SELECT COUNT(*) FILTER (WHERE status = 'tertahan')::int AS tertahan, COUNT(*) FILTER (WHERE status = 'konflik')::int AS konflik
         FROM akuntansi_event WHERE faskes_uuid = $1 AND tahun = $2 AND bulan = $3`,
      [f, tahun, bulan],
      k,
    ),
    satu(
      `SELECT COUNT(DISTINCT j.uuid)::int AS jurnal, COALESCE(SUM(b.debit), 0) AS d, COALESCE(SUM(b.kredit), 0) AS k
         FROM akuntansi_jurnal j JOIN akuntansi_jurnal_baris b ON b.jurnal_uuid = j.uuid
        WHERE j.faskes_uuid = $1 AND j.status = 'final' AND j.deleted_at IS NULL AND j.tanggal BETWEEN $2 AND $3`,
      [f, awal, akhir],
      k,
    ),
    pratinjau(f, awal, akhir, k),
  ]);
  const d = keSen(saldo.d);
  const kr = keSen(saldo.k);
  const cek = [
    { kode: "jurnal_menunggu", nama: "Tidak ada jurnal yang menunggu persetujuan", lulus: menunggu.n === 0, nilai: menunggu.n },
    { kode: "event_tertahan", nama: "Tidak ada transaksi sumber yang tertahan", lulus: event.tertahan === 0, nilai: event.tertahan },
    { kode: "event_konflik", nama: "Tidak ada konflik dokumen sumber yang belum diselesaikan", lulus: event.konflik === 0 && sumber.total.konflik === 0, nilai: Math.max(event.konflik, sumber.total.konflik) },
    { kode: "sumber_belum", nama: "Semua dokumen sumber periode sudah diproses jurnal otomatis", lulus: sumber.total.belum === 0, nilai: sumber.total.belum },
    { kode: "seimbang", nama: "Mutasi jurnal final periode seimbang (debit = kredit)", lulus: d === kr, nilai: `${dariSen(d)} / ${dariSen(kr)}` },
  ];
  return {
    tahun,
    bulan,
    nama: namaPeriode(tahun, bulan),
    siap: cek.every((c) => c.lulus),
    cek,
    ringkasan: { jurnal_final: saldo.jurnal, total_debit: dariSen(d), total_kredit: dariSen(kr), sumber: sumber.per_jenis },
    belum: sumber.belum,
  };
};

rute.get(
  "/periode/kesiapan",
  izin("READ"),
  tanganiAkuntansi(async (req, res) => {
    const { tahun, bulan } = periodeWajib(req.query);
    const p = await satu(`SELECT status FROM akuntansi_periode WHERE faskes_uuid = $1 AND tahun = $2 AND bulan = $3 AND deleted_at IS NULL`, [req.author.faskesUuid, tahun, bulan]);
    kirim(res, { status: p?.status ?? "terbuka", ...(await periksaKesiapan(req.author.faskesUuid, tahun, bulan)) });
  }),
);

rute.post(
  "/periode/tutup",
  izin("TUTUP BUKU"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { tahun, bulan } = periodeWajib(req.body);
    const catatan = teks(req.body?.catatan, "catatan", 1000) ?? null;
    const hasil = await transaksi(async (k) => {
      const p = await kunciPeriode(k, f, tahun, bulan, "update");
      if (p.status === "tutup") throw konflik(`Periode ${namaPeriode(tahun, bulan)} sudah ditutup`);
      const kesiapan = await periksaKesiapan(f, tahun, bulan, k);
      if (!kesiapan.siap) {
        const gagal = kesiapan.cek.filter((c) => !c.lulus).map((c) => `${c.nama} (${c.nilai})`);
        throw konflik(`Periode belum siap ditutup: ${gagal.join("; ")}`);
      }
      const ringkasan = { ...kesiapan.ringkasan, catatan };
      const baru = await satu(
        `UPDATE akuntansi_periode SET status = 'tutup', ringkasan = $2, ditutup_oleh = $3, ditutup_pada = $4, updated_at = $4 WHERE uuid = $1 RETURNING *`,
        [p.uuid, JSON.stringify(ringkasan), req.author.username ?? null, sekarang()],
        k,
      );
      await audit(k, req, "ubah", "akuntansi_periode", p.uuid, { periode: namaPeriode(tahun, bulan), status: ["terbuka", "tutup"], ringkasan });
      return baru;
    });
    kirim(res, hasil, `Periode ${namaPeriode(tahun, bulan)} ditutup`);
  }),
);

rute.post(
  "/periode/buka",
  izin("BUKA KEMBALI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { tahun, bulan } = periodeWajib(req.body);
    const alasan = teksWajib(req.body?.alasan, "alasan", 1000);
    const hasil = await transaksi(async (k) => {
      const p = await kunciPeriode(k, f, tahun, bulan, "update");
      if (p.status !== "tutup") throw konflik(`Periode ${namaPeriode(tahun, bulan)} belum ditutup`);
      const baru = await satu(
        `UPDATE akuntansi_periode SET status = 'terbuka', dibuka_oleh = $2, dibuka_pada = $3, alasan_buka = $4, updated_at = $3 WHERE uuid = $1 RETURNING *`,
        [p.uuid, req.author.username ?? null, sekarang(), alasan],
        k,
      );
      await audit(k, req, "ubah", "akuntansi_periode", p.uuid, { periode: namaPeriode(tahun, bulan), status: ["tutup", "terbuka"], alasan, ditutup_oleh: p.ditutup_oleh });
      return baru;
    });
    kirim(res, hasil, `Periode ${namaPeriode(tahun, bulan)} dibuka kembali`);
  }),
);

rute.get(
  "/pengaturan",
  izin("READ"),
  tanganiAkuntansi(async (req, res) => kirim(res, await pengaturan(req.author.faskesUuid))),
);

rute.put(
  "/pengaturan",
  izin("PENGATURAN"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const v = req.body?.ambang_tingkat_2;
    let ambang = null;
    if (v !== null && v !== undefined && v !== "") {
      const sen = keSen(v, "ambang_tingkat_2");
      if (sen <= 0) throw permintaanSalah("ambang_tingkat_2 harus lebih dari 0 (kosongkan untuk satu tingkat persetujuan)");
      ambang = dariSen(sen);
    }
    const hasil = await transaksi(async (k) => {
      const lama = await pengaturan(f, k);
      const n = sekarang();
      const row = await satu(
        `INSERT INTO akuntansi_pengaturan (faskes_uuid, ambang_tingkat_2, diubah_oleh, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (faskes_uuid) DO UPDATE SET ambang_tingkat_2 = EXCLUDED.ambang_tingkat_2, diubah_oleh = EXCLUDED.diubah_oleh, updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [f, ambang, req.author.username ?? null, n],
        k,
      );
      await audit(k, req, "ubah", "akuntansi_pengaturan", null, { ambang_tingkat_2: [lama.ambang_tingkat_2, ambang] });
      return row;
    });
    kirim(res, { ...hasil, diatur: true }, "Pengaturan disimpan");
  }),
);

export default rute;
