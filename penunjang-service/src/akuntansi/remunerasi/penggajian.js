import { query, satu, sisipkan, ubah } from "../../db.js";
import { konflik, hash } from "../../hr/penggajian/bersama.js";
import { sen } from "../../hr/penggajian/perhitungan.js";

export const pastikanPembayaranMandiri = async (k, f, uuid) => {
  const ada = await satu(`SELECT uuid FROM hr_gaji_jaspel_sumber WHERE faskes_uuid = $1 AND remunerasi_periode_uuid = $2 AND status <> 'dilepas' AND deleted_at IS NULL`, [f, uuid], k);
  if (ada) throw konflik("Periode Remunerasi telah dicadangkan atau dibayarkan melalui penggajian");
};
export const referensiPenggajian = (k, f, uuid) => satu(`SELECT s.periode_uuid, s.status, j.jurnal_uuid, j.status AS status_jurnal
  FROM hr_gaji_jaspel_sumber s LEFT JOIN hr_gaji_jurnal j ON j.faskes_uuid = s.faskes_uuid AND j.periode_uuid = s.periode_uuid AND j.deleted_at IS NULL
  WHERE s.faskes_uuid = $1 AND s.remunerasi_periode_uuid = $2 AND s.status <> 'dilepas' AND s.deleted_at IS NULL`, [f, uuid], k);
export const ambilHasilPenggajian = async (k, f, uuid, periodeUuid, { sesudahBayar = false } = {}) => {
  const p = await satu(`SELECT uuid, tahun, bulan, status, hash_hitung, jurnal_uuid, total FROM remunerasi_periode WHERE faskes_uuid = $1 AND uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [f, uuid], k);
  if (!p || p.status !== "disetujui" || !p.jurnal_uuid) throw konflik("Jasa pelayanan belum final atau sudah dibayar");
  const jurnal = await satu(`SELECT uuid FROM akuntansi_jurnal WHERE faskes_uuid = $1 AND uuid = $2 AND deleted_at IS NULL AND status = 'final'`, [f, p.jurnal_uuid], k);
  if (!jurnal) throw konflik("Jurnal beban Remunerasi tidak tersedia");
  const pemilik = await satu(`SELECT periode_uuid, status FROM hr_gaji_jaspel_sumber WHERE faskes_uuid = $1 AND remunerasi_periode_uuid = $2 AND status <> 'dilepas' AND deleted_at IS NULL`, [f, uuid], k);
  if (pemilik && (pemilik.periode_uuid !== periodeUuid || !sesudahBayar && pemilik.status !== "reservasi")) throw konflik("Sumber jasa pelayanan telah digunakan penggajian lain atau sudah dibayarkan");
  const rows = await query(`SELECT r.uuid AS rincian_uuid, r.practitioner_uuid, r.total, pr.pegawai_uuid, h.uuid AS kepegawaian_uuid
    FROM remunerasi_rincian r
    LEFT JOIN practitioner pr ON pr.uuid = r.practitioner_uuid AND pr.faskes_uuid = r.faskes_uuid AND pr.deleted_at IS NULL AND pr.status = true
    LEFT JOIN hr_kepegawaian h ON h.pegawai_uuid = pr.pegawai_uuid AND h.faskes_uuid = r.faskes_uuid AND h.deleted_at IS NULL
    WHERE r.faskes_uuid = $1 AND r.periode_uuid = $2 ORDER BY r.uuid`, [f, uuid], k);
  if (!rows.length || rows.some((r) => !r.kepegawaian_uuid) || new Set(rows.map((r) => r.kepegawaian_uuid)).size !== rows.length) throw konflik("Seluruh penerima Remunerasi harus terpetakan secara tunggal ke pegawai SDM");
  if (rows.some((r) => sen(r.total) < 0n)) throw konflik("Hasil jasa pelayanan final tidak boleh negatif");
  if (rows.reduce((n, r) => n + sen(r.total), 0n) !== sen(p.total)) throw konflik("Jumlah sumber jasa pelayanan tidak sesuai total final");
  return { periode_uuid: p.uuid, tahun: p.tahun, bulan: p.bulan, status: p.status, jurnal_beban_uuid: p.jurnal_uuid, penerima: rows, hash_sumber: hash({ periode: p, penerima: rows }) };
};
export const reservasiJaspel = async (k, f, periodeUuid, sumber) => {
  const ada = await satu(`SELECT * FROM hr_gaji_jaspel_sumber WHERE faskes_uuid = $1 AND periode_uuid = $2 AND status <> 'dilepas' AND deleted_at IS NULL FOR UPDATE`, [f, periodeUuid], k);
  if (ada) {
    if (ada.remunerasi_periode_uuid !== sumber.periode_uuid || ada.status !== "reservasi") throw konflik("Reservasi sumber tidak sesuai");
    return ubah("hr_gaji_jaspel_sumber", ada.uuid, f, { hash_sumber: sumber.hash_sumber }, k);
  }
  return sisipkan("hr_gaji_jaspel_sumber", { faskes_uuid: f, periode_uuid: periodeUuid, remunerasi_periode_uuid: sumber.periode_uuid, hash_sumber: sumber.hash_sumber, status: "reservasi" }, k);
};
export const selesaikanJaspel = async (k, f, p, jurnalUuid) => {
  const sumber = await ambilHasilPenggajian(k, f, p.remunerasi_periode_uuid, p.uuid, { sesudahBayar: true });
  const r = await satu(`SELECT * FROM hr_gaji_jaspel_sumber WHERE faskes_uuid = $1 AND periode_uuid = $2 AND status = 'dibayar' AND deleted_at IS NULL FOR UPDATE`, [f, p.uuid], k);
  if (!r || r.hash_sumber !== sumber.hash_sumber) throw konflik("Sumber pembayaran Remunerasi berubah");
  await ubah("remunerasi_periode", sumber.periode_uuid, f, { status: "dibayar", dibayar_oleh: p.dibayar_oleh, dibayar_pada: p.updated_at, tanggal_bayar: p.tanggal_bayar, metode_bayar: p.metode_bayar, referensi_bayar: `Penggajian ${p.uuid}`, jurnal_bayar_uuid: jurnalUuid }, k);
  await ubah("hr_gaji_jaspel_sumber", r.uuid, f, { status: "selesai" }, k);
};
