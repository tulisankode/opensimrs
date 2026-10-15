import { Op, Sequelize } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Utils from "../helpers/utils.js";
import InternalServerException from "../errors/internal-server-exception.js";
import { LokasiModel } from "@opensimrs/model-sdk/datamaster";
import {
  HargaItemModel,
  ItemMedisJenisStokModel,
  ItemMedisModel,
  JenisStokModel,
  LokasiStokModel,
  OrderAlkesItemModel,
  OrderAlkesModel,
  PrescriptionItemModel,
  PrescriptionModel,
  SatuanModel,
} from "@opensimrs/model-sdk/farmasi";
import { BirthDetailModel, PatientModel } from "@opensimrs/model-sdk/admisi";
import Pagination from "../helpers/pagination.js";
import { setRangeDate } from "../helpers/date-helper.js";
import { StockMedisModel } from "@opensimrs/model-sdk/inventory";

export default class AlkesRepository {
  // get prescription by uuid
  static async getByUuid(uuid) {
    return await OrderAlkesModel.findOne({
      where: {
        uuid: uuid,
      },
      attributes: {
        exclude: ["deleted_at", "faskes_uuid"],
      },
      include: [
        {
          model: OrderAlkesItemModel,
          as: "alkes_items",
          required: false,
          attributes: {
            exclude: ["deleted_at", "created_at", "updated_at", "faskes_uuid"],
          },
          include: [
            {
              model: ItemMedisModel,
              as: "item_medis",
              required: false,
              attributes: ["name", "uuid"],
              include: [
                {
                  model: SatuanModel,
                  as: "satuan_penggunaan",
                  required: false,
                  attributes: ["name"],
                },
                {
                  model: ItemMedisJenisStokModel, 
                  as: "jenis_stok", 
                  required: false,
                  attributes: ["uuid", "jenis_stok_uuid"],
                  include: [
                    {
                      model: JenisStokModel,
                      as: "detail_stok", 
                      attributes: ["uuid", "name"],
                    },
                  ],
                },
              ],
            },
            {
              model: JenisStokModel,
              as: "jenis_stok",
              required: false,
              attributes: ["name", "uuid"],
            },
          ],
        },
        {
          model: PatientModel,
          as: "patient",
          required: false,
          attributes: ["uuid", "name", "noRm"],
          include: [
            {
              model: BirthDetailModel,
              as: "birth_detail",
              required: false,
              attributes: [
                [
                  Sequelize.literal(
                    `TO_CHAR("patient->birth_detail"."birth_date", 'FMDD') || ' ' || 
                        (CASE EXTRACT(MONTH FROM "patient->birth_detail"."birth_date")
                          WHEN 1 THEN 'Januari'
                          WHEN 2 THEN 'Februari'
                          WHEN 3 THEN 'Maret'
                          WHEN 4 THEN 'April'
                          WHEN 5 THEN 'Mei'
                          WHEN 6 THEN 'Juni'
                          WHEN 7 THEN 'Juli'
                          WHEN 8 THEN 'Agustus'
                          WHEN 9 THEN 'September'
                          WHEN 10 THEN 'Oktober'
                          WHEN 11 THEN 'November'
                          WHEN 12 THEN 'Desember'
                        END) || ' ' || 
                    TO_CHAR("patient->birth_detail"."birth_date", 'YYYY')`
                  ),
                  "tanggal_lahir",
                ],

                [
                  Sequelize.literal(
                    `"patient->birth_detail"."age_year" || ' tahun ' || "patient->birth_detail"."age_month" || ' bulan ' || "patient->birth_detail"."age_day" || ' hari'`
                  ),
                  "umur",
                ],
              ],
            },
          ],
        },
      ],
    });
  }

  static async getItemConfigForOrder(itemMedisUuid, lokasiStokUuid) {
    return await ItemMedisJenisStokModel.findOne({
      where: {
        item_medis_uuid: itemMedisUuid,
      },
      include: [
        {
          model: StockMedisModel,
          as: "stocks",
          required: true,
          where: {
            lokasi_stok_uuid: lokasiStokUuid,
          },
        },
        {
          model: HargaItemModel,
          as: "detail_harga",
          limit: 1,
        },
      ],
    });
  }

  // create prescription
  static async createAlkes(req, transaction) {
    return await OrderAlkesModel.create(req, { transaction });
  }

  // create prescription item
  static async createAlkesItem(req, transaction) {
    return await OrderAlkesItemModel.create(req, { transaction });
  }

  // get all prescription
  static async getAllAlkes(req) {
    req.search = Utils.nullToType(req.search);
    req.lokasi_stok_uuid = Utils.nullToType(req.lokasi_stok_uuid);
    req.jenis_pelayanan = Utils.nullToType(req.jenis_pelayanan);
    req.racikan = Utils.nullToType(req.racikan);
    req.takeaway = Utils.nullToType(req.takeaway);
    req.is_chronic = Utils.nullToType(req.is_chronic);

    setRangeDate(req);

    let wherePrescription = {
      faskes_uuid: req.faskes_uuid,
      [Op.or]: [
        { no_resep: { [Op.iLike]: `%${req.search}%` } },
        { no_rm: { [Op.iLike]: `%${req.search}%` } },
      ],
      lokasi_stok_uuid: { [Op.like]: `%${req.lokasi_stok_uuid}%` },
      order_date: {
        [Op.between]: [req.start_date, req.end_date],
      },
      order_status: {
        [Op.between]: [1, 4],
      },
    };

    if (req.jenis_pelayanan !== "") {
      wherePrescription.jenis_pelayanan = req.jenis_pelayanan;
    }

    if (req.takeaway !== "") {
      wherePrescription.is_takeaway = true;
    }

    let wherePrescriptionItem = {};

    if (req.racikan !== "") {
      wherePrescriptionItem.is_compound = true;
    }

    if (req.is_chronic !== "") {
      wherePrescriptionItem.is_chronic = true;
    }

    return await PrescriptionModel.findAll({
      where: wherePrescription,
      attributes: [
        "uuid",
        "no_rm",
        "no_reg",
        "no_resep",
        "dokter_order",
        "jenis_pelayanan",
        "order_date",
        "is_takeaway",
        "order_status",
      ],
      include: [
        {
          model: PrescriptionItemModel,
          as: "obat",
          required: req.is_chronic === true || req.racikan === true,
          attributes: ["is_chronic", "is_compound"],
          where: wherePrescriptionItem,
        },
      ],
    });
  }

  // get all prescription item
  static async getAllAlkesItem(alkes_uuid) {
    return await PrescriptionItemModel.findAll({
      where: {
        prescription_uuid: alkes_uuid,
      },
    });
  }

  // delete alkes item
  static async deleteAlkesItem(alkes_item_uuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      return await OrderAlkesItemModel.destroy({
        where: {
          uuid: alkes_item_uuid,
        },
        transaction: tr,
      });
    });
  }

  // edit alkes

  static async editAlkes(dataToUpdate, uuid, transaction) {
    delete dataToUpdate.uuid;

    const [affectedRows] = await OrderAlkesModel.update(dataToUpdate, {
      where: {
        uuid: uuid,
      },
      transaction: transaction,
    });
    return affectedRows;
  }

  static async editAlkesItem(dataToUpdate, transaction) {
    const { uuid, ...fields } = dataToUpdate;
    const [affectedRows] = await OrderAlkesItemModel.update(fields, {
      where: {
        uuid: uuid,
      },
      transaction: transaction,
    });

    if (affectedRows[0] === 0) {
      throw new InternalServerException(
        `Tidak ada data item alkes yang diubah (UUID: ${uuid})`
      );
    }

    return affectedRows;
  }

  static async updateAlkes(uuid, data, transaction) {
    return await OrderAlkesModel.update(data, {
      where: { uuid: uuid },
      transaction: transaction,
    });
  }

  static async getOrderBySomeUuid(req) {
    return await OrderAlkesModel.findAll({
      where: {
        rekam_medis_uuid: req.rekam_medis_uuid,
        rekam_medis_date: req.rekam_medis_date,
      },
      attributes: [
        "uuid",
        "order_status",
        "no_order_alkes",
        "petugas_order",
        "created_at",
      ],
      include: [
        {
          model: OrderAlkesItemModel,
          as: "alkes_items",
          required: false,
        },
        {
          model: LokasiStokModel,
          as: "lokasi_stok",
          required: false,
          attributes: ["name"],
        },
      ],
    });
  }

  static async getAllForFarmacy(req) {
    req.search = Utils.nullToType(req.search);
    req.lokasi_stok_uuid = Utils.nullToType(req.lokasi_stok_uuid);
    req.lokasi_uuid = Utils.nullToType(req.lokasi_uuid);
    req.status = Utils.nullToType(req.status, Array);
    req.payment_method = Utils.nullToType(req.payment_method, Number);

    req = setRangeDate(req);

    const option = {
      where: {
        order_status: {
          [Op.between]: req.status.length > 0 ? req.status : [1, 3],
        },
        faskes_uuid: req.faskes_uuid,
        [Op.or]: [
          { no_order_alkes: { [Op.iLike]: `%${req.search}%` } },
          { no_rm: { [Op.iLike]: `%${req.search}%` } },
          sequelizeInstance.where(sequelizeInstance.col("patient.name"), {
            [Op.iLike]: `%${req.search || ""}%`,
          }),
        ],
        created_at: {
          [Op.between]: [req.start_date, req.end_date],
        },
        lokasi_stok_uuid: { [Op.like]: `%${req.lokasi_stok_uuid}%` },
        lokasi_uuid: { [Op.like]: `%${req.lokasi_uuid}%` },
      },
      attributes: [
        "uuid",
        "no_order_alkes",
        "order_status",
        "petugas_order",
        "created_at",
        "no_reg",
        "no_rm",
        "jenis_pelayanan",
        "payment_method",
      ],
      include: [
        {
          model: LokasiModel,
          as: "lokasi",
          required: false,
          attributes: ["name", "uuid"],
        },
        {
          model: PatientModel,
          as: "patient",
          required: false,
          attributes: ["name"],
        },
        {
          model: LokasiStokModel,
          as: "lokasi_stok",
          required: false,
          attributes: ["name"],
        },
      ],
    };

    if (req.payment_method !== 0) {
      option.where.payment_method = req.payment_method;
    }

    if (!req.pagination) {
      return await OrderAlkesModel.findAll(option);
    } else {
      return await Pagination.init(OrderAlkesModel, req, option);
    }
  }

  static async getAlkesItem(uuid) {
    return await OrderAlkesItemModel.findOne({
      where: {
        uuid: uuid,
      },
      attributes: [
        "qty",
        "stok_medis_uuides",
        "item_medis_uuid",
        "jenis_stok_uuid",
      ],
    });
  }

  static async removeJenisStok(req, transaction) {
    const affectedRow = await OrderAlkesItemModel.update(
      {
        jenis_stok_uuid: null,
      },
      {
        where: {
          order_alkes_uuid: req.uuid,
        },
        transaction: transaction,
      }
    );

    if (affectedRow[0] === 0) {
      throw new InternalServerException("Tidak ada data yang diubah");
    }

    return affectedRow;
  }
}
