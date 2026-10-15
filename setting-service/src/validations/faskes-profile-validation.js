import {z} from 'zod';
import {
    addressUuidRequired,
    codeRequired, emailRequired,
    nameRequired, phoneRequired,
    uuidRequired, websiteRequired
} from "./message-validation-error.js";

// Field profil opsional (peta, koordinat, gambar, wilayah): null/kosong diterima dan disimpan sebagai "".
const opsional = z.string().nullish().transform((v) => v ?? "");

export default class FaskesProfileValidation {
    static UPDATE = z.object({
        uuid: z.string().min(1, uuidRequired),
        code: z.string().min(1, codeRequired),
        name: z.string().min(1, nameRequired),
        addressUuid: z.string().min(1, addressUuidRequired),
        phone: z.string().min(1, phoneRequired),
        email: z.string().email().min(1, emailRequired),
        website: z.string().min(1, websiteRequired),
        urlGmaps: opsional,
        prov : opsional,
        city: opsional,
        district : opsional,
        village: opsional,
        postalCode: opsional,
        fullAddress: opsional,
        logo: opsional,
        bgWarna: opsional,
        codeKabupaten: opsional,
        codeProvinsi: opsional,
        lat : opsional,
        long : opsional,
        cover: opsional,
    });

    static UPDATE_PPN = z.object({
        uuid: z.string().min(1, uuidRequired),
        statusPpn: z.boolean(),
    })

    static UPDATE_BIAYA_ADMINISTRASI = z.object({
        uuid: z.string().min(1, uuidRequired),
        statusBiayaLain: z.boolean(),
    })

    static GET_PROFILE_FASKES = z.object({
        faskesUuid: z.string().min(1, "faskes_uuid tidak boleh kosong")
    })
}
