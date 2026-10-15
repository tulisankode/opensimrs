import { LokasiModel, PractitionerModel } from "@opensimrs/model-sdk/datamaster";
import { JadwalDokterModel } from "@opensimrs/model-sdk/antrian";
import { RawatJalanModel } from "@opensimrs/model-sdk/pelayanan";
import AntrianModel from "./antrian.model.js";
import LayarAntrianModel from "./layar-antrian.model.js";
import LayarAntrianPoliModel from "./layar-antrian-poli.model.js";

let associationsDefined = false;

export function defineAssociations() {
  if (associationsDefined) return;
  associationsDefined = true;

  AntrianModel.belongsTo(RawatJalanModel, {
    foreignKey: "rawat_jalan_uuid",
    targetKey: "uuid",
    as: "patient_data",
    constraints: false,
  });

  // model-sdk hanya mendefinisikan JadwalDokter.belongsTo(Practitioner); jadwal-dokter.repository
  // melakukan query dari arah Practitioner → jadwal_dokter sehingga butuh relasi kebalikannya.
  if (!PractitionerModel.associations.jadwal_dokter) {
    PractitionerModel.hasMany(JadwalDokterModel, {
      foreignKey: "practitioner_uuid",
      sourceKey: "uuid",
      as: "jadwal_dokter",
      constraints: false,
    });
  }

  LayarAntrianModel.belongsToMany(LokasiModel, {
    through: LayarAntrianPoliModel,
    foreignKey: "layarAntrianUuid",
    otherKey: "lokasiUuid",
    as: "location",
    constraints: false,
  });

  LokasiModel.belongsToMany(LayarAntrianModel, {
    through: LayarAntrianPoliModel,
    foreignKey: "lokasiUuid",
    otherKey: "layarAntrianUuid",
    as: "layar_antrian",
    constraints: false,
  });
}

export { AntrianModel, LayarAntrianModel, LayarAntrianPoliModel };
