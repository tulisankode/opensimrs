import {
    BPJSModel,
    GeneralConsentModel,
    InsuranceAccountModel,
    NewBornModel,
    PatientModel,
    PatientFamilyModel,
    RoomMonitoringModel,
} from "@opensimrs/model-sdk/admisi";

import {
    AddressModel,
} from "@opensimrs/model-sdk/setting";
import {
    InstalasiGawatDaruratModel,
    RawatInapModel,
    RawatJalanModel,
    InsuranceAdmissionModel,
    LogPelayananModel
} from "@opensimrs/model-sdk/pelayanan";

import {
    FaskesModel,
    KategoriRuanganModel,
    RuanganModel,
    LokasiModel,
    PractitionerModel,
    PegawaiModel,
    PenjaminModel
} from "@opensimrs/model-sdk/datamaster";

import {
    JadwalDokterModel
} from "@opensimrs/model-sdk/antrian";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

const MODELMERGE = [
    // PegawaiModel,
    // BPJSModel,
    // GeneralConsentModel,
    // InsuranceAccountModel,
    // NewBornModel,
    // PatientModel,
    // PatientFamilyModel,
    // RoomMonitoringModel,
    // AddressModel,
    // FaskesModel,
    // InstalasiGawatDaruratModel,
    // RawatInapModel,
    // RawatJalanModel,
    // InsuranceAdmissionModel,
    // KategoriRuanganModel,
    // RuanganModel,
    // LokasiModel,
    // PractitionerModel,
    // JadwalDokterModel,
    // LogPelayananModel,
    // PenjaminModel,
    // RuanganModel,
]

export default MODELMERGE;