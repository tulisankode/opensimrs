import config from "../config.js";
import { cariKunjungan, namaPraktisi, pasien } from "./kunjungan.js";

// Tagihan penunjang ke modul Pembayaran (kategori 5 = Biaya Penunjang), pola sama dengan tagihan lab:
// - Order dari kunjungan (No. Reg) masuk ke tagihan kunjungan asal agar dibayar sekaligus.
// - Pasien APS / MCU perorangan mendapat layanan sendiri (type FISIO / RAD / MCU).
// - Setiap order memakai ref unik (mis. "rad:<uuid>"): kirim ulang mengganti item order yang sama, `hapus`
//   mengosongkan item order tsb (batal order).
export const KATEGORI_PENUNJANG = "5";

export const kirimTagihan = async ({
  faskesUuid, patientUuid, noReg, paymentMethod, ref, items, token, hapus = false,
  apsType, apsServiceName, apsServiceCode, apsLayananUuid, apsPraktisi = null,
}) => {
  const isi = hapus ? [] : items.map((i) => ({ qty: 1, category_code: KATEGORI_PENUNJANG, ...i, additional_info: { ...(i.additional_info ?? {}), ref } }));
  if (!hapus && isi.length === 0) return { dikirim: false, total: 0 };

  const kunjungan = noReg ? await cariKunjungan(noReg, faskesUuid) : null;
  const p = await pasien(kunjungan?.patient_uuid ?? patientUuid, faskesUuid);
  const metodeBayar = Number(kunjungan?.payment_method ?? paymentMethod ?? 1);
  const layanan = kunjungan
    ? {
        type: kunjungan.type,
        practitioner_name: await namaPraktisi(kunjungan.practitioner_uuid),
        service_name: kunjungan.service_name,
        service_code: kunjungan.no_reg,
        layanan_uuid: kunjungan.uuid,
      }
    : { type: apsType, practitioner_name: apsPraktisi, service_name: apsServiceName, service_code: apsServiceCode, layanan_uuid: apsLayananUuid };

  const res = await fetch(`${config.pembayaranUrl}/bills`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: JSON.stringify({
      faskes_uuid: faskesUuid,
      patient_uuid: p?.uuid ?? patientUuid,
      patient_name: p?.name ?? null,
      target_patient_uuid: null,
      services: [{ ...layanan, with_insurance: metodeBayar !== 1, replace_ref: ref, items: isi }],
    }),
  });
  if (!res.ok) {
    let pesan = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      pesan = j?.errors?.[0]?.message || j?.message || pesan;
    } catch {
      /* biarkan pesan HTTP */
    }
    const e = new Error(`Tagihan gagal dikirim ke Pembayaran: ${pesan}`);
    e.status = 502;
    throw e;
  }
  return { dikirim: true, total: isi.reduce((n, i) => n + Number(i.price) * Number(i.qty ?? 1), 0) };
};
