import express from "express";
import { query, satu, sisipkan, transaksi, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinHd } from "../umum/izin.js";
import { PARAMETER, angka, hariIni, hitungAdekuasi, normalisasiKomplikasi, normalisasiParameter, ramah, tanggalValid, teks, waktuUkur } from "./bersama.js";
import { detailJadwal } from "./jadwal.js";
import { kirimTagihanSesi } from "./tagihan.js";

// Sesi HD (satu per jadwal): buka (resep sah wajib) → asesmen pra-HD → mulai → observasi intradialitik per interval
// (manual & HDIS, kronologis, sumber dibedakan) → catatan pasca-HD & tutup → adekuasi (bila BUN tersedia) & tagihan.
// Koreksi observasi setelah dicatat tidak menimpa baris lama: baris baru dengan revisi_dari + alasan, baris lama ditandai
// digantikan (KF-17). Penutupan idempoten: memanggil tutup lagi tidak mengubah sesi dan hanya mencoba ulang tagihan
// yang belum terkirim (KT-16).
const rute = express.Router();
const izin = (aksi) => izinHd("Sesi HD", aksi);

const KOLOM_SESI = `se.uuid, se.jadwal_uuid, se.resep_uuid, se.status, se.asesmen_pra, se.asesmen_oleh, se.asesmen_pada, se.mulai_pada, se.selesai_pada,
  se.catatan_pasca, se.dibuka_oleh, se.dimulai_oleh, se.ditutup_oleh, se.alasan_batal, se.status_tagihan, se.pesan_tagihan, se.created_at, se.updated_at`;

export const ambilSesi = async (uuid, faskes, k, kunci = false) => {
  const s = await satu(`SELECT * FROM hd_sesi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${kunci ? "FOR UPDATE" : ""}`, [uuid, faskes], k);
  if (!s) throw tidakDitemukan("Sesi HD");
  return s;
};

const daftarObservasi = (sesiUuid, faskes, semua = false) =>
  query(
    `SELECT uuid, waktu_pengukuran, parameter, keluhan, komplikasi, tindakan, sumber, dicatat_oleh, koneksi_uuid, perlu_tinjau, revisi_dari,
            alasan_koreksi, digantikan, created_at
       FROM hd_observasi WHERE sesi_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${semua ? "" : "AND NOT digantikan"}
      ORDER BY waktu_pengukuran, created_at`,
    [sesiUuid, faskes],
  );

export const detailSesi = async (uuid, faskes) => {
  const s = await satu(`SELECT ${KOLOM_SESI} FROM hd_sesi se WHERE se.uuid = $1 AND se.faskes_uuid = $2 AND se.deleted_at IS NULL`, [uuid, faskes]);
  if (!s) throw tidakDitemukan("Sesi HD");
  const [jadwal, resep, observasi, adekuasi, pemakaian] = await Promise.all([
    detailJadwal(s.jadwal_uuid, faskes),
    satu(`SELECT * FROM hd_resep WHERE uuid = $1`, [s.resep_uuid]),
    daftarObservasi(s.uuid, faskes),
    satu(`SELECT * FROM hd_adekuasi WHERE sesi_uuid = $1 AND deleted_at IS NULL`, [s.uuid]),
    query(
      `SELECT pm.*, d.serial, d.pemakaian_maksimal FROM hd_pemakaian pm LEFT JOIN hd_dializer d ON d.uuid = pm.dializer_uuid
        WHERE pm.sesi_uuid = $1 AND pm.deleted_at IS NULL ORDER BY pm.created_at`,
      [s.uuid],
    ),
  ]);
  return { ...s, jadwal, resep, observasi, adekuasi, pemakaian };
};

// ── Daftar & detail ──────────────────────────────────────────────────────────
rute.get(
  "/sesi",
  izin("READ"),
  tangani(async (req, res) => {
    const tanggal = req.query.tanggal ? tanggalValid(req.query.tanggal) : null;
    const p = [req.author.faskesUuid];
    let w = "se.faskes_uuid = $1 AND se.deleted_at IS NULL";
    if (tanggal) {
      p.push(tanggal);
      w += ` AND j.tanggal = $${p.length}::date`;
    }
    for (const [param, kolom] of [["status", "se.status"], ["registrasi_uuid", "j.registrasi_uuid"], ["status_tagihan", "se.status_tagihan"]]) {
      if (req.query[param]) {
        p.push(String(req.query[param]));
        w += ` AND ${kolom} = $${p.length}`;
      }
    }
    kirim(
      res,
      await query(
        `SELECT ${KOLOM_SESI}, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, m.kode AS kode_mesin, s.nama AS nama_shift, r.no_reg_hd, r.jenis,
                p.no_rm, p.name AS nama_pasien,
                EXISTS (SELECT 1 FROM hd_observasi o WHERE o.sesi_uuid = se.uuid AND o.perlu_tinjau AND NOT o.digantikan) AS perlu_tinjau
           FROM hd_sesi se JOIN hd_jadwal j ON j.uuid = se.jadwal_uuid JOIN hd_mesin m ON m.uuid = j.mesin_uuid JOIN hd_shift s ON s.uuid = j.shift_uuid
           JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid JOIN patients p ON p.uuid = r.patient_uuid
          WHERE ${w} ORDER BY j.tanggal DESC, s.urutan, m.kode LIMIT 500`,
        p,
      ),
    );
  }),
);

rute.get("/sesi/:uuid", izin("READ"), tangani(async (req, res) => kirim(res, await detailSesi(req.params.uuid, req.author.faskesUuid))));

// ── Buka sesi ────────────────────────────────────────────────────────────────
// POST /sesi/buka { jadwal_uuid } — idempoten: bila sesi aktif untuk jadwal sudah ada, sesi itu yang dikembalikan.
rute.post(
  "/sesi/buka",
  izin("ASESMEN"),
  tangani(async (req, res) => {
    wajib(req.body, ["jadwal_uuid"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await satu(`SELECT *, to_char(tanggal, 'YYYY-MM-DD') AS tanggal_teks FROM hd_jadwal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.body.jadwal_uuid, f], k);
      if (!j) throw tidakDitemukan("Jadwal HD");
      const ada = await satu(`SELECT uuid FROM hd_sesi WHERE jadwal_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL`, [j.uuid], k);
      if (ada) return { uuid: ada.uuid, baru: false };
      if (!["terjadwal", "hadir"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status}; sesi tidak dapat dibuka`);
      if (j.tanggal_teks > hariIni()) throw new Galat(409, `Sesi untuk jadwal ${j.tanggal_teks} baru dapat dibuka pada tanggal tersebut`);
      const resep = await satu(
        `SELECT uuid FROM hd_resep WHERE registrasi_uuid = $1 AND faskes_uuid = $2 AND status = 'sah' AND deleted_at IS NULL ORDER BY disahkan_pada DESC LIMIT 1`,
        [j.registrasi_uuid, f],
        k,
      );
      if (!resep) throw new Galat(409, "Belum ada resep HD yang disahkan untuk pasien ini");
      const t = sekarang();
      const s = await sisipkan("hd_sesi", { faskes_uuid: f, jadwal_uuid: j.uuid, resep_uuid: resep.uuid, status: "asesmen", dibuka_oleh: req.author.username ?? null }, k).catch((e) =>
        ramah(e, "Sesi untuk jadwal ini sudah dibuka"),
      );
      await query(`UPDATE hd_jadwal SET status = 'hadir', hadir_pada = COALESCE(hadir_pada, $2), updated_at = $2 WHERE uuid = $1`, [j.uuid, t], k);
      return { uuid: s.uuid, baru: true };
    });
    kirim(res, await detailSesi(hasil.uuid, f), hasil.baru ? "Sesi HD dibuka" : "Sesi HD untuk jadwal ini sudah dibuka sebelumnya");
  }),
);

// ── Asesmen pra-HD ───────────────────────────────────────────────────────────
// Data wajib minimum: konfirmasi identitas & resep, berat badan pra-HD, TD, dan nadi. Isian lain bebas (keluhan, kondisi
// akses vaskular, catatan). Hanya dapat diubah sebelum sesi dimulai.
export const validasiAsesmen = (a) => {
  if (!a || typeof a !== "object" || Array.isArray(a)) throw permintaanSalah("asesmen_pra harus berupa objek");
  if (a.identitas_terkonfirmasi !== true) throw permintaanSalah("Identitas pasien harus dikonfirmasi (identitas_terkonfirmasi)");
  if (a.resep_terkonfirmasi !== true) throw permintaanSalah("Resep HD harus dikonfirmasi (resep_terkonfirmasi)");
  const vital = normalisasiParameter({ td_sistolik: a.td_sistolik, td_diastolik: a.td_diastolik, nadi: a.nadi, ...(a.suhu !== undefined && a.suhu !== null && a.suhu !== "" ? { suhu: a.suhu } : {}) });
  return {
    identitas_terkonfirmasi: true,
    resep_terkonfirmasi: true,
    berat_pra_kg: angka(a.berat_pra_kg, "berat_pra_kg", { min: 1, maks: 400 }),
    berat_kering_kg: angka(a.berat_kering_kg, "berat_kering_kg", { min: 1, maks: 400, wajibIsi: false }),
    td_sistolik: vital.td_sistolik.nilai,
    td_diastolik: vital.td_diastolik.nilai,
    nadi: vital.nadi.nilai,
    suhu: vital.suhu?.nilai ?? null,
    keluhan: teks(a.keluhan),
    kondisi_akses_vaskular: teks(a.kondisi_akses_vaskular),
    catatan: teks(a.catatan),
  };
};

rute.post(
  "/sesi/:uuid/asesmen",
  izin("ASESMEN"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const asesmen = validasiAsesmen(req.body?.asesmen_pra);
    await transaksi(async (k) => {
      const s = await ambilSesi(req.params.uuid, f, k, true);
      if (s.status !== "asesmen") throw new Galat(409, `Sesi berstatus ${s.status}; asesmen pra-HD hanya dapat diisi sebelum sesi dimulai`);
      await query(`UPDATE hd_sesi SET asesmen_pra = $2, asesmen_oleh = $3, asesmen_pada = $4, updated_at = $4 WHERE uuid = $1`, [s.uuid, JSON.stringify(asesmen), req.author.username ?? null, sekarang()], k);
    });
    kirim(res, await detailSesi(req.params.uuid, f), "Asesmen pra-HD disimpan");
  }),
);

rute.post(
  "/sesi/:uuid/mulai",
  izin("MULAI"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const s = await ambilSesi(req.params.uuid, f, k, true);
      if (s.status !== "asesmen") throw new Galat(409, `Sesi berstatus ${s.status}, tidak dapat dimulai`);
      if (!s.asesmen_pra) throw new Galat(409, "Asesmen pra-HD belum diisi");
      const t = sekarang();
      const mulai = req.body?.waktu_mulai ? waktuUkur(req.body.waktu_mulai, "waktu_mulai") : t;
      await query(`UPDATE hd_sesi SET status = 'berjalan', mulai_pada = $2, dimulai_oleh = $3, updated_at = $4 WHERE uuid = $1`, [s.uuid, mulai, req.author.username ?? null, t], k);
      await query(`UPDATE hd_jadwal SET status = 'berjalan', updated_at = $2 WHERE uuid = $1`, [s.jadwal_uuid, t], k);
    });
    kirim(res, await detailSesi(req.params.uuid, f), "Sesi HD dimulai");
  }),
);

// ── Observasi intradialitik ──────────────────────────────────────────────────
const dataObservasi = (b) => {
  const komplikasi = normalisasiKomplikasi(b.komplikasi);
  const keluhan = teks(b.keluhan);
  const kosong = b.parameter === undefined || b.parameter === null || (typeof b.parameter === "object" && !Object.keys(b.parameter).length);
  if (kosong && !komplikasi.length && !keluhan) throw permintaanSalah("Isi minimal satu parameter, keluhan, atau komplikasi");
  return {
    waktu_pengukuran: waktuUkur(b.waktu_pengukuran ?? sekarang()),
    parameter: kosong ? {} : normalisasiParameter(b.parameter),
    keluhan,
    komplikasi,
    tindakan: teks(b.tindakan),
  };
};

rute.get(
  "/sesi/:uuid/observasi",
  izin("READ"),
  tangani(async (req, res) => {
    const s = await ambilSesi(req.params.uuid, req.author.faskesUuid);
    kirim(res, await daftarObservasi(s.uuid, req.author.faskesUuid, ["1", "true"].includes(String(req.query.semua))));
  }),
);

// POST /sesi/:uuid/observasi { waktu_pengukuran?, parameter: { td_sistolik: 120, ... }, keluhan?, komplikasi?: [], tindakan? }
rute.post(
  "/sesi/:uuid/observasi",
  izin("OBSERVASI"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const data = dataObservasi(req.body ?? {});
    const s = await ambilSesi(req.params.uuid, f);
    if (s.status !== "berjalan") throw new Galat(409, `Sesi berstatus ${s.status}; observasi hanya dicatat saat sesi berjalan (koreksi lewat aksi Koreksi)`);
    if (s.mulai_pada && data.waktu_pengukuran < Number(s.mulai_pada) - 600) throw permintaanSalah("waktu_pengukuran sebelum sesi dimulai");
    const baris = await sisipkan("hd_observasi", { faskes_uuid: f, sesi_uuid: s.uuid, ...data, sumber: "manual", dicatat_oleh: req.author.username ?? null });
    kirim(res, baris, "Observasi intradialitik disimpan");
  }),
);

// Koreksi beraudit: baris baru (revisi_dari) menggantikan baris lama; alasan wajib.
rute.post(
  "/sesi/:uuid/observasi/:obsUuid/koreksi",
  izin("KOREKSI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const alasan = teks(b.alasan);
    if (!alasan) throw permintaanSalah("alasan koreksi wajib diisi");
    const f = req.author.faskesUuid;
    const baru = await transaksi(async (k) => {
      const s = await ambilSesi(req.params.uuid, f, k);
      if (s.status === "batal") throw new Galat(409, "Sesi sudah dibatalkan");
      const lama = await satu(`SELECT * FROM hd_observasi WHERE uuid = $1 AND sesi_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL FOR UPDATE`, [req.params.obsUuid, s.uuid, f], k);
      if (!lama) throw tidakDitemukan("Observasi");
      if (lama.digantikan) throw new Galat(409, "Observasi ini sudah dikoreksi; koreksi versi terbarunya");
      const data = dataObservasi({ waktu_pengukuran: lama.waktu_pengukuran, ...b });
      await query(`UPDATE hd_observasi SET digantikan = true, updated_at = $2 WHERE uuid = $1`, [lama.uuid, sekarang()], k);
      return sisipkan("hd_observasi", { faskes_uuid: f, sesi_uuid: s.uuid, ...data, sumber: "manual", dicatat_oleh: req.author.username ?? null, revisi_dari: lama.uuid, alasan_koreksi: alasan }, k);
    });
    kirim(res, baru, "Koreksi observasi disimpan; versi lama tetap tersimpan sebagai riwayat");
  }),
);

// Data HDIS yang datang setelah sesi ditutup ditinjau perawat (tanda perlu_tinjau dihapus, data tidak diubah).
rute.post(
  "/sesi/:uuid/observasi/:obsUuid/tinjau",
  izin("KOREKSI"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const baris = await satu(
      `UPDATE hd_observasi SET perlu_tinjau = false, alasan_koreksi = COALESCE(alasan_koreksi, $4), updated_at = $5
        WHERE uuid = $1 AND sesi_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL RETURNING uuid, perlu_tinjau`,
      [req.params.obsUuid, req.params.uuid, f, `Ditinjau oleh ${req.author.username ?? "-"}`, sekarang()],
    );
    if (!baris) throw tidakDitemukan("Observasi");
    kirim(res, baris, "Observasi ditandai sudah ditinjau");
  }),
);

// ── Adekuasi ─────────────────────────────────────────────────────────────────
// Durasi aktual (mulai→selesai), UF aktual, dan berat pasca dari catatan pasca-HD dipakai bila tidak diisi manual.
const simpanAdekuasi = async (k, s, b, pengguna) => {
  const pasca = s.catatan_pasca ?? {};
  const durasiAktual = s.mulai_pada && s.selesai_pada ? (Number(s.selesai_pada) - Number(s.mulai_pada)) / 3600 : null;
  const hasil = hitungAdekuasi({
    bun_pre: b.bun_pre,
    bun_post: b.bun_post,
    durasi_jam: b.durasi_jam ?? (durasiAktual ? Math.round(durasiAktual * 100) / 100 : undefined),
    uf_liter: b.uf_liter ?? (pasca.uf_aktual_ml !== undefined && pasca.uf_aktual_ml !== null ? Number(pasca.uf_aktual_ml) / 1000 : undefined),
    berat_pasca_kg: b.berat_pasca_kg ?? pasca.berat_pasca_kg,
  });
  const t = sekarang();
  const lama = await satu(`SELECT * FROM hd_adekuasi WHERE sesi_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [s.uuid], k);
  const data = {
    metode: hasil.metode ?? null,
    input: JSON.stringify(hasil.input),
    kt_v: hasil.kt_v ?? null,
    urr: hasil.urr ?? null,
    status: hasil.status,
    alasan: hasil.alasan ?? null,
  };
  if (!lama) {
    return sisipkan("hd_adekuasi", { faskes_uuid: s.faskes_uuid, sesi_uuid: s.uuid, ...data, input: hasil.input, riwayat: [], dihitung_oleh: pengguna, dihitung_pada: t }, k);
  }
  const riwayat = [...(Array.isArray(lama.riwayat) ? lama.riwayat : []), { kt_v: lama.kt_v, urr: lama.urr, status: lama.status, input: lama.input, dihitung_oleh: lama.dihitung_oleh, dihitung_pada: lama.dihitung_pada }];
  return satu(
    `UPDATE hd_adekuasi SET metode = $2, input = $3, kt_v = $4, urr = $5, status = $6, alasan = $7, riwayat = $8, dihitung_oleh = $9, dihitung_pada = $10, updated_at = $10
      WHERE uuid = $1 RETURNING *`,
    [lama.uuid, data.metode, data.input, data.kt_v, data.urr, data.status, data.alasan, JSON.stringify(riwayat), pengguna, t],
    k,
  );
};

rute.get(
  "/sesi/:uuid/adekuasi",
  izin("READ"),
  tangani(async (req, res) => {
    const s = await ambilSesi(req.params.uuid, req.author.faskesUuid);
    kirim(res, await satu(`SELECT * FROM hd_adekuasi WHERE sesi_uuid = $1 AND deleted_at IS NULL`, [s.uuid]));
  }),
);

// POST /sesi/:uuid/adekuasi { bun_pre, bun_post, durasi_jam?, uf_liter?, berat_pasca_kg? } — hitung ulang (riwayat disimpan).
rute.post(
  "/sesi/:uuid/adekuasi",
  izin("KOREKSI"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const s = await ambilSesi(req.params.uuid, f, k, true);
      if (s.status !== "selesai") throw new Galat(409, "Adekuasi dihitung setelah sesi ditutup");
      return simpanAdekuasi(k, s, req.body ?? {}, req.author.username ?? null);
    });
    kirim(res, hasil, hasil.status === "tersedia" ? "Adekuasi dihitung (perlu tinjauan tenaga klinis)" : `Adekuasi belum tersedia: ${hasil.alasan}`);
  }),
);

// ── Tutup sesi ───────────────────────────────────────────────────────────────
export const validasiPasca = (c) => {
  if (!c || typeof c !== "object" || Array.isArray(c)) throw permintaanSalah("catatan_pasca harus berupa objek");
  const vital = normalisasiParameter({ td_sistolik: c.td_sistolik, td_diastolik: c.td_diastolik, nadi: c.nadi });
  return {
    berat_pasca_kg: angka(c.berat_pasca_kg, "berat_pasca_kg", { min: 1, maks: 400 }),
    uf_aktual_ml: angka(c.uf_aktual_ml, "uf_aktual_ml", { min: 0, maks: PARAMETER.uf_volume_ml.maks }),
    td_sistolik: vital.td_sistolik.nilai,
    td_diastolik: vital.td_diastolik.nilai,
    nadi: vital.nadi.nilai,
    keluhan: teks(c.keluhan),
    kondisi_pulang: teks(c.kondisi_pulang),
    catatan: teks(c.catatan),
  };
};

// POST /sesi/:uuid/tutup { catatan_pasca: { berat_pasca_kg, uf_aktual_ml, td_sistolik, td_diastolik, nadi, ... }, bun_pre?, bun_post? }
rute.post(
  "/sesi/:uuid/tutup",
  izin("TUTUP"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const hasil = await transaksi(async (k) => {
      const s = await ambilSesi(req.params.uuid, f, k, true);
      if (s.status === "selesai") return { sudah: true };
      if (s.status !== "berjalan") throw new Galat(409, `Sesi berstatus ${s.status}, tidak dapat ditutup`);
      const pasca = validasiPasca(b.catatan_pasca);
      const t = sekarang();
      const ditutup = await satu(
        `UPDATE hd_sesi SET status = 'selesai', catatan_pasca = $2, selesai_pada = $3, ditutup_oleh = $4, updated_at = $3 WHERE uuid = $1 RETURNING *`,
        [s.uuid, JSON.stringify(pasca), t, req.author.username ?? null],
        k,
      );
      await query(`UPDATE hd_jadwal SET status = 'selesai', updated_at = $2 WHERE uuid = $1`, [s.jadwal_uuid, t], k);
      if (b.bun_pre !== undefined || b.bun_post !== undefined) await simpanAdekuasi(k, ditutup, b, req.author.username ?? null);
      return { sudah: false };
    });
    // Tagihan di luar transaksi klinis: kegagalan Pembayaran tidak membatalkan penutupan sesi (status gagal, dapat dicoba ulang).
    const tagihan = await kirimTagihanSesi(req.params.uuid, f, req.author.token);
    kirim(res, { ...(await detailSesi(req.params.uuid, f)), tagihan }, hasil.sudah ? "Sesi HD sudah ditutup sebelumnya" : "Sesi HD ditutup");
  }),
);

rute.post(
  "/sesi/:uuid/tagihan/kirim-ulang",
  izin("TUTUP"),
  tangani(async (req, res) => {
    const tagihan = await kirimTagihanSesi(req.params.uuid, req.author.faskesUuid, req.author.token);
    kirim(res, tagihan, tagihan.status_tagihan === "terkirim" ? "Tagihan tindakan HD terkirim" : `Tagihan ${tagihan.status_tagihan}: ${tagihan.pesan_tagihan ?? ""}`.trim());
  }),
);

// Batal sesi yang belum dimulai (mis. pasien tidak layak HD saat asesmen). Jadwal kembali ke status hadir.
rute.post(
  "/sesi/:uuid/batal",
  izin("BATAL"),
  tangani(async (req, res) => {
    const alasan = teks(req.body?.alasan);
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const s = await ambilSesi(req.params.uuid, f, k, true);
      if (s.status !== "asesmen") throw new Galat(409, `Sesi berstatus ${s.status}; hanya sesi yang belum dimulai yang dapat dibatalkan (sesi berjalan ditutup dengan catatan pasca-HD)`);
      const t = sekarang();
      await query(`UPDATE hd_sesi SET status = 'batal', alasan_batal = $2, updated_at = $3 WHERE uuid = $1`, [s.uuid, alasan, t], k);
      await query(`UPDATE hd_jadwal SET status = 'hadir', updated_at = $2 WHERE uuid = $1 AND status = 'hadir'`, [s.jadwal_uuid, t], k);
    });
    kirim(res, { uuid: req.params.uuid, status: "batal" }, "Sesi HD dibatalkan");
  }),
);

export default rute;
