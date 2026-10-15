import {
    AddressModel,
} from "@opensimrs/model-sdk/setting";

import {
    BirthDetailModel,
    PatientModel,
} from "@opensimrs/model-sdk/admisi";

import {
    PegawaiModel,
    PractitionerModel,
    KategoriRuanganModel,
    LokasiModel,
    FaskesModel,
    RuanganModel
} from "@opensimrs/model-sdk/datamaster";

import {
    PerpindahanModel,
    RawatInapModel,
    RiwayatRuanganModel
} from "@opensimrs/model-sdk/pelayanan";

import {
    RoomMonitoringModel,
} from "@opensimrs/model-sdk/admisi";

const MODELMERGE = [
    AddressModel,
    BirthDetailModel,
    FaskesModel,
    KategoriRuanganModel,
    LokasiModel,
    PatientModel,
    PegawaiModel,
    PractitionerModel,
    PerpindahanModel,
    RawatInapModel,
    RiwayatRuanganModel,
    RoomMonitoringModel,
    RuanganModel,
]
export default MODELMERGE;