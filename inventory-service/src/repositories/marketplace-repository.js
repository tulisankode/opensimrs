import { Op, UniqueConstraintError } from "sequelize";
import {
    MarketplaceKoneksiModel,
    MarketplacePemetaanModel,
    MarketplacePesananModel,
    MarketplacePesananItemModel,
    MarketplacePersetujuanModel,
    MarketplacePeristiwaModel,
    MarketplaceTagihanModel,
    MasterSupplierModel,
    PembelianBarangSupplierModel,
    PembelianBarangSupplierItemModel,
} from "@opensimrs/model-sdk/inventory";
import Pagination from "../helpers/pagination.js";

const tidakDihapus = { deleted_at: { [Op.is]: null } };

export default class MarketplaceRepository {
    // --- Konfigurasi koneksi ---
    static async listKoneksi(faskes_uuid) {
        return MarketplaceKoneksiModel.findAll({ where: { faskes_uuid, ...tidakDihapus }, order: [["mitra_kode", "ASC"]] });
    }

    static async findKoneksi({ faskes_uuid, mitra_kode }) {
        return MarketplaceKoneksiModel.findOne({ where: { faskes_uuid, mitra_kode, ...tidakDihapus } });
    }

    // Dipakai khusus webhook: koneksi dicari lewat UUID di path, faskes_uuid DIAMBIL dari koneksi yang ditemukan
    // (bukan dari payload luar) agar penyerang tidak bisa menimpa data faskes lain (aturan bisnis #10 desain STD-0019).
    static async findKoneksiByUuid(uuid) {
        return MarketplaceKoneksiModel.findOne({ where: { uuid, ...tidakDihapus } });
    }

    static async upsertKoneksi(data) {
        const existing = await this.findKoneksi({ faskes_uuid: data.faskes_uuid, mitra_kode: data.mitra_kode });
        if (existing) {
            await existing.update(data);
            return existing;
        }
        return MarketplaceKoneksiModel.create(data);
    }

    // --- Pemetaan produk ---
    static async listPemetaan({ faskes_uuid, mitra_kode, search, page, limit }) {
        const where = { faskes_uuid, ...tidakDihapus };
        if (mitra_kode) where.mitra_kode = mitra_kode;
        if (search) where.nama_produk_mitra = { [Op.iLike]: `%${search}%` };
        return Pagination.init(MarketplacePemetaanModel, { page, limit }, { where, order: [["updated_at", "DESC"]] });
    }

    static async findPemetaan({ faskes_uuid, mitra_kode, produk_mitra_id }) {
        return MarketplacePemetaanModel.findOne({ where: { faskes_uuid, mitra_kode, produk_mitra_id, ...tidakDihapus } });
    }

    static async upsertPemetaan(data) {
        const existing = await this.findPemetaan(data);
        if (existing) {
            await existing.update(data);
            return existing;
        }
        return MarketplacePemetaanModel.create(data);
    }

    // --- Pesanan ---
    static async createPesanan(dataPesanan, items, transaction) {
        const pesanan = await MarketplacePesananModel.create(dataPesanan, { transaction });
        const itemRows = items.map((item) => ({ ...item, pesanan_uuid: pesanan.uuid, faskes_uuid: dataPesanan.faskes_uuid }));
        await MarketplacePesananItemModel.bulkCreate(itemRows, { transaction });
        return pesanan;
    }

    static async findDetail({ uuid, faskes_uuid }) {
        const pesanan = await MarketplacePesananModel.findOne({ where: { uuid, faskes_uuid, ...tidakDihapus } });
        if (!pesanan) return null;
        const items = await MarketplacePesananItemModel.findAll({ where: { pesanan_uuid: uuid, ...tidakDihapus } });
        const persetujuan = await MarketplacePersetujuanModel.findAll({ where: { pesanan_uuid: uuid }, order: [["urutan", "ASC"]] });
        const tagihan = await MarketplaceTagihanModel.findAll({ where: { pesanan_uuid: uuid, ...tidakDihapus }, order: [["created_at", "DESC"]] });
        return { pesanan, items, persetujuan, tagihan };
    }

    static async listPesanan({ faskes_uuid, status_pesanan, status_persetujuan, mitra_kode, search, dari, sampai, page, limit }) {
        const where = { faskes_uuid, ...tidakDihapus };
        if (dari || sampai) {
            where.diajukan_pada = {};
            if (dari) where.diajukan_pada[Op.gte] = dari;
            if (sampai) where.diajukan_pada[Op.lte] = sampai;
        }
        if (status_pesanan) where.status_pesanan = status_pesanan;
        if (status_persetujuan) where.status_persetujuan = status_persetujuan;
        if (mitra_kode) where.mitra_kode = mitra_kode;
        if (search) where[Op.or] = [{ nomor_internal: { [Op.iLike]: `%${search}%` } }, { nomor_pesanan_mitra: { [Op.iLike]: `%${search}%` } }];
        return Pagination.init(MarketplacePesananModel, { page, limit }, { where, order: [["created_at", "DESC"]] });
    }

    static async updatePesanan({ uuid, faskes_uuid }, data, transaction) {
        return MarketplacePesananModel.update(data, { where: { uuid, faskes_uuid }, transaction });
    }

    static async findPesananByNomorMitra({ faskes_uuid, mitra_kode, nomor_pesanan_mitra }) {
        return MarketplacePesananModel.findOne({ where: { faskes_uuid, mitra_kode, nomor_pesanan_mitra, ...tidakDihapus } });
    }

    // SELECT ... FOR UPDATE pada baris pesanan: menyerialkan checkout & pembaruan status untuk pesanan yang sama.
    static async kunciPesanan({ uuid, faskes_uuid }, transaction) {
        return MarketplacePesananModel.findOne({ where: { uuid, faskes_uuid, ...tidakDihapus }, transaction, lock: transaction.LOCK.UPDATE });
    }

    // --- Persetujuan ---
    static async createPersetujuan(data, transaction) {
        return MarketplacePersetujuanModel.create(data, { transaction });
    }

    static async hitungJenjangPersetujuan(pesanan_uuid) {
        return MarketplacePersetujuanModel.count({ where: { pesanan_uuid } });
    }

    // --- Peristiwa (webhook/tarik), dedup via unique index (faskes_uuid, sumber, peristiwa_mitra_id) ---
    static async catatPeristiwa(data, transaction) {
        try {
            const row = await MarketplacePeristiwaModel.create(data, { transaction });
            return { row, duplikat: false };
        } catch (error) {
            if (error instanceof UniqueConstraintError) return { row: null, duplikat: true };
            throw error;
        }
    }

    // --- Tagihan ---
    static async upsertTagihan({ pesanan_uuid, faskes_uuid }, data, transaction) {
        const existing = await MarketplaceTagihanModel.findOne({ where: { pesanan_uuid, faskes_uuid, ...tidakDihapus }, transaction });
        if (existing) {
            await existing.update(data, { transaction });
            return existing;
        }
        return MarketplaceTagihanModel.create({ pesanan_uuid, faskes_uuid, ...data }, { transaction });
    }

    // --- Pendukung lintas domain ---
    static async findSupplier({ uuid, faskes_uuid }) {
        return MasterSupplierModel.findOne({ where: { uuid, faskes_uuid, ...tidakDihapus } });
    }

    // Ringkasan PO hasil checkout, untuk ditautkan ke alur Penerimaan Pembelian yang sudah ada (bukan disalin).
    static async findPoRingkas(po_uuid, faskes_uuid) {
        if (!po_uuid) return null;
        return PembelianBarangSupplierModel.findOne({
            where: { uuid: po_uuid, faskes_uuid, ...tidakDihapus },
            attributes: ["uuid", "no_po", "status", "tanggal_penerimaan"],
        });
    }

    // Rekap qty dipesan vs qty diterima (PO yang sama dipakai penerimaan marketplace) untuk kolom selisih laporan.
    static async hitungSelisihPo(po_uuid) {
        if (!po_uuid) return null;
        const items = await PembelianBarangSupplierItemModel.findAll({
            where: { pembelian_barang_supplier_uuid: po_uuid, ...tidakDihapus },
            attributes: ["qty_order", "qty_terima"],
        });
        if (!items.length) return null;
        const qtyDipesan = items.reduce((acc, i) => acc + Number(i.qty_order || 0), 0);
        const qtyDiterima = items.reduce((acc, i) => acc + Number(i.qty_terima || 0), 0);
        return { qty_dipesan: qtyDipesan, qty_diterima: qtyDiterima, selisih: qtyDipesan - qtyDiterima };
    }

    static async findTagihanTerbaru(pesanan_uuid) {
        return MarketplaceTagihanModel.findOne({ where: { pesanan_uuid, ...tidakDihapus }, order: [["created_at", "DESC"]] });
    }
}
