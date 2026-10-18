import express from "express";
import { query } from "../db.js";
import { kirim, tangani } from "../umum/respons.js";
import { wajibSalahSatu } from "../umum/izin.js";
import { FITUR_SDM, fiturSdmAktif, wajibFiturSdm } from "./fitur.js";
import kepegawaian from "./kepegawaian.js";
import kredensial from "./kredensial.js";

const rute=express.Router(),MODUL="HR / SDM";
rute.use(wajibFiturSdm("sdm_kepegawaian"));
rute.get("/referensi",wajibSalahSatu([MODUL,"Kepegawaian","READ"],[MODUL,"Kredensial","READ"]),tangani(async(req,res)=>{
 const fitur={};for(const kode of FITUR_SDM)fitur[kode]=await fiturSdmAktif(kode,req.author.faskesUuid);
 kirim(res,{lokasi:await query("SELECT uuid,name AS nama FROM lokasi WHERE faskes_uuid=$1 AND deleted_at IS NULL ORDER BY name",[req.author.faskesUuid]),status_kepegawaian:["tetap","kontrak","honorer","magang","purna_tugas"],jenis_kredensial:["str","sip","sertifikat_kompetensi","lainnya"],status_verifikasi:["belum_diverifikasi","terverifikasi","ditolak"],fitur});
}));
rute.use("/kepegawaian",kepegawaian);
rute.use("/kredensial",wajibFiturSdm("sdm_kredensial"),kredensial);
export default rute;
