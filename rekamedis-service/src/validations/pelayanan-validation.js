import {z} from "zod";
import {required} from "./message-validation-error.js";

export default class PelayananValidation {
    static UPDATEDIRUJUK = z.object({
        is_internal : z.boolean(),
        rujuk_internal : z.string(),
        rujuk_eksternal : z.string(),
        instruksi_tindak_lanjut : z.string().min(1, required),
        tujuan_rujuk : z.string().min(1, required),
        tujuan_rujuk_lainnya : z.string().min(1, required),
        transport_rujuk : z.string(),
        transport_rujuk_lainnya : z.string(),
        instruksi_no_darurat : z.string(),
    });

    static BEFOREUPDATE = z.object({
        rekam_medis_uuid: z.string().min(1, required),
        status_pulang : z.string().min(1, required),
        pelayanan : z.string().min(1, required),
        // Edukasi & Keadaan Waktu Pulang bisa dinonaktifkan per segmen (Setting › Manajemen Fitur),
        // jadi boleh kosong; Status Pulang tetap wajib.
        edukasi : z.string().optional().nullable(),
        edukasi_text : z.string().optional().nullable(),
        kondisi_pasien_pulang : z.string().optional().nullable(),
        discharge_date : z.number(),
        faskes_uuid : z.string().min(1, required),
    });

    static UPDATELAINNYA = z.object({
        status_pulang_keterangan : z.string().min(1, required),
    })

    static GET = z.object({
        rekam_medis_uuid: z.string().min(1, required),
        pelayanan : z.string().min(1, required),
        faskes_uuid : z.string().min(1, required),
    })

    static DISCHARGE = z.object({
        rekam_medis_uuid: z.string().min(1, required),
        pelayanan : z.string().min(1, required),
        discharge_date : z.number().min(1, required),
        faskes_uuid : z.string().min(1, required),
    })

    static CREATE_RAWAT_INAP = z.object({
        practitioner_uuid: z.string().min(1, required),
        tanggal_daftar: z.number().min(1, required),
        lokasi_uuid: z.string().min(1, required),
    })

    static INSERT_HISTORY_TINDAKAN = z.object({
        rekam_medis_uuid :z.string().min(1, required),
        faskes_uuid :z.string().min(1, required),
        lokasi_uuid :z.string().min(1, required),
        pelayanan :z.string().min(1, required),
        discharge_date :z.number().min(1, required),
    })

    // ref (opsional): referensi sumber (mis. "resep:<uuid>"); item lama dengan ref sama diganti.
    // Daftar item kosong hanya boleh bersama ref, yaitu untuk menarik tagihan order yang dibatalkan.
    static CREATE_BILLING_LAYANAN = z.object({
        session_uuid: z.string().min(1, required),
        type: z.string().min(1, required),
        ref: z.string().min(1).optional(),
        items: z.array(z.any()),
    }).refine((d) => d.items.length > 0 || !!d.ref, { message: required, path: ["items"] });
}