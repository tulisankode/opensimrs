import { query, satu, sekarang, uuidv7 } from "../../db.js";
import { Galat, tidakDitemukan } from "../../umum/respons.js";
import { catatAuditBdrs } from "../bersama.js";
import { terimaKantong, ambilStok } from "../stok.js";
import { komponenDariKodeUtd } from "./utd-peta.js";
import { hashKunci } from "./kripto.js";

// Penyimpanan & validasi hasil UTD (push maupun tarik) — KF-8/KF-9/KF-10/KF-11. Hasil crossmatch UTD hanya
// disimpan sebagai informasi pada bdrs_utd_kantong.crossmatch_utd (tidak membuat/mengubah bdrs_crossmatch — A6/KF-9).

// Normalisasi IMLTD (KT-11): trim + huruf kecil, lalu dipetakan ke enum tertutup. Nilai lain → 'tidak_dikenal' (ditolak).
export const normalisasiImltd = (mentah) => {
  const v = String(mentah ?? "").trim().toLowerCase();
  if (["non_reaktif", "non-reaktif", "nonreaktif", "negatif", "negative", "non reaktif"].includes(v)) return "non_reaktif";
  if (["reaktif", "positif", "positive", "reactive"].includes(v)) return "reaktif";
  if (["belum_diperiksa", "belum diperiksa", "pending", "menunggu", "belum_lulus", "belum lulus"].includes(v)) return "belum_diperiksa";
  return "tidak_dikenal";
};

const angkaAtauNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Validasi satu entri kantong dari UTD terhadap permintaan & stok faskes (KT-9/KT-10/KT-13). */
const validasiKantong = async (faskesUuid, koneksiUuid, permintaan, entri) => {
  const noKantong = String(entri?.no_kantong ?? "").trim();
  if (!noKantong) return { noKantong: null, alasan: "no_kantong kosong" };

  const kodeKomponen = String(entri?.kode_komponen ?? entri?.kode_komponen_utd ?? "").trim();
  const komponenUuid = kodeKomponen ? await komponenDariKodeUtd(faskesUuid, koneksiUuid, kodeKomponen) : null;
  const tanggalKedaluwarsa = angkaAtauNull(entri?.tanggal_kedaluwarsa);
  const sudahAda = await satu(`SELECT 1 FROM bdrs_stok WHERE faskes_uuid = $1 AND no_kantong = $2 AND deleted_at IS NULL`, [faskesUuid, noKantong]);
  const imltdMentah = entri?.imltd ?? entri?.status_imltd ?? null;
  const statusImltd = normalisasiImltd(imltdMentah);
  const golonganKantong = entri?.golongan_abo ? String(entri.golongan_abo).toUpperCase() : null;
  const rhesusKantong = entri?.rhesus ?? null;
  const peringatanGolongan = Boolean(
    (golonganKantong && permintaan.golongan_diminta && golonganKantong !== permintaan.golongan_diminta) ||
      (rhesusKantong && permintaan.rhesus_diminta && rhesusKantong !== permintaan.rhesus_diminta),
  );

  let alasan = null;
  if (!golonganKantong || !rhesusKantong) alasan = "Data kantong tidak lengkap (golongan_abo/rhesus kosong)";
  else if (!kodeKomponen || !komponenUuid) alasan = `Kode komponen UTD "${kodeKomponen || "-"}" belum terpetakan balik (Bank Darah › Mapping UTD)`;
  else if (komponenUuid !== permintaan.komponen_uuid) alasan = "Komponen kantong tidak sesuai komponen permintaan";
  else if (!tanggalKedaluwarsa) alasan = "tanggal_kedaluwarsa tidak valid";
  else if (tanggalKedaluwarsa <= sekarang()) alasan = "Kantong sudah kedaluwarsa";
  else if (sudahAda) alasan = `No. kantong ${noKantong} sudah terdaftar di stok faskes ini`;
  else if (statusImltd !== "non_reaktif") alasan = `Status IMLTD ${statusImltd}, tidak dapat diterima ke stok`;

  return {
    noKantong,
    alasan,
    statusValidasi: alasan ? "ditolak" : "menunggu",
    data: {
      kode_komponen_utd: kodeKomponen || null,
      komponen_uuid: komponenUuid,
      golongan_abo: golonganKantong,
      rhesus: rhesusKantong,
      volume_ml: angkaAtauNull(entri?.volume_ml),
      tanggal_produksi: angkaAtauNull(entri?.tanggal_produksi),
      tanggal_kedaluwarsa: tanggalKedaluwarsa,
      imltd_mentah: imltdMentah ? String(imltdMentah).slice(0, 100) : null,
      status_imltd: statusImltd,
      crossmatch_utd: entri?.crossmatch ?? null,
      peringatan_golongan: peringatanGolongan,
    },
  };
};

const simpanKantong = async ({ faskesUuid, hasilUuid, kirimUuid, permintaanUuid, koneksiUuid, koneksiNama, noRegistrasi, hasilValidasi }) => {
  const { noKantong, alasan, statusValidasi, data } = hasilValidasi;
  if (!noKantong) return;
  const t = sekarang();
  await query(
    `INSERT INTO bdrs_utd_kantong (
       uuid, faskes_uuid, hasil_uuid, kirim_uuid, permintaan_uuid, no_kantong, kode_komponen_utd, komponen_uuid,
       golongan_abo, rhesus, volume_ml, tanggal_produksi, tanggal_kedaluwarsa, imltd_mentah, status_imltd,
       crossmatch_utd, peringatan_golongan, status_validasi, alasan_tolak, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20)
     ON CONFLICT (faskes_uuid, kirim_uuid, no_kantong) DO UPDATE SET
       hasil_uuid = EXCLUDED.hasil_uuid, kode_komponen_utd = EXCLUDED.kode_komponen_utd, komponen_uuid = EXCLUDED.komponen_uuid,
       golongan_abo = EXCLUDED.golongan_abo, rhesus = EXCLUDED.rhesus, volume_ml = EXCLUDED.volume_ml,
       tanggal_produksi = EXCLUDED.tanggal_produksi, tanggal_kedaluwarsa = EXCLUDED.tanggal_kedaluwarsa,
       imltd_mentah = EXCLUDED.imltd_mentah, status_imltd = EXCLUDED.status_imltd, crossmatch_utd = EXCLUDED.crossmatch_utd,
       peringatan_golongan = EXCLUDED.peringatan_golongan, updated_at = EXCLUDED.updated_at
       -- status_validasi/alasan_tolak TIDAK ditimpa bila kantong sudah 'diterima' (idempotensi KT-8/A10: push/tarik
       -- berulang tidak boleh membatalkan penerimaan yang sudah dilakukan petugas).
       , status_validasi = CASE WHEN bdrs_utd_kantong.status_validasi = 'diterima' THEN bdrs_utd_kantong.status_validasi ELSE EXCLUDED.status_validasi END,
       alasan_tolak = CASE WHEN bdrs_utd_kantong.status_validasi = 'diterima' THEN bdrs_utd_kantong.alasan_tolak ELSE EXCLUDED.alasan_tolak END`,
    [
      uuidv7(), faskesUuid, hasilUuid, kirimUuid, permintaanUuid, noKantong, data.kode_komponen_utd, data.komponen_uuid,
      data.golongan_abo, data.rhesus, data.volume_ml, data.tanggal_produksi, data.tanggal_kedaluwarsa, data.imltd_mentah,
      data.status_imltd, JSON.stringify(data.crossmatch_utd), data.peringatan_golongan, statusValidasi, alasan, t,
    ],
  );
  // Audit penolakan IMLTD reaktif (KF-11/KT-10), hanya saat memang ditolak karena reaktif (bukan karena alasan lain).
  if (data.status_imltd === "reaktif" && statusValidasi === "ditolak") {
    await catatAuditBdrs(faskesUuid, "tolak_imltd_reaktif", {
      permintaanUuid,
      data: { no_kantong: noKantong, koneksi: koneksiNama, no_registrasi: noRegistrasi },
    });
  }
};

/** Inti penyimpanan hasil UTD (push maupun tarik): cocokkan dengan pengiriman faskes, simpan hasil + kantong per item. */
export const terapkanHasilUtd = async (koneksi, body, sumber) => {
  const faskesUuid = koneksi.faskes_uuid;
  const noRegistrasi = String(body?.no_registrasi ?? "").trim();
  if (!noRegistrasi) throw new Galat(400, "no_registrasi wajib diisi");
  const kirim = await satu(`SELECT * FROM bdrs_utd_kirim WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND no_registrasi = $3`, [faskesUuid, koneksi.uuid, noRegistrasi]);
  if (!kirim) throw new Galat(404, `Registrasi ${noRegistrasi} tidak ditemukan pada koneksi ini`);
  const permintaan = await satu(`SELECT * FROM bdrs_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [kirim.permintaan_uuid, faskesUuid]);
  if (!permintaan) throw new Galat(404, "Permintaan darah terkait registrasi ini tidak ditemukan");

  const t = sekarang();
  const statusUtd = body?.status ? String(body.status).trim().slice(0, 50) : null;
  const pesan = body?.pesan ?? body?.message ?? null;
  const daftarKantong = Array.isArray(body?.kantong) ? body.kantong : [];

  const hasilUuid = uuidv7();
  await query(
    `INSERT INTO bdrs_utd_hasil (uuid, faskes_uuid, koneksi_uuid, permintaan_uuid, no_registrasi, status, pesan, jumlah_kantong, jumlah_diterima, ringkasan_ditolak, payload, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11)`,
    [hasilUuid, faskesUuid, koneksi.uuid, permintaan.uuid, noRegistrasi, statusUtd, pesan, daftarKantong.length, "[]", JSON.stringify(body ?? null), t],
  );

  const ringkasanDitolak = [];
  for (const entri of daftarKantong) {
    const hasilValidasi = await validasiKantong(faskesUuid, koneksi.uuid, permintaan, entri);
    await simpanKantong({ faskesUuid, hasilUuid, kirimUuid: kirim.uuid, permintaanUuid: permintaan.uuid, koneksiUuid: koneksi.uuid, koneksiNama: koneksi.nama, noRegistrasi, hasilValidasi });
    if (hasilValidasi.alasan) ringkasanDitolak.push({ no_kantong: hasilValidasi.noKantong, alasan: hasilValidasi.alasan });
  }
  await query(`UPDATE bdrs_utd_hasil SET ringkasan_ditolak = $2 WHERE uuid = $1`, [hasilUuid, JSON.stringify(ringkasanDitolak)]);

  // Hasil diterima menandakan UTD sudah memproses registrasi ini → status transport pasti 'terkirim' (bukan tidak_pasti/sedang_dikirim).
  if (["sedang_dikirim", "tidak_pasti"].includes(kirim.status)) {
    await query(`UPDATE bdrs_utd_kirim SET status = 'terkirim', pesan = $2, updated_at = $3 WHERE uuid = $1`, [kirim.uuid, pesan ? String(pesan).slice(0, 500) : "Hasil diterima dari UTD", t]);
  }

  return { hasil_uuid: hasilUuid, no_registrasi: noRegistrasi, status: statusUtd, jumlah_kantong: daftarKantong.length, ditolak: ringkasanDitolak, sumber };
};

/** Titik masuk push (tanpa JWT): cocokkan kunci masuk → koneksi aktif, lalu proses seperti tarik. */
export const terimaHasilPush = async (kunci, body) => {
  if (!kunci) throw new Galat(401, "Kunci akses tidak ada (header x-api-key atau parameter ?key=)");
  const koneksi = await satu(`SELECT * FROM bdrs_utd_koneksi WHERE kunci_masuk_hash = $1 AND deleted_at IS NULL`, [hashKunci(kunci)]);
  if (!koneksi) throw new Galat(401, "Kunci akses tidak valid");
  if (!koneksi.aktif) throw new Galat(403, "Koneksi UTD nonaktif di SIMRS");
  return terapkanHasilUtd(koneksi, body, "push");
};

/** Kantong bridging untuk satu permintaan (frontend: daftar kantong, status validasi, peringatan). */
export const daftarKantongPermintaan = async (faskesUuid, permintaanUuid) =>
  query(
    `SELECT kt.*, c.nama AS koneksi_nama
       FROM bdrs_utd_kantong kt
       JOIN bdrs_utd_kirim ki ON ki.uuid = kt.kirim_uuid
       JOIN bdrs_utd_koneksi c ON c.uuid = ki.koneksi_uuid
      WHERE kt.faskes_uuid = $1 AND kt.permintaan_uuid = $2 ORDER BY kt.created_at DESC`,
    [faskesUuid, permintaanUuid],
  );

/** Petugas berizin TERIMA KANTONG meneruskan satu kantong bridging `menunggu` ke stok lewat logika penerimaan BDRS bersama (KF-12). */
export const terimaKantongUtd = async (faskesUuid, kantongUuid, pengguna) => {
  const k = await satu(`SELECT * FROM bdrs_utd_kantong WHERE uuid = $1 AND faskes_uuid = $2`, [kantongUuid, faskesUuid]);
  if (!k) throw tidakDitemukan("Kantong bridging UTD");
  if (k.status_validasi !== "menunggu") throw new Galat(409, `Kantong berstatus ${k.status_validasi}, tidak dapat diterima`);
  if (k.status_imltd !== "non_reaktif") throw new Galat(409, "Status IMLTD belum non-reaktif, tidak dapat diterima ke stok");

  const stok = await terimaKantong(
    faskesUuid,
    {
      no_kantong: k.no_kantong,
      komponen_uuid: k.komponen_uuid,
      golongan_abo: k.golongan_abo,
      rhesus: k.rhesus,
      volume_ml: k.volume_ml,
      tanggal_produksi: k.tanggal_produksi,
      tanggal_kedaluwarsa: k.tanggal_kedaluwarsa,
      sumber: "utd_otomatis",
      utd_referensi_uuid: k.uuid,
      status_imltd: k.status_imltd,
    },
    pengguna,
  );
  const t = sekarang();
  await query(`UPDATE bdrs_utd_kantong SET status_validasi = 'diterima', stok_uuid = $2, updated_at = $3 WHERE uuid = $1`, [k.uuid, stok.uuid, t]);

  const ringkasan = await satu(
    `SELECT COUNT(*) FILTER (WHERE status_validasi = 'menunggu')::int AS menunggu,
            COUNT(*) FILTER (WHERE status_validasi = 'diterima')::int AS diterima,
            COUNT(*) FILTER (WHERE status_validasi = 'ditolak')::int AS ditolak
       FROM bdrs_utd_kantong WHERE kirim_uuid = $1`,
    [k.kirim_uuid],
  );
  if (ringkasan.menunggu === 0 && ringkasan.diterima > 0) {
    const statusKirim = ringkasan.ditolak > 0 ? "diterima_sebagian" : "kantong_diterima";
    await query(`UPDATE bdrs_utd_kirim SET status = $2, updated_at = $3 WHERE uuid = $1`, [k.kirim_uuid, statusKirim, t]);
  }

  return ambilStok(stok.uuid, faskesUuid);
};
