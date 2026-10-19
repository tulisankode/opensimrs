import express from "express";
import { query, satu, sisipkan, sekarang, transaksi, uuidv7 } from "../../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { punyaIzin, galatIzin, wajibIzin } from "../../umum/izin.js";
import { cekPilihan, dariSen, keSen, konflik, periodeWajib, rentangPeriode, tanggalWajib, teks, teksWajib } from "../bersama.js";
import { namaPeriode, tanganiAkuntansi } from "../dasar.js";
import { susunBayarJaspel, susunJaspel } from "../event.js";
import { jurnalkanEvent, muatAturan } from "../proses.js";
import {
  METODE_BAYAR,
  MODUL_IZIN,
  STATUS_PERIODE,
  STATUS_SUMBER,
  SUB,
  angkaKonfigurasi,
  angkaSenti,
  cekPemisahanTugas,
  hashMasukan,
  hitungRemunerasi,
  pastikanStatus,
  tanggalAkhirPeriode,
} from "./bersama.js";
import { ambilSumber } from "./sumber.js";
import { ambilPeriode, audit, izinSalahSatu, muatPenerima, praktisi, sisipkanBanyak } from "./dasar.js";

// Periode remunerasi bulanan (KF-3..KF-10, KF-12). Alur: draf → hitung → verifikasi → setujui → dibayar.
//   GET  /periode?tahun=                       daftar periode
//   POST /periode                              { tahun, bulan, catatan? }                  izin Periode › CREATE
//   GET  /periode/:uuid                        detail: ringkasan, rincian penerima, pengecualian, kinerja, koreksi
//   GET  /periode/:uuid/sumber?status=&pelaksana=   item dasar (tanpa identitas pasien)
//   POST /periode/:uuid/hitung                 hitung dari tagihan lunas bulan itu (idempoten)  Periode › HITUNG
//   PUT  /periode/:uuid/kinerja                { data: [{ practitioner_uuid, nilai (%), catatan? }] }  Periode › UPDATE
//   POST /periode/:uuid/koreksi                { practitioner_uuid, nilai (±), alasan, rujukan_periode_uuid? }  KOREKSI
//   POST /periode/:uuid/koreksi/:k/hapus       { alasan }                                  Periode › KOREKSI
//   POST /periode/:uuid/pengecualian           { bill_item_uuid, tindakan: tetapkan|abaikan|batal, practitioner_uuid?, alasan }
//   POST /periode/:uuid/verifikasi             { catatan? }   Verifikasi › VALIDASI (verifikator ≠ penghitung)
//   POST /periode/:uuid/kembalikan             { alasan }     dihitung: Verifikasi › KEMBALIKAN; diverifikasi: Persetujuan › TOLAK
//   POST /periode/:uuid/setujui                { catatan? }   Persetujuan › SETUJUI (≠ penghitung & verifikator) + jurnal jaspel
//   POST /periode/:uuid/bayar                  { tanggal_bayar, metode_bayar, referensi_bayar? }  Pembayaran › BAYAR + jurnal
// Perubahan kinerja/koreksi/pengecualian mengembalikan periode "dihitung" ke "draf" (wajib hitung ulang). Verifikasi
// & persetujuan menghitung ulang hash masukan: bila data sumber/konfigurasi berubah sejak dihitung → 409 (hitung ulang).
// Koreksi atas periode yang sudah disetujui/dibayar dicatat di periode draf berikutnya (rujukan_periode_uuid), beralasan.
const rute = express.Router();
const izin = (sub, aksi) => wajibIzin(MODUL_IZIN, sub, aksi);
const BACA = [
  [SUB.periode, "READ"],
  [SUB.verifikasi, "READ"],
  [SUB.persetujuan, "READ"],
  [SUB.pembayaran, "READ"],
];
const pengguna = (req) => req.author.username ?? null;

// Skema disahkan yang berlaku untuk periode (berlaku_mulai ≤ awal bulan; versi terbaru).
const pilihSkema = async (k, f, tahun, bulan) => {
  const s = await satu(
    `SELECT * FROM remunerasi_skema WHERE faskes_uuid = $1 AND status = 'disahkan' AND deleted_at IS NULL AND berlaku_mulai <= $2
      ORDER BY berlaku_mulai DESC, versi DESC LIMIT 1`,
    [f, rentangPeriode(tahun, bulan).awal],
    k,
  );
  if (!s) throw konflik(`Belum ada skema jaspel yang disahkan dan berlaku untuk ${namaPeriode(tahun, bulan)}. Sahkan skema di Konfigurasi Remunerasi.`);
  return s;
};

// Kumpulkan seluruh masukan perhitungan periode (di dalam transaksi `k`) lalu hitung (fungsi murni).
export const siapkanHitung = async (k, f, periode) => {
  const skema = await pilihSkema(k, f, periode.tahun, periode.bulan);
  const sumber = await ambilSumber(k, f, periode.tahun, periode.bulan);
  const lain = sumber.length
    ? await query(
        `SELECT DISTINCT s.bill_item_uuid FROM remunerasi_sumber s JOIN remunerasi_periode p ON p.uuid = s.periode_uuid
          WHERE s.faskes_uuid = $1 AND s.periode_uuid <> $2 AND p.deleted_at IS NULL AND p.status IN ('disetujui', 'dibayar')
            AND s.status = 'dihitung' AND s.bill_item_uuid = ANY($3::varchar[])`,
        [f, periode.uuid, sumber.map((s) => s.bill_item_uuid)],
        k,
      )
    : [];
  const sudah = new Set(lain.map((r) => r.bill_item_uuid));
  for (const s of sumber) s.periode_lain = sudah.has(s.bill_item_uuid);
  const penerima = await muatPenerima(k, f);
  const kinerja = new Map(
    (await query(`SELECT practitioner_uuid, nilai_bp FROM remunerasi_kinerja WHERE periode_uuid = $1 AND faskes_uuid = $2`, [periode.uuid, f], k)).map((r) => [r.practitioner_uuid, Number(r.nilai_bp)]),
  );
  const koreksi = (await query(`SELECT uuid, practitioner_uuid, nilai FROM remunerasi_koreksi WHERE periode_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [periode.uuid, f], k)).map((r) => ({
    uuid: r.uuid,
    practitioner_uuid: r.practitioner_uuid,
    nilai: keSen(r.nilai),
  }));
  const penyelesaian = new Map(
    (await query(`SELECT bill_item_uuid, tindakan, practitioner_uuid, alasan FROM remunerasi_penyelesaian WHERE periode_uuid = $1 AND faskes_uuid = $2`, [periode.uuid, f], k)).map((r) => [r.bill_item_uuid, r]),
  );
  const hash = hashMasukan({ skema, sumber, penerima, kinerja, koreksi, penyelesaian });
  const hasil = hitungRemunerasi({ sumber, konf: angkaKonfigurasi(skema.konfigurasi), penerima, kinerja, koreksi, penyelesaian });
  return { skema, hash, hasil };
};

const nomorPeriode = (tahun, bulan) => `JASPEL-${tahun}-${String(bulan).padStart(2, "0")}`;
const jumlahPengecualian = (hasil) => hasil.ringkasan.jumlah_status.pengecualian + hasil.pengecualian.filter((p) => p.kode !== "sumber_pengecualian").length;

// Pastikan masukan tidak berubah sejak dihitung (verifikasi/persetujuan).
const pastikanTidakBerubah = async (k, f, p) => {
  const s = await siapkanHitung(k, f, p);
  if (s.hash !== p.hash_hitung) throw konflik("Data sumber atau konfigurasi berubah sejak periode dihitung. Kembalikan periode lalu hitung ulang.");
  return s;
};

rute.get(
  "/periode",
  izinSalahSatu(...BACA, [SUB.rekap, "READ"]),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const p = [f];
    let syarat = "";
    if (req.query.tahun) syarat += ` AND tahun = $${p.push(Number(req.query.tahun) || 0)}`;
    const status = cekPilihan(req.query.status || undefined, STATUS_PERIODE, "status");
    if (status) syarat += ` AND status = $${p.push(status)}`;
    const rows = await query(
      `SELECT uuid, nomor, tahun, bulan, status, skema_versi, total_dasar, total_jaspel, total_langsung, total_kebersamaan, total_koreksi, total,
              jumlah_penerima, jumlah_pengecualian, dibuat_oleh, dihitung_oleh, dihitung_pada, diverifikasi_oleh, diverifikasi_pada,
              disetujui_oleh, disetujui_pada, dibayar_oleh, dibayar_pada, tanggal_bayar, dikembalikan_oleh, dikembalikan_pada, alasan_kembali, created_at
         FROM remunerasi_periode WHERE faskes_uuid = $1 AND deleted_at IS NULL${syarat} ORDER BY tahun DESC, bulan DESC`,
      p,
    );
    kirim(res, rows.map((r) => ({ ...r, nama: namaPeriode(r.tahun, r.bulan) })));
  }),
);

rute.post(
  "/periode",
  izin(SUB.periode, "CREATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const { tahun, bulan } = periodeWajib(req.body);
    if (rentangPeriode(tahun, bulan).awal > sekarang()) throw permintaanSalah("Periode belum dimulai");
    const catatan = teks(req.body?.catatan, "catatan", 1000) ?? null;
    const baru = await transaksi(async (k) => {
      const row = await sisipkan("remunerasi_periode", { faskes_uuid: f, nomor: nomorPeriode(tahun, bulan), tahun, bulan, status: "draf", catatan, dibuat_oleh: pengguna(req) }, k);
      await audit(k, req, "buat", "remunerasi_periode", row.uuid, { periode: namaPeriode(tahun, bulan) });
      return row;
    }).catch((e) => {
      throw e?.code === "23505" ? konflik(`Periode remunerasi ${namaPeriode(tahun, bulan)} sudah ada`) : e;
    });
    kirim(res, baru, `Periode ${namaPeriode(tahun, bulan)} dibuat`);
  }),
);

rute.get(
  "/periode/:uuid",
  izinSalahSatu(...BACA),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const p = await ambilPeriode(undefined, f, req.params.uuid);
    const [skema, rincian, kinerja, koreksi, penyelesaian, pengecualian, jurnal] = await Promise.all([
      p.skema_uuid ? satu(`SELECT uuid, versi, nama, berlaku_mulai, contoh, konfigurasi, dasar_pengesahan, disahkan_oleh, disahkan_pada FROM remunerasi_skema WHERE uuid = $1 AND faskes_uuid = $2`, [p.skema_uuid, f]) : null,
      query(`SELECT * FROM remunerasi_rincian WHERE periode_uuid = $1 AND faskes_uuid = $2 ORDER BY total DESC, nama`, [p.uuid, f]),
      query(`SELECT practitioner_uuid, nilai_bp, catatan, diisi_oleh, updated_at FROM remunerasi_kinerja WHERE periode_uuid = $1 AND faskes_uuid = $2`, [p.uuid, f]),
      query(
        `SELECT k.*, r.nomor AS nomor_rujukan FROM remunerasi_koreksi k LEFT JOIN remunerasi_periode r ON r.uuid = k.rujukan_periode_uuid
          WHERE k.periode_uuid = $1 AND k.faskes_uuid = $2 ORDER BY k.created_at`,
        [p.uuid, f],
      ),
      query(`SELECT * FROM remunerasi_penyelesaian WHERE periode_uuid = $1 AND faskes_uuid = $2 ORDER BY created_at`, [p.uuid, f]),
      query(
        `SELECT uuid, bill_item_uuid, invoice_code, no_reg, jenis_layanan, kategori, nama_item, tanggal_layanan, tanggal_lunas, nilai, jaspel, practitioner_uuid, pelaksana_uuid, alasan
           FROM remunerasi_sumber WHERE periode_uuid = $1 AND faskes_uuid = $2 AND status = 'pengecualian' ORDER BY tanggal_lunas, bill_item_uuid LIMIT 500`,
        [p.uuid, f],
      ),
      p.jurnal_uuid || p.jurnal_bayar_uuid
        ? query(`SELECT uuid, nomor, tanggal, total_debit, jenis_event FROM akuntansi_jurnal WHERE faskes_uuid = $1 AND uuid = ANY($2::varchar[])`, [f, [p.jurnal_uuid, p.jurnal_bayar_uuid].filter(Boolean)])
        : [],
    ]);
    kirim(res, { ...p, nama: namaPeriode(p.tahun, p.bulan), skema, rincian, kinerja, koreksi, penyelesaian, pengecualian, jurnal, status_sumber: STATUS_SUMBER });
  }),
);

rute.get(
  "/periode/:uuid/sumber",
  izinSalahSatu(...BACA),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const p = await ambilPeriode(undefined, f, req.params.uuid);
    const q = req.query;
    const par = [p.uuid, f];
    let syarat = "";
    const status = cekPilihan(q.status || undefined, STATUS_SUMBER, "status");
    if (status) syarat += ` AND status = $${par.push(status)}`;
    if (q.pelaksana) syarat += ` AND pelaksana_uuid = $${par.push(String(q.pelaksana))}`;
    const pg = halaman(q);
    const total = (await satu(`SELECT COUNT(*)::int AS n FROM remunerasi_sumber WHERE periode_uuid = $1 AND faskes_uuid = $2${syarat}`, par)).n;
    const rows = await query(
      `SELECT uuid, bill_item_uuid, invoice_code, no_reg, jenis_layanan, kategori, nama_item, tanggal_layanan, tanggal_lunas, nilai, persen_bp, jaspel,
              langsung, kebersamaan, practitioner_uuid, pelaksana_uuid, status, alasan
         FROM remunerasi_sumber WHERE periode_uuid = $1 AND faskes_uuid = $2${syarat}
        ORDER BY tanggal_lunas, bill_item_uuid LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      par,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/periode/:uuid/hitung",
  izin(SUB.periode, "HITUNG"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "hitung");
      const { skema, hash, hasil } = await siapkanHitung(k, f, p);
      // Idempoten: masukan sama dengan hitungan terakhir → hasil tidak ditulis ulang.
      if (p.status === "dihitung" && p.hash_hitung === hash) return { periode: p, berubah: false };
      await query(`DELETE FROM remunerasi_sumber WHERE periode_uuid = $1 AND faskes_uuid = $2`, [p.uuid, f], k);
      await query(`DELETE FROM remunerasi_rincian WHERE periode_uuid = $1 AND faskes_uuid = $2`, [p.uuid, f], k);
      const n = sekarang();
      await sisipkanBanyak(
        k,
        "remunerasi_sumber",
        ["uuid", "faskes_uuid", "periode_uuid", "bill_item_uuid", "bill_uuid", "induk_uuid", "service_bill_uuid", "invoice_code", "no_reg", "patient_uuid", "jenis_layanan", "kategori", "nama_item", "tanggal_layanan", "tanggal_lunas", "nilai", "persen_bp", "jaspel", "langsung", "kebersamaan", "practitioner_uuid", "pelaksana_uuid", "status", "alasan", "created_at"],
        hasil.sumber.map((s) => ({
          ...s,
          uuid: uuidv7(),
          faskes_uuid: f,
          periode_uuid: p.uuid,
          nama_item: String(s.nama_item ?? "").slice(0, 255),
          nilai: dariSen(s.nilai),
          jaspel: dariSen(s.jaspel),
          langsung: dariSen(s.langsung),
          kebersamaan: dariSen(s.kebersamaan),
          created_at: n,
        })),
      );
      await sisipkanBanyak(
        k,
        "remunerasi_rincian",
        ["uuid", "faskes_uuid", "periode_uuid", "practitioner_uuid", "nama", "profesi", "unit", "jumlah_layanan", "nilai_dasar", "langsung", "kebersamaan", "koreksi", "total", "rumus", "created_at"],
        hasil.rincian.map((r) => ({
          ...r,
          uuid: uuidv7(),
          faskes_uuid: f,
          periode_uuid: p.uuid,
          nilai_dasar: dariSen(r.nilai_dasar),
          langsung: dariSen(r.langsung),
          kebersamaan: dariSen(r.kebersamaan),
          koreksi: dariSen(r.koreksi),
          total: dariSen(r.total),
          created_at: n,
        })),
      );
      const g = hasil.ringkasan;
      const ringkasan = { ...g, pengecualian: hasil.pengecualian, skema: { uuid: skema.uuid, versi: skema.versi, contoh: skema.contoh } };
      for (const c of ["total_dasar", "total_jaspel", "total_langsung", "total_kebersamaan", "pool", "total_koreksi", "total"]) ringkasan[c] = dariSen(g[c]);
      const baru = await satu(
        `UPDATE remunerasi_periode SET status = 'dihitung', skema_uuid = $3, skema_versi = $4, hash_hitung = $5, ringkasan = $6,
           total_dasar = $7, total_jaspel = $8, total_langsung = $9, total_kebersamaan = $10, total_koreksi = $11, total = $12,
           jumlah_penerima = $13, jumlah_pengecualian = $14, dihitung_oleh = $15, dihitung_pada = $16, updated_at = $16
          WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [p.uuid, f, skema.uuid, skema.versi, hash, JSON.stringify(ringkasan), ringkasan.total_dasar, ringkasan.total_jaspel, ringkasan.total_langsung, ringkasan.total_kebersamaan, ringkasan.total_koreksi, ringkasan.total, g.jumlah_penerima, jumlahPengecualian(hasil), pengguna(req), n],
        k,
      );
      await audit(k, req, "ubah", "remunerasi_periode", p.uuid, { aksi: "hitung", periode: p.nomor, skema_versi: skema.versi, hash, total: ringkasan.total, jumlah_penerima: g.jumlah_penerima, pengecualian: baru.jumlah_pengecualian });
      return { periode: baru, berubah: true };
    });
    kirim(res, hasil, hasil.berubah ? "Periode dihitung" : "Data tidak berubah sejak perhitungan terakhir");
  }),
);

// Ubah masukan periode (kinerja/koreksi/pengecualian) → status kembali draf bila sudah dihitung.
const keDraf = (k, f, p) =>
  p.status === "dihitung" ? query(`UPDATE remunerasi_periode SET status = 'draf', updated_at = $3 WHERE uuid = $1 AND faskes_uuid = $2`, [p.uuid, f, sekarang()], k) : null;

const penerimaTerdaftar = async (k, f, practitionerUuid) => {
  const r = await satu(`SELECT uuid FROM remunerasi_penerima WHERE faskes_uuid = $1 AND practitioner_uuid = $2 AND deleted_at IS NULL`, [f, String(practitionerUuid ?? "")], k);
  if (!r) throw permintaanSalah("Praktisi belum terdaftar sebagai penerima remunerasi");
  return r;
};

rute.put(
  "/periode/:uuid/kinerja",
  izin(SUB.periode, "UPDATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const data = req.body?.data;
    if (!Array.isArray(data) || !data.length || data.length > 2000) throw permintaanSalah("data kinerja wajib berupa daftar (1–2000 penerima)");
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "ubah");
      const skema = await pilihSkema(k, f, p.tahun, p.bulan);
      const { kinerja_min_bp: min, kinerja_maks_bp: maks } = angkaKonfigurasi(skema.konfigurasi);
      const n = sekarang();
      const perubahan = [];
      for (const [i, d] of data.entries()) {
        await penerimaTerdaftar(k, f, d?.practitioner_uuid);
        const bp = angkaSenti(d?.nilai, `data ${i + 1}: nilai kinerja (%)`, 5 * 10000);
        if (bp < min || bp > maks) throw permintaanSalah(`data ${i + 1}: nilai kinerja harus ${dariSen(min)}–${dariSen(maks)}% (skema versi ${skema.versi})`);
        const catatan = teks(d?.catatan, `data ${i + 1}: catatan`, 500) ?? null;
        const lama = await satu(`SELECT nilai_bp FROM remunerasi_kinerja WHERE periode_uuid = $1 AND practitioner_uuid = $2`, [p.uuid, d.practitioner_uuid], k);
        await query(
          `INSERT INTO remunerasi_kinerja (uuid, faskes_uuid, periode_uuid, practitioner_uuid, nilai_bp, catatan, diisi_oleh, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
           ON CONFLICT (periode_uuid, practitioner_uuid) DO UPDATE SET nilai_bp = EXCLUDED.nilai_bp, catatan = EXCLUDED.catatan, diisi_oleh = EXCLUDED.diisi_oleh, updated_at = EXCLUDED.updated_at`,
          [uuidv7(), f, p.uuid, d.practitioner_uuid, bp, catatan, pengguna(req), n],
          k,
        );
        if (Number(lama?.nilai_bp ?? 10000) !== bp) perubahan.push({ practitioner_uuid: d.practitioner_uuid, sebelum: dariSen(lama?.nilai_bp ?? 10000), sesudah: dariSen(bp) });
      }
      await keDraf(k, f, p);
      await audit(k, req, "ubah", "remunerasi_kinerja", p.uuid, { periode: p.nomor, perubahan });
      return { jumlah: data.length, berubah: perubahan.length };
    });
    kirim(res, hasil, "Capaian kinerja disimpan");
  }),
);

rute.post(
  "/periode/:uuid/koreksi",
  izin(SUB.periode, "KOREKSI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const alasan = teksWajib(b.alasan, "alasan", 1000);
    const t = String(b.nilai ?? "").trim();
    const negatif = t.startsWith("-");
    const nilai = (negatif ? -1 : 1) * angkaSenti(negatif ? t.slice(1) : t, "nilai koreksi", 1e15);
    if (!nilai) throw permintaanSalah("nilai koreksi tidak boleh nol");
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "ubah");
      const pr = await praktisi(k, f, b.practitioner_uuid);
      if (!pr) throw permintaanSalah("Praktisi tidak ditemukan di faskes ini");
      await penerimaTerdaftar(k, f, pr.uuid);
      let rujukan = null;
      if (b.rujukan_periode_uuid) {
        rujukan = await ambilPeriode(k, f, b.rujukan_periode_uuid);
        if (!["disetujui", "dibayar"].includes(rujukan.status)) throw permintaanSalah("Periode rujukan koreksi harus sudah disetujui/dibayar");
        if (rujukan.tahun * 12 + rujukan.bulan >= p.tahun * 12 + p.bulan) throw permintaanSalah("Periode rujukan harus sebelum periode ini");
      }
      const row = await sisipkan("remunerasi_koreksi", { faskes_uuid: f, periode_uuid: p.uuid, practitioner_uuid: pr.uuid, nilai: dariSen(nilai), alasan, rujukan_periode_uuid: rujukan?.uuid ?? null, dibuat_oleh: pengguna(req) }, k);
      await keDraf(k, f, p);
      await audit(k, req, "buat", "remunerasi_koreksi", row.uuid, { periode: p.nomor, praktisi: pr.nama, nilai: row.nilai, alasan, rujukan: rujukan?.nomor ?? null });
      return row;
    });
    kirim(res, hasil, "Koreksi dicatat; hitung ulang periode");
  }),
);

rute.post(
  "/periode/:uuid/koreksi/:koreksi/hapus",
  izin(SUB.periode, "KOREKSI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 1000);
    await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "ubah");
      const kor = await satu(`SELECT * FROM remunerasi_koreksi WHERE uuid = $1 AND periode_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL FOR UPDATE`, [req.params.koreksi, p.uuid, f], k);
      if (!kor) throw tidakDitemukan("Koreksi");
      await query(`UPDATE remunerasi_koreksi SET deleted_at = $2, updated_at = $2, dihapus_oleh = $3, alasan_hapus = $4 WHERE uuid = $1`, [kor.uuid, sekarang(), pengguna(req), alasan], k);
      await keDraf(k, f, p);
      await audit(k, req, "hapus", "remunerasi_koreksi", kor.uuid, { periode: p.nomor, nilai: kor.nilai, alasan });
    });
    kirim(res, null, "Koreksi dihapus; hitung ulang periode");
  }),
);

rute.post(
  "/periode/:uuid/pengecualian",
  izin(SUB.periode, "KOREKSI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const tindakan = String(b.tindakan ?? "");
    if (!["tetapkan", "abaikan", "batal"].includes(tindakan)) throw permintaanSalah("tindakan harus tetapkan, abaikan, atau batal");
    const alasan = teksWajib(b.alasan, "alasan", 1000);
    const item = teksWajib(b.bill_item_uuid, "bill_item_uuid", 255);
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "ubah");
      const s = await satu(`SELECT bill_item_uuid, status, practitioner_uuid FROM remunerasi_sumber WHERE periode_uuid = $1 AND faskes_uuid = $2 AND bill_item_uuid = $3`, [p.uuid, f, item], k);
      if (!s) throw tidakDitemukan("Item sumber pada periode ini");
      const lama = await satu(`SELECT * FROM remunerasi_penyelesaian WHERE periode_uuid = $1 AND bill_item_uuid = $2 FOR UPDATE`, [p.uuid, item], k);
      let pr = null;
      if (tindakan === "batal") {
        if (!lama) throw konflik("Item ini belum memiliki penyelesaian");
        await query(`DELETE FROM remunerasi_penyelesaian WHERE uuid = $1`, [lama.uuid], k);
      } else {
        if (!["pengecualian", "diabaikan", "dihitung"].includes(s.status)) throw konflik(`Item berstatus ${STATUS_SUMBER[s.status] ?? s.status} tidak dapat diubah lewat penyelesaian pengecualian`);
        if (tindakan === "tetapkan") {
          pr = await praktisi(k, f, b.practitioner_uuid);
          if (!pr) throw permintaanSalah("Praktisi tidak ditemukan di faskes ini");
          await penerimaTerdaftar(k, f, pr.uuid);
        }
        await query(
          `INSERT INTO remunerasi_penyelesaian (uuid, faskes_uuid, periode_uuid, bill_item_uuid, tindakan, practitioner_uuid, alasan, dibuat_oleh, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
           ON CONFLICT (periode_uuid, bill_item_uuid) DO UPDATE SET tindakan = EXCLUDED.tindakan, practitioner_uuid = EXCLUDED.practitioner_uuid,
             alasan = EXCLUDED.alasan, dibuat_oleh = EXCLUDED.dibuat_oleh, updated_at = EXCLUDED.updated_at`,
          [uuidv7(), f, p.uuid, item, tindakan, pr?.uuid ?? null, alasan, pengguna(req), sekarang()],
          k,
        );
      }
      await keDraf(k, f, p);
      await audit(k, req, "ubah", "remunerasi_penyelesaian", p.uuid, {
        periode: p.nomor,
        bill_item_uuid: item,
        tindakan,
        penerima: pr?.nama ?? null,
        sebelum: lama ? { tindakan: lama.tindakan, practitioner_uuid: lama.practitioner_uuid } : null,
        alasan,
      });
      return { bill_item_uuid: item, tindakan };
    });
    kirim(res, hasil, "Penanganan pengecualian disimpan; hitung ulang periode");
  }),
);

rute.post(
  "/periode/:uuid/verifikasi",
  izin(SUB.verifikasi, "VALIDASI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const catatan = teks(req.body?.catatan, "catatan", 1000) ?? null;
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "verifikasi");
      cekPemisahanTugas(p, pengguna(req), "verifikasi");
      if (p.jumlah_pengecualian > 0) throw konflik(`Masih ada ${p.jumlah_pengecualian} pengecualian yang wajib ditangani sebelum verifikasi`);
      await pastikanTidakBerubah(k, f, p);
      const baru = await satu(
        `UPDATE remunerasi_periode SET status = 'diverifikasi', diverifikasi_oleh = $3, diverifikasi_pada = $4, catatan_verifikasi = $5, updated_at = $4
          WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [p.uuid, f, pengguna(req), sekarang(), catatan],
        k,
      );
      await audit(k, req, "ubah", "remunerasi_periode", p.uuid, { periode: p.nomor, status: ["dihitung", "diverifikasi"], catatan, total: p.total });
      return baru;
    });
    kirim(res, hasil, "Periode diverifikasi");
  }),
);

rute.post(
  "/periode/:uuid/kembalikan",
  izinSalahSatu([SUB.verifikasi, "KEMBALIKAN"], [SUB.persetujuan, "TOLAK"]),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 1000);
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "kembalikan");
      const [sub, aksi] = p.status === "dihitung" ? [SUB.verifikasi, "KEMBALIKAN"] : [SUB.persetujuan, "TOLAK"];
      if (!(await punyaIzin(req, MODUL_IZIN, sub, aksi))) throw galatIzin(MODUL_IZIN, sub, aksi);
      const baru = await satu(
        `UPDATE remunerasi_periode SET status = 'draf', diverifikasi_oleh = NULL, diverifikasi_pada = NULL, dikembalikan_oleh = $3, dikembalikan_pada = $4,
           alasan_kembali = $5, updated_at = $4 WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [p.uuid, f, pengguna(req), sekarang(), alasan],
        k,
      );
      await audit(k, req, "ubah", "remunerasi_periode", p.uuid, { periode: p.nomor, status: [p.status, "draf"], aksi: p.status === "dihitung" ? "dikembalikan verifikator" : "ditolak penyetuju", alasan });
      return baru;
    });
    kirim(res, hasil, "Periode dikembalikan ke draf");
  }),
);

rute.post(
  "/periode/:uuid/setujui",
  izin(SUB.persetujuan, "SETUJUI"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const catatan = teks(req.body?.catatan, "catatan", 1000) ?? null;
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "setujui");
      cekPemisahanTugas(p, pengguna(req), "setujui");
      // Satu persetujuan per faskes pada satu waktu: item tagihan tidak boleh lolos ke dua periode yang disetujui bersamaan.
      await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`remunerasi-setujui:${f}`]);
      await pastikanTidakBerubah(k, f, p);
      // Jurnal beban jaspel / utang jaspel (Akuntansi) di transaksi yang sama; kunci idempoten jaspel:<uuid periode>.
      const ev = susunJaspel({ uuid: p.uuid, nomor: p.nomor, tanggal: tanggalAkhirPeriode(p.tahun, p.bulan), total: p.total, hash_hitung: p.hash_hitung });
      const aturan = (await muatAturan(f, k)).jaspel ?? [];
      const j = await jurnalkanEvent(k, f, ev, { aturan, pengguna: pengguna(req) });
      if (j.hasil === "tertahan" || j.hasil === "konflik") throw konflik(`Jurnal jasa pelayanan tidak dapat dibuat: ${j.alasan ?? "event konflik dengan jurnal sebelumnya"}`);
      const baru = await satu(
        `UPDATE remunerasi_periode SET status = 'disetujui', disetujui_oleh = $3, disetujui_pada = $4, catatan_persetujuan = $5, jurnal_uuid = $6, updated_at = $4
          WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [p.uuid, f, pengguna(req), sekarang(), catatan, j.jurnal_uuid ?? null],
        k,
      );
      await audit(k, req, "ubah", "remunerasi_periode", p.uuid, { periode: p.nomor, status: ["diverifikasi", "disetujui"], total: p.total, hash: p.hash_hitung, jurnal: j.nomor ?? j.jurnal_uuid ?? j.hasil, catatan });
      return { ...baru, jurnal: j };
    });
    kirim(res, hasil, "Periode disetujui dan dijurnal");
  }),
);

rute.post(
  "/periode/:uuid/bayar",
  izin(SUB.pembayaran, "BAYAR"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const tanggal = tanggalWajib(b.tanggal_bayar, "tanggal_bayar");
    const metode = String(b.metode_bayar ?? "TRANSFER").toUpperCase();
    if (!METODE_BAYAR[metode]) throw permintaanSalah(`metode_bayar harus salah satu dari ${Object.keys(METODE_BAYAR).join(", ")}`);
    const referensi = teks(b.referensi_bayar, "referensi_bayar", 255) ?? null;
    const hasil = await transaksi(async (k) => {
      const p = await ambilPeriode(k, f, req.params.uuid, true);
      pastikanStatus(p, "bayar");
      if (tanggal < rentangPeriode(p.tahun, p.bulan).awal) throw permintaanSalah("tanggal_bayar tidak boleh sebelum awal periode");
      if (tanggal > sekarang()) throw permintaanSalah("tanggal_bayar tidak boleh di masa depan");
      const ev = susunBayarJaspel({ uuid: p.uuid, nomor: p.nomor, tanggal_bayar: tanggal, total: p.total, metode_bayar: metode, referensi_bayar: referensi });
      const aturan = (await muatAturan(f, k)).jaspel_bayar ?? [];
      const j = await jurnalkanEvent(k, f, ev, { aturan, pengguna: pengguna(req) });
      if (j.hasil === "tertahan" || j.hasil === "konflik") throw konflik(`Jurnal pembayaran jasa pelayanan tidak dapat dibuat: ${j.alasan ?? "event konflik dengan jurnal sebelumnya"}`);
      const baru = await satu(
        `UPDATE remunerasi_periode SET status = 'dibayar', dibayar_oleh = $3, dibayar_pada = $4, tanggal_bayar = $5, metode_bayar = $6, referensi_bayar = $7,
           jurnal_bayar_uuid = $8, updated_at = $4 WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [p.uuid, f, pengguna(req), sekarang(), tanggal, metode, referensi, j.jurnal_uuid ?? null],
        k,
      );
      await audit(k, req, "ubah", "remunerasi_periode", p.uuid, { periode: p.nomor, status: ["disetujui", "dibayar"], total: p.total, tanggal_bayar: tanggal, metode, referensi, jurnal: j.nomor ?? j.jurnal_uuid ?? j.hasil });
      return { ...baru, jurnal: j };
    });
    kirim(res, hasil, "Pembayaran jasa pelayanan dicatat dan dijurnal");
  }),
);

export default rute;
