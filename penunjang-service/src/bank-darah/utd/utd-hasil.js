import { query, satu, sekarang, uuidv7 } from "../../db.js";
import { Galat, tidakDitemukan } from "../../umum/respons.js";
import { catatAuditBdrs } from "../bersama.js";
import { terimaKantong, ambilStok, alasanEpochDetik } from "../stok.js";
import { komponenDariKodeUtd } from "./utd-peta.js";
import { hashKunci } from "./kripto.js";
import { fiturAktifFaskes } from "./izin.js";

// Penyimpanan & validasi hasil UTD (push maupun tarik) — KF-8/KF-9/KF-10/KF-11. Hasil crossmatch UTD hanya
// disimpan sebagai informasi pada bdrs_utd_kantong.crossmatch_utd (tidak membuat/mengubah bdrs_crossmatch — A6/KF-9).

// Normalisasi IMLTD (KT-11, sesuai PRD): HANYA trim + huruf kecil. Nilai harus persis salah satu enum tertutup
// non_reaktif | reaktif | belum_diperiksa; selain itu (termasuk "negatif", "non-reaktif", "positif") → 'tidak_dikenal'
// dan ditolak. Sinonim sengaja tidak diterjemahkan: salah tafsir status IMLTD berisiko langsung terhadap keselamatan.
export const STATUS_IMLTD_UTD = ["non_reaktif", "reaktif", "belum_diperiksa"];
export const normalisasiImltd = (mentah) => {
  const v = String(mentah ?? "").trim().toLowerCase();
  return STATUS_IMLTD_UTD.includes(v) ? v : "tidak_dikenal";
};

// Golongan ABO kantong: trim + huruf besar, harus A/B/AB/O. null = kosong; false = tidak dikenal.
export const normalisasiGolongan = (mentah) => {
  if (mentah === undefined || mentah === null || String(mentah).trim() === "") return null;
  const v = String(mentah).trim().toUpperCase();
  return ["A", "B", "AB", "O"].includes(v) ? v : false;
};

// Rhesus kantong: trim + huruf kecil, harus positif/negatif; "+"/"-" diterima sebagai positif/negatif.
// null = kosong; false = tidak dikenal.
export const normalisasiRhesus = (mentah) => {
  if (mentah === undefined || mentah === null || String(mentah).trim() === "") return null;
  const v = String(mentah).trim().toLowerCase();
  if (v === "+") return "positif";
  if (v === "-") return "negatif";
  return ["positif", "negatif"].includes(v) ? v : false;
};

const ada = (v) => v !== undefined && v !== null;
const angkaAtauNull = (v) => {
  if (!ada(v) || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// Kolom BIGINT: simpan hanya bilangan bulat aman (nilai tanggal yang ditolak tetap disimpan untuk ditelusuri petugas).
const bulatAtauNull = (v) => {
  const n = angkaAtauNull(v);
  return Number.isSafeInteger(n) ? n : null;
};

// Field yang tidak dikirim UTD pada push/tarik berikutnya diambil dari data kantong yang sudah tersimpan, agar push
// parsial tidak menimpa data dengan null dan validasi tetap memakai data efektif kantong (bukan entri parsial).
const gabungDenganTersimpan = (entri, lama) => {
  if (!lama) return entri;
  const pilih = (...nilai) => nilai.find(ada) ?? null;
  return {
    ...entri,
    kode_komponen: pilih(entri?.kode_komponen, entri?.kode_komponen_utd, lama.kode_komponen_utd),
    golongan_abo: pilih(entri?.golongan_abo, lama.golongan_abo),
    rhesus: pilih(entri?.rhesus, lama.rhesus),
    volume_ml: pilih(entri?.volume_ml, lama.volume_ml),
    tanggal_produksi: pilih(entri?.tanggal_produksi, lama.tanggal_produksi),
    tanggal_kedaluwarsa: pilih(entri?.tanggal_kedaluwarsa, lama.tanggal_kedaluwarsa),
    imltd: pilih(entri?.imltd, entri?.status_imltd, lama.imltd_mentah),
    crossmatch: pilih(entri?.crossmatch, lama.crossmatch_utd),
  };
};

/** Validasi satu entri kantong dari UTD terhadap permintaan & stok faskes (KT-9/KT-10/KT-13). */
const validasiKantong = async (faskesUuid, koneksiUuid, permintaan, entri) => {
  const noKantong = String(entri?.no_kantong ?? "").trim();
  const kodeKomponen = String(entri?.kode_komponen ?? entri?.kode_komponen_utd ?? "").trim();
  const komponenUuid = kodeKomponen ? await komponenDariKodeUtd(faskesUuid, koneksiUuid, kodeKomponen) : null;
  // Tanggal wajib epoch DETIK — milidetik/nilai tak wajar ditolak dengan alasan spesifik, tidak dikonversi (stok.js).
  const alasanKedaluwarsa = alasanEpochDetik(entri?.tanggal_kedaluwarsa, "tanggal_kedaluwarsa");
  const tanggalKedaluwarsa = alasanKedaluwarsa ? null : Number(entri.tanggal_kedaluwarsa);
  const alasanProduksi = ada(entri?.tanggal_produksi) && entri.tanggal_produksi !== "" ? alasanEpochDetik(entri.tanggal_produksi, "tanggal_produksi") : null;
  const sudahAda = await satu(`SELECT 1 FROM bdrs_stok WHERE faskes_uuid = $1 AND no_kantong = $2 AND deleted_at IS NULL`, [faskesUuid, noKantong]);
  const imltdMentah = entri?.imltd ?? entri?.status_imltd ?? null;
  const statusImltd = normalisasiImltd(imltdMentah);
  const golonganKantong = normalisasiGolongan(entri?.golongan_abo);
  const rhesusKantong = normalisasiRhesus(entri?.rhesus);
  const golonganMentah = ada(entri?.golongan_abo) ? String(entri.golongan_abo).trim() : "";
  const rhesusMentah = ada(entri?.rhesus) ? String(entri.rhesus).trim() : "";
  const peringatanGolongan = Boolean(
    (golonganKantong && permintaan.golongan_diminta && golonganKantong !== permintaan.golongan_diminta) ||
      (rhesusKantong && permintaan.rhesus_diminta && rhesusKantong !== permintaan.rhesus_diminta),
  );

  let alasan = null;
  if (golonganKantong === null || rhesusKantong === null) alasan = "Data kantong tidak lengkap (golongan_abo/rhesus kosong)";
  else if (golonganKantong === false) alasan = `golongan_abo "${golonganMentah.slice(0, 20)}" tidak dikenal (harus A, B, AB, atau O)`;
  else if (rhesusKantong === false) alasan = `rhesus "${rhesusMentah.slice(0, 20)}" tidak dikenal (harus positif/negatif atau +/-)`;
  else if (!kodeKomponen || !komponenUuid) alasan = `Kode komponen UTD "${kodeKomponen.slice(0, 50) || "-"}" belum terpetakan balik (Bank Darah › Mapping UTD)`;
  else if (komponenUuid !== permintaan.komponen_uuid) alasan = "Komponen kantong tidak sesuai komponen permintaan";
  else if (alasanKedaluwarsa) alasan = alasanKedaluwarsa;
  else if (alasanProduksi) alasan = alasanProduksi;
  else if (tanggalKedaluwarsa <= sekarang()) alasan = "Kantong sudah kedaluwarsa";
  else if (sudahAda) alasan = `No. kantong ${noKantong} sudah terdaftar di stok faskes ini`;
  else if (statusImltd === "tidak_dikenal") alasan = `Status IMLTD tidak_dikenal ("${String(imltdMentah ?? "").slice(0, 30)}"; nilai sah: ${STATUS_IMLTD_UTD.join(", ")}), tidak dapat diterima ke stok`;
  else if (statusImltd !== "non_reaktif") alasan = `Status IMLTD ${statusImltd}, tidak dapat diterima ke stok`;

  return {
    noKantong,
    alasan,
    statusValidasi: alasan ? "ditolak" : "menunggu",
    data: {
      kode_komponen_utd: kodeKomponen ? kodeKomponen.slice(0, 50) : null,
      komponen_uuid: komponenUuid,
      // Nilai di luar enum disimpan apa adanya (dipotong sesuai kolom) agar petugas dapat menelusuri alasan penolakan.
      golongan_abo: golonganKantong || (golonganMentah ? golonganMentah.toUpperCase().slice(0, 5) : null),
      rhesus: rhesusKantong || (rhesusMentah ? rhesusMentah.slice(0, 20) : null),
      volume_ml: angkaAtauNull(entri?.volume_ml),
      tanggal_produksi: bulatAtauNull(entri?.tanggal_produksi),
      tanggal_kedaluwarsa: bulatAtauNull(entri?.tanggal_kedaluwarsa),
      imltd_mentah: ada(imltdMentah) ? String(imltdMentah).slice(0, 100) : null,
      status_imltd: statusImltd,
      crossmatch_utd: entri?.crossmatch ?? null,
      peringatan_golongan: peringatanGolongan,
    },
  };
};

const simpanKantong = async ({ faskesUuid, hasilUuid, kirimUuid, permintaanUuid, koneksiNama, noRegistrasi, hasilValidasi, lama }) => {
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
       -- COALESCE: field yang tidak dikirim (null) pada push/tarik berikutnya tidak menimpa data kantong tersimpan.
       hasil_uuid = EXCLUDED.hasil_uuid,
       kode_komponen_utd = COALESCE(EXCLUDED.kode_komponen_utd, bdrs_utd_kantong.kode_komponen_utd),
       komponen_uuid = COALESCE(EXCLUDED.komponen_uuid, bdrs_utd_kantong.komponen_uuid),
       golongan_abo = COALESCE(EXCLUDED.golongan_abo, bdrs_utd_kantong.golongan_abo),
       rhesus = COALESCE(EXCLUDED.rhesus, bdrs_utd_kantong.rhesus),
       volume_ml = COALESCE(EXCLUDED.volume_ml, bdrs_utd_kantong.volume_ml),
       tanggal_produksi = COALESCE(EXCLUDED.tanggal_produksi, bdrs_utd_kantong.tanggal_produksi),
       tanggal_kedaluwarsa = COALESCE(EXCLUDED.tanggal_kedaluwarsa, bdrs_utd_kantong.tanggal_kedaluwarsa),
       imltd_mentah = COALESCE(EXCLUDED.imltd_mentah, bdrs_utd_kantong.imltd_mentah),
       status_imltd = CASE WHEN EXCLUDED.imltd_mentah IS NULL THEN bdrs_utd_kantong.status_imltd ELSE EXCLUDED.status_imltd END,
       crossmatch_utd = COALESCE(EXCLUDED.crossmatch_utd, bdrs_utd_kantong.crossmatch_utd),
       peringatan_golongan = EXCLUDED.peringatan_golongan, updated_at = EXCLUDED.updated_at
       -- status_validasi/alasan_tolak TIDAK ditimpa bila kantong sudah 'diterima' (idempotensi KT-8/A10: push/tarik
       -- berulang tidak boleh membatalkan penerimaan yang sudah dilakukan petugas).
       , status_validasi = CASE WHEN bdrs_utd_kantong.status_validasi = 'diterima' THEN bdrs_utd_kantong.status_validasi ELSE EXCLUDED.status_validasi END,
       alasan_tolak = CASE WHEN bdrs_utd_kantong.status_validasi = 'diterima' THEN bdrs_utd_kantong.alasan_tolak ELSE EXCLUDED.alasan_tolak END`,
    [
      uuidv7(), faskesUuid, hasilUuid, kirimUuid, permintaanUuid, noKantong, data.kode_komponen_utd, data.komponen_uuid,
      data.golongan_abo, data.rhesus, data.volume_ml, data.tanggal_produksi, data.tanggal_kedaluwarsa, data.imltd_mentah,
      data.status_imltd, ada(data.crossmatch_utd) ? JSON.stringify(data.crossmatch_utd) : null, data.peringatan_golongan, statusValidasi, alasan, t,
    ],
  );
  // Audit penolakan IMLTD reaktif (KF-11/KT-10): dicatat SEKALI per kantong, yaitu saat pertama kali ditolak dengan
  // IMLTD reaktif — push/tarik ulang kantong reaktif yang sama tidak menggandakan audit.
  const sudahDicatat = lama?.status_validasi === "ditolak" && lama?.status_imltd === "reaktif";
  if (data.status_imltd === "reaktif" && statusValidasi === "ditolak" && !sudahDicatat && lama?.status_validasi !== "diterima") {
    await catatAuditBdrs(faskesUuid, "tolak_imltd_reaktif", {
      permintaanUuid,
      data: { no_kantong: noKantong, koneksi: koneksiNama, no_registrasi: noRegistrasi },
    });
  }
  // UTD melaporkan IMLTD reaktif SETELAH kantong diterima ke stok: kantong di bdrs_stok ikut ditandai reaktif sehingga
  // terkunci dari crossmatch & serah terima (aturan STD-0016) dan tampil untuk dimusnahkan. Bila kantong sudah
  // diserahkan ke pasien, audit menandai perlunya tindak lanjut hemovigilans. Dicatat sekali (saat pertama berubah).
  if (lama?.status_validasi === "diterima" && lama.stok_uuid && data.status_imltd === "reaktif" && lama.status_imltd !== "reaktif") {
    const stok = await satu(
      `UPDATE bdrs_stok SET status_imltd = 'reaktif', updated_at = $3
        WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
        RETURNING uuid, no_kantong, status`,
      [lama.stok_uuid, faskesUuid, t],
    );
    if (stok) {
      await catatAuditBdrs(faskesUuid, "ubah_imltd", {
        stokUuid: stok.uuid,
        permintaanUuid,
        data: {
          status_lama: lama.status_imltd,
          status_baru: "reaktif",
          no_kantong: stok.no_kantong,
          status_stok: stok.status,
          sumber: "utd",
          koneksi: koneksiNama,
          no_registrasi: noRegistrasi,
          perlu_tindak_lanjut_hemovigilans: stok.status === "diserahkan",
        },
      });
    }
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
    // Entri tanpa no_kantong (atau melebihi kolom) tidak dapat disimpan — hanya dicantumkan di ringkasan ditolak.
    const noKantong = String(entri?.no_kantong ?? "").trim();
    if (!noKantong || noKantong.length > 100) {
      ringkasanDitolak.push({ no_kantong: noKantong ? noKantong.slice(0, 100) : null, alasan: noKantong ? "no_kantong terlalu panjang (maks. 100 karakter)" : "no_kantong kosong" });
      continue;
    }
    const lama = await satu(`SELECT * FROM bdrs_utd_kantong WHERE faskes_uuid = $1 AND kirim_uuid = $2 AND no_kantong = $3`, [faskesUuid, kirim.uuid, noKantong]);
    const hasilValidasi = await validasiKantong(faskesUuid, koneksi.uuid, permintaan, gabungDenganTersimpan(entri, lama));
    await simpanKantong({ faskesUuid, hasilUuid, kirimUuid: kirim.uuid, permintaanUuid: permintaan.uuid, koneksiNama: koneksi.nama, noRegistrasi, hasilValidasi, lama });
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
  // Push tidak membawa JWT: status fitur diperiksa per faskes pemilik koneksi (katalog Manajemen Modul di DB),
  // sebelum data apa pun ditulis — fitur nonaktif berarti hasil UTD tidak boleh masuk sama sekali.
  if (!(await fiturAktifFaskes(koneksi.faskes_uuid, "bdrs_bridging"))) {
    throw new Galat(403, "Fitur Bridging Bank Darah (UTD) belum diaktifkan untuk faskes ini di SIMRS");
  }
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
