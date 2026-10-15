import { z } from 'zod';
export default class EventValidation{
    
    static LOGPELAYANAN = z.object({
        faskes_uuid: z.string().max(255),
        tgl_registrasi: z.number().int(),
        noreg: z.string().max(255),
        no_pelayanan: z.string().max(255),
        jenis_kunjungan: z.enum(["IGD", "RI", "RJ"]),
        patient_uuid: z.string().max(255),
        practitioner_uuid: z.nullable(z.string().max(255)).default(null).optional(),
        lokasi_uuid: z.nullable(z.string().max(255)).default(null).optional(),
        discharge_date: z.number().int(),
        payment_method: z.union([z.literal(1), z.literal(2)]).default(1),
    });

}