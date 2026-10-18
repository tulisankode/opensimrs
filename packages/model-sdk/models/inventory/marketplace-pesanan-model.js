import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

// Permintaan/pesanan pembelian via marketplace mitra (STD-0019). pembelian_barang_supplier_uuid diisi saat checkout
// berhasil: penerimaan barangnya memakai alur Penerimaan Pembelian (PO) yang sudah ada, bukan alur tersendiri.
export default class MarketplacePesananModel extends Model {
}

MarketplacePesananModel.init(
    {
        ...identifierModel,
        mitra_kode: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        nomor_internal: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        nomor_pesanan_mitra: {
            type: DataTypes.STRING(100),
        },
        pemohon_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        pemohon_nama: {
            type: DataTypes.STRING(255),
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kategori_item: {
            // Nilai valid dijaga lewat CHECK constraint di migrasi & MarketplaceValidation (medis|non-medis).
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        jenis_item: {
            // obat|alkes
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        metode_pembelian: {
            // tunai|kredit
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        catatan: {
            type: DataTypes.STRING(255),
        },
        nilai_perkiraan: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0,
        },
        status_persetujuan: {
            // menunggu|disetujui|ditolak
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "menunggu",
        },
        status_pesanan: {
            // draft|menunggu_konfirmasi|dibayar|dikemas|dikirim|diterima_sebagian|diterima|dibatalkan
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "draft",
        },
        alasan_batal: {
            type: DataTypes.STRING(255),
        },
        pembelian_barang_supplier_uuid: {
            type: DataTypes.STRING(255),
        },
        diajukan_pada: {
            type: DataTypes.BIGINT,
        },
        checkout_pada: {
            type: DataTypes.BIGINT,
        },
        sinkron_terakhir_pada: {
            type: DataTypes.BIGINT,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "inventory_marketplace_pesanan",
        className: "marketplacePesanan",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ["faskes_uuid"],
            },
        ],
    }
)
