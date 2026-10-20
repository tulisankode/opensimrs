import { query, satu } from "../../db.js";
import { ambilHasilPenggajian } from "../../akuntansi/remunerasi/penggajian.js";
import { ambil } from "./dasar.js";
import { berlaku, konflik, hash, rentang } from "./bersama.js";
import { uang, sen, hitungAturan } from "./perhitungan.js";

export const muatSumber = async (k, f, p) => {
  const c = await ambil(k, f, "hr_gaji_konfigurasi", p.konfigurasi_uuid);
  const { awal, akhir } = rentang(p.tahun, p.bulan);
  if (c.status !== "disahkan" || Number(c.berlaku_mulai) > awal || c.berlaku_sampai != null && Number(c.berlaku_sampai) < akhir) throw konflik("Konfigurasi harus disahkan dan berlaku sepanjang periode");
  // Pembacaan ketat dalam transaksi: kegagalan katalog tidak dianggap sebagai fitur yang tidak tersedia.
  const kehadiran = await satu(`SELECT tersedia FROM ref_fitur WHERE kode = 'sdm_kehadiran'`, [], k);
  if (!kehadiran) throw konflik("Status ketersediaan Kehadiran tidak dapat dipastikan");
  if (kehadiran.tersedia) throw konflik("Kehadiran telah tersedia tetapi belum memiliki kontrak masukan penggajian; adaptor resmi perlu ditinjau");
  if (c.kebijakan.kehadiran_tidak_digunakan !== true) throw konflik("Kebijakan melewati Kehadiran belum disahkan");
  const acuan = c.kebijakan.tanggal_acuan === "awal_bulan" ? awal : akhir - 1;
  const jaspel = await ambilHasilPenggajian(k, f, p.remunerasi_periode_uuid, p.uuid);
  if (jaspel.tahun !== p.tahun || jaspel.bulan !== p.bulan) throw konflik("Periode Remunerasi harus sama dengan periode gaji");
  const pegawai = await query(`SELECT h.uuid, h.pegawai_uuid, h.tanggal_mulai, h.tanggal_selesai, h.updated_at FROM hr_kepegawaian h
    JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL AND p.status = true
    WHERE h.faskes_uuid = $1 AND h.deleted_at IS NULL AND h.tanggal_mulai <= $2 AND (h.tanggal_selesai IS NULL OR h.tanggal_selesai > $2) ORDER BY h.uuid`, [f, acuan], k);
  const riwayat = await query(`SELECT r.uuid, r.kepegawaian_uuid, r.unit_uuid, r.golongan, r.status_kepegawaian, r.tanggal_mulai, r.tanggal_selesai
    FROM hr_riwayat_jabatan r LEFT JOIN lokasi l ON l.uuid = r.unit_uuid AND l.faskes_uuid = r.faskes_uuid AND l.deleted_at IS NULL
    WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL AND r.tanggal_mulai <= $2 AND (r.tanggal_selesai IS NULL OR r.tanggal_selesai > $2) AND (r.unit_uuid IS NULL OR l.uuid IS NOT NULL) ORDER BY r.uuid`, [f, acuan], k);
  const komponen = await query(`SELECT t.*, m.kode, m.jenis, m.kategori, m.perlakuan_pajak, m.updated_at AS master_versi FROM hr_gaji_komponen_pegawai t JOIN hr_gaji_komponen m ON m.uuid = t.komponen_uuid AND m.faskes_uuid = t.faskes_uuid AND m.deleted_at IS NULL AND m.aktif = true WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.berlaku_mulai <= $2 AND (t.berlaku_sampai IS NULL OR t.berlaku_sampai > $2) ORDER BY t.uuid`, [f, acuan], k);
  const skala = await query(`SELECT * FROM hr_gaji_skala WHERE faskes_uuid = $1 AND deleted_at IS NULL AND berlaku_mulai <= $2 AND (berlaku_sampai IS NULL OR berlaku_sampai > $2) ORDER BY uuid`, [f, acuan], k);
  const profil = await query(`SELECT * FROM hr_gaji_profil_pegawai WHERE faskes_uuid = $1 AND status = 'disahkan' AND deleted_at IS NULL AND berlaku_mulai <= $2 AND (berlaku_sampai IS NULL OR berlaku_sampai > $2) ORDER BY uuid`, [f, acuan], k);
  const koreksi = await query(`SELECT t.*, m.kode, m.jenis, m.kategori, m.perlakuan_pajak FROM hr_gaji_koreksi t JOIN hr_gaji_komponen m ON m.uuid = t.komponen_uuid AND m.faskes_uuid = t.faskes_uuid AND m.deleted_at IS NULL AND m.aktif = true WHERE t.faskes_uuid = $1 AND t.periode_tujuan_uuid = $2 AND t.deleted_at IS NULL ORDER BY t.uuid`, [f, p.uuid], k);
  if (jaspel.penerima.some((r) => !pegawai.some((x) => x.uuid === r.kepegawaian_uuid))) throw konflik("Penerima jasa pelayanan tidak termasuk pegawai aktif pada tanggal acuan");
  const sumber = { konfigurasi: c, acuan, pegawai, riwayat, komponen, skala, profil, koreksi, jaspel, kehadiran: { status: "tidak_digunakan", alasan: "Fitur Kehadiran belum tersedia" } };
  return { sumber, hash: hash(sumber) };
};

export const hitungSumber = (s) => {
  const hasil = [];
  for (const p of s.pegawai) {
    const r = s.riwayat.filter((x) => x.kepegawaian_uuid === p.uuid);
    const profil = s.profil.filter((x) => x.kepegawaian_uuid === p.uuid);
    const rincian = [], alasan = [];
    if (r.length !== 1 || !["tetap", "kontrak", "honorer", "magang"].includes(r[0].status_kepegawaian)) alasan.push("Riwayat kepegawaian tidak tunggal atau tidak aktif");
    if (profil.length !== 1) alasan.push("Profil penghitungan disahkan belum tersedia secara tunggal");
    const penetapan = s.komponen.filter((x) => x.kepegawaian_uuid === p.uuid);
    if (!penetapan.some((x) => x.kategori === "gaji_pokok" && x.jenis === "penghasilan")) alasan.push("Gaji pokok belum ditetapkan");
    if (new Set(penetapan.map((x) => x.komponen_uuid)).size !== penetapan.length) alasan.push("Penetapan komponen bertumpang tindih");
    const tanggalMulai = new Date(Number(p.tanggal_mulai) * 1000 + 7 * 3600000), acuan = new Date(s.acuan * 1000 + 7 * 3600000);
    const masaKerja = (acuan.getUTCFullYear() - tanggalMulai.getUTCFullYear()) * 12 + acuan.getUTCMonth() - tanggalMulai.getUTCMonth() - (acuan.getUTCDate() < tanggalMulai.getUTCDate() ? 1 : 0);
    for (const t of penetapan) {
      let nilai = t.nilai;
      if (t.skala_uuid) {
        const skala = s.skala.find((x) => x.uuid === t.skala_uuid && x.golongan === r[0]?.golongan && masaKerja >= x.masa_kerja_min_bulan && (x.masa_kerja_maks_bulan == null || masaKerja < x.masa_kerja_maks_bulan));
        if (!skala) { alasan.push("Skala tidak sesuai golongan, masa kerja, atau masa berlaku"); continue; }
        nilai = skala.nilai;
      }
      rincian.push({ komponen_uuid: t.komponen_uuid, kode: t.kode, jenis: t.jenis, kategori: t.kategori, nilai, sumber_tabel: "hr_gaji_komponen_pegawai", sumber_uuid: t.uuid, dasar_perhitungan: { perlakuan_pajak: t.perlakuan_pajak, skala_uuid: t.skala_uuid, masa_kerja_bulan: masaKerja } });
    }
    for (const t of s.koreksi.filter((x) => x.kepegawaian_uuid === p.uuid)) rincian.push({ komponen_uuid: t.komponen_uuid, kode: t.kode, jenis: t.jenis, kategori: t.kategori, nilai: t.nilai, sumber_tabel: "hr_gaji_koreksi", sumber_uuid: t.uuid, dasar_perhitungan: { hasil_asal_uuid: t.hasil_asal_uuid, perlakuan_pajak: t.perlakuan_pajak } });
    const j = s.jaspel.penerima.find((x) => x.kepegawaian_uuid === p.uuid);
    if (j) rincian.push({ komponen_uuid: null, kode: "jaspel", jenis: "penghasilan", kategori: "jaspel", nilai: j.total, sumber_tabel: "remunerasi_rincian", sumber_uuid: j.rincian_uuid, dasar_perhitungan: { periode_uuid: s.jaspel.periode_uuid, perlakuan_pajak: s.konfigurasi.kebijakan.perlakuan_pajak_jaspel } });
    const jumlah = (jenis, filter = () => true) => rincian.filter((x) => x.jenis === jenis && filter(x)).reduce((n, x) => n + sen(x.nilai), 0n);
    const bruto = jumlah("penghasilan");
    if (!alasan.length) {
      const parameter = { ...profil[0].parameter, bruto: uang(bruto), kena_pajak: uang(jumlah("penghasilan", (x) => x.dasar_perhitungan.perlakuan_pajak === "kena_pajak")), gaji_pokok: uang(jumlah("penghasilan", (x) => x.kategori === "gaji_pokok")), jaspel: j?.total ?? "0.00" };
      try {
        const aturan = s.konfigurasi.aturan;
        const nilai = hitungAturan(aturan, parameter);
        for (const [jenis, daftar] of [["potongan", aturan.potongan], ["iuran_pemberi_kerja", aturan.iuran_pemberi_kerja]]) for (const a of daftar) {
          rincian.push({ komponen_uuid: null, kode: a.kode, jenis, kategori: a.kategori, nilai: nilai[a.kode], sumber_tabel: "hr_gaji_konfigurasi", sumber_uuid: s.konfigurasi.uuid, dasar_perhitungan: { hash_konfigurasi: s.konfigurasi.hash_konfigurasi, profil_uuid: profil[0].uuid } });
        }
      } catch (e) { if (!e.status) throw e; alasan.push(e.message); }
    }
    const potongan = jumlah("potongan"), iuran = jumlah("iuran_pemberi_kerja"), bersih = bruto - potongan;
    if (bersih < 0n) alasan.push("Gaji bersih negatif");
    hasil.push({ kepegawaian_uuid: p.uuid, unit_uuid: r[0]?.unit_uuid ?? null, riwayat_uuid: r[0]?.uuid ?? null, bruto: uang(bruto), potongan: uang(potongan), iuran_pemberi_kerja: uang(iuran), bersih: uang(bersih), status_kelengkapan: alasan.length ? "pengecualian" : "lengkap", alasan: alasan.join("; ") || null, rincian });
  }
  if (!hasil.length) throw konflik("Tidak ada pegawai aktif pada periode");
  const total = Object.fromEntries(["bruto", "potongan", "iuran_pemberi_kerja", "bersih"].map((c) => [c, uang(hasil.reduce((n, r) => n + sen(r[c]), 0n))]));
  return { hasil, ringkasan: { ...total, jumlah_pegawai: hasil.length, jumlah_pengecualian: hasil.filter((r) => r.status_kelengkapan !== "lengkap").length, kehadiran: s.kehadiran } };
};
