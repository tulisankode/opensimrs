import PrescriptionRepository from "../repositories/prescription-repository.js";
import PrescriptionValidation from "../validations/prescription-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import BadRequestException from "../errors/bad-request-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import DataMasterLokasiStokRepository from "../repositories/datamaster-lokasi-stok-repository.js";
import InternalServerException from "../errors/internal-server-exception.js";
import Utils from "../helpers/utils.js";
import axiosInstance from "../configurations/axios-instance.js";
import { INVENTORY_URL, REKAM_MEDIS_URL } from "../helpers/constants.js";
import { setRangeDate, toEpochDate } from "../helpers/date-helper.js";
import KonfigurasiHargaService from "./konfigurasi-harga-service.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import DataMasterItemMedisRepository from "../repositories/datamaster-item-medis-repository.js";
import DataMasterBentukRacikanRepository from "../repositories/datamaster-bentuk-racikan-repository.js";
import { NotfoundException } from "@opensimrs/model-sdk/exceptions";
import PrescriptionHelper from "../helpers/prescriptionHelper.js";

export default class PrescriptionService {
  static async getByUuid(uuid) {
    const prescription = await PrescriptionRepository.getByUuid(uuid);
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }

    const formattedPrescription =
      PrescriptionHelper.mapPrescription(prescription);

    return formattedPrescription;
  }

  static async orderObat(req) {
    req.order_status = 1;
    const transaction = await sequelizeInstance.transaction();
    req.no_resep = Utils.generate4Code("RSP");

    ZodValidator.validate(PrescriptionValidation.CREATE_PRESCRIPTION, req);
    if (req.obat === null || req.obat === undefined) {
      throw new BadRequestException("'obat' tidak boleh kosong");
    }

    if (!req.lokasi_stok_uuid) {
      const lokasiStocks = await DataMasterLokasiStokRepository.getAll({
        faskes_uuid: req.faskes_uuid,
        jenis_lokasi: "depo",
        limit: 100,
      });

      if (!lokasiStocks) {
        throw new InternalServerException("lokasi stok belum di set");
      }

      const lokasi = lokasiStocks.data.find((item) =>
        item.default_tujuan_order_permintaan.includes(
          Utils.pelayananToJenisStockCode(req.jenis_pelayanan)
        )
      );

      if (!lokasi) {
        throw new InternalServerException(
          `Lokasi stok default belum di set untuk pelayanan ${req.jenis_pelayanan}`
        );
      }

      req.lokasi_stok_uuid = lokasi.uuid;
    }

    try {
      const prescription = await PrescriptionRepository.createPrescription(
        req,
        transaction
      );
      const prescription_uuid = prescription.dataValues.uuid;

      // create prescription item
      for (const item of req.obat) {
        item.prescription_uuid = prescription_uuid;
        item.faskes_uuid = req.faskes_uuid;
        item.sisa_qty_order = item.medication_qty;

        ZodValidator.validate(
          PrescriptionValidation.CREATE_PRESCRIPTION_ITEM,
          item
        );

        const prescription_item =
          await PrescriptionRepository.createPrescriptionItem(
            item,
            transaction
          );

        // create prescription item racikan
        if (item.racikan !== null && item.racikan !== undefined) {
          for (const racikan of item.racikan) {
            ZodValidator.validate(
              PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
              racikan
            );

            racikan.faskes_uuid = req.faskes_uuid;
            racikan.prescription_item_uuid = prescription_item.dataValues.uuid;

            await PrescriptionRepository.createPrescriptionItemRacikan(
              racikan,
              transaction
            );
          }
        }
      }

      // insert into rekam medis
      try {
        await axiosInstance.post(
          `${REKAM_MEDIS_URL}/rekam-medis/order-obat`,
          {
            session_uuid: req.session_uuid,
            order_obat_uuid: prescription_uuid,
          },
          {
            headers: {
              Authorization: req.token,
            },
          }
        );
      } catch (error) {
        if (error.response) {
          throw new InternalServerException(
            "[SERVER REKAM MEDIS]: " + error.response.data.message
          );
        } else if (error.request) {
          throw new InternalServerException(
            "Tidak ada respons dari server rekam medis"
          );
        } else {
          throw new InternalServerException(
            "Kesalahan saat menyiapkan permintaan rekam medis"
          );
        }
      }

      await transaction.commit();

      return prescription;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async addObat(req) {
    const transaction = await sequelizeInstance.transaction();

    if (req.obat === null || req.obat === undefined) {
      throw new BadRequestException("'obat' tidak boleh kosong");
    }

    try {
      for (const item of req.obat) {
        await this.statusLessThan(req.prescription_uuid, 2);

        item.prescription_uuid = req.prescription_uuid;
        item.sisa_qty_order = item.medication_qty;
        item.faskes_uuid = req.faskes_uuid;

        ZodValidator.validate(
          PrescriptionValidation.CREATE_PRESCRIPTION_ITEM,
          item
        );

        const prescription_item =
          await PrescriptionRepository.createPrescriptionItem(
            item,
            transaction
          );

        if (item.racikan !== null && item.racikan !== undefined) {
          for (const racikan of item.racikan) {
            ZodValidator.validate(
              PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
              item
            );

            racikan.faskes_uuid = req.faskes_uuid;
            racikan.prescription_item_uuid = prescription_item.dataValues.uuid;

            await PrescriptionRepository.createPrescriptionItemRacikan(
              racikan,
              transaction
            );
          }
        }
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async deleteObat(req) {
    ZodValidator.validate(PrescriptionValidation.DELETE_PRESCRIPTION_ITEM, req);

    const item = await PrescriptionRepository.getPrescriptionUuidByObat(
      req.prescription_item_uuid
    );
    await this.statusLessThan(item.prescription_uuid, 2);

    const result = await PrescriptionRepository.deletePrescriptionItem(
      req.prescription_item_uuid
    );
    if (result === 0) {
      throw new BadRequestException("data tidak ditemukan");
    }
    return result;
  }

  static async editSisaObat(data, prescription_item_uuid) {
    const validatedData = ZodValidator.validate(
      PrescriptionValidation.EDIT_SISA_OBAT,
      data
    );

    const transaction = await sequelizeInstance.transaction();
    try {
      const originalData =
        await PrescriptionRepository.getPrescriptionItemByUuid(
          prescription_item_uuid,
          transaction
        );

      if (!originalData) {
        throw new NotfoundException("prescription item tidak ditemukan.");
      }

      const jumlahPermintaan = originalData.dataValues.medication_qty;

      if (validatedData.sisa_qty_order > jumlahPermintaan) {
        throw new BadRequestException(
          "jumlah sisa tidak boleh melebihi permintaan"
        );
      }

      await PrescriptionRepository.editSisaObat(
        prescription_item_uuid,
        validatedData,
        transaction
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async substituteItem(data, author) {
    if (!data.penanggungjawab_subtitusi) {
      data.penanggungjawab_subtitusi = author.username;
    }

    const validatedData = ZodValidator.validate(
      PrescriptionValidation.SUBSTITUTE_PRESCRIPTION_ITEM,
      data
    );

    const transaction = await sequelizeInstance.transaction();

    try {
      const originalItem =
        await PrescriptionRepository.getPrescriptionItemByUuid(
          validatedData.prescription_item_uuid,
          transaction
        );

      if (!originalItem) {
        throw new NotfoundException(
          "Item resep yang akan diganti tidak ditemukan."
        );
      }

      const hargaBaruData = await DataMasterItemMedisRepository.getPrice({
        item_medis_uuid: validatedData.item_medis_uuid,
        jenis_stok_uuid: validatedData.jenis_stok_uuid,
      });

      let fixHargaSatuan = 0;
      if (
        hargaBaruData &&
        hargaBaruData.detail_harga &&
        hargaBaruData.detail_harga.length > 0
      ) {
        fixHargaSatuan = hargaBaruData.detail_harga[0].harga_jual || 0;
      }

      const fixHargaTotal = fixHargaSatuan * validatedData.medication_qty;

      const substitutionLogData = {
        prescription_uuid: originalItem.prescription_uuid,
        prescription_item_uuid: originalItem.uuid,
        faskes_uuid: originalItem.faskes_uuid,
        item_medis_uuid: validatedData.item_medis_uuid,
        jenis_stok_uuid: validatedData.jenis_stok_uuid,
        harga_satuan: fixHargaSatuan,
        medication_qty: validatedData.medication_qty,
        medication_dose_qty: validatedData.medication_dose_qty,
        medication_dose_satuan_uuid: validatedData.medication_dose_satuan_uuid,
        medication_period: validatedData.medication_period,

        aturan_pakai_uuid: validatedData.aturan_pakai_uuid,
        cara_pakai_uuid: validatedData.cara_pakai_uuid,
        route: validatedData.route,

        is_chronic: validatedData.is_chronic,
        alasan_subtitusi: validatedData.alasan_subtitusi,
        penanggungjawab_subtitusi: author.username,
        catatan: validatedData.catatan,
        is_substitution: true,
      };

      await PrescriptionRepository.createSubstitutionLog(
        substitutionLogData,
        transaction
      );

      const updateItemData = {
        item_medis_uuid: validatedData.item_medis_uuid,
        jenis_stok_uuid: validatedData.jenis_stok_uuid,
        harga_satuan: fixHargaSatuan,
        harga_total: fixHargaTotal,

        medication_qty: validatedData.medication_qty,
        medication_dose_qty: validatedData.medication_dose_qty,
        medication_dose_satuan_uuid: validatedData.medication_dose_satuan_uuid,
        medication_period: validatedData.medication_period,

        aturan_pakai_uuid: validatedData.aturan_pakai_uuid,
        cara_pakai_uuid: validatedData.cara_pakai_uuid,
        route: validatedData.route,
        is_chronic: validatedData.is_chronic,
        catatan: validatedData.catatan,

        is_substitution: true,
      };

      await PrescriptionRepository.updatePrescriptionItem(
        originalItem.uuid,
        updateItemData,
        transaction
      );

      await transaction.commit();
      return {
        prescription_item_uuid: originalItem.uuid,
        item_medis_uuid: validatedData.item_medis_uuid,
        message: "Substitusi berhasil dilakukan",
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async updatePrescription(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_PRESCRIPTION, req);

    await this.statusLessThan(req.uuid, 2);

    return await PrescriptionRepository.editPrescription(req);
  }

  static async updateObat(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_OBAT, req);

    const item = await PrescriptionRepository.getPrescriptionUuidByObat(
      req.uuid
    );
    if (!item) {
      throw new NotfoundException(
        `Item resep dengan UUID ${req.uuid} tidak ditemukan.`
      );
    }
    await this.statusLessThan(item.prescription_uuid, 2);

    if (req.type === "racikan") {
      for (const racikan of req.racikan) {
        if (
          racikan.uuid === null ||
          racikan.uuid === undefined ||
          racikan.uuid === ""
        ) {
          ZodValidator.validate(
            PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
            racikan
          );
          racikan.faskes_uuid = req.faskes_uuid;
          racikan.prescription_item_uuid = req.uuid;

          await PrescriptionRepository.createPrescriptionItemRacikan(racikan);

          continue;
        }

        if (racikan.is_deleted) {
          await PrescriptionRepository.deletePrescriptionItemRacikan(
            racikan.uuid
          );

          continue;
        }

        if (racikan.is_updated) {
          ZodValidator.validate(
            PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
            racikan
          );

          await PrescriptionRepository.editPrescriptionItemRacikan(racikan);
        }
      }
    }

    return await PrescriptionRepository.editPrescriptionItem(req);
  }

  static async getHistoryObat(req) {
    return await PrescriptionRepository.getHistoryObat(req);
  }

  static async getOrderBySomeUuid(req) {
    ZodValidator.validate(PrescriptionValidation.GET_SOME_ORDER, req);
    const rawData = await PrescriptionRepository.getOrderBySomeUuid(req.uuides);
    let data = [];

    for (const resep of rawData) {
      resep.dataValues.jumlah_obat = resep.dataValues.obat.length;

      resep.dataValues.lokasi_stok = resep.dataValues.lokasi_stok.name;

      for (const obatItem of resep.dataValues.obat) {
        if (obatItem.is_compound) {
          resep.dataValues.is_racikan = true;
        }

        if (obatItem.is_chronic) {
          resep.dataValues.is_chronic = true;
        }
      }

      resep.dataValues.obat = undefined;

      data.push(resep.dataValues);
    }

    if (data.length <= 0) {
      throw new BadRequestException("data tidak ditemukan");
    }

    return data;
  }

  static async updateTelaah(req) {
    req.status_telaah = true;
    req.order_status = 2;
    ZodValidator.validate(PrescriptionValidation.UPDATE_TELAAH, req);
    return await PrescriptionRepository.editPrescription(req);
  }

  static async batalOrder(req) {
    req.order_status = 0;
    ZodValidator.validate(PrescriptionValidation.BATAL_ORDER, req);
    return await PrescriptionRepository.editPrescription(req);
  }

  static async updateVerifikasi(req) {
    const validatedData = ZodValidator.validate(
      PrescriptionValidation.UPDATE_VERIFIKASI,
      req
    );

    const transaction = await sequelizeInstance.transaction();

    try {
      await this.statusLessThan(req.uuid, 2);

      const konfigurasiHarga = await KonfigurasiHargaService.get(req);
      const prescription = await PrescriptionRepository.getByUuid(req.uuid);
      if (!prescription) {
        throw new NotFoundError("Data resep tidak ditemukan.");
      }

      const itemStockMap = new Map(
        validatedData.items?.map((i) => [i.item_uuid, i.jenis_stok_uuid]) || []
      );

      const racikanStockMap = new Map(
        validatedData.racikan_items?.map((r) => [
          r.racikan_uuid,
          r.jenis_stok_uuid,
        ]) || []
      );

      req.total_harga = await this.setPriceInPrescription(
        prescription,
        konfigurasiHarga,
        itemStockMap,
        racikanStockMap,
        transaction
      );

      const updatedPrescription = await PrescriptionRepository.getByUuid(
        req.uuid,
        transaction
      );

      for (const obat of updatedPrescription.obat) {
        let usedStock;

        const baseMutasiData = {
          faskes_uuid: req.faskes_uuid,
          petugas: req.petugas_verifikasi,
          kode_referensi: updatedPrescription.no_resep,
          keterangan_prefix: `Verifikasi Resep: ${updatedPrescription.no_resep}`,
        };

        if (obat.is_compound) {
          for (const racikan of obat.racikan) {
            if (!racikan.jenis_stok_uuid) {
              throw new InternalServerException(
                `Jenis stok untuk racikan ${racikan.uuid} gagal disimpan.`
              );
            }

            usedStock = await StockMedisRepository.reduceQuantity(
              {
                item_medis_uuid: racikan.item_medis_uuid,
                jenis_stok_uuid: racikan.jenis_stok_uuid,
                quantity: racikan.medication_qty,
                metode_pemotongan_stok: konfigurasiHarga.metode_pemotongan_stok,
                name: racikan.item_medis?.name,
                lokasi_stok_uuid: prescription.lokasi_stok_uuid,
              },
              {
                ...baseMutasiData,
                item_uuid: racikan.item_medis_uuid,
                jenis_stok_uuid: racikan.jenis_stok_uuid,
              },
              transaction
            );
          }
        } else {
          if (!obat.jenis_stok_uuid) {
            throw new InternalServerException(
              `Jenis stok untuk item ${obat.uuid} gagal disimpan.`
            );
          }

          usedStock = await StockMedisRepository.reduceQuantity(
            {
              item_medis_uuid: obat.item_medis_uuid,
              jenis_stok_uuid: obat.jenis_stok_uuid,
              quantity: obat.medication_qty,
              lokasi_stok_uuid: prescription.lokasi_stok_uuid,
              metode_pemotongan_stok: konfigurasiHarga.metode_pemotongan_stok,
              name: obat.item_medis?.name,
            },
            {
              ...baseMutasiData,
              item_uuid: obat.item_medis_uuid,
              jenis_stok_uuid: obat.jenis_stok_uuid,
            },
            transaction
          );
        }

        const prescriptionItem = {
          uuid: obat.uuid,
          stok_medis_uuides: usedStock,
        };
        await PrescriptionRepository.editPrescriptionItem(
          prescriptionItem,
          transaction
        );
      }

      req.order_status = 3;
      req.waktu_verifikasi = toEpochDate(new Date());
      req.no_invoice = Utils.generate4Code("INV");
      await PrescriptionRepository.editPrescription(req, transaction);

      try {
        // harga jual = HPP (harga_satuan hasil verifikasi) x (1 + margin% Konfigurasi Harga);
        // racikan ditagih sebagai satu paket: komponen + biaya racik + embalase. PPN dihitung kasir di level tagihan.
        const margin = Number(konfigurasiHarga?.margin || 0);
        const hargaJual = (hpp) => Math.round(Number(hpp || 0) * (1 + margin / 100));
        const billingItems = updatedPrescription.obat.map((item) => {
          if (item.is_compound) {
            const komponen = (item.racikan ?? []).reduce(
              (sum, r) => sum + hargaJual(r.harga_satuan) * Number(r.medication_qty || 0),
              0
            );
            return {
              nama_item: item.nama_racikan || item.name || "Obat Racikan",
              harga: komponen + Number(item.biaya_racik || 0) + Number(item.biaya_embalase || 0),
              qty: 1,
            };
          }
          return {
            nama_item: item.item_medis?.name,
            harga: hargaJual(item.harga_satuan),
            qty: Number(item.medication_qty),
          };
        });

        const billingPayload = {
          session_uuid: prescription.session_uuid,
          type: "order_obat",
          items: billingItems,
        };

        const billingUrl = `${REKAM_MEDIS_URL}/rekam-medis/pelayanan/billing-layanan`;
        await axiosInstance.post(billingUrl, billingPayload, {
          headers: {
            Authorization: req.token,
          },
        });
      } catch (apiError) {
        throw new InternalServerException(
          "Gagal sinkronisasi ke Billing: " +
            (apiError?.response?.data?.errors?.[0]?.message || apiError?.response?.data?.message || apiError.message)
        );
      }

      await transaction.commit();
      return updatedPrescription;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async updateSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_SIAP_DISERAHKAN, req);

    await this.statusLessThan(req.uuid, 3);

    req.order_status = 4;
    req.waktu_penyiapan = toEpochDate(new Date());
    return await PrescriptionRepository.editPrescription(req);
  }

  static async batalSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.BATAL_DISERAHKAN, req);
    await this.statusLessThan(req.uuid, 5);
    req.order_status = 3;
    return await PrescriptionRepository.editPrescription(req);
  }

  static async updateDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_SERAHKAN, req);
    await this.statusLessThan(req.uuid, 5);
    req.order_status = 5;
    req.waktu_pemberian = toEpochDate(new Date());
    return await PrescriptionRepository.editPrescription(req);
  }

  static async updateLokasiStok(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_LOKASI_STOK, req);
    return await PrescriptionRepository.editPrescription(req);
  }

  static async getAll(req) {
    setRangeDate(req);

    ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
    const rawData = await PrescriptionRepository.getAllPrescription(req);

    const formattedData = PrescriptionHelper.mapPrescriptionList(rawData);

    let resep_masuk = [];
    let obat_disiapkan = [];
    let penyerahan_obat = [];

    for (const resep of formattedData) {
      const resepData = resep.dataValues || resep;

      if (resepData.order_status === 1 || resepData.order_status === 2) {
        resep_masuk.push(resepData);
      } else if (resepData.order_status === 3) {
        obat_disiapkan.push(resepData);
      } else if (resepData.order_status === 4) {
        penyerahan_obat.push(resepData);
      }
    }

    return {
      resep_masuk,
      obat_disiapkan,
      penyerahan_obat,
    };
  }

  static async updateJenisItem(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_JENIS_ITEM, req);

    if (req.is_racikan) {
      return await PrescriptionRepository.editPrescriptionItemRacikan(req);
    } else {
      return await PrescriptionRepository.editPrescriptionItem(req);
    }
  }

  static async setPriceInPrescription(
    prescription,
    konfigurasiHarga,
    itemStockMap,
    racikanStockMap,
    transaction
  ) {
    let totalHarga = 0;

    for (const item of prescription.obat) {
      if (item.is_compound) {
        for (const racikan of item.racikan) {
          const hargaItem = await DataMasterItemMedisRepository.getPrice({
            item_medis_uuid: racikan.item_medis_uuid,
            jenis_stok_uuid: racikan.jenis_stok_uuid,
          });

          if (
            hargaItem === null ||
            !hargaItem.detail_harga ||
            hargaItem.detail_harga.length === 0
          ) {
            throw new BadRequestException(
              `Harga item medis ${racikan.item_medis?.name} tidak ditemukan`
            );
          }

          const hargaSatuan =
            ["avg", "average"].includes(konfigurasiHarga.metode_hpp)
              ? hargaItem.detail_harga[0].dataValues.harga_avg ?? 0
              : hargaItem.detail_harga[0].dataValues.harga_terakhir ?? 0;

          totalHarga += hargaSatuan * racikan.medication_qty;

          await PrescriptionRepository.editPrescriptionItemRacikan(
            {
              uuid: racikan.uuid,
              harga_satuan: hargaSatuan,
              jenis_stok_uuid: racikan.jenis_stok_uuid,
            },
            transaction
          );
        }

        const tarif = await DataMasterBentukRacikanRepository.getByUuid(
          item.bentuk_racikan_uuid
        );
        if (!tarif) {
          throw new BadRequestException(`tarif racikan tidak ditemukan`);
        }
        let multiplier = 1;

        if (konfigurasiHarga.metode_biaya_racikan === "paket") {
          multiplier = 1 + Math.floor(item.medication_qty / tarif.jumlah);
        } else if (konfigurasiHarga.metode_biaya_racikan === "item") {
          multiplier = item.racikan.length;
        } else {
          throw new BadRequestException(`metode biaya racikan belum di set`);
        }

        totalHarga +=
          tarif.tarif_racik * multiplier + tarif.tarif_embalase * multiplier;

        await PrescriptionRepository.editPrescriptionItem(
          {
            uuid: item.uuid,
            biaya_racik: tarif.tarif_racik * multiplier,
            biaya_embalase: tarif.tarif_embalase * multiplier,
          },
          transaction
        );
      } else {
        // jenis stok pilihan apoteker di layar verifikasi (bila item belum menyimpannya)
        if (!item.jenis_stok_uuid && itemStockMap.get(item.uuid)) item.jenis_stok_uuid = itemStockMap.get(item.uuid);
        const hargaItem = await DataMasterItemMedisRepository.getPrice({
          item_medis_uuid: item.item_medis_uuid,
          jenis_stok_uuid: item.jenis_stok_uuid,
        });

        if (
          hargaItem === null ||
          !hargaItem.detail_harga ||
          hargaItem.detail_harga.length === 0
        ) {
          throw new BadRequestException(
            `Harga item medis ${item.item_medis?.name} tidak ditemukan (item: ${item.item_medis_uuid}, stok: ${item.jenis_stok_uuid})`
          );
        }

        const hargaSatuan =
          ["avg", "average"].includes(konfigurasiHarga.metode_hpp)
            ? hargaItem.detail_harga[0].dataValues.harga_avg ?? 0
            : hargaItem.detail_harga[0].dataValues.harga_terakhir ?? 0;

        totalHarga += hargaSatuan * item.medication_qty;

        await PrescriptionRepository.editPrescriptionItem(
          {
            uuid: item.uuid,
            harga_satuan: hargaSatuan,
            jenis_stok_uuid: item.jenis_stok_uuid,
          },
          transaction
        );
      }
    }

    return totalHarga;
  }

  static async statusLessThan(uuid, orderStatus) {
    if (!uuid) {
      throw new BadRequestException("prescription uuid tidak boleh kosong");
    }

    const prescription = await PrescriptionRepository.getByUuid(uuid);
    if (prescription === null) {
      throw new BadRequestException("data prescription tidak ditemukan");
    }

    if (prescription.order_status > orderStatus) {
      throw new BadRequestException("order status tidak memungkinkan aksi ini");
    }
  }

  static async getForFpo(req) {
    ZodValidator.validate(PrescriptionValidation.GET_FOR_FPO, req);
    return await PrescriptionRepository.getForFpo(req);
  }

  static async getEticketData(uuid) {
    // query cetak resep sudah meng-include komposisi racikan
    const prescription = await PrescriptionRepository.getForPrescriptionPrint(uuid);
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }

    const namaObat = (item) => {
      if (!item.is_compound) return item.item_medis?.name || "-";
      const komposisi = (item.racikan ?? [])
        .map((r) => r.item_medis?.name)
        .filter(Boolean)
        .join(", ");
      return `Racikan ${item.bentuk_racikan?.nama_bentuk_racikan ?? ""}`.trim() + (komposisi ? ` (${komposisi})` : "");
    };

    const aturanPakai = (aturan) => {
      if (!aturan) return "-";
      if (aturan.name) return aturan.name;
      if (aturan.frekuensi && aturan.periode_unit) return `${aturan.frekuensi}x, ${aturan.periode} ${aturan.periode_unit}`;
      return "-";
    };

    return (prescription.obat ?? []).map((item) => ({
      nama_faskes: prescription.faskes?.name,
      no_resep: prescription.no_resep,
      date: prescription.order_date,
      no_rm: prescription.no_rm,
      nama_pasien: prescription.patient?.name,
      tanggal_lahir: prescription.patient?.birth_detail?.birth_date,
      jenis: item.is_compound ? "Racikan" : "Non-Racikan",
      jumlah_obat: item.medication_qty,
      nama_obat: namaObat(item),
      satuan: item.is_compound
        ? item.bentuk_racikan?.nama_bentuk_racikan
        : item.item_medis?.satuan_penggunaan?.name,
      aturan_pakai: aturanPakai(item.aturan_pakai),
      cara_pakai: item.cara_pakai?.cara_pakai,
      catatan: item.prescription_notes,
    }));
  }

  static async getPrintPrescription(uuid) {
    const prescription = await PrescriptionRepository.getForPrescriptionPrint(
      uuid
    );
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }
    return prescription;
  }

  static async getForInvoicePrint(uuid) {
    const prescription = await PrescriptionRepository.getForInvoicePrint(uuid);
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }
    return prescription;
  }
}
