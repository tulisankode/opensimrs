import { Op } from "sequelize";
import BadRequestException from "../errors/bad-request-exception.js";
import {
  RiwayatMutasiModel,
  StockMedisModel,
} from "@opensimrs/model-sdk/inventory";
import {
  ItemMedisJenisStokModel,
  ItemMedisModel,
  SatuanModel,
} from "@opensimrs/model-sdk/farmasi";
import { uuidv7 } from "uuidv7";
import NotfoundException from "../errors/notfound-exception.js";

export default class StockMedisRepository {
  static async createRiwayatMutasi(data, transaction) {
    return RiwayatMutasiModel.create(
      {
        ...data,
        uuid: uuidv7(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      { transaction }
    );
  }

  static async reduceQuantity(req, mutasiData, t) {
    let remainingQuantity = req.quantity;
    let stock;
    const today = new Date();
    let order = [];
    let result = [];

    if (req.metode_pemotongan_stok === "FEFO") {
      order.push(["exp_date", "ASC"]);
    } else if (req.metode_pemotongan_stok === "FIFO") {
      order.push(["created_at", "ASC"]);
    } else {
      order.push(["created_at", "DESC"]);
    }

    const sisaStockRaw = await StockMedisModel.findAll({
      where: {
        sisa_stok: { [Op.gt]: 0 },
        exp_date: { [Op.gt]: today },
        lokasi_stok_uuid: req.lokasi_stok_uuid,
      },
      attributes: ["sisa_stok"],
      include: [
        {
          model: ItemMedisJenisStokModel,
          as: "item_medis_jenis_stok",
          required: true,
          where: {
            jenis_stok_uuid: req.jenis_stok_uuid,
            item_medis_uuid: req.item_medis_uuid,
          },
          attributes: ["uuid"],
        },
      ],
      transaction: t,
    });

    const totalStock = sisaStockRaw.reduce(
      (acc, curr) => acc + curr.sisa_stok,
      0
    );

    if (totalStock < req.quantity) {
      throw new BadRequestException(
        `${req.name} not enough or empty (total stock : ${totalStock})`
      );
    }

    while (remainingQuantity > 0) {
      stock = await StockMedisModel.findOne({
        where: {
          sisa_stok: { [Op.gt]: 0 },
          exp_date: { [Op.gt]: today },
          lokasi_stok_uuid: req.lokasi_stok_uuid,
        },
        include: [
          {
            model: ItemMedisJenisStokModel,
            as: "item_medis_jenis_stok",
            required: true,
            where: {
              item_medis_uuid: req.item_medis_uuid,
              jenis_stok_uuid: req.jenis_stok_uuid,
            },
            attributes: ["uuid"],
          },
        ],
        order: order,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!stock) {
        throw new BadRequestException(
          `Stok ${req.name} habis saat proses pengurangan.`
        );
      }

      const newStock = stock.sisa_stok - remainingQuantity;
      let quantityToLog = 0;

      if (newStock >= 0) {
        await StockMedisModel.update(
          { sisa_stok: newStock },
          { where: { uuid: stock.uuid }, transaction: t }
        );
        quantityToLog = remainingQuantity;
        remainingQuantity = 0;
      } else {
        await StockMedisModel.update(
          { sisa_stok: 0 },
          { where: { uuid: stock.uuid }, transaction: t }
        );
        quantityToLog = stock.sisa_stok;
        remainingQuantity = Math.abs(newStock);
      }

      result.push({
        stock_medis_uuid: stock.uuid,
        quantity: quantityToLog,
        expired_date: stock.exp_date,
        stock_before: stock.sisa_stok,
      });

      await this.createRiwayatMutasi(
        {
          faskes_uuid: mutasiData.faskes_uuid,
          item_uuid: req.item_medis_uuid,
          code: mutasiData.kode_referensi,
          exp_date: stock.exp_date,
          lokasi_stok_uuid: req.lokasi_stok_uuid,
          jenis_stok_uuid: req.jenis_stok_uuid,
          keterangan: { description: mutasiData.keterangan_prefix },
          petugas: mutasiData.petugas,
          stok_awal: stock.sisa_stok,
          stok_mutasi: quantityToLog,
          sumber_mutasi: "pelayanan",
          type: "defisit",
        },
        t
      );
    }
    return result;
  }

  static async addQuantity(req, mutasiData, transaction) {
    const stock = await StockMedisModel.findOne({
      where: { uuid: req.stock_medis_uuid },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!stock) {
      throw new NotfoundException(
        `Stok batch ${req.stock_medis_uuid} tidak ditemukan.`
      );
    }

    const stokAwal = stock.sisa_stok;
    await stock.increment("sisa_stok", { by: req.quantity, transaction });

    await this.createRiwayatMutasi(
      {
        faskes_uuid: mutasiData.faskes_uuid,
        item_uuid: mutasiData.item_uuid,
        code: mutasiData.kode_referensi,
        exp_date: stock.exp_date,
        lokasi_stok_uuid: mutasiData.lokasi_stok_uuid,
        jenis_stok_uuid: mutasiData.jenis_stok_uuid,
        keterangan: { description: mutasiData.keterangan_prefix },
        petugas: mutasiData.petugas,
        stok_awal: stokAwal,
        stok_mutasi: req.quantity,
        sumber_mutasi: "pelayanan",
        type: "surplus",
      },
      transaction
    );

    return stock;
  }

  static async findStocksWithDetails(stockUuids) {
    if (!Array.isArray(stockUuids) || stockUuids.length === 0) {
      return [];
    }
    return await StockMedisModel.findAll({
      where: { uuid: { [Op.in]: stockUuids } },
      include: [
        {
          model: ItemMedisJenisStokModel,
          as: "item_medis_jenis_stok",
          required: true,
          include: [
            {
              model: ItemMedisModel,
              as: "item_medis",
              required: true,
              include: [
                {
                  model: SatuanModel,
                  as: "satuan_penggunaan",
                  attributes: ["uuid", "name"],
                },
              ],
            },
          ],
        },
      ],
    });
  }
}
