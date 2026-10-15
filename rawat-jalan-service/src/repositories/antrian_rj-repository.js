import sequelizeInstance from "@opensimrs/model-sdk/instance";
import moment from "moment";
import { Op, QueryTypes } from "sequelize";
import {RawatJalanModel} from "@opensimrs/model-sdk/pelayanan";
import {PatientModel} from "@opensimrs/model-sdk/admisi";
import dayjs from "dayjs";
import { createAntrianCall, getAllAntrianCall, updateAntrianCall } from "../configurations/axios-instance.js";

// status_rj: 0 batal, 1 booking, 2 check-in, 3 antrian, 4 diperiksa, 5 selesai (discharge)
const RJ_BATAL = 0;
const RJ_DIPERIKSA = 4;
const RJ_SELESAI = 5;
const RJ_BELUM_DIPERIKSA = [1, 2, 3];
const PANGGILAN_SELESAI = 4;

export default class AntrianRawatJalanRepository {
    static async getAntrian(args){
        try {
            const result = await getAllAntrianCall.get("/all", { params: args });

            const startOfDay = dayjs().startOf("day").format("YYYY-MM-DD");

            const antrian = result.data.payload.filter((item) => item.pelayanan == "poli" && dayjs.unix(item.patient_data.jadwal_periksa).format("YYYY-MM-DD") >= startOfDay && dayjs.unix(item.patient_data.jadwal_periksa).format("YYYY-MM-DD") <= startOfDay).sort((a, b) => a.patient_data.antrian.no_antrian_poli - b.patient_data.antrian.no_antrian_poli);

            // Selaraskan dengan status kunjungan: kunjungan batal tidak dipanggil lagi, kunjungan yang
            // sudah selesai (discharge) tampil sebagai panggilan selesai, bukan antrian aktif.
            const rjUuids = [...new Set(antrian.map((a) => a.rawat_jalan_uuid).filter(Boolean))];
            if (rjUuids.length === 0) return antrian;
            const kunjungan = await RawatJalanModel.findAll({
                attributes: ["uuid", "statusRj"],
                where: { uuid: { [Op.in]: rjUuids } },
            });
            const statusRj = new Map(kunjungan.map((k) => [k.uuid, k.statusRj]));

            return antrian
                .filter((a) => statusRj.get(a.rawat_jalan_uuid) !== RJ_BATAL)
                .map((a) => statusRj.get(a.rawat_jalan_uuid) === RJ_SELESAI && a.status_panggilan !== PANGGILAN_SELESAI
                    ? { ...a, status_panggilan: PANGGILAN_SELESAI }
                    : a);

        } catch (error) {
            console.error("Error fetching all antrian:", error);
            throw error;
        }
    }

    // Tandai kunjungan "diperiksa" hanya bila belum diperiksa, agar kunjungan yang sudah selesai/batal
    // tidak terbuka kembali karena tombol panggilan ditekan.
    static async tandaiDiperiksa(rawatJalanUuid) {
        if (!rawatJalanUuid) return;
        await RawatJalanModel.update(
            { statusRj: RJ_DIPERIKSA, tanggalPeriksa: moment().unix() },
            { where: { uuid: rawatJalanUuid, statusRj: { [Op.in]: RJ_BELUM_DIPERIKSA } } }
        );
    }

    static async konteksPetugas(userUuid) {
        const kosong = { practitioner_uuid: null, is_doctor: false, nama: null, poli: [] };
        if (!userUuid) return kosong;
        const [p] = await sequelizeInstance.query(
            `SELECT pr.uuid, pr.is_doctor, pr.poli_pelayanan, pg.name
               FROM users u
               JOIN practitioner pr ON pr.uuid = u.practitioner_uuid AND pr.deleted_at IS NULL
               LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
              WHERE u.uuid = :user LIMIT 1`,
            { replacements: { user: userUuid }, type: QueryTypes.SELECT }
        );
        if (!p) return kosong;
        let poli = [];
        try { poli = JSON.parse(p.poli_pelayanan || "[]"); } catch { poli = []; }
        return {
            practitioner_uuid: p.uuid,
            is_doctor: !!p.is_doctor,
            nama: p.name ?? null,
            poli: (Array.isArray(poli) ? poli : []).filter((x) => x?.lokasi_uuid).map((x) => ({ lokasi_uuid: x.lokasi_uuid, name: x.name ?? null })),
        };
    }

    // RME dibuka dari daftar poli: panggilan poli menjadi "diproses" (status 3) dan kunjungan menjadi
    // Diperiksa. Kunjungan yang sudah diperiksa/selesai/batal tidak diubah.
    static async mulaiPeriksa(rawatJalanUuid) {
        const kunjungan = await RawatJalanModel.findOne({ attributes: ["uuid", "statusRj"], where: { uuid: rawatJalanUuid } });
        if (!kunjungan) return { berubah: false, message: "Kunjungan tidak ditemukan" };
        if (!RJ_BELUM_DIPERIKSA.includes(kunjungan.statusRj)) return { berubah: false, message: "Status kunjungan tidak berubah" };

        const [antrian] = await sequelizeInstance.query(
            `SELECT uuid, status_panggilan FROM antrian
              WHERE rawat_jalan_uuid = :rj AND pelayanan = 'poli' AND deleted_at IS NULL
              ORDER BY created_at DESC LIMIT 1`,
            { replacements: { rj: rawatJalanUuid }, type: QueryTypes.SELECT }
        );
        if (antrian && antrian.status_panggilan < 3) {
            await updateAntrianCall.put(`/${antrian.uuid}`, { status_panggilan: 3 });
        }
        await this.tandaiDiperiksa(rawatJalanUuid);
        return { berubah: true, message: "Pasien mulai diperiksa" };
    }

    // "racikan" / "non-racikan" bila kunjungan punya resep aktif dan belum punya antrian farmasi; null bila tidak perlu.
    static async jenisResepUntukFarmasi(rawatJalanUuid) {
        if (!rawatJalanUuid) return null;
        const [hasil] = await sequelizeInstance.query(
            `SELECT
                 EXISTS (SELECT 1 FROM prescriptions p
                          WHERE p.rekam_medis_uuid = rj.rekam_medis_uuid AND p.deleted_at IS NULL AND p.order_status <> 0) AS ada,
                 EXISTS (SELECT 1 FROM prescriptions p
                           JOIN prescription_items i ON i.prescription_uuid = p.uuid AND i.deleted_at IS NULL
                           JOIN prescription_item_racikans r ON r.prescription_item_uuid = i.uuid AND r.deleted_at IS NULL
                          WHERE p.rekam_medis_uuid = rj.rekam_medis_uuid AND p.deleted_at IS NULL AND p.order_status <> 0) AS racikan,
                 EXISTS (SELECT 1 FROM antrian a
                          WHERE a.rawat_jalan_uuid = rj.uuid AND a.pelayanan = 'farmasi' AND a.deleted_at IS NULL) AS sudah_antri
               FROM rawat_jalans rj WHERE rj.uuid = :rj`,
            { replacements: { rj: rawatJalanUuid }, type: QueryTypes.SELECT }
        );
        if (!hasil?.ada || hasil.sudah_antri) return null;
        return hasil.racikan ? "racikan" : "non-racikan";
    }

    static async updateStatusRajal(uuid, data) {
        try{

            const statusMessages = {
                1: "Antrian berhasil dipanggil",
                2: "Antrian berhasil dilewati",
                3: "Antrian berhasil diproses",
                4: "Antrian berhasil diselesaikan",
            };

            const result = await updateAntrianCall.put(`/${uuid}`, {
                status_panggilan: data.status_panggilan
            });

            const antrian = result.data.payload;

            // Proses = pasien masuk ruang periksa.
            if (antrian.status_panggilan === 3) {
                await this.tandaiDiperiksa(antrian.rawat_jalan_uuid);
            }

            if (antrian.status_panggilan === 4){
                try {
                    // Antrian farmasi hanya untuk kunjungan yang punya resep & belum diantrikan
                    // (discharge di RME juga membuat antrian farmasi; jangan dobel).
                    const jenisResep = await this.jenisResepUntukFarmasi(antrian.rawat_jalan_uuid);
                    if (jenisResep) {
                        await createAntrianCall.post("/", {
                            patient_uuid: antrian.patient_data.patient_uuid,
                            rawat_jalan_uuid: antrian.rawat_jalan_uuid,
                            pelayanan: "farmasi",
                            jenis_pasien: antrian.jenis_pasien,
                            pasien_baru: antrian.pasien_baru,
                            jenis_resep: jenisResep,
                        });
                    }

                    // Pasien yang langsung diselesaikan tanpa "Proses" tetap tercatat diperiksa.
                    await this.tandaiDiperiksa(antrian.rawat_jalan_uuid);

                } catch (error) {
                    console.error("Error update status antrian:", error);
                    throw error;
                }
            }

            return { message: statusMessages[antrian.status_panggilan] };

        }catch(error){
            console.error("Error updating antrian:", error);
            throw error;
        }
    }
}
