import express from "express";
import { query, satu, sisipkan, sekarang, ubah, transaksi } from "../db.js";
import { kirim, tangani, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { JENIS_KREDENSIAL, STATUS_VERIFIKASI, tanganiUnik } from "./bersama.js";
import { catatAuditPusat } from "./audit.js";
import { simpanBerkasHr, ambilBerkasHr } from "./berkas.js";

const rute=express.Router(),MODUL="HR / SDM";
const izin=(aksi)=>wajibIzin(MODUL,"Kredensial",aksi);
const milik=async(uuid,f,k)=>{const r=await satu("SELECT * FROM hr_kredensial WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL",[uuid,f],k);if(!r)throw tidakDitemukan("Kredensial");return r;};

rute.get("/",izin("READ"),tangani(async(req,res)=>{
 const f=req.author.faskesUuid,pegawai=req.query.kepegawaian_uuid||null,jenis=req.query.jenis||null;
 let hari=req.query.jatuh_tempo_hari;hari=hari===undefined?null:Number(hari);
 if(hari!==null&&(!Number.isInteger(hari)||hari<0||hari>3650)) throw permintaanSalah("jatuh_tempo_hari harus antara 0 hingga 3650");
 const rows=await query(`SELECT c.*,p.name AS nama_pegawai FROM hr_kredensial c JOIN hr_kepegawaian h ON h.uuid=c.kepegawaian_uuid AND h.deleted_at IS NULL JOIN pegawai p ON p.uuid=h.pegawai_uuid AND p.deleted_at IS NULL
 WHERE c.faskes_uuid=$1 AND c.deleted_at IS NULL AND ($2::varchar IS NULL OR c.kepegawaian_uuid=$2) AND ($3::varchar IS NULL OR c.jenis=$3)
 AND ($4::bigint IS NULL OR c.tanggal_berakhir<=($5::bigint+$4::bigint*86400)) ORDER BY c.tanggal_berakhir NULLS LAST LIMIT 500`,[f,pegawai,jenis,hari,sekarang()]);
 kirim(res,rows);
}));

rute.post("/",izin("CREATE"),tangani(async(req,res)=>{
 const b=req.body??{},f=req.author.faskesUuid;
 if(!JENIS_KREDENSIAL.includes(b.jenis)) throw permintaanSalah("jenis kredensial tidak valid");
 if(!b.kepegawaian_uuid||!b.nomor) throw permintaanSalah("kepegawaian_uuid dan nomor wajib diisi");
 if(b.tanggal_berakhir!==undefined&&b.tanggal_terbit!==undefined&&Number(b.tanggal_berakhir)<Number(b.tanggal_terbit)) throw permintaanSalah("tanggal_berakhir tidak boleh mendahului tanggal_terbit");
 if(!await satu("SELECT uuid FROM hr_kepegawaian WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL",[b.kepegawaian_uuid,f])) throw tidakDitemukan("Data kepegawaian");
 try{const row=await transaksi(async k=>{const hasil=await sisipkan("hr_kredensial",{faskes_uuid:f,kepegawaian_uuid:b.kepegawaian_uuid,jenis:b.jenis,nomor:String(b.nomor),penerbit:b.penerbit||null,tanggal_terbit:b.tanggal_terbit==null?null:Number(b.tanggal_terbit),tanggal_berakhir:b.tanggal_berakhir==null?null:Number(b.tanggal_berakhir),status_verifikasi:"belum_diverifikasi",dicatat_oleh:req.author.username},k);await catatAuditPusat(k,{faskesUuid:f,aksi:"buat",entitas:"hr_kredensial",entitasUuid:hasil.uuid,ringkasan:{jenis:b.jenis},pengguna:req.author.username});return hasil;});kirim(res,row,"Kredensial berhasil ditambahkan");}catch(e){tanganiUnik(e);}
}));

rute.put("/:uuid",izin("UPDATE"),tangani(async(req,res)=>{
 const f=req.author.faskesUuid,b=req.body??{},awal=await milik(req.params.uuid,f);
 const fields={};for(const x of ["jenis","nomor","penerbit","tanggal_terbit","tanggal_berakhir"])if(b[x]!==undefined)fields[x]=["tanggal_terbit","tanggal_berakhir"].includes(x)?(b[x]===null?null:Number(b[x])):b[x];
 if(fields.jenis&&!JENIS_KREDENSIAL.includes(fields.jenis))throw permintaanSalah("jenis kredensial tidak valid");
 const row=await transaksi(async k=>{const hasil=await ubah("hr_kredensial",req.params.uuid,f,fields,k);await catatAuditPusat(k,{faskesUuid:f,aksi:"ubah",entitas:"hr_kredensial",entitasUuid:hasil.uuid,ringkasan:{jenis:hasil.jenis,kolom:Object.keys(fields)},pengguna:req.author.username});return hasil;});
 kirim(res,row,"Kredensial berhasil diperbarui");
}));

rute.put("/:uuid/verifikasi",izin("VERIFIKASI"),tangani(async(req,res)=>{
 const f=req.author.faskesUuid,b=req.body??{};if(!STATUS_VERIFIKASI.filter(x=>x!=="belum_diverifikasi").includes(b.status_verifikasi))throw permintaanSalah("status_verifikasi tidak valid");
 await milik(req.params.uuid,f);
 const row=await transaksi(async k=>{const hasil=await ubah("hr_kredensial",req.params.uuid,f,{status_verifikasi:b.status_verifikasi,catatan_verifikasi:b.catatan_verifikasi||null,diverifikasi_oleh:req.author.username,diverifikasi_pada:sekarang()},k);await catatAuditPusat(k,{faskesUuid:f,aksi:"verifikasi",entitas:"hr_kredensial",entitasUuid:hasil.uuid,ringkasan:{status_verifikasi:hasil.status_verifikasi},pengguna:req.author.username});return hasil;});
 kirim(res,row,"Status verifikasi kredensial berhasil diperbarui");
}));

rute.post("/:uuid/berkas",izin("UNGGAH DOKUMEN"),tangani(async(req,res)=>{const f=req.author.faskesUuid;await milik(req.params.uuid,f);const row=await transaksi(k=>simpanBerkasHr(k,{faskesUuid:f,kredensialUuid:req.params.uuid,body:req.body,pengguna:req.author.username}));kirim(res,row,"Berkas kredensial berhasil diunggah");}));
rute.get("/:uuid/berkas/:berkasUuid",izin("READ"),tangani(async(req,res)=>{const f=req.author.faskesUuid;await milik(req.params.uuid,f);const row=await ambilBerkasHr(req.params.uuid,req.params.berkasUuid,f);await transaksi(k=>catatAuditPusat(k,{faskesUuid:f,aksi:"baca",entitas:"hr_berkas",entitasUuid:row.uuid,ringkasan:{jenis:"dokumen_kredensial"},pengguna:req.author.username}));delete row.data;kirim(res,row);}));
export default rute;
