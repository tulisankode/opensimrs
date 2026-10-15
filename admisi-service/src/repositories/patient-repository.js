import sequelizeInstace from "@opensimrs/model-sdk/instance";
import {
    PatientModel,
    BirthDetailModel
} from "@opensimrs/model-sdk/admisi";
import {
    AddressModel
} from "@opensimrs/model-sdk/setting";
import {Op} from "sequelize";
import Pagination from "../helper/pagination.js";
import moment from "moment";
import {convertSnakeToCamel, generateNoRM, generateNoRmTemporary, getInfoAge} from "../helper/utility.js";
import {Context} from "../middlewares/context.js";
import {CTX_AUTHOR} from "../constant/context-constant.js";
import DuplicateException from "../exception/duplicate-exception.js";
import PatientService from "../services/patient-service.js";
import NotfoundException from "../exception/notfound-exception.js";
import BadRequestException from "../exception/bad-request-exception.js";

export default class PatientRepository{
    static async registPatient(data, externalTransaction = null) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const transaction = externalTransaction || await sequelizeInstace.transaction();
        try {

            const { patient, preparedData, address, birthDetail } = await this.registPatientCore(data, faskesUuid, transaction);
            
            let patientModel;
            if (patient) {
                //* Update pasien lama
                patientModel = await patient.update(preparedData, { transaction });
            } else {
                //* Create pasien baru
                const noRm = await generateNoRM(faskesUuid);
                patientModel = await PatientModel.create({ ...preparedData, noRm }, { transaction });
            }

            if (!externalTransaction) await transaction.commit();

            return {
                ...patientModel.get({ plain: true }),
                address: address ? address.get({ plain: true }) : null,
                birthDetail: birthDetail ? birthDetail.get({ plain: true }) : null
            };
            
        } catch (error) {
            if (!externalTransaction) await transaction.rollback();
            console.error(error);
            throw error;
        }
    }

    static async registPatientMobile(data, faskesUuid, externalTransaction = null) {
        const transaction = externalTransaction || await sequelizeInstace.transaction();
        try {

            const { patient, preparedData, address, birthDetail } = await this.registPatientCore(data, faskesUuid, transaction);

            let patientModel;
            if (patient) {
                //* Update pasien lama
                patientModel = await patient.update({ ...preparedData, status: true }, { transaction });
            } else {
                //* Create pasien baru
                const noRm = await generateNoRmTemporary(faskesUuid);
                patientModel = await PatientModel.create({ ...preparedData, noRm }, { transaction });
            }

            if (!externalTransaction) await transaction.commit();

            return {
                ...patientModel.get({ plain: true }),
                address: address ? address.get({ plain: true }) : null,
                birthDetail: birthDetail ? birthDetail.get({ plain: true }) : null
            };

        } catch (error) {
            if (!externalTransaction) await transaction.rollback();
            console.error(error);
            throw error;
        }
    }

    static async registPatientApm(data, externalTransaction = null) {
        const transaction = externalTransaction || await sequelizeInstace.transaction();
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        data = convertSnakeToCamel(data);

        PatientService.patientIdentityFormat(data.identity, data.noIdentity);

        try {
            if (data.isNewBorn === undefined || !data.isNewBorn) {
                data.isNewBorn = false;
            }

            const uuid = data.patientUuid || null;
            const patient = uuid ? await PatientModel.findOne({
                where: { uuid },
                include: [
                    { model: AddressModel, as: 'address' },
                    { model: BirthDetailModel, as: 'birth_detail' }
                ],
                transaction
            }) : null;

            if (!data.isNewBorn) {
                const existingPatient = await this.checkNoIdentity(data.noIdentity, faskesUuid, transaction);

                if (uuid) {
                    //* Check identitas pasien lama
                    if (existingPatient && existingPatient.uuid !== uuid) {
                        throw new DuplicateException("No Identitas Pasien sudah terdaftar.");
                    }
                } else { 
                    //* Check identitas pasien baru
                    if (existingPatient) {
                        throw new DuplicateException("No Identitas Pasien sudah terdaftar.");
                    }
                }
            }

            // Handle address
            let address = patient ? patient.address : null;
            if (address) {
                await address.update(data.address || {}, { transaction });
            } else {
                address = await AddressModel.create({
                    prov: "15",
                    city: "1505",
                    district: "150505",
                    rt: "1",
                    rw: "2",
                    full_address: "Jl. Raya No. 123",
                    country: "id-ID",
                    village: "1505052004",
                    postal_code: "45666",
                    faskesUuid
                },{ transaction }
                );
            }
            data.addressUuid = address?.uuid || null;

            let birthDetail = patient ? patient.birth_detail : null;

            if (birthDetail) {
                await birthDetail.update(data.birth_detail || {}, { transaction });
            } else {
                birthDetail = await BirthDetailModel.create({
                    faskesUuid: faskesUuid,
                    birthPlace: 'Surabaya',
                    birthDate: new Date('2000-01-01'),
                    ageYear: 0,
                    ageMonth: 0,
                    ageDay: 0
                }, { transaction });
                
                data.birthDetailUuid = birthDetail.uuid;
            }

            data.faskesUuid = faskesUuid;
            const patientModel = patient
                ? await patient.update({ ...data, status: true }, { transaction })
                : await PatientModel.create({
                    ...data,
                    noRm: await generateNoRmTemporary(),
                    name: "Nama Pasien",
                    gender: "Male"
                }, { transaction });

            if (!externalTransaction) await transaction.commit();

            return {
                ...patientModel.get({ plain: true }),
            };

        }catch (error) {
            if (!externalTransaction) await transaction.rollback();
            console.error(error);
            throw error;
        }
    }

    static async registPatientCore(data, faskesUuid, options = {}, externalTransaction = null) {
        const transaction = externalTransaction || await sequelizeInstace.transaction();
        
        try {
            data = convertSnakeToCamel(data);
            data.address = convertSnakeToCamel(data.address);
            data.birthDetail = convertSnakeToCamel(data.birthDetail);

            PatientService.patientIdentityFormat(data.identity, data.noIdentity);
            
            data.isNewBorn = data.isNewBorn === undefined ? false : data.isNewBorn;

            let patient = null;
            const includeAssociations = [
                { model: AddressModel, as: 'address' },
                { model: BirthDetailModel, as: 'birth_detail' }
            ];

            //* Cek pasien lama berdasarkan uuid atau noRm
            if (data.patientUuid) {
                patient = await PatientModel.findOne({
                    where: { uuid: data.patientUuid, faskesUuid },
                    include: includeAssociations,
                    transaction
                });
            }
            else if (data.noRm) {
                patient = await PatientModel.findOne({
                    where: { noRm: data.noRm, faskesUuid },
                    include: includeAssociations,
                    transaction
                });
            }
            if (patient && !data.patientUuid) {
                data.patientUuid = patient.uuid;
            }

            //* Generate noRm jika pasien memeliki noRM sementara
            if (patient && patient.noRm.startsWith('XX')) {
                await patient.update({ noRm: await generateNoRM() }, { transaction });
            }
            
            //* Create atau update address dan birth detail
            const address = await this.createAddressPatient(data.address, patient, faskesUuid, transaction);
            const birthDetail = await this.createBirthDetailPatient(data.birthDetail, patient, faskesUuid, transaction);

            data.addressUuid = address?.uuid || null;
            data.birthDetailUuid = birthDetail?.uuid || null;

            //* Validasi no identitas
            if (!data.isNewBorn) {
                const existingPatient = await this.checkNoIdentity(data.noIdentity, faskesUuid, transaction);

                //* Check identitas pasien lama
                if (data.patientUuid) {
                    if (existingPatient && existingPatient.uuid !== data.patientUuid) {
                        throw new DuplicateException("No Identitas Pasien sudah terdaftar.");
                    }
                } else {
                    //* Check identitas pasien baru 
                    if (existingPatient) {
                        throw new DuplicateException("No Identitas Pasien sudah terdaftar.");
                    }
                }
            }

            
            data.faskesUuid = faskesUuid;

            if (!externalTransaction) await transaction.commit();

            return { 
                patient,
                preparedData: data, 
                address, 
                birthDetail 
            };

        } catch (error) {
            if (!externalTransaction) await transaction.rollback();
            console.error(error);
            throw error;
        }
    }

    static async createAddressPatient(addressData, patient, faskesUuid, transaction) {
        let address = patient ? patient.address : null;
        if (address) {
            await address.update(addressData || {}, { transaction });
        } else if (addressData) {
            addressData.faskesUuid = faskesUuid;
            address = await AddressModel.create(addressData, { transaction });
        }
        return address;
    }

    static async createBirthDetailPatient(birthDetailData, patient, faskesUuid, transaction) {
        let birthDetail = patient ? patient.birth_detail : null;
        if (birthDetailData) {
            const infoAge = getInfoAge(birthDetailData.birthDate);
            Object.assign(birthDetailData, infoAge);
            
            if (birthDetail) {
                await birthDetail.update(birthDetailData, { transaction });
            } else {
                birthDetailData.faskesUuid = faskesUuid;
                birthDetail = await BirthDetailModel.create(birthDetailData, { transaction });
            }
        }

        return birthDetail;
    }

    static async checkNoIdentity(noIdentity, faskesUuid, transaction) {
        if (!noIdentity) {
            return null;
        }

        return await PatientModel.findOne({
            where: {
                faskesUuid,
                noIdentity,
                isNewBorn: false,
                noRm: { [Op.notLike]: 'XX%' }
            },
            transaction
        });
    }
    
    static async importData(data){
        const {faskesUuid} = Context.get(CTX_AUTHOR);
        try{
            return await sequelizeInstace.transaction(async (t) => {
                let currentInsert = 1;
                let i = 0;

                let patientCount = await PatientModel.unscoped().count({
                    where: { faskesUuid, noRm: { [Op.notILike]: 'XX%' } },
                    transaction: t,
                });

                const seenIdentities = new Set();

                for (let item of data){
                    item = convertSnakeToCamel(item);
                
                    //* CHECK NO IDENTITAS DI EXCEL
                    if (seenIdentities.has(item.noIdentity)) {
                        throw new DuplicateException(`Data no identitas ${item.noIdentity} sudah ada di Excel`);
                        // failedImport.push(item.noIdentity);
                        // continue;
                    }
                    seenIdentities.add(item.noIdentity);

                     //* CHECK NO IDENTITAS PASIEN
                    const checkPatient =
                        await PatientModel.findOne({
                            where: {
                                [Op.or]: [
                                    { no_identity: item.noIdentity },
                                ]
                            },
                            transaction: t
                        });
                        
                    if(checkPatient){
                        throw new DuplicateException(`Data no identitas ${item.noIdentity} sudah terdaftar`);
                        // failedImport.push(checkPatient.noIdentity);
                        // continue;
                    }

                    const address = await AddressModel.create({
                        faskesUuid: faskesUuid,
                        fullAddress: item.address.full_address,
                        postalCode: item.address.postal_code,
                        ...item.address,
                    }, {transaction: t});
                    const infoAge = getInfoAge(item.birthDetail.birth_date);
                    const birthDetail = await BirthDetailModel.create({
                        birthPlace: item.birthDetail.birth_place,
                        birthDate: item.birthDetail.birth_date,
                        ...infoAge,
                        faskesUuid: faskesUuid
                    }, {transaction: t});

                    //* Generate NoRM Khusus untuk Import
                    const currentCount = patientCount + i + 1;
                    const paddedNumber = currentCount.toString().padStart(6, "0");
                    const noRm = `${paddedNumber.slice(0, 2)}-${paddedNumber.slice(2, 4)}-${paddedNumber.slice(4, 6)}`;

                    await PatientModel.create({
                        ...item,
                        noRm: noRm,
                        addressUuid: address.uuid,
                        birthDetailUuid: birthDetail.uuid,
                        faskesUuid: faskesUuid,
                    }, {transaction: t});
                    currentInsert++;
                    i++;
                }

                if (data.length === 0) {
                    throw new BadRequestException("File kosong, tidak ada data pasien untuk diimpor");
                }

                return { message: `Berhasil import : ${data.length} data pasien` };
            });
        }catch (error){
            console.log(error);
            throw error;
        }
    }

    static async checkExistPatient(data){
        convertSnakeToCamel(data);

        try {
            let filter = {
                // deletedAt: { [Op.is]: null },
                faskesUuid: data.faskes_uuid,
                noRm: { [Op.notLike]: 'XX%' },
            };

            if (data.no_rm) {
                filter.noRm = data.no_rm;
            } else if (data.identity && data.no_identity) {
                filter.identity = data.identity;
                filter.noIdentity = data.no_identity;
            } else {
                throw new BadRequestException("Parameter tidak lengkap");
            }
            
            const patient = await PatientModel.findOne({
                where: filter,
                include: [
                    {
                        model: AddressModel,
                        required: false,
                        as: "address",
                        attributes: ["uuid", "full_address","prov", "city", "district", "rt", "rw", "village", "postal_code", "country"]
                    },
                    {
                        model: BirthDetailModel,
                        required: false,
                        as: "birth_detail",
                        attributes: ["uuid", "birth_place", "birth_date", "age_year", "age_month", "age_day"]
                    }
                ],
                attributes: [
                    "uuid",
                    "no_rm",
                    "title",
                    "name",
                    "identity",
                    "no_identity",
                    "gender",
                    "phone",
                    "status",
                    "religion",
                    "language",
                    "mother_name",
                    "maritial_status",
                    "status",
                ],
            });

            // Pasien non-aktif tidak boleh dipakai mendaftar (APM/kiosk/mobile); ditolak dengan pesan jelas, bukan
            // "belum terdaftar", agar tidak dibuat pasien ganda dengan identitas yang sama.
            if (patient && patient.status === false) {
                throw new BadRequestException(
                    `Pasien ${patient.getDataValue("no_rm") ?? patient.getDataValue("noRm")} (${patient.name}) berstatus non-aktif — aktifkan dulu di Admisi › Data Pasien`
                );
            }
            return patient;

        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    static async getPatientByUuid(uuid){
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        try{
            return await PatientModel.findOne({
                where: {
                    [Op.and]: [
                        { uuid },
                        { faskesUuid },
                    ]
                },
                // Left join: pasien tanpa baris alamat/data lahir tetap bisa dibuka (sebelumnya 404)
                include: [
                    {
                        model: AddressModel,
                        required: false,
                        as: "address",
                        attributes: ["uuid", "full_address","prov", "city", "district", "rt", "rw", "village", "postal_code", "country"]
                    },
                    {
                        model: BirthDetailModel,
                        required: false,
                        as: "birth_detail",
                        attributes: ["uuid", "birth_place", "birth_date", "age_year", "age_month", "age_day"]
                    }
                ],
                attributes: [
                    "uuid",
                    "no_rm",
                    "title",
                    "name",
                    "identity",
                    "no_identity",
                    "gender",
                    "phone",
                    "religion",
                    "language",
                    "mother_name",
                    "maritial_status",
                    "status",
                ],
            });
        }catch (error){
            console.log(error);
            throw error;
        }
    }

    static async deletePatient(data){
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        data = convertSnakeToCamel(data);
        try{
            return await sequelizeInstace.transaction(async (t) => {
                const patient = await PatientModel.findAll({
                    where: {
                        uuid: data.listUuid,
                        faskesUuid,
                        status: { [Op.is]: true }
                    }
                })

                if (patient.length !== data.listUuid.length) {
                    throw new NotfoundException("Data Pasien tidak ditemukan");
                }

                return await PatientModel.update(
                    { status: false },
                    {
                        where: {
                            uuid: data.listUuid,
                            faskesUuid,
                            status: { [Op.is]: true }
                        },
                        transaction: t
                    }
                );
            });
        }catch (error){
            throw error;
        }
    }

    // Aktifkan kembali pasien non-aktif (kebalikan deletePatient). Pasien yang sudah aktif dilewati.
    static async activatePatient(data){
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        data = convertSnakeToCamel(data);
        const patient = await PatientModel.findAll({ where: { uuid: data.listUuid, faskesUuid }, attributes: ["uuid"] });
        if (patient.length !== data.listUuid.length) {
            throw new NotfoundException("Data Pasien tidak ditemukan");
        }
        const [jumlah] = await PatientModel.update(
            { status: true, updatedAt: moment().unix() },
            { where: { uuid: data.listUuid, faskesUuid, status: { [Op.is]: false } } }
        );
        return { diaktifkan: jumlah };
    }

    // Tabel transaksi yang merujuk pasien (lintas layanan, database bersama). Pasien yang punya baris di salah satu
    // tabel ini tidak boleh dihapus. Data milik pasien (patient_families, insurance_accounts) bukan transaksi.
    // Tabel yang belum ada di instalasi (modul belum dimigrasikan) dilewati.
    static TABEL_TRANSAKSI = [
        ["rawat_jalans", "kunjungan rawat jalan"], ["admission_rj", "pendaftaran rawat jalan"],
        ["instalasi_gawat_darurats", "kunjungan IGD"], ["rawat_inaps", "rawat inap"], ["room_monitorings", "monitoring ruangan"],
        ["antrian", "antrian"], ["log_pelayanan", "riwayat pelayanan"], ["general_consents", "general consent"],
        ["bills", "tagihan"], ["bpjs", "data BPJS/SEP"], ["bpjs_vclaim_sep", "SEP BPJS"], ["pencatat_task_id", "task ID antrean"],
        ["order_lab", "order laboratorium"], ["rad_order", "order radiologi"], ["fisio_order", "order fisioterapi"],
        ["order_fisio", "order fisioterapi"], ["fisio_jadwal", "jadwal fisioterapi"], ["pa_order", "order patologi anatomi"],
        ["mikro_order", "order mikrobiologi"], ["mcu_peserta", "MCU"], ["prescriptions", "resep"], ["order_alkes", "order alkes"],
        ["retur", "retur farmasi"],
    ];

    /**
     * Jenis transaksi yang dimiliki tiap pasien: { [patientUuid]: ["kunjungan rawat jalan", ...] }.
     * @param {Array<string>} listUuid
     */
    static async transaksiPasien(listUuid) {
        const [ada] = await sequelizeInstace.query(
            `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'patient_uuid'`
        );
        const tersedia = new Set(ada.map((r) => r.table_name));
        const tabel = PatientRepository.TABEL_TRANSAKSI.filter(([t]) => tersedia.has(t));
        const hasil = {};
        if (!tabel.length || !listUuid.length) return hasil;
        // Semua tabel dalam satu kueri (soft delete tetap dihitung sebagai transaksi).
        const [baris] = await sequelizeInstace.query(
            tabel.map(([t, label]) => `SELECT DISTINCT patient_uuid, '${label}' AS jenis FROM "${t}" WHERE patient_uuid IN (:uuids)`).join(" UNION "),
            { replacements: { uuids: listUuid } }
        );
        for (const r of baris) (hasil[r.patient_uuid] ??= []).push(r.jenis);
        return hasil;
    }

    // Hapus (soft delete) pasien yang belum pernah bertransaksi. Pasien yang punya transaksi dilaporkan di `gagal`.
    static async hapusPatient(data){
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        data = convertSnakeToCamel(data);
        const listUuid = [...new Set(data.listUuid)];
        const patient = await PatientModel.findAll({ where: { uuid: listUuid, faskesUuid }, attributes: ["uuid", "noRm", "name"] });
        const transaksi = await PatientRepository.transaksiPasien(patient.map((p) => p.uuid));
        const gagal = listUuid
            .filter((uuid) => !patient.some((p) => p.uuid === uuid))
            .map((uuid) => ({ uuid, no_rm: null, nama: null, alasan: "Pasien tidak ditemukan" }));
        const boleh = [];
        for (const p of patient) {
            const jenis = transaksi[p.uuid];
            if (jenis?.length) gagal.push({ uuid: p.uuid, no_rm: p.noRm, nama: p.name, alasan: `Sudah memiliki transaksi: ${[...new Set(jenis)].join(", ")}` });
            else boleh.push(p);
        }
        if (boleh.length) {
            await PatientModel.update(
                { deletedAt: moment().unix(), updatedAt: moment().unix() },
                { where: { uuid: boleh.map((p) => p.uuid), faskesUuid } }
            );
        }
        return {
            ringkasan: { total: listUuid.length, berhasil: boleh.length, gagal: gagal.length },
            berhasil: boleh.map((p) => ({ uuid: p.uuid, no_rm: p.noRm, nama: p.name })),
            gagal,
        };
    }

    static async getAllPatient(args) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        try {
            const filter = {
                faskesUuid,
                [Op.or]: [
                    {name: {[Op.iLike]: `%${args.q || ""}%`}},
                    {noRm: {[Op.iLike]: `%${args.q || ""}%`}},
                    {noIdentity: {[Op.iLike]: `%${args.q || ""}%`}},
                    sequelizeInstace.where(sequelizeInstace.col("address.full_address"), { [Op.iLike]: `%${args.q || ""}%` })
                ]
            };

            // Bawaan: hanya pasien aktif, agar pasien non-aktif tidak terbaca di pencarian layanan lain (order lab, RI, dst.).
            // "semua" (halaman Data Pasien) menampilkan semua status; "nonaktif" hanya yang non-aktif.
            if (args.status == "aktif") {
                filter.status = { [Op.is]: true };
                filter.noRm = { [Op.notLike]: 'XX%' };
            } else if (args.status == "nonaktif") {
                filter.status = { [Op.is]: false };
            } else if (args.status != "semua") {
                filter.status = { [Op.is]: true };
            }

            const option = {
                include: [{
                    model: AddressModel,
                    required: true,
                    as: "address",
                    attributes: ["uuid", "full_address", "prov", "city", "district", "rt", "rw", "village", "country"]
                }, {
                    model: BirthDetailModel,
                    required: true,
                    as: "birth_detail",
                    attributes: ["age_year", "age_month", "age_day"]
                }],
                attributes: [
                    "uuid",
                    "no_identity",
                    "no_rm",
                    "name",
                    "gender",
                    "status",
                    "phone"
                ],
            };

            return await Pagination.init(PatientModel, args, filter, option);
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    static async getOnePatientBy(col, val){
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        try {
            return await
                PatientModel.findOne({
                    where: {
                        faskesUuid,
                        [col]: val,
                    }
                });
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    static async createPatientFile(uuid, data){
    const { faskesUuid } = Context.get(CTX_AUTHOR);
        try {
            return await sequelizeInstace.transaction(async (t) => {
                data = convertSnakeToCamel(data);
                const patient = await PatientModel.findOne({
                    where: {
                        uuid,
                        faskesUuid,
                    },
                    transaction: t
                });

                if (!patient) {
                    throw new NotfoundException("Patient not found");
                }

                if (!data.unggahBerkas) {
                    throw new BadRequestException("File is required");
                }
                
                await patient.update({
                    unggahBerkas: data.unggahBerkas.data,
                    berkasInfo: {
                        name: data.unggahBerkas.name,
                        tanggalUnggah: moment().unix()
                    }
                }, { transaction: t });

                return {
                    uuid: patient.uuid,
                    message: "File berhasil diunggah",
                    name: data.unggahBerkas.name,
                    tanggalUnggah: moment().unix()
                };
            });
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    static async deletePatientFile(uuid){
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        try{
            const result = await sequelizeInstace.transaction(async (t) => {
                const patient = await PatientModel.findOne({
                    where: {
                        [Op.and]: [
                            { uuid },
                            { faskesUuid },
                        ]
                    },
                    attributes: ["uuid", "unggahBerkas", "berkasInfo"],
                    transaction: t
                });

                if (!patient) {
                    throw new NotfoundException("Patient tidak ditemukan");
                }
                if (!patient.unggahBerkas) {
                    throw new BadRequestException("Tidak ada file yang diunggah");
                }

                return await PatientModel.update(
                    {
                        updatedAt: moment().unix(),
                        unggahBerkas: null,
                        berkasInfo: null
                    },
                    {
                        where: {
                            [Op.and]: [
                                { uuid },
                                { faskesUuid },
                            ]
                        },
                        transaction: t
                    }
                );
            });
            
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async getPatientFile(uuid) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const patient = await sequelizeInstace.transaction(async (t) => {
            return await PatientModel.findOne({
                where: {
                    uuid,
                    faskesUuid,
                },
                attributes: [
                    "uuid", "unggahBerkas", "berkasInfo"
                ],
                transaction: t
            });
        });

        if (!patient) {
            throw new NotfoundException("Patient not found");
        }

        if (patient && patient.unggahBerkas) {
            return {
                uuid: patient.uuid,
                berkasInfo: patient.berkasInfo,
                tipe: "pdf",
                data: patient.unggahBerkas.toString("base64"),
            };
        }

        return {
            message: "Tidak ada file yang diunggah",
        };
    }

}