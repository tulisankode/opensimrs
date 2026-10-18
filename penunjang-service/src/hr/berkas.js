import config from "../config.js";
import { satu, sekarang, uuidv7 } from "../db.js";
import { permintaanSalah, tidakDitemukan } from "../umum/respons.js";

const validasi = (body) => {
  const nama=String(body?.nama_berkas??"").trim(), tipe=String(body?.tipe_mime??"").toLowerCase();
  if(!nama || nama.length>255) throw permintaanSalah("nama_berkas wajib diisi dan maksimal 255 karakter");
  if(!["application/pdf","image/jpeg","image/png"].includes(tipe)) throw permintaanSalah("Berkas harus berupa PDF, JPG, atau PNG");
  const encoded=String(body?.data_base64??"").replace(/^data:[^,]+,/,"");
  if(!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw permintaanSalah("data_base64 tidak valid");
  const data=Buffer.from(encoded,"base64");
  if(!data.length || data.length>config.maxUploadMutuMb*1024*1024) throw permintaanSalah(`Ukuran berkas melebihi ${config.maxUploadMutuMb} MB`);
  const tanda=tipe==="application/pdf"?data.subarray(0,5).toString()==="%PDF-":tipe==="image/png"?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data[0]===255&&data[1]===216&&data[2]===255;
  if(!tanda) throw permintaanSalah("Isi berkas tidak sesuai tipe yang dipilih");
  return {nama,tipe,data};
};

export const simpanBerkasHr = async (k,{faskesUuid,kredensialUuid,body,pengguna}) => {
  const b=validasi(body),n=sekarang();
  const jumlah=Number((await satu("SELECT COUNT(*) n FROM hr_berkas WHERE kredensial_uuid=$1 AND faskes_uuid=$2 AND deleted_at IS NULL",[kredensialUuid,faskesUuid],k)).n);
  if(jumlah>=10) throw permintaanSalah("Maksimal 10 berkas per kredensial");
  return satu(`INSERT INTO hr_berkas(uuid,faskes_uuid,jenis_berkas,kredensial_uuid,nama_berkas,tipe_mime,ukuran_bita,data,diunggah_oleh,created_at,updated_at)
    VALUES($1,$2,'dokumen_kredensial',$3,$4,$5,$6,$7,$8,$9,$9) RETURNING uuid,faskes_uuid,jenis_berkas,kredensial_uuid,nama_berkas,tipe_mime,ukuran_bita,diunggah_oleh,created_at`,
  [uuidv7(),faskesUuid,kredensialUuid,b.nama,b.tipe,b.data.length,b.data,pengguna,n],k);
};

export const ambilBerkasHr = async (kredensialUuid,berkasUuid,faskesUuid) => {
  const row=await satu("SELECT uuid,nama_berkas,tipe_mime,ukuran_bita,data FROM hr_berkas WHERE uuid=$1 AND kredensial_uuid=$2 AND faskes_uuid=$3 AND deleted_at IS NULL",[berkasUuid,kredensialUuid,faskesUuid]);
  if(!row) throw tidakDitemukan("Berkas kredensial");
  return {...row,data_base64:row.data.toString("base64")};
};
