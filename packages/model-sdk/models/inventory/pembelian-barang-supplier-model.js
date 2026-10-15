import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

export default class PembelianBarangSupplierModel extends Model{
}

PembelianBarangSupplierModel.init(
    {
        ...identifierModel,
        no_po: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kategori_item: {
            type: DataTypes.ENUM('medis', 'non-medis'),
            allowNull: false,
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_item: {
            type: DataTypes.ENUM('obat', 'alkes'),
            allowNull: false,
        },
        supplier_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        tanggal_pembelian: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        metode_pembelian: {
            type: DataTypes.ENUM('tunai', 'kredit'),
            allowNull: false,
        },
        catatan_po: {
            type: DataTypes.STRING(255),
        },
        isCito: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        total_item: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        diskon: {
            type: DataTypes.FLOAT,
        },
        materai: {
            type: DataTypes.FLOAT,
        },
        ppn: {
            type: DataTypes.FLOAT,
        },
        grand_total: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        petugas_pembuat_po: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        petugas_pembuat_po_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('pending', 'cancel', 'verifikasi', 'diterima'),
        },
        alasan_batal: {
            type: DataTypes.STRING(255),
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
        },
        tanggal_penerimaan: {
            type: DataTypes.BIGINT,
        },
        no_faktur: {
            type: DataTypes.STRING(255),
        },
        tanggal_faktur: {
            type: DataTypes.BIGINT,
        },
        no_surat_jalan: {
            type: DataTypes.STRING(255),
        },
        catatan_penerimaan: {
            type: DataTypes.STRING(255),
        },
        petugas_pengirim: {
            type: DataTypes.STRING(255),
        },
        petugas_penerima: {
            type: DataTypes.STRING(255),
        },
        petugas_penerima_uuid: {
            type: DataTypes.STRING(255),
        },
        ongkos_kirim: {
            type: DataTypes.FLOAT,
        },
        is_return : {
            type: DataTypes.BOOLEAN
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "pembelian_Barang_supplier",
        className: "pembelianBarangSupplier",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
    }
)