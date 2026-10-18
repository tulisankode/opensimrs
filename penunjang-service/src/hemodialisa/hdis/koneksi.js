import { query, satu, sisipkan, sekarang, transaksi } from "../../db.js";
import { permintaanSalah, tidakDitemukan, Galat } from "../../umum/respons.js";
import { enkripsi, dekripsi, hashKunci, buatKunci, samarkan } from "./kripto.js";

// Koneksi HDIS per faskes (bisa lebih dari satu; satu ditandai bawaan) — pola sama dengan koneksi UTD
// (bank-darah/utd/utd-koneksi.js). API key keluar & kunci masuk disimpan terenkripsi; respons hanya memuat nilai samaran,
// kunci masuk utuh tampil sekali saat dibuat/dibuat ulang.
export const timeoutMs = Number(process.env.HD_HDIS_TIMEOUT_MS) || 10000;

const validUrl = (u) => {
  try {
    return ["http:", "https:"].includes(new URL(String(u)).protocol);
  } catch {
    return false;
  }
};

export const tampilKoneksi = (k) => ({
  uuid: k.uuid,
  nama: k.nama,
  url_jadwal: k.url_jadwal,
  api_key: samarkan(dekripsi(k.api_key)),
  kunci_masuk: samarkan(dekripsi(k.kunci_masuk)),
  aktif: k.aktif,
  bawaan: k.bawaan,
  diubah_oleh: k.diubah_oleh ?? null,
  updated_at: k.updated_at,
});

export const daftarKoneksi = async (faskesUuid) =>
  (await query(`SELECT * FROM hd_hdis_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY bawaan DESC, nama`, [faskesUuid])).map(tampilKoneksi);

export const ambilKoneksi = async (faskesUuid, uuid) => {
  const k = await satu(`SELECT * FROM hd_hdis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!k) throw tidakDitemukan("Koneksi HDIS");
  return k;
};

// Perubahan koneksi satu faskes diserialkan (indeks unik parsial satu bawaan per faskes), lihat utd-koneksi.js.
const kunciFaskes = (faskesUuid, k) => query(`SELECT pg_advisory_xact_lock(hashtext('hd_hdis_koneksi:' || $1))`, [faskesUuid], k);

const aturBawaan = async (faskesUuid, uuid, k) => {
  const ada = await satu(`SELECT 1 FROM hd_hdis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND aktif = true`, [uuid, faskesUuid], k);
  if (!ada) throw permintaanSalah("Hanya koneksi aktif yang dapat dijadikan bawaan");
  const t = sekarang();
  await query(`UPDATE hd_hdis_koneksi SET bawaan = false, updated_at = $3 WHERE faskes_uuid = $1 AND uuid <> $2 AND bawaan = true`, [faskesUuid, uuid, t], k);
  await query(`UPDATE hd_hdis_koneksi SET bawaan = true, updated_at = $3 WHERE uuid = $1 AND faskes_uuid = $2`, [uuid, faskesUuid, t], k);
};

export const jadikanBawaan = async (faskesUuid, uuid) => {
  await transaksi(async (k) => {
    await kunciFaskes(faskesUuid, k);
    await aturBawaan(faskesUuid, uuid, k);
  });
  return (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === uuid);
};

export const simpanKoneksi = async (faskesUuid, uuid, data, pengguna) => {
  const nama = String(data?.nama ?? "").trim().slice(0, 120);
  if (!nama) throw permintaanSalah("Nama koneksi HDIS wajib diisi");
  const urlJadwal = String(data?.url_jadwal ?? "").trim();
  if (!validUrl(urlJadwal)) throw permintaanSalah("URL penerima jadwal tidak valid (contoh: http://hdis.contoh.id/api/jadwal)");
  const apiKey = String(data?.api_key ?? "").trim();
  const aktif = data?.aktif !== false;
  const kunciBaru = uuid ? null : buatKunci();
  const t = sekarang();

  const idBaris = await transaksi(async (k) => {
    await kunciFaskes(faskesUuid, k);
    let id = uuid;
    if (uuid) {
      const lama = await satu(`SELECT * FROM hd_hdis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid], k);
      if (!lama) throw tidakDitemukan("Koneksi HDIS");
      await query(
        `UPDATE hd_hdis_koneksi SET nama = $3, url_jadwal = $4, api_key = $5, aktif = $6, bawaan = CASE WHEN $6 THEN bawaan ELSE false END,
                diubah_oleh = $7, updated_at = $8
          WHERE uuid = $1 AND faskes_uuid = $2`,
        [uuid, faskesUuid, nama, urlJadwal, apiKey ? enkripsi(apiKey) : lama.api_key, aktif, pengguna, t],
        k,
      );
    } else {
      const baris = await sisipkan(
        "hd_hdis_koneksi",
        {
          faskes_uuid: faskesUuid,
          nama,
          url_jadwal: urlJadwal,
          api_key: enkripsi(apiKey),
          kunci_masuk: enkripsi(kunciBaru),
          kunci_masuk_hash: hashKunci(kunciBaru),
          aktif,
          bawaan: false,
          diubah_oleh: pengguna,
        },
        k,
      );
      id = baris.uuid;
      const jumlah = await satu(`SELECT COUNT(*)::int n FROM hd_hdis_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif`, [faskesUuid], k);
      if (aktif && jumlah.n === 1) await query(`UPDATE hd_hdis_koneksi SET bawaan = true WHERE uuid = $1`, [id], k);
    }
    if (data?.bawaan) await aturBawaan(faskesUuid, id, k);
    return id;
  });
  const hasil = (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === idBaris);
  return kunciBaru ? { ...hasil, kunci_masuk_baru: kunciBaru } : hasil;
};

export const buatUlangKunciMasuk = async (faskesUuid, uuid, pengguna) => {
  await ambilKoneksi(faskesUuid, uuid);
  const kunci = buatKunci();
  await query(`UPDATE hd_hdis_koneksi SET kunci_masuk = $3, kunci_masuk_hash = $4, diubah_oleh = $5, updated_at = $6 WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, enkripsi(kunci), hashKunci(kunci), pengguna, sekarang(),
  ]);
  return { uuid, kunci_masuk_baru: kunci };
};

export const hapusKoneksi = async (faskesUuid, uuid) => {
  const terhapus = await satu(
    `UPDATE hd_hdis_koneksi SET deleted_at = $3, aktif = false, bawaan = false, kunci_masuk_hash = NULL, updated_at = $3
      WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL RETURNING uuid`,
    [uuid, faskesUuid, sekarang()],
  );
  if (!terhapus) throw tidakDitemukan("Koneksi HDIS");
  return { uuid };
};

// Koneksi aktif untuk mengirim jadwal: bawaan, atau satu-satunya koneksi aktif. null bila belum ada.
export const koneksiKirim = async (faskesUuid) => {
  const rows = await query(`SELECT * FROM hd_hdis_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif ORDER BY bawaan DESC, nama`, [faskesUuid]);
  if (!rows.length) return null;
  if (rows.length > 1 && !rows[0].bawaan) throw new Galat(409, "Lebih dari satu koneksi HDIS aktif tanpa koneksi bawaan — tandai satu sebagai bawaan");
  return rows[0];
};

export const ujiKoneksi = async (faskesUuid, uuid) => {
  const koneksi = await ambilKoneksi(faskesUuid, uuid);
  try {
    const res = await fetch(koneksi.url_jadwal, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "", "Idempotency-Key": "uji-koneksi" },
      body: JSON.stringify({ uji: true }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      berhasil: res.status < 500 && res.status !== 401 && res.status !== 403,
      status_http: res.status,
      pesan: res.status === 401 || res.status === 403 ? `HDIS menolak API key (HTTP ${res.status})` : res.status < 500 ? `HDIS dapat dihubungi (HTTP ${res.status})` : `HDIS mengembalikan galat server (HTTP ${res.status})`,
    };
  } catch (error) {
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return { berhasil: false, pesan: `Tidak dapat menghubungi HDIS: ${waktuHabis ? "waktu habis" : error?.cause?.code ?? error.message}` };
  }
};

export { dekripsi, hashKunci };
