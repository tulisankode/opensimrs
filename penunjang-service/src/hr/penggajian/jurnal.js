import { query, satu, sisipkan, ubah, sekarang } from "../../db.js";
import { jurnalkanEvent, muatAturan } from "../../akuntansi/proses.js";
import { selesaikanJaspel } from "../../akuntansi/remunerasi/penggajian.js";
import { susunPenggajian } from "../../akuntansi/event.js";
import { konflik, hash } from "./bersama.js";
import { catat, pengguna } from "./dasar.js";

export const cobaJurnal = async (k, req, p) => {
  const f = req.author.faskesUuid;
  let j = await satu(`SELECT * FROM hr_gaji_jurnal WHERE faskes_uuid = $1 AND periode_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [f, p.uuid], k);
  if (p.status !== "dibayar") throw konflik("Jurnal hanya untuk periode yang telah dibayar");
  if (j?.status === "tercatat") return j;
  const rincian = await query(`SELECT r.kode, r.jenis, r.kategori, r.nilai FROM hr_gaji_rincian r JOIN hr_gaji_hasil h ON h.uuid = r.hasil_uuid AND h.faskes_uuid = r.faskes_uuid AND h.deleted_at IS NULL WHERE h.penghitungan_uuid = $2 AND r.faskes_uuid = $1 AND r.deleted_at IS NULL ORDER BY r.uuid`, [f, p.penghitungan_uuid], k);
  const ev = susunPenggajian(p, rincian);
  const sidik = hash(ev.data);
  if (j && j.hash_sumber !== sidik) throw konflik("Hash jurnal berbeda dari niat pembayaran tersimpan");
  if (!j) j = await sisipkan("hr_gaji_jurnal", { faskes_uuid: f, periode_uuid: p.uuid, kunci_sumber: ev.kunci, hash_sumber: sidik }, k);
  let hasil;
  await k.query("SAVEPOINT jurnal_penggajian");
  try {
    hasil = await jurnalkanEvent(k, f, ev, { aturan: (await muatAturan(f, k)).penggajian ?? [], pengguna: pengguna(req) });
    if (["dijurnal", "sudah"].includes(hasil.hasil) && hasil.jurnal_uuid) {
      await selesaikanJaspel(k, f, p, hasil.jurnal_uuid);
    }
    await k.query("RELEASE SAVEPOINT jurnal_penggajian");
  } catch {
    await k.query("ROLLBACK TO SAVEPOINT jurnal_penggajian");
    await k.query("RELEASE SAVEPOINT jurnal_penggajian");
    hasil = { hasil: "gagal", alasan: "Jurnal belum berhasil dicatat; periksa kesiapan Akuntansi dan sumber Remunerasi" };
  }
  const sukses = ["dijurnal", "sudah"].includes(hasil.hasil) && !!hasil.jurnal_uuid;
  const row = await ubah("hr_gaji_jurnal", j.uuid, f, { status: sukses ? "tercatat" : hasil.hasil === "tertahan" ? "tertahan" : "gagal", jurnal_uuid: sukses ? hasil.jurnal_uuid : null, percobaan: j.percobaan + 1, alasan: sukses ? null : hasil.alasan ?? "Jurnal mengalami konflik", dicoba_pada: sekarang() }, k);
  await catat(k, req, "kirim_jurnal", j.uuid, { periodeUuid: p.uuid, sesudah: sidik });
  return row;
};
