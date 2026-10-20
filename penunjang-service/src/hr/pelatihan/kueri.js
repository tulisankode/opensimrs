import { denganHalaman, halaman, permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { bulatOpsional, epochOpsional, teks } from "../../sarpras/bersama.js";
import { NAMA_PEGAWAI } from "../../mutu/dasar.js";
import { tahunValid } from "./validasi.js";
import { susunRekap, susunWajib, susunPeringatan } from "./rekap.js";

const MAKS_REKAP = 10000;
const paginasi = (data, q) => { const pg = halaman(q); return denganHalaman(data.slice(pg.offset, pg.offset + pg.limit), data.length, pg); };

export const buatKueriPelatihan = ({ query, satu, sekarang, transaksi }) => {
  const daftar = async (tabel, f, q, k) => {
    const p = [f], syarat = ["faskes_uuid = $1", "deleted_at IS NULL"];
    const cari = teks(q.cari, "cari", 100);
    if (cari) syarat.push(`${tabel === "sdm_pelatihan_katalog" ? "nama" : "nama_pelatihan"} ILIKE $${p.push(`%${cari}%`)}`);
    for (const kol of tabel === "sdm_pelatihan_katalog" ? ["kategori"] : ["status", "katalog_uuid"]) if (q[kol]) syarat.push(`${kol} = $${p.push(String(q[kol]))}`);
    if (tabel === "sdm_pelatihan_katalog" && q.wajib !== undefined && q.wajib !== "") {
      if (!["true", "false"].includes(String(q.wajib))) throw permintaanSalah("Filter wajib tidak valid");
      syarat.push(`wajib = $${p.push(String(q.wajib) === "true")}`);
    }
    if (tabel === "sdm_pelatihan_kegiatan") {
      const mulai = epochOpsional(q.tanggal_mulai || undefined, "tanggal_mulai"), akhir = epochOpsional(q.tanggal_selesai || undefined, "tanggal_selesai");
      if (mulai && akhir && mulai > akhir) throw permintaanSalah("Periode kegiatan tidak valid");
      if (mulai) syarat.push(`jadwal_selesai >= $${p.push(mulai)}`);
      if (akhir) syarat.push(`jadwal_selesai <= $${p.push(akhir)}`);
    }
    const where = syarat.join(" AND "), pg = halaman(q);
    const total = (await satu(`SELECT count(*) AS n FROM ${tabel} WHERE ${where}`, p, k)).n;
    return denganHalaman(await query(`SELECT * FROM ${tabel} WHERE ${where} ORDER BY created_at DESC, uuid LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, pg.limit, pg.offset], k), total, pg);
  };
  const pegawai = (f, q, k) => query(`SELECT h.uuid, h.pegawai_uuid, h.unit_uuid, p.tipe, ${NAMA_PEGAWAI("p")} AS nama_pegawai
    FROM hr_kepegawaian h JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL AND p.status = true
    WHERE h.faskes_uuid = $1 AND h.deleted_at IS NULL AND h.status_kepegawaian <> 'purna_tugas'
      AND h.tanggal_mulai <= $2 AND (h.tanggal_selesai IS NULL OR h.tanggal_selesai > $2)
      AND ($3::text IS NULL OR h.unit_uuid = $3) AND ($4::text IS NULL OR h.uuid = $4)
      AND ($5::text IS NULL OR p.tipe::text = $5) AND ($6::text IS NULL OR p.name ILIKE $6)
    ORDER BY p.name, h.uuid LIMIT ${MAKS_REKAP + 1}`, [f, sekarang(), q.unit_uuid || null, q.pegawai_uuid || null, q.jenis_pegawai || null, q.cari ? `%${teks(q.cari, "cari", 100)}%` : null], k);
  const kebijakan = async (f, q, k) => {
    const row = await satu(`SELECT * FROM sdm_pelatihan_kebijakan WHERE faskes_uuid = $1 AND tahun = $2 AND deleted_at IS NULL ORDER BY versi DESC LIMIT 1`, [f, tahunValid(q.tahun)], k);
    return row ? { ...row, target: await query(`SELECT * FROM sdm_pelatihan_target WHERE faskes_uuid = $1 AND kebijakan_uuid = $2 AND deleted_at IS NULL`, [f, row.uuid], k) } : null;
  };
  const sumber = (f, k, { selesai = true } = {}) => query(`SELECT p.uuid, p.pegawai_uuid, p.kehadiran, p.hasil, p.jam_diakui, p.jam_hadir, p.status_verifikasi,
      g.uuid AS kegiatan_uuid, g.katalog_uuid, g.nama_pelatihan, g.jadwal_selesai, g.masa_berlaku_tahun, g.status AS status_kegiatan,
      b.tahun, b.zona_waktu, b.uuid AS kebijakan_uuid, ${NAMA_PEGAWAI("pg")} AS nama_pegawai,
      c.uuid AS kredensial_uuid, c.nomor, c.status AS kredensial_status, c.status_verifikasi AS kredensial_verifikasi, c.tanggal_mulai, c.tanggal_berakhir
    FROM sdm_pelatihan_peserta p
    JOIN sdm_pelatihan_kegiatan g ON g.uuid = p.kegiatan_uuid AND g.faskes_uuid = p.faskes_uuid AND g.deleted_at IS NULL
    JOIN sdm_pelatihan_kebijakan b ON b.uuid = g.kebijakan_uuid AND b.faskes_uuid = p.faskes_uuid AND b.deleted_at IS NULL
    JOIN hr_kepegawaian h ON h.uuid = p.pegawai_uuid AND h.faskes_uuid = p.faskes_uuid AND h.deleted_at IS NULL
    JOIN pegawai pg ON pg.uuid = h.pegawai_uuid AND pg.faskes_uuid = p.faskes_uuid AND pg.deleted_at IS NULL
    LEFT JOIN mutu_kredensial c ON c.uuid = p.kredensial_uuid AND c.faskes_uuid = p.faskes_uuid AND c.pegawai_uuid = h.pegawai_uuid AND c.jenis = 'sertifikat' AND c.deleted_at IS NULL
    WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status_pendaftaran = 'terdaftar'
    ${selesai ? "AND p.status_verifikasi = 'terverifikasi' AND g.status = 'selesai'" : "AND g.status <> 'dibatalkan'"}
    ORDER BY g.jadwal_selesai, p.uuid LIMIT 50001`, [f], k);
  const laporan = async (f, q, jenis, k) => {
    const b = await kebijakan(f, q, k), orang = await pegawai(f, q, k), s = await sumber(f, k, { selesai: jenis !== "sertifikat" && jenis !== "peserta" });
    if (orang.length > MAKS_REKAP || s.length > 50000) throw permintaanSalah("Data laporan terlalu besar; persempit cakupan laporan atau periode arsip");
    const ids = new Set(orang.map((p) => p.uuid)), tahun = tahunValid(q.tahun);
    let data;
    if (jenis === "jam") {
      data = susunRekap(orang, s.filter((x) => Number(x.tahun) === tahun && ids.has(x.pegawai_uuid)), b?.target ?? []);
      if (q.status_pemenuhan) data = data.filter((p) => p.status_pemenuhan === q.status_pemenuhan);
    } else if (jenis === "wajib") {
      const kat = await query(`SELECT uuid, nama FROM sdm_pelatihan_katalog WHERE faskes_uuid = $1 AND deleted_at IS NULL AND wajib = true`, [f], k);
      const cakupan = await query(`SELECT c.* FROM sdm_pelatihan_cakupan c JOIN sdm_pelatihan_katalog t ON t.uuid = c.katalog_uuid
        AND t.faskes_uuid = c.faskes_uuid AND t.deleted_at IS NULL WHERE c.faskes_uuid = $1 AND c.deleted_at IS NULL AND t.wajib = true`, [f], k);
      data = susunWajib(orang, kat, cakupan, s, b, epochOpsional(q.waktu_penilaian || undefined, "waktu_penilaian") ?? sekarang());
    } else if (jenis === "sertifikat") {
      const hari = bulatOpsional(q.hari_peringatan || undefined, "hari_peringatan", { min: 0, maks: 3650 }) ?? b?.hari_peringatan;
      if (hari == null) throw permintaanSalah("Tetapkan kebijakan atau isi rentang hari peringatan");
      data = susunPeringatan(s.filter((x) => ids.has(x.pegawai_uuid)), sekarang(), hari);
      if (q.status_masa_berlaku) data = data.filter((x) => x.status_masa_berlaku === q.status_masa_berlaku);
    } else if (jenis === "peserta") {
      if (!q.kegiatan_uuid) throw permintaanSalah("Pilih kegiatan untuk laporan peserta");
      await detailKegiatan(f, q.kegiatan_uuid, k);
      data = s.filter((x) => x.kegiatan_uuid === q.kegiatan_uuid && ids.has(x.pegawai_uuid));
    } else throw permintaanSalah("Jenis laporan tidak valid");
    return { data, kebijakan: b, tahun, dasar_cakupan: "kepegawaian_saat_laporan" };
  };
  const detailKegiatan = async (f, id, k) => {
    const g = await satu(`SELECT * FROM sdm_pelatihan_kegiatan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [id, f], k);
    if (!g) throw tidakDitemukan("Kegiatan pelatihan");
    return g;
  };
  return {
    daftarKatalog: (f, q) => daftar("sdm_pelatihan_katalog", f, q),
    daftarKegiatan: (f, q) => daftar("sdm_pelatihan_kegiatan", f, q),
    detailKatalog: async (f, id) => {
      const row = await satu(`SELECT * FROM sdm_pelatihan_katalog WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [id, f]);
      if (!row) throw tidakDitemukan("Katalog pelatihan");
      return { ...row, cakupan: await query(`SELECT * FROM sdm_pelatihan_cakupan WHERE katalog_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [id, f]) };
    },
    pegawai: async (f, q) => paginasi(await pegawai(f, q), q), kebijakan,
    sertifikatPegawai: async (f, id) => {
      const h = await satu(`SELECT h.pegawai_uuid FROM hr_kepegawaian h
        JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL AND p.status = true
        WHERE h.uuid = $1 AND h.faskes_uuid = $2 AND h.deleted_at IS NULL`, [id, f]);
      if (!h) throw tidakDitemukan("Pegawai tertaut");
      return query(`SELECT c.uuid, c.nomor, c.penerbit, c.tanggal_mulai, c.tanggal_berakhir, c.status_verifikasi
        FROM mutu_kredensial c WHERE c.faskes_uuid = $1 AND c.pegawai_uuid = $2 AND c.jenis = 'sertifikat'
        AND c.status = 'aktif' AND c.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM sdm_pelatihan_peserta p
          WHERE p.faskes_uuid = c.faskes_uuid AND p.kredensial_uuid = c.uuid AND p.deleted_at IS NULL)
        ORDER BY c.created_at DESC LIMIT 200`, [f, h.pegawai_uuid]);
    },
    detailKegiatan,
    peserta: async (f, id, q) => {
      await detailKegiatan(f, id);
      const data = await query(`SELECT p.*, ${NAMA_PEGAWAI("pg")} AS nama_pegawai, c.nomor AS nomor_sertifikat,
          c.status AS status_sertifikat, c.status_verifikasi AS verifikasi_sertifikat, c.tanggal_berakhir
        FROM sdm_pelatihan_peserta p
        JOIN hr_kepegawaian h ON h.uuid = p.pegawai_uuid AND h.faskes_uuid = p.faskes_uuid AND h.deleted_at IS NULL
        JOIN pegawai pg ON pg.uuid = h.pegawai_uuid AND pg.faskes_uuid = p.faskes_uuid AND pg.deleted_at IS NULL
        LEFT JOIN mutu_kredensial c ON c.uuid = p.kredensial_uuid AND c.faskes_uuid = p.faskes_uuid AND c.pegawai_uuid = h.pegawai_uuid AND c.deleted_at IS NULL
        WHERE p.kegiatan_uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL ORDER BY pg.name`, [id, f]);
      return paginasi(data.filter((p) => !q.status_verifikasi || p.status_verifikasi === q.status_verifikasi), q);
    },
    rekap: (f, q, jenis) => transaksi(async (k) => {
      await k.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const hasil = await laporan(f, q, jenis, k);
      return { ...hasil, ...paginasi(hasil.data, q) };
    }),
    laporan,
  };
};
