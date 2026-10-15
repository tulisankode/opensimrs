import KonfigurasiHargaRepository from "../repositories/konfigurasi-harga-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import ZodValidator from "../validations/zod-validator.js";
import KonfigurasiHargaValidation from "../validations/konfigurasi-harga-validation.js";
import {toEpochDate} from "../helpers/date-helper.js";
import BadRequestException from "../errors/bad-request-exception.js";

export default class KonfigurasiHargaService {
  static async get(req) {
    let validData = ZodValidator.validate(KonfigurasiHargaValidation.GET, req);
    let data = await KonfigurasiHargaRepository.get(validData.faskes_uuid);
    if (data === null) {
      data = await KonfigurasiHargaRepository.create({
        faskes_uuid: req.faskes_uuid,
      });
    }

    return data;
  }

  static async getHargaItem(req) {
    let data = await KonfigurasiHargaRepository.getHargaItem(req.faskes_uuid);

    return data;
  }

  static async getHargaItemByUuid(uuid) {
    const hargaItem = await KonfigurasiHargaRepository.getHargaItemByUuid(uuid);
    if (hargaItem === null) {
      throw new BadRequestException("data tidak ditemukan");
    }

    return hargaItem;
  }

  static async update(req) {
    let validData = ZodValidator.validate(
      KonfigurasiHargaValidation.UPDATE,
      req
    );
    validData.updated_at = toEpochDate(new Date());
    const affectedRow = await KonfigurasiHargaRepository.update(validData);
    if (affectedRow === 0)
      throw new NotfoundException("gagal mengupdate konfigurasi");
    return { message: `berhasil mengupdate konfigurasi harga` };
  }
}