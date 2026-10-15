import { Op } from "sequelize";
import { PatientModel, BirthDetailModel } from "@opensimrs/model-sdk/admisi";
import { AddressModel } from "@opensimrs/model-sdk/setting";
import { RawatJalanModel } from "@opensimrs/model-sdk/pelayanan";
import {
    FaskesModel,
    LokasiModel,
    PractitionerModel,
    PegawaiModel,
} from "@opensimrs/model-sdk/datamaster";
import { JadwalDokterModel } from "@opensimrs/model-sdk/antrian";
import BadRequestException from "../exception/bad-request-exception.js";
import NotfoundException from "../exception/notfound-exception.js";
import { RawatJalanService } from "./rawat-jalan-service.js";

const STATUS_RJ = {
    0: "DIBATALKAN",
    1: "BOOKED",
    2: "CHECK_IN",
    3: "ANTRIAN",
    4: "DIPERIKSA",
    5: "SELESAI",
};

function normalizePatient(patient) {
    if (!patient) return null;
    const row = typeof patient.get === "function" ? patient.get({ plain: true }) : patient;

    return {
        uuid: row.uuid,
        no_rm: row.no_rm ?? row.noRm,
        name: row.name,
        identity: row.identity,
        no_identity: row.no_identity ?? row.noIdentity,
        gender: row.gender,
        phone: row.phone,
        status: row.status,
        birth_detail: row.birth_detail
            ? {
                uuid: row.birth_detail.uuid,
                birth_place: row.birth_detail.birth_place ?? row.birth_detail.birthPlace,
                birth_date: row.birth_detail.birth_date ?? row.birth_detail.birthDate,
                age_year: row.birth_detail.age_year ?? row.birth_detail.ageYear,
                age_month: row.birth_detail.age_month ?? row.birth_detail.ageMonth,
                age_day: row.birth_detail.age_day ?? row.birth_detail.ageDay,
            }
            : null,
        address: row.address
            ? {
                uuid: row.address.uuid,
                full_address: row.address.full_address ?? row.address.fullAddress,
                prov: row.address.prov,
                city: row.address.city,
                district: row.address.district,
                village: row.address.village,
                postal_code: row.address.postal_code ?? row.address.postalCode,
                country: row.address.country,
            }
            : null,
    };
}

function normalizeBooking(booking) {
    const row = typeof booking.get === "function" ? booking.get({ plain: true }) : booking;

    return {
        uuid: row.uuid,
        kode_booking: row.kode_booking ?? row.kodeBooking,
        no_reg: row.no_reg ?? row.noReg,
        no_rm: row.no_rm ?? row.noRm,
        no_antrian_admisi: row.no_antrian_admisi ?? row.noAntrianAdmisi,
        no_antrian_poli: row.no_antrian_poli ?? row.noAntrianPoli,
        status_rj: row.status_rj ?? row.statusRj,
        status_label: STATUS_RJ[row.status_rj ?? row.statusRj] ?? "UNKNOWN",
        tanggal_daftar: row.tanggal_daftar ?? row.tanggalDaftar,
        jadwal_periksa: row.jadwal_periksa ?? row.jadwalPeriksa,
        tanggal_checkin: row.tanggal_checkin ?? row.tanggalCheckin,
        complaint: row.complaint,
        note: row.note,
        patient: normalizePatient(row.patient),
        lokasi: row.lokasi
            ? {
                uuid: row.lokasi.uuid,
                name: row.lokasi.name,
                phone: row.lokasi.phone,
                description: row.lokasi.description,
            }
            : null,
        jadwal_dokter: row.jadwal_dokter
            ? {
                uuid: row.jadwal_dokter.uuid,
                day: row.jadwal_dokter.day,
                start_time: row.jadwal_dokter.start_time ?? row.jadwal_dokter.startTime,
                end_time: row.jadwal_dokter.end_time ?? row.jadwal_dokter.endTime,
            }
            : null,
        practitioner: row.practitioner
            ? {
                uuid: row.practitioner.uuid,
                name: row.practitioner.pegawai?.name,
                sip: row.practitioner.sip,
            }
            : null,
    };
}

export default class MobilePasienService {
    static async bootstrap(faskesUuid) {
        const faskes = await FaskesModel.findOne({
            where: { uuid: faskesUuid },
            attributes: ["uuid", "code", "name", "status"],
        });

        return {
            faskes: faskes ? faskes.get({ plain: true }) : null,
            app: {
                name: "OpenSIMRS Mobile",
                minimum_version: "1.0.0",
                force_update: false,
            },
            features: {
                booking_rawat_jalan: true,
                pasien: true,
                lokasi_faskes: true,
                notifikasi: false,
                sos_ambulans: false,
            },
            banners: [
                {
                    title: "Layanan pasien lebih mudah",
                    subtitle: "Booking kunjungan, cek jadwal, dan pantau riwayat dari aplikasi.",
                    image_url: null,
                },
            ],
            emergency_contacts: [
                { label: "PSC 119", phone: "119" },
                { label: "Darurat Nasional", phone: "112" },
            ],
        };
    }

    static async getFacilities(faskesUuid) {
        const faskes = await FaskesModel.findAll({
            where: faskesUuid ? { uuid: faskesUuid } : { status: true },
            attributes: ["uuid", "code", "name", "status"],
            order: [["name", "ASC"]],
        });

        return faskes.map((item) => ({
            ...item.get({ plain: true }),
            address: null,
            phone: null,
            latitude: null,
            longitude: null,
            distance_km: null,
        }));
    }

    static async getPolyclinics(faskesUuid) {
        const data = await LokasiModel.findAll({
            where: {
                faskesUuid,
                status: true,
                deletedAt: { [Op.is]: null },
            },
            attributes: ["uuid", "code", "name", "description", "phone", "location_type", "class_name"],
            order: [["name", "ASC"]],
        });

        return data.map((item) => item.get({ plain: true }));
    }

    static async getPatients(faskesUuid, args) {
        const filter = {
            faskesUuid,
            deletedAt: { [Op.is]: null },
            // pasien non-aktif tidak tampil di aplikasi mobile
            status: { [Op.is]: true },
        };

        if (args.no_rm) filter.noRm = args.no_rm;
        if (args.no_identity) filter.noIdentity = args.no_identity;
        if (args.identity) filter.identity = args.identity;
        if (args.q) {
            filter[Op.or] = [
                { name: { [Op.iLike]: `%${args.q}%` } },
                { noRm: { [Op.iLike]: `%${args.q}%` } },
                { noIdentity: { [Op.iLike]: `%${args.q}%` } },
            ];
        }

        const data = await PatientModel.findAll({
            where: filter,
            include: [
                {
                    model: AddressModel,
                    required: false,
                    as: "address",
                    attributes: ["uuid", "full_address", "prov", "city", "district", "village", "postal_code", "country"],
                },
                {
                    model: BirthDetailModel,
                    required: false,
                    as: "birth_detail",
                    attributes: ["uuid", "birth_place", "birth_date", "age_year", "age_month", "age_day"],
                },
            ],
            attributes: ["uuid", "no_rm", "name", "identity", "no_identity", "gender", "phone", "status"],
            limit: Number(args.limit || 20),
            order: [["updated_at", "DESC"]],
        });

        return data.map(normalizePatient);
    }

    static async checkPatient(faskesUuid, data) {
        if (!data.no_rm && !(data.identity && data.no_identity)) {
            throw new BadRequestException("no_rm atau identity + no_identity wajib diisi");
        }

        const [patient] = await this.getPatients(faskesUuid, {
            no_rm: data.no_rm,
            identity: data.identity,
            no_identity: data.no_identity,
            limit: 1,
        });

        return {
            exists: Boolean(patient),
            patient: patient || null,
        };
    }

    static async getSchedules(faskesUuid, args) {
        const filter = {
            faskesUuid,
            status: true,
            deletedAt: { [Op.is]: null },
        };

        if (args.day) filter.day = args.day;
        if (args.lokasi_uuid) filter.lokasiUuid = args.lokasi_uuid;
        if (args.practitioner_uuid) filter.practitionerUuid = args.practitioner_uuid;

        const data = await JadwalDokterModel.findAll({
            where: filter,
            include: [
                {
                    model: PractitionerModel,
                    as: "practitioner",
                    required: false,
                    attributes: ["uuid", "sip", "str"],
                    include: [
                        {
                            model: PegawaiModel,
                            as: "pegawai",
                            required: false,
                            attributes: ["uuid", "name"],
                        },
                    ],
                },
                {
                    model: LokasiModel,
                    as: "lokasi",
                    required: false,
                    attributes: ["uuid", "name", "phone", "description"],
                },
            ],
            attributes: ["uuid", "day", "start_time", "end_time", "kuota", "kuota_non_jkn", "kuota_jkn", "durasi_pelayanan", "code_antrian_poli", "code_antrian_dokter"],
            order: [["day", "ASC"], ["start_time", "ASC"]],
        });

        return data.map((item) => {
            const row = item.get({ plain: true });
            return {
                uuid: row.uuid,
                day: row.day,
                start_time: row.start_time,
                end_time: row.end_time,
                kuota: row.kuota,
                kuota_non_jkn: row.kuota_non_jkn,
                kuota_jkn: row.kuota_jkn,
                durasi_pelayanan: row.durasi_pelayanan,
                kode_antrian_poli: row.code_antrian_poli,
                kode_antrian_dokter: row.code_antrian_dokter,
                practitioner: row.practitioner
                    ? {
                        uuid: row.practitioner.uuid,
                        name: row.practitioner.pegawai?.name,
                        sip: row.practitioner.sip,
                    }
                    : null,
                lokasi: row.lokasi
                    ? {
                        uuid: row.lokasi.uuid,
                        name: row.lokasi.name,
                        phone: row.lokasi.phone,
                        description: row.lokasi.description,
                    }
                    : null,
            };
        });
    }

    static async createBooking(faskesUuid, data) {
        return RawatJalanService.registRawatJalanMobile(data, faskesUuid);
    }

    static async cancelBooking(faskesUuid, data) {
        return RawatJalanService.cancelVisitMobile(data, faskesUuid);
    }

    static async getBookings(faskesUuid, args) {
        const filter = {
            faskesUuid,
            deletedAt: { [Op.is]: null },
        };

        if (args.kode_booking) filter.kodeBooking = args.kode_booking;
        if (args.patient_uuid) filter.patientUuid = args.patient_uuid;
        if (args.status_rj) filter.statusRj = Number(args.status_rj);
        if (args.active === "true") {
            filter.statusRj = { [Op.in]: [1, 2, 3, 4] };
            filter.dischargeDate = { [Op.is]: null };
        }

        const data = await RawatJalanModel.findAll({
            where: filter,
            include: [
                {
                    model: PatientModel,
                    as: "patient",
                    required: Boolean(args.no_identity),
                    where: args.no_identity ? { noIdentity: args.no_identity } : undefined,
                    attributes: ["uuid", "no_rm", "name", "identity", "no_identity", "gender", "phone", "status"],
                    include: [
                        {
                            model: BirthDetailModel,
                            required: false,
                            as: "birth_detail",
                            attributes: ["uuid", "birth_place", "birth_date", "age_year", "age_month", "age_day"],
                        },
                    ],
                },
                {
                    model: LokasiModel,
                    as: "lokasi",
                    required: false,
                    attributes: ["uuid", "name", "phone", "description"],
                },
                {
                    model: JadwalDokterModel,
                    as: "jadwal_dokter",
                    required: false,
                    attributes: ["uuid", "day", "start_time", "end_time"],
                },
                {
                    model: PractitionerModel,
                    as: "practitioner",
                    required: false,
                    attributes: ["uuid", "sip"],
                    include: [
                        {
                            model: PegawaiModel,
                            as: "pegawai",
                            required: false,
                            attributes: ["uuid", "name"],
                        },
                    ],
                },
            ],
            attributes: [
                "uuid",
                "kode_booking",
                "no_reg",
                "no_rm",
                "no_antrian_admisi",
                "no_antrian_poli",
                "status_rj",
                "tanggal_daftar",
                "jadwal_periksa",
                "tanggal_checkin",
                "complaint",
                "note",
            ],
            limit: Number(args.limit || 20),
            order: [["created_at", "DESC"]],
        });

        if (args.kode_booking && data.length === 0) {
            throw new NotfoundException("Booking tidak ditemukan");
        }

        return data.map(normalizeBooking);
    }
}
