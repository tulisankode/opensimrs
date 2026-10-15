import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { QueryTypes } from "sequelize";
import { hitungSegmenKamar, pilihHargaKamar } from "../helpers/biaya-kamar.js";
import { checkNoIdentity, createBilling } from "../configurations/axios-instance.js";
import Utils from "../helpers/utils.js";

// Biaya kamar rawat inap dihitung otomatis saat discharge:
//  - lama rawat per kamar dari tanggal masuk, riwayat perpindahan (yang disetujui) dan tanggal pulang;
//  - hari dihitung per tanggal kalender WIB (tanggal pulang tidak dihitung, minimal 1 hari);
//  - hari perpindahan ditagihkan ke kamar tujuan; pindah bed di kamar yang sama tidak memecah tagihan;
//  - harga dari Datamaster › Tarif › Ruangan (jenis_tarif "Ruangan", lokasi = kamar) sesuai cara bayar.
// Item dikirim dengan category_code "4" dan mengganti item kamar sebelumnya (aman dikirim ulang).

const KATEGORI_KAMAR = "4";

export default class BiayaKamarService {
    static async hitung(rawatInap, tanggalPulang) {
        const perpindahan = await sequelizeInstance.query(
            `SELECT p.waktu_pindah AS waktu, asal.room_uuid AS kamar_asal, tujuan.room_uuid AS kamar_tujuan
               FROM perpindahans p
               LEFT JOIN room_monitorings asal ON asal.uuid = p.origin_monitoring_room_uuid
               LEFT JOIN room_monitorings tujuan ON tujuan.uuid = p.destination_monitoring_room_uuid
              WHERE p.admission_ri_uuid = :ri AND p.status_pindah = 'approve' AND p.deleted_at IS NULL
              ORDER BY p.waktu_pindah`,
            { replacements: { ri: rawatInap.uuid }, type: QueryTypes.SELECT }
        );
        const kamarAwal = perpindahan[0]?.kamar_asal ?? rawatInap.lokasiUuid;
        const mulai = rawatInap.tanggalDirawat ?? rawatInap.tanggalDaftar ?? rawatInap.createdAt;
        const segmen = hitungSegmenKamar({ mulai, selesai: tanggalPulang, kamarAwal, perpindahan });

        const kamarUuids = [...new Set(segmen.map((s) => s.kamar).filter(Boolean))];
        const [tarif, lokasi] = kamarUuids.length === 0 ? [[], []] : await Promise.all([
            sequelizeInstance.query(
                `SELECT lokasi_uuid, name, penjamin FROM tarif
                  WHERE jenis_tarif = 'Ruangan' AND status = true AND deleted_at IS NULL
                    AND faskes_uuid = :faskes AND lokasi_uuid IN (:kamar)
                  ORDER BY updated_at DESC`,
                { replacements: { faskes: rawatInap.faskesUuid, kamar: kamarUuids }, type: QueryTypes.SELECT }
            ),
            sequelizeInstance.query(
                `SELECT uuid, name, class_name FROM lokasi WHERE uuid IN (:kamar)`,
                { replacements: { kamar: kamarUuids }, type: QueryTypes.SELECT }
            ),
        ]);

        const items = [];
        const tanpaTarif = [];
        for (const s of segmen) {
            const lok = lokasi.find((l) => l.uuid === s.kamar);
            const namaKamar = [lok?.name ?? "Kamar", lok?.class_name].filter(Boolean).join(" - ");
            const t = tarif.find((x) => x.lokasi_uuid === s.kamar);
            const harga = t ? pilihHargaKamar(t.penjamin, rawatInap.paymentMethod) : null;
            if (!harga) { tanpaTarif.push(namaKamar); continue; }
            items.push({
                item_name: `Sewa Kamar ${namaKamar} (${s.hari} hari)`,
                qty: s.hari,
                price: harga.harga,
                category_code: KATEGORI_KAMAR,
                additional_info: {
                    lokasi_uuid: s.kamar,
                    dari: Number(s.dari),
                    sampai: Number(s.sampai),
                    tarif: t.name,
                    penjamin: harga.penjamin,
                },
            });
        }
        return { segmen, items, tanpaTarif };
    }

    // Kirim biaya kamar ke modul Pembayaran untuk layanan RI (hasil PelayananRepository.getPelayanan("ri", ...)).
    static async tagih(layanan, tanggalPulang, token) {
        const { items, tanpaTarif } = await this.hitung(layanan, tanggalPulang);
        // Bayi baru lahir: tagihan digabung ke tagihan ibu (sama dengan tagihan tindakan).
        let targetPatient = null;
        if (layanan.patient?.is_new_born) {
            try {
                const res = await checkNoIdentity.get("/", {
                    params: { noIdentity: layanan.patient.noIdentity, faskesUuid: layanan.faskesUuid },
                    headers: { Authorization: token },
                });
                targetPatient = res.data.payload.uuid;
            } catch (error) {
                throw new Error(error.response?.data?.message || "Terjadi kesalahan pada ambil data Admisi");
            }
        }
        const payload = {
            faskes_uuid: layanan.faskesUuid,
            patient_uuid: layanan.patientUuid,
            patient_name: layanan.name,
            target_patient_uuid: targetPatient,
            services: [
                {
                    type: layanan.encounter,
                    practitioner_name: layanan.practitioner?.pegawai?.name,
                    service_name: await Utils.serviceName(layanan.encounter, layanan),
                    service_code: layanan.noReg,
                    layanan_uuid: layanan.uuid,
                    with_insurance: layanan.paymentMethod !== 1,
                    replace_category_codes: [KATEGORI_KAMAR],
                    items,
                },
            ],
        };
        try {
            await createBilling.post("/", payload, { headers: { Authorization: token } });
        } catch (error) {
            throw new Error(error.response?.data?.message || "Gagal mengirim biaya kamar ke Pembayaran");
        }
        return {
            total: items.reduce((n, i) => n + i.qty * i.price, 0),
            hari: items.reduce((n, i) => n + i.qty, 0),
            tanpa_tarif: tanpaTarif,
        };
    }
}
