import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { QueryTypes } from "sequelize";
import moment from "moment";
import { uuidv7 } from "uuidv7";

// Sinkronisasi antrian (tabel antrian milik antrian-service) saat kunjungan rawat jalan selesai.
// status_panggilan: 0 menunggu, 1 dipanggil, 2 terlewat, 3 diproses, 4 selesai.
const PANGGILAN_SELESAI = 4;

export default class AntrianPelayananRepository {
    // Pasien pulang: panggilan poli ditandai selesai, dan antrian farmasi dibuat bila kunjungan
    // punya resep (yang tidak dibatalkan) dan antrian farmasinya belum ada.
    static async selesaikanAntrianRawatJalan({ rawatJalanUuid, rekamMedisUuid, faskesUuid }, transaction) {
        if (!rawatJalanUuid) return;
        const sekarang = moment().unix();

        const [antrianPoli] = await sequelizeInstance.query(
            `UPDATE antrian SET status_panggilan = :selesai, updated_at = :sekarang
              WHERE rawat_jalan_uuid = :rj AND pelayanan = 'poli' AND deleted_at IS NULL
                AND status_panggilan <> :selesai
              RETURNING patient_uuid, jenis_pasien, pasien_baru`,
            { replacements: { rj: rawatJalanUuid, selesai: PANGGILAN_SELESAI, sekarang }, transaction }
        );

        await this.buatAntrianFarmasiBilaPerlu({ rawatJalanUuid, rekamMedisUuid, faskesUuid, sumber: antrianPoli?.[0] }, transaction);
    }

    static async buatAntrianFarmasiBilaPerlu({ rawatJalanUuid, rekamMedisUuid, faskesUuid, sumber }, transaction) {
        if (!rawatJalanUuid || !rekamMedisUuid) return false;

        const [resep] = await sequelizeInstance.query(
            `SELECT
                 EXISTS (SELECT 1 FROM prescriptions p
                          WHERE p.rekam_medis_uuid = :rm AND p.deleted_at IS NULL AND p.order_status <> 0) AS ada,
                 EXISTS (SELECT 1 FROM prescriptions p
                           JOIN prescription_items i ON i.prescription_uuid = p.uuid AND i.deleted_at IS NULL
                           JOIN prescription_item_racikans r ON r.prescription_item_uuid = i.uuid AND r.deleted_at IS NULL
                          WHERE p.rekam_medis_uuid = :rm AND p.deleted_at IS NULL AND p.order_status <> 0) AS racikan,
                 EXISTS (SELECT 1 FROM antrian a
                          WHERE a.rawat_jalan_uuid = :rj AND a.pelayanan = 'farmasi' AND a.deleted_at IS NULL) AS sudah_antri`,
            { replacements: { rm: rekamMedisUuid, rj: rawatJalanUuid }, type: QueryTypes.SELECT, transaction }
        );
        if (!resep?.ada || resep.sudah_antri) return false;

        let asal = sumber;
        if (!asal) {
            [asal] = await sequelizeInstance.query(
                `SELECT patient_uuid, jenis_pasien, pasien_baru FROM antrian
                  WHERE rawat_jalan_uuid = :rj AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
                { replacements: { rj: rawatJalanUuid }, type: QueryTypes.SELECT, transaction }
            );
        }
        if (!asal?.patient_uuid) return false;

        const sekarang = moment().unix();
        await sequelizeInstance.query(
            `INSERT INTO antrian (uuid, faskes_uuid, patient_uuid, rawat_jalan_uuid, status_panggilan, pelayanan,
                                  jenis_pasien, pasien_baru, jenis_resep, created_at, updated_at)
             VALUES (:uuid, :faskes, :pasien, :rj, 0, 'farmasi', :jenisPasien, :pasienBaru, :jenisResep, :sekarang, :sekarang)`,
            {
                replacements: {
                    uuid: uuidv7(),
                    faskes: faskesUuid,
                    pasien: asal.patient_uuid,
                    rj: rawatJalanUuid,
                    jenisPasien: asal.jenis_pasien ?? null,
                    pasienBaru: asal.pasien_baru ?? false,
                    jenisResep: resep.racikan ? "racikan" : "non-racikan",
                    sekarang,
                },
                transaction,
            }
        );
        return true;
    }
}
