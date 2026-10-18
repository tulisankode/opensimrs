import { satu, sekarang, uuidv7 } from "../../db.js";
import { Galat, tidakDitemukan } from "../../umum/respons.js";
import { kunciKirimJadwal } from "../bersama.js";
import { fiturHdisAktifFaskes } from "./izin.js";
import { ambilKoneksi, dekripsi, koneksiKirim, timeoutMs } from "./koneksi.js";
import { petaMesin } from "./peta.js";

// Pengiriman jadwal + data pasien minimum ke HDIS (kontrak REST generik, scripts/README-hdis-tiruan.md). Satu baris
// hd_hdis_pesan per koneksi + kunci idempoten (`jadwal:<uuid>:v<versi>`): percobaan ulang memakai baris & kunci yang
// sama (header Idempotency-Key) sehingga HDIS tidak menggandakan jadwal; perubahan jadwal (pindah/batal) menghasilkan kunci
// baru. Kegagalan tidak membatalkan penyimpanan jadwal (best-effort, status dapat dikirim ulang dari riwayat).
//   terkirim     HDIS menjawab 2xx
//   gagal        pasti belum diproses HDIS (koneksi ditolak/DNS, 4xx, mesin belum dipetakan) → boleh kirim ulang
//   tidak_pasti  waktu habis / 5xx generik — HDIS mungkin sudah memproses; kirim ulang aman karena kunci idempoten sama

const GALAT_BELUM_TERKIRIM = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT"]);
const BATAS_SEDANG_DIKIRIM_DETIK = Math.ceil(timeoutMs / 1000) + 30;

const jenisKelamin = (g) => {
  const s = String(g ?? "").toLowerCase();
  if (["female", "p", "perempuan", "f"].includes(s)) return "P";
  if (["male", "l", "laki-laki", "laki", "m"].includes(s)) return "L";
  return "-";
};

// Data minimum (PRD §11): tanpa NIK, alamat, telepon, penjamin, atau diagnosis.
export const buatPayloadJadwal = (j, kodeMesinHdis, kunci) => ({
  versi_kontrak: "1",
  kunci_idempoten: kunci,
  aksi: j.status === "batal" ? "batal" : "jadwal",
  jadwal: {
    kode_jadwal_simrs: j.uuid,
    tanggal: j.tanggal,
    shift: { kode: j.kode_shift, nama: j.nama_shift, jam_mulai: String(j.jam_mulai).slice(0, 5), jam_selesai: String(j.jam_selesai).slice(0, 5) },
    kode_mesin_hdis: kodeMesinHdis,
    status: j.status,
  },
  pasien: { no_rm: j.no_rm, nama: j.nama_pasien, jenis_kelamin: jenisKelamin(j.gender), tanggal_lahir: j.birth_date ?? null },
  registrasi: { no_reg_hd: j.no_reg_hd, jenis: j.jenis },
});

// Payload untuk log: tanpa nama pasien.
const sanitasi = (p) => ({ ...p, pasien: { ...p.pasien, nama: undefined } });

const ambilJadwalKirim = (jadwalUuid, faskesUuid) =>
  satu(
    `SELECT j.uuid, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, j.status, j.mesin_uuid, j.versi, j.created_at, j.updated_at,
            s.kode AS kode_shift, s.nama AS nama_shift, s.jam_mulai, s.jam_selesai,
            r.no_reg_hd, r.jenis, p.no_rm, p.name AS nama_pasien, p.gender, to_char(bd.birth_date, 'YYYY-MM-DD') AS birth_date
       FROM hd_jadwal j JOIN hd_shift s ON s.uuid = j.shift_uuid JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid
       JOIN patients p ON p.uuid = r.patient_uuid LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
      WHERE j.uuid = $1 AND j.faskes_uuid = $2 AND j.deleted_at IS NULL`,
    [jadwalUuid, faskesUuid],
  );

export const kirimHttp = async (koneksi, payload) => {
  try {
    const res = await fetch(koneksi.url_jadwal, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "", "Idempotency-Key": payload.kunci_idempoten },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let json = null;
    try {
      json = JSON.parse(await res.text());
    } catch {
      /* respons bukan JSON */
    }
    if (res.ok) return { status: "terkirim", status_http: res.status, pesan: json?.message || "Jadwal diterima HDIS" };
    const generik = res.status >= 500;
    const alasan = typeof json?.message === "string" && json.message ? json.message : `HDIS menjawab HTTP ${res.status}`;
    return generik
      ? { status: "tidak_pasti", status_http: res.status, pesan: `${alasan} — HDIS mungkin sudah memproses; kirim ulang aman (kunci idempoten sama)` }
      : { status: "gagal", status_http: res.status, pesan: alasan };
  } catch (error) {
    const kode = error?.cause?.code ?? error?.code;
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    if (!waktuHabis && GALAT_BELUM_TERKIRIM.has(kode)) return { status: "gagal", status_http: null, pesan: `HDIS tidak dapat dihubungi (${kode}); jadwal belum terkirim` };
    return {
      status: "tidak_pasti",
      status_http: null,
      pesan: `${waktuHabis ? "Waktu habis menunggu jawaban HDIS" : `Koneksi ke HDIS terputus (${kode || error.message})`} — status di HDIS belum pasti; kirim ulang aman (kunci idempoten sama)`,
    };
  }
};

/**
 * Kirim satu jadwal ke HDIS bila fitur aktif & koneksi tersedia. Tidak pernah melempar galat jaringan: hasil berupa
 * { status, pesan, uuid? } dengan status tambahan `tidak_aktif` (fitur nonaktif) atau `belum_dikonfigurasi` (tanpa koneksi).
 */
export const kirimJadwalHdis = async (faskesUuid, jadwalUuid, pengguna = null) => {
  if (!(await fiturHdisAktifFaskes(faskesUuid))) return { status: "tidak_aktif", pesan: "Fitur Bridging HDIS tidak aktif" };
  let koneksi;
  try {
    koneksi = await koneksiKirim(faskesUuid);
  } catch (e) {
    return { status: "belum_dikonfigurasi", pesan: e.message };
  }
  if (!koneksi) return { status: "belum_dikonfigurasi", pesan: "Belum ada koneksi HDIS aktif (Setting › Konfigurasi Integrasi › Hemodialisa)" };
  const j = await ambilJadwalKirim(jadwalUuid, faskesUuid);
  if (!j) throw tidakDitemukan("Jadwal HD");
  const kunci = kunciKirimJadwal(j);
  const peta = await petaMesin(koneksi.uuid, j.mesin_uuid);
  const payload = buatPayloadJadwal(j, peta?.kode_mesin_hdis ?? null, kunci);
  const t = sekarang();

  const ada = await satu(`SELECT * FROM hd_hdis_pesan WHERE koneksi_uuid = $1 AND arah = 'keluar' AND kunci_idempoten = $2`, [koneksi.uuid, kunci]);
  if (ada?.status === "terkirim") return { uuid: ada.uuid, status: "terkirim", pesan: "Jadwal versi ini sudah diterima HDIS sebelumnya", duplikat: true };
  if (ada?.status === "sedang_dikirim" && Number(ada.updated_at) > t - BATAS_SEDANG_DIKIRIM_DETIK) {
    return { uuid: ada.uuid, status: "sedang_dikirim", pesan: "Jadwal ini sedang dikirim oleh proses lain" };
  }

  // Mesin belum dipetakan: pasti tidak dikirim; dicatat agar dapat dikirim ulang setelah pemetaan dilengkapi.
  const statusAwal = peta ? "sedang_dikirim" : "gagal";
  const pesanAwal = peta ? null : "Mesin belum dipetakan ke kode mesin HDIS (Hemodialisa › Mapping HDIS)";
  let pesanUuid = ada?.uuid;
  if (ada) {
    // Optimistik: dua kirim ulang bersamaan → hanya satu yang mengirim.
    const diubah = await satu(
      `UPDATE hd_hdis_pesan SET status = $2, pesan = $3, payload = $4, percobaan = percobaan + 1, pengguna = $5, updated_at = $6
        WHERE uuid = $1 AND status = $7 AND updated_at = $8 RETURNING uuid`,
      [ada.uuid, statusAwal, pesanAwal, JSON.stringify(sanitasi(payload)), pengguna, t, ada.status, ada.updated_at],
    );
    if (!diubah) return { uuid: ada.uuid, status: "sedang_dikirim", pesan: "Jadwal ini sedang dikirim oleh proses lain" };
  } else {
    const baru = await satu(
      `INSERT INTO hd_hdis_pesan (uuid, faskes_uuid, koneksi_uuid, arah, jenis, kunci_idempoten, jadwal_uuid, status, payload, pesan, pengguna, created_at, updated_at)
       VALUES ($1,$2,$3,'keluar','jadwal',$4,$5,$6,$7,$8,$9,$10,$10)
       ON CONFLICT (koneksi_uuid, arah, kunci_idempoten) DO NOTHING RETURNING uuid`,
      [uuidv7(), faskesUuid, koneksi.uuid, kunci, j.uuid, statusAwal, JSON.stringify(sanitasi(payload)), pesanAwal, pengguna, t],
    );
    if (!baru) return { status: "sedang_dikirim", pesan: "Jadwal ini sedang dikirim oleh proses lain" };
    pesanUuid = baru.uuid;
  }
  if (!peta) return { uuid: pesanUuid, status: "gagal", pesan: pesanAwal };

  const hasil = await kirimHttp(koneksi, payload);
  await satu(`UPDATE hd_hdis_pesan SET status = $2, pesan = $3, status_http = $4, updated_at = $5 WHERE uuid = $1`, [pesanUuid, hasil.status, hasil.pesan, hasil.status_http, sekarang()]);
  return { uuid: pesanUuid, status: hasil.status, pesan: hasil.pesan };
};

// Kirim ulang dari riwayat: kirim keadaan jadwal terkini (kunci sama bila jadwal belum berubah).
export const kirimUlang = async (faskesUuid, pesanUuid, pengguna) => {
  const pesan = await satu(`SELECT * FROM hd_hdis_pesan WHERE uuid = $1 AND faskes_uuid = $2`, [pesanUuid, faskesUuid]);
  if (!pesan) throw tidakDitemukan("Pesan HDIS");
  if (pesan.arah !== "keluar" || !pesan.jadwal_uuid) throw new Galat(409, "Hanya pengiriman jadwal yang dapat dikirim ulang");
  const koneksi = await ambilKoneksi(faskesUuid, pesan.koneksi_uuid);
  if (!koneksi.aktif) throw new Galat(409, `Koneksi HDIS ${koneksi.nama} nonaktif`);
  return kirimJadwalHdis(faskesUuid, pesan.jadwal_uuid, pengguna);
};
