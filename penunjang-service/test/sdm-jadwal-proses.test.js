import { test } from "node:test";
import assert from "node:assert/strict";
import { tanggalWib } from "../src/hr/jadwal-dinas/bersama.js";
import { buatJadwal } from "../src/hr/jadwal-dinas/jadwal.js";
import { buatPersetujuan } from "../src/hr/jadwal-dinas/persetujuan.js";
import { buatTukar } from "../src/hr/jadwal-dinas/tukar.js";
import { buatMaster } from "../src/hr/jadwal-dinas/master.js";
import { lingkungan } from "./bantuan/jadwal-tiruan.js";

const f = "faskes-fiktif", periode = tanggalWib(2026, 11), t = periode + 86400;
const awal = () => ({
  hr_jadwal_dinas: [{ uuid: "j", faskes_uuid: f, unit_uuid: "unit", periode_mulai: periode, versi_aktif_uuid: null }],
  hr_jadwal_versi: [{ uuid: "v", faskes_uuid: f, jadwal_uuid: "j", status: "draf", versi_kunci: 1, nomor_versi: 1, dibuat_oleh: "penyusun" }],
  hr_pola_shift: [{ uuid: "p", faskes_uuid: f, unit_uuid: "unit", kode: "P", nama: "Pagi", mulai_menit: 420, selesai_menit: 900, lintas_hari: false, libur: false, aktif: true }],
  hr_aturan_jadwal: [{ uuid: "a", faskes_uuid: f, unit_uuid: "unit", istirahat_minimum_menit: 480, batas_kerja_mingguan_menit: 2400, jenis_minggu: "kalender", tingkat_istirahat: "pemblokir", tingkat_jam_mingguan: "pemblokir", tingkat_staf: "peringatan" }],
  hr_kewenangan_jadwal: [{ uuid: "w", faskes_uuid: f, unit_uuid: "unit", username: "manajer", kewenangan: "setujui" }],
});
const req = (b = {}, username = "penyusun", uuid = "v") => ({ author: { faskesUuid: f, username }, params: { uuid }, body: { versi_kunci: 1, ...b }, query: {} });
const siapkan = (data = awal()) => {
  const l = lingkungan(data), master = buatMaster(l.r, l.a);
  const jadwal = buatJadwal(l.r, l.a, master);
  return { ...l, jadwal, proses: buatPersetujuan(l.r, l.a, jadwal), tukar: buatTukar(l.r, l.a, jadwal) };
};
test("draf → diajukan → disetujui → terbit mencatat pelaku, versi dan peristiwa", async () => {
  const l = siapkan();
  const a = await l.proses(req(), "ajukan"); assert.equal(a.status, "diajukan"); assert.equal(a.versi_kunci, 2);
  await assert.rejects(l.proses(req({ versi_kunci: 2 }), "setujui"), { status: 403 });
  const s = await l.proses(req({ versi_kunci: 2 }, "manajer"), "setujui"); assert.equal(s.status, "disetujui");
  const p = await l.proses(req({ versi_kunci: 3 }, "penerbit"), "terbitkan"); assert.equal(p.status, "terbit");
  assert.equal(l.data().hr_jadwal_dinas[0].versi_aktif_uuid, "v"); assert.equal(l.data().hr_peristiwa_jadwal.length, 3);
  assert.ok(l.log.some(([s, p]) => s.includes("pg_advisory_xact_lock") && p[0] === `sdm-jadwal:${f}`));
});
test("versi usang, izin salah, status salah dan penolakan tanpa alasan tidak menyimpan perubahan", async () => {
  const l = siapkan(), sebelum = l.data();
  await assert.rejects(l.proses(req({ versi_kunci: 9 }), "ajukan"), { status: 409 });
  await assert.rejects(l.proses({ ...req(), tanpaIzin: true }, "ajukan"), { status: 403 });
  await assert.rejects(l.proses(req(), "terbitkan"), { status: 409 });
  assert.deepEqual(l.data(), sebelum);
  await l.proses(req(), "ajukan");
  await assert.rejects(l.proses(req({ versi_kunci: 2 }, "manajer"), "tolak"), { status: 400 });
  const hasil = await l.proses(req({ versi_kunci: 2, alasan: "Perbaiki susunan" }, "manajer"), "tolak"); assert.equal(hasil.status, "draf");
});
test("konfigurasi tidak lengkap dan temuan pemblokir menahan pengajuan", async () => {
  for (const tabel of ["hr_aturan_jadwal", "hr_kewenangan_jadwal"]) {
    const data = awal(); data[tabel] = [];
    const l = siapkan(data); await assert.rejects(l.proses(req(), "ajukan"), { status: 422 });
    assert.equal(l.data().hr_jadwal_versi[0].status, "draf");
  }
});
test("kebijakan berubah sesudah pengajuan atau persetujuan wajib ditinjau ulang", async () => {
  const l = siapkan(); await l.proses(req(), "ajukan");
  await l.r.ubah("hr_aturan_jadwal", "a", f, { batas_kerja_mingguan_menit: 2100 });
  await assert.rejects(l.proses(req({ versi_kunci: 2 }, "manajer"), "setujui"), { status: 409 });
  assert.equal(l.data().hr_jadwal_versi[0].status, "diajukan");
});
test("kegagalan catatan peristiwa membatalkan status dan hasil validasi", async () => {
  const l = siapkan(), sebelum = l.data(); l.kendali.gagal = "hr_peristiwa_jadwal";
  await assert.rejects(l.proses(req(), "ajukan"), /Kegagalan/); assert.deepEqual(l.data(), sebelum);
});
test("revisi menjaga versi terbit efektif dan menolak versi kerja kedua serta edit langsung", async () => {
  const data = awal(); data.hr_jadwal_dinas[0].versi_aktif_uuid = "v"; data.hr_jadwal_versi[0].status = "terbit";
  const l = siapkan(data);
  await assert.rejects(l.jadwal.simpan(req({ penempatan: [], hapus: [] })), { status: 409 });
  const baru = await l.proses(req({ alasan: "Perubahan kebutuhan unit" }), "revisi");
  assert.equal(baru.status, "draf"); assert.equal(baru.nomor_versi, 2); assert.equal(l.data().hr_jadwal_dinas[0].versi_aktif_uuid, "v");
  await assert.rejects(l.proses(req({ alasan: "Revisi kedua" }), "revisi"), { status: 409 });
});
test("penyimpanan sekaligus menolak benturan dan pegawai tidak layak tanpa hasil parsial", async () => {
  const data = awal();
  data.hr_jadwal_dinas.push({ uuid: "j2", faskes_uuid: f, unit_uuid: "lain", periode_mulai: periode, versi_aktif_uuid: "v2" });
  data.hr_jadwal_versi.push({ uuid: "v2", faskes_uuid: f, jadwal_uuid: "j2", status: "terbit" });
  data.hr_penempatan_shift = [{ uuid: "lain", faskes_uuid: f, versi_uuid: "v2", kepegawaian_uuid: "pegawai", tanggal_kerja: t, mulai_epoch: t + 420 * 60, selesai_epoch: t + 900 * 60, libur: false }];
  const l = siapkan(data), sebelum = l.data();
  await assert.rejects(l.jadwal.simpan(req({ penempatan: [{ kepegawaian_uuid: "pegawai", tanggal_kerja: t, pola_shift_uuid: "p" }] })), { status: 422 });
  await assert.rejects(l.jadwal.simpan(req({ penempatan: [{ kepegawaian_uuid: "nonaktif", tanggal_kerja: t, pola_shift_uuid: "p" }] })), { status: 422 });
  assert.deepEqual(l.data(), sebelum);
});
const untukTukar = () => {
  const data = awal(); data.hr_jadwal_dinas[0].versi_aktif_uuid = "v"; data.hr_jadwal_versi[0].status = "terbit";
  data.hr_penempatan_shift = [
    { uuid: "s1", faskes_uuid: f, versi_uuid: "v", kepegawaian_uuid: "pegawai-a", pola_shift_uuid: "p", tanggal_kerja: t, mulai_epoch: t + 25200, selesai_epoch: t + 54000, libur: false, potret_shift: {} },
    { uuid: "s2", faskes_uuid: f, versi_uuid: "v", kepegawaian_uuid: "pegawai-b", pola_shift_uuid: "p", tanggal_kerja: t + 86400, mulai_epoch: t + 111600, selesai_epoch: t + 140400, libur: false, potret_shift: {} },
  ];
  data.hr_akun_pegawai = [{ uuid: "ta", faskes_uuid: f, username: "akun-a", kepegawaian_uuid: "pegawai-a" }];
  return data;
};
const ajukanTukar = async (l) => l.tukar.buat({ ...req({ penempatan_asal_uuid: "s1", penempatan_pengganti_uuid: "s2", alasan: "Keperluan fiktif" }), pegawai: "pegawai-a" });
test("pengganti menolak atau pemohon membatalkan mempertahankan jadwal", async () => {
  for (const aksi of ["tanggapi", "batalkan"]) {
    const l = siapkan(untukTukar()), t = await ajukanTukar(l), penempatan = l.data().hr_penempatan_shift;
    await assert.rejects(l.tukar.proses({ ...req({ setuju: false, alasan: "Tidak tersedia" }, "salah", t.uuid), pegawai: "salah" }, aksi), { status: 403 });
    const hasil = await l.tukar.proses({ ...req({ setuju: false, alasan: "Tidak tersedia" }, "peserta", t.uuid), pegawai: aksi === "batalkan" ? "pegawai-a" : "pegawai-b" }, aksi);
    assert.equal(hasil.status, aksi === "batalkan" ? "dibatalkan" : "ditolak"); assert.deepEqual(l.data().hr_penempatan_shift, penempatan);
  }
});
test("tukar menyimpan versi pengganti; versi lama utuh dan keputusan tidak boleh oleh peserta", async () => {
  const l = siapkan(untukTukar()), t = await ajukanTukar(l);
  await l.tukar.proses({ ...req({ setuju: true }, "akun-b", t.uuid), pegawai: "pegawai-b" }, "tanggapi");
  await assert.rejects(l.tukar.proses(req({ versi_kunci: 2, setuju: true }, "akun-a", t.uuid), "putuskan"), { status: 403 });
  const hasil = await l.tukar.proses(req({ versi_kunci: 2, setuju: true }, "kepala", t.uuid), "putuskan");
  assert.equal(hasil.status, "diterapkan"); assert.equal(hasil.versi_hasil.length, 1);
  const data = l.data(), baru = data.hr_jadwal_dinas[0].versi_aktif_uuid;
  assert.notEqual(baru, "v");
  assert.equal(data.hr_penempatan_shift.find((p) => p.uuid === "s1").kepegawaian_uuid, "pegawai-a");
  assert.equal(data.hr_penempatan_shift.find((p) => p.versi_uuid === baru && p.tanggal_kerja === periode + 86400).kepegawaian_uuid, "pegawai-b");
});
test("kegagalan penulisan penempatan, penunjuk versi dan peristiwa membatalkan pertukaran", async () => {
  for (const tabel of ["hr_penempatan_shift", "hr_jadwal_dinas", "hr_peristiwa_jadwal"]) {
    const l = siapkan(untukTukar()), t = await ajukanTukar(l);
    await l.tukar.proses({ ...req({ setuju: true }, "akun-b", t.uuid), pegawai: "pegawai-b" }, "tanggapi");
    const sebelum = l.data(); l.kendali.gagal = tabel;
    await assert.rejects(l.tukar.proses(req({ versi_kunci: 2, setuju: true }, "kepala", t.uuid), "putuskan"), /Kegagalan/);
    assert.deepEqual(l.data(), sebelum);
  }
});
test("kepala menolak, versi aktif berubah, revisi berjalan dan shift dimulai tidak menerapkan pertukaran", async () => {
  for (const kasus of ["tolak", "versi", "revisi", "mulai"]) {
    const l = siapkan(untukTukar()), t = await ajukanTukar(l);
    await l.tukar.proses({ ...req({ setuju: true }, "akun-b", t.uuid), pegawai: "pegawai-b" }, "tanggapi");
    if (kasus === "versi") await l.r.ubah("hr_jadwal_dinas", "j", f, { versi_aktif_uuid: "versi-baru" });
    if (kasus === "revisi") await l.r.sisipkan("hr_jadwal_versi", { faskes_uuid: f, jadwal_uuid: "j", status: "draf" });
    if (kasus === "mulai") await l.r.ubah("hr_penempatan_shift", "s1", f, { mulai_epoch: 1 });
    const sebelum = l.data();
    if (kasus === "tolak") {
      const hasil = await l.tukar.proses(req({ versi_kunci: 2, setuju: false, alasan: "Kebutuhan unit" }, "kepala", t.uuid), "putuskan");
      assert.equal(hasil.status, "ditolak"); assert.deepEqual(l.data().hr_penempatan_shift, sebelum.hr_penempatan_shift);
    } else {
      await assert.rejects(l.tukar.proses(req({ versi_kunci: 2, setuju: true }, "kepala", t.uuid), "putuskan"), { status: 409 }); assert.deepEqual(l.data(), sebelum);
    }
  }
});
test("tukar memindahkan sel libur pada tanggal tujuan dan mempertahankan keunikan pegawai × tanggal", async () => {
  const data = untukTukar();
  data.hr_penempatan_shift.push({ ...data.hr_penempatan_shift[0], uuid: "l1", kepegawaian_uuid: "pegawai-b", mulai_epoch: null, selesai_epoch: null, libur: true });
  data.hr_penempatan_shift.push({ ...data.hr_penempatan_shift[1], uuid: "l2", kepegawaian_uuid: "pegawai-a", mulai_epoch: null, selesai_epoch: null, libur: true });
  const l = siapkan(data), t = await ajukanTukar(l);
  await l.tukar.proses({ ...req({ setuju: true }, "akun-b", t.uuid), pegawai: "pegawai-b" }, "tanggapi");
  await l.tukar.proses(req({ versi_kunci: 2, setuju: true }, "kepala", t.uuid), "putuskan");
  const id = l.data().hr_jadwal_dinas[0].versi_aktif_uuid;
  const baris = l.data().hr_penempatan_shift.filter((p) => p.versi_uuid === id);
  assert.equal(baris.length, 4); assert.equal(new Set(baris.map((p) => `${p.kepegawaian_uuid}:${p.tanggal_kerja}`)).size, 4);
  assert.equal(baris.find((p) => p.libur && p.tanggal_kerja === periode + 86400).kepegawaian_uuid, "pegawai-a");
});
test("tukar dua periode mengganti kedua penunjuk sekaligus; kegagalan penunjuk kedua membatalkan seluruhnya", async () => {
  for (const gagal of [false, true]) {
    const data = untukTukar();
    data.hr_jadwal_dinas.push({ uuid: "j2", faskes_uuid: f, unit_uuid: "unit", periode_mulai: tanggalWib(2026, 12), versi_aktif_uuid: "v2" });
    data.hr_jadwal_versi.push({ ...data.hr_jadwal_versi[0], uuid: "v2", jadwal_uuid: "j2" });
    Object.assign(data.hr_penempatan_shift[1], { versi_uuid: "v2", tanggal_kerja: tanggalWib(2026, 12, 2), mulai_epoch: tanggalWib(2026, 12, 2) + 25200, selesai_epoch: tanggalWib(2026, 12, 2) + 54000 });
    const l = siapkan(data), t = await ajukanTukar(l);
    await l.tukar.proses({ ...req({ setuju: true }, "akun-b", t.uuid), pegawai: "pegawai-b" }, "tanggapi");
    const sebelum = l.data(), ubah = l.r.ubah; let jumlah = 0;
    l.r.ubah = async (...args) => { if (gagal && args[0] === "hr_jadwal_dinas" && ++jumlah === 2) throw new Error("Penunjuk kedua gagal"); return ubah(...args); };
    const proses = l.tukar.proses(req({ versi_kunci: 2, setuju: true }, "kepala", t.uuid), "putuskan");
    if (gagal) { await assert.rejects(proses, /Penunjuk kedua/); assert.deepEqual(l.data(), sebelum); }
    else { assert.equal((await proses).versi_hasil.length, 2); assert.ok(l.data().hr_jadwal_dinas.every((j) => !["v", "v2"].includes(j.versi_aktif_uuid))); }
  }
});
test("validasi ulang tukar menolak benturan lintas unit dan tidak menutup permohonan sebagai berhasil", async () => {
  const data = untukTukar();
  data.hr_jadwal_dinas.push({ uuid: "luar", faskes_uuid: f, unit_uuid: "lain", periode_mulai: periode, versi_aktif_uuid: "vl" });
  data.hr_jadwal_versi.push({ ...data.hr_jadwal_versi[0], uuid: "vl", jadwal_uuid: "luar" });
  data.hr_penempatan_shift.push({ ...data.hr_penempatan_shift[1], uuid: "sl", versi_uuid: "vl", kepegawaian_uuid: "pegawai-a" });
  const l = siapkan(data), t = await ajukanTukar(l);
  await l.tukar.proses({ ...req({ setuju: true }, "akun-b", t.uuid), pegawai: "pegawai-b" }, "tanggapi");
  const sebelum = l.data();
  await assert.rejects(l.tukar.proses(req({ versi_kunci: 2, setuju: true }, "kepala", t.uuid), "putuskan"), { status: 422 });
  assert.deepEqual(l.data(), sebelum);
});
test("pratinjau salin tidak menulis data; pegawai tidak layak dan pola nonaktif dilaporkan", async () => {
  const data = awal();
  data.hr_jadwal_dinas.push({ uuid: "j0", faskes_uuid: f, unit_uuid: "unit", periode_mulai: tanggalWib(2026, 10) });
  data.hr_jadwal_versi.push({ uuid: "v0", faskes_uuid: f, jadwal_uuid: "j0", status: "terbit" });
  data.hr_pola_shift.push({ ...data.hr_pola_shift[0], uuid: "mati", aktif: false });
  data.hr_penempatan_shift = [
    { uuid: "lama1", faskes_uuid: f, versi_uuid: "v0", tanggal_kerja: tanggalWib(2026, 10, 1), kepegawaian_uuid: "aktif", pola_shift_uuid: "p" },
    { uuid: "lama2", faskes_uuid: f, versi_uuid: "v0", tanggal_kerja: tanggalWib(2026, 10, 2), kepegawaian_uuid: "nonaktif", pola_shift_uuid: "p" },
    { uuid: "lama3", faskes_uuid: f, versi_uuid: "v0", tanggal_kerja: tanggalWib(2026, 10, 3), kepegawaian_uuid: "aktif", pola_shift_uuid: "mati" },
  ];
  const l = siapkan(data), sebelum = l.data();
  const hasil = await l.jadwal.simpan(req({ sumber_versi_uuid: "v0", pratinjau: true }), "salin");
  assert.equal(hasil.penempatan.length, 1); assert.equal(hasil.dilewati.length, 2); assert.deepEqual(l.data(), sebelum);
});
