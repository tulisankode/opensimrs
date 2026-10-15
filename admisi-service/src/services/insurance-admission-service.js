import InsuranceAdmissionRepository from "../repositories/insurance-admission-repository.js";

export default class InsuranceAdmissionService{
    static async createInsuranceAdmission(data, transaction){
        const {
            paymentMethod,
            insuranceData, 
            patientUuid,
            noReg,
            admissionType
        } = data;

        const payload = {
            patientUuid,
            noReg,
            admissionType,
            penjaminUuid: null,
            accountNumber: null,
            classEntitle: null,
            isTunai: false
        };

        if (paymentMethod === 'ASURANSI') {
            if (insuranceData) {
                payload.penjaminUuid = insuranceData.penjamin_uuid;
                payload.accountNumber = insuranceData.account_number;
                payload.classEntitle = insuranceData.class_entitle;
            }
        } else if (paymentMethod === 'TUNAI') {
            payload.isTunai = true;
        } else {
            return null;
        }

        console.log("Payload Insurance Admission:", payload);

        return InsuranceAdmissionRepository.AsuransiPelayanan(payload, transaction);
    }
}