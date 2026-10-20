import { permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { konflik, teksWajib } from "../../sarpras/bersama.js";
import { awalHariWib } from "../../mutu/bersama.js";
import { hitungJam, tahunZona, validasiHasil, validasiKatalog, validasiKebijakan, validasiKegiatan, versiSama } from "./validasi.js";

const TABEL = {
  katalog: "sdm_pelatihan_katalog", cakupan: "sdm_pelatihan_cakupan", kebijakan: "sdm_pelatihan_kebijakan",
  target: "sdm_pelatihan_target", kegiatan: "sdm_pelatihan_kegiatan", peserta: "sdm_pelatihan_peserta",
};
const BELUM = { status_verifikasi: "belum_diverifikasi", jam_diakui: 0, diverifikasi_oleh: null, diverifikasi_at: null };
const TRANSISI = { rencana: ["terjadwal", "dibatalkan"], terjadwal: ["berlangsung", "dibatalkan"], berlangsung: ["selesai", "dibatalkan"], selesai: [], dibatalkan: [] };

// Dependensi disuntikkan agar transaksi dan penolakan relasi dapat diuji tanpa koneksi database.
export const buatLayananPelatihan = ({ satu, query, sisipkan, ubah, transaksi, sekarang, audit, catatKredensial, maksMb }) => {
  const milik = async (t, id, f, k, kunci = true) => {
    const row = await satu(`SELECT * FROM ${TABEL[t]} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, [String(id ?? ""), f], k);
    if (!row) throw tidakDitemukan("Data pelatihan");
    return row;
  };
  const simpan = async (t, lama, data, req, k) => {
    const f = req.author.faskesUuid;
    const row = lama
      ? await ubah(TABEL[t], lama.uuid, f, { ...data, versi: Number(lama.versi) + 1 }, k)
      : await sisipkan(TABEL[t], { ...data, faskes_uuid: f, dibuat_oleh: req.author.username ?? null }, k);
    await audit(k, req, data.deleted_at ? "hapus" : lama ? "ubah" : "buat", TABEL[t], row.uuid, { sebelum: lama, sesudah: row });
    return row;
  };
  const pegawaiAktif = async (id, f, k, eksklusif = false) => {
    const row = await satu(`SELECT h.uuid, h.pegawai_uuid, h.unit_uuid, p.tipe FROM hr_kepegawaian h
      JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL AND p.status = true
      WHERE h.uuid = $1 AND h.faskes_uuid = $2 AND h.deleted_at IS NULL AND h.status_kepegawaian <> 'purna_tugas'
      AND h.tanggal_mulai <= $3 AND (h.tanggal_selesai IS NULL OR h.tanggal_selesai > $3) FOR ${eksklusif ? "UPDATE" : "SHARE"} OF h, p`, [id, f, sekarang()], k);
    if (!row) throw tidakDitemukan("Pegawai aktif tertaut");
    return row;
  };
  const cekCakupan = async (c, f, k) => {
    if (c.jenis_cakupan === "pegawai") await pegawaiAktif(c.referensi_uuid, f, k);
    if (c.jenis_cakupan === "unit" && !(await satu(`SELECT uuid FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR SHARE`, [c.referensi_uuid, f], k)))
      throw tidakDitemukan("Unit kerja");
    if (c.jenis_cakupan === "jenis_pegawai" && !["1", "2"].includes(c.referensi_uuid)) throw permintaanSalah("Jenis pegawai tidak valid");
  };
  const cocokTahun = (kegiatan, kebijakan) => {
    if (tahunZona(kegiatan.jadwal_selesai, kebijakan.zona_waktu) !== Number(kebijakan.tahun)) throw permintaanSalah("Tahun selesai kegiatan harus sesuai tahun kebijakan");
  };
  const bolehKelola = (g) => {
    if (["selesai", "dibatalkan"].includes(g.status)) throw konflik("Kegiatan selesai atau dibatalkan tidak dapat diubah; gunakan pembukaan kembali berizin");
  };
  const tidakAdaHasil = async (g, f, k) => {
    if (await satu(`SELECT uuid FROM sdm_pelatihan_peserta WHERE kegiatan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
      AND (status_verifikasi = 'terverifikasi' OR kredensial_uuid IS NOT NULL) LIMIT 1`, [g.uuid, f], k))
      throw konflik("Kegiatan memiliki hasil terverifikasi atau sertifikat; lakukan koreksi terlebih dahulu");
  };
  // Urutan kunci selalu kegiatan → peserta → kredensial, termasuk pada pendaftaran dan koreksi.
  const pasangan = async (req, k) => {
    const f = req.author.faskesUuid;
    const g = await milik("kegiatan", req.params.uuid, f, k);
    const p = await milik("peserta", req.params.peserta_uuid, f, k);
    if (p.kegiatan_uuid !== g.uuid) throw tidakDitemukan("Peserta kegiatan");
    if (p.status_pendaftaran !== "terdaftar") throw konflik("Pendaftaran peserta sudah dibatalkan");
    versiSama(p, req.body?.versi);
    return { g, p, f };
  };
  const sertifikat = async (req, g, p, k) => {
    if (p.hasil !== "lulus" || !["hadir", "sebagian"].includes(p.kehadiran)) throw permintaanSalah("Sertifikat hanya dapat ditautkan untuk peserta hadir yang lulus");
    const f = req.author.faskesUuid, b = req.body ?? {};
    if (!!b.kredensial_uuid === !!b.sertifikat) throw permintaanSalah("Pilih kredensial yang ada atau catat sertifikat baru");
    if (p.kredensial_uuid) throw konflik("Sertifikat sudah ditautkan; periksa kredensial bersama untuk pembaruan");
    const h = await pegawaiAktif(p.pegawai_uuid, f, k, true);
    let row;
    if (b.kredensial_uuid) {
      row = await satu(`SELECT uuid, pegawai_uuid, jenis, status, tanggal_mulai, tanggal_berakhir FROM mutu_kredensial
        WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [String(b.kredensial_uuid), f], k);
      if (!row || row.pegawai_uuid !== h.pegawai_uuid || row.jenis !== "sertifikat" || row.status !== "aktif") throw tidakDitemukan("Sertifikat pelatihan pegawai");
    } else {
      const s = b.sertifikat;
      teksWajib(s.nomor, "nomor sertifikat", 100);
      teksWajib(s.penerbit, "penerbit sertifikat", 255);
      // Kunci pegawai menserialkan pemeriksaan duplikasi nomor/penerbit pada sumber kredensial bersama.
      if (await satu(`SELECT uuid FROM mutu_kredensial WHERE faskes_uuid = $1 AND pegawai_uuid = $2 AND jenis = 'sertifikat'
        AND nomor = $3 AND penerbit = $4 AND deleted_at IS NULL LIMIT 1`, [f, h.pegawai_uuid, s.nomor.trim(), s.penerbit.trim()], k))
        throw konflik("Sertifikat dengan nomor dan penerbit tersebut sudah tercatat; tautkan kredensial yang ada");
      if (!s.tanggal_mulai) throw permintaanSalah("Tanggal mulai sertifikat wajib diisi");
      let akhir = s.tanggal_berakhir;
      if (akhir == null && g.masa_berlaku_tahun) {
        const mulai = new Date((awalHariWib(s.tanggal_mulai) + 7 * 3600) * 1000);
        const tahun = mulai.getUTCFullYear() + Number(g.masa_berlaku_tahun), bulan = mulai.getUTCMonth();
        akhir = Date.UTC(tahun, bulan, Math.min(mulai.getUTCDate(), new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate())) / 1000 - 7 * 3600;
      }
      row = await catatKredensial(k, req, { ...s, tanggal_berakhir: akhir, pegawai_uuid: h.pegawai_uuid, jenis: "sertifikat" }, maksMb);
    }
    return row.uuid;
  };
  return {
    simpanKatalog: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, { cakupan, ...data } = validasiKatalog(req.body ?? {});
      const lama = req.params.uuid ? await milik("katalog", req.params.uuid, f, k) : null;
      if (lama) versiSama(lama, req.body.versi);
      for (const c of cakupan) await cekCakupan(c, f, k);
      const row = await simpan("katalog", lama, data, req, k);
      if (lama) await query(`UPDATE sdm_pelatihan_cakupan SET deleted_at = $1, updated_at = $1, versi = versi + 1
        WHERE katalog_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL`, [sekarang(), row.uuid, f], k);
      for (const c of cakupan) await simpan("cakupan", null, { ...c, katalog_uuid: row.uuid }, req, k);
      return { ...row, cakupan };
    }),
    hapusKatalog: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, lama = await milik("katalog", req.params.uuid, f, k);
      versiSama(lama, req.body?.versi);
      const alasan = teksWajib(req.body?.alasan, "alasan penghapusan", 2000);
      if (await satu(`SELECT uuid FROM sdm_pelatihan_kegiatan WHERE katalog_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL LIMIT 1`, [lama.uuid, f], k))
        throw konflik("Katalog masih digunakan kegiatan aktif");
      const row = await simpan("katalog", lama, { deleted_at: sekarang() }, req, k);
      const cakupan = await query(`SELECT * FROM sdm_pelatihan_cakupan WHERE katalog_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [lama.uuid, f], k);
      for (const c of cakupan) await simpan("cakupan", c, { deleted_at: sekarang() }, req, k);
      await audit(k, req, "hapus", TABEL.katalog, row.uuid, { alasan });
      return row;
    }),
    simpanKebijakan: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, { target, ...data } = validasiKebijakan(req.body ?? {});
      // Versi baru tidak menimpa kebijakan kegiatan lama. Token versi mencegah dua editor menyimpan bersamaan.
      await query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`pelatihan:${f}:${data.tahun}`], k);
      const lama = await satu(`SELECT * FROM sdm_pelatihan_kebijakan WHERE faskes_uuid = $1 AND tahun = $2 AND deleted_at IS NULL ORDER BY versi DESC LIMIT 1 FOR UPDATE`, [f, data.tahun], k);
      if ((lama?.uuid ?? null) !== (req.body.kebijakan_sebelumnya_uuid ?? null)) throw konflik("Kebijakan telah berubah. Muat ulang sebelum menyimpan kembali.");
      if (lama && lama.zona_waktu !== data.zona_waktu) throw konflik("Zona waktu tahun yang sudah ditetapkan tidak dapat diubah");
      for (const t of target) await cekCakupan(t, f, k);
      const row = await simpan("kebijakan", null, { ...data, versi: Number(lama?.versi ?? 0) + 1 }, req, k);
      for (const t of target) await simpan("target", null, { ...t, kebijakan_uuid: row.uuid }, req, k);
      return { ...row, target };
    }),
    simpanKegiatan: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, b = req.body ?? {}, data = validasiKegiatan(b);
      if (req.params.uuid) {
        const lama = await milik("kegiatan", req.params.uuid, f, k);
        versiSama(lama, b.versi); bolehKelola(lama);
        await tidakAdaHasil(lama, f, k);
        const kebijakan = await milik("kebijakan", lama.kebijakan_uuid, f, k, false);
        cocokTahun(data, kebijakan);
        const n = await satu(`SELECT count(*) AS n FROM sdm_pelatihan_peserta WHERE kegiatan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status_pendaftaran = 'terdaftar'`, [lama.uuid, f], k);
        if (data.kapasitas && Number(n.n) > data.kapasitas) throw konflik("Kapasitas lebih kecil dari jumlah peserta terdaftar");
        return simpan("kegiatan", lama, data, req, k);
      }
      const katalog = await milik("katalog", b.katalog_uuid, f, k);
      const kebijakan = await milik("kebijakan", b.kebijakan_uuid, f, k, false);
      cocokTahun(data, kebijakan);
      return simpan("kegiatan", null, {
        ...data, katalog_uuid: katalog.uuid, kebijakan_uuid: kebijakan.uuid, nama_pelatihan: katalog.nama,
        kategori: katalog.kategori, jam: katalog.jam, masa_berlaku_tahun: katalog.masa_berlaku_tahun, status: "rencana",
      }, req, k);
    }),
    statusKegiatan: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, b = req.body ?? {}, lama = await milik("kegiatan", req.params.uuid, f, k);
      versiSama(lama, b.versi);
      if (!(TRANSISI[lama.status] ?? []).includes(b.status)) throw konflik("Perubahan status kegiatan tidak diizinkan");
      if (b.status === "dibatalkan") { teksWajib(b.alasan, "alasan pembatalan", 2000); await tidakAdaHasil(lama, f, k); }
      if (b.status === "selesai") {
        if (Number(lama.jadwal_selesai) > sekarang()) throw permintaanSalah("Kegiatan belum mencapai waktu selesai");
        if (await satu(`SELECT uuid FROM sdm_pelatihan_peserta WHERE kegiatan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
          AND status_pendaftaran = 'terdaftar' AND status_verifikasi <> 'terverifikasi' LIMIT 1`, [lama.uuid, f], k)) throw konflik("Seluruh hasil peserta harus diverifikasi sebelum kegiatan diselesaikan");
      }
      return simpan("kegiatan", lama, { status: b.status, alasan_koreksi: b.alasan ?? null }, req, k);
    }),
    bukaKegiatan: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, lama = await milik("kegiatan", req.params.uuid, f, k);
      versiSama(lama, req.body?.versi);
      if (lama.status !== "selesai") throw konflik("Hanya kegiatan selesai yang dapat dibuka kembali");
      const alasan = teksWajib(req.body.alasan, "alasan koreksi", 2000);
      const peserta = await query(`SELECT * FROM sdm_pelatihan_peserta WHERE kegiatan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [lama.uuid, f], k);
      for (const p of peserta) await simpan("peserta", p, { ...BELUM, alasan_koreksi: alasan }, req, k);
      return simpan("kegiatan", lama, { status: "berlangsung", alasan_koreksi: alasan }, req, k);
    }),
    hapusKegiatan: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, lama = await milik("kegiatan", req.params.uuid, f, k);
      versiSama(lama, req.body?.versi);
      if (lama.status === "selesai") throw konflik("Kegiatan selesai tidak dapat dihapus");
      await tidakAdaHasil(lama, f, k);
      const alasan = teksWajib(req.body?.alasan, "alasan penghapusan", 2000);
      const peserta = await query(`SELECT * FROM sdm_pelatihan_peserta WHERE kegiatan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [lama.uuid, f], k);
      for (const p of peserta) await simpan("peserta", p, { deleted_at: sekarang(), status_pendaftaran: "dibatalkan", alasan_koreksi: alasan }, req, k);
      return simpan("kegiatan", lama, { deleted_at: sekarang(), alasan_koreksi: alasan }, req, k);
    }),
    daftarPeserta: (req) => transaksi(async (k) => {
      const f = req.author.faskesUuid, b = req.body ?? {}, g = await milik("kegiatan", req.params.uuid, f, k);
      bolehKelola(g); versiSama(g, b.versi);
      const ids = b.pegawai_uuids;
      if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length)
        throw permintaanSalah("Pilih 1–500 pegawai berbeda");
      const n = await satu(`SELECT count(*) AS n FROM sdm_pelatihan_peserta WHERE kegiatan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status_pendaftaran = 'terdaftar'`, [g.uuid, f], k);
      if (g.kapasitas && Number(n.n) + ids.length > Number(g.kapasitas)) throw konflik("Kapasitas kegiatan tidak mencukupi");
      // Validasi seluruh kelompok sebelum INSERT; kegagalan satu pegawai membatalkan semuanya.
      for (const id of [...ids].sort()) {
        await pegawaiAktif(id, f, k);
        if (await satu(`SELECT uuid FROM sdm_pelatihan_peserta WHERE kegiatan_uuid = $1 AND faskes_uuid = $2 AND pegawai_uuid = $3 AND deleted_at IS NULL`, [g.uuid, f, id], k)) throw konflik("Pegawai sudah terdaftar pada kegiatan");
      }
      const peserta = [];
      for (const id of ids) peserta.push(await simpan("peserta", null, { kegiatan_uuid: g.uuid, pegawai_uuid: id }, req, k));
      const kegiatan = await simpan("kegiatan", g, {}, req, k);
      return { peserta, kegiatan };
    }),
    hapusPeserta: (req) => transaksi(async (k) => {
      const { g, p } = await pasangan(req, k); bolehKelola(g);
      if (p.status_verifikasi === "terverifikasi" || p.kredensial_uuid) throw konflik("Peserta memiliki hasil terverifikasi atau sertifikat; lakukan koreksi");
      const alasan = teksWajib(req.body.alasan, "alasan pembatalan", 2000);
      await simpan("kegiatan", g, {}, req, k);
      return simpan("peserta", p, { deleted_at: sekarang(), status_pendaftaran: "dibatalkan", alasan_koreksi: alasan }, req, k);
    }),
    catatHasil: (req) => transaksi(async (k) => {
      const { g, p } = await pasangan(req, k); bolehKelola(g);
      if (g.status !== "berlangsung") throw konflik("Hasil hanya dapat dicatat pada kegiatan berlangsung");
      if (p.status_verifikasi === "terverifikasi") throw konflik("Hasil sudah diverifikasi; buka koreksi terlebih dahulu");
      return simpan("peserta", p, validasiHasil(req.body, g), req, k);
    }),
    verifikasi: (req) => transaksi(async (k) => {
      const { g, p, f } = await pasangan(req, k);
      if (g.status !== "berlangsung") throw konflik("Verifikasi hanya dapat dilakukan pada kegiatan berlangsung");
      if (p.status_verifikasi === "terverifikasi") throw konflik("Hasil sudah diverifikasi");
      if (!req.body.sertifikat && !req.body.kredensial_uuid) await pegawaiAktif(p.pegawai_uuid, f, k);
      validasiHasil(p, g);
      const kebijakan = await milik("kebijakan", g.kebijakan_uuid, f, k, false);
      const jamDiakui = hitungJam(p, g, kebijakan);
      const kredensialUuid = req.body.sertifikat || req.body.kredensial_uuid ? await sertifikat(req, g, p, k) : p.kredensial_uuid;
      return simpan("peserta", p, { jam_diakui: jamDiakui, status_verifikasi: "terverifikasi", diverifikasi_oleh: req.author.username ?? null,
        diverifikasi_at: sekarang(), kredensial_uuid: kredensialUuid }, req, k);
    }),
    koreksi: (req) => transaksi(async (k) => {
      const { g, p } = await pasangan(req, k); bolehKelola(g);
      const alasan = teksWajib(req.body.alasan, "alasan koreksi", 2000);
      return simpan("peserta", p, { ...BELUM, alasan_koreksi: alasan }, req, k);
    }),
    sertifikat: (req) => transaksi(async (k) => {
      const { g, p } = await pasangan(req, k);
      if (g.status === "dibatalkan" || p.status_verifikasi !== "terverifikasi") throw konflik("Hasil harus diverifikasi sebelum mencatat sertifikat");
      return simpan("peserta", p, { kredensial_uuid: await sertifikat(req, g, p, k) }, req, k);
    }),
  };
};
