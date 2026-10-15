import PractitionerValidation from "../validations/practitioner-validation.js";
import ZodValidator from "../validations/validator.js";
import successResponse from "../response/result-response.js";
import PractitionerRepository from "../repositories/practitioner-repository.js";
import { messageSuccessExport } from "../validations/message-validation-error.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../helpers/generate-message.js";
import LokasiRepository from "../repositories/lokasi-repository.js";
import { PegawaiModel } from "@opensimrs/model-sdk/datamaster";
import { affectedRowMustBeOne } from "../helpers/helper.js";
import PegawaiRepository from "../repositories/pegawai-repository.js";
import { GlobalValidation } from "../validations/global-validation.js";
import { PartOfLocationRepository } from "../repositories/part-of-location-repository.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import { barisData, lemparFileKosong, lemparGalatImport, pesanZod, teks } from "../helpers/excel-import.js";

const labelKolom = { nik: "NIK", code_bpjs: "kode HFIS", code_antrian_dokter: "kode antrian" };

export default class PractitionerService {
  /**
   *
   * @param {*} data
   * @returns
   */
  static async createPractitioner(data) {
    data.uuid = uuidv7();
    ZodValidator.validate(PractitionerValidation.CREATE_DOKTER, data);
    const [isPractitioenrExist, isPegawaiExist] = await Promise.all([
      PractitionerRepository.findByBpjsCode(data.code_bpjs, data.faskes_uuid),
      PegawaiRepository.findByUuid({
        faskes_uuid: data.faskes_uuid,
        uuid: data.pegawai_uuid,
      }),
    ]);
    if (isPractitioenrExist)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "conflic",
          `practisioner dengan kode bpjs ${data.code_bpjs} sudah terdaftar`
        ),
        HttpStatus.CONFLIC
      );
    if (!isPegawaiExist)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `pegawai dengan uuid ${data.pegawai_uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );

    const lokasiUuidList = data.poli_pelayanan.map((p) => p.lokasi_uuid);
    let [masterLokasi, partOfLokasi] = await Promise.all([
      LokasiRepository.findAllByUuidIn(lokasiUuidList, data.faskes_uuid),
      PartOfLocationRepository.findAllByUuidIn(
        lokasiUuidList,
        data.faskes_uuid
      ),
    ]);

    lokasiUuidList.forEach((l, index) => {
      let isExist = masterLokasi.find((m) => m.uuid == l);
      if (!isExist) {
        isExist = partOfLokasi.find((prl) => prl.uuid == l);
        if (!isExist) {
          throw new HttpException(
            generateErrorResponse(
              "Gagal",
              "notfound",
              `lokasi_uuid ${l} tidak ditemukan`
            ),
            HttpStatus.NOT_FOUND
          );
        }
        data.poli_pelayanan[index].name = isExist.name;
      }
      data.poli_pelayanan[index].name = isExist.name;
    });
    data.poli_pelayanan = JSON.stringify(data.poli_pelayanan);
    await sequelizeInstance.transaction(async (tr) => {
      await Promise.all([PractitionerRepository.save(tr, data)]);
    });
    return generateSuccessResponse(`Berhasil menambahkan practitioner`);
  }

  /**
   *
   * @param {*} data
   * @returns
   */
  // Poli tugas non-dokter (opsional) → JSON [{lokasi_uuid, name}] dengan nama dari master lokasi.
  static async poliTugasNonDokter(poli, faskesUuid) {
    if (!Array.isArray(poli) || poli.length === 0) return "[]";
    const uuids = poli.map((p) => p.lokasi_uuid);
    const [masterLokasi, partOfLokasi] = await Promise.all([
      LokasiRepository.findAllByUuidIn(uuids, faskesUuid),
      PartOfLocationRepository.findAllByUuidIn(uuids, faskesUuid),
    ]);
    return JSON.stringify(
      uuids.map((uuid) => {
        const lokasi = masterLokasi.find((m) => m.uuid == uuid) ?? partOfLokasi.find((m) => m.uuid == uuid);
        if (!lokasi)
          throw new HttpException(
            generateErrorResponse("Gagal", "notfound", `lokasi_uuid ${uuid} tidak ditemukan`),
            HttpStatus.NOT_FOUND
          );
        return { lokasi_uuid: uuid, name: lokasi.name };
      })
    );
  }

  static async createPractitionerNonDoctor(data) {
    ZodValidator.validate(PractitionerValidation.CREATE_NON_DOKTER, data);
    const pegawai = await PegawaiRepository.findByUuid(
      { faskes_uuid: data.faskes_uuid, uuid: data.pegawai_uuid },
      PegawaiModel
    );
    if (!pegawai) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `pegawai_uuid ${data.pegawai_uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    data.poli_pelayanan = await this.poliTugasNonDokter(data.poli_pelayanan, data.faskes_uuid);
    await sequelizeInstance.transaction(async (tr) => {
      await PractitionerRepository.save(tr, data);
    });
    return generateSuccessResponse("Berhasil menambahkan praktisioner");
  }

  /**
   *
   * @param {*} request
   * @returns
   */
  static async updatePractitioner(request) {
    console.log("update dokter", request);
    ZodValidator.validate(PractitionerValidation.UPDATE_DOKTER, request);
    const [practitioner, pegawai] = await Promise.all([
      PractitionerRepository.findByUuidIncludePractitionerPoli({
        uuid: request.uuid,
        faskes_uuid: request.faskes_uuid,
      }),
      PegawaiRepository.findByUuid(
        { faskes_uuid: request.faskes_uuid, uuid: request.pegawai_uuid },
        PegawaiModel
      ),
    ]);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    if (!pegawai)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `pegawai dengan uuid ${request.pegawai_uuid} tiidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    const lokasiUuidList = request.poli_pelayanan.map((p) => p.lokasi_uuid);

    let [masterLokasi, partOfLokasi] = await Promise.all([
      LokasiRepository.findAllByUuidIn(lokasiUuidList, request.faskes_uuid),
      PartOfLocationRepository.findAllByUuidIn(
        lokasiUuidList,
        request.faskes_uuid
      ),
    ]);

    lokasiUuidList.forEach((l, index) => {
      let isExist = masterLokasi.find((m) => m.uuid == l);
      if (!isExist) {
        isExist = partOfLokasi.find((prl) => prl.uuid == l);
        if (!isExist) {
          throw new HttpException(
            generateErrorResponse(
              "Gagal",
              "notfound",
              `lokasi_uuid ${l} tidak ditemukan`
            ),
            HttpStatus.NOT_FOUND
          );
        }
        request.poli_pelayanan[index].name = isExist.name;
      }
      request.poli_pelayanan[index].name = isExist.name;
    });
    request.poli_pelayanan = JSON.stringify(request.poli_pelayanan);
    await sequelizeInstance.transaction(async (tr) => {
      affectedRowMustBeOne(await PractitionerRepository.update(request, tr));
    });
    return generateSuccessResponse("Berhasil update practisioner");
  }

  /**
   *
   * @param {*} updateRequest
   * @returns
   */
  static async updatePractitionerNonDokter(updateRequest) {
    ZodValidator.validate(
      PractitionerValidation.UPDATE_NON_DOKTER,
      updateRequest
    );
    const { uuid, faskes_uuid } = updateRequest;
    const practitioner = await PractitionerRepository.findByUuid({
      faskes_uuid,
      uuid,
    });
    if (!practitioner) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practisioner dengan uuid ${updateRequest.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    await sequelizeInstance.transaction(async (tr) => {
      console.log({ ...practitioner, ...updateRequest });
      const affected = await PractitionerRepository.update(
        {
          ...practitioner,
          ...updateRequest,
          poli_pelayanan: await PractitionerService.poliTugasNonDokter(updateRequest.poli_pelayanan, faskes_uuid),
        },
        tr
      );
      if (affected !== 1) {
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "internal server error",
            "gagal update practisioner non dokter"
          ),
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      console.log(affected);
    });
    return generateSuccessResponse("Berhasil update practisioner non dokter");
  }

  static async getAllPractitioner(request) {
    const { data, properties } = await PractitionerRepository.findAll(request);
    return generateSuccessResponse(
      "Berhasil menampilkan semua praktisioner",
      data,
      properties
    );
  }

  static mapPoli = (poli, lokasi) => {
    return poli.map((p) => {
      const lokasiInfo = lokasi.find((l) => l.uuid === p.lokasi_uuid);
      return {
        uuid: p.uuid,
        lokasi_uuid: p.lokasi_uuid,
        lokasi_name: lokasiInfo ? lokasiInfo.name : null,
      };
    });
  };

  static paginateResults(result, page, pageSize) {
    const totalItems = result.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = page * pageSize;
    const paginatedResult = result.slice(startIndex, endIndex);
    const paginationInfo = { page, page_size: pageSize, total: totalItems };

    return { paginatedResult, paginationInfo };
  }

  static async exportPractitioner(faskes_uuid) {
    const result = await PractitionerRepository.exportPractitioner(faskes_uuid);
    return successResponse(messageSuccessExport, result);
  }

  // Kolom template (frontend "Format Datamaster Praktisi"): No | NIK Pegawai* | Nama Pegawai (keterangan) |
  // Tipe Praktisi* (Dokter/Non-Dokter) | Kode HFIS (BPJS) | SIP | STR | Kode Antrian Dokter | Poli Pelayanan
  // (nama poli, pisahkan dengan ;). Kode HFIS, kode antrian, dan poli wajib untuk dokter.
  static async importPractitioner(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    const baris = barisData(data[0]?.data);
    if (baris.length === 0) lemparFileKosong("praktisi");

    const galat = [];
    const daftar = baris.map(({ nomor, sel }) => {
      const tipe = (teks(sel[3]) ?? "").toLowerCase().replace(/\s+/g, "-");
      const is_doctor = tipe === "dokter" ? true : tipe === "non-dokter" ? false : undefined;
      if (is_doctor === undefined) galat.push(`baris ${nomor}: tipe praktisi harus Dokter atau Non-Dokter`);
      return {
        nomor,
        nik: teks(sel[1]),
        is_doctor,
        code_bpjs: teks(sel[4]),
        sip: teks(sel[5]) ?? null,
        str: teks(sel[6]) ?? null,
        code_antrian_dokter: teks(sel[7]),
        poli: (teks(sel[8]) ?? "").split(";").map((p) => p.trim()).filter((p) => p !== ""),
      };
    });

    // rujukan ke master: pegawai (NIK), praktisi yang sudah ada, kode bentrok, dan poli (lokasi/sub-lokasi)
    const nikList = [...new Set(daftar.map((d) => d.nik).filter(Boolean))];
    const namaPoli = [...new Set(daftar.flatMap((d) => d.poli))];
    const kodeBpjs = daftar.map((d) => d.code_bpjs).filter(Boolean);
    const kodeAntrian = daftar.map((d) => d.code_antrian_dokter).filter(Boolean);
    const [pegawaiList, kodeTerpakai, lokasiList, subLokasiList] = await Promise.all([
      nikList.length ? PegawaiRepository.findAllByNikIn(nikList, faskesUuid) : [],
      PractitionerRepository.findAllByKodeIn({ code_bpjs: kodeBpjs, code_antrian_dokter: kodeAntrian }, faskesUuid),
      namaPoli.length ? LokasiRepository.findAllAktifByNameInsensitive(namaPoli, faskesUuid) : [],
      namaPoli.length ? PartOfLocationRepository.findAllAktifByNameInsensitive(namaPoli, faskesUuid) : [],
    ]);
    const praktisiTerdaftar = pegawaiList.length
      ? await PractitionerRepository.findAllByPegawaiUuidIn(pegawaiList.map((p) => p.uuid), faskesUuid)
      : [];
    const poliMap = new Map([...subLokasiList, ...lokasiList].map((l) => [l.name.toLowerCase(), l]));

    const dipakai = { nik: new Map(), code_bpjs: new Map(), code_antrian_dokter: new Map() };
    const practitionerList = [];
    for (const d of daftar) {
      const { nomor } = d;
      const galatSebelum = galat.length;
      if (d.is_doctor) {
        if (!d.code_bpjs) galat.push(`baris ${nomor}: kode HFIS (BPJS) wajib diisi untuk dokter`);
        if (!d.code_antrian_dokter) galat.push(`baris ${nomor}: kode antrian dokter wajib diisi untuk dokter`);
        if (d.poli.length === 0) galat.push(`baris ${nomor}: poli pelayanan wajib diisi untuk dokter`);
      }
      for (const kunci of ["nik", "code_bpjs", "code_antrian_dokter"]) {
        if (!d[kunci]) continue;
        if (dipakai[kunci].has(d[kunci])) galat.push(`baris ${nomor}: ${labelKolom[kunci]} ${d[kunci]} sama dengan baris ${dipakai[kunci].get(d[kunci])}`);
        else dipakai[kunci].set(d[kunci], nomor);
      }
      if (kodeTerpakai.some((k) => d.code_bpjs && k.code_bpjs === d.code_bpjs))
        galat.push(`baris ${nomor}: kode HFIS ${d.code_bpjs} sudah dipakai praktisi lain`);
      if (kodeTerpakai.some((k) => d.code_antrian_dokter && k.code_antrian_dokter === d.code_antrian_dokter))
        galat.push(`baris ${nomor}: kode antrian ${d.code_antrian_dokter} sudah dipakai praktisi lain`);

      const pegawai = pegawaiList.find((p) => p.nik === d.nik);
      if (!d.nik) galat.push(`baris ${nomor}: NIK pegawai tidak boleh kosong`);
      else if (!pegawai) galat.push(`baris ${nomor}: pegawai dengan NIK ${d.nik} belum terdaftar, import/tambah pegawai terlebih dahulu`);
      else if (praktisiTerdaftar.some((p) => p.pegawai_uuid === pegawai.uuid))
        galat.push(`baris ${nomor}: pegawai ${pegawai.name} (NIK ${d.nik}) sudah terdaftar sebagai praktisi`);

      const poli = [];
      for (const nama of d.poli) {
        const lokasi = poliMap.get(nama.toLowerCase());
        if (lokasi) poli.push({ lokasi_uuid: lokasi.uuid, name: lokasi.name });
        else galat.push(`baris ${nomor}: poli "${nama}" tidak ditemukan di master lokasi`);
      }
      if (d.is_doctor === undefined || !pegawai) continue;

      const practitioner = {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        pegawai_uuid: pegawai.uuid,
        is_doctor: d.is_doctor,
        code_bpjs: d.code_bpjs,
        sip: d.sip,
        str: d.str,
        code_antrian_dokter: d.code_antrian_dokter,
        poli_pelayanan: poli,
        status: true,
      };
      // validasi skema hanya untuk baris yang lolos pengecekan di atas, agar pesan tidak ganda
      const skema = d.is_doctor ? PractitionerValidation.CREATE_DOKTER : PractitionerValidation.CREATE_NON_DOKTER;
      const hasil = galat.length === galatSebelum ? skema.safeParse(practitioner) : { success: true };
      if (!hasil.success) pesanZod(hasil.error).forEach((p) => galat.push(`baris ${nomor}: ${p}`));
      practitionerList.push({ ...practitioner, poli_pelayanan: JSON.stringify(poli) });
    }

    lemparGalatImport(galat);
    await sequelizeInstance.transaction(async (tr) => {
      await PractitionerRepository.saveAll(practitionerList, tr);
    });
    return generateSuccessResponse(`Berhasil import ${practitionerList.length} praktisi`);
  }

  static async getAllPractitionerAktif(request) {
    const result = await PractitionerRepository.getAllPractitionerAktif(
      request
    );
    return generateSuccessResponse(
      "Berhasil menampilkan practitioner aktif",
      result
    );
  }

  static async getAllPractitionerAktifByPoli(request) {
    const result = await PractitionerRepository.getAllPractitionerAktifByPoli(
      request
    );
    if (!result) {
      generateErrorResponse(
        "Gagal",
        "notfound",
        "practitioner tidak ditemukan"
      ),
        HttpStatus.NOT_FOUND;
    }
    return generateSuccessResponse("Berhasil menampilkan practitioner", result);
  }

  static async getPractitionerById(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const practitioner = await PractitionerRepository.findByUuid(request);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    return generateSuccessResponse(
      "Berhasil menampilkan practitioner",
      practitioner
    );
  }

  static async deletePractitioner(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const practitioner = await PractitionerRepository.findByUuid(request);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    await sequelizeInstance.transaction(async (tr) => {
      affectedRowMustBeOne(await PractitionerRepository.delete(practitioner));
    });
    return generateSuccessResponse(`Berhasil menghapus practitioner`);
  }

  static async findPractitionerByCodeAntrianByFaskes(req) {
    const practitioner =
      await PractitionerRepository.findPractitionerByCodeAntrianByFaskes(req);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    return generateSuccessResponse(
      "Berhasil menampilkan practitioner",
      practitioner
    );
  }
}
