import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import { convertDateFormat, parseDateString } from "../helpers/date-parsing.js";
import PegawaiRepository from "../repositories/pegawai-repository.js";
import PegawaiValidation from "../validations/pegawai-validation.js";
import {
  messageErrorConflict,
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorEdit,
  messageErrorIdNotFound,
  messageErrorSave,
  messageErrorShow,
  messageErrorUuidNotValid,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessExport,
  messageSuccessImport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import Utils from "../helpers/utils.js";
import NotFoundException from "../errors/notfound-exception.js";
import BadRequestException from "../errors/bad_request-exception.js";
import ConflictException from "../errors/conflict-exception.js";
import Result from "../response/result.js";
import { ZodError } from "zod";
import { error } from "console";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { barisData, lemparFileKosong, lemparGalatImport, pesanZod, tanggalExcel, teks } from "../helpers/excel-import.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
export default class PegawaiService {

  static async createPegawai(data) {
    const tanggal_lahir = parseDateString(data.tanggal_lahir);
    data.tanggal_lahir = tanggal_lahir;
    ZodValidator.validate(PegawaiValidation.CREATE, data);
    const isExist = await PegawaiRepository.findPegawaiByNIK(data.nik, data.faskes_uuid);
    if(isExist){
      throw new HttpException(
        generateErrorResponse("Gagal", 'conflic', `nik ${data.nik} sudah terdaftar sebagai pegawai`), HttpStatus.CONFLIC
      )
    }
    await PegawaiRepository.addPegawai(data);
    return successResponse(messageSuccessSave);
  }

  static async updatePegawai(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    if (data.tanggal_lahir) {
      const tanggal_lahir = parseDateString(data.tanggal_lahir);
      data.tanggal_lahir = tanggal_lahir;
    }

    const validationResult = ZodValidator.validate(
      PegawaiValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingPegawai = await PegawaiRepository.findPegawaiById(uuid);
    if (!existingPegawai) {
      throw new NotFoundException(messageErrorEdit, messageErrorIdNotFound);
    }

    if (data.nik) {
      if (data.nik != existingPegawai.nik) {
        const existingNikPegawai = await PegawaiRepository.findPegawaiByNIK(data.nik, data.faskes_uuid);
        if (existingNikPegawai) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await PegawaiRepository.updatePegawai(existingPegawai, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllPegawai(name, type, page, pageSize, order_by, faskes_uuid) {
    const result = await PegawaiRepository.getAllPegawai(name, parseInt(type), parseInt(page) || 1, parseInt(pageSize) || 10, order_by, faskes_uuid);
    const data = result.pegawaiList.map((pegawai) => {
      const updatedPegawai = { ...pegawai.dataValues };
      updatedPegawai.tanggal_lahir = convertDateFormat(
        updatedPegawai.tanggal_lahir
      );

      return updatedPegawai;
    });

    return Result.responseWithPaginate(
      messageSuccessShow,
      {
        page: result.paginationInfo.currentPage,
        page_size: result.paginationInfo.limit,
        total: result.totalItems,
      },
      data
    );
  }

  static async getAllPegawaiAktif(request) {
    const result = await PegawaiRepository.getAllPegawaiAktif(request);
    const data = this.convertAllPegawaiDates(result);
    return Result.responseMessagePayload(messageSuccessShow, data);
  }

  static async getPegawaiByUuid(uuid) {
    const result = await PegawaiRepository.findPegawaiByUuid(uuid);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getPegawaiByName(name) {
    const result = await PegawaiRepository.findPegawaiName(name);
    if (!result) {
      throw new NotFoundException(
        "Pegawai tidak ditemukan atau belum terdaftar",
        messageErrorDataNotFound
      );
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getPegawaiById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }
    const pegawai = await PegawaiRepository.findPegawaiById(uuid);
    if (!pegawai) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    const dataPegawai = { ...pegawai.dataValues };
    const tanggal_lahir = convertDateFormat(dataPegawai.tanggal_lahir);
    dataPegawai.tanggal_lahir = tanggal_lahir;

    return Result.responseMessagePayload(messageSuccessShow, dataPegawai);
  }

  static async exportPegawai(faskes_uuid) {
    const result = await PegawaiRepository.exportPegawai(faskes_uuid);
    return generateSuccessResponse("Berhasil export pegawai", result);
  }

  // Kolom template (frontend "Format Datamaster Pegawai"): No | Tipe Pegawai* | Gelar Awal | Nama Pegawai* |
  // Gelar Akhir | NIK* | Tanggal Lahir* (DD-MM-YYYY) | Jenis Kelamin*
  static async importPegawai(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    const baris = barisData(data[0]?.data);
    if (baris.length === 0) lemparFileKosong("pegawai");

    const tipeMap = { nakes: 1, "non-nakes": 2, "non nakes": 2, nonnakes: 2 };
    const genderMap = {
      "laki-laki": "Laki-laki", "laki laki": "Laki-laki", l: "Laki-laki", pria: "Laki-laki",
      perempuan: "Perempuan", p: "Perempuan", wanita: "Perempuan",
    };
    const galat = [];
    const pegawaiList = [];
    for (const { nomor, sel } of baris) {
      const tipe = tipeMap[(teks(sel[1]) ?? "").toLowerCase()];
      if (!tipe) galat.push(`baris ${nomor}: tipe pegawai harus Nakes atau Non-Nakes`);
      const gender = genderMap[(teks(sel[7]) ?? "").toLowerCase()];
      if (!gender) galat.push(`baris ${nomor}: jenis kelamin harus Laki-laki atau Perempuan`);
      let tanggal_lahir;
      try {
        tanggal_lahir = parseDateString(tanggalExcel(sel[6]));
      } catch {
        galat.push(`baris ${nomor}: tanggal lahir harus berformat DD-MM-YYYY`);
      }
      const pegawai = {
        faskes_uuid: faskesUuid,
        tipe,
        first_title: teks(sel[2]) ?? null,
        name: teks(sel[3]),
        last_title: teks(sel[4]) ?? null,
        nik: teks(sel[5]),
        tanggal_lahir,
        gender,
        status: true,
      };
      if (tipe && gender && tanggal_lahir) {
        const hasil = PegawaiValidation.CREATE.safeParse(pegawai);
        if (!hasil.success) pesanZod(hasil.error).forEach((p) => galat.push(`baris ${nomor}: ${p}`));
      }
      pegawaiList.push({ nomor, pegawai });
    }

    // NIK ganda di dalam file maupun yang sudah terdaftar di faskes ini
    const nikBaris = new Map();
    for (const { nomor, pegawai } of pegawaiList) {
      if (!pegawai.nik) continue;
      if (nikBaris.has(pegawai.nik)) galat.push(`baris ${nomor}: NIK ${pegawai.nik} sama dengan baris ${nikBaris.get(pegawai.nik)}`);
      else nikBaris.set(pegawai.nik, nomor);
    }
    const terdaftar = await PegawaiRepository.findAllByNikIn([...nikBaris.keys()], faskesUuid);
    for (const p of terdaftar) galat.push(`baris ${nikBaris.get(p.nik)}: NIK ${p.nik} sudah terdaftar sebagai pegawai (${p.name})`);

    lemparGalatImport(galat);
    await PegawaiRepository.saveAll(pegawaiList.map((p) => p.pegawai));
    return generateSuccessResponse(`Berhasil import ${pegawaiList.length} pegawai`);
  }

  static async deletePegawai(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorDelete);
    }

    const existingPegawai = await PegawaiRepository.findPegawaiById(uuid);
    if (!existingPegawai) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await PegawaiRepository.deletePegawai(existingPegawai);
    return successResponse(messageSuccessDelete);
  }

  static convertAllPegawaiDates(pegawaiList) {
    return pegawaiList.map((pegawai) => {
      // Membuat salinan objek pegawai untuk menghindari mutasi objek asli
      const updatedPegawai = { ...pegawai.dataValues };

      // Mengonversi tanggal lahir
      updatedPegawai.tanggal_lahir = convertDateFormat(
        updatedPegawai.tanggal_lahir
      );

      return updatedPegawai;
    });
  }
}
