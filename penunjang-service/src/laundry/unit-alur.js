import { query, sisipkan, sekarang } from "../db.js";
import { permintaanSalah } from "../umum/respons.js";
import { konflik } from "./bersama.js";

// Pelacakan per unit linen (STD-0030) — helper bersama alur Laundry. Jenis linen bertanda cara_pencatatan "per_unit"
// tetap memakai buku stok jumlah yang sama (laundry_transaksi_stok); bedanya, jumlah pada serah terima, batch, dan
// distribusi diambil dari kode unit yang dipindai sehingga setiap lembar menggerakkan buku stok tepat satu kali.
//
// Posisi unit (laundry_unit.lokasi_tipe) mengikuti siklus jumlah di bersama.js:
//   ruangan ──serah──▶ serah_kotor ──konfirmasi laundry──▶ kotor ──batch──▶ batch ──setrika/lipat selesai──▶ laundry
//   laundry ──distribusi──▶ dalam_perjalanan ──konfirmasi ruangan──▶ ruangan
// Unit hanya punya satu baris posisi; setiap perpindahan mengunci baris unit (FOR UPDATE, urutan uuid tetap) lalu
// memeriksa ulang posisinya, jadi unit tidak mungkin berada di dua tempat/tahap sekaligus walau dipindai serentak.
// Unit yang ikut saldo buku stok: ruangan/serah_kotor → stok ruangan (lokasi_uuid), laundry → stok bersih laundry.
// Unit kotor/batch/dalam perjalanan berada di antara dua buku (sama seperti jumlah), unit nonaktif tidak ikut saldo.

export const STATUS_UNIT = { aktif: "Aktif", rusak: "Rusak", hilang: "Hilang", dimusnahkan: "Dimusnahkan" };
export const POSISI_UNIT = {
  ruangan: "Di ruangan",
  serah_kotor: "Diserahkan (menunggu konfirmasi laundry)",
  kotor: "Antrean cuci (kotor)",
  batch: "Dalam batch cuci",
  laundry: "Stok bersih laundry",
  dalam_perjalanan: "Dalam distribusi (menunggu konfirmasi ruangan)",
};
export const PERISTIWA_UNIT = {
  registrasi: "Registrasi",
  serah_kotor: "Serah terima kotor",
  serah_dibatalkan: "Kembali ke ruangan (serah terima batal/selisih)",
  terima_kotor: "Diterima laundry (kotor)",
  masuk_batch: "Masuk batch cuci",
  selesai_cuci: "Selesai dicuci",
  distribusi: "Didistribusikan",
  terima_ruangan: "Diterima ruangan",
  selisih_distribusi: "Tidak diterima saat distribusi",
  ubah_status: "Ubah status",
  koreksi_lokasi: "Koreksi lokasi",
  tautan_bed: "Tautan bed/kamar",
};
// Status nonaktif → sumber_tipe buku stok (sama dengan koreksi stok jumlah agar laporan/rekonsiliasi tetap utuh).
export const SUMBER_STATUS = { rusak: "rusak", hilang: "hilang", dimusnahkan: "afkir" };
export const MAKS_PINDAI = 500;

// Kode unit/hasil pindai: dipangkas & huruf besar (scanner keyboard wedge kadang mengirim huruf kecil/spasi).
export const normalKode = (v) => String(v ?? "").trim().toUpperCase();

// Daftar kode hasil pindai: wajib array 1..MAKS_PINDAI, tidak boleh kosong/ganda (KF-8: duplikasi ditolak).
export const daftarKode = (v, nama = "kode_unit") => {
  if (!Array.isArray(v) || !v.length) throw permintaanSalah(`${nama} wajib berisi minimal satu kode`);
  if (v.length > MAKS_PINDAI) throw permintaanSalah(`${nama} maksimal ${MAKS_PINDAI} kode per transaksi`);
  const hasil = v.map(normalKode);
  if (hasil.some((k) => !k || k.length > 160)) throw permintaanSalah(`${nama} memuat kode kosong atau terlalu panjang`);
  const ganda = hasil.filter((k, i) => hasil.indexOf(k) !== i);
  if (ganda.length) throw permintaanSalah(`Kode unit dipindai lebih dari sekali: ${[...new Set(ganda)].join(", ")}`);
  return hasil;
};

// Awalan kode unit (mis. SLM → SLM-000123): huruf/angka/tanda hubung, 1–20 karakter.
export const awalanKode = (v) => {
  const a = normalKode(v).replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(a)) throw permintaanSalah("Awalan kode unit hanya boleh huruf, angka, dan tanda hubung (maksimal 20 karakter)");
  return a.replace(/-+$/, "");
};
export const kodeUnitKe = (awalan, nomor) => `${awalan}-${String(nomor).padStart(6, "0")}`;

// Batas umur pakai: batas_siklus > 0; ambang peringatan (siklus ke-n mulai "mendekati batas") 1..batas.
export const cekKonfigurasiSiklus = (batas, peringatan) => {
  const angka = (v, nama) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0 || n > 100000) throw permintaanSalah(`${nama} harus berupa bilangan bulat 1–100000`);
    return n;
  };
  const b = angka(batas, "batas_siklus");
  const p = angka(peringatan, "peringatan_siklus");
  if (p !== null && b === null) throw permintaanSalah("peringatan_siklus hanya dapat diisi bila batas_siklus diisi");
  if (p !== null && p > b) throw permintaanSalah("peringatan_siklus tidak boleh melebihi batas_siklus");
  return { batas: b, peringatan: p };
};

// Status umur pakai satu unit: normal | mendekati (≥ ambang peringatan) | tercapai (≥ batas).
export const statusSiklus = (siklus, batas, peringatan) => {
  const s = Number(siklus ?? 0);
  if (batas && s >= Number(batas)) return "tercapai";
  if (peringatan && s >= Number(peringatan)) return "mendekati";
  return "normal";
};

// Transisi status unit (KF-12): alasan wajib untuk setiap perubahan; dimusnahkan bersifat final; unit aktif hanya bisa
// dinonaktifkan dari posisi diam (ruangan/stok bersih) agar buku stok & dokumen alur yang sedang berjalan tetap cocok.
export const cekTransisiStatus = (unit, statusBaru, alasan) => {
  if (!Object.prototype.hasOwnProperty.call(STATUS_UNIT, statusBaru)) throw permintaanSalah(`status harus salah satu: ${Object.keys(STATUS_UNIT).join(", ")}`);
  if (!String(alasan ?? "").trim()) throw permintaanSalah("Alasan perubahan status wajib diisi");
  if (unit.status === statusBaru) throw konflik(`Unit ${unit.kode_unit} sudah berstatus ${STATUS_UNIT[statusBaru]}`);
  if (unit.status === "dimusnahkan") throw konflik(`Unit ${unit.kode_unit} sudah dimusnahkan dan tidak dapat diubah lagi`);
  if (unit.status === "aktif" && !["ruangan", "laundry"].includes(unit.lokasi_tipe))
    throw konflik(`Unit ${unit.kode_unit} sedang ${POSISI_UNIT[unit.lokasi_tipe] ?? unit.lokasi_tipe}; selesaikan alurnya terlebih dahulu`);
  return { keluarBuku: unit.status === "aktif", masukBuku: statusBaru === "aktif" };
};

export const uraianPosisi = (u) => `${POSISI_UNIT[u.lokasi_tipe] ?? u.lokasi_tipe}${u.nama_lokasi ? ` ${u.nama_lokasi}` : ""}`;

// Galat 409 yang menyebut posisi/status terakhir unit (KT-8) — tidak ada perubahan yang disimpan.
export const galatPosisi = (u, alasan) =>
  konflik(`Unit ${u.kode_unit} ditolak: ${alasan}. Posisi terakhir: ${uraianPosisi(u)}, status ${STATUS_UNIT[u.status] ?? u.status}`);

// Cari unit dari hasil pindai (pengenal aktif QR/barcode/kelak RFID → unit) lalu kunci barisnya. Kode tak dikenal
// ditolak 400 (KT-4); dua kode yang menunjuk unit sama ditolak sebagai duplikasi.
export const kunciUnitDariKode = async (k, faskes, kodeList) => {
  const peta = await query(
    `SELECT upper(p.nilai) AS nilai, p.unit_uuid FROM laundry_unit_pengenal p
       JOIN laundry_unit u ON u.uuid = p.unit_uuid AND u.faskes_uuid = p.faskes_uuid AND u.deleted_at IS NULL
      WHERE p.faskes_uuid = $1 AND upper(p.nilai) = ANY($2::text[]) AND p.aktif AND p.deleted_at IS NULL`,
    [faskes, kodeList],
    k,
  );
  const ke = new Map(peta.map((r) => [r.nilai, r.unit_uuid]));
  const takDikenal = kodeList.filter((x) => !ke.has(x));
  if (takDikenal.length) throw permintaanSalah(`Kode unit tidak dikenal: ${takDikenal.join(", ")}`);
  const uuids = kodeList.map((x) => ke.get(x));
  if (new Set(uuids).size !== uuids.length) throw permintaanSalah("Beberapa kode yang dipindai menunjuk unit yang sama");
  const rows = await kunciUnit(k, faskes, uuids);
  const perUuid = new Map(rows.map((r) => [r.uuid, r]));
  return kodeList.map((x) => perUuid.get(ke.get(x)));
};

// Kunci baris unit berdasarkan uuid (urutan uuid → bebas deadlock antartransaksi).
export const kunciUnit = (k, faskes, uuids) =>
  uuids.length
    ? query(
        `SELECT u.*, j.nama AS nama_jenis, j.cara_pencatatan, j.batas_siklus, j.peringatan_siklus, l.name AS nama_lokasi
           FROM laundry_unit u
           JOIN laundry_jenis_linen j ON j.uuid = u.jenis_linen_uuid AND j.faskes_uuid = u.faskes_uuid
           LEFT JOIN lokasi l ON l.uuid = u.lokasi_uuid AND l.faskes_uuid = u.faskes_uuid
          WHERE u.faskes_uuid = $1 AND u.uuid = ANY($2::varchar[]) AND u.deleted_at IS NULL
          ORDER BY u.uuid FOR UPDATE OF u`,
        [faskes, uuids],
        k,
      )
    : Promise.resolve([]);

// Kunci unit yang sedang dipegang dokumen/rincian alur pada posisi tertentu (mis. unit serah_kotor milik rincian).
export const kunciUnitRincian = async (k, faskes, kolom, nilai, lokasiTipe) => {
  if (!["dokumen_uuid", "rincian_uuid"].includes(kolom)) throw new Error("kolom tidak dikenal");
  const ids = await query(
    `SELECT uuid FROM laundry_unit WHERE faskes_uuid = $1 AND ${kolom} = $2 AND lokasi_tipe = $3 AND deleted_at IS NULL ORDER BY uuid`,
    [faskes, nilai, lokasiTipe],
    k,
  );
  // Dibaca ulang setelah terkunci: unit yang berpindah selagi menunggu kunci tidak ikut diproses.
  return (await kunciUnit(k, faskes, ids.map((r) => r.uuid))).filter((u) => u[kolom] === nilai && u.lokasi_tipe === lokasiTipe);
};

// Periksa unit hasil pindai untuk satu rincian alur: aktif, jenis sesuai, dan posisi sesuai tahap.
export const cekUnitAlur = (units, { jenisLinenUuid, namaJenis, lokasiTipe, lokasiUuid, keterangan }) => {
  for (const u of units) {
    if (u.status !== "aktif") throw galatPosisi(u, "unit tidak aktif");
    if (u.cara_pencatatan !== "per_unit") throw galatPosisi(u, `jenis ${u.nama_jenis} tidak dilacak per unit`);
    if (jenisLinenUuid && u.jenis_linen_uuid !== jenisLinenUuid) throw galatPosisi(u, `unit berjenis ${u.nama_jenis}, bukan ${namaJenis ?? "jenis rincian"}`);
    if (u.lokasi_tipe !== lokasiTipe || (lokasiUuid !== undefined && u.lokasi_uuid !== lokasiUuid)) throw galatPosisi(u, keterangan);
  }
  return units;
};

// Jumlah rincian dari hasil pindai: bila jumlah juga dikirim, harus sama dengan banyaknya kode unik.
export const jumlahDariKode = (kode, jumlah, nama) => {
  if (jumlah !== undefined && jumlah !== null && jumlah !== "" && Number(jumlah) !== kode.length)
    throw permintaanSalah(`${nama} (${jumlah}) tidak sama dengan jumlah kode unit yang dipindai (${kode.length})`);
  return kode.length;
};

// Konfirmasi penerimaan (kotor/bersih) untuk rincian yang memegang unit: kode yang dipindai = unit yang diterima.
// Tanpa kode, jumlah diterima hanya boleh semua (= jumlah unit) atau nol; sebagian wajib dipindai agar jelas unit mana.
export const pilahDiterima = (unitRincian, kodeDiterima, jumlahDiterima, namaLinen) => {
  if (kodeDiterima) {
    const perKode = new Map(unitRincian.map((u) => [normalKode(u.kode_unit), u]));
    const diterima = [];
    for (const kode of kodeDiterima) {
      const u = perKode.get(kode);
      if (!u) throw permintaanSalah(`Kode ${kode} tidak termasuk rincian ${namaLinen} pada transaksi ini`);
      diterima.push(u);
    }
    jumlahDariKode(kodeDiterima, jumlahDiterima, `jumlah_diterima ${namaLinen}`);
    const set = new Set(diterima.map((u) => u.uuid));
    return { diterima, tidak: unitRincian.filter((u) => !set.has(u.uuid)) };
  }
  const n = Number(jumlahDiterima);
  if (n === unitRincian.length) return { diterima: unitRincian, tidak: [] };
  if (n === 0) return { diterima: [], tidak: unitRincian };
  throw permintaanSalah(`${namaLinen} dilacak per unit: pindai kode unit yang diterima (sebagian ${n} dari ${unitRincian.length})`);
};

// Pindahkan unit (sudah terkunci) ke posisi baru + catat riwayat per unit, dalam transaksi pemanggil.
export const pindahkanUnit = async (k, units, sesudah, { faskes, peristiwa, dokumenTipe = null, dokumenUuid = null, alasan = null, pelaku, waktu = sekarang() }) => {
  const hasil = [];
  for (const u of units) {
    const baru = {
      lokasi_tipe: sesudah.lokasi_tipe ?? u.lokasi_tipe,
      lokasi_uuid: sesudah.lokasi_uuid !== undefined ? sesudah.lokasi_uuid : u.lokasi_uuid,
      dokumen_uuid: sesudah.dokumen_uuid !== undefined ? sesudah.dokumen_uuid : u.dokumen_uuid,
      rincian_uuid: sesudah.rincian_uuid !== undefined ? sesudah.rincian_uuid : u.rincian_uuid,
      status: sesudah.status ?? u.status,
      siklus_cuci: Number(u.siklus_cuci) + (sesudah.tambahSiklus ? 1 : 0),
    };
    // Unit yang meninggalkan ruangan/berubah status tidak lagi berada di bed mana pun.
    const lepasBed = u.bed_uuid && (baru.lokasi_tipe !== "ruangan" || baru.lokasi_uuid !== u.lokasi_uuid || baru.status !== "aktif");
    const r = (
      await query(
        `UPDATE laundry_unit SET lokasi_tipe = $1, lokasi_uuid = $2, dokumen_uuid = $3, rincian_uuid = $4, status = $5, siklus_cuci = $6,
                waktu_cuci_terakhir = CASE WHEN $7::boolean THEN $8::bigint ELSE waktu_cuci_terakhir END,
                waktu_status = CASE WHEN $5::varchar <> status THEN $8::bigint ELSE waktu_status END,
                alasan_status = CASE WHEN $5::varchar <> status THEN $9::text ELSE alasan_status END,
                bed_uuid = CASE WHEN $10::boolean THEN NULL ELSE bed_uuid END, kamar_uuid = CASE WHEN $10::boolean THEN NULL ELSE kamar_uuid END,
                updated_at = $8::bigint
          WHERE uuid = $11 AND faskes_uuid = $12 AND deleted_at IS NULL RETURNING *`,
        [baru.lokasi_tipe, baru.lokasi_uuid, baru.dokumen_uuid, baru.rincian_uuid, baru.status, baru.siklus_cuci, !!sesudah.tambahSiklus, waktu, alasan, !!lepasBed, u.uuid, faskes],
        k,
      )
    )[0];
    if (lepasBed)
      await query(`UPDATE laundry_unit_lokasi SET waktu_selesai = $1, updated_at = $1 WHERE faskes_uuid = $2 AND unit_uuid = $3 AND waktu_selesai IS NULL AND deleted_at IS NULL`, [waktu, faskes, u.uuid], k);
    await sisipkan(
      "laundry_unit_riwayat",
      {
        faskes_uuid: faskes,
        unit_uuid: u.uuid,
        peristiwa,
        dokumen_tipe: dokumenTipe,
        dokumen_uuid: dokumenUuid,
        lokasi_tipe_sebelum: u.lokasi_tipe,
        lokasi_uuid_sebelum: u.lokasi_uuid,
        lokasi_tipe_sesudah: baru.lokasi_tipe,
        lokasi_uuid_sesudah: baru.lokasi_uuid,
        status_sebelum: u.status,
        status_sesudah: baru.status,
        siklus_sesudah: baru.siklus_cuci,
        alasan,
        pelaku_uuid: pelaku ?? null,
        waktu,
      },
      k,
    );
    hasil.push({ ...u, ...r, siklus_sebelum: Number(u.siklus_cuci) });
  }
  return hasil;
};

// Banyaknya unit aktif yang ikut saldo buku stok pada satu lokasi (lihat keterangan di atas).
export const unitTerlacak = async (faskes, lokasiTipe, lokasiUuid, jenisLinenUuid, k) => {
  const r = (
    await query(
      lokasiTipe === "laundry"
        ? `SELECT count(*)::int AS n FROM laundry_unit WHERE faskes_uuid = $1 AND jenis_linen_uuid = $2 AND status = 'aktif' AND lokasi_tipe = 'laundry' AND deleted_at IS NULL`
        : `SELECT count(*)::int AS n FROM laundry_unit WHERE faskes_uuid = $1 AND jenis_linen_uuid = $2 AND status = 'aktif'
             AND lokasi_tipe IN ('ruangan','serah_kotor') AND lokasi_uuid = $3 AND deleted_at IS NULL`,
      lokasiTipe === "laundry" ? [faskes, jenisLinenUuid] : [faskes, jenisLinenUuid, lokasiUuid],
      k,
    )
  )[0];
  return Number(r?.n ?? 0);
};

// Galat unique_violation PostgreSQL → 409 dengan pesan ramah (mis. kode unit kembar akibat permintaan serentak).
export const konflikUnik = (e, pesan) => {
  if (e?.code === "23505") throw konflik(pesan);
  throw e;
};
