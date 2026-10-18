import { satu } from "../db.js";
export const hitungWaktuTungguRawatJalan=async(faskesUuid,unitUuid,tanggal,ambangMenit=60)=>{
 const x=await satu(`SELECT COUNT(*) FILTER (WHERE tanggal_periksa - tanggal_checkin <= $4*60)::int AS numerator, COUNT(*) FILTER (WHERE tanggal_checkin IS NOT NULL AND tanggal_periksa IS NOT NULL)::int AS denominator, COUNT(*) FILTER (WHERE tanggal_checkin IS NULL OR tanggal_periksa IS NULL)::int AS tidak_lengkap FROM rawat_jalans WHERE faskes_uuid=$1 AND lokasi_uuid=$2 AND to_timestamp(tanggal_checkin)::date=$3 AND deleted_at IS NULL`,[faskesUuid,unitUuid,tanggal,ambangMenit]); return x;
};
export const registryOtomatis={waktu_tunggu_rawat_jalan:hitungWaktuTungguRawatJalan};
export const statusLengkap=(baris,jumlahDiharapkan)=>baris.filter(x=>["tervalidasi","terkunci"].includes(x.status)).length>=jumlahDiharapkan;
