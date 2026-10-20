import { permintaanSalah } from "../umum/respons.js";
import { JENIS_KREDENSIAL, TIPE_BERKAS_KREDENSIAL, awalHariWib, epochOpsional, infoBerkas, teks, validasiBerkasMutu, wajibPilihan } from "./bersama.js";
import { catatAudit, cekPegawaiAktif, cekPractitioner, sisipkanBerkas, tanpaBerkas } from "./dasar.js";

// Penulis bersama menerima transaksi pemanggil: hasil pelatihan dan kredensial dibatalkan bersama bila gagal.
export const catatKredensial = async (k, req, b, maksMb) => {
  const f = req.author.faskesUuid;
  const jenis = wajibPilihan(b.jenis, JENIS_KREDENSIAL, "jenis");
  const tanggal = (v, nama) => { const n = epochOpsional(v, nama); return n == null ? null : awalHariWib(n); };
  const mulai = tanggal(b.tanggal_mulai, "tanggal_mulai"), akhir = tanggal(b.tanggal_berakhir, "tanggal_berakhir");
  if (mulai && akhir && akhir < mulai) throw permintaanSalah("tanggal_berakhir tidak boleh sebelum tanggal_mulai");
  const berkas = b.berkas == null ? null : validasiBerkasMutu(b.berkas, maksMb, TIPE_BERKAS_KREDENSIAL);
  const pegawai = await cekPegawaiAktif(b.pegawai_uuid, f, k);
  const practitioner = (await cekPractitioner(b.practitioner_uuid, pegawai.uuid, f, k)) ?? null;
  const row = await sisipkanBerkas("mutu_kredensial", {
    faskes_uuid: f, pegawai_uuid: pegawai.uuid, practitioner_uuid: practitioner, jenis,
    nomor: teks(b.nomor, "nomor", 100) ?? null, penerbit: teks(b.penerbit, "penerbit", 255) ?? null,
    uraian: teks(b.uraian, "uraian", 5000) ?? null, tanggal_mulai: mulai, tanggal_berakhir: akhir,
    status: "aktif", status_verifikasi: "belum_diverifikasi", berkas: berkas?.data ?? null,
    berkas_info: berkas ? infoBerkas(berkas) : null, dicatat_oleh: req.author.username ?? null,
  }, k);
  await catatAudit(k, req, "kredensial", row.uuid, "buat", null, row);
  return { ...tanpaBerkas(row), nama_pegawai: pegawai.nama };
};
