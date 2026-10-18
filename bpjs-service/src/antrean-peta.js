import { query, satu } from "./db.js";

// Pemetaan poli/dokter BPJS -> entitas lokal. Memakai kolom pemetaan yang sudah ada (lokasi.kd_poli_bpjs,
// practitioner.code_bpjs) yang dikelola di Setting › Konfigurasi Integrasi › BPJS PCare (bpjs-service/src/pcare.js);
// tidak menduplikasi tabel pemetaan baru (lihat catatan desain STD-0018).

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const namaHari = (tanggalYmd) => HARI[new Date(`${tanggalYmd}T00:00:00`).getDay()];

export class PemetaanTidakDitemukan extends Error {
  status = 422;
}

// Temukan jadwal dokter lokal dari kode poli & kode dokter BPJS pada tanggal tertentu (yyyy-mm-dd).
export const temukanJadwal = async (faskesUuid, { kodepoli, kodedokter, tanggalperiksa }) => {
  const poli = await satu(
    `SELECT uuid, name, kd_poli_bpjs FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND kd_poli_bpjs = $2 LIMIT 1`,
    [faskesUuid, kodepoli]
  );
  if (!poli) throw new PemetaanTidakDitemukan(`Kode poli BPJS "${kodepoli}" belum dipetakan ke poli lokal`);

  let dokter = null;
  if (kodedokter) {
    dokter = await satu(
      `SELECT pr.uuid, pg.name FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
       WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.code_bpjs = $2 LIMIT 1`,
      [faskesUuid, String(kodedokter)]
    );
    if (!dokter) throw new PemetaanTidakDitemukan(`Kode dokter BPJS "${kodedokter}" belum dipetakan ke dokter lokal`);
  }

  const hari = namaHari(tanggalperiksa);
  const jadwal = await satu(
    `SELECT jd.uuid, jd.practitioner_uuid, jd.lokasi_uuid, jd.day, jd.start_time, jd.end_time, jd.kuota, jd.kuota_jkn,
            jd.kuota_non_jkn, jd.code_antrian_poli, jd.code_antrian_dokter, pg.name AS practitioner_name
     FROM jadwal_dokter jd JOIN practitioner pr ON pr.uuid = jd.practitioner_uuid
     JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
     WHERE jd.faskes_uuid = $1 AND jd.deleted_at IS NULL AND jd.status = true AND jd.lokasi_uuid = $2 AND jd.day = $3
       ${dokter ? "AND jd.practitioner_uuid = $4" : ""}
     ORDER BY jd.start_time LIMIT 1`,
    dokter ? [faskesUuid, poli.uuid, hari, dokter.uuid] : [faskesUuid, poli.uuid, hari]
  );
  if (!jadwal) throw new PemetaanTidakDitemukan(`Tidak ada jadwal aktif pada poli/dokter tersebut untuk hari ${hari}`);

  return { poli, dokter, jadwal };
};

// Ringkasan kuota/sisa antrean pada jadwal + tanggal tertentu. report_antrian dibuat otomatis oleh antrian-service
// (findOrCreateReport) saat pendaftaran pertama pada hari itu; sebelum ada pendaftaran, laporan belum ada (sisa = kuota penuh).
export const ringkasanAntrean = async (faskesUuid, jadwalDokterUuid, tanggalPelayananEpoch) => {
  const report = await satu(
    `SELECT kuota, kuota_jkn, kuota_non_jkn, no_antrian_terakhir, jumlah_antrian_aktif, jumlah_jkn_aktif, jumlah_non_jkn_aktif
     FROM report_antrian WHERE faskes_uuid = $1 AND jadwal_dokter_uuid = $2 AND tanggal_pelayanan = $3 AND deleted_at IS NULL LIMIT 1`,
    [faskesUuid, jadwalDokterUuid, tanggalPelayananEpoch]
  );
  const jadwal = await satu(`SELECT kuota, kuota_jkn, kuota_non_jkn FROM jadwal_dokter WHERE uuid = $1`, [jadwalDokterUuid]);
  const kuotaJkn = report?.kuota_jkn ?? jadwal?.kuota_jkn ?? 0;
  const jknAktif = report?.jumlah_jkn_aktif ?? 0;
  return {
    kuota: report?.kuota ?? jadwal?.kuota ?? 0,
    kuotaJkn,
    terpakaiJkn: jknAktif,
    sisaJkn: Math.max(kuotaJkn - jknAktif, 0),
    totalTerdaftar: report?.no_antrian_terakhir ?? 0,
  };
};
