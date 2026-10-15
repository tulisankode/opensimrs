import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { QueryTypes } from "sequelize";

// Tagihan pemeriksaan laboratorium ke modul Pembayaran (kategori 5 = Biaya Penunjang).
// - Ditagih saat order divalidasi; dihapus saat validasi/order dibatalkan.
// - Masuk ke tagihan kunjungan asal (RJ/RI/IGD sesuai No. Reg) agar dibayar sekaligus; pasien APS
//   mendapat layanan "Laboratorium" sendiri.
// - Item diberi ref "lab:<order>" sehingga pengiriman ulang mengganti item order yang sama (tidak dobel).

const KATEGORI_PENUNJANG = "5";
const BASE_PEMBAYARAN = (process.env.BASE_URL_API_PEMBAYARAN || "http://localhost:8089/api/v3/payment/internal").replace(/\/$/, "");

const cariKunjungan = async (noReg, faskesUuid) => {
    if (!noReg) return null;
    const [k] = await sequelizeInstance.query(
        `SELECT * FROM (
             SELECT 'RJ' AS type, 'Rawat Jalan' AS service_name, r.uuid, r.no_reg, r.patient_uuid, r.practitioner_uuid, r.payment_method
               FROM rawat_jalans r WHERE r.no_reg = :noReg AND r.faskes_uuid = :faskes AND r.deleted_at IS NULL
             UNION ALL
             SELECT 'RI', 'Rawat Inap', r.uuid, r.no_reg, r.patient_uuid, r.practitioner_uuid, r.payment_method
               FROM rawat_inaps r WHERE r.no_reg = :noReg AND r.faskes_uuid = :faskes AND r.deleted_at IS NULL
             UNION ALL
             SELECT 'IGD', 'IGD', r.uuid, r.no_reg, r.patient_uuid, r.practitioner_uuid, r.payment_method
               FROM instalasi_gawat_darurats r WHERE r.no_reg = :noReg AND r.faskes_uuid = :faskes AND r.deleted_at IS NULL
           ) k LIMIT 1`,
        { replacements: { noReg, faskes: faskesUuid }, type: QueryTypes.SELECT }
    );
    return k ?? null;
};

const namaPraktisi = async (practitionerUuid) => {
    if (!practitionerUuid) return null;
    const [p] = await sequelizeInstance.query(
        `SELECT pg.name FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = :uuid LIMIT 1`,
        { replacements: { uuid: practitionerUuid }, type: QueryTypes.SELECT }
    );
    return p?.name ?? null;
};

export default class TagihanLabService {
    static async itemOrder(orderUuid, ref) {
        const baris = await sequelizeInstance.query(
            `SELECT tl.code, tl.name, tl.grand_total
               FROM order_lab_pemeriksaan o JOIN tarif_lab tl ON tl.uuid = o.tarif_lab_uuid
              WHERE o.order_lab_uuid = :order AND o.deleted_at IS NULL`,
            { replacements: { order: orderUuid }, type: QueryTypes.SELECT }
        );
        return baris.map((b) => ({
            item_name: `Lab: ${b.name}`,
            qty: 1,
            price: Number(b.grand_total) || 0,
            category_code: KATEGORI_PENUNJANG,
            additional_info: { ref, kode_tarif: b.code },
        }));
    }

    // Kirim (atau hapus, bila hapus=true) tagihan satu order lab. Melempar galat bila Pembayaran menolak.
    static async kirim({ order, token, hapus = false }) {
        // Order MCU (is_mcu): pemeriksaan sudah termasuk harga paket MCU / tindakan MCU yang ditagihkan modulnya
        // sendiri — tidak dibuat tagihan lab terpisah (mencegah tagihan ganda), juga tidak ada yang perlu dihapus.
        if (order?.is_mcu) return { dikirim: false, total: 0, mcu: true };
        const ref = `lab:${order.uuid}`;
        const items = hapus ? [] : await this.itemOrder(order.uuid, ref);
        if (!hapus && items.length === 0) return { dikirim: false, total: 0 };

        const kunjungan = order.pelayanan === "aps" ? null : await cariKunjungan(order.noreg, order.faskes_uuid);
        const [pasien] = await sequelizeInstance.query(
            `SELECT uuid, name FROM patients WHERE uuid = :uuid LIMIT 1`,
            { replacements: { uuid: kunjungan?.patient_uuid ?? order.patient_uuid }, type: QueryTypes.SELECT }
        );
        const metodeBayar = Number(kunjungan?.payment_method ?? order.payment_method);

        const layanan = kunjungan
            ? {
                type: kunjungan.type,
                practitioner_name: await namaPraktisi(kunjungan.practitioner_uuid),
                service_name: kunjungan.service_name,
                service_code: kunjungan.no_reg,
                layanan_uuid: kunjungan.uuid,
            }
            : {
                type: "LAB",
                practitioner_name: order.dokter_pengirim ?? null,
                service_name: "Laboratorium",
                service_code: order.no_order ?? order.noreg,
                layanan_uuid: order.uuid,
            };

        const res = await fetch(`${BASE_PEMBAYARAN}/bills`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
            body: JSON.stringify({
                faskes_uuid: order.faskes_uuid,
                patient_uuid: pasien?.uuid ?? order.patient_uuid,
                patient_name: pasien?.name ?? null,
                target_patient_uuid: null,
                services: [{ ...layanan, with_insurance: metodeBayar !== 1, replace_ref: ref, items }],
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
            throw new Error(`Tagihan laboratorium gagal dikirim ke Pembayaran: ${pesan}`);
        }
        return { dikirim: true, total: items.reduce((n, i) => n + i.price * i.qty, 0) };
    }
}
