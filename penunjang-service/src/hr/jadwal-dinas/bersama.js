import { Galat } from "../../umum/respons.js";

export const galat = (status, message, payload = null) => Object.assign(new Galat(status, message), { payload });
export const wajib = (syarat, pesan, status = 400) => { if (!syarat) throw galat(status, pesan); };
export const teks = (v, nama, maks = 2000) => {
  wajib(typeof v === "string" && v.trim().length > 0 && v.trim().length <= maks, `${nama} wajib berupa teks maksimal ${maks} karakter`);
  return v.trim();
};
export const bulat = (v, nama, min = 0, maks = Number.MAX_SAFE_INTEGER) => {
  wajib(v !== null && v !== undefined && v !== "" && Number.isSafeInteger(Number(v)) && Number(v) >= min && Number(v) <= maks, `${nama} harus berupa bilangan bulat ${min}–${maks}`);
  return Number(v);
};
export const pilihan = (v, daftar, nama) => { wajib(daftar.includes(v), `${nama} tidak sah`); return v; };
export const hari = (v) => {
  const n = bulat(v, "tanggal kerja", 0, 253402214400);
  wajib((n + 25200) % 86400 === 0, "Tanggal harus awal hari Asia/Jakarta");
  return n;
};
export const tanggalWib = (y, m, d = 1) => Date.UTC(y, m - 1, d) / 1000 - 25200;
export const bagianTanggal = (v) => {
  const t = new Date((Number(v) + 25200) * 1000);
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
};
export const bulan = (v) => { const n = hari(v); wajib(bagianTanggal(n)[2] === 1, "Periode harus tanggal pertama bulan"); return n; };
export const tanggalBulan = (v) => {
  const [y, m] = bagianTanggal(bulan(v));
  const akhir = tanggalWib(y, m + 1);
  return Array.from({ length: (akhir - Number(v)) / 86400 }, (_, i) => Number(v) + i * 86400);
};
export const validasiPola = (b) => {
  wajib(typeof b.libur === "boolean" && typeof b.lintas_hari === "boolean", "Penanda libur dan lintas hari harus boolean");
  const mulai = bulat(b.mulai_menit, "Jam mulai", 0, 1439), selesai = bulat(b.selesai_menit, "Jam selesai", 0, 1439);
  const durasi = selesai - mulai + (b.lintas_hari ? 1440 : 0);
  wajib(b.libur ? !b.lintas_hari && mulai === 0 && selesai === 0 : durasi > 0 && durasi < 1440, "Rentang shift harus lebih dari nol dan kurang dari 24 jam; libur memakai jam nol");
  return { kode: teks(b.kode, "Kode", 30), nama: teks(b.nama, "Nama", 150), mulai_menit: mulai, selesai_menit: selesai, lintas_hari: b.lintas_hari, libur: b.libur, aktif: b.aktif === undefined ? true : pilihan(b.aktif, [true, false], "Status aktif") };
};
export const rentang = (tanggal, pola) => ({
  mulai_epoch: pola.libur ? null : hari(tanggal) + pola.mulai_menit * 60,
  selesai_epoch: pola.libur ? null : hari(tanggal) + pola.selesai_menit * 60 + (pola.lintas_hari ? 86400 : 0),
  libur: pola.libur,
  potret_shift: { kode: pola.kode, nama: pola.nama, mulai_menit: pola.mulai_menit, selesai_menit: pola.selesai_menit, lintas_hari: pola.lintas_hari, libur: pola.libur },
});
export const validasiAturan = (b) => ({
  istirahat_minimum_menit: bulat(b.istirahat_minimum_menit, "Istirahat minimum", 0, 10080),
  batas_kerja_mingguan_menit: bulat(b.batas_kerja_mingguan_menit, "Batas kerja mingguan", 1, 10080),
  jenis_minggu: pilihan(b.jenis_minggu, ["kalender", "tetap"], "Jenis minggu"),
  jangkar_minggu: b.jenis_minggu === "tetap" ? hari(b.jangkar_minggu) : null,
  ...Object.fromEntries(["tingkat_istirahat", "tingkat_jam_mingguan", "tingkat_staf"].map((k) => [k, pilihan(b[k], ["pemblokir", "peringatan"], k)])),
});
export const periksaVersi = (v, k, status) => {
  wajib(Number(v.versi_kunci) === bulat(k, "Versi kunci", 1), "Versi berubah; muat ulang dan tinjau kembali", 409);
  if (status) wajib([].concat(status).includes(v.status), "Status berubah atau tindakan tidak diperbolehkan", 409);
};
export const TRANSISI = { ajukan: ["draf", "diajukan"], setujui: ["diajukan", "disetujui"], tolak: ["diajukan", "draf"], terbitkan: ["disetujui", "terbit"] };
// JSONB dapat mengubah urutan kunci; perbandingan potret harus berdasarkan isi.
export const samaPotret = (a, b) => {
  const urut = (x) => Array.isArray(x) ? x.map(urut) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, urut(x[k])])) : x;
  return JSON.stringify(urut(a)) === JSON.stringify(urut(b));
};
export const rencanaSalin = (asal, periode) => {
  const tanggal = tanggalBulan(periode), dilewati = [], penempatan = [];
  for (const p of asal) {
    const tujuan = tanggal[bagianTanggal(p.tanggal_kerja)[2] - 1];
    if (!tujuan) dilewati.push({ tanggal_kerja: p.tanggal_kerja, message: "Tanggal tidak ada pada bulan tujuan" });
    else penempatan.push({ kepegawaian_uuid: p.kepegawaian_uuid, pola_shift_uuid: p.pola_shift_uuid, tanggal_kerja: tujuan });
  }
  return { penempatan, dilewati };
};
export const rencanaRotasi = (periode, urutan, jangkar, pegawai) => {
  wajib(Array.isArray(urutan) && urutan.length > 0, "Urutan rotasi wajib diisi");
  wajib(Array.isArray(pegawai) && pegawai.every((p) => p && typeof p === "object" && !Array.isArray(p)), "Daftar pegawai rotasi tidak sah");
  hari(jangkar);
  return pegawai.flatMap((p) => tanggalBulan(periode).map((t) => ({ kepegawaian_uuid: teks(p.kepegawaian_uuid, "Pegawai", 255), tanggal_kerja: t,
    pola_shift_uuid: urutan[((Math.floor((t - jangkar) / 86400) + bulat(p.offset, "Offset", 0, 10000)) % urutan.length + urutan.length) % urutan.length] })));
};
