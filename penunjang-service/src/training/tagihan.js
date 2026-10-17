import { kirimTagihan } from "../umum/tagihan.js";

// Tagihan order Training ke Pembayaran: satu item senilai tarif snapshot order (training_order.harga).
// Order kelas tidak berasal dari kunjungan (No. Reg); selalu masuk sebagai layanan APS tersendiri (type TRAINING).
// ref unik per order ("training:<uuid>") agar kirim ulang mengganti item yang sama; hapus = batal (lihat umum/tagihan.js).
export const tagihanOrder = async (order, author, k, hapus = false) =>
  kirimTagihan({
    faskesUuid: order.faskes_uuid,
    patientUuid: order.patient_uuid,
    noReg: null,
    paymentMethod: order.payment_method,
    ref: `training:${order.uuid}`,
    items: hapus ? [] : [{ item_name: `Kelas Training: ${order.kelas_nama ?? ""}`.trim(), qty: 1, price: Number(order.harga), additional_info: { no_order: order.no_order, kelas_uuid: order.kelas_uuid, sesi_uuid: order.sesi_uuid } }],
    token: author.token,
    hapus,
    apsType: "TRAINING",
    apsServiceName: "Kelas Training",
    apsServiceCode: order.no_order,
    apsLayananUuid: order.uuid,
  });
