import ReportAntrianModel from "../models/report-antrian.model.js";
import { Op } from "sequelize";

export class ReportAntrianRepository {
  static async findOrCreateReport({
    jadwalDokter,
    tanggalPelayanan,
    transaction,
  }) {
    const [report, created] = await ReportAntrianModel.findOrCreate({
      where: {
        jadwalDokterUuid: jadwalDokter.uuid,
        tanggalPelayanan: tanggalPelayanan,
      },
      defaults: {
        faskesUuid: jadwalDokter.faskesUuid,
        practitionerName: jadwalDokter.practitioner.pegawai.name,
        locationName: jadwalDokter.lokasi.name,
        kuota: jadwalDokter.kuota,
        kuotaJkn: jadwalDokter.kuotaJkn,
        kuotaNonJkn: jadwalDokter.kuotaNonJkn,
        noAntrianTerakhir: 0,
        jumlahJknAktif: 0,
        jumlahNonJknAktif: 0,
      },
      transaction,
    });
    return report;
  }

  static async countBookedSchedules({ jadwalDokterUuids, transaction }) {
    const count = await ReportAntrianModel.count({
      where: {
        jadwalDokterUuid: {
          [Op.in]: jadwalDokterUuids,
        },
        [Op.or]: [
          { jumlahJknAktif: { [Op.gt]: 0 } },
          { jumlahNonJknAktif: { [Op.gt]: 0 } },
        ],
        deletedAt: null,
      },
      transaction,
    });
    return count;
  }

  static async findReportByJadwalAndDate(
    jadwalDokterUuid,
    tanggalPelayanan,
    { transaction } = {}
  ) {
    const report = await ReportAntrianModel.findOne({
      where: {
        jadwalDokterUuid,
        tanggalPelayanan,
      },
      transaction,
    });
    return report;
  }
}
