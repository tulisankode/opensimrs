import { bulat, periksaVersi, pilihan, teks, wajib } from "./bersama.js";

export const buatTukar = (r, a, jadwal) => {
  const efektif = async (k, req, uuid) => {
    const f = a.faskes(req), p = await r.ambil(k, f, "hr_penempatan_shift", uuid, true), v = await r.versi(k, f, p.versi_uuid, true);
    wajib(v.status === "terbit" && v.versi_aktif_uuid === v.uuid, "Penempatan bukan jadwal terbit efektif", 409);
    wajib(!p.libur && Number(p.mulai_epoch) > r.sekarang(), "Hanya shift kerja yang belum dimulai dapat ditukar", 409);
    return { p, v };
  };
  const calon = async (req) => {
    await a.hak(req, "Tukar Dinas", "CREATE");
    const f = a.faskes(req);
    return r.transaksi(f, async (k) => {
      const { p, v } = await efektif(k, req, req.query.penempatan_asal_uuid);
      wajib(p.kepegawaian_uuid === await a.sendiri(k, req), "Hanya dapat memilih shift milik sendiri", 403);
      return r.query(`SELECT p.uuid, p.tanggal_kerja, p.mulai_epoch, p.selesai_epoch, p.potret_shift, g.name AS nama FROM hr_penempatan_shift p
        JOIN hr_jadwal_versi v ON v.uuid = p.versi_uuid AND v.faskes_uuid = p.faskes_uuid AND v.deleted_at IS NULL
        JOIN hr_jadwal_dinas j ON j.uuid = v.jadwal_uuid AND j.faskes_uuid = v.faskes_uuid AND j.versi_aktif_uuid = v.uuid AND j.deleted_at IS NULL
        JOIN hr_kepegawaian h ON h.uuid = p.kepegawaian_uuid AND h.faskes_uuid = p.faskes_uuid AND h.deleted_at IS NULL
        JOIN pegawai g ON g.uuid = h.pegawai_uuid AND g.faskes_uuid = h.faskes_uuid AND g.deleted_at IS NULL
        WHERE p.faskes_uuid = $1 AND j.unit_uuid = $2 AND p.kepegawaian_uuid <> $3 AND p.deleted_at IS NULL AND NOT p.libur
        AND p.mulai_epoch > $4 AND p.mulai_epoch < $5 AND v.status = 'terbit'
        ORDER BY p.tanggal_kerja, g.name LIMIT 500`, [f, v.unit_uuid, p.kepegawaian_uuid, r.sekarang(), r.sekarang() + 93 * 86400], k);
    });
  };
  const daftar = async (req) => {
    await a.hak(req, "Tukar Dinas", "READ");
    const f = a.faskes(req), q = req.query, cakupan = pilihan(q.cakupan ?? "saya", ["saya", "unit"], "Cakupan");
    let pegawai = null;
    if (cakupan === "unit") await a.unit(null, req, q.unit_uuid, "putus_tukar");
    else pegawai = await a.sendiri(null, req);
    const limit = bulat(q.limit ?? 50, "Batas", 1, 500), page = bulat(q.page ?? 1, "Halaman", 1, 100000);
    return r.query(`SELECT t.*, j.unit_uuid, p.tanggal_kerja AS tanggal_asal, pp.tanggal_kerja AS tanggal_pengganti,
      CASE WHEN $2::varchar IS NULL THEN 'kepala' WHEN t.pemohon_kepegawaian_uuid = $2 THEN 'pemohon' ELSE 'pengganti' END AS peran_saya FROM hr_tukar_dinas t
      JOIN hr_penempatan_shift p ON p.uuid = t.penempatan_asal_uuid AND p.faskes_uuid = t.faskes_uuid AND p.deleted_at IS NULL
      JOIN hr_penempatan_shift pp ON pp.uuid = t.penempatan_pengganti_uuid AND pp.faskes_uuid = t.faskes_uuid AND pp.deleted_at IS NULL
      JOIN hr_jadwal_versi v ON v.uuid = p.versi_uuid AND v.faskes_uuid = p.faskes_uuid AND v.deleted_at IS NULL
      JOIN hr_jadwal_dinas j ON j.uuid = v.jadwal_uuid AND j.faskes_uuid = v.faskes_uuid AND j.deleted_at IS NULL
      WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND (($2::varchar IS NOT NULL AND (t.pemohon_kepegawaian_uuid = $2 OR t.pengganti_kepegawaian_uuid = $2))
      OR ($2::varchar IS NULL AND j.unit_uuid = $3)) AND ($4::varchar IS NULL OR t.status = $4)
      ORDER BY t.created_at DESC LIMIT $5 OFFSET $6`, [f, pegawai, q.unit_uuid ?? null, q.status ?? null, limit, (page - 1) * limit]);
  };
  const buat = async (req) => {
    await a.hak(req, "Tukar Dinas", "CREATE");
    const f = a.faskes(req), b = req.body;
    return r.transaksi(f, async (k) => {
      const asal = await efektif(k, req, b.penempatan_asal_uuid), pengganti = await efektif(k, req, b.penempatan_pengganti_uuid), saya = await a.sendiri(k, req);
      wajib(asal.p.kepegawaian_uuid === saya, "Pemohon harus pemilik shift asal", 403);
      wajib(asal.v.unit_uuid === pengganti.v.unit_uuid && asal.p.kepegawaian_uuid !== pengganti.p.kepegawaian_uuid, "Pertukaran harus dua pegawai berbeda pada unit yang sama");
      const t = await r.sisipkan("hr_tukar_dinas", { faskes_uuid: f, penempatan_asal_uuid: asal.p.uuid, penempatan_pengganti_uuid: pengganti.p.uuid,
        versi_asal_uuid: asal.v.uuid, versi_pengganti_uuid: pengganti.v.uuid, pemohon_kepegawaian_uuid: saya, pengganti_kepegawaian_uuid: pengganti.p.kepegawaian_uuid,
        alasan: teks(b.alasan, "Alasan"), status: "menunggu_pengganti", versi_kunci: 1 }, k);
      await r.catatPeristiwa(k, req, "ajukan_tukar", { tukar_uuid: t.uuid, status_sesudah: t.status });
      return t;
    });
  };
  const proses = async (req, aksi) => {
    const b = req.body;
    if (aksi !== "batalkan") pilihan(b.setuju, [true, false], "Keputusan");
    await a.hak(req, "Tukar Dinas", aksi === "batalkan" ? "BATALKAN" : aksi === "tanggapi" ? "TANGGAPI" : b.setuju ? "SETUJUI" : "TOLAK");
    const f = a.faskes(req);
    return r.transaksi(f, async (k) => {
      const t = await r.ambil(k, f, "hr_tukar_dinas", req.params.uuid, true);
      periksaVersi(t, b.versi_kunci, aksi === "batalkan" ? ["menunggu_pengganti", "menunggu_kepala"] : aksi === "tanggapi" ? "menunggu_pengganti" : "menunggu_kepala");
      const alasan = aksi === "batalkan" || !b.setuju ? teks(b.alasan, "Alasan") : b.alasan ? teks(b.alasan, "Alasan") : null;
      let status, versiHasil = [];
      if (aksi === "batalkan" || aksi === "tanggapi") {
        const saya = await a.sendiri(k, req);
        wajib(saya === (aksi === "batalkan" ? t.pemohon_kepegawaian_uuid : t.pengganti_kepegawaian_uuid), "Tindakan hanya boleh dilakukan akun peserta terkait", 403);
        status = aksi === "batalkan" ? "dibatalkan" : b.setuju ? "menunggu_kepala" : "ditolak";
      } else {
        const asalP = await r.ambil(k, f, "hr_penempatan_shift", t.penempatan_asal_uuid);
        const asalV = await r.versi(k, f, asalP.versi_uuid);
        await a.unit(k, req, asalV.unit_uuid, "putus_tukar");
        const peserta = await r.satu(`SELECT uuid FROM hr_akun_pegawai WHERE faskes_uuid = $1 AND username = $2 AND deleted_at IS NULL AND kepegawaian_uuid = ANY($3::varchar[])`, [f, req.author.username, [t.pemohon_kepegawaian_uuid, t.pengganti_kepegawaian_uuid]], k);
        wajib(!peserta, "Peserta pertukaran tidak boleh memutuskan permohonannya", 403);
        status = b.setuju ? "diterapkan" : "ditolak";
        if (b.setuju) {
          const asal = await efektif(k, req, t.penempatan_asal_uuid), pengganti = await efektif(k, req, t.penempatan_pengganti_uuid);
          wajib(asal.v.uuid === t.versi_asal_uuid && pengganti.v.uuid === t.versi_pengganti_uuid, "Versi aktif berubah sejak pengajuan", 409);
          const versi = [...new Map([asal.v, pengganti.v].map((v) => [v.uuid, v])).values()].sort((x, y) => x.jadwal_uuid.localeCompare(y.jadwal_uuid));
          const keluarga = versi.map((v) => v.jadwal_uuid), calon = new Map(), hasilValidasi = new Map();
          for (const v of versi) {
            const kerja = await r.satu(`SELECT uuid FROM hr_jadwal_versi WHERE faskes_uuid = $1 AND jadwal_uuid = $2 AND deleted_at IS NULL AND status IN ('draf','diajukan','disetujui')`, [f, v.jadwal_uuid], k);
            wajib(!kerja, "Terdapat revisi berjalan; tinjau kembali pertukaran", 409);
            const baris = await r.penempatan(k, f, v.uuid);
            for (const [sumber, tujuan] of [[asal.p, pengganti.p.kepegawaian_uuid], [pengganti.p, asal.p.kepegawaian_uuid]]) {
              if (sumber.versi_uuid !== v.uuid) continue;
              const liburTujuan = baris.find((p) => p.libur && p.kepegawaian_uuid === tujuan && Number(p.tanggal_kerja) === Number(sumber.tanggal_kerja));
              if (liburTujuan) liburTujuan.kepegawaian_uuid = sumber.kepegawaian_uuid;
            }
            for (const p of baris) {
              if (p.uuid === asal.p.uuid) p.kepegawaian_uuid = t.pengganti_kepegawaian_uuid;
              if (p.uuid === pengganti.p.uuid) p.kepegawaian_uuid = t.pemohon_kepegawaian_uuid;
            }
            const sel = baris.map((p) => `${p.kepegawaian_uuid}:${p.tanggal_kerja}`);
            wajib(new Set(sel).size === sel.length, "Pertukaran menghasilkan dua penempatan pada tanggal yang sama", 422);
            calon.set(v.uuid, baris);
          }
          for (const v of versi) {
            const tambahan = versi.filter((x) => x.uuid !== v.uuid).flatMap((x) => calon.get(x.uuid).map((p) => ({ ...p, jadwal_uuid: x.jadwal_uuid, status: "terbit" })));
            const hasil = await jadwal.nilai(k, req, v, calon.get(v.uuid), keluarga, tambahan);
            jadwal.harusLolos(hasil); hasilValidasi.set(v.uuid, hasil);
          }
          for (const v of versi) {
            const j = await r.ambil(k, f, "hr_jadwal_dinas", v.jadwal_uuid, true);
            const baru = await r.versiBaru(k, req, j, null, `Pertukaran ${t.uuid}`, "terbit");
            await r.ubah("hr_jadwal_versi", baru.uuid, f, { versi_asal_uuid: v.uuid, potret_aturan: hasilValidasi.get(v.uuid).potret,
              disetujui_oleh: req.author.username, disetujui_pada: r.sekarang() }, k);
            for (const p of calon.get(v.uuid)) {
              const { uuid, created_at, updated_at, deleted_at, ...data } = p;
              await r.sisipkan("hr_penempatan_shift", { ...data, versi_uuid: baru.uuid }, k);
            }
            await r.ubah("hr_jadwal_dinas", j.uuid, f, { versi_aktif_uuid: baru.uuid }, k);
            await jadwal.simpanValidasi(k, req, baru, hasilValidasi.get(v.uuid));
            await r.catatPeristiwa(k, req, "terbit_tukar", { jadwal_uuid: j.uuid, versi_uuid: baru.uuid, tukar_uuid: t.uuid, status_sesudah: "terbit", alasan });
            versiHasil.push(baru.uuid);
          }
        }
      }
      const data = { status, alasan_keputusan: alasan, versi_kunci: Number(t.versi_kunci) + 1 };
      Object.assign(data, aksi === "tanggapi" ? { ditanggapi_oleh: req.author.username, ditanggapi_pada: r.sekarang() } : { diputuskan_oleh: req.author.username, diputuskan_pada: r.sekarang() });
      const hasil = await r.ubah("hr_tukar_dinas", t.uuid, f, data, k);
      await r.catatPeristiwa(k, req, `${aksi}_tukar`, { tukar_uuid: t.uuid, status_sebelum: t.status, status_sesudah: status, alasan, versi_hasil: versiHasil });
      return { ...hasil, versi_hasil: versiHasil };
    });
  };
  return { calon, daftar, buat, proses };
};
