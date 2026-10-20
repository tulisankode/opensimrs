import { tanggalBulan } from "./bersama.js";

export const awalMinggu = (epoch, aturan) => {
  const jangkar = aturan.jenis_minggu === "tetap" ? Number(aturan.jangkar_minggu) : 4 * 86400 - 25200;
  return jangkar + Math.floor((epoch - jangkar) / 604800) * 604800;
};

export const validasiJadwal = ({ kandidat, lainnya = [], aturan, kebutuhan = [], periode }) => {
  const temuan = [];
  const tambah = (aturan, tingkat, p, rincian, message) => temuan.push({ aturan, tingkat, kepegawaian_uuid: p?.kepegawaian_uuid, tanggal_kerja: p?.tanggal_kerja, penempatan_uuid: p?.uuid, ...rincian, message });
  if (!aturan) tambah("konfigurasi", "pemblokir", null, {}, "Aturan unit belum lengkap");
  const karyawan = new Set(kandidat.map((p) => p.kepegawaian_uuid));
  const calon = new Set(kandidat);
  {
    const semua = [...kandidat, ...lainnya].filter((p) => !p.libur && karyawan.has(p.kepegawaian_uuid));
    for (const pegawai of karyawan) {
      const kerja = semua.filter((p) => p.kepegawaian_uuid === pegawai).sort((a, b) => a.mulai_epoch - b.mulai_epoch);
      for (let i = 0; i < kerja.length; i++) for (let j = i + 1; j < kerja.length; j++) {
        const a = kerja[i], b = kerja[j];
        if (!calon.has(a) && !calon.has(b)) continue;
        const p = calon.has(b) ? b : a, jeda = (Number(b.mulai_epoch) - Number(a.selesai_epoch)) / 60;
        if (jeda < 0) tambah("benturan", "pemblokir", p, {}, "Shift bertumpuk dengan penugasan lain dalam faskes");
        else if (aturan && jeda < aturan.istirahat_minimum_menit) tambah("istirahat_minimum", aturan.tingkat_istirahat, p, { jeda_menit: jeda, minimum_menit: aturan.istirahat_minimum_menit }, "Jeda istirahat kurang dari batas minimum");
      }
      if (!aturan) continue;
      const minggu = new Map(), diperiksa = new Set();
      for (const p of kerja) for (let t = Number(p.mulai_epoch); t < Number(p.selesai_epoch);) {
        const awal = awalMinggu(t, aturan), akhir = Math.min(Number(p.selesai_epoch), awal + 604800);
        if (!minggu.has(awal)) minggu.set(awal, new Map());
        const keluarga = calon.has(p) ? "kandidat" : p.jadwal_uuid;
        const versi = calon.has(p) ? "kandidat" : p.versi_uuid;
        if (!minggu.get(awal).has(keluarga)) minggu.get(awal).set(keluarga, new Map());
        const jumlah = minggu.get(awal).get(keluarga);
        jumlah.set(versi, (jumlah.get(versi) ?? 0) + (akhir - t) / 60);
        if (calon.has(p)) diperiksa.add(awal);
        t = akhir;
      }
      // Ambil durasi terbesar setiap keluarga: seluruh kombinasi revisi diperiksa tanpa menghitung versi ganda.
      for (const awal of diperiksa) {
        const aktual = [...minggu.get(awal).values()].reduce((n, versi) => n + Math.max(...versi.values()), 0);
        if (aktual > aturan.batas_kerja_mingguan_menit) tambah("jam_mingguan", aturan.tingkat_jam_mingguan, { kepegawaian_uuid: pegawai }, { minggu_mulai: awal, aktual_menit: aktual, maksimum_menit: aturan.batas_kerja_mingguan_menit }, "Jam kerja mingguan melampaui batas");
      }
    }
  }
  if (aturan) for (const tanggal of tanggalBulan(periode)) {
    const hari = new Date((tanggal + 25200) * 1000).getUTCDay();
    const pola = [...new Set(kebutuhan.map((k) => k.pola_shift_uuid))];
    for (const id of pola) {
      const k = kebutuhan.find((x) => x.pola_shift_uuid === id && Number(x.tanggal_kerja) === tanggal)
        ?? kebutuhan.find((x) => x.pola_shift_uuid === id && x.tanggal_kerja == null && Number(x.hari_minggu) === hari);
      if (!k) continue;
      const jumlah = new Set(kandidat.filter((p) => !p.libur && Number(p.tanggal_kerja) === tanggal && p.pola_shift_uuid === id).map((p) => p.kepegawaian_uuid)).size;
      if (jumlah < k.minimum_staf) tambah("kebutuhan_staf", aturan.tingkat_staf, { tanggal_kerja: tanggal }, { pola_shift_uuid: id, minimum_staf: k.minimum_staf, aktual_staf: jumlah, kekurangan: k.minimum_staf - jumlah }, "Jumlah staf kurang dari kebutuhan minimum");
    }
  }
  const unik = [...new Map(temuan.map((t) => [JSON.stringify(t), t])).values()];
  return { boleh_diajukan: !unik.some((t) => t.tingkat === "pemblokir"), temuan: unik };
};
