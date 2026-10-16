import ObservationItemRepository, {
  STATUS_RUJUKAN,
} from "../repositories/observation-item-repository.js";
import LabRujukanRepository from "../repositories/lab-rujukan-repository.js";
import RujukanValidation from "../validations/rujukan-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import NotfoundException from "../exception/notfound-exception.js";
import BadRequestException from "../exception/bad-request-exception.js";
import ConflictException from "../exception/conflict-exception.js";
import { status as orderLabStatus } from "./order-lab-service.js";
import fiturAktif from "../helpers/fitur-aktif.js";

export default class RujukanService {
  static async tandai(uuid, req, token) {
    const validData = ZodValidator.validate(RujukanValidation.TANDAI, req);

    // fail-open: null (setting-service tak terjangkau) tetap diizinkan, hanya ditolak bila eksplisit nonaktif.
    const aktif = await fiturAktif("lab_rujukan", token);
    if (aktif === false) {
      throw new BadRequestException("Fitur Lab Rujukan belum diaktifkan untuk faskes ini");
    }

    const observationItem = await ObservationItemRepository.findByUuidFaskes(
      uuid,
      validData.faskes_uuid
    );

    if (!observationItem) {
      throw new NotfoundException("Observation Item tidak ditemukan");
    }

    if (observationItem.order_lab?.order_status !== orderLabStatus.PERIKSA) {
      throw new BadRequestException("Order Lab belum diperiksa");
    }

    const labRujukan = await LabRujukanRepository.findByUuidFaskes(
      validData.lab_rujukan_uuid,
      validData.faskes_uuid
    );

    if (!labRujukan || !labRujukan.status) {
      throw new NotfoundException(
        "Laboratorium Rujukan tidak ditemukan atau tidak aktif"
      );
    }

    return await ObservationItemRepository.tandaiRujukan(
      uuid,
      validData.faskes_uuid,
      validData
    );
  }

  static async batal(uuid, faskes_uuid) {
    const observationItem = await ObservationItemRepository.findByUuidFaskes(
      uuid,
      faskes_uuid
    );

    if (!observationItem || !observationItem.dirujuk) {
      throw new NotfoundException("Item rujukan tidak ditemukan");
    }

    if (observationItem.status_rujukan !== STATUS_RUJUKAN.BELUM_DIKIRIM) {
      throw new ConflictException(
        "Item yang sudah dikirim/diterima hasilnya tidak dapat dibatalkan penandaannya"
      );
    }

    return await ObservationItemRepository.batalRujukan(uuid, faskes_uuid);
  }

  static async kirim(uuid, faskes_uuid) {
    const observationItem = await ObservationItemRepository.findByUuidFaskes(
      uuid,
      faskes_uuid
    );

    if (!observationItem || !observationItem.dirujuk) {
      throw new NotfoundException("Item rujukan tidak ditemukan");
    }

    if (observationItem.status_rujukan !== STATUS_RUJUKAN.BELUM_DIKIRIM) {
      throw new ConflictException(
        "Item rujukan hanya dapat dikirim dari status Belum Dikirim"
      );
    }

    return await ObservationItemRepository.kirimRujukan(uuid, faskes_uuid);
  }

  static async unggahBerkas(uuid, faskes_uuid, file) {
    if (!file) {
      throw new BadRequestException("Berkas harus diisi");
    }

    const observationItem = await ObservationItemRepository.findByUuidFaskes(
      uuid,
      faskes_uuid
    );

    if (!observationItem || !observationItem.dirujuk) {
      throw new NotfoundException("Item rujukan tidak ditemukan");
    }

    return await ObservationItemRepository.simpanBerkasRujukan(
      uuid,
      faskes_uuid,
      {
        data: file.buffer,
        name: file.originalname,
        tipe: file.mimetype,
      }
    );
  }

  static async unduhBerkas(uuid, faskes_uuid) {
    const observationItem = await ObservationItemRepository.findBerkasRujukan(
      uuid,
      faskes_uuid
    );

    if (!observationItem || !observationItem.berkas_hasil_rujukan) {
      throw new NotfoundException("Berkas rujukan tidak ditemukan");
    }

    return {
      nama: observationItem.berkas_hasil_rujukan_info?.name,
      tipe: observationItem.berkas_hasil_rujukan_info?.tipe,
      data: observationItem.berkas_hasil_rujukan.toString("base64"),
    };
  }

  static async hapusBerkas(uuid, faskes_uuid) {
    const observationItem = await ObservationItemRepository.findBerkasRujukan(
      uuid,
      faskes_uuid
    );

    if (!observationItem || !observationItem.berkas_hasil_rujukan) {
      throw new NotfoundException("Berkas rujukan tidak ditemukan");
    }

    return await ObservationItemRepository.hapusBerkasRujukan(uuid, faskes_uuid);
  }
}
