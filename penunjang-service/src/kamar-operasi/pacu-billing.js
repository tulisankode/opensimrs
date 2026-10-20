import { satu, transaksi, ubah, sisipkan } from "../db.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { pastikan } from "./pacu-validasi.js";

// Episode klinis sudah tersimpan sebelum pengiriman; kegagalan jaringan tidak membatalkan penyelesaian.
export const kirimBiayaPacu = (req) => transaksi(async (k) => {
  const f = req.author.faskesUuid;
  const biaya = await satu(`SELECT * FROM pacu_biaya WHERE episode_uuid=$1 AND faskes_uuid=$2
    AND ($3::text IS NULL OR uuid=$3) AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f, req.body.biaya_uuid ?? null], k);
  if (!biaya) return { status_kirim: "nonaktif", message: "Tidak ada biaya terpisah untuk episode ini" };
  if (biaya.status_kirim === "terkirim") return biaya;
  const sumber = await satu(`SELECT o.* FROM pacu_episode e
    JOIN ok_jadwal j ON j.uuid=e.jadwal_operasi_uuid AND j.faskes_uuid=e.faskes_uuid AND j.deleted_at IS NULL
    JOIN ok_order o ON o.uuid=j.order_uuid AND o.faskes_uuid=j.faskes_uuid AND o.deleted_at IS NULL
    WHERE e.uuid=$1 AND e.faskes_uuid=$2 AND e.deleted_at IS NULL AND e.status='selesai'`, [req.params.uuid, f], k);
  pastikan(sumber, "Sumber biaya tidak tersedia", 404);
  const cfg = biaya.konfigurasi_snapshot;
  let perubahan;
  try {
    await kirimTagihan({ faskesUuid: f, patientUuid: sumber.patient_uuid, noReg: sumber.no_reg,
      paymentMethod: sumber.payment_method, ref: biaya.kunci_idempoten, token: req.author.token, batasWaktuMs: 10000,
      items: [{ item_name: cfg.nama, price: cfg.tarif, qty: 1, additional_info: { layanan_uuid: cfg.layanan_uuid } }] });
    const bukti = await satu(`SELECT hasil FROM pacu_tagihan_referensi WHERE faskes_uuid=$1 AND kunci_idempoten=$2`, [f, biaya.kunci_idempoten], k);
    pastikan(bukti?.hasil?.data?.bill_uuid, "Bukti penerimaan biaya belum tersedia");
    perubahan = { status_kirim: "terkirim", referensi_tagihan: bukti.hasil.data.bill_uuid, kesalahan_terakhir: null };
  } catch {
    perubahan = { status_kirim: "perlu_rekonsiliasi", kesalahan_terakhir: "Pengiriman belum terkonfirmasi; ulangi dengan referensi yang sama" };
  }
  const baru = await ubah("pacu_biaya", biaya.uuid, f, { ...perubahan, jumlah_percobaan: biaya.jumlah_percobaan + 1,
    versi: biaya.versi + 1, updated_by: req.author.username }, k);
  await sisipkan("pacu_riwayat", { faskes_uuid: f, episode_uuid: biaya.episode_uuid, entitas: "biaya", entitas_uuid: biaya.uuid,
    aksi: "kirim_biaya", nilai_sebelum: biaya, nilai_sesudah: baru, created_by: req.author.username }, k);
  return baru;
});
