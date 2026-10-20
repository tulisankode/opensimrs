import { awalHariWib } from "../../mutu/bersama.js";
import { cocokCakupan, pilihTarget } from "./validasi.js";

export const susunRekap = (pegawai, sumber, target) => pegawai.map((p) => {
  const kegiatan = sumber.filter((s) => s.pegawai_uuid === p.uuid);
  const jamTercatat = kegiatan.reduce((n, s) => n + Math.round(Number(s.jam_diakui) * 100), 0) / 100;
  const t = pilihTarget(target, p), targetJam = t ? Number(t.target_jam) : null;
  return { ...p, jam_tercatat: jamTercatat, target_jam: targetJam, sumber_target: t?.jenis_cakupan ?? null,
    kekurangan_jam: t ? Math.max(0, Math.round((targetJam - jamTercatat) * 100) / 100) : null,
    status_pemenuhan: t ? (jamTercatat >= targetJam ? "terpenuhi" : "belum_terpenuhi") : "belum_ditetapkan", sumber: kegiatan };
});

export const sertifikatSah = (s, waktu) => s.kredensial_status === "aktif" && s.kredensial_verifikasi === "terverifikasi"
  && (!s.tanggal_mulai || Number(s.tanggal_mulai) <= waktu)
  && (s.tanggal_berakhir == null || Number(s.tanggal_berakhir) >= awalHariWib(waktu));

export const pelatihanMasihBerlaku = (s, waktu) => {
  if (Number(s.jadwal_selesai) > waktu) return false;
  if (!s.masa_berlaku_tahun) return true;
  const d = new Date((Number(s.jadwal_selesai) + 7 * 3600) * 1000);
  const y = d.getUTCFullYear() + Number(s.masa_berlaku_tahun), m = d.getUTCMonth();
  const akhir = Date.UTC(y, m, Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate())) / 1000 - 7 * 3600;
  return awalHariWib(waktu) <= akhir;
};

export const susunWajib = (pegawai, katalog, cakupan, sumber, kebijakan, waktu) => {
  if (!kebijakan) return [];
  const kurang = [];
  for (const p of pegawai) for (const kat of katalog) {
    const wajib = cakupan.some((c) => c.katalog_uuid === kat.uuid && Number(c.mulai_berlaku) <= waktu
      && (c.akhir_berlaku == null || Number(c.akhir_berlaku) > waktu) && cocokCakupan(c, p));
    if (!wajib) continue;
    const riwayat = sumber.filter((s) => s.pegawai_uuid === p.uuid && s.katalog_uuid === kat.uuid && s.hasil === "lulus"
      && ["hadir", "sebagian"].includes(s.kehadiran) && pelatihanMasihBerlaku(s, waktu));
    if (riwayat.some((s) => !kebijakan.syarat_sertifikat || sertifikatSah(s, waktu))) continue;
    kurang.push({ pegawai_uuid: p.uuid, nama_pegawai: p.nama_pegawai, unit_uuid: p.unit_uuid, tipe: p.tipe,
      katalog_uuid: kat.uuid, nama_pelatihan: kat.nama, alasan: riwayat.length ? "sertifikat_belum_sah" : "belum_menyelesaikan_pelatihan" });
  }
  return kurang;
};

export const susunPeringatan = (sumber, waktu, hari) => {
  const hariIni = awalHariWib(waktu), batas = hariIni + hari * 86400;
  return sumber.filter((s) => s.kredensial_uuid && s.kredensial_status === "aktif" && s.tanggal_berakhir != null && Number(s.tanggal_berakhir) <= batas)
    .map((s) => ({ pegawai_uuid: s.pegawai_uuid, nama_pegawai: s.nama_pegawai, kegiatan_uuid: s.kegiatan_uuid,
      nama_pelatihan: s.nama_pelatihan, kredensial_uuid: s.kredensial_uuid, nomor: s.nomor, tanggal_berakhir: s.tanggal_berakhir,
      status_verifikasi: s.kredensial_verifikasi, status_masa_berlaku: Number(s.tanggal_berakhir) < hariIni ? "kedaluwarsa" : "akan_kedaluwarsa",
      sisa_hari: Math.round((Number(s.tanggal_berakhir) - hariIni) / 86400) }));
};
