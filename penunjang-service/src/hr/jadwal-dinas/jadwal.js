import { bulan, tanggalBulan, teks, wajib, periksaVersi, rentang, hari, rencanaSalin, rencanaRotasi, galat } from "./bersama.js";
import { validasiJadwal } from "./validasi.js";

export const buatJadwal = (r, a, master) => {
  const nilai = async (k, req, v, kandidat, kecuali = [v.jadwal_uuid], tambahan = []) => {
    const f = a.faskes(req), potret = await r.aturan(k, f, v.unit_uuid);
    potret.kebutuhan.sort((x, y) => x.uuid.localeCompare(y.uuid));
    const akhir = tanggalBulan(v.periode_mulai).at(-1) + 86400;
    const lainnya = await r.lainnya(k, f, kecuali, v.periode_mulai - 1209600, akhir + 1209600);
    const hasil = validasiJadwal({ kandidat, lainnya: [...lainnya, ...tambahan], ...potret, periode: v.periode_mulai });
    for (const p of kandidat) {
      try { await a.layak(k, req, p.kepegawaian_uuid, v.unit_uuid, Number(p.tanggal_kerja), p.selesai_epoch ? Number(p.selesai_epoch) : Number(p.tanggal_kerja) + 1); }
      catch (e) {
        if (e.status !== 422) throw e;
        hasil.temuan.push({ aturan: "kelayakan", tingkat: "pemblokir", kepegawaian_uuid: p.kepegawaian_uuid, tanggal_kerja: p.tanggal_kerja, message: e.message });
        hasil.boleh_diajukan = false;
      }
    }
    const penyetuju = await r.satu(`SELECT uuid FROM hr_kewenangan_jadwal WHERE faskes_uuid = $1 AND unit_uuid = $2 AND kewenangan = 'setujui'
      AND berlaku_mulai <= $3 AND (berlaku_sampai IS NULL OR berlaku_sampai > $3) AND deleted_at IS NULL`, [f, v.unit_uuid, r.sekarang()], k);
    if (!penyetuju) {
      hasil.temuan.push({ aturan: "konfigurasi", tingkat: "pemblokir", message: "Pejabat penyetuju unit belum ditetapkan" });
      hasil.boleh_diajukan = false;
    }
    return { ...hasil, potret, diperiksa_pada: r.sekarang(), versi_kunci: Number(v.versi_kunci) };
  };
  const simpanValidasi = (k, req, v, hasil) => r.sisipkan("hr_validasi_jadwal", {
    faskes_uuid: a.faskes(req), versi_uuid: v.uuid, versi_kunci_diperiksa: v.versi_kunci, diperiksa_pada: hasil.diperiksa_pada,
    aturan_diperiksa: hasil.potret, temuan: hasil.temuan, boleh_diajukan: hasil.boleh_diajukan,
  }, k);
  const harusLolos = (hasil) => { if (!hasil.boleh_diajukan) throw galat(422, "Jadwal belum dapat diproses", { kode: "VALIDASI_JADWAL", ...hasil, potret: undefined }); };
  const buat = async (req) => {
    await a.hak(req, "Jadwal Dinas", "CREATE");
    const f = a.faskes(req), periode = bulan(req.body.periode_mulai), unit = teks(req.body.unit_uuid, "Unit", 255);
    return r.transaksi(f, async (k) => {
      await a.unit(k, req, unit, "susun");
      const ada = await r.satu(`SELECT uuid FROM hr_jadwal_dinas WHERE faskes_uuid = $1 AND unit_uuid = $2 AND periode_mulai = $3 AND deleted_at IS NULL`, [f, unit, periode], k);
      wajib(!ada, "Jadwal periode ini sudah ada; buka jadwal tersebut", 409);
      const j = await r.sisipkan("hr_jadwal_dinas", { faskes_uuid: f, unit_uuid: unit, periode_mulai: periode }, k);
      const v = await r.versiBaru(k, req, j);
      await r.catatPeristiwa(k, req, "buat_jadwal", { jadwal_uuid: j.uuid, versi_uuid: v.uuid, status_sesudah: "draf" });
      return v;
    });
  };
  const hakBaca = async (req) => {
    try { await a.hak(req, "Jadwal Dinas", "READ"); }
    catch (e) { if (e.status !== 403) throw e; await a.hak(req, "Persetujuan Jadwal", "READ"); }
  };
  const daftar = async (req) => {
    await hakBaca(req);
    const q = req.query, f = a.faskes(req);
    await a.unit(null, req, q.unit_uuid);
    const periode = bulan(q.periode_mulai);
    return r.query(`SELECT v.*, j.unit_uuid, j.periode_mulai, j.versi_aktif_uuid FROM hr_jadwal_dinas j
      JOIN hr_jadwal_versi v ON v.jadwal_uuid = j.uuid AND v.faskes_uuid = j.faskes_uuid AND v.deleted_at IS NULL
      WHERE j.faskes_uuid = $1 AND j.unit_uuid = $2 AND j.periode_mulai = $3 AND j.deleted_at IS NULL ORDER BY v.nomor_versi DESC`, [f, q.unit_uuid, periode]);
  };
  const detail = async (req) => {
    await hakBaca(req);
    const f = a.faskes(req), j = await r.ambil(null, f, "hr_jadwal_dinas", req.params.uuid);
    await a.unit(null, req, j.unit_uuid);
    let uuid = req.query.versi_uuid;
    if (!uuid) uuid = (await r.satu(`SELECT uuid FROM hr_jadwal_versi WHERE faskes_uuid = $1 AND jadwal_uuid = $2 AND deleted_at IS NULL ORDER BY nomor_versi DESC LIMIT 1`, [f, j.uuid]))?.uuid;
    const v = await r.versi(null, f, uuid);
    wajib(v.jadwal_uuid === j.uuid, "Versi bukan bagian jadwal ini", 404);
    const penempatan = await r.query(`SELECT p.*, g.name AS nama FROM hr_penempatan_shift p
      JOIN hr_kepegawaian h ON h.uuid = p.kepegawaian_uuid AND h.faskes_uuid = p.faskes_uuid AND h.deleted_at IS NULL
      JOIN pegawai g ON g.uuid = h.pegawai_uuid AND g.faskes_uuid = h.faskes_uuid AND g.deleted_at IS NULL
      WHERE p.faskes_uuid = $1 AND p.versi_uuid = $2 AND p.deleted_at IS NULL ORDER BY g.name, p.tanggal_kerja`, [f, v.uuid]);
    const validasi = await r.satu(`SELECT * FROM hr_validasi_jadwal WHERE faskes_uuid = $1 AND versi_uuid = $2 AND deleted_at IS NULL ORDER BY created_at DESC, uuid DESC LIMIT 1`, [f, v.uuid]);
    const peristiwa = await r.query(`SELECT * FROM hr_peristiwa_jadwal WHERE faskes_uuid = $1 AND jadwal_uuid = $2 AND deleted_at IS NULL ORDER BY created_at, uuid`, [f, j.uuid]);
    return { versi: v, penempatan, validasi, peristiwa };
  };
  const susun = async (k, req, v, masukan, hapus = [], pratinjau = false) => {
    const f = a.faskes(req);
    wajib(Array.isArray(masukan) && masukan.length <= 16000 && Array.isArray(hapus), "Daftar penempatan tidak sah");
    const lama = await r.penempatan(k, f, v.uuid), tanggal = tanggalBulan(v.periode_mulai);
    const kandidat = lama.filter((p) => !hapus.includes(p.uuid));
    for (const uuid of hapus) wajib(lama.some((p) => p.uuid === uuid), "Penempatan yang dihapus tidak ditemukan", 404);
    const kunci = new Set();
    for (const x of masukan) {
      wajib(x && typeof x === "object" && !Array.isArray(x), "Penempatan harus berupa objek");
      const t = hari(x.tanggal_kerja), pegawai = teks(x.kepegawaian_uuid, "Pegawai", 255), key = `${pegawai}:${t}`;
      wajib(tanggal.includes(t), "Tanggal di luar periode");
      wajib(!kunci.has(key), "Pegawai dan tanggal berulang"); kunci.add(key);
      const p = await master.pola(k, req, teks(x.pola_shift_uuid, "Pola", 255), v.unit_uuid);
      const baru = { kepegawaian_uuid: pegawai, tanggal_kerja: t, pola_shift_uuid: p.uuid, ...rentang(t, p) };
      await a.layak(k, req, pegawai, v.unit_uuid, t, baru.selesai_epoch ?? t + 1);
      const i = kandidat.findIndex((p) => p.kepegawaian_uuid === pegawai && Number(p.tanggal_kerja) === t);
      if (i >= 0) kandidat.splice(i, 1);
      kandidat.push(baru);
    }
    const hasil = await nilai(k, req, v, kandidat);
    if (hasil.temuan.some((t) => t.aturan === "benturan")) throw galat(422, "Penempatan bertumpuk; tidak ada perubahan disimpan", hasil);
    if (pratinjau) return { penempatan: kandidat, ...hasil };
    // Penggantian seluruh isi versi hanya pada draf; baris lama dipertahankan melalui penghapusan lunak.
    await r.query(`UPDATE hr_penempatan_shift SET deleted_at = $3, updated_at = $3 WHERE faskes_uuid = $1 AND versi_uuid = $2 AND deleted_at IS NULL`, [f, v.uuid, r.sekarang()], k);
    for (const p of kandidat) {
      const { uuid, created_at, updated_at, deleted_at, ...data } = p;
      await r.sisipkan("hr_penempatan_shift", { ...data, faskes_uuid: f, versi_uuid: v.uuid }, k);
    }
    const terbaru = await r.naikkan(k, f, v);
    hasil.versi_kunci = terbaru.versi_kunci;
    await simpanValidasi(k, req, terbaru, hasil);
    await r.catatPeristiwa(k, req, "susun_jadwal", { jadwal_uuid: v.jadwal_uuid, versi_uuid: v.uuid, jumlah: kandidat.length });
    return { versi: terbaru, ...hasil };
  };
  const simpan = async (req, operasi = "penempatan") => {
    await a.hak(req, "Jadwal Dinas", "UPDATE");
    const f = a.faskes(req), b = req.body;
    return r.transaksi(f, async (k) => {
      const v = await r.versi(k, f, req.params.uuid, true);
      await a.unit(k, req, v.unit_uuid, "susun");
      periksaVersi(v, b.versi_kunci, "draf");
      if (operasi === "penempatan") return susun(k, req, v, b.penempatan, b.hapus ?? []);
      wajib(typeof b.pratinjau === "boolean", "Pilihan pratinjau wajib diisi");
      let rencana;
      if (operasi === "salin") {
        const asal = await r.versi(k, f, b.sumber_versi_uuid);
        await a.unit(k, req, asal.unit_uuid);
        wajib(asal.unit_uuid === v.unit_uuid && asal.periode_mulai < v.periode_mulai, "Sumber harus periode sebelumnya dalam unit yang sama");
        rencana = rencanaSalin(await r.penempatan(k, f, asal.uuid), v.periode_mulai);
      } else {
        const rotasi = await r.ambil(k, f, "hr_rotasi_shift", b.rotasi_uuid);
        wajib(rotasi.aktif && rotasi.unit_uuid === v.unit_uuid, "Rotasi tidak aktif atau di luar unit");
        wajib(Array.isArray(b.pegawai) && b.pegawai.length > 0 && b.pegawai.length <= 500, "Daftar pegawai rotasi tidak sah");
        rencana = { penempatan: rencanaRotasi(v.periode_mulai, rotasi.urutan_pola, b.tanggal_jangkar, b.pegawai), dilewati: [] };
      }
      const valid = [];
      for (const x of rencana.penempatan) {
        try {
          const p = await master.pola(k, req, x.pola_shift_uuid, v.unit_uuid), interval = rentang(x.tanggal_kerja, p);
          await a.layak(k, req, x.kepegawaian_uuid, v.unit_uuid, x.tanggal_kerja, interval.selesai_epoch ?? x.tanggal_kerja + 1);
          valid.push(x);
        } catch (e) {
          if (![404, 422].includes(e.status)) throw e;
          rencana.dilewati.push({ ...x, message: e.message });
        }
      }
      return { ...await susun(k, req, v, valid, [], b.pratinjau), dilewati: rencana.dilewati };
    });
  };
  const validasi = async (req) => {
    await a.hak(req, "Jadwal Dinas", "READ");
    const f = a.faskes(req);
    return r.transaksi(f, async (k) => {
      const v = await r.versi(k, f, req.params.uuid, true);
      await a.unit(k, req, v.unit_uuid);
      periksaVersi(v, req.body.versi_kunci);
      const hasil = await nilai(k, req, v, await r.penempatan(k, f, v.uuid));
      await simpanValidasi(k, req, v, hasil);
      await r.catatPeristiwa(k, req, "validasi_jadwal", { jadwal_uuid: v.jadwal_uuid, versi_uuid: v.uuid });
      return hasil;
    });
  };
  return { buat, daftar, detail, simpan, validasi, nilai, simpanValidasi, harusLolos };
};
