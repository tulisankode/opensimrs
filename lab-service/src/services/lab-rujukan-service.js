import sequelizeInstance from "@opensimrs/model-sdk/instance";
import ConflictException from "../exception/conflict-exception.js";
import NotfoundException from "../exception/notfound-exception.js";
import LabRujukanRepository from "../repositories/lab-rujukan-repository.js";
import LabRujukanValidation from "../validations/lab-rujukan-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import extractExcel from "../helpers/extract-excel.js";
import checkDuplicate from "../helpers/check-duplicate.js";

export default class LabRujukanService {
  static async create(req) {
    const validData = ZodValidator.validate(LabRujukanValidation.CREATE, req);

    const isLabRujukanExist = await LabRujukanRepository.findByCode(
      validData.code,
      validData.faskes_uuid
    );

    if (isLabRujukanExist) {
      throw new ConflictException("Kode sudah ada");
    }

    return await LabRujukanRepository.create(validData);
  }

  static async update(uuid, req) {
    const validData = ZodValidator.validate(LabRujukanValidation.UPDATE, req);
    const isLabRujukanExist = await LabRujukanRepository.findByUuid(uuid);

    if (!isLabRujukanExist) {
      throw new NotfoundException("Laboratorium Rujukan not found");
    }

    const isCodeExist = await LabRujukanRepository.findByCodeWithoutItself(
      uuid,
      validData
    );

    if (isCodeExist) {
      throw new ConflictException("Kode sudah ada");
    }

    return await LabRujukanRepository.update(uuid, validData);
  }

  static async delete(uuid) {
    const isLabRujukanExist = await LabRujukanRepository.findByUuid(uuid);

    if (!isLabRujukanExist) {
      throw new NotfoundException("Laboratorium Rujukan not found");
    }

    return await LabRujukanRepository.delete(uuid);
  }

  static async show(uuid) {
    const labRujukan = await LabRujukanRepository.findByUuid(uuid);

    if (!labRujukan) {
      throw new NotfoundException("Laboratorium Rujukan not found");
    }

    return labRujukan;
  }

  static async getAll(req) {
    return await LabRujukanRepository.findAll(req);
  }

  static async getAllActive(req) {
    return await LabRujukanRepository.findAllActive(req);
  }

  static async import(path, faskes_uuid) {
    const data = [];

    const workSheet = await extractExcel(path);

    workSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      data.push({
        code: row.values[2],
        name: row.values[3],
        alamat: row.values[4] ?? null,
        telepon: row.values[5] ?? null,
        kontak_person: row.values[6] ?? null,
        status: true,
        faskes_uuid: faskes_uuid,
      });
    });

    checkDuplicate(data);

    data.map((item) => {
      ZodValidator.validate(LabRujukanValidation.CREATE, item);
    });

    await sequelizeInstance.transaction(async (t) => {
      await LabRujukanRepository.bulkCreate(data, t);
    });
  }
}
