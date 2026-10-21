import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import { LokasiStokModel } from "@opensimrs/model-sdk/farmasi";
import { StockMedisModel } from "@opensimrs/model-sdk/inventory";
import BadRequestException from "../errors/bad-request-exception.js";
import NotfoundException from "../errors/notfound-exception.js";

export default class DataMasterLokasiStokRepository {
  static async create(req) {
    return await LokasiStokModel.create({
      code: req.code,
      name: req.name,
      status: req.status,
      jenis_lokasi: req.jenis_lokasi,
      default_tujuan_order_permintaan: req.default_tujuan_order_permintaan,
      faskes_uuid: req.faskes_uuid,
    });
  }

  static async getAll(req) {
    const option = {
      where: {
        faskes_uuid: req.faskes_uuid,
        name: { [Op.iLike]: `%${req.name || ""}%` },
        ...(req.kode_tujuan && {
          default_tujuan_order_permintaan: {
            [Op.iLike]: `%${req.kode_tujuan || ""}%`,
          },
        }),
        ...(req.jenis_lokasi && {
          jenis_lokasi: req.jenis_lokasi,
        }),
        deleted_at: {
          [Op.is]: null,
        },
      },

      order: [
        ["created_at", "DESC"],
        ["uuid", "ASC"],
      ],
    };

    if (req.uuid) {
      let uuids = req.uuid;

      if (typeof uuids === "string") {
        uuids = uuids.split(",").map((item) => item.trim());
      }

      if (!Array.isArray(uuids)) {
        uuids = [uuids];
      }

      option.where.uuid = {
        [Op.in]: uuids,
      };
    }

    if (req.status) {
      option.where.status = req.status;
    }

    return Pagination.init(LokasiStokModel, req, option);
  }

  static async getByUuid(uuid) {
    return LokasiStokModel.findOne({
      where: {
        uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
    });
  }

  static async update(req) {
    const [affectedRow] = await LokasiStokModel.update(
      {
        code: req.code,
        name: req.name,
        status: req.status,
        jenis_lokasi: req.jenis_lokasi,
        default_tujuan_order_permintaan: req.default_tujuan_order_permintaan,
      },
      {
        // Isolasi faskes: lokasi faskes lain tidak boleh diubah walau UUID-nya diketahui.
        where: {
          uuid: req.uuid,
          faskes_uuid: req.faskes_uuid,
        },
      }
    );

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal diedit");
    }

    return affectedRow;
  }

  static async delete(req) {
    // Lokasi yang masih menyimpan stok tidak boleh dihapus: batch-nya akan "hilang" dari semua daftar
    // stok padahal fisiknya masih ada. Kosongkan dulu lewat retur/pengeluaran unit.
    const sisa = await StockMedisModel.sum("sisa_stok", {
      where: {
        lokasi_stok_uuid: req.uuid,
        faskes_uuid: req.faskes_uuid,
        deleted_at: null,
      },
    });
    if (Number(sisa || 0) > 0) {
      throw new BadRequestException(
        `Lokasi stok masih memiliki sisa stok ${sisa}; pindahkan/kosongkan stok sebelum menghapus lokasi.`
      );
    }
    const [affectedRow] = await LokasiStokModel.update(
      {
        deleted_at: toEpochDate(new Date()),
      },
      {
        where: {
          uuid: req.uuid,
          faskes_uuid: req.faskes_uuid,
          deleted_at: null,
        },
      }
    );

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal dihapus");
    }

    return affectedRow;
  }

  static bulkCreate(req) {
    return LokasiStokModel.bulkCreate(req, {
      individualHooks: true,
    });
  }
}
