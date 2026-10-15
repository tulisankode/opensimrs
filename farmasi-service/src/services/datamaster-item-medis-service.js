import DataMasterItemMedisRepository from "../repositories/datamaster-item-medis-repository.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import ConversionRepository from "../repositories/conversion-repository.js";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import InternalServerException from "../errors/internal-server-exception.js";
import KonfigurasiHargaRepository from "../repositories/konfigurasi-harga-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import ExcelMapper from "../helpers/excel-mapper.js";
import DataMasterSatuanRepository from "../repositories/datamaster-satuan-repository.js";
import DatamasterBentukSediaanRepository from "../repositories/datamaster-bentuk-sediaan-repository.js";
import DataMasterManufactureRepository from "../repositories/datamaster-manufacture-repository.js";
import DataMasterKategoriObatRepository from "../repositories/datamaster-kategori-obat-repository.js";
import DataMasterJenisStokRepository from "../repositories/datamaster-jenis-stok-repository.js";
import NotfoundException from "../errors/notfound-exception.js";

export default class DatamasterItemMedisService {
  static async create(req) {
    ZodValidator.validate(DatamasterValidation.CREATE_ITEM_MEDIS, req);
    req.code = req.code.toUpperCase();

    const tr = await sequelizeInstance.transaction();
    try {
      const itemMedis = await DataMasterItemMedisRepository.create(req, tr);

      if (!!req.jenis_stocks) {
        for (const jenisStock of req.jenis_stocks) {
          ZodValidator.validate(
            DatamasterValidation.INSERT_JENIS_STOK_ITEM_MEDIS,
            jenisStock
          );
          await DataMasterItemMedisRepository.insertJenisStok(
            {
              item_medis_uuid: itemMedis.dataValues.uuid,
              jenis_stok_uuid: jenisStock.jenis_stok_uuid,
              faskes_uuid: req.faskes_uuid,
            },
            tr
          );
        }
      }

      if (req.conversion !== undefined && Array.isArray(req.conversion)) {
        const newConversion = req.conversion
          .filter(
            (item) =>
              item.uuid === "" || item.uuid === null || item.uuid === undefined
          )
          .map((item) => ({
            ...item,
            status: true,
            item_medis_uuid: itemMedis.dataValues.uuid,
            faskes_uuid: req.faskes_uuid,
            uuid: uuidv7(),
          }));

        if (newConversion.length > 0) {
          await ConversionRepository.bulkCreate(newConversion, tr);
        }
      }

      await tr.commit();
      return itemMedis;
    } catch (e) {
      await tr.rollback();
      throw new InternalServerException(e.message);
    }
  }

  static async update(req) {
    ZodValidator.validate(DatamasterValidation.UPDATE_ITEM_MEDIS, req);
    const tr = await sequelizeInstance.transaction();

    try {
      const itemMedis = await DataMasterItemMedisRepository.update(req, tr);

      if (!!req.jenis_stocks) {
        for (const jenisStock of req.jenis_stocks) {
          if (jenisStock.uuid === null || jenisStock.uuid === undefined) {
            ZodValidator.validate(
              DatamasterValidation.INSERT_JENIS_STOK_ITEM_MEDIS,
              jenisStock
            );
            await DataMasterItemMedisRepository.insertJenisStok(
              {
                item_medis_uuid: req.uuid,
                jenis_stok_uuid: jenisStock.jenis_stok_uuid,
                faskes_uuid: req.faskes_uuid,
              },
              tr
            );
          } else if (!!jenisStock.is_updated) {
            ZodValidator.validate(
              DatamasterValidation.UPDATE_JENIS_STOK_ITEM_MEDIS,
              jenisStock
            );
            await DataMasterItemMedisRepository.updateJenisStok(
              {
                jenis_stok_uuid: jenisStock.jenis_stok_uuid,
                uuid: jenisStock.uuid,
              },
              tr
            );
          } else if (!!jenisStock.is_deleted) {
            ZodValidator.validate(
              DatamasterValidation.DELETE_JENIS_STOK_ITEM_MEDIS,
              jenisStock
            );
            await DataMasterItemMedisRepository.deleteJenisStok(
              {
                uuid: jenisStock.uuid,
              },
              tr
            );
          }
        }
      }

      if (req.conversion !== undefined && Array.isArray(req.conversion)) {
        const newConversion = req.conversion
          .filter((item) => item.uuid === "")
          .map((item) => ({
            ...item,
            item_medis_uuid: req.uuid,
            faskes_uuid: req.faskes_uuid,
            uuid: uuidv7(),
          }));

        const updatedConversion = req.conversion
          .filter((item) => item.is_updated === true)
          .map((item) => ({
            ...item,
            item_medis_uuid: req.uuid,
            faskes_uuid: req.faskes_uuid,
          }));

        const deletedConversion = req.conversion
          .filter((item) => item.is_deleted === true)
          .map((item) => ({
            ...item,
            status: true,
            item_medis_uuid: req.uuid,
            faskes_uuid: req.faskes_uuid,
          }));

        if (newConversion.length > 0) {
          await ConversionRepository.bulkCreate(newConversion, tr);
        }

        if (updatedConversion.length > 0) {
          await Promise.all(
            updatedConversion.map((item) =>
              ConversionRepository.update(item, tr)
            )
          );
        }

        if (deletedConversion.length > 0) {
          await Promise.all(
            deletedConversion.map((item) =>
              ConversionRepository.delete(item, tr)
            )
          );
        }
      }
      await tr.commit();
      return itemMedis;
    } catch (e) {
      await tr.rollback();
      throw e;
    }
  }

  static async getAll(req) {
    return await DataMasterItemMedisRepository.getAll(req);
  }

  static async getItemMedisJenisStok(req){
    return await DataMasterItemMedisRepository.getItemMedisJenisStoks(req);
  }

  static async delete(req) {
    ZodValidator.validate(DatamasterValidation.DELETE_SATUAN, req);
    return await DataMasterItemMedisRepository.delete(req);
  }

  static async getConversions(req) {
    ZodValidator.validate(DatamasterValidation.GET_CONVERSIONS, req);
    return await ConversionRepository.getAll(req);
  }

  static async getAllConversions(req) {
    return await ConversionRepository.getAllConversions(req);
  }

  static async getAllWithoutPagination(req) {
    const configInfo = await KonfigurasiHargaRepository.get(req.faskes_uuid);

    return await DataMasterItemMedisRepository.getAllWithoutPagination(
      req,
      configInfo.metode_hpp === "avg"
    );
  }

  static async getAvailableJenisStok(params, faskesUuid) {
    const configInfo = await KonfigurasiHargaRepository.get(faskesUuid);
    const isAvg = configInfo?.metode_hpp === "avg";

    const daftar = await DataMasterItemMedisRepository.getAvailableJenisStok(params);
    if (!daftar.length) {
      throw new NotfoundException(`Item medis ${params.item_medis_jenis_stok_uuid} tidak memiliki jenis stok.`);
    }

    // satu baris per jenis stok: harga terbaru & total stok tersedia (di lokasi bila diminta)
    return Promise.all(
      daftar.map(async (baris) => {
        const priceInfo = await DataMasterItemMedisRepository.findLatestPricesForItemJenisStok(baris.uuid, isAvg);
        if (!priceInfo) console.warn(`Harga tidak ditemukan untuk item_medis_jenis_stok_uuid: ${baris.uuid}`);
        return {
          uuid: baris.uuid,
          item_medis_uuid: baris.item_medis_uuid,
          detail_stok: { uuid: baris.detail_stok.uuid, name: baris.detail_stok.name },
          harga: priceInfo?.dataValues?.harga ?? 0,
          total_stok: (baris.stocks ?? []).reduce((sum, stock) => sum + stock.sisa_stok, 0),
        };
      })
    );
  }


  static async import(req) {
    const itemMedisRequest = ExcelMapper.mapDatamasterItemMedis(
      req.data_item_medis,
      req.faskes_uuid
    );
    const conversionRequest = ExcelMapper.mapDatamasterConversion(
      req.data_conversion,
      req.faskes_uuid
    );

    const satuanCodes = [
      ...new Set(itemMedisRequest.map((item) => item.satuan_dosis_code)),
      ...new Set(itemMedisRequest.map((item) => item.satuan_kemasan_code)),
      ...new Set(itemMedisRequest.map((item) => item.satuan_penggunaan_code)),

      ...new Set(conversionRequest.map((item) => item.satuan_pembelian_code)),
      ...new Set(conversionRequest.map((item) => item.satuan_penggunaan_code)),
    ];

    // region CONVERT CODE TO UUID
    const [
      bentukSediaanUuid,
      manufactureUuid,
      kategoriObatUuid,
      satuanUuid,
      jenisStokUuid,
    ] = await Promise.all([
      DatamasterBentukSediaanRepository.getUuidesByCode(
        itemMedisRequest.map((item) => item.bentuk_sediaan_code),
        req.faskes_uuid
      ),
      DataMasterManufactureRepository.getUuidesByCodes(
        itemMedisRequest.map((item) => item.manufacure_code),
        req.faskes_uuid
      ),
      DataMasterKategoriObatRepository.getUuidesByCodes(
        itemMedisRequest.map((item) => item.kategori_obat_code),
        req.faskes_uuid
      ),
      DataMasterSatuanRepository.getUuidesByCodes(satuanCodes, req.faskes_uuid),
      DataMasterJenisStokRepository.getUuidesByCodes(
        itemMedisRequest.map((item) => item.jenis_stok_codes).flat(),
        req.faskes_uuid
      ),
    ]);
    const satuanMap = {};
    satuanUuid.forEach((satuan) => {
      satuanMap[satuan.code] = { uuid: satuan.uuid, name: satuan.name };
    });

    const bentukSediaanMap = {};
    bentukSediaanUuid.forEach((bentuk) => {
      bentukSediaanMap[bentuk.code] = bentuk.uuid;
    });
    const manufactureMap = {};
    manufactureUuid.forEach((manufacture) => {
      manufactureMap[manufacture.code] = manufacture.uuid;
    });
    const kategoriObatMap = {};
    kategoriObatUuid.forEach((kategori) => {
      kategoriObatMap[kategori.code] = kategori.uuid;
    });
    const jenisStokMap = {};
    jenisStokUuid.forEach((jenis) => {
      jenisStokMap[jenis.code] = jenis.uuid;
    });
    // endregion

    // region MAPPING FOR ITEM MEDIS REQUEST
    itemMedisRequest.forEach((item) => {
      if (
        !satuanMap[item.satuan_dosis_code]?.uuid ||
        !satuanMap[item.satuan_kemasan_code]?.uuid ||
        !bentukSediaanMap[item.bentuk_sediaan_code] ||
        !manufactureMap[item.manufacure_code] ||
        !kategoriObatMap[item.kategori_obat_code] ||
        !satuanMap[item.satuan_penggunaan_code]?.uuid
      ) {
        throw new BadRequestException(
          "ada kode di item medis yang tidak ditemukan datanya"
        );
      }

      if (item.jenis_stok_codes) {
        item.jenis_stok_codes.forEach((code) => {
          if (!jenisStokMap[code]) {
            throw new BadRequestException(
              "ada kode jenis stok yang tidak ditemukan datanya"
            );
          }
        });
      }

      item.uuid = uuidv7();
      item.satuan_dosis_uuid = satuanMap[item.satuan_dosis_code]?.uuid;
      item.satuan_kemasan_uuid = satuanMap[item.satuan_kemasan_code]?.uuid;
      item.bentuk_sediaan_uuid = bentukSediaanMap[item.bentuk_sediaan_code];
      item.manufacture_uuid = manufactureMap[item.manufacure_code];
      item.kategori_obat_uuid = kategoriObatMap[item.kategori_obat_code];
      item.satuan_penggunaan_uuid =
        satuanMap[item.satuan_penggunaan_code]?.uuid;
      item.jenis_stocks = item.jenis_stok_codes.map((code) => ({
        jenis_stok_uuid: jenisStokMap[code],
      }));
      item.jenis_item = item.jenis_item.toLowerCase();

      delete item.satuan_dosis_code;
      delete item.satuan_kemasan_code;
      delete item.bentuk_sediaan_code;
      delete item.manufacure_code;
      delete item.kategori_obat_code;
      delete item.satuan_penggunaan_code;
      delete item.jenis_stok_codes;
    });
    // endregion

    // region MAPPING FOR JENIS STOK REQUEST
    const ItemMedisJenisRequest = [];
    for (const item of itemMedisRequest) {
      if (!!item.jenis_stocks) {
        for (const jenisStock of item.jenis_stocks) {
          ItemMedisJenisRequest.push({
            item_medis_uuid: item.uuid,
            jenis_stok_uuid: jenisStock.jenis_stok_uuid,
            faskes_uuid: req.faskes_uuid,
          });
        }
      }
    }
    // endregion

    // region MAPPING FOR CONVERSION REQUEST
    conversionRequest.forEach((item) => {
      if (
        !satuanMap[item.satuan_pembelian_code]?.uuid ||
        !satuanMap[item.satuan_penggunaan_code]?.uuid
      ) {
        throw new BadRequestException(
          "ada kode di conversion yang tidak ditemukan datanya"
        );
      }

      item.uuid = uuidv7();
      item.satuan_pembelian_uuid = satuanMap[item.satuan_pembelian_code]?.uuid;
      item.satuan_penggunaan_uuid =
        satuanMap[item.satuan_penggunaan_code]?.uuid;
      item.satuan_pembelian = satuanMap[item.satuan_pembelian_code]?.name;
      item.satuan_penggunaan = satuanMap[item.satuan_penggunaan_code]?.name;

      const itemMedisUuid = itemMedisRequest.find(
        (itemMedis) => itemMedis.code === item.item_medis_code
      )?.uuid;

      if (!itemMedisUuid) {
        throw new BadRequestException(
          "kode item medis pada conversion tidak ditemukan"
        );
      }

      item.item_medis_uuid = itemMedisUuid;

      delete item.satuan_pembelian_code;
      delete item.satuan_penggunaan_code;
      delete item.item_medis_code;
    });
    // endregion

    const tr = await sequelizeInstance.transaction();

    try {
      await DataMasterItemMedisRepository.bulkCreate(itemMedisRequest, tr);
      await DataMasterItemMedisRepository.bulkInsertJenisStok(
        ItemMedisJenisRequest,
        tr
      );
      await ConversionRepository.bulkCreate(conversionRequest, tr);
      await tr.commit();
    } catch (e) {
      await tr.rollback();
      throw new InternalServerException(e.message);
    }

    return itemMedisRequest;
  }

  static async export(req) {
    const data = await this.getAll(req);

    const medicalItems = data.data;

    const conversions = [];

    medicalItems.map((item) => {
      item.satuan_dosis = item.satuan_dosis?.name;
      item.satuan_kemasan = item.satuan_kemasan?.name;
      item.satuan_penggunaan = item.satuan_penggunaan?.name;
      item.bentuk_sediaan = item.bentuk_sediaan?.name;
      item.manufacture = item.manufacture?.name;
      item.kategori_obat = item.kategori_obat?.name;

      if (item.jenis_stok) {
        item.jenis_stok = item.jenis_stok
          .map((jenis) => jenis.detail_stok.name)
          .join(", ");
      }

      if (item.ingridients) {
        item.ingridients = item.ingridients
          .map((ingridient) => ingridient.name)
          .join(", ");
      }

      item.status = item.status ? "Aktif" : "Non-Aktif";

      if (item.conversions) {
        item.conversions.forEach((conversion) => {
          conversions.push({
            item_medis: item.name,
            satuan_pembelian: conversion.satuan_pembelian,
            satuan_penggunaan: conversion.satuan_penggunaan,
            konversi: conversion.konversi,
          });
        });

        item.conversions = undefined;
      }
    });

    return {
      data: {
        item_medis: medicalItems,
        conversions: conversions,
      },
      pagination: data.pagination,
    };
  }

  static async getForPengadaan(req) {
    return await DataMasterItemMedisRepository.getForPengadaan(req);
  }
}
