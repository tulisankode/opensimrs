import Faskes from "../models/faskes-model.js";
import SNOMED from "../models/snomed-model.js";
import LOINC from "../models/loinc-model.js";
import ICD9 from "../models/icd9-model.js";
import Organization from "../models/organization-model.js";
import Lokasi from "../models/lokasi-model.js";
import Penjamin from "../models/penjamin-model.js";
import Diagnosis from "../models/diagnosis-model.js";
import Tindakan from "../models/tindakan-model.js";
import Tarif from "../models/tarif-model.js";
import KategoriRuangan from "../models/kategori_ruangan-model.js";
import Ruangan from "../models/ruangan-model.js";
import Surat from "../models/surat-model.js";
import User from "../models/user-model.js";
import AntrianPoli from "../models/antrian_poli-model.js";
import Bed from "../models/bed-model.js";
import db from "./database.js";
import { Op, where } from "sequelize";
import bcrypt from "bcrypt";
import MainMenu from "../models/main_menu-model.js";
import SubMenu from "../models/sub_menu-model.js";
import ActionMenu from "../models/action_menu-model.js";
import TarifRuangan from "../models/tarif_ruangan-model.js";
import TarifPenjamin from "../models/tarif_penjamin-model.js";
import Practitioner from "../models/practitioner-model.js";
import Pegawai from "../models/pegawai-model.js";
import Voucher from "../models/voucher-model.js";
import NameTarifKomponen from "../models/name_tarif_komponen-model.js";
import TarifPelayanan from "../models/tarif_pelayanan-model.js";
import TarifKomponenTindakanPoli from "../models/tarif_komponen_tindakan_poli-model.js";
import TarifLab from "../models/tarif_lab-model.js";
import Gigi from "../models/gigi-model.js";
import ItemGigi from "../models/item_gigi-model.js";
import KategoriGigi from "../models/kategori_gigi-model.js";
import OklusiGigi from "../models/oklusi_gigi-model.js";
import Province from "../models/province-model.js";
import Kabupaten from "../models/kabupaten-model.js";
import Kecamatan from "../models/kecamatan-model.js";
import Kelurahan from "../models/kelurahan-model.js";
import Role from "../models/role-model.js";

export default async function syncDB() {
  try {
    await sequelizeInstance.authenticate();

    const models = [
      SNOMED,
      LOINC,
      ICD9,
      Faskes,
      Organization,
      Lokasi,
      Penjamin,
      Diagnosis,
      Tindakan,
      Tarif,
      KategoriRuangan,
      Ruangan,
      Surat,
      User,
      Role,
      Pegawai,
      AntrianPoli,
      Bed,
      User,
      MainMenu,
      SubMenu,
      Practitioner,
      ActionMenu,
      NameTarifKomponen,
      TarifRuangan,
      TarifPenjamin,
      TarifPelayanan,
      TarifKomponenTindakanPoli,
      TarifLab,
      Voucher,
      Gigi,
      ItemGigi,
      KategoriGigi,
      OklusiGigi,
      Province,
      Kabupaten,
      Kecamatan,
      Kelurahan,
    ];

    // await sequelizeInstance.transaction(async (tr) => {
    //   await User.findOrCreate({
    //     transaction: tr,
    //     where: {
    //       [Op.and]: [
    //         {
    //           email: "pengguna3@contoh.id",
    //           username: "habib-dev",
    //         },
    //       ],
    //     },
    //     defaults: {
    //       faskes_uuid: "01916de0-795c-7450-a68f-17f8bc5642fc",
    //       role_uuid: "9d403ufjh43ufh3uf8430ihf",
    //       // dokter_uuid: "coijr0i3nh0uc30hfjij3ci",
    //       name: "habib",
    //       phone: "080000000000",
    //       email: "pengguna3@contoh.id",
    //       username: "habib-dev",
    //       password: await bcrypt.hash("secreet_pass", 10),
    //       inventory_medis: true,
    //       inventory_non_medis: true,
    //       status: true,
    //     },
    //   });
    // });

    for (const model of models) {
      await model.sync();
    }
  } catch (error) {
    console.error("Terjadi kesalahan saat sinkronisasi:", error);
  }
}
