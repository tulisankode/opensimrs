import { query, satu, sekarang, transaksi, uuidv7 } from "../../db.js";
import { Galat } from "../../umum/respons.js";
import { normalisasiParameter, waktuUkur } from "../bersama.js";
import { hashKunci } from "./kripto.js";
import { fiturHdisAktifFaskes } from "./izin.js";

// Titik masuk parameter mesin/sesi dari HDIS (tanpa JWT; koneksi & faskes ditentukan dari hash kunci masuk, bukan dari
// payload). Kontrak: { kode_jadwal_simrs, kunci_idempoten, waktu_pengukuran, parameter: {...}, kode_mesin_hdis? }.
//   - Duplikat (kunci_idempoten sama pada koneksi yang sama & sudah diterapkan) → hasil sebelumnya dikembalikan, tanpa
//     observasi baru (KT-7). Pesan bersamaan dengan kunci sama diserialkan advisory lock.
//   - Tidak terpetakan ke jadwal/sesi berjalan, kode mesin tidak cocok, atau parameter di luar skema → dicatat `ditolak`
//     beserta alasannya (karantina, KT-8/KT-9) dan tidak dilekatkan ke sesi mana pun. Pesan ditolak boleh dikirim ulang
//     (mis. sesi belum dimulai) dan akan diproses ulang.
//   - Data yang datang setelah sesi ditutup tetap disimpan, ditandai perlu_tinjau untuk ditinjau perawat.

const ringkas = (body) => {
  try {
    return JSON.parse(JSON.stringify(body ?? {}).slice(0, 20000));
  } catch {
    return { catatan: "payload terlalu besar, dipotong" };
  }
};

const catat = (k, koneksi, kunci, data) =>
  satu(
    `INSERT INTO hd_hdis_pesan (uuid, faskes_uuid, koneksi_uuid, arah, jenis, kunci_idempoten, jadwal_uuid, sesi_uuid, observasi_uuid, status, payload, pesan, created_at, updated_at)
     VALUES ($1,$2,$3,'masuk','parameter',$4,$5,$6,$7,$8,$9,$10,$11,$11)
     ON CONFLICT (koneksi_uuid, arah, kunci_idempoten) DO UPDATE SET jadwal_uuid = EXCLUDED.jadwal_uuid, sesi_uuid = EXCLUDED.sesi_uuid,
       observasi_uuid = EXCLUDED.observasi_uuid, status = EXCLUDED.status, payload = EXCLUDED.payload, pesan = EXCLUDED.pesan,
       percobaan = hd_hdis_pesan.percobaan + 1, updated_at = EXCLUDED.updated_at
     RETURNING uuid`,
    [uuidv7(), koneksi.faskes_uuid, koneksi.uuid, kunci, data.jadwal_uuid ?? null, data.sesi_uuid ?? null, data.observasi_uuid ?? null, data.status, JSON.stringify(data.payload), data.pesan ?? null, sekarang()],
    k,
  );

export async function terimaParameter({ kunci, body }) {
  const koneksi = kunci ? await satu(`SELECT * FROM hd_hdis_koneksi WHERE kunci_masuk_hash = $1 AND aktif AND deleted_at IS NULL`, [hashKunci(String(kunci))]) : null;
  if (!koneksi) throw new Galat(401, "Kunci masuk HDIS tidak valid");
  if (!(await fiturHdisAktifFaskes(koneksi.faskes_uuid))) throw new Galat(403, "Fitur Bridging HDIS tidak aktif untuk faskes ini");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Galat(400, "Badan pesan HDIS harus berupa objek JSON");
  const kunciIdem = typeof body.kunci_idempoten === "string" || typeof body.kunci_idempoten === "number" ? String(body.kunci_idempoten).trim() : "";
  if (!kunciIdem || kunciIdem.length > 200) throw new Galat(400, "kunci_idempoten wajib diisi (maks. 200 karakter)");
  const payload = ringkas(body);

  const hasil = await transaksi(async (k) => {
    await query(`SELECT pg_advisory_xact_lock(hashtext('hd_hdis_masuk:' || $1 || ':' || $2))`, [koneksi.uuid, kunciIdem], k);
    const lama = await satu(`SELECT * FROM hd_hdis_pesan WHERE koneksi_uuid = $1 AND arah = 'masuk' AND kunci_idempoten = $2`, [koneksi.uuid, kunciIdem], k);
    if (lama?.status === "diterapkan") {
      return { ok: true, duplikat: true, pesan_uuid: lama.uuid, sesi_uuid: lama.sesi_uuid, observasi_uuid: lama.observasi_uuid };
    }
    const tolak = async (status, pesan, data = {}) => {
      const r = await catat(k, koneksi, kunciIdem, { ...data, status: "ditolak", pesan, payload });
      return { ok: false, statusHttp: status, pesan, pesan_uuid: r.uuid };
    };

    let parameter;
    let waktu;
    try {
      if (!body.kode_jadwal_simrs) throw new Galat(400, "kode_jadwal_simrs wajib diisi");
      waktu = waktuUkur(body.waktu_pengukuran);
      parameter = normalisasiParameter(body.parameter);
    } catch (e) {
      return tolak(400, `Pesan di luar kontrak: ${e.message}`);
    }

    const jadwal = await satu(`SELECT uuid, mesin_uuid FROM hd_jadwal WHERE uuid::text = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(body.kode_jadwal_simrs), koneksi.faskes_uuid], k);
    if (!jadwal) return tolak(404, "Jadwal tidak ditemukan pada faskes koneksi ini; pesan dikarantina");
    if (body.kode_mesin_hdis) {
      const peta = await satu(`SELECT kode_mesin_hdis FROM hd_hdis_peta_mesin WHERE koneksi_uuid = $1 AND mesin_uuid = $2 AND deleted_at IS NULL`, [koneksi.uuid, jadwal.mesin_uuid], k);
      if (!peta || peta.kode_mesin_hdis.toLowerCase() !== String(body.kode_mesin_hdis).toLowerCase()) {
        return tolak(409, `Kode mesin HDIS ${body.kode_mesin_hdis} tidak sesuai dengan mesin jadwal; pesan dikarantina`, { jadwal_uuid: jadwal.uuid });
      }
    }
    const sesi = await satu(`SELECT uuid, status FROM hd_sesi WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND status <> 'batal' AND deleted_at IS NULL`, [jadwal.uuid, koneksi.faskes_uuid], k);
    if (!sesi || !["berjalan", "selesai"].includes(sesi.status)) {
      return tolak(409, sesi ? "Sesi HD belum dimulai; kirim ulang setelah sesi berjalan" : "Belum ada sesi HD untuk jadwal ini", { jadwal_uuid: jadwal.uuid, sesi_uuid: sesi?.uuid });
    }

    const perluTinjau = sesi.status === "selesai";
    const obs =
      (await satu(
        `INSERT INTO hd_observasi (uuid, faskes_uuid, sesi_uuid, waktu_pengukuran, parameter, sumber, koneksi_uuid, kunci_idempoten, perlu_tinjau, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'hdis',$6,$7,$8,$9,$9)
         ON CONFLICT (koneksi_uuid, kunci_idempoten) WHERE kunci_idempoten IS NOT NULL DO NOTHING RETURNING uuid`,
        [uuidv7(), koneksi.faskes_uuid, sesi.uuid, waktu, JSON.stringify(parameter), koneksi.uuid, kunciIdem, perluTinjau, sekarang()],
        k,
      )) ?? (await satu(`SELECT uuid FROM hd_observasi WHERE koneksi_uuid = $1 AND kunci_idempoten = $2`, [koneksi.uuid, kunciIdem], k));
    const r = await catat(k, koneksi, kunciIdem, {
      jadwal_uuid: jadwal.uuid,
      sesi_uuid: sesi.uuid,
      observasi_uuid: obs.uuid,
      status: "diterapkan",
      pesan: perluTinjau ? "Diterima setelah sesi ditutup; ditandai perlu ditinjau perawat" : null,
      payload,
    });
    return { ok: true, duplikat: false, pesan_uuid: r.uuid, sesi_uuid: sesi.uuid, observasi_uuid: obs.uuid, perlu_tinjau: perluTinjau };
  });

  if (!hasil.ok) {
    const e = new Galat(hasil.statusHttp, hasil.pesan);
    e.payload = { pesan_uuid: hasil.pesan_uuid, status: "ditolak" };
    throw e;
  }
  return { status: "diterapkan", duplikat: hasil.duplikat, pesan_uuid: hasil.pesan_uuid, sesi_uuid: hasil.sesi_uuid, observasi_uuid: hasil.observasi_uuid, perlu_tinjau: !!hasil.perlu_tinjau };
}
