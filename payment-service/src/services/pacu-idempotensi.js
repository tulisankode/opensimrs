// Dipanggil dalam transaksi pembentukan tagihan. Bukti tetap berlaku setelah tagihan ditutup.
export const ambilBuktiPacu = async (trx, faskesUuid, referensi) => {
  await trx.raw('SELECT pg_advisory_xact_lock(hashtextextended(?,0))', [`pacu-tagihan:${faskesUuid}:${referensi}`]);
  return trx('pacu_tagihan_referensi').where({ faskes_uuid: faskesUuid, kunci_idempoten: referensi }).first();
};
export const simpanBuktiPacu = (trx, faskesUuid, referensi, hasil, waktu, uuid, pelaku) =>
  trx('pacu_tagihan_referensi').insert({ uuid, faskes_uuid: faskesUuid, kunci_idempoten: referensi, hasil: JSON.stringify(hasil), created_at: waktu, updated_at: waktu, created_by: pelaku });

export const izinBiayaPacu = (permissions, role) => {
  let daftar = permissions;
  if (typeof daftar === 'string') {
    try { daftar = JSON.parse(daftar); } catch { return false; }
  }
  if (!Array.isArray(daftar)) return false;
  if (!daftar.length && String(role).toLowerCase() === 'super admin') return true;
  const modul = daftar.find((m) => m.module === 'Kamar Operasi');
  return (modul?.subModules ?? []).some((s) =>
    (s.name === 'Biaya PACU' && s.allows?.includes('KIRIM')) ||
    (s.name === 'Episode PACU' && s.allows?.includes('SELESAIKAN')));
};
