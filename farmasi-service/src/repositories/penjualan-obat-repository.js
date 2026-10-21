import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import Utils from "../helpers/utils.js";
import {
  ItemMedisJenisStokModel,
  ItemMedisModel,
  ItemPenjualanObatModel,
  JenisStokModel,
  LokasiStokModel,
  PenjualanObatModel,
  SatuanModel,
} from "@opensimrs/model-sdk/farmasi";

export default class PenjualanObatRepository {
  // Filter "Farmasi" (default_tujuan_order_permintaan: 0 RI, 1 RJ, 2 IGD; 4 = Semua), dikirim dipisah koma.
  // Sebelumnya nilai pilihan digabung tanpa pemisah lalu dicari dengan iLike, sehingga "Semua" atau pilihan
  // lebih dari satu selalu menghasilkan daftar kosong.
  static includeLokasi(lokasi) {
    const daftar = String(lokasi ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x !== "");
    const saring = daftar.length > 0 && !daftar.includes("4");
    return {
      model: LokasiStokModel,
      as: "lokasi_stok",
      attributes: ["name"],
      required: saring,
      ...(saring && {
        where: { default_tujuan_order_permintaan: { [Op.in]: daftar } },
      }),
    };
  }

  static async getLokasiStok(uuid, faskesUuid) {
    return await LokasiStokModel.findOne({
      where: { uuid, faskes_uuid: faskesUuid, deleted_at: { [Op.is]: null } },
      attributes: ["uuid", "name"],
    });
  }

  static async getItemJenisStok(itemMedisUuid, jenisStokUuid) {
    return await ItemMedisJenisStokModel.findOne({
      where: {
        item_medis_uuid: itemMedisUuid,
        jenis_stok_uuid: jenisStokUuid,
        deleted_at: { [Op.is]: null },
      },
      attributes: ["uuid", "item_medis_uuid", "jenis_stok_uuid"],
    });
  }

  static async createOtc(req, transaction) {
    return await PenjualanObatModel.create(req, { transaction });
  }

  static async createOtcItem(req, transaction) {
    await ItemPenjualanObatModel.create(req, { transaction });
  }

  static async getAllOtc(req) {
    req.search = Utils.nullToType(req.search);

    const option = {
      where: {
        faskes_uuid: req.faskes_uuid,
        status: req.status,
        [Op.or]: [
          { nama_pembeli: { [Op.iLike]: `%${req.search}%` } },
          { no_transaksi: { [Op.iLike]: `%${req.search}%` } },
        ],
        tanggal_pembelian: {
          [Op.between]: [req.start_date, req.end_date],
        },
      },
      include: [
        PenjualanObatRepository.includeLokasi(req.lokasi),
      ],
    };
    return Pagination.init(PenjualanObatModel, req, option);
  }

  static async getAllOtcWithoutPagination(req) {
    req.search = Utils.nullToType(req.search);
    const option = {
      where: {
        faskes_uuid: req.faskes_uuid,
        status: req.status,
        [Op.or]: [
          { nama_pembeli: { [Op.iLike]: `%${req.search}%` } },
          { no_transaksi: { [Op.iLike]: `%${req.search}%` } },
        ],
        tanggal_pembelian: {
          [Op.between]: [req.start_date, req.end_date],
        },
      },
      include: [
        PenjualanObatRepository.includeLokasi(req.lokasi),
      ],
    };
    return await PenjualanObatModel.findAll(option);
  }

  static async updateOtc(dataToUpdate, uuid, transaction, faskesUuid = null) {
    delete dataToUpdate.uuid;
    const where = { uuid };
    if (faskesUuid) where.faskes_uuid = faskesUuid;

    const [affectedRows] = await PenjualanObatModel.update(dataToUpdate, {
      where,
      transaction,
    });
    return affectedRows;
  }

  static async getOtcByUuid({ uuid, faskes_uuid }, transaction = null) {
    const where = { uuid };
    if (faskes_uuid) where.faskes_uuid = faskes_uuid;

    const includeOptions = [
      {
        model: ItemPenjualanObatModel,
        as: "items",
        attributes: {
          exclude: ["deleted_at", "created_at", "updated_at", "id"],
        },
        include: [
          {
            model: JenisStokModel,
            as: "jenis_stok",
            attributes: ["uuid", "name"],
          },
          {
            model: ItemMedisModel,
            as: "item_medis",
            attributes: ["uuid", "name", "satuan_penggunaan_uuid"],
            include: [
              {
                model: SatuanModel,
                as: "satuan_penggunaan",
                attributes: ["name"],
              },
            ],
          },
        ],
      },
      {
        model: LokasiStokModel,
        as: "lokasi_stok",
        attributes: ["uuid", "name"],
      },
    ];

    if (transaction) {
      const penjualanHeader = await PenjualanObatModel.findOne({
        where,
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!penjualanHeader) return null;

      const items = await penjualanHeader.getItems({
        attributes: {
          exclude: ["deleted_at", "created_at", "updated_at", "id"],
        },
        include: [
          {
            model: JenisStokModel,
            as: "jenis_stok",
            attributes: ["uuid", "name"],
          },
          {
            model: ItemMedisModel,
            as: "item_medis",
            attributes: ["uuid", "name"],
          },
        ],
        transaction,
      });
      const lokasiStok = await penjualanHeader.getLokasi_stok({ transaction });

      const result = penjualanHeader.toJSON();
      result.items = items.map((i) => i.toJSON());
      result.lokasi_stok = lokasiStok ? lokasiStok.toJSON() : null;

      return result;
    } else {
      return await PenjualanObatModel.findOne({
        where,
        attributes: {
          exclude: ["id", "deleted_at", "created_at", "updated_at"],
        },
        include: includeOptions,
      });
    }
  }

  static async getAllCatatanStok(req) {
    return await ItemPenjualanObatModel.findAll({
      where: {
        penjualan_obat_uuid: req.uuid,
      },
      attributes: ["catatan_stok"],
    });
  }

  static getByCode(req) {
    return PenjualanObatModel.findOne({
      where: {
        no_transaksi: req.no_transaksi,
        faskes_uuid: req.faskes_uuid,
      },
      attributes: ["no_transaksi"],
    });
  }

  // Pendapatan penjualan bebas: hanya status lunas (belum_lunas & cancel tidak dihitung).
  static pendapatanWhere(req) {
    req.search = Utils.nullToType(req.search);
    // Penjualan bebas selalu tunai: filter metode "Asuransi" (2) menghasilkan daftar kosong.
    const bukanTunai = Number(req.payment_method || 0) > 1;
    return {
      ...(bukanTunai && { uuid: { [Op.is]: null } }),
      tanggal_pembelian: {
        [Op.between]: [req.start_date, req.end_date],
      },
      status: "lunas",
      faskes_uuid: req.faskes_uuid,
      [Op.or]: [
        { nama_pembeli: { [Op.iLike]: `%${req.search}%` } },
        { no_transaksi: { [Op.iLike]: `%${req.search}%` } },
      ],
    };
  }

  static getPendapatan(req) {
    let option = {
      where: this.pendapatanWhere(req),
      attributes: [
        "no_transaksi",
        "nama_pembeli",
        "dokter_pemberi_resep",
        "total_harga",
        "tanggal_pembelian",
      ],
      include: [
        { model: LokasiStokModel, as: "lokasi_stok", attributes: ["name"] },
      ],
      order: [["tanggal_pembelian", "ASC"]],
    };

    return Pagination.init(PenjualanObatModel, req, option);
  }

  // Jumlah seluruh baris yang tersaring (bukan hanya halaman aktif) untuk Grand Total laporan.
  static async getTotalPendapatan(req) {
    const total = await PenjualanObatModel.sum("total_harga", {
      where: this.pendapatanWhere(req),
    });
    return Number(total || 0);
  }
}
