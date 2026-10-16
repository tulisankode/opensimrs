import { satu } from "../db.js";

// Integrasi SATUSEHAT (KF-24/25): modul `satusehat` tercatat "inti" di katalog (selalu aktif), sehingga syarat
// nyata adalah konfigurasi faskes di tabel `integrations` (diisi Setting › Konfigurasi Integrasi, dikelola
// satusehat-service). Pemetaan resource Immunization FHIR belum ditetapkan (lihat dokumen desain, pertanyaan
// terbuka #5) — fungsi ini hanya mencatat status agar alur KF-25/KT-12/KT-13 dapat diuji, tanpa mengirim data
// nyata. Kegagalan/pembatasan integrasi tidak pernah menggagalkan penyimpanan pelayanan imunisasi (NF-5).

export const satuSehatAktif = async (faskesUuid) => {
  const row = await satu(`SELECT status_satu_sehat FROM integrations WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, [faskesUuid]);
  return !!row?.status_satu_sehat;
};

// Status awal imunisasi: 'menunggu' bila SATUSEHAT aktif untuk faskes (akan diproses pekerja/kirim-ulang),
// atau 'tidak_berlaku' bila tidak dikonfigurasi (KT-13: sistem tidak mencoba mengirim dan tidak menampilkan status).
export const statusAwalKirim = async (faskesUuid) => ((await satuSehatAktif(faskesUuid)) ? "menunggu" : "tidak_berlaku");

// Percobaan kirim resource Immunization. Pemetaan FHIR belum diimplementasikan di satusehat-service untuk
// data program puskesmas — ditandai gagal dengan pesan yang jelas agar tidak dianggap berhasil (bukan diam-diam
// ditampilkan "terkirim").
export const kirimImunisasiSatuSehat = async () => ({
  status: "gagal",
  pesan: "Pemetaan resource Immunization SATUSEHAT untuk Program Puskesmas belum tersedia di satusehat-service.",
});
