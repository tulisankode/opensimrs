import { HargaItemModel } from "@opensimrs/model-sdk/farmasi";
import { Op } from "sequelize";

export default class HargaItemRepository {
    static async findOneByItemJenisStok(itemMedisJenisStokUuid, faskesUuid) {
        const hargaItem = await HargaItemModel.findOne({
            where: {
                item_medis_jenis_stok_uuid: itemMedisJenisStokUuid,
                faskes_uuid: faskesUuid,
            },
        });
        return hargaItem;
    }

    static async findManyByItemJenisStok(itemMedisJenisStokUuids, faskesUuid) {
        const hargaItems = await HargaItemModel.findAll({
            where: {
                item_medis_jenis_stok_uuid: {
                    [Op.in]: itemMedisJenisStokUuids,
                },
                faskes_uuid: faskesUuid,
            },
        });
        const hargaItemMap = new Map();
        hargaItems.forEach(item => {
            hargaItemMap.set(item.item_medis_jenis_stok_uuid, item);
        });
        return hargaItemMap;
    }

    static async bulkUpdateOrInsertHargaItem(hargaPayloads, transaction) {
        if (!hargaPayloads || hargaPayloads.length === 0) return;

        // TODO: Logika untuk `harga_avg` (harga rata-rata)
        // Ini bisa jadi lebih kompleks, misalnya:
        // (harga_avg_lama * stok_lama) + (hna_baru * stok_baru) / (stok_lama + stok_baru)
        // Untuk sekarang, kita update saja agar nilainya relevan.

        // Tabel harga_item tidak memiliki indeks unik (faskes_uuid, item_medis_jenis_stok_uuid), sehingga
        // bulkCreate + updateOnDuplicate (ON CONFLICT) ditolak Postgres. Perbarui baris yang ada, buat bila belum ada.
        const sekarang = Math.floor(Date.now() / 1000);
        const hasil = [];
        for (const data of hargaPayloads) {
            const nilai = {
                harga_dasar: data.harga_dasar,
                hna: data.hna,
                harga_terakhir: data.harga_terakhir,
                harga_avg: data.harga_avg,
                updated_at: sekarang,
            };
            const where = { item_medis_jenis_stok_uuid: data.item_medis_jenis_stok_uuid, faskes_uuid: data.faskes_uuid };
            const [jumlah] = await HargaItemModel.update(nilai, { where, transaction });
            if (jumlah === 0) {
                hasil.push(await HargaItemModel.create({ ...where, ...nilai, created_at: sekarang }, { transaction }));
            }
        }
        return hasil;
    }
}