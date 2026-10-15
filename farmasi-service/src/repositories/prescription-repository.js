import sequelizeInstance from "@opensimrs/model-sdk/instance";
import moment from "moment";
import NotfoundException from "../errors/notfound-exception.js";
import BadRequestException from "../errors/bad-request-exception.js";
import { Op } from "sequelize";
import Utils from "../helpers/utils.js";
import { setRangeDate } from "../helpers/date-helper.js";
import {
  AturanPakaiModel,
  BentukRacikanModel,
  CaraiPakaiModel,
  ItemMedisModel,
  JenisStokModel,
  LokasiStokModel,
  PrescriptionItemModel,
  PrescriptionItemRacikanModel,
  PrescriptionModel,
  SatuanModel,
} from "@opensimrs/model-sdk/farmasi";
import PrescriptionItemSubstitutionModel from "../models/prescription-item-substitution-model.js";
import { BirthDetailModel, PatientModel } from "@opensimrs/model-sdk/admisi";
import Pagination from "../helpers/pagination.js";
import { FaskesModel, LokasiModel } from "@opensimrs/model-sdk/datamaster";
import { FaskesProfilesModel } from "@opensimrs/model-sdk/setting";

export default class PrescriptionRepository {
  static get _richInclude() {
    return [
      {
        model: PrescriptionItemModel,
        as: "obat",
        required: false,
        attributes: {
          exclude: ["deleted_at", "created_at", "updated_at", "faskes_uuid"],
        },
        include: [
          {
            model: PrescriptionItemRacikanModel,
            as: "racikan",
            required: false,
            attributes: {
              exclude: [
                "deleted_at",
                "created_at",
                "updated_at",
                "faskes_uuid",
              ],
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
                ],
              },
            ],
          },
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
            ],
          },
          {
            model: AturanPakaiModel,
            as: "aturan_pakai",
            required: false,
            attributes: ["name", "periode_unit", "periode", "frekuensi"],
          },
          {
            model: CaraiPakaiModel,
            as: "cara_pakai",
            required: false,
            attributes: ["cara_pakai"],
          },
          {
            model: BentukRacikanModel,
            as: "bentuk_racikan",
            required: false,
            attributes: ["nama_bentuk_racikan"],
          },
          {
            model: JenisStokModel,
            as: "jenis_stok",
            required: false,
            attributes: ["name"],
          },
          {
            model: SatuanModel,
            as: "satuan_dosis",
            required: false,
            attributes: ["name"],
          },
        ],
      },
      {
        model: PatientModel,
        as: "patient",
        required: false,
        attributes: ["uuid", "name", "no_rm", "gender"],
        include: [
          {
            model: BirthDetailModel,
            as: "birth_detail",
            required: false,
            attributes: ["birthDate", "ageYear", "ageMonth", "ageDay"],
          },
        ],
      },
      {
        model: LokasiStokModel,
        as: "lokasi_stok",
        required: false,
        attributes: ["name"],
      },
    ];
  }

  // get prescription by uuid
  // transaction opsional: dalam verifikasi, data harus dibaca di dalam transaksi yang sama
  // (sebelumnya diabaikan → harga yang baru diisi terbaca kosong dan obat tertagih Rp 0)
  static async getByUuid(uuid, transaction = undefined) {
    return await PrescriptionModel.findOne({
      transaction,
      where: {
        uuid: uuid,
      },
      attributes: {
        exclude: ["deleted_at", "created_at", "faskes_uuid"],
      },
      include: this._richInclude,
    });
  }

  // create prescription
  static async createPrescription(req, transaction) {
    return await PrescriptionModel.create(req, { transaction });
  }

  // create prescription item
  static async createPrescriptionItem(req, transaction) {
    return await PrescriptionItemModel.create(req, { transaction });
  }

  // create prescription item racikan
  static async createPrescriptionItemRacikan(req, transaction) {
    return await PrescriptionItemRacikanModel.create(req, transaction);
  }

  static async createSubstitutionLog(data, transaction) {
    return await PrescriptionItemSubstitutionModel.create(data, {
      transaction: transaction,
    });
  }

  static async editSisaObat(uuid, data, transaction) {
    const [affectedRows] = await PrescriptionItemModel.update(data, {
      where: { uuid: uuid },
      transaction: transaction,
    });
    return affectedRows;
  }

  static async updatePrescriptionItem(uuid, dataToUpdate, transaction) {
    const [affectedRows] = await PrescriptionItemModel.update(dataToUpdate, {
      where: { uuid: uuid },
      transaction: transaction,
    });
    return affectedRows;
  }

  // get all prescription
  static async getAllPrescription(req) {
    req.search = Utils.nullToType(req.search);
    req.lokasi_stok_uuid = Utils.nullToType(req.lokasi_stok_uuid);
    req.jenis_pelayanan = Utils.nullToType(req.jenis_pelayanan);
    req.is_chronic = Utils.nullToType(req.is_chronic);
    req.takeaway = Utils.nullToType(req.takeaway);
    req.racikan = Utils.nullToType(req.racikan);
    req.status = Utils.nullToType(req.status, Array);
    req.payment_method = Utils.nullToType(req.payment_method, Number);

    req = setRangeDate(req);

    let wherePrescription = {
      faskes_uuid: req.faskes_uuid,
      [Op.or]: [
        { no_resep: { [Op.iLike]: `%${req.search}%` } },
        { no_rm: { [Op.iLike]: `%${req.search}%` } },
        sequelizeInstance.where(sequelizeInstance.col("patient.name"), {
          [Op.iLike]: `%${req.search || ""}%`,
        }),
      ],
      lokasi_stok_uuid: { [Op.like]: `%${req.lokasi_stok_uuid}%` },
      order_date: {
        [Op.between]: [req.start_date, req.end_date],
      },
      order_status: {
        [Op.between]: [1, 4],
      },
    };

    if (req.status.length > 0) {
      wherePrescription.order_status = {
        [Op.between]: req.status,
      };
    }

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

    if (req.payment_method !== 0) {
      wherePrescription.payment_method = req.payment_method;
    }

    const options = {
      attributes: [
        "uuid",
        "rekam_medis_uuid",
        "no_rm",
        "no_reg",
        "no_resep",
        "dokter_order",
        "jenis_pelayanan",
        "order_date",
        "is_takeaway",
        "order_status",
        "payment_method",
      ],
      include: this._richInclude.map((include) => {
        if (include.as === "obat") {
          return {
            ...include,
            required: req.racikan === true || req.racikan === true,
            where: wherePrescriptionItem,
          };
        }
        return { ...include, required: false };
      }),
      where: wherePrescription,
    };

    if (!req.pagination) {
      return await PrescriptionModel.findAll(options);
    } else {
      return await Pagination.init(PrescriptionModel, req, options);
    }
  }

  // get all prescription item
  static async getAllPrescriptionItem(prescription_uuid) {
    return await PrescriptionItemModel.findAll({
      where: {
        prescription_uuid: prescription_uuid,
      },
    });
  }

  static async getPrescriptionItemByUuid(uuid, transaction) {
    return await PrescriptionItemModel.findOne({
      where: { uuid: uuid },
      attributes: [
        "uuid",
        "prescription_uuid",
        "faskes_uuid",
        "item_medis_uuid",
        "jenis_stok_uuid",
        "medication_qty",
      ],
      transaction: transaction,
    });
  }

  // get all prescription item racikan
  static async getAllPrescriptionItemRacikan(
    prescription_item_uuid,
    transaction
  ) {
    return await PrescriptionItemRacikanModel.findAll({
      where: {
        prescription_item_uuid: prescription_item_uuid,
      },
      transaction: transaction,
    });
  }

  // delete prescription item
  static async deletePrescriptionItem(prescription_item_uuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      const affectedRow = await PrescriptionItemModel.destroy({
        where: {
          uuid: prescription_item_uuid,
        },
        transaction: tr,
      });

      await PrescriptionItemRacikanModel.destroy({
        where: {
          prescription_item_uuid: prescription_item_uuid,
        },
        transaction: tr,
      });

      return affectedRow;
    });
  }

  // delete prescription item racikan
  static async deletePrescriptionItemRacikan(prescription_item_racikan_uuid) {
    return await PrescriptionItemRacikanModel.destroy({
      where: {
        uuid: prescription_item_racikan_uuid,
      },
    });
  }

  // edit prescription
  static async editPrescription(req, transaction) {
    return await PrescriptionModel.update(req, {
      where: {
        uuid: req.uuid,
      },
      transaction: transaction,
    });
  }

  // edit prescription item racikan
  static async editPrescriptionItemRacikan(req) {
    return await PrescriptionItemRacikanModel.update(req, {
      where: {
        uuid: req.uuid,
      },
    });
  }

  // edit prescription item
  static async editPrescriptionItem(req, transaction) {
    let isUsingTransaction = true;
    if (transaction === null || transaction === undefined) {
      transaction = await sequelizeInstance.transaction();
      isUsingTransaction = false;
    }

    const result = await PrescriptionItemModel.update(req, {
      where: {
        uuid: req.uuid,
      },
      transaction,
    });

    if (!isUsingTransaction) {
      await transaction.commit();
    }

    return result;
  }

  static async getHistoryObat(req) {
    if (req.group_index === null || req.group_index === undefined) {
      req.group_index = 0;
    }

    let filter = {
      no_rm: req.no_rm,
      faskes_uuid: req.faskes_uuid,
      order_status: 5,
    };

    if (
      req.pelayanan !== null &&
      req.pelayanan !== undefined &&
      req.pelayanan !== ""
    ) {
      filter.jenis_pelayanan = req.pelayanan;
    }

    const prescriptions = await PrescriptionModel.findAll({
      where: filter,
      order: [["created_at", "ASC"]],
      attributes: ["no_resep", "dokter_order", "jenis_pelayanan", "order_date"],
      include: [
        {
          model: PrescriptionItemModel,
          as: "obat",
          attributes: ["medication_qty"],
          required: false,
          include: [
            {
              model: AturanPakaiModel,
              as: "aturan_pakai",
              required: false,
              attributes: ["name"],
            },
            {
              model: ItemMedisModel,
              as: "item_medis",
              required: false,
              attributes: ["name"],
            },
            {
              model: SatuanModel,
              as: "satuan_dosis",
              required: false,
              attributes: ["name"],
            },
          ],
        },
      ],
    });

    if (!prescriptions.length) {
      throw new NotfoundException("Tidak ada data prescription ditemukan.");
    }

    const groupedPrescriptions = prescriptions.reduce(
      (groups, prescription) => {
        const dayKey = moment
          .unix(prescription.created_at)
          .startOf("day")
          .format("X"); // Format sebagai epoch (X)
        if (!groups[dayKey]) {
          groups[dayKey] = [];
        }
        groups[dayKey].push(prescription);
        return groups;
      },
      {}
    );

    const sortedGroupKeys = Object.keys(groupedPrescriptions).sort(
      (a, b) => b - a
    ); // Urutkan berdasarkan hari terbaru
    const totalGroups = sortedGroupKeys.length;

    if (req.group_index >= totalGroups || req.group_index < 0) {
      throw new BadRequestException("Index kelompok melebihi batas.");
    }

    const currentGroupKey = sortedGroupKeys[req.group_index];
    const currentGroup = groupedPrescriptions[currentGroupKey];

    return {
      data: currentGroup,
      metadata: {
        total_pages: totalGroups,
        page: parseInt(req.group_index) + 1,
      },
    };
  }

  static async getOrderBySomeUuid(uuidArray) {
    return await PrescriptionModel.findAll({
      where: {
        uuid: {
          [Op.in]: uuidArray,
        },
      },
      attributes: [
        "uuid",
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

  static async getPrescriptionUuidByObat(item_uuid) {
    return await PrescriptionItemModel.findOne({
      where: {
        uuid: item_uuid,
      },
      attributes: ["prescription_uuid"],
    });
  }

  static async getForFpo(req) {
    const selectedDate = moment.unix(req.date).endOf("day").unix();
    // let itemWhereOptions = {};
    // if (moment(selectedDate).isSame(new Date(), "day")) {
    //   itemWhereOptions = {
    //     sisa_qty_order: {
    //       [Op.gt]: 0,
    //     },
    //   };
    // }

    let prescriptionOptions = {
      where: {
        created_at: {
          [Op.lte]: selectedDate,
        },
        order_status: 5,
        rekam_medis_uuid: req.rekam_medis_uuid,
      },

      attributes: ["no_resep", "dokter_order"],
      include: [
        {
          model: PrescriptionItemModel,
          required: true,
          as: "obat",
          //   where: itemWhereOptions,
          attributes: [
            "uuid",
            "medication_dose_qty",
            "medication_qty",
            "nama_racikan",
            "sisa_qty_order",
          ],
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
              ],
            },
            {
              model: AturanPakaiModel,
              as: "aturan_pakai",
              required: false,
              attributes: ["name"],
            },
            {
              model: CaraiPakaiModel,
              as: "cara_pakai",
              required: false,
              attributes: ["cara_pakai"],
            },
            {
              model: SatuanModel,
              as: "satuan_dosis",
              required: false,
              attributes: ["name"],
            },
            {
              model: BentukRacikanModel,
              as: "bentuk_racikan",
              required: false,
              attributes: ["nama_bentuk_racikan"],
            },
            // {
            //   model: FpoPemberianModel,
            //   as: "fpo_pemberian",
            //   required: !moment(selectedDate).isSame(new Date(), "day"),
            //   attributes: ["jam_pemberian"],
            //   where: {
            //     jam_pemberian: {
            //       [Op.between]: [
            //         moment(selectedDate).startOf("day").unix(),
            //         moment(selectedDate).endOf("day").unix(),
            //       ],
            //     },
            //   },
            // },
          ],
        },
      ],
    };

    return await PrescriptionModel.findAll(prescriptionOptions);
  }

  static async getPrescriptionByUuid(uuid) {
    const data = await PrescriptionItemModel.findOne({
      where: {
        uuid: uuid,
      },
    });

    if (!data) {
      throw new NotfoundException("Data tidak ditemukan");
    }

    return data;
  }

  static async getPendapatan(req) {
    req.subQuery = false;

    req.search = Utils.nullToType(req.search);
    req.jenis_pelayanan = Utils.nullToType(req.jenis_pelayanan);
    req.lokasi_uuid = Utils.nullToType(req.lokasi_uuid);
    req.payment_method = Utils.nullToType(req.payment_method, Number);

    let option = {
      where: {
        order_date: {
          [Op.between]: [req.start_date, req.end_date],
        },
        order_status: {
          [Op.between]: [5, 6],
        },
        [Op.or]: [
          { no_rm: { [Op.iLike]: `%${req.search}%` } },
          { no_resep: { [Op.iLike]: `%${req.search}%` } },
          sequelizeInstance.where(sequelizeInstance.col("patient.name"), {
            [Op.iLike]: `%${req.search || ""}%`,
          }),
        ],
        faskes_uuid: req.faskes_uuid,
      },
      attributes: [
        "order_date",
        "no_resep",
        "no_rm",
        "no_reg",
        "payment_method",
        "dokter_order",
        "total_harga",
        "jenis_pelayanan",
        "no_invoice",
      ],
      include: [
        {
          model: PatientModel,
          as: "patient",
          required: false,
          attributes: ["name"],
        },
        {
          model: LokasiModel,
          as: "lokasi",
          required: false,
          attributes: ["name"],
        },
      ],
    };

    if (req.jenis_pelayanan !== "") {
      option.where.jenis_pelayanan = req.jenis_pelayanan;
    }

    if (req.lokasi_uuid !== "") {
      option.where.lokasi_uuid = req.lokasi_uuid;
    }

    if (req.payment_method !== 0) {
      option.where.payment_method = req.payment_method;
    }

    return await Pagination.init(PrescriptionModel, req, option);
  }

  // get for waktu tunggu
  static async getTat(req) {
    req.search = Utils.nullToType(req.search);
    req.lokasi_uuid = Utils.nullToType(req.lokasi_uuid);
    req.jenis_pelayanan = Utils.nullToType(req.jenis_pelayanan);
    req.racikan = Utils.nullToType(req.racikan);
    req.payment_method = Utils.nullToType(req.payment_method, Number);

    let wherePrescription = {
      faskes_uuid: req.faskes_uuid,
      [Op.or]: [
        { no_resep: { [Op.iLike]: `%${req.search}%` } },
        { no_rm: { [Op.iLike]: `%${req.search}%` } },
        sequelizeInstance.where(sequelizeInstance.col("patient.name"), {
          [Op.iLike]: `%${req.search || ""}%`,
        }),
      ],
      lokasi_uuid: { [Op.like]: `%${req.lokasi_uuid}%` },
      order_date: {
        [Op.between]: [req.start_date, req.end_date],
      },
      order_status: {
        [Op.between]: [5, 6],
      },
    };

    let wherePrescriptionItem = {};

    if (req.jenis_pelayanan !== "") {
      wherePrescription.jenis_pelayanan = req.jenis_pelayanan;
    }

    if (req.racikan === "racikan") {
      wherePrescriptionItem.is_compound = true;
    } else if (req.racikan === "non-racikan") {
      wherePrescriptionItem.is_compound = false;
    }

    if (req.payment_method !== 0) {
      wherePrescription.payment_method = req.payment_method;
    }

    const options = {
      attributes: [
        "uuid",
        "no_rm",
        "no_reg",
        "no_resep",
        "waktu_verifikasi",
        "jenis_pelayanan",
        "order_date",
        "waktu_pemberian",
        "payment_method",
      ],
      include: [
        {
          model: PrescriptionItemModel,
          as: "obat",
          required: req.racikan === true || req.racikan === false,
          attributes: ["is_compound"],
          where: wherePrescriptionItem,
        },
        {
          model: PatientModel,
          on: sequelizeInstance.where(
            sequelizeInstance.cast(
              sequelizeInstance.col("PrescriptionModel.patient_uuid"),
              "TEXT"
            ),
            {
              [Op.eq]: sequelizeInstance.cast(
                sequelizeInstance.col("patient.uuid"),
                "TEXT"
              ),
            }
          ),
          as: "patient",
          required: false,
          attributes: ["name"],
        },
        {
          model: LokasiModel,
          as: "lokasi",
          required: false,
          attributes: ["name"],
        },
      ],
      where: wherePrescription,
    };

    return await Pagination.init(PrescriptionModel, req, options);
  }

  // get pendapatan per apotik
  static async getPendapatanPerApotik(req) {
    req.lokasi_stok_uuid = Utils.nullToType(req.lokasi_stok_uuid);
    req.payment_method = Utils.nullToType(req.payment_method, Number);

    let wherePrescription = {
      faskes_uuid: req.faskes_uuid,
      lokasi_stok_uuid: { [Op.like]: `%${req.lokasi_stok_uuid}%` },
      order_date: {
        [Op.between]: [req.start_date, req.end_date],
      },
      order_status: 5,
    };

    if (req.payment_method) {
      req.payment_method = Number(req.payment_method);
      wherePrescription.payment_method = req.payment_method;
    }

    const options = {
      attributes: [
        "payment_method",
        [
          sequelizeInstance.fn(
            "DATE",
            sequelizeInstance.fn(
              "TO_TIMESTAMP",
              sequelizeInstance.col("order_date")
            )
          ),
          "order_date",
        ],
        [
          sequelizeInstance.fn("SUM", sequelizeInstance.col("total_harga")),
          "total_harga",
        ],
        "lokasi_stok_uuid",
      ],
      include: [
        {
          model: LokasiStokModel,
          as: "lokasi_stok",
          required: false,
          attributes: ["name", "uuid"],
        },
      ],
      where: wherePrescription,
      group: [
        "payment_method",
        sequelizeInstance.fn(
          "DATE",
          sequelizeInstance.fn(
            "TO_TIMESTAMP",
            sequelizeInstance.col("order_date")
          )
        ),
        "lokasi_stok_uuid",
        "lokasi_stok.uuid",
        "lokasi_stok.name",
      ],
      order: [
        [
          sequelizeInstance.fn(
            "DATE",
            sequelizeInstance.fn(
              "TO_TIMESTAMP",
              sequelizeInstance.col("order_date")
            )
          ),
          "ASC",
        ],
      ],
    };

    return await Pagination.init(PrescriptionModel, req, options);
  }

  static async getEticketData(uuid) {
    return await PrescriptionModel.findOne({
      where: {
        uuid: uuid,
      },
      attributes: ["dokter_order", "no_resep", "order_date"],
      include: [
        {
          model: PrescriptionItemModel,
          as: "obat",
          required: false,
          attributes: ["prescription_notes", "is_compound", "medication_qty"],
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
              ],
            },
            {
              model: AturanPakaiModel,
              as: "aturan_pakai",
              required: false,
              attributes: ["name", "periode", "periode_unit", "frekuensi"],
            },
            {
              model: CaraiPakaiModel,
              as: "cara_pakai",
              required: false,
              attributes: ["cara_pakai"],
            },
            {
              model: BentukRacikanModel,
              as: "bentuk_racikan",
              required: false,
              attributes: ["nama_bentuk_racikan"],
            },
          ],
        },
        {
          model: PatientModel,
          on: sequelizeInstance.where(
            sequelizeInstance.cast(
              sequelizeInstance.col("PrescriptionModel.patient_uuid"),
              "TEXT"
            ),
            {
              [Op.eq]: sequelizeInstance.cast(
                sequelizeInstance.col("patient.uuid"),
                "TEXT"
              ),
            }
          ),
          as: "patient",
          required: false,
          attributes: ["name"],
          include: [
            {
              model: BirthDetailModel,
              as: "birth_detail",
              required: false,
              attributes: ["birth_date"],
            },
          ],
        },
        {
          model: FaskesModel,
          as: "faskes",
          required: false,
          attributes: ["name"],
        },
      ],
    });
  }

  static async getForPrescriptionPrint(uuid) {
    return await PrescriptionModel.findOne({
      where: {
        uuid: uuid,
      },
      attributes: [
        "dokter_order",
        "no_resep",
        "order_date",
        "no_rm",
        "jenis_pelayanan",
      ],
      include: [
        {
          model: PrescriptionItemModel,
          as: "obat",
          required: false,
          attributes: ["prescription_notes", "is_compound", "medication_qty"],
          include: [
            {
              model: PrescriptionItemRacikanModel,
              as: "racikan",
              required: false,
              attributes: {
                exclude: [
                  "deleted_at",
                  "created_at",
                  "updated_at",
                  "faskes_uuid",
                ],
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
                  ],
                },
              ],
            },
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
              ],
            },
            {
              model: AturanPakaiModel,
              as: "aturan_pakai",
              required: false,
              attributes: ["name", "periode", "periode_unit", "frekuensi"],
            },
            {
              model: CaraiPakaiModel,
              as: "cara_pakai",
              required: false,
              attributes: ["cara_pakai"],
            },
            {
              model: BentukRacikanModel,
              as: "bentuk_racikan",
              required: false,
              attributes: ["nama_bentuk_racikan"],
            },
          ],
        },
        {
          model: PatientModel,
          on: sequelizeInstance.where(
            sequelizeInstance.cast(
              sequelizeInstance.col("PrescriptionModel.patient_uuid"),
              "TEXT"
            ),
            {
              [Op.eq]: sequelizeInstance.cast(
                sequelizeInstance.col("patient.uuid"),
                "TEXT"
              ),
            }
          ),
          as: "patient",
          required: false,
          attributes: ["name"],
          include: [
            {
              model: BirthDetailModel,
              as: "birth_detail",
              required: false,
              attributes: ["birth_date"],
            },
          ],
        },
        {
          model: FaskesModel,
          as: "faskes",
          required: false,
          attributes: ["name"],
        },
        {
          model: LokasiModel,
          on: sequelizeInstance.where(
            sequelizeInstance.cast(
              sequelizeInstance.col("PrescriptionModel.lokasi_uuid"),
              "TEXT"
            ),
            {
              [Op.eq]: sequelizeInstance.cast(
                sequelizeInstance.col("lokasi.uuid"),
                "TEXT"
              ),
            }
          ),
          as: "lokasi",
          required: false,
          attributes: ["name"],
        },
      ],
    });
  }

  static async getForInvoicePrint(uuid) {
    return await PrescriptionModel.findOne({
      where: {
        uuid: uuid,
      },
      attributes: [
        "dokter_order",
        "no_resep",
        "order_date",
        "no_rm",
        "jenis_pelayanan",
        "payment_method",
      ],
      include: [
        {
          model: PrescriptionItemModel,
          as: "obat",
          required: false,
          attributes: [
            "prescription_notes",
            "is_compound",
            "medication_qty",
            "harga_satuan",
          ],
          include: [
            {
              model: PrescriptionItemRacikanModel,
              as: "racikan",
              required: false,
              attributes: {
                exclude: [
                  "deleted_at",
                  "created_at",
                  "updated_at",
                  "faskes_uuid",
                ],
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
                  ],
                },
              ],
            },
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
              ],
            },
            {
              model: AturanPakaiModel,
              as: "aturan_pakai",
              required: false,
              attributes: ["name", "periode", "periode_unit", "frekuensi"],
            },
            {
              model: CaraiPakaiModel,
              as: "cara_pakai",
              required: false,
              attributes: ["cara_pakai"],
            },
            {
              model: BentukRacikanModel,
              as: "bentuk_racikan",
              required: false,
              attributes: ["nama_bentuk_racikan"],
            },
          ],
        },
        {
          model: PatientModel,
          on: sequelizeInstance.where(
            sequelizeInstance.cast(
              sequelizeInstance.col("PrescriptionModel.patient_uuid"),
              "TEXT"
            ),
            {
              [Op.eq]: sequelizeInstance.cast(
                sequelizeInstance.col("patient.uuid"),
                "TEXT"
              ),
            }
          ),
          as: "patient",
          required: false,
          attributes: ["name"],
          include: [
            {
              model: BirthDetailModel,
              as: "birth_detail",
              required: false,
              attributes: ["birth_date"],
            },
          ],
        },
        {
          model: FaskesModel,
          as: "faskes",
          required: false,
          attributes: ["name"],
          include: [
            {
              model: FaskesProfilesModel,
              as: "faskes_profile",
              required: false,
              attributes: ["phone", "email", "logo"],
            },
          ],
        },
        {
          model: LokasiModel,
          as: "lokasi",
          on: sequelizeInstance.where(
            sequelizeInstance.cast(
              sequelizeInstance.col("PrescriptionModel.lokasi_uuid"),
              "TEXT"
            ),
            {
              [Op.eq]: sequelizeInstance.cast(
                sequelizeInstance.col("lokasi.uuid"),
                "TEXT"
              ),
            }
          ),
          required: false,
          attributes: ["name"],
        },
      ],
    });
  }
}
