import express from "express";
import { query, satu, sekarang, transaksi, uuidv7 } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { STATUS_EVENT, cekPilihan, dariSen, hashData, keSen, konflik, petakanBaris, periodeDari, periodeWajib, rentangPeriode, teksWajib } from "./bersama.js";
import { JENIS_EVENT, JENIS_EVENT_TERSEDIA } from "./event.js";
import { ambilEvent } from "./sumber.js";
import { audit, namaPeriode, pastikanPeriodeTerbuka, simpanJurnal, tanganiAkuntansi } from "./dasar.js";

// Jurnal otomatis (KF-4..KF-7). Mekanisme PENARIKAN: "proses jurnal periode" membaca dokumen sumber yang sudah ada di
// database bersama untuk satu bulan dan menjurnalnya satu per satu (satu transaksi per dokumen). Idempoten: kunci unik
// per jenis event + dokumen (akuntansi_event.kunci & akuntansi_jurnal.kunci_sumber) — proses ulang tidak menggandakan
// jurnal; dokumen yang ditahan (pemetaan belum ada/akun nonaktif) dicoba lagi pada proses berikutnya.
//   POST /proses                    { tahun, bulan, jenis_event?: [] }  proses (izin Jurnal › PROSES OTOMATIS)
//   GET  /proses/pratinjau?tahun=&bulan=   jumlah dokumen per jenis: sudah dijurnal / belum / konflik / dilewati
//   GET  /event?tahun=&bulan=&status=&jenis_event=   log pemrosesan (tertahan/konflik ditindaklanjuti)
//   POST /event/:uuid/selesaikan   { alasan }  konflik diselesaikan (setelah jurnal koreksi dibuat bila perlu)
// jurnalkanEvent() juga dapat dipanggil modul lain di dalam transaksinya (mekanisme DORONG, mis. Remunerasi STD-0032).
const rute = express.Router();
const izin = (aksi) => wajibIzin("Akuntansi & Remunerasi", "Jurnal", aksi);

export const muatAturan = async (f, k) => {
  const rows = await query(`SELECT jenis_event, komponen, akun_uuid, berlaku_mulai, aktif FROM akuntansi_pemetaan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f], k);
  const peta = {};
  for (const r of rows) (peta[r.jenis_event] ??= []).push(r);
  return peta;
};

const simpanEvent = (k, f, ev, { status, alasan = null, hash, jurnalUuid = null, pengguna = null }) => {
  const { tahun, bulan } = periodeDari(ev.tanggal);
  const n = sekarang();
  return query(
    `INSERT INTO akuntansi_event (uuid, faskes_uuid, jenis_event, kunci, sumber_tabel, sumber_uuid, sumber_nomor, tanggal, tahun, bulan, nilai,
       hash_data, status, alasan, jurnal_uuid, percobaan, diproses_oleh, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, $16, $17, $17)
     ON CONFLICT (faskes_uuid, kunci) DO UPDATE SET status = EXCLUDED.status, alasan = EXCLUDED.alasan, hash_data = EXCLUDED.hash_data,
       hash_terbaru = NULL, jurnal_uuid = EXCLUDED.jurnal_uuid, nilai = EXCLUDED.nilai, tanggal = EXCLUDED.tanggal, tahun = EXCLUDED.tahun,
       bulan = EXCLUDED.bulan, sumber_nomor = EXCLUDED.sumber_nomor, percobaan = akuntansi_event.percobaan + 1,
       diproses_oleh = EXCLUDED.diproses_oleh, updated_at = EXCLUDED.updated_at`,
    [uuidv7(), f, ev.jenis_event, ev.kunci, ev.sumber_tabel, ev.sumber_uuid, ev.sumber_nomor, ev.tanggal, tahun, bulan, dariSen(ev.nilai ?? 0), hash, status, alasan, jurnalUuid, pengguna, n],
    k,
  );
};

// Jurnalkan satu event di dalam transaksi `k`. Hasil: dijurnal | sudah | konflik | tertahan | dilewati.
export const jurnalkanEvent = async (k, f, ev, { aturan = [], pengguna = null } = {}) => {
  const hash = hashData(ev.data);
  await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`akuntansi:${f}:${ev.kunci}`]);
  const ada = await satu(`SELECT * FROM akuntansi_event WHERE faskes_uuid = $1 AND kunci = $2 FOR UPDATE`, [f, ev.kunci], k);
  if (ada?.jurnal_uuid) {
    if (ada.hash_data === hash) {
      if (ada.status !== "dijurnal")
        await query(`UPDATE akuntansi_event SET status = 'dijurnal', hash_terbaru = NULL, alasan = 'Data sumber kembali sesuai jurnal', updated_at = $3 WHERE faskes_uuid = $1 AND kunci = $2`, [f, ev.kunci, sekarang()], k);
      return { hasil: "sudah", jurnal_uuid: ada.jurnal_uuid };
    }
    if (ada.status !== "konflik" || ada.hash_terbaru !== hash)
      await query(
        `UPDATE akuntansi_event SET status = 'konflik', hash_terbaru = $3, percobaan = percobaan + 1, updated_at = $4,
           alasan = $5 WHERE faskes_uuid = $1 AND kunci = $2`,
        [f, ev.kunci, hash, sekarang(), `Dokumen sumber berubah setelah dijurnal (nilai jurnal ${dariSen(keSen(ada.nilai))}, nilai sekarang ${dariSen(ev.nilai ?? 0)}). Jurnal lama tidak diubah — buat jurnal koreksi bila perlu, lalu tandai selesai.`],
        k,
      );
    return { hasil: "konflik", jurnal_uuid: ada.jurnal_uuid };
  }
  const lama = await satu(`SELECT uuid FROM akuntansi_jurnal WHERE faskes_uuid = $1 AND kunci_sumber = $2`, [f, ev.kunci], k);
  if (lama) {
    await simpanEvent(k, f, ev, { status: "dijurnal", hash, jurnalUuid: lama.uuid, pengguna });
    return { hasil: "sudah", jurnal_uuid: lama.uuid };
  }
  if (ev.lewati) {
    await simpanEvent(k, f, ev, { status: "dilewati", alasan: ev.lewati, hash, pengguna });
    return { hasil: "dilewati" };
  }
  await pastikanPeriodeTerbuka(k, f, ev.tanggal);
  const { baris, kurang } = petakanBaris(ev.baris, aturan, ev.tanggal);
  if (kurang.length) {
    const alasan = `Pemetaan akun belum ada untuk komponen: ${kurang.join(", ")} (${JENIS_EVENT[ev.jenis_event]?.nama ?? ev.jenis_event}). Lengkapi di menu Pemetaan Akun lalu proses ulang.`;
    await simpanEvent(k, f, ev, { status: "tertahan", alasan, hash, pengguna });
    return { hasil: "tertahan", alasan };
  }
  const akun = await query(`SELECT uuid, kode, nama, jenis, aktif FROM akuntansi_akun WHERE faskes_uuid = $1 AND deleted_at IS NULL AND uuid = ANY($2::varchar[])`, [f, baris.map((b) => b.akun_uuid)], k);
  const masalah = baris
    .map((b) => ({ b, a: akun.find((x) => x.uuid === b.akun_uuid) }))
    .filter(({ a }) => !a || !a.aktif || a.jenis !== "rinci")
    .map(({ b, a }) => (a ? `${a.kode} ${a.nama} (${!a.aktif ? "nonaktif" : "akun induk"}) untuk komponen ${b.komponen}` : `akun komponen ${b.komponen} tidak ditemukan`));
  if (masalah.length) {
    const alasan = `Akun pemetaan tidak dapat dijurnal: ${masalah.join("; ")}`;
    await simpanEvent(k, f, ev, { status: "tertahan", alasan, hash, pengguna });
    return { hasil: "tertahan", alasan };
  }
  const n = sekarang();
  const jurnal = await simpanJurnal(
    k,
    f,
    {
      jenis: "otomatis",
      status: "final",
      tanggal: ev.tanggal,
      uraian: ev.uraian,
      jenis_event: ev.jenis_event,
      sumber_tabel: ev.sumber_tabel,
      sumber_uuid: ev.sumber_uuid,
      sumber_nomor: ev.sumber_nomor,
      kunci_sumber: ev.kunci,
      dibuat_oleh: pengguna,
      difinalkan_pada: n,
    },
    baris,
  );
  await simpanEvent(k, f, ev, { status: "dijurnal", hash, jurnalUuid: jurnal.uuid, pengguna });
  return { hasil: "dijurnal", jurnal_uuid: jurnal.uuid, nomor: jurnal.nomor };
};

const jenisDipilih = (v) => {
  if (v === undefined || v === null || (Array.isArray(v) && !v.length)) return JENIS_EVENT_TERSEDIA;
  const daftar = Array.isArray(v) ? v : String(v).split(",");
  for (const j of daftar) if (!JENIS_EVENT_TERSEDIA.includes(j)) throw permintaanSalah(`jenis_event harus salah satu: ${JENIS_EVENT_TERSEDIA.join(", ")}`);
  return [...new Set(daftar)];
};

rute.post(
  "/proses",
  izin("PROSES OTOMATIS"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { tahun, bulan } = periodeWajib(req.body);
    const jenis = jenisDipilih(req.body?.jenis_event);
    const periode = await satu(`SELECT * FROM akuntansi_periode WHERE faskes_uuid = $1 AND tahun = $2 AND bulan = $3 AND deleted_at IS NULL`, [f, tahun, bulan]);
    if (periode?.status === "tutup") throw konflik(`Periode ${namaPeriode(tahun, bulan)} sudah ditutup; proses jurnal ditolak`);
    const { awal, akhir } = rentangPeriode(tahun, bulan);
    const events = await ambilEvent(f, awal, akhir, jenis);
    const aturan = await muatAturan(f);
    const ringkasan = Object.fromEntries(jenis.map((j) => [j, { nama: JENIS_EVENT[j].nama, jumlah: 0, dijurnal: 0, sudah: 0, tertahan: 0, konflik: 0, dilewati: 0, nilai_dijurnal: "0.00" }]));
    const nilai = {};
    const pengguna = req.author.username ?? null;
    for (const ev of events) {
      const r = ringkasan[ev.jenis_event];
      r.jumlah += 1;
      let hasil;
      try {
        hasil = await transaksi((k) => jurnalkanEvent(k, f, ev, { aturan: aturan[ev.jenis_event] ?? [], pengguna }));
      } catch (e) {
        if (e.status === 409 && /sudah ditutup/.test(e.message)) throw e;
        const alasan = `Gagal dijurnal: ${e.message}`;
        await transaksi((k) => simpanEvent(k, f, ev, { status: "tertahan", alasan, hash: hashData(ev.data), pengguna }));
        hasil = { hasil: "tertahan", alasan };
      }
      r[hasil.hasil] += 1;
      if (hasil.hasil === "dijurnal") nilai[ev.jenis_event] = (nilai[ev.jenis_event] ?? 0) + (ev.nilai ?? 0);
    }
    for (const [j, v] of Object.entries(nilai)) ringkasan[j].nilai_dijurnal = dariSen(v);
    await transaksi(async (k) => {
      const p = await satu(`SELECT uuid FROM akuntansi_periode WHERE faskes_uuid = $1 AND tahun = $2 AND bulan = $3 AND deleted_at IS NULL`, [f, tahun, bulan], k);
      await audit(k, req, "buat", "akuntansi_proses_jurnal", p?.uuid ?? null, { tahun, bulan, ringkasan });
    });
    kirim(res, { tahun, bulan, ringkasan }, "Proses jurnal otomatis selesai");
  }),
);

rute.get(
  "/proses/pratinjau",
  izin("READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { tahun, bulan } = periodeWajib(req.query);
    const { awal, akhir } = rentangPeriode(tahun, bulan);
    kirim(res, { tahun, bulan, ...(await pratinjau(f, awal, akhir)) });
  }),
);

// Status pemrosesan dokumen sumber satu periode (dipakai juga pemeriksaan kesiapan tutup buku, KF-12).
export const pratinjau = async (f, awal, akhir, k) => {
  const events = await ambilEvent(f, awal, akhir, JENIS_EVENT_TERSEDIA);
  const ada = events.length
    ? await query(`SELECT kunci, status, hash_data, jurnal_uuid FROM akuntansi_event WHERE faskes_uuid = $1 AND kunci = ANY($2::varchar[])`, [f, events.map((e) => e.kunci)], k)
    : [];
  const peta = new Map(ada.map((r) => [r.kunci, r]));
  const per = Object.fromEntries(JENIS_EVENT_TERSEDIA.map((j) => [j, { nama: JENIS_EVENT[j].nama, jumlah: 0, dijurnal: 0, belum: 0, konflik: 0, dilewati: 0 }]));
  const belum = [];
  for (const ev of events) {
    const r = per[ev.jenis_event];
    const e = peta.get(ev.kunci);
    r.jumlah += 1;
    let status;
    if (e?.jurnal_uuid) status = e.hash_data === hashData(ev.data) && e.status !== "konflik" ? "dijurnal" : "konflik";
    else if (ev.lewati) status = "dilewati";
    else status = "belum";
    r[status] += 1;
    if (status === "belum" && belum.length < 200)
      belum.push({ jenis_event: ev.jenis_event, sumber_nomor: ev.sumber_nomor, tanggal: ev.tanggal, nilai: dariSen(ev.nilai ?? 0), status_event: e?.status ?? null });
  }
  const total = Object.values(per).reduce((t, r) => ({ jumlah: t.jumlah + r.jumlah, belum: t.belum + r.belum, konflik: t.konflik + r.konflik }), { jumlah: 0, belum: 0, konflik: 0 });
  return { per_jenis: per, total, belum };
};

rute.get(
  "/event",
  izin("READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const p = [f];
    const syarat = ["e.faskes_uuid = $1"];
    if (q.tahun) syarat.push(`e.tahun = $${p.push(Number(q.tahun) || 0)}`);
    if (q.bulan) syarat.push(`e.bulan = $${p.push(Number(q.bulan) || 0)}`);
    const status = cekPilihan(q.status || undefined, STATUS_EVENT, "status");
    if (status) syarat.push(`e.status = $${p.push(status)}`);
    if (q.jenis_event) {
      if (!JENIS_EVENT[q.jenis_event]) throw permintaanSalah("jenis_event tidak dikenal");
      syarat.push(`e.jenis_event = $${p.push(q.jenis_event)}`);
    }
    const pg = halaman(q);
    const where = syarat.join(" AND ");
    const total = (await satu(`SELECT COUNT(*)::int AS n FROM akuntansi_event e WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT e.uuid, e.jenis_event, e.kunci, e.sumber_tabel, e.sumber_uuid, e.sumber_nomor, e.tanggal, e.tahun, e.bulan, e.nilai, e.status, e.alasan,
              e.jurnal_uuid, j.nomor AS nomor_jurnal, e.percobaan, e.diproses_oleh, e.updated_at
         FROM akuntansi_event e LEFT JOIN akuntansi_jurnal j ON j.uuid = e.jurnal_uuid
        WHERE ${where} ORDER BY e.updated_at DESC, e.tanggal DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/event/:uuid/selesaikan",
  izin("KOREKSI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 1000);
    const hasil = await transaksi(async (k) => {
      const e = await satu(`SELECT * FROM akuntansi_event WHERE uuid = $1 AND faskes_uuid = $2 FOR UPDATE`, [req.params.uuid, f], k);
      if (!e) throw tidakDitemukan("Event");
      if (e.status !== "konflik" || !e.hash_terbaru) throw konflik("Hanya event berstatus konflik yang dapat diselesaikan");
      const baru = await satu(
        `UPDATE akuntansi_event SET status = 'dijurnal', hash_data = hash_terbaru, hash_terbaru = NULL, updated_at = $3,
           alasan = $4 WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [e.uuid, f, sekarang(), `Konflik diselesaikan oleh ${req.author.username ?? "-"}: ${alasan}`],
        k,
      );
      await audit(k, req, "ubah", "akuntansi_event", e.uuid, { kunci: e.kunci, status: ["konflik", "dijurnal"], alasan });
      return baru;
    });
    kirim(res, hasil, "Konflik ditandai selesai");
  }),
);

export default rute;
