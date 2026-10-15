import {
    InsuranceAdmissionModel
} from "@opensimrs/model-sdk/pelayanan";
import {
    PenjaminModel
} from "@opensimrs/model-sdk/datamaster";
import {
    InsuranceAccountModel
} from "@opensimrs/model-sdk/admisi";
import {Context} from "../middlewares/context.js";
import {CTX_AUTHOR} from "../constant/context-constant.js";
import sequelizeInstace from "@opensimrs/model-sdk/instance";
import NotfoundException from "../exception/notfound-exception.js";
import { Op } from "sequelize";

export default class InsuranceAdmissionRepository {
    static async upsertInsuranceAdmission(data, transaction) {
        const {faskesUuid} = Context.get(CTX_AUTHOR);
        const trx = transaction || await sequelizeInstace.transaction();

        try {
            const insuranceAdmission = await InsuranceAdmissionModel.findOne({
                where: {
                    admissionType: data.admissionType,
                    noReg: data.noReg,
                    faskesUuid
                }
            });

            const result = insuranceAdmission
                ? await insuranceAdmission.update(data, {transaction: trx})
                : await InsuranceAdmissionModel.create({...data, faskesUuid}, {transaction: trx});

            if (!transaction) await trx.commit();
            
            return result;
        } catch (e) {
            if (!transaction) await trx.rollback();
            throw e;
        }
    }

    static async AsuransiPelayanan(data, transaction) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const trx = transaction || await sequelizeInstace.transaction();

        try {
            const AccountInsurance = await this.GenerateAccountInsurance(data, trx);
            const insuranceAdmission = await this.upsertInsuranceAdmission({
                admissionType: data.admissionType,
                noReg: data.noReg,
                insuranceAccountUuid: AccountInsurance,
                faskesUuid,
            }, trx);

            if (!transaction) await trx.commit();
            return insuranceAdmission.uuid;
        }catch (e) {
            if (!transaction) await trx.rollback();
            throw e;
        }
    }


    static async GenerateAccountInsurance(data, transaction) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const trx = transaction || await sequelizeInstace.transaction();
        try {
            let penjamin;

            if (data.isTunai) {
                penjamin = await PenjaminModel.findOne(
                    {
                        where: {
                            name: {
                                [Op.iLike]: '%tunai%' 
                            }
                        }
                    }
                );

                if (!penjamin) throw new NotfoundException("Penjamin Tunai tidak ditemukan, buat terlebih dahulu data penjamin tunai");
            } else {
                penjamin = await PenjaminModel.findOne(
                    {
                        where: {
                            uuid: data.penjaminUuid
                        }
                    }
                );

                if(!penjamin) throw new NotfoundException('Penjamin tidak ditemukan');
            }
            
            let whereClause = {
                patientUuid: data.patientUuid,
                faskesUuid: faskesUuid,
            };

            //* Cek jika tunai, maka cari berdasarkan code
            if (data.isTunai) {
                whereClause.code = penjamin.code;
                whereClause.accountNumber = null;
            } else {
                whereClause.accountNumber = data.accountNumber;
            }

            let insuranceAccount = await InsuranceAccountModel.findOne({
                where: whereClause,
            });

            if (insuranceAccount) {
                await insuranceAccount.update({
                    code: penjamin.code,
                    name: penjamin.name,
                    classEntitle: data.classEntitle || null,
                    membership_status: true,
                    status: true,
                });
            } else {
                insuranceAccount = await InsuranceAccountModel.create({
                    faskesUuid,
                    patientUuid: data.patientUuid,
                    code: penjamin.code,
                    name: penjamin.name,
                    accountNumber: data.accountNumber || null,
                    classEntitle: data.classEntitle || null,
                    membership_status: true,
                    status: true,
                });
            }

            if (!transaction) await trx.commit();

            return insuranceAccount.uuid;
        } catch (e) {
            if (!transaction) await trx.rollback();
            throw e;
        }
    }
}