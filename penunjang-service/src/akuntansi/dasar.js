import { query, satu, sisipkan, sekarang, uuidv7 } from "../db.js";
import { Galat, tangani, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { catatAuditPusat } from "../hr/audit.js";
import { AMBANG_TINGKAT_2_BAWAAN, dariSen, keSen, konflik, pastikanSeimbang, periodeDari } from "./bersama.js";

// Helper basis data bersama modul Akuntansi. Semua kueri disaring faskes_uuid dari token (KF-17); data faskes lain
// diperlakukan "tidak ditemukan".

// Galat PostgreSQL yang dikenal → 4xx (bukan 500): unik → 409, FK/format/CHECK → 400.
export const petakanGalatPg = (e, pesanUnik = "Data dengan kode yang sama sudah ada") => {
  if (e instanceof Galat || !e?.code) return e;
  if (e.code === "23505") return new Galat(409, pesanUnik);
  if (e.code === "23503") return new Galat(400, "Data rujukan tidak ditemukan");
  if (e.code === "23514") return new Galat(400, e.message?.startsWith("Jurnal") ? e.message : "Data melanggar aturan validasi");
  if (["22P02", "22003", "22007", "22008", "22001", "23502"].includes(e.code)) return new Galat(400, "Format data tidak valid");
  return e;
};
export const tanganiAkuntansi = (fn, pesanUnik) =>
  tangani(async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      throw petakanGalatPg(e, pesanUnik);
    }
  });

// Audit Trail pusat (STD-0029) — ditulis dalam transaksi yang sama; kegagalan audit tidak membatalkan transaksi.
export const audit = (k, req, aksi, entitas, entitasUuid, ringkasan) =>
  catatAuditPusat(k, {
    faskesUuid: req.author.faskesUuid,
    aksi,
    entitas,
    entitasUuid,
    ringkasan,
    pengguna: req.author.username,
    layanan: "penunjang-service/akuntansi",
  });

// Periode (tahun, bulan) faskes: dibuat bila belum ada lalu dikunci. `mode`: "share" (posting jurnal; banyak posting
// boleh berjalan bersamaan) atau "update" (tutup/buka periode) sehingga tutup buku dan posting saling menunggu.
export const kunciPeriode = async (k, f, tahun, bulan, mode = "share") => {
  await query(
    `INSERT INTO akuntansi_periode (uuid, faskes_uuid, tahun, bulan, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'terbuka', $5, $5)
     ON CONFLICT (faskes_uuid, tahun, bulan) WHERE deleted_at IS NULL DO NOTHING`,
    [uuidv7(), f, tahun, bulan, sekarang()],
    k,
  );
  return satu(
    `SELECT * FROM akuntansi_periode WHERE faskes_uuid = $1 AND tahun = $2 AND bulan = $3 AND deleted_at IS NULL FOR ${mode === "update" ? "UPDATE" : "SHARE"}`,
    [f, tahun, bulan],
    k,
  );
};
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const namaPeriode = (tahun, bulan) => `${NAMA_BULAN[bulan - 1]} ${tahun}`;
// Periode tanggal transaksi harus terbuka (KF-13/KT-9).
export const pastikanPeriodeTerbuka = async (k, f, tanggal) => {
  const { tahun, bulan } = periodeDari(tanggal);
  const p = await kunciPeriode(k, f, tahun, bulan, "share");
  if (p.status !== "terbuka") throw konflik(`Periode ${namaPeriode(tahun, bulan)} sudah ditutup; perubahan ditolak. Catat koreksi di periode terbuka.`);
  return p;
};

export const pengaturan = async (f, k) => {
  const r = await satu(`SELECT * FROM akuntansi_pengaturan WHERE faskes_uuid = $1`, [f], k);
  return { ambang_tingkat_2: r ? r.ambang_tingkat_2 : AMBANG_TINGKAT_2_BAWAAN, diatur: !!r, diubah_oleh: r?.diubah_oleh ?? null, updated_at: r?.updated_at ?? null };
};

// Akun rinci, aktif, milik faskes (validasi baris jurnal manual). 400 bila salah satu tidak memenuhi.
export const cekAkunJurnal = async (k, f, uuids) => {
  const unik = [...new Set(uuids)];
  const rows = await query(`SELECT uuid, kode, nama, jenis, aktif FROM akuntansi_akun WHERE faskes_uuid = $1 AND deleted_at IS NULL AND uuid = ANY($2::varchar[])`, [f, unik], k);
  const peta = new Map(rows.map((r) => [r.uuid, r]));
  for (const u of unik) {
    const a = peta.get(u);
    if (!a) throw permintaanSalah("Akun tidak ditemukan di faskes ini");
    if (a.jenis !== "rinci") throw permintaanSalah(`Akun ${a.kode} ${a.nama} adalah akun induk dan tidak dapat dijurnal`);
    if (!a.aktif) throw permintaanSalah(`Akun ${a.kode} ${a.nama} nonaktif`);
  }
  return peta;
};

const PREFIKS = { otomatis: "JO", manual: "JM", penyesuaian: "JP", koreksi: "JK" };

// Simpan jurnal + baris (sen) dalam transaksi `k`. Keseimbangan diperiksa sebelum menulis dan dihitung ulang dari
// database sesudahnya (selain constraint trigger saat COMMIT) — jurnal setengah jadi tidak mungkin tersimpan (KF-7).
export const simpanJurnal = async (k, f, header, baris) => {
  const total = pastikanSeimbang(baris);
  const { tahun, bulan } = periodeDari(header.tanggal);
  const n = sekarang();
  const jurnal = await sisipkan(
    "akuntansi_jurnal",
    {
      faskes_uuid: f,
      nomor: await nomorBaru(f, PREFIKS[header.jenis], k),
      tahun,
      bulan,
      total_debit: dariSen(total.debit),
      total_kredit: dariSen(total.kredit),
      ...header,
    },
    k,
  );
  for (const [i, b] of baris.entries()) {
    await query(
      `INSERT INTO akuntansi_jurnal_baris (uuid, faskes_uuid, jurnal_uuid, urutan, akun_uuid, debit, kredit, uraian, komponen, penjamin_uuid, supplier_uuid, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [uuidv7(), f, jurnal.uuid, i + 1, b.akun_uuid, dariSen(b.debit), dariSen(b.kredit), b.uraian ?? null, b.komponen ?? null, b.penjamin_uuid ?? null, b.supplier_uuid ?? null, n],
      k,
    );
  }
  const cek = await satu(`SELECT COALESCE(SUM(debit), 0) AS d, COALESCE(SUM(kredit), 0) AS k FROM akuntansi_jurnal_baris WHERE jurnal_uuid = $1`, [jurnal.uuid], k);
  if (keSen(cek.d) !== total.debit || keSen(cek.k) !== total.kredit) throw new Galat(500, "Pemeriksaan keseimbangan jurnal gagal");
  return jurnal;
};

export const ambilJurnal = async (k, f, uuid, kunci = false) => {
  const j = await satu(`SELECT * FROM akuntansi_jurnal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, [String(uuid ?? ""), f], k);
  if (!j) throw tidakDitemukan("Jurnal");
  return j;
};
export const barisJurnal = (k, f, jurnalUuid) =>
  query(
    `SELECT b.*, a.kode AS kode_akun, a.nama AS nama_akun, pj.name AS nama_penjamin, s.name AS nama_supplier
       FROM akuntansi_jurnal_baris b JOIN akuntansi_akun a ON a.uuid = b.akun_uuid
       LEFT JOIN penjamin pj ON pj.uuid = b.penjamin_uuid AND pj.faskes_uuid = b.faskes_uuid
       LEFT JOIN master_supplier s ON s.uuid = b.supplier_uuid AND s.faskes_uuid = b.faskes_uuid
      WHERE b.jurnal_uuid = $1 AND b.faskes_uuid = $2 ORDER BY b.urutan`,
    [jurnalUuid, f],
    k,
  );

// Saldo per akun (sen) untuk jurnal final dalam rentang tanggal [dari, sampai] (dari = null → sejak awal).
export const saldoAkun = async (f, dari, sampai, k) => {
  const rows = await query(
    `WITH m AS (
       SELECT b.akun_uuid, SUM(b.debit) AS d, SUM(b.kredit) AS k
         FROM akuntansi_jurnal_baris b JOIN akuntansi_jurnal j ON j.uuid = b.jurnal_uuid
        WHERE j.faskes_uuid = $1 AND j.status = 'final' AND j.deleted_at IS NULL AND ($2::bigint IS NULL OR j.tanggal >= $2) AND j.tanggal <= $3
        GROUP BY b.akun_uuid
     )
     SELECT a.uuid, a.kode, a.nama, a.kelompok, a.saldo_normal, a.klasifikasi, a.jenis, a.induk_uuid, a.aktif, a.kas_setara_kas, a.arus_kas,
            a.buku_pembantu, COALESCE(m.d, 0) AS d, COALESCE(m.k, 0) AS k
       FROM akuntansi_akun a LEFT JOIN m ON m.akun_uuid = a.uuid
      WHERE a.faskes_uuid = $1 AND a.deleted_at IS NULL
      ORDER BY a.kode`,
    [f, dari, sampai],
    k,
  );
  return rows.map((r) => ({ ...r, debit: keSen(r.d), kredit: keSen(r.k) }));
};
