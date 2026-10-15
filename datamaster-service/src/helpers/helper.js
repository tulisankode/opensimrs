import excel from "exceljs";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse } from "./generate-message.js";
import { Model, Op, Sequelize, where } from "sequelize";
import ProvinceRepository from "../repositories/province-repository.js";
import KabupatenRepository from "../repositories/kabupaten-repository.js";
import KecamatanRepository from "../repositories/kecamatan-repository.js";
import KelurahanRepository from "../repositories/kelurahan-repository.js";
import { LokasiModel, OrganizationModel, PartOfLocationModel, PartOfOrganizationModel } from "@opensimrs/model-sdk/datamaster";
import { AddressModel } from "@opensimrs/model-sdk/setting";
import { LokasiStokModel } from "@opensimrs/model-sdk/farmasi";



PartOfOrganizationModel.hasOne(AddressModel, {
  constraints: false,
  foreignKey: "uuid",
  sourceKey: "address_uuid",
});
AddressModel.belongsTo(PartOfOrganizationModel, {
  constraints: false,
  foreignKey: "uuid",
  targetKey: "address_uuid",
});

OrganizationModel.hasOne(AddressModel, {
  constraints: false,
  foreignKey: "uuid",
  sourceKey: "address_uuid",
});
AddressModel.belongsTo(OrganizationModel, {
  constraints: false,
  foreignKey: "uuid",
  targetKey: "address_uuid",
});


/**
 * 
 * @param {Object} object data yang akan divalidasi
 * @param {Model} model model repo
 */
export async function uniqueCodeXFaskes(object, model){
  if ("code" in object && "faskes_uuid" in object) {
    const result = await model.findOne({
      where: {
        code: {
          [Op.iLike]: `%${object.code}%`,
        },
        faskes_uuid: object.faskes_uuid,
        deletedAt: {
          [Op.is]: null
        }
      },
    });
    if (result) {
      throw new HttpException(generateErrorResponse("Gagal", "conflic", `code ${object.code} sudah ada gunakan code lain`), HttpStatus.CONFLIC);
    }
  }
}



/**
 *
 * @param {string} pathFile
 * @returns {import('exceljs').Worksheet}
*/
const workBook = new excel.Workbook();
export async function parseExcel(pathFile) {
  await workBook.xlsx.readFile(pathFile);
  const workSheet = workBook.getWorksheet(1);
  return workSheet;
}
/**
 *
 * @param {string} pathFile
 * @returns {Array<import('exceljs').Worksheet>}
*/
export async function parseAllSeets(pathFile) {
  await workBook.xlsx.readFile(pathFile);
  const workSheet = workBook.worksheets;
  return workSheet;
}

/**
 *
 * @param {string} filePath
 * @returns {Promise<Array<import("exceljs").Worksheet>>}
 */
export async function extracAllSheet(filePath) {
  const workBook = new excel.Workbook();
  await workBook.xlsx.readFile(filePath);
  return workBook.worksheets;
}

/**
 *
 * @param {Array<string | number>} elements
 * @returns { Set<{}>}
 */
export function findDuplicateElement(elements) {
  const seen = new Set();
  const duplicates = [];
  elements.forEach((el) => {
    if (seen.has(el)) {
      duplicates.push(el);
    } else {
      seen.add(el);
    }
  });
  return duplicates;
}

/**
 *
 * @param {Array<string>} data
 * @param { string } keyName nama dari data yang tidak boleh duplikat
 */
export function isThereDuplicate(data, keyName) {
  const duplicateElement = findDuplicateElement(data);
  if (duplicateElement.length !== 0) {
    throw new HttpException(generateErrorResponse("Gagal", "conflic", `${keyName} ${duplicateElement.toString().toUpperCase()} sudah ada, gunakan ${keyName} lain`), HttpStatus.CONFLIC);
  }
}

/**
 *
 * @param { Object } object
 * @param { Model | Sequelize } model
 * @param { string } name
 * @returns { Promise<void>}
 */
export async function isCodeOrnameAlredyExist(object, model) {
  if ("name" in object && "faskes_uuid" in object) {
    const result = await model.findOne({
      where: {
        [Op.and]: [
          {
            name: {
              [Op.iLike]: `%${object.name}%`,
            },
          },
          {
            faskes_uuid: object.faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          }
        ],
      },
    });
    if (result) {
      throw new HttpException(generateErrorResponse("Gagal", "conflic", `nama ${object.name} sudah ada gunakan nama lain`), HttpStatus.CONFLIC);
    }
  } else if ("name" in object) {
    const result = await model.findOne({
      where: {
        [Op.and]: [
          {
            name: {
              [Op.iLike]: `%${object.name}%`,
            },
          },
        ],
      },
    });
    if (result) {
      throw new HttpException(generateErrorResponse("Gagal", "conflic", `nama ${object.name} sudah ada gunakan nama lain`), HttpStatus.CONFLIC);
    }
  }

  if ("code" in object && "faskes_uuid" in object) {
    const result = await model.findOne({
      where: {
        [Op.and]: [
          {
            code: {
              [Op.iLike]: `%${object.code}%`,
            },
          },
          {
            faskes_uuid: object.faskes_uuid,
          },
        ],
      },
    });
    if (result) {
      throw new HttpException(generateErrorResponse("Gagal", "conflic", `code ${object.code} sudah ada gunakan code lain`), HttpStatus.CONFLIC);
    }
  } else if ("code" in object) {
    const result = await model.findOne({
      where: {
        [Op.and]: [
          {
            code: {
              [Op.iLike]: `%${object.code}%`,
            },
          },
        ],
      },
    });
    if (result) {
      throw new HttpException(generateErrorResponse("Gagal", "conflic", `code ${object.code} sudah ada gunakan code lain`), HttpStatus.CONFLIC);
    }
  }
}

export async function isCodeUnique(object, model) {
  if ("code" in object) {
    const result = await model.findOne({
      where: {
        code: {
          [Op.iLike]: `%${object.code}%`,
        },
      },
    });
    if (result) {
      throw new HttpException(generateErrorResponse("Gagal", "conflic", `code ${object.code} sudah ada gunakan code lain`), HttpStatus.CONFLIC);
    }
  }
}

export function validateExcel(file) {
  if (!file) {
    throw new HttpException(generateErrorResponse("Gagal import", "required", "file harus di sertakan"), HttpStatus.BAD_REQUEST);
  }
  const allowExtentions = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
  if (!allowExtentions.includes(file.mimetype)) throw new HttpException(generateErrorResponse("Gagal import", "invalid", "file yang di import harus file excel"), HttpStatus.BAD_REQUEST);
}

/**
 *
 * @param {Array<string>} codes
 * @param {string | null | undefined} faskes_uuid
 * @param {Model} model
 */
export async function isCodesAlredyExist(codes, faskes_uuid, model) {
  let whereClause;
  if (faskes_uuid) {
    whereClause = {
      [Op.and]: [
        {
          code: {
            [Op.or]: codes.map((code) => ({
              [Op.iLike]: `%${code}%`,
            })),
          },
        },
        {
          faskes_uuid: faskes_uuid,
        },
      ],
    };
  } else {
    whereClause = {
      code: {
        [Op.or]: codes.map((code) => ({
          [Op.iLike]: `%${code}%`,
        })),
      },
    };
  }
  const result = await model.findAll({
    where: whereClause,
  });
  if (result.length !== 0) {
    throw new HttpException(generateErrorResponse("Gagal", "conflic", `code ${result.map((res) => res.code).toString()} sudah ada gunakan code lain`), HttpStatus.CONFLIC);
  }
}

/**
 *
 * @param {Array<string>} codeList
 * @param {string | null | undefined} faskes_uuid
 * @param {Model} model
 */
export async function isCodeAlredyExistIn(codeList, faskes_uuid, model) {
  let whereClause;
  if (faskes_uuid) {
    whereClause = {
      [Op.and]: [
        {
          faskes_uuid: faskes_uuid,
        },
        {
          code: {
            [Op.in]: codeList,
          },
        },
      ],
    };
  } else {
    whereClause = {
      code: {
        [Op.in]: codeList,
      },
    };
  }

  const result = await model.findAll({
    where: whereClause,
  });

  if (result.length !== 0) {
    throw new HttpException(generateErrorResponse("Gagal", "conflic", `code ${result.map((res) => res.code).toString()} sudah ada gunakan code lain`), HttpStatus.CONFLIC);
  }
}

/**
 * @param {Date} date
 * @returns {number}
 */
export function toEpochDate(date) {
  return Math.floor(date.getTime() / 1000.0);
}

/**
 *
 * @param {Date | string} date
 * @returns
 */
export function parseDateString(date) {
  try {
    if (date instanceof Date) {
      return date;
    } else {
      return new Date(date);
    }
  } catch (error) {
    throw (new HttpException("Gagal", "invalid", "tanggal tidak valid"), HttpStatus.BAD_REQUEST);
  }
}

/**
 *
 * @param {{province_code: string, distric_code: string, sub_distric_code: string, village_code: string}} address address
 * @returns {Promise<void>}
 */
export async function validateAddress(address) {
  const [provice, kabupaten, kecamatan, village] = await Promise.all([
    ProvinceRepository.findByCode(address.province_code),
    KabupatenRepository.findByCode(address.distric_code),
    KecamatanRepository.findByCode(address.sub_distric_code),
    KelurahanRepository.findByCode(address.village_code),
  ]);
  if (!provice) {
    throw new HttpException(generateErrorResponse("Gagal", "notfound", `kode provinsi ${address.province_code} tidak ditemukan`), HttpStatus.NOT_FOUND);
  }
  if (!kabupaten) {
    throw new HttpException(generateErrorResponse("Gagal", "notfound", `kode kebupaten ${address.distric_code} tidak ditemukan`), HttpStatus.NOT_FOUND);
  }
  if (!kecamatan) {
    throw new HttpException(generateErrorResponse("Gagal", "notfound", `kode kecamatan ${address.sub_distric_code} tidak ditemukan`), HttpStatus.NOT_FOUND);
  }
  if (!village) {
    throw new HttpException(generateErrorResponse("Gagal", "notfound", `kode desa/kelurahan ${address.village_code} tidak ditemukan`), HttpStatus.NOT_FOUND);
  }
}

/**
 *
 * @param {{faskes_uuid: string, uuid: string}} request
 * @param {OrganizationModel | LokasiStokModel} model
 */
export async function findPartOf(request, model) {
  let result;
  const attribute = ["uuid", "faskesUuid", "fullAddress", "prov", "city", "district", "rt", "rw", "village", "postalCode", "country", "createdAt", "updatedAt", "deletedAt"]
  if (model == OrganizationModel || model == PartOfOrganizationModel) {
    result = await OrganizationModel.findOne({
      where: {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid,
          },
        ],
      },
      include: [
        {
          model: AddressModel,
          required: true,
          attributes: attribute,
        },
      ],
    });
    if (!result) {
      result = await PartOfOrganizationModel.findOne({
        where: {
          [Op.and]: [
            {
              faskes_uuid: request.faskes_uuid,
            },
            {
              uuid: request.uuid,
            },
          ],
        },
        include: [
          {
            model: AddressModel,
            required: true,
            attributes: attribute
          },
        ],
      });
      if (!result) {
        throw new HttpException(generateErrorResponse("Gagal", `part_of dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
      }
      let res = result.toJSON();
      delete res.AddressModel;
      res.address = result.toJSON().AddressModel;
      return res;
    }
    let res = result.toJSON();
    delete res.AddressModel;
    res.address = result.toJSON().AddressModel;
    return res;
  } else {
    result = await LokasiModel.findOne({
      where: {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid,
          },
        ],
      },
    });
    if (!result) {
      result = await PartOfLocationModel.findOne({
        where: {
          [Op.and]: [
            {
              faskes_uuid: request.faskes_uuid,
            },
            {
              uuid: request.uuid,
            },
          ],
        },
      });
      if (!result) {
        throw new HttpException(generateErrorResponse("Gagal", `uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
      }
      return result.toJSON();
    }
    return result.toJSON();
  }
}

export function affectedRowMustBeOne(affected, action) {
  if (affected !== 1) {
    throw new HttpException(generateErrorResponse("Gagal", "internal server error", `gagal ${action}`), HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 *
 * @param {string | Array<string>} uuid
 * @param {Model} model
 * @param {string} action
 */
export async function isUuidExist(uuid, model, name) {
  let whereClause;
  if (uuid instanceof Array) {
    whereClause = {
      [Op.and]: [
        {
          uuid: {
            [Op.in]: uuid,
          },
        },
        {
          deletedAt: {
            [Op.is]: null,
          },
        },
      ],
    };
  } else {
    whereClause = {
      [Op.and]: [
        {
          uuid: uuid,
        },
        {
          deletedAt: {
            [Op.is]: null,
          },
        },
      ],
    };
  }
  const result = await model.findAll({where: whereClause});
  if (result.length < 0) {
    throw new HttpException(generateErrorResponse("Gagal", "notfound", `uuid ${name} ${uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
  }
  return result.map(r => r.toJSON());
}
