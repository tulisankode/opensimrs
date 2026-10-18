import express from "express";
import { query, satu, sisipkan, sekarang, ubah, transaksi } from "../db.js";
import { kirim, tangani, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { cekPegawaiDatamaster, namaPegawai, STATUS_KEPEGAWAIAN, tanganiUnik } from "./bersama.js";
import { catatAuditPusat } from "./audit.js";

const rute = express.Router();
const MODUL = "HR / SDM";
const izin = (sub, aksi) => wajibIzin(MODUL, sub, aksi);

rute.get("/", izin("Kepegawaian", "READ"), tangani(async (req, res) => {
  const f = req.author.faskesUuid;
  const q = String(req.query.q ?? "").trim();
  const unit = req.query.unit_uuid || null;
  const status = req.query.status || null;
  const belum = req.query.belum_tertaut === "1";
  if (belum) {
    kirim(res, await query(`SELECT p.uuid AS pegawai_uuid, ${namaPegawai("p")} AS nama_pegawai, p.name AS nama
      FROM pegawai p WHERE p.faskes_uuid=$1 AND p.deleted_at IS NULL AND p.status=true
        AND ($2='' OR p.name ILIKE '%' || $2 || '%')
        AND NOT EXISTS (SELECT 1 FROM hr_kepegawaian h WHERE h.pegawai_uuid=p.uuid AND h.faskes_uuid=p.faskes_uuid AND h.deleted_at IS NULL)
      ORDER BY p.name LIMIT 200`, [f,q]));
    return;
  }
  const rows = await query(`SELECT h.*, ${namaPegawai("p")} AS nama_pegawai, p.name AS nama
    FROM hr_kepegawaian h JOIN pegawai p ON p.uuid=h.pegawai_uuid
    WHERE h.faskes_uuid=$1 AND h.deleted_at IS NULL AND p.deleted_at IS NULL
      AND ($2='' OR p.name ILIKE '%' || $2 || '%' OR h.jabatan ILIKE '%' || $2 || '%')
      AND ($3::varchar IS NULL OR h.unit_uuid=$3) AND ($4::varchar IS NULL OR h.status_kepegawaian=$4)
    ORDER BY p.name LIMIT 200`, [f,q,unit,status]);
  kirim(res, rows);
}));

rute.post("/", izin("Kepegawaian", "CREATE"), tangani(async (req, res) => {
  const b = req.body ?? {}; const f = req.author.faskesUuid;
  if (!STATUS_KEPEGAWAIAN.includes(b.status_kepegawaian)) throw permintaanSalah("status_kepegawaian tidak valid");
  if (!Number.isInteger(Number(b.tanggal_mulai))) throw permintaanSalah("tanggal_mulai epoch detik wajib diisi");
  await cekPegawaiDatamaster(b.pegawai_uuid, f);
  if (b.unit_uuid && !await satu("SELECT uuid FROM lokasi WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL", [b.unit_uuid,f])) throw tidakDitemukan("Unit kerja");
  const n = sekarang();
  try {
    const row = await transaksi(async (k) => {
      const hasil = await sisipkan("hr_kepegawaian", { faskes_uuid:f, pegawai_uuid:b.pegawai_uuid, status_kepegawaian:b.status_kepegawaian,
        unit_uuid:b.unit_uuid || null, jabatan:b.jabatan || null, golongan:b.golongan || null, tanggal_mulai:Number(b.tanggal_mulai), tanggal_selesai:null,
        dibuat_oleh:req.author.username, created_at:n, updated_at:n }, k);
      if (hasil.jabatan) await sisipkan("hr_riwayat_jabatan", { faskes_uuid:f, kepegawaian_uuid:hasil.uuid, jabatan:hasil.jabatan, unit_uuid:hasil.unit_uuid, tanggal_mulai:hasil.tanggal_mulai, dicatat_oleh:req.author.username }, k);
      await catatAuditPusat(k,{faskesUuid:f,aksi:"buat",entitas:"hr_kepegawaian",entitasUuid:hasil.uuid,ringkasan:{pegawai_uuid:b.pegawai_uuid},pengguna:req.author.username});
      return hasil;
    });
    kirim(res,row,"Data kepegawaian berhasil ditambahkan");
  } catch(e) { tanganiUnik(e,"Pegawai sudah memiliki data kepegawaian aktif"); }
}));

rute.get("/:uuid", izin("Kepegawaian", "READ"), tangani(async (req,res)=>{
  const f=req.author.faskesUuid;
  const row=await satu(`SELECT h.*, ${namaPegawai("p")} AS nama_pegawai FROM hr_kepegawaian h JOIN pegawai p ON p.uuid=h.pegawai_uuid WHERE h.uuid=$1 AND h.faskes_uuid=$2 AND h.deleted_at IS NULL AND p.deleted_at IS NULL`,[req.params.uuid,f]);
  if(!row) throw tidakDitemukan("Data kepegawaian");
  row.riwayat_jabatan=await query("SELECT * FROM hr_riwayat_jabatan WHERE kepegawaian_uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL ORDER BY tanggal_mulai DESC",[row.uuid,f]);
  row.pendidikan=await query("SELECT * FROM hr_pendidikan WHERE kepegawaian_uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL ORDER BY tahun_lulus DESC NULLS LAST",[row.uuid,f]);
  kirim(res,row);
}));

rute.put("/:uuid", izin("Kepegawaian", "UPDATE"), tangani(async(req,res)=>{
  const f=req.author.faskesUuid,b=req.body??{};
  const sebelum=await satu("SELECT * FROM hr_kepegawaian WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL",[req.params.uuid,f]);
  if(!sebelum) throw tidakDitemukan("Data kepegawaian");
  const fields={};
  for(const key of ["status_kepegawaian","unit_uuid","jabatan","golongan","tanggal_mulai","tanggal_selesai"]) if(b[key]!==undefined) fields[key]=["tanggal_mulai","tanggal_selesai"].includes(key)?Number(b[key]):b[key];
  if(fields.status_kepegawaian && !STATUS_KEPEGAWAIAN.includes(fields.status_kepegawaian)) throw permintaanSalah("status_kepegawaian tidak valid");
  if (fields.unit_uuid && !await satu("SELECT uuid FROM lokasi WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL", [fields.unit_uuid,f])) throw tidakDitemukan("Unit kerja");
  const row=await transaksi(async k=>{
    const hasil=await ubah("hr_kepegawaian",req.params.uuid,f,fields,k);
    if((fields.jabatan!==undefined&&fields.jabatan!==sebelum.jabatan)||(fields.unit_uuid!==undefined&&fields.unit_uuid!==sebelum.unit_uuid)) {
      await query("UPDATE hr_riwayat_jabatan SET tanggal_selesai=$1,updated_at=$1 WHERE kepegawaian_uuid=$2 AND faskes_uuid=$3 AND tanggal_selesai IS NULL AND deleted_at IS NULL",[sekarang(),req.params.uuid,f],k);
      await sisipkan("hr_riwayat_jabatan",{faskes_uuid:f,kepegawaian_uuid:req.params.uuid,jabatan:fields.jabatan??sebelum.jabatan??"Belum ditetapkan",unit_uuid:fields.unit_uuid??sebelum.unit_uuid,tanggal_mulai:Number(b.tanggal_mulai??sekarang()),dicatat_oleh:req.author.username},k);
    }
    await catatAuditPusat(k,{faskesUuid:f,aksi:"ubah",entitas:"hr_kepegawaian",entitasUuid:hasil.uuid,ringkasan:{kolom:Object.keys(fields)},pengguna:req.author.username});
    return hasil;
  });
  kirim(res,row,"Data kepegawaian berhasil diperbarui");
}));

rute.post("/:uuid/pendidikan", izin("Kepegawaian", "UPDATE"), tangani(async(req,res)=>{
  const f=req.author.faskesUuid,b=req.body??{};
  if(!b.jenjang||!b.institusi) throw permintaanSalah("jenjang dan institusi wajib diisi");
  if(!await satu("SELECT uuid FROM hr_kepegawaian WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL",[req.params.uuid,f])) throw tidakDitemukan("Data kepegawaian");
  const row=await sisipkan("hr_pendidikan",{faskes_uuid:f,kepegawaian_uuid:req.params.uuid,jenjang:b.jenjang,institusi:b.institusi,bidang_studi:b.bidang_studi||null,tahun_lulus:b.tahun_lulus?Number(b.tahun_lulus):null,dicatat_oleh:req.author.username});
  kirim(res,row,"Riwayat pendidikan berhasil ditambahkan");
}));

rute.post("/:uuid/akun", izin("Kepegawaian", "TAUTKAN AKUN"), tangani(async(req,res)=>{
  const f=req.author.faskesUuid,username=String(req.body?.username??"").trim();
  if(!username) throw permintaanSalah("username wajib diisi");
  const peg=await satu("SELECT uuid FROM hr_kepegawaian WHERE uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL",[req.params.uuid,f]);
  if(!peg) throw tidakDitemukan("Data kepegawaian");
  if(!await satu("SELECT uuid FROM users WHERE username=$1 AND faskes_uuid=$2 AND deleted_at IS NULL",[username,f])) throw tidakDitemukan("Akun pengguna");
  try { const row=await sisipkan("hr_akun_pegawai",{faskes_uuid:f,kepegawaian_uuid:peg.uuid,username,ditautkan_oleh:req.author.username}); kirim(res,row,"Akun berhasil ditautkan"); }
  catch(e){tanganiUnik(e,"Akun sudah ditautkan ke pegawai lain");}
}));
export default rute;
