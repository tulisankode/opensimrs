import config from "../config.js";
import { Galat } from "../umum/respons.js";

// Baca diagnosis dokter & data resume dari RME (rekamedis-service, MongoDB) lewat kontrak HTTP layanan yang sudah
// ada (dipakai juga oleh RME sendiri untuk menyusun resume pulang). Koding tidak pernah menulis ke layanan ini.
// diagnosa_dokter: [{ diagnosis_uuid, diagnosis, diferensial, tipe, petugas }] — "diagnosis_uuid" di sini adalah id
// baris Mongo (bukan kode ICD-10), dipakai sebagai referensi pembanding (sumber_dokter_uuid) saja.
export const resumeRme = async (rekamMedisUuid, kunjunganTipe, faskesUuid, token) => {
  if (!rekamMedisUuid) return null;
  const q = new URLSearchParams({ rekam_medis_uuid: rekamMedisUuid, pelayanan: kunjunganTipe, faskes_uuid: faskesUuid });
  let res;
  try {
    res = await fetch(`${config.rekamedisUrl}/pelayanan/resume?${q}`, { headers: token ? { Authorization: token } : {} });
  } catch {
    throw new Galat(502, "Rekam medis elektronik tidak dapat dihubungi, coba lagi");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Galat(502, "Resume rekam medis gagal dimuat, coba lagi");
  const j = await res.json().catch(() => null);
  const payload = j?.payload ?? null;
  return {
    status_pulang: payload?.status_pulang ?? null,
    discharge_date: payload?.discharge_date ?? null,
    diagnosaDokter: Array.isArray(payload?.diagnosa_dokter) ? payload.diagnosa_dokter : [],
  };
};
