import express from "express";
import { query, satu, sisipkan, ubah, transaksi } from "../db.js";
import { Galat, tangani, kirim, tidakDitemukan, halaman, denganHalaman } from "../umum/respons.js";
import { izinOk, punyaIzin } from "../umum/izin.js";
import { pastikan, objek, teksWajib, waktu, versiValid, statusValid, definisiValid, nilaiValid, urutanWaktu, konfigurasiBiaya } from "./pacu-validasi.js";
import { kirimBiayaPacu } from "./pacu-billing.js";
import { tanggalValid, tglLokal } from "./bersama.js";

const rute = express.Router();
const faskes = (req) => req.author.faskesUuid;
const pelaku = (req) => teksWajib(req.author.username, "Identitas pencatat");
const izin = (sub, aksi) => izinOk(`${sub} PACU`, aksi);

// Aktivasi fitur diperiksa di server, termasuk faskes yang belum memiliki segmen.
rute.use((req, res, next) => {
  const handler = tangani(async () => {
    if (req.method === "POST") pastikan(objek(req.body), "Isi permintaan harus berupa objek", 400);
    const f = faskes(req);
    const modul = await satu(`SELECT COALESCE(
      (SELECT aktif FROM faskes_modul_override WHERE faskes_uuid=$1 AND modul_kode='kamar_operasi'),
      NOT EXISTS(SELECT 1 FROM faskes_segmen WHERE faskes_uuid=$1) OR EXISTS(
        SELECT 1 FROM faskes_segmen s JOIN preset_segmen_modul p ON p.segmen_kode=s.segmen_kode
        WHERE s.faskes_uuid=$1 AND p.modul_kode='kamar_operasi')) AS aktif`, [f]);
    const fitur = await satu(`SELECT COALESCE(
      (SELECT aktif FROM faskes_fitur_override WHERE faskes_uuid=$1 AND fitur_kode='pacu'),
      NOT EXISTS(SELECT 1 FROM faskes_segmen s JOIN preset_segmen_fitur_mati p ON p.segmen_kode=s.segmen_kode
        WHERE s.faskes_uuid=$1 AND p.fitur_kode='pacu')) AS aktif`, [f]);
    pastikan(modul?.aktif && fitur?.aktif, "Fitur PACU tidak aktif", 403);
    next();
  });
  handler(req, res);
});

const ambil = async (tabel, uuid, f, k) => {
  const r = await satu(`SELECT * FROM ${tabel} WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL ${k ? "FOR UPDATE" : ""}`, [uuid, f], k);
  if (!r) throw tidakDitemukan("Data PACU");
  return r;
};
const catatan = (e, f, k) => query(`SELECT * FROM pacu_catatan WHERE episode_uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL ORDER BY waktu_kejadian, created_at, uuid`, [e.uuid, f], k);
const audit = (req, e, entitas, sebelum, sesudah, aksi, k, alasan = null) => sisipkan("pacu_riwayat", {
  faskes_uuid: faskes(req), episode_uuid: e?.uuid ?? null, entitas, entitas_uuid: sesudah.uuid,
  nilai_sebelum: sebelum, nilai_sesudah: sesudah, aksi, alasan, created_by: pelaku(req),
}, k);
const perbarui = async (req, e, data, k, aksi) => {
  const baru = await ubah("pacu_episode", e.uuid, faskes(req), { ...data, versi: e.versi + 1, updated_by: pelaku(req) }, k);
  await audit(req, e, "episode", e, baru, aksi, k);
  return baru;
};
const tambahCatatan = async (req, e, jenis, t, data, k) => {
  const baru = await sisipkan("pacu_catatan", { faskes_uuid: faskes(req), episode_uuid: e.uuid, jenis,
    waktu_kejadian: waktu(t), data, created_by: pelaku(req) }, k);
  await audit(req, e, "catatan", null, baru, "tambah", k);
  return baru;
};
const petugas = async (uuid, f, k) => {
  pastikan(await satu(`SELECT uuid FROM practitioner WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL AND COALESCE(status,true)`, [uuid, f], k), "Petugas tidak tersedia", 404);
};
const unit = async (uuid, f, k) => {
  pastikan(await satu(`SELECT uuid FROM lokasi WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL`, [uuid, f], k), "Unit tujuan tidak tersedia", 404);
};
const mutasi = (aksi) => tangani(async (req, res) => {
  const hasil = await transaksi(async (k) => {
    const e = await ambil("pacu_episode", req.params.uuid, faskes(req), k);
    versiValid(e, req.body.versi);
    return aksi(req, e, k);
  });
  if (req.path.endsWith('/selesaikan') && hasil.status === 'selesai') {
    try { hasil.biaya = await kirimBiayaPacu(req); }
    catch { hasil.biaya = { status_kirim: "perlu_rekonsiliasi", message: "Episode selesai; pengiriman biaya perlu ditindaklanjuti" }; }
  }
  kirim(res, hasil, "Data PACU berhasil disimpan");
});

rute.get("/protokol", izin("Protokol", "READ"), tangani(async (req, res) => {
  kirim(res, await query(`SELECT * FROM pacu_protokol WHERE faskes_uuid=$1 AND deleted_at IS NULL ORDER BY kode, nomor_versi DESC`, [faskes(req)]));
}));
rute.post("/protokol", izin("Protokol", "CREATE"), tangani(async (req, res) => {
  const b = req.body;
  const kode = teksWajib(b.kode, "Kode protokol");
  const definisi = definisiValid(b.definisi);
  definisi.biaya = konfigurasiBiaya(definisi.biaya);
  const hasil = await transaksi(async (k) => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`pacu:${faskes(req)}:${kode}`], k);
    const n = await satu(`SELECT COALESCE(MAX(nomor_versi),0)+1 AS n FROM pacu_protokol WHERE faskes_uuid=$1 AND kode=$2`, [faskes(req), kode], k);
    const p = await sisipkan("pacu_protokol", { faskes_uuid: faskes(req), kode, nomor_versi: n.n, definisi, created_by: pelaku(req) }, k);
    await audit(req, null, "protokol", null, p, "buat_versi", k);
    return p;
  });
  kirim(res, hasil, "Versi protokol dibuat dalam keadaan nonaktif");
}));
rute.post("/protokol/:uuid/aktifkan", izin("Protokol", "VALIDASI"), tangani(async (req, res) => {
  kirim(res, await transaksi(async (k) => {
    const p = await ambil("pacu_protokol", req.params.uuid, faskes(req), k);
    versiValid(p, req.body.versi);
    definisiValid(p.definisi);
    konfigurasiBiaya(p.definisi.biaya);
    const baru = await ubah("pacu_protokol", p.uuid, faskes(req), { aktif: true, versi: p.versi + 1, updated_by: pelaku(req) }, k);
    await audit(req, null, "protokol", p, baru, "aktifkan", k);
    return baru;
  }));
}));

rute.get("/referensi/petugas", izin("Episode", "READ"), tangani(async (req, res) => {
  kirim(res, await query(`SELECT pr.uuid, pg.name AS nama FROM practitioner pr
    JOIN pegawai pg ON pg.uuid=pr.pegawai_uuid AND pg.faskes_uuid=pr.faskes_uuid AND pg.deleted_at IS NULL
    WHERE pr.faskes_uuid=$1 AND pr.deleted_at IS NULL AND COALESCE(pr.status,true) ORDER BY pg.name`, [faskes(req)]));
}));
rute.get("/referensi/unit", izin("Episode", "READ"), tangani(async (req, res) => {
  kirim(res, await query(`SELECT uuid, name AS nama FROM lokasi WHERE faskes_uuid=$1 AND deleted_at IS NULL ORDER BY name`, [faskes(req)]));
}));
// Jadwal sumber PACU: belum batal, laporan operasi mencatat tindakan dilakukan, dan laporan anestesi tersedia
// (syarat yang sama dengan pembuatan episode). Episode yang sudah ada ikut ditampilkan agar petugas langsung membukanya.
rute.get("/referensi/jadwal", izin("Episode", "READ"), tangani(async (req, res) => {
  const p = [faskes(req), req.query.jadwal_uuid || null, req.query.tanggal ? tanggalValid(req.query.tanggal) : null];
  kirim(res, await query(`SELECT j.uuid, j.waktu_mulai::float8 AS waktu_mulai, j.status, r.nama AS ruang_nama,
      o.no_order, o.no_reg, o.no_rm, p.name AS nama_pasien, lp.tindakan_dilakukan, la.jenis_anestesi,
      la.aldrete_masuk, e.uuid AS episode_uuid, e.status AS status_episode
    FROM ok_jadwal j JOIN ok_ruang r ON r.uuid=j.ruang_uuid
    JOIN ok_order o ON o.uuid=j.order_uuid AND o.faskes_uuid=j.faskes_uuid AND o.deleted_at IS NULL
    JOIN patients p ON p.uuid=o.patient_uuid AND p.faskes_uuid=o.faskes_uuid AND p.deleted_at IS NULL
    JOIN ok_laporan_operasi lp ON lp.jadwal_uuid=j.uuid AND lp.faskes_uuid=j.faskes_uuid AND lp.deleted_at IS NULL
      AND NULLIF(TRIM(lp.tindakan_dilakukan), '') IS NOT NULL
    JOIN ok_laporan_anestesi la ON la.jadwal_uuid=j.uuid AND la.faskes_uuid=j.faskes_uuid AND la.deleted_at IS NULL
    LEFT JOIN pacu_episode e ON e.jadwal_operasi_uuid=j.uuid AND e.faskes_uuid=j.faskes_uuid AND e.deleted_at IS NULL
    WHERE j.faskes_uuid=$1 AND j.deleted_at IS NULL AND j.status <> 'batal' AND ($2::text IS NULL OR j.uuid=$2)
      AND ($3::date IS NULL OR ${tglLokal("j.waktu_mulai")} = $3::date)
    ORDER BY j.waktu_mulai DESC LIMIT 100`, p));
}));

rute.get("/", izin("Episode", "READ"), tangani(async (req, res) => {
  const pg = halaman(req.query);
  // status boleh lebih dari satu (dipisah koma), mis. antrean aktif menunggu_masuk,berada_di_pacu,...
  const status = req.query.status ? String(req.query.status).split(",").map((x) => x.trim()).filter(Boolean) : null;
  const p = [faskes(req), status?.length ? status : null, req.query.jadwal_operasi_uuid || null,
    req.query.tanggal_mulai ? tanggalValid(req.query.tanggal_mulai) : null, req.query.tanggal_selesai ? tanggalValid(req.query.tanggal_selesai) : null];
  const dari = `pacu_episode e
    JOIN ok_jadwal j ON j.uuid=e.jadwal_operasi_uuid AND j.faskes_uuid=e.faskes_uuid AND j.deleted_at IS NULL
    JOIN ok_order o ON o.uuid=j.order_uuid AND o.faskes_uuid=j.faskes_uuid AND o.deleted_at IS NULL
    JOIN patients p ON p.uuid=o.patient_uuid AND p.faskes_uuid=o.faskes_uuid AND p.deleted_at IS NULL
    LEFT JOIN lokasi lt ON lt.uuid=e.unit_tujuan_uuid AND lt.faskes_uuid=e.faskes_uuid`;
  const w = `e.faskes_uuid=$1 AND e.deleted_at IS NULL AND ($2::text[] IS NULL OR e.status = ANY($2::text[])) AND ($3::text IS NULL OR e.jadwal_operasi_uuid=$3)
    AND ($4::date IS NULL OR ${tglLokal("e.created_at")} >= $4::date) AND ($5::date IS NULL OR ${tglLokal("e.created_at")} <= $5::date)`;
  const total = await satu(`SELECT count(*) n FROM ${dari} WHERE ${w}`, p);
  kirim(res, denganHalaman(await query(`SELECT e.*, p.name AS nama_pasien, o.no_reg, o.no_rm, lt.name AS unit_tujuan_nama FROM ${dari} WHERE ${w} ORDER BY e.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p), total.n, pg));
}));
rute.post("/", izin("Episode", "CREATE"), tangani(async (req, res) => {
  const f = faskes(req);
  const hasil = await transaksi(async (k) => {
    const j = await ambil("ok_jadwal", teksWajib(req.body.jadwal_operasi_uuid, "Jadwal operasi"), f, k);
    pastikan(j.status !== "batal", "Jadwal telah dibatalkan");
    const ada = await satu(`SELECT uuid FROM pacu_episode WHERE faskes_uuid=$1 AND jadwal_operasi_uuid=$2 AND deleted_at IS NULL`, [f, j.uuid], k);
    pastikan(!ada, `Episode PACU sudah ada${ada && await punyaIzin(req, "Kamar Operasi", "Episode PACU", "READ") ? `: ${ada.uuid}` : ""}`, 409);
    const o = await ambil("ok_order", j.order_uuid, f, k);
    pastikan(await satu(`SELECT uuid FROM patients WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL`, [o.patient_uuid, f], k), "Pasien sumber tidak tersedia", 404);
    const sumber = { rajal: ["rawat_jalans", "RJ"], ranap: ["rawat_inaps", "RI"], igd: ["instalasi_gawat_darurats", "IGD"] }[o.sumber];
    pastikan(sumber, "Sumber kunjungan tidak valid");
    const kunjungan = await satu(`SELECT uuid, patient_uuid, rekam_medis_uuid FROM ${sumber[0]}
      WHERE no_reg=$1 AND faskes_uuid=$2 AND deleted_at IS NULL FOR SHARE`, [o.no_reg, f], k);
    pastikan(kunjungan && kunjungan.patient_uuid === o.patient_uuid && kunjungan.rekam_medis_uuid === o.rekam_medis_uuid, "Kunjungan sumber tidak tersedia", 404);
    const lp = await satu(`SELECT uuid, tindakan_dilakukan FROM ok_laporan_operasi WHERE jadwal_uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL`, [j.uuid, f], k);
    pastikan(lp?.tindakan_dilakukan?.trim(), "Bukti tindakan operasi belum dicatat");
    pastikan(await satu(`SELECT uuid FROM ok_laporan_anestesi WHERE jadwal_uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL`, [j.uuid, f], k), "Laporan anestesi belum tersedia");
    const p = await ambil("pacu_protokol", req.body.protokol_uuid, f, k);
    pastikan(p.aktif, "Protokol belum aktif");
    const e = await sisipkan("pacu_episode", { faskes_uuid: f, jadwal_operasi_uuid: j.uuid, kunjungan_uuid: kunjungan.uuid,
      sumber: sumber[1], protokol_uuid: p.uuid, protokol_snapshot: p.definisi, created_by: pelaku(req) }, k);
    await audit(req, e, "episode", null, e, "buat", k);
    return e;
  }).catch((error) => {
    // Dua permintaan bersamaan: indeks unik pacu_episode_jadwal_uq menolak episode kedua.
    if (error.code === "23505") throw new Galat(409, "Episode PACU untuk jadwal ini sudah dibuat");
    throw error;
  });
  kirim(res, hasil, "Episode PACU berhasil dibuat");
}));
rute.get("/:uuid", izin("Episode", "READ"), tangani(async (req, res) => {
  const f = faskes(req);
  const e = await ambil("pacu_episode", req.params.uuid, f);
  const konteks = await satu(`SELECT j.uuid AS jadwal_uuid, o.no_reg, o.patient_uuid, p.name AS nama_pasien,
      o.no_rm, r.nama AS ruang_nama, j.waktu_mulai::float8 AS waktu_operasi,
      lp.uuid AS laporan_operasi_uuid, lp.tindakan_dilakukan, la.uuid AS laporan_anestesi_uuid, la.jenis_anestesi,
      la.aldrete_masuk, la.aldrete_keluar, pp.kode AS protokol_kode, pp.nomor_versi AS protokol_versi
    FROM ok_jadwal j JOIN ok_ruang r ON r.uuid=j.ruang_uuid
    LEFT JOIN pacu_protokol pp ON pp.uuid=$3 AND pp.faskes_uuid=j.faskes_uuid JOIN ok_order o ON o.uuid=j.order_uuid AND o.faskes_uuid=j.faskes_uuid AND o.deleted_at IS NULL
    JOIN patients p ON p.uuid=o.patient_uuid AND p.faskes_uuid=o.faskes_uuid AND p.deleted_at IS NULL
    LEFT JOIN ok_laporan_operasi lp ON lp.jadwal_uuid=j.uuid AND lp.faskes_uuid=j.faskes_uuid AND lp.deleted_at IS NULL
    LEFT JOIN ok_laporan_anestesi la ON la.jadwal_uuid=j.uuid AND la.faskes_uuid=j.faskes_uuid AND la.deleted_at IS NULL
    WHERE j.uuid=$1 AND j.faskes_uuid=$2 AND j.deleted_at IS NULL`, [e.jadwal_operasi_uuid, f, e.protokol_uuid]);
  if (!konteks) throw tidakDitemukan("Konteks operasi");
  kirim(res, { ...e, konteks });
}));
for (const [path, sub, tabel] of [["riwayat", "Riwayat", "pacu_riwayat"], ["biaya", "Biaya", "pacu_biaya"]]) {
  rute.get(`/:uuid/${path}`, izin(sub, "READ"), tangani(async (req, res) => {
    await ambil("pacu_episode", req.params.uuid, faskes(req));
    const pg = halaman(req.query);
    kirim(res, await query(`SELECT * FROM ${tabel} WHERE episode_uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, [req.params.uuid, faskes(req)]));
  }));
}
for (const [path, sub, jenis] of [["pemantauan", "Pemantauan", "pemantauan"], ["asesmen", "Asesmen", "asesmen"], ["intervensi", "Intervensi", "intervensi"], ["serah-terima", "Serah Terima", null]]) {
  rute.get(`/:uuid/${path}`, izin(sub, "READ"), tangani(async (req, res) => {
    const e = await ambil("pacu_episode", req.params.uuid, faskes(req));
    const pg = halaman(req.query);
    const semua = (await catatan(e, faskes(req))).filter((c) => jenis ? c.jenis === jenis : c.jenis.startsWith("serah_terima"));
    kirim(res, denganHalaman(semua.slice(pg.offset, pg.offset + pg.limit), semua.length, pg));
  }));
}
rute.post("/:uuid/kedatangan", izin("Episode", "TERIMA"), izin("Serah Terima", "CREATE"), mutasi(async (req, e, k) => {
  statusValid(e, "menunggu_masuk");
  const b = req.body;
  const st = b.serah_terima_masuk;
  pastikan(objek(st), "Serah terima masuk wajib diisi");
  await petugas(st.penyerah_uuid, faskes(req), k);
  nilaiValid(e.protokol_snapshot.format_serah_terima, st.isi);
  const t = waktu(b.waktu_tiba);
  await tambahCatatan(req, e, "serah_terima_masuk", t, { isi: st.isi, penyerah_uuid: st.penyerah_uuid, penerima: pelaku(req), waktu_terima: t }, k);
  return perbarui(req, e, { waktu_tiba: t, status: "berada_di_pacu" }, k, "kedatangan");
}));
rute.post("/:uuid/mulai-pemantauan", izin("Episode", "UPDATE"), mutasi(async (req, e, k) => {
  statusValid(e, "berada_di_pacu");
  const data = { waktu_mulai_pemantauan: waktu(req.body.waktu_mulai_pemantauan), status: "dalam_pemantauan" };
  urutanWaktu({ ...e, ...data });
  return perbarui(req, e, data, k, "mulai_pemantauan");
}));
rute.post("/:uuid/pemantauan", izin("Pemantauan", "CREATE"), mutasi(async (req, e, k) => {
  statusValid(e, "dalam_pemantauan", "siap_dipindahkan");
  nilaiValid(e.protokol_snapshot.parameter, req.body.nilai_parameter);
  const c = { jenis: "pemantauan", waktu_kejadian: waktu(req.body.waktu_ukur) };
  urutanWaktu(e, [c]);
  const baru = await tambahCatatan(req, e, c.jenis, c.waktu_kejadian, { nilai_parameter: req.body.nilai_parameter, catatan: req.body.catatan ?? null }, k);
  await perbarui(req, e, {}, k, "pemantauan");
  return baru;
}));
rute.post("/:uuid/asesmen", izin("Asesmen", "VALIDASI"), mutasi(async (req, e, k) => {
  statusValid(e, "dalam_pemantauan", "siap_dipindahkan");
  const b = req.body;
  pastikan(["siap", "belum_siap"].includes(b.keputusan), "Keputusan asesmen tidak valid");
  teksWajib(b.hasil_asesmen, "Hasil asesmen");
  teksWajib(b.alasan, "Alasan keputusan");
  nilaiValid(e.protokol_snapshot.kriteria_pindah, b.hasil_kriteria);
  const t = waktu(b.waktu_asesmen);
  const daftar = await catatan(e, faskes(req), k);
  pastikan(!daftar.some((c) => c.jenis === "asesmen" && Number(c.waktu_kejadian) > t), "Keputusan tidak boleh mendahului asesmen terakhir");
  urutanWaktu(e, [{ jenis: "asesmen", waktu_kejadian: t }]);
  if (b.keputusan === "siap") {
    await unit(b.unit_tujuan_uuid, faskes(req), k);
    pastikan(daftar.some((c) => c.jenis === "pemantauan" && Number(c.waktu_kejadian) <= t), "Pemantauan wajib dicatat sebelum keputusan");
  }
  // Serah terima yang disusun sebelum keputusan baru harus disusun dan diterima kembali.
  for (const c of daftar.filter((c) => c.jenis === "serah_terima_keluar" && !c.data.dibatalkan)) {
    pastikan(t >= Number(c.data.waktu_terima ?? c.waktu_kejadian), "Asesmen baru mendahului serah terima sebelumnya");
    const baru = await ubah("pacu_catatan", c.uuid, faskes(req), { data: { ...c.data, dibatalkan: true }, versi: c.versi + 1, updated_by: pelaku(req) }, k);
    await audit(req, e, "catatan", c, baru, "batalkan_serah_terima", k, b.alasan);
  }
  await tambahCatatan(req, e, "asesmen", t, { hasil_asesmen: b.hasil_asesmen, hasil_kriteria: b.hasil_kriteria,
    keputusan: b.keputusan, alasan: b.alasan, unit_tujuan_uuid: b.keputusan === "siap" ? b.unit_tujuan_uuid : null }, k);
  return perbarui(req, e, { status: b.keputusan === "siap" ? "siap_dipindahkan" : "dalam_pemantauan",
    waktu_siap_pindah: b.keputusan === "siap" ? t : null, unit_tujuan_uuid: b.keputusan === "siap" ? b.unit_tujuan_uuid : null }, k, "asesmen");
}));
rute.post("/:uuid/intervensi", izin("Intervensi", "CREATE"), mutasi(async (req, e, k) => {
  statusValid(e, "dalam_pemantauan", "siap_dipindahkan");
  const b = req.body;
  pastikan(["obat", "bhp", "tindakan"].includes(b.jenis), "Jenis intervensi tidak valid");
  await petugas(b.pelaksana_uuid, faskes(req), k);
  pastikan(objek(b.rincian), "Rincian intervensi wajib diisi");
  teksWajib(b.rincian.nama, "Nama intervensi");
  if (b.jenis === "obat") for (const x of ["dosis", "satuan", "rute"]) teksWajib(b.rincian[x], x);
  urutanWaktu(e, [{ jenis: "intervensi", waktu_kejadian: waktu(b.waktu_tindakan) }]);
  const baru = await tambahCatatan(req, e, "intervensi", b.waktu_tindakan, { jenis: b.jenis, pelaksana_uuid: b.pelaksana_uuid, rincian: b.rincian, catatan: b.catatan ?? null }, k);
  await perbarui(req, e, {}, k, "intervensi");
  return baru;
}));
rute.post("/:uuid/serah-terima", izin("Serah Terima", "CREATE"), mutasi(async (req, e, k) => {
  statusValid(e, "siap_dipindahkan");
  const b = req.body;
  pastikan(b.unit_tujuan_uuid === e.unit_tujuan_uuid, "Unit tidak sesuai keputusan asesmen");
  await unit(b.unit_tujuan_uuid, faskes(req), k);
  nilaiValid(e.protokol_snapshot.format_serah_terima, b.isi);
  const t = waktu(b.waktu_serah);
  pastikan(t >= Number(e.waktu_siap_pindah), "Serah terima mendahului keputusan");
  const daftar = await catatan(e, faskes(req), k);
  pastikan(!daftar.some((c) => c.jenis === "serah_terima_keluar" && !c.data.dibatalkan), "Serah terima keluar sudah tersedia", 409);
  const baru = await tambahCatatan(req, e, "serah_terima_keluar", t, { unit_tujuan_uuid: b.unit_tujuan_uuid, isi: b.isi, penyerah: pelaku(req) }, k);
  await perbarui(req, e, {}, k, "serah_terima");
  return baru;
}));
rute.post("/:uuid/serah-terima/:serah_uuid/terima", izin("Serah Terima", "TERIMA"), mutasi(async (req, e, k) => {
  statusValid(e, "siap_dipindahkan");
  const c = await ambil("pacu_catatan", req.params.serah_uuid, faskes(req), k);
  pastikan(c.episode_uuid === e.uuid && c.jenis === "serah_terima_keluar" && !c.data.dibatalkan, "Serah terima tidak tersedia", 404);
  pastikan(!c.data.penerima, "Serah terima telah diterima", 409);
  const t = waktu(req.body.waktu_terima);
  pastikan(t >= Number(c.waktu_kejadian), "Penerimaan mendahului penyerahan");
  const baru = await ubah("pacu_catatan", c.uuid, faskes(req), { data: { ...c.data, penerima: pelaku(req), waktu_terima: t }, versi: c.versi + 1, updated_by: pelaku(req) }, k);
  await audit(req, e, "catatan", c, baru, "terima", k);
  await perbarui(req, e, {}, k, "terima_serah_terima");
  return baru;
}));
rute.post("/:uuid/selesaikan", izin("Episode", "SELESAIKAN"), mutasi(async (req, e, k) => {
  statusValid(e, "siap_dipindahkan");
  const daftar = await catatan(e, faskes(req), k);
  const st = daftar.find((c) => c.jenis === "serah_terima_keluar" && !c.data.dibatalkan && c.data.penerima && c.data.unit_tujuan_uuid === e.unit_tujuan_uuid);
  pastikan(st, "Serah terima belum diterima");
  const t = waktu(req.body.waktu_keluar);
  pastikan(t >= Number(st.data.waktu_terima), "Waktu keluar mendahului penerimaan");
  urutanWaktu({ ...e, waktu_keluar: t }, daftar);
  const cfg = konfigurasiBiaya(e.protokol_snapshot.biaya);
  if (cfg.aktif && !cfg.termasuk_paket) {
    const biaya = await sisipkan("pacu_biaya", { faskes_uuid: faskes(req), episode_uuid: e.uuid,
      kunci_idempoten: `pacu:${e.uuid}:${cfg.layanan_uuid}`, konfigurasi_snapshot: cfg, created_by: pelaku(req) }, k);
    await audit(req, e, "biaya", null, biaya, "buat_biaya", k);
  }
  return perbarui(req, e, { status: "selesai", waktu_keluar: t }, k, "selesaikan");
}));
rute.post("/:uuid/biaya/kirim-ulang", izin("Biaya", "KIRIM"), tangani(async (req, res) => {
  await ambil("pacu_episode", req.params.uuid, faskes(req));
  kirim(res, await kirimBiayaPacu(req));
}));
rute.post("/:uuid/koreksi", izin("Koreksi", "UPDATE"), mutasi(async (req, e, k) => {
  const b = req.body;
  teksWajib(b.alasan, "Alasan koreksi");
  if (b.jenis_entitas === "catatan") {
    const c = await ambil("pacu_catatan", b.entitas_uuid, faskes(req), k);
    pastikan(c.episode_uuid === e.uuid, "Catatan tidak tersedia", 404);
    versiValid(c, b.versi_catatan);
    pastikan(objek(b.perubahan), "Perubahan catatan tidak valid");
    const diizinkan = { pemantauan: ["nilai_parameter", "catatan", "waktu_kejadian"], intervensi: ["rincian", "catatan", "waktu_kejadian"], asesmen: ["hasil_asesmen", "hasil_kriteria"] }[c.jenis];
    pastikan(diizinkan && Object.keys(b.perubahan).length > 0 && Object.keys(b.perubahan).every((x) => diizinkan.includes(x)), "Kolom koreksi catatan tidak diizinkan; keputusan diubah melalui asesmen baru");
    const { waktu_kejadian: waktuKoreksi, ...isi } = b.perubahan;
    const waktuBaru = waktuKoreksi === undefined ? Number(c.waktu_kejadian) : waktu(waktuKoreksi);
    urutanWaktu(e, [{ ...c, waktu_kejadian: waktuBaru }]);
    if (c.jenis === "pemantauan") {
      const daftar = (await catatan(e, faskes(req), k)).map((x) => x.uuid === c.uuid ? { ...x, waktu_kejadian: waktuBaru } : x);
      for (const a of daftar.filter((x) => x.jenis === "asesmen" && x.data.keputusan === "siap")) {
        pastikan(daftar.some((x) => x.jenis === "pemantauan" && Number(x.waktu_kejadian) <= Number(a.waktu_kejadian)), "Koreksi menghilangkan pemantauan sebelum keputusan kesiapan");
      }
    }
    const data = { ...c.data, ...isi };
    if (c.jenis === "pemantauan") nilaiValid(e.protokol_snapshot.parameter, data.nilai_parameter);
    if (c.jenis === "asesmen") {
      teksWajib(data.hasil_asesmen, "Hasil asesmen");
      nilaiValid(e.protokol_snapshot.kriteria_pindah, data.hasil_kriteria);
    }
    if (c.jenis === "intervensi") {
      pastikan(objek(data.rincian), "Rincian intervensi tidak valid");
      teksWajib(data.rincian.nama, "Nama intervensi");
      if (data.jenis === "obat") for (const x of ["dosis", "satuan", "rute"]) teksWajib(data.rincian[x], x);
    }
    const baru = await ubah("pacu_catatan", c.uuid, faskes(req), { data, waktu_kejadian: waktuBaru, versi: c.versi + 1, updated_by: pelaku(req) }, k);
    await audit(req, e, "catatan", c, baru, "koreksi", k, b.alasan);
    await perbarui(req, e, {}, k, "koreksi_catatan");
    return baru;
  }
  pastikan(objek(b.perubahan) && b.jenis_entitas === "episode", "Koreksi hanya menerima waktu episode");
  const kolom = Object.keys(b.perubahan);
  pastikan(kolom.length > 0 && kolom.every((x) => ["waktu_tiba", "waktu_mulai_pemantauan", "waktu_siap_pindah", "waktu_keluar"].includes(x) && e[x] != null), "Kolom koreksi tidak diizinkan");
  for (const x of kolom) waktu(b.perubahan[x]);
  const baru = { ...e, ...b.perubahan };
  // Serah terima masuk adalah peristiwa kedatangan itu sendiri: waktunya ikut dikoreksi bersama waktu tiba.
  const ikutTiba = (c) => c.jenis === "serah_terima_masuk" && b.perubahan.waktu_tiba !== undefined;
  const asli = await catatan(e, faskes(req), k);
  const daftar = asli.map((c) => (ikutTiba(c) ? { ...c, waktu_kejadian: baru.waktu_tiba, data: { ...c.data, waktu_terima: baru.waktu_tiba } } : c));
  urutanWaktu(baru, daftar);
  for (const c of daftar) {
    if (c.jenis === "asesmen" && c.data.keputusan === "siap" && Number(c.waktu_kejadian) === Number(e.waktu_siap_pindah)) pastikan(Number(baru.waktu_siap_pindah) === Number(c.waktu_kejadian), "Waktu keputusan mengikuti asesmen; catat asesmen baru untuk mengubahnya");
    if (c.data.waktu_terima && baru.waktu_keluar != null) pastikan(Number(baru.waktu_keluar) >= Number(c.data.waktu_terima), "Waktu keluar mendahului penerimaan");
  }
  for (const c of asli.filter(ikutTiba)) {
    const ubahan = daftar.find((x) => x.uuid === c.uuid);
    const hasilCatatan = await ubah("pacu_catatan", c.uuid, faskes(req), { waktu_kejadian: ubahan.waktu_kejadian, data: ubahan.data, versi: c.versi + 1, updated_by: pelaku(req) }, k);
    await audit(req, e, "catatan", c, hasilCatatan, "koreksi", k, b.alasan);
  }
  const hasil = await ubah("pacu_episode", e.uuid, faskes(req), { ...b.perubahan, versi: e.versi + 1, updated_by: pelaku(req) }, k);
  await audit(req, e, "episode", e, hasil, "koreksi", k, b.alasan);
  return hasil;
}));

export default rute;
