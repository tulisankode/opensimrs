import sequelizeInstance from "@opensimrs/model-sdk/instance";
import moment from "moment";
import NotfoundException from "../errors/notfound-exception.js";
import BadRequestException from "../errors/bad-request-exception.js";
import { Op, QueryTypes } from "sequelize";
import Utils from "../helpers/utils.js";
import { setRangeDate, TZ_OFFSET } from "../helpers/date-helper.js";
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
  // faskes_uuid opsional: bila diisi, resep faskes lain dianggap tidak ada (isolasi faskes dari JWT)
  static async getByUuid(uuid, transaction = undefined, faskes_uuid = undefined) {
    return await PrescriptionModel.findOne({
      transaction,
      where: {
        uuid: uuid,
        ...(faskes_uuid ? { faskes_uuid } : {}),
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
    // transaksi harus dibungkus opsi; sebelumnya objek transaksi dikirim sebagai opsi sehingga
    // komposisi racikan tersimpan di luar transaksi (tertinggal bila order gagal)
    return await PrescriptionItemRacikanModel.create(req, { transaction });
  }

  static async createSubstitutionLog(data, transaction) {
    return await PrescriptionItemSubstitutionModel.create(data, {
      transaction: transaction,
    });
  }

  // Riwayat substitusi satu resep (urut waktu) beserta nama obat asal/pengganti & jenis stok.
  static async getSubstitutionByPrescription(prescription_uuid, faskes_uuid) {
    return await sequelizeInstance.query(
      `SELECT s.uuid, s.prescription_uuid, s.prescription_item_uuid,
          s.item_medis_asal_uuid, asal.name AS nama_obat_asal, s.jenis_stok_asal_uuid, jsa.name AS jenis_stok_asal,
          s.medication_qty_asal, s.item_medis_uuid, ganti.name AS nama_obat_pengganti,
          s.jenis_stok_uuid, jsg.name AS jenis_stok_pengganti, s.medication_qty, s.harga_satuan,
          s.kategori_alasan, s.alasan, s.persetujuan_dokter, s.dokter_penyetuju, s.catatan, s.petugas, s.created_at,
          s.status, s.cara_konfirmasi, s.waktu_konfirmasi, s.diputuskan_oleh, s.diputuskan_at, s.alasan_tolak,
          s.diverifikasi_oleh, s.diverifikasi_at
        FROM prescription_item_substitutions s
        LEFT JOIN item_medis asal ON asal.uuid = s.item_medis_asal_uuid
        LEFT JOIN item_medis ganti ON ganti.uuid = s.item_medis_uuid
        LEFT JOIN jenis_stok jsa ON jsa.uuid = s.jenis_stok_asal_uuid
        LEFT JOIN jenis_stok jsg ON jsg.uuid = s.jenis_stok_uuid
        WHERE s.prescription_uuid = :prescription_uuid AND s.faskes_uuid = :faskes_uuid AND s.deleted_at IS NULL
        ORDER BY s.created_at, s.id`,
      {
        replacements: { prescription_uuid, faskes_uuid },
        type: QueryTypes.SELECT,
      }
    );
  }

  // Baris substitusi dikunci untuk keputusan dokter (setujui/tolak/verifikasi) agar tidak diputuskan dua kali.
  static async lockSubstitusi(uuid, faskes_uuid, transaction) {
    return await PrescriptionItemSubstitutionModel.findOne({
      where: { uuid, faskes_uuid, deleted_at: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  static async updateSubstitusi(uuid, data, transaction) {
    const [affectedRows] = await PrescriptionItemSubstitutionModel.update(
      { ...data, updated_at: moment().unix() },
      { where: { uuid }, transaction }
    );
    return affectedRows;
  }

  // Jumlah pengajuan substitusi yang masih menunggu dokter pada satu resep (opsional: satu item resep).
  static async countSubstitusiMenunggu(
    { prescription_uuid, prescription_item_uuid, faskes_uuid },
    transaction
  ) {
    const where = { faskes_uuid, status: "menunggu", deleted_at: null };
    if (prescription_uuid) where.prescription_uuid = prescription_uuid;
    if (prescription_item_uuid) where.prescription_item_uuid = prescription_item_uuid;
    return await PrescriptionItemSubstitutionModel.count({ where, transaction });
  }

  // Daftar persetujuan substitusi untuk dokter. menunggu: hanya resep yang masih bisa diubah (status 1–2);
  // verifikasi: konfirmasi lisan & data lama yang belum diverifikasi dokter (status resep apa pun).
  static async getDaftarPersetujuanSubstitusi({ faskes_uuid, status, dokter }) {
    const syaratStatus = {
      menunggu: "s.status = 'menunggu' AND p.order_status IN (1, 2)",
      verifikasi:
        "s.status IN ('disetujui_lisan', 'tanpa_persetujuan') AND s.diverifikasi_at IS NULL",
      semua: "TRUE",
    }[status];
    return await sequelizeInstance.query(
      `SELECT s.uuid, s.prescription_uuid, s.prescription_item_uuid, s.status,
          p.no_resep, p.no_reg, p.no_rm, p.order_status, p.dokter_order, p.jenis_pelayanan, pt.name AS nama_pasien,
          asal.name AS nama_obat_asal, jsa.name AS jenis_stok_asal, s.medication_qty_asal,
          ganti.name AS nama_obat_pengganti, jsg.name AS jenis_stok_pengganti, s.medication_qty,
          s.kategori_alasan, s.alasan, s.catatan, s.petugas, s.created_at,
          s.dokter_penyetuju, s.cara_konfirmasi, s.waktu_konfirmasi, s.diputuskan_oleh, s.diputuskan_at, s.alasan_tolak,
          s.diverifikasi_oleh, s.diverifikasi_at
        FROM prescription_item_substitutions s
        JOIN prescriptions p ON p.uuid = s.prescription_uuid AND p.faskes_uuid = s.faskes_uuid
        LEFT JOIN patients pt ON pt.uuid = p.patient_uuid
        LEFT JOIN item_medis asal ON asal.uuid = s.item_medis_asal_uuid
        LEFT JOIN item_medis ganti ON ganti.uuid = s.item_medis_uuid
        LEFT JOIN jenis_stok jsa ON jsa.uuid = s.jenis_stok_asal_uuid
        LEFT JOIN jenis_stok jsg ON jsg.uuid = s.jenis_stok_uuid
        WHERE s.faskes_uuid = :faskes_uuid AND s.deleted_at IS NULL AND ${syaratStatus}
          AND (CAST(:dokter AS varchar) IS NULL OR p.dokter_order = :dokter)
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT 500`,
      {
        replacements: { faskes_uuid, dokter: dokter ?? null },
        type: QueryTypes.SELECT,
      }
    );
  }

  // Obat (aktif, faskes sendiri) yang punya stok belum kedaluwarsa di lokasi stok resep, per jenis stok.
  // Syarat stok sama dengan pemotongan stok saat verifikasi (StockMedisRepository.reduceQuantity).
  // item_medis_uuid opsional: hanya satu obat (dipakai validasi substitusi).
  static async getStokObatDiLokasi(
    { faskes_uuid, lokasi_stok_uuid, item_medis_uuid, jenis_stok_uuid },
    transaction
  ) {
    return await sequelizeInstance.query(
      `SELECT im.uuid AS item_medis_uuid, im.name, im.code, sp.name AS satuan,
          js.uuid AS jenis_stok_uuid, js.name AS jenis_stok, SUM(sm.sisa_stok)::float AS sisa_stok
        FROM item_medis im
        JOIN item_medis_jenis_stok ij ON ij.item_medis_uuid = im.uuid AND ij.deleted_at IS NULL
        JOIN jenis_stok js ON js.uuid = ij.jenis_stok_uuid AND js.deleted_at IS NULL
        JOIN stock_medis sm ON sm.item_medis_jenis_stok_uuid = ij.uuid AND sm.deleted_at IS NULL
          AND sm.lokasi_stok_uuid = :lokasi_stok_uuid AND sm.sisa_stok > 0 AND sm.exp_date > CURRENT_DATE
        LEFT JOIN satuan sp ON sp.uuid = im.satuan_penggunaan_uuid
        WHERE im.faskes_uuid = :faskes_uuid AND im.jenis_item = 'obat' AND im.deleted_at IS NULL
          AND im.status IS NOT FALSE
          ${item_medis_uuid ? "AND im.uuid = :item_medis_uuid" : ""}
          ${jenis_stok_uuid ? "AND js.uuid = :jenis_stok_uuid" : ""}
        GROUP BY im.uuid, im.name, im.code, sp.name, js.uuid, js.name
        ORDER BY im.name, js.name`,
      {
        replacements: {
          faskes_uuid,
          lokasi_stok_uuid,
          item_medis_uuid: item_medis_uuid ?? null,
          jenis_stok_uuid: jenis_stok_uuid ?? null,
        },
        type: QueryTypes.SELECT,
        transaction,
      }
    );
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
        "is_compound",
        // snapshot obat asal untuk riwayat substitusi
        "medication_dose_qty",
        "medication_dose_satuan_uuid",
        "medication_period",
        "aturan_pakai_uuid",
        "cara_pakai_uuid",
        "route",
        "is_chronic",
        "prescription_notes",
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
  static async deletePrescriptionItemRacikan(prescription_item_racikan_uuid, transaction) {
    return await PrescriptionItemRacikanModel.destroy({
      where: {
        uuid: prescription_item_racikan_uuid,
      },
      transaction,
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
  static async editPrescriptionItemRacikan(req, transaction) {
    return await PrescriptionItemRacikanModel.update(req, {
      where: {
        uuid: req.uuid,
      },
      transaction,
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

  static async getOrderBySomeUuid(uuidArray, faskes_uuid) {
    return await PrescriptionModel.findAll({
      where: {
        uuid: {
          [Op.in]: uuidArray,
        },
        faskes_uuid,
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
      attributes: ["prescription_uuid", "faskes_uuid", "is_compound", "item_medis_uuid"],
    });
  }

  // komponen racikan → item resep induknya (untuk cek status & faskes saat ubah jenis stok racikan)
  static async getRacikanByUuid(uuid) {
    return await PrescriptionItemRacikanModel.findOne({
      where: { uuid },
      attributes: ["uuid", "prescription_item_uuid", "faskes_uuid"],
    });
  }

  // kunci baris resep di dalam transaksi agar dua verifikasi/pembatalan bersamaan tidak memotong stok dua kali
  static async lockPrescription(uuid, faskes_uuid, transaction) {
    return await PrescriptionModel.findOne({
      where: { uuid, faskes_uuid },
      attributes: ["uuid", "order_status"],
      transaction,
      lock: transaction.LOCK.UPDATE,
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
        faskes_uuid: req.faskes_uuid,
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

  // Nilai bersih resep untuk laporan: total_harga dikurangi retur obat resep tsb (status 6 = diretur sebagian/
  // seluruhnya). Sebelumnya resep yang diretur tetap dihitung penuh di Pendapatan dan hilang dari Rekap per Apotik.
  // Basis nilai retur = HPP (retur.total = Σ harga_satuan HPP × qty retur), sama dengan baris koreksi negatif di
  // tagihan kasir; jadi nilai bersih = harga jual tertagih − HPP yang dikembalikan = yang dibayar pasien.
  static get _totalBersih() {
    return sequelizeInstance.literal(
      `("PrescriptionModel"."total_harga" - COALESCE((SELECT SUM(r.total) FROM retur r WHERE r.no_resep = "PrescriptionModel"."no_resep" AND r.faskes_uuid = "PrescriptionModel"."faskes_uuid" AND r.jenis_retur = 'obat' AND r.deleted_at IS NULL), 0))`
    );
  }

  // total = true: kembalikan jumlah seluruh baris tersaring (Grand Total), bukan halaman aktif.
  static async getPendapatan(req, { total = false } = {}) {
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
        [this._totalBersih, "total_harga"],
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

    if (total) {
      const hasil = await PrescriptionModel.findOne({
        where: option.where,
        attributes: [[sequelizeInstance.fn("SUM", this._totalBersih), "total"]],
        include: option.include.map((inc) => ({ ...inc, attributes: [] })),
        raw: true,
      });
      return Number(hasil?.total || 0);
    }

    option.order = [["order_date", "ASC"]];
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
      order_date: {
        [Op.between]: [req.start_date, req.end_date],
      },
      order_status: {
        [Op.between]: [5, 6],
      },
    };

    // Filter asal resep hanya bila dipilih (LIKE '%%' membuang resep tanpa lokasi).
    if (req.lokasi_uuid !== "") {
      wherePrescription.lokasi_uuid = req.lokasi_uuid;
    }

    if (req.jenis_pelayanan !== "") {
      wherePrescription.jenis_pelayanan = req.jenis_pelayanan;
    }

    // Filter racikan sebelumnya tidak berpengaruh (include "obat" tidak pernah required). Racikan = resep yang
    // memiliki item racikan; non-racikan = resep tanpa item racikan.
    const adaRacikan = `EXISTS (SELECT 1 FROM prescription_items pi WHERE pi.prescription_uuid = "PrescriptionModel"."uuid" AND pi.is_compound = true AND pi.deleted_at IS NULL)`;
    if (req.racikan === "racikan") {
      wherePrescription[Op.and] = [sequelizeInstance.literal(adaRacikan)];
    } else if (req.racikan === "non-racikan") {
      wherePrescription[Op.and] = [sequelizeInstance.literal(`NOT ${adaRacikan}`)];
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
          required: false,
          attributes: ["is_compound"],
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
      order: [["order_date", "ASC"]],
    };

    return await Pagination.init(PrescriptionModel, req, options);
  }

  // get pendapatan per apotik
  static async getPendapatanPerApotik(req) {
    req.lokasi_stok_uuid = Utils.nullToType(req.lokasi_stok_uuid);
    req.payment_method = Utils.nullToType(req.payment_method, Number);

    // Status 5 (diserahkan) & 6 (diretur) dengan nilai bersih retur, sama dengan Laporan Pendapatan.
    let wherePrescription = {
      faskes_uuid: req.faskes_uuid,
      order_date: {
        [Op.between]: [req.start_date, req.end_date],
      },
      order_status: { [Op.between]: [5, 6] },
    };

    if (req.lokasi_stok_uuid !== "") {
      wherePrescription.lokasi_stok_uuid = req.lokasi_stok_uuid;
    }

    // Tanggal dikelompokkan menurut zona waktu faskes (WIB); koneksi Sequelize berzona UTC sehingga sebelumnya
    // resep pukul 00.00–06.59 WIB masuk ke tanggal sehari sebelumnya.
    const tanggal = sequelizeInstance.literal(
      `DATE(TO_TIMESTAMP("PrescriptionModel"."order_date") AT TIME ZONE INTERVAL '${TZ_OFFSET}')`
    );

    if (req.payment_method) {
      req.payment_method = Number(req.payment_method);
      wherePrescription.payment_method = req.payment_method;
    }

    const options = {
      attributes: [
        "payment_method",
        [tanggal, "order_date"],
        [sequelizeInstance.fn("SUM", this._totalBersih), "total_harga"],
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
        tanggal,
        "lokasi_stok_uuid",
        "lokasi_stok.uuid",
        "lokasi_stok.name",
      ],
      order: [[tanggal, "ASC"]],
    };

    return await Pagination.init(PrescriptionModel, req, options);
  }

  static async getEticketData(uuid, faskes_uuid) {
    return await PrescriptionModel.findOne({
      where: {
        uuid: uuid,
        faskes_uuid,
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

  static async getForPrescriptionPrint(uuid, faskes_uuid) {
    return await PrescriptionModel.findOne({
      where: {
        uuid: uuid,
        faskes_uuid,
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
          // uuid: kunci riwayat substitusi obat pada e-resep
          attributes: ["uuid", "prescription_notes", "is_compound", "medication_qty"],
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

  static async getForInvoicePrint(uuid, faskes_uuid) {
    return await PrescriptionModel.findOne({
      where: {
        uuid: uuid,
        faskes_uuid,
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
