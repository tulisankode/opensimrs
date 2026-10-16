import { Op, fn, col } from "sequelize";

import {
  ItemPemeriksaanModel,
  LabRujukanModel,
  NilaiRujukanModel,
  ObservationItemModel,
  OrderLabModel,
} from "@opensimrs/model-sdk/lab";
import { status } from "../services/order-lab-service.js";
import pagination from "../helpers/pagination.js";
import toEpochDate from "../helpers/date-helper.js";

ObservationItemModel.belongsTo(ItemPemeriksaanModel, {
  foreignKey: "item_pemeriksaan_uuid",
  as: "item_pemeriksaan",
  constraints: false,
});

ObservationItemModel.belongsTo(OrderLabModel, {
  foreignKey: "order_lab_uuid",
  as: "order_lab",
  constraints: false,
});

ObservationItemModel.belongsTo(LabRujukanModel, {
  foreignKey: "lab_rujukan_uuid",
  as: "lab_rujukan",
  constraints: false,
});

export const STATUS_RUJUKAN = {
  BELUM_DIKIRIM: "belum_dikirim",
  TERKIRIM: "terkirim",
  HASIL_DITERIMA: "hasil_diterima",
};

ItemPemeriksaanModel.hasMany(NilaiRujukanModel, {
  foreignKey: "item_pemeriksaan_uuid",
  as: "nilai_rujukan", // Gunakan alias yang konsisten
  constraints: false,
});

export default class ObservationItemRepository {
  static async bulkCreate(data, transaction) {
    return await ObservationItemModel.bulkCreate(data, { transaction });
  }

  static async findByUuids(uuids, faskes_uuid) {
    return await ObservationItemModel.findAll({
      where: {
        uuid: {
          [Op.in]: uuids,
        },
        faskes_uuid: faskes_uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
      include: {
        model: ItemPemeriksaanModel,
        as: "item_pemeriksaan",
        where: {
          deleted_at: {
            [Op.is]: null,
          },
        },
      },
    });
  }

  static async updateResult(uuid, faskes_uuid, data, transaction) {
    return await ObservationItemModel.update(data, {
      where: {
        uuid: uuid,
        faskes_uuid: faskes_uuid,
      },
      transaction,
    });
  }

  static async findByOrderLabUuid(order_lab_uuid, faskes_uuid) {
    return await ObservationItemModel.findAll({
      where: {
        order_lab_uuid: order_lab_uuid,
        faskes_uuid: faskes_uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
      include: [
        {
          model: ItemPemeriksaanModel,
          as: "item_pemeriksaan",
          where: {
            deleted_at: {
              [Op.is]: null,
            },
          },
          // required: false,
          // include: {
          //   model: NilaiRujukanModel,
          //   as: "nilai_rujukan",
          //   where: {
          //     deleted_at: {
          //       [Op.is]: null,
          //     },
          //   },
          // },
          attributes: {
            exclude: ["created_at", "updated_at", "deleted_at"],
          },
        },
        {
          model: LabRujukanModel,
          as: "lab_rujukan",
          required: false,
          attributes: ["uuid", "code", "name"],
        },
      ],
      raw: true,
      nest: true,
    });
  }

  static async findByUuidFaskes(uuid, faskes_uuid) {
    return await ObservationItemModel.findOne({
      where: {
        uuid: uuid,
        faskes_uuid: faskes_uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
      include: {
        model: OrderLabModel,
        as: "order_lab",
        attributes: ["uuid", "order_status"],
      },
    });
  }

  static async tandaiRujukan(uuid, faskes_uuid, data) {
    return await ObservationItemModel.update(
      {
        dirujuk: true,
        lab_rujukan_uuid: data.lab_rujukan_uuid,
        status_rujukan: STATUS_RUJUKAN.BELUM_DIKIRIM,
        catatan_rujukan: data.catatan_rujukan ?? null,
      },
      {
        where: { uuid: uuid, faskes_uuid: faskes_uuid },
      }
    );
  }

  static async batalRujukan(uuid, faskes_uuid) {
    return await ObservationItemModel.update(
      {
        dirujuk: false,
        lab_rujukan_uuid: null,
        status_rujukan: null,
        waktu_kirim_rujukan: null,
        catatan_rujukan: null,
      },
      {
        where: { uuid: uuid, faskes_uuid: faskes_uuid },
      }
    );
  }

  static async kirimRujukan(uuid, faskes_uuid) {
    return await ObservationItemModel.update(
      {
        status_rujukan: STATUS_RUJUKAN.TERKIRIM,
        waktu_kirim_rujukan: toEpochDate(new Date()),
      },
      {
        where: { uuid: uuid, faskes_uuid: faskes_uuid },
      }
    );
  }

  static async simpanBerkasRujukan(uuid, faskes_uuid, berkas) {
    return await ObservationItemModel.update(
      {
        berkas_hasil_rujukan: berkas.data,
        berkas_hasil_rujukan_info: {
          name: berkas.name,
          tipe: berkas.tipe,
          waktu_unggah: toEpochDate(new Date()),
        },
      },
      {
        where: { uuid: uuid, faskes_uuid: faskes_uuid },
      }
    );
  }

  static async hapusBerkasRujukan(uuid, faskes_uuid) {
    return await ObservationItemModel.update(
      {
        berkas_hasil_rujukan: null,
        berkas_hasil_rujukan_info: null,
      },
      {
        where: { uuid: uuid, faskes_uuid: faskes_uuid },
      }
    );
  }

  static async findBerkasRujukan(uuid, faskes_uuid) {
    return await ObservationItemModel.findOne({
      where: {
        uuid: uuid,
        faskes_uuid: faskes_uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
      attributes: ["uuid", "berkas_hasil_rujukan", "berkas_hasil_rujukan_info"],
    });
  }

  static async findByOrderLabUuidAndStatusSudahPeriksa(
    order_lab_uuid,
    faskes_uuid
  ) {
    return await ObservationItemModel.findAll({
      where: {
        order_lab_uuid: order_lab_uuid,
        faskes_uuid: faskes_uuid,
        status_periksa: true,
        deleted_at: {
          [Op.is]: null,
        },
      },
    });
  }

  static async findRekapPemeriksaan(req) {
    const whereDate = {};

    if (req.start_date || req.end_date) {
      whereDate["$order_lab.tgl_order$"] = {};

      if (req.start_date) {
        whereDate["$order_lab.tgl_order$"][Op.gte] = req.start_date;
      }

      if (req.end_date) {
        whereDate["$order_lab.tgl_order$"][Op.lte] = req.end_date;
      }
    }

    let whereSearch = {};

    if (req.search) {
      whereSearch = {
        [Op.or]: [
          {
            "$item_pemeriksaan.name$": {
              [Op.iLike]: `%${req.search}%`,
            },
          },
          {
            "$kelompok_pemeriksaan.name$": {
              [Op.iLike]: `%${req.search}%`,
            },
          },
        ],
      };
    }

    const wherePelayanan = {};

    if (req.pelayanan) {
      wherePelayanan.pelayanan = req.pelayanan;
    }

    const options = {
      where: {
        faskes_uuid: req.faskes_uuid,
        ...whereDate,
        ...whereSearch,
        deleted_at: { [Op.is]: null },
      },
      include: [
        {
          model: ItemPemeriksaanModel,
          as: "item_pemeriksaan",
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
        {
          model: OrderLabModel,
          as: "order_lab",
          where: {
            order_status: status.SELESAI,
            deleted_at: { [Op.is]: null },
          },
          attributes: ["created_at"],
        },
      ],
      attributes: {
        exclude: ["created_at", "updated_at", "deleted_at"],
      },
    };

    return await pagination(ObservationItemModel, req, options);
  }
}
