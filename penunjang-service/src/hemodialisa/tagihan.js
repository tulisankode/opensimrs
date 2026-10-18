import { satu, sekarang } from "../db.js";
import { Galat, tidakDitemukan } from "../umum/respons.js";
import { kirimTagihan } from "../umum/tagihan.js";

// Tagihan tindakan HD per sesi (KF-10/KT-15/KT-16) ke modul Pembayaran lewat umum/tagihan.js. Ref stabil
// `hd-sesi:<uuid>`: kirim ulang mengganti item ref yang sama di Pembayaran (tidak menambah baris), dan status_tagihan
// 'terkirim' di hd_sesi membuat pengulangan tidak mengirim lagi. Tarif memakai Datamaster › Tarif dengan konvensi kode
// HD-<JENIS> (HD-KRONIS / HD-AKUT) lalu HD-TINDAKAN sebagai cadangan — paket klaim BPJS HD di luar cakupan (PRD §12);
// tanpa tarif terkonfigurasi status menjadi 'tertunda' (dapat dikirim ulang setelah tarif dilengkapi).
export const kodeTarifSesi = (jenis) => [`HD-${String(jenis ?? "").toUpperCase()}`, "HD-TINDAKAN"];

const tarifTindakan = (jenis, faskes) =>
  satu(
    `SELECT uuid, code, name, grand_total::float8 AS harga FROM tarif
      WHERE faskes_uuid = $1 AND code = ANY($2::text[]) AND status AND deleted_at IS NULL AND grand_total IS NOT NULL
      ORDER BY array_position($2::text[], code::text) LIMIT 1`,
    [faskes, kodeTarifSesi(jenis)],
  );

const simpanStatus = (uuid, status, pesan) =>
  satu(`UPDATE hd_sesi SET status_tagihan = $2, pesan_tagihan = $3, updated_at = $4 WHERE uuid = $1 RETURNING status_tagihan, pesan_tagihan`, [uuid, status, pesan, sekarang()]);

export const kirimTagihanSesi = async (sesiUuid, faskes, token) => {
  const s = await satu(
    `SELECT se.uuid, se.status, se.status_tagihan, j.uuid AS jadwal_uuid, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, COALESCE(j.no_reg, r.no_reg) AS no_reg,
            r.uuid AS registrasi_uuid, r.patient_uuid, r.no_reg_hd, r.jenis, r.payment_method
       FROM hd_sesi se JOIN hd_jadwal j ON j.uuid = se.jadwal_uuid JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid
      WHERE se.uuid = $1 AND se.faskes_uuid = $2 AND se.deleted_at IS NULL`,
    [sesiUuid, faskes],
  );
  if (!s) throw tidakDitemukan("Sesi HD");
  if (s.status !== "selesai") throw new Galat(409, "Tagihan tindakan hanya dibuat untuk sesi yang sudah ditutup");
  if (s.status_tagihan === "terkirim") return { status_tagihan: "terkirim", pesan_tagihan: null, duplikat: true };

  const tarif = await tarifTindakan(s.jenis, faskes);
  if (!tarif) return simpanStatus(s.uuid, "tertunda", `Tarif ${kodeTarifSesi(s.jenis).join(" / ")} belum dikonfigurasi di Datamaster › Tarif`);
  try {
    await kirimTagihan({
      faskesUuid: faskes,
      patientUuid: s.patient_uuid,
      noReg: s.no_reg,
      paymentMethod: s.payment_method,
      ref: `hd-sesi:${s.uuid}`,
      items: [
        {
          item_name: `Tindakan Hemodialisa (${s.jenis}) ${s.tanggal}`,
          qty: 1,
          price: tarif.harga,
          additional_info: { sesi_uuid: s.uuid, jadwal_uuid: s.jadwal_uuid, kode_tarif: tarif.code, no_reg_hd: s.no_reg_hd },
        },
      ],
      token,
      apsType: "HD",
      apsServiceName: "Unit Hemodialisa",
      apsServiceCode: s.no_reg_hd,
      apsLayananUuid: s.registrasi_uuid,
    });
    return simpanStatus(s.uuid, "terkirim", null);
  } catch (e) {
    return simpanStatus(s.uuid, "gagal", e.message);
  }
};
