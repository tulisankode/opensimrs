import { bulat, hari, pilihan, teks, validasiAturan, validasiPola, wajib, periksaVersi, bulan, tanggalBulan } from "./bersama.js";
import { superAdmin } from "./akses.js";

export const buatMaster = (r, a) => {
  const pola = async (k, req, uuid, unit) => {
    const p = await r.ambil(k, a.faskes(req), "hr_pola_shift", uuid);
    wajib(p.aktif && (!p.unit_uuid || p.unit_uuid === unit), "Pola tidak aktif atau di luar unit", 422);
    return p;
  };
  const cakupanPola = async (k, req, unit) => {
    if (unit) await a.unit(k, req, unit, "susun");
    else wajib(superAdmin(req), "Pola seluruh faskes hanya dikelola super admin", 403);
  };
  const referensi = async (req) => {
    const f = a.faskes(req), izin = {};
    const definisi = { "Pola Shift": ["READ", "CREATE", "UPDATE", "DELETE", "PENGATURAN"], "Jadwal Dinas": ["READ", "CREATE", "UPDATE", "AJUKAN", "REVISI", "TERBITKAN", "EKSPOR", "CETAK"], "Persetujuan Jadwal": ["READ", "SETUJUI", "TOLAK"], "Jadwal Saya": ["READ"], "Tukar Dinas": ["READ", "CREATE", "TANGGAPI", "BATALKAN", "SETUJUI", "TOLAK"] };
    let boleh = false;
    for (const [sub, aksi] of Object.entries(definisi)) {
      izin[sub] = [];
      for (const x of aksi) { try { await a.hak(req, sub, x); izin[sub].push(x); boleh = true; } catch (e) { if (e.status !== 403) throw e; } }
    }
    wajib(boleh, "Tidak memiliki izin Jadwal Dinas", 403);
    const unit = await r.query(`SELECT l.uuid, l.name AS nama FROM lokasi l WHERE l.faskes_uuid = $1 AND l.deleted_at IS NULL
      AND ($2 OR EXISTS (SELECT 1 FROM hr_kewenangan_jadwal w WHERE w.faskes_uuid = l.faskes_uuid AND w.unit_uuid = l.uuid
      AND w.username = $3 AND w.deleted_at IS NULL AND w.berlaku_mulai <= $4 AND (w.berlaku_sampai IS NULL OR w.berlaku_sampai > $4))) ORDER BY l.name`, [f, superAdmin(req), req.author.username, r.sekarang()]);
    const kewenangan = await r.query(`SELECT unit_uuid, kewenangan FROM hr_kewenangan_jadwal WHERE faskes_uuid = $1 AND username = $2
      AND deleted_at IS NULL AND berlaku_mulai <= $3 AND (berlaku_sampai IS NULL OR berlaku_sampai > $3)`, [f, req.author.username, r.sekarang()]);
    const akun = await r.satu(`SELECT a.kepegawaian_uuid FROM hr_akun_pegawai a JOIN hr_kepegawaian h ON h.uuid = a.kepegawaian_uuid AND h.faskes_uuid = a.faskes_uuid AND h.deleted_at IS NULL
      WHERE a.faskes_uuid = $1 AND a.username = $2 AND a.deleted_at IS NULL`, [f, req.author.username]);
    return { unit, kewenangan, izin, akun_tertaut: akun?.kepegawaian_uuid ?? null, super_admin: superAdmin(req) };
  };
  const pegawai = async (req, k) => {
    await a.hak(req, "Jadwal Dinas", "READ");
    const f = a.faskes(req), q = req.query, periode = bulan(q.periode_mulai), akhir = tanggalBulan(periode).at(-1) + 86400;
    await a.unit(k, req, q.unit_uuid);
    const limit = bulat(q.limit ?? 100, "Batas", 1, 500), page = bulat(q.page ?? 1, "Halaman", 1, 100000);
    return r.query(`SELECT h.uuid, p.name AS nama, j.tanggal_mulai, j.tanggal_selesai FROM hr_kepegawaian h
      JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL AND p.status = true
      JOIN hr_riwayat_jabatan j ON j.kepegawaian_uuid = h.uuid AND j.faskes_uuid = h.faskes_uuid AND j.deleted_at IS NULL
      WHERE h.faskes_uuid = $1 AND h.deleted_at IS NULL AND j.unit_uuid = $2 AND j.status_kepegawaian <> 'purna_tugas'
      AND j.tanggal_mulai < $4 AND (j.tanggal_selesai IS NULL OR j.tanggal_selesai > $3)
      AND h.tanggal_mulai < $4 AND (h.tanggal_selesai IS NULL OR h.tanggal_selesai > $3)
      AND p.name ILIKE $5 ORDER BY p.name LIMIT $6 OFFSET $7`, [f, q.unit_uuid, periode, akhir, `%${String(q.cari ?? "").slice(0, 150)}%`, limit, (page - 1) * limit], k);
  };
  const baca = async (req, jenis) => {
    await a.hak(req, "Pola Shift", "READ");
    const f = a.faskes(req), unit = teks(req.query.unit_uuid, "Unit", 255);
    await a.unit(null, req, unit);
    if (jenis === "aturan") return r.aturan(null, f, unit);
    if (jenis === "kewenangan") return r.query(`SELECT uuid, username, kewenangan, berlaku_mulai, berlaku_sampai FROM hr_kewenangan_jadwal WHERE faskes_uuid = $1 AND unit_uuid = $2 AND deleted_at IS NULL`, [f, unit]);
    if (jenis === "rotasi") return r.query(`SELECT * FROM hr_rotasi_shift WHERE faskes_uuid = $1 AND unit_uuid = $2 AND deleted_at IS NULL ORDER BY nama`, [f, unit]);
    return r.query(`SELECT * FROM hr_pola_shift WHERE faskes_uuid = $1 AND (unit_uuid IS NULL OR unit_uuid = $2) AND deleted_at IS NULL
      AND ($3::boolean IS NULL OR aktif = $3::boolean) ORDER BY kode`, [f, unit, req.query.aktif === undefined ? null : pilihan(req.query.aktif, ["true", "false"], "Aktif")]);
  };
  const simpanPola = async (req, hapus = false) => {
    await a.hak(req, "Pola Shift", hapus ? "DELETE" : req.params.uuid ? "UPDATE" : "CREATE");
    const f = a.faskes(req), b = req.body;
    return r.transaksi(f, async (k) => {
      const lama = req.params.uuid ? await r.ambil(k, f, "hr_pola_shift", req.params.uuid, true) : null;
      const unit = lama ? lama.unit_uuid : b.unit_uuid || null;
      if (lama) { periksaVersi(lama, b.versi_kunci); wajib(b.unit_uuid === undefined || b.unit_uuid === unit, "Cakupan pola tidak dapat diubah"); }
      await cakupanPola(k, req, unit);
      const data = hapus ? { deleted_at: r.sekarang(), aktif: false } : validasiPola({ ...lama, ...b });
      if (hapus) teks(b.alasan, "Alasan");
      const hasil = lama ? await r.ubah("hr_pola_shift", lama.uuid, f, { ...data, versi_kunci: Number(lama.versi_kunci) + 1 }, k)
        : await r.sisipkan("hr_pola_shift", { ...data, faskes_uuid: f, unit_uuid: unit, versi_kunci: 1 }, k);
      await r.catatPeristiwa(k, req, hapus ? "hapus_pola" : "simpan_pola", { pola_uuid: hasil.uuid, alasan: b.alasan });
      return hasil;
    });
  };
  const simpanAturan = async (req) => {
    await a.hak(req, "Pola Shift", "PENGATURAN");
    const f = a.faskes(req), unit = req.params.unitUuid, b = req.body;
    return r.transaksi(f, async (k) => {
      await a.unit(k, req, unit, "susun");
      const { aturan: lama } = await r.aturan(k, f, unit);
      if (lama) periksaVersi(lama, b.versi_kunci);
      else wajib(b.versi_kunci === 0, "Versi awal aturan harus nol", 409);
      const data = validasiAturan(b);
      wajib(Array.isArray(b.kebutuhan) && b.kebutuhan.length <= 1000, "Kebutuhan staf harus berupa daftar maksimal 1000 baris");
      const kebutuhan = [], unik = new Set();
      for (const x of b.kebutuhan) {
        wajib(x && typeof x === "object" && !Array.isArray(x), "Baris kebutuhan staf harus berupa objek");
        const p = await pola(k, req, teks(x.pola_shift_uuid, "Pola", 255), unit);
        wajib(!p.libur, "Pola libur tidak memerlukan staf");
        const tanggal = x.tanggal_kerja == null ? null : hari(x.tanggal_kerja), hariMinggu = tanggal === null ? bulat(x.hari_minggu, "Hari minggu", 0, 6) : null;
        const key = `${p.uuid}:${tanggal}:${hariMinggu}`;
        wajib(!unik.has(key), "Kebutuhan staf berulang"); unik.add(key);
        kebutuhan.push({ pola_shift_uuid: p.uuid, tanggal_kerja: tanggal, hari_minggu: hariMinggu, minimum_staf: bulat(x.minimum_staf, "Minimum staf", 0, 10000) });
      }
      const aturan = lama ? await r.ubah("hr_aturan_jadwal", lama.uuid, f, { ...data, versi_kunci: Number(lama.versi_kunci) + 1 }, k)
        : await r.sisipkan("hr_aturan_jadwal", { ...data, faskes_uuid: f, unit_uuid: unit, versi_kunci: 1 }, k);
      await r.query(`UPDATE hr_kebutuhan_shift SET deleted_at = $3, updated_at = $3 WHERE faskes_uuid = $1 AND aturan_uuid = $2 AND deleted_at IS NULL`, [f, aturan.uuid, r.sekarang()], k);
      for (const x of kebutuhan) await r.sisipkan("hr_kebutuhan_shift", { ...x, faskes_uuid: f, aturan_uuid: aturan.uuid }, k);
      await r.catatPeristiwa(k, req, "simpan_aturan", { aturan_uuid: aturan.uuid, versi_kunci: aturan.versi_kunci });
      return { aturan, kebutuhan };
    });
  };
  const simpanRotasi = async (req) => {
    await a.hak(req, "Pola Shift", req.params.uuid ? "UPDATE" : "CREATE");
    const f = a.faskes(req), b = req.body;
    return r.transaksi(f, async (k) => {
      const lama = req.params.uuid ? await r.ambil(k, f, "hr_rotasi_shift", req.params.uuid, true) : null;
      if (lama) periksaVersi(lama, b.versi_kunci);
      const unit = lama?.unit_uuid ?? teks(b.unit_uuid, "Unit", 255);
      await a.unit(k, req, unit, "susun");
      wajib(Array.isArray(b.urutan_pola) && b.urutan_pola.length > 0 && b.urutan_pola.length <= 366, "Urutan rotasi harus berisi 1–366 pola");
      for (const uuid of b.urutan_pola) await pola(k, req, uuid, unit);
      const data = { nama: teks(b.nama, "Nama rotasi", 150), urutan_pola: b.urutan_pola, aktif: b.aktif === undefined ? true : pilihan(b.aktif, [true, false], "Aktif"), versi_kunci: Number(lama?.versi_kunci ?? 0) + 1 };
      const hasil = lama ? await r.ubah("hr_rotasi_shift", lama.uuid, f, data, k) : await r.sisipkan("hr_rotasi_shift", { ...data, faskes_uuid: f, unit_uuid: unit }, k);
      await r.catatPeristiwa(k, req, "simpan_rotasi", { rotasi_uuid: hasil.uuid });
      return hasil;
    });
  };
  const kewenangan = async (req) => {
    await a.hak(req, "Pola Shift", "PENGATURAN");
    wajib(superAdmin(req), "Kewenangan unit hanya diatur super admin", 403);
    const f = a.faskes(req), unit = req.params.unitUuid;
    return r.transaksi(f, async (k) => {
      await a.unit(k, req, unit);
      const anggota = req.body.anggota;
      wajib(Array.isArray(anggota) && anggota.length <= 1000, "Anggota harus berupa daftar maksimal 1000 baris");
      const hasil = [];
      await r.query(`UPDATE hr_kewenangan_jadwal SET deleted_at = $3, updated_at = $3 WHERE faskes_uuid = $1 AND unit_uuid = $2 AND deleted_at IS NULL`, [f, unit, r.sekarang()], k);
      for (const x of anggota) {
        wajib(x && typeof x === "object" && !Array.isArray(x), "Anggota kewenangan harus berupa objek");
        const username = teks(x.username, "Akun", 255);
        wajib(await r.satu(`SELECT username FROM users WHERE faskes_uuid = $1 AND username = $2 AND deleted_at IS NULL`, [f, username], k), "Akun tidak ditemukan dalam faskes aktif", 404);
        const mulai = hari(x.berlaku_mulai), akhir = x.berlaku_sampai == null ? null : hari(x.berlaku_sampai);
        wajib(akhir === null || akhir > mulai, "Rentang kewenangan tidak sah");
        hasil.push(await r.sisipkan("hr_kewenangan_jadwal", { faskes_uuid: f, unit_uuid: unit, username, kewenangan: pilihan(x.kewenangan, ["lihat", "susun", "setujui", "terbit", "putus_tukar"], "Kewenangan"), berlaku_mulai: mulai, berlaku_sampai: akhir }, k));
      }
      await r.catatPeristiwa(k, req, "simpan_kewenangan", { unit_uuid: unit, jumlah: hasil.length });
      return hasil;
    });
  };
  return { pola, referensi, pegawai, baca, simpanPola, simpanAturan, simpanRotasi, kewenangan };
};
