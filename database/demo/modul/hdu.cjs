'use strict';

// Transaksi demo HDU (fitur rawat_inap_hdu). Membuat ruang HDU baru (lokasi Room + ruangan + bed + tarif sewa) agar kamar/bed
// bangsal yang sudah ada tidak diubah, lalu konfigurasi unit + kebijakan observasi (hdu_konfigurasi, hdu_instruksi_observasi
// tanpa episode), episode 60 hari terakhir (hdu_episode) beserta admisi rawat inap, perpindahan bangsal ⇄ HDU (perpindahans,
// riwayat_ruangan), instruksi observasi per episode, dan serah terima masuk/keluar (hdu_serah_terima).
// Alur: bangsal → serah terima masuk dikonfirmasi (perpindahan approve, episode aktif) → serah terima keluar dikonfirmasi
// (perpindahan ke bangsal, episode selesai) → pulang. Beberapa episode terakhir tetap aktif di bed HDU baru; pada RS kelas A/B
// satu episode aktif menunggu konfirmasi serah terima keluar (perpindahan pending, status_ri 2).
const JAM = 3600;
const HARI = 86400;
const JUMLAH = { rs_a: 25, rs_b: 15, rs_c: 10, rs_d: 5 };
const BED = { rs_a: 6, rs_b: 4, rs_c: 4, rs_d: 3 };
const AKTIF = { rs_a: 3, rs_b: 2, rs_c: 1, rs_d: 1 };
const MENUNGGU = { rs_a: 1, rs_b: 1 };
const KELAS = { 'Kelas 1': 1, 'Kelas 2': 2, 'Kelas 3': 3, VIP: 4, VVIP: 5 };

// Kasus klinis fiktif dewasa yang lazim dirawat di HDU (step-up dari bangsal atau step-down dari ICU).
const KASUS = [
  { keluhan: 'Nyeri perut', kondisi: 'Pasca laparotomi eksplorasi atas indikasi peritonitis, sadar penuh, TD 108/68 mmHg, nadi 104x/menit, SpO2 96% nasal kanul 3 lpm, drain serosanguinis 80 mL.',
    terapi: 'Ceftriaxone 2 g/24 jam IV, metronidazol 500 mg/8 jam IV, analgesik kontinu, RL 1.500 mL/24 jam.', lanjut: 'Pantau EWS dan balans cairan per jam, cek Hb dan elektrolit besok pagi.',
    kondisiKeluar: 'Hemodinamik stabil tanpa topangan, bising usus positif, sudah mobilisasi duduk.', lanjutKeluar: 'Lanjut perawatan bangsal bedah, diet cair bertahap, aff drain bila produksi <50 mL/hari.' },
  { keluhan: 'Sesak napas', kondisi: 'Pneumonia komunitas dengan gagal napas tipe I, RR 28x/menit, SpO2 92% dengan NRM 10 lpm, kesadaran compos mentis.',
    terapi: 'Levofloxacin 750 mg/24 jam IV, nebulisasi salbutamol/8 jam, oksigen NRM dititrasi SpO2 ≥94%.', lanjut: 'Evaluasi AGD 6 jam, siapkan HFNC bila SpO2 <90%.',
    kondisiKeluar: 'RR 20x/menit, SpO2 96% nasal kanul 2 lpm, demam turun.', lanjutKeluar: 'Lanjut antibiotik sesuai jadwal, fisioterapi dada, rontgen toraks ulang 3 hari.' },
  { keluhan: 'Nyeri kepala hebat', kondisi: 'Krisis hipertensi (TD 220/124 mmHg) tanpa defisit neurologis, nyeri kepala VAS 6.',
    terapi: 'Nikardipin drip 5 mg/jam dititrasi, target penurunan MAP 20% dalam 1 jam pertama.', lanjut: 'Pantau TD tiap 15 menit selama titrasi, cek fungsi ginjal dan urinalisis.',
    kondisiKeluar: 'TD 148/88 mmHg dengan obat oral, nyeri kepala hilang.', lanjutKeluar: 'Amlodipin 10 mg/24 jam dan candesartan 16 mg/24 jam per oral, edukasi diet rendah garam.' },
  { keluhan: 'Lemas dan muntah', kondisi: 'Ketoasidosis diabetik derajat sedang (GDS 486 mg/dL, keton urin +3, pH 7,21), dehidrasi sedang.',
    terapi: 'Insulin drip 0,1 U/kgBB/jam, NaCl 0,9% sesuai protokol KAD, koreksi kalium.', lanjut: 'Cek GDS tiap jam, elektrolit dan AGD tiap 4 jam.',
    kondisiKeluar: 'Asidosis teratasi, GDS 180–220 mg/dL dengan insulin subkutan, sudah makan.', lanjutKeluar: 'Insulin basal-bolus, edukasi diabetes, kontrol poli penyakit dalam.' },
  { keluhan: 'Kelemahan anggota gerak', kondisi: 'Stroke iskemik akut hari ke-2, hemiparesis kanan, GCS E4M6V4, menelan belum aman.',
    terapi: 'Aspirin 160 mg/24 jam, atorvastatin 40 mg/24 jam, cairan NaCl 0,9% 1.500 mL/24 jam, NGT terpasang.', lanjut: 'Pantau GCS dan pupil tiap jam, posisi kepala 30°, uji menelan oleh terapis.',
    kondisiKeluar: 'GCS 15, defisit motorik membaik, uji menelan lulus untuk diet lunak.', lanjutKeluar: 'Lanjut rehabilitasi medik di bangsal saraf, cegah dekubitus dan aspirasi.' },
  { keluhan: 'Muntah darah', kondisi: 'Perdarahan saluran cerna atas pasca endoskopi hemostasis, Hb 7,8 g/dL setelah transfusi 2 kantong PRC.',
    terapi: 'Omeprazol drip 8 mg/jam, transfusi PRC sesuai target Hb ≥8 g/dL, puasa 24 jam.', lanjut: 'Pantau tanda perdarahan ulang, cek Hb tiap 12 jam.',
    kondisiKeluar: 'Tidak ada perdarahan ulang 48 jam, Hb 9,4 g/dL, toleransi diet cair.', lanjutKeluar: 'Omeprazol oral 2x40 mg, rencana endoskopi evaluasi, hindari OAINS.' },
  { keluhan: 'Sesak napas', kondisi: 'PPOK eksaserbasi akut, RR 26x/menit, SpO2 88% dengan nasal kanul 4 lpm, pCO2 58 mmHg tanpa asidosis berat.',
    terapi: 'Nebulisasi ipratropium-salbutamol/6 jam, metilprednisolon 62,5 mg/12 jam IV, oksigen target SpO2 88–92%.', lanjut: 'AGD ulang 2 jam, pertimbangkan NIV bila pH <7,35.',
    kondisiKeluar: 'Sesak berkurang, SpO2 91% nasal kanul 2 lpm, mampu bicara kalimat penuh.', lanjutKeluar: 'Lanjut bronkodilator inhalasi, taper steroid oral, rehabilitasi paru.' },
  { keluhan: 'Rencana operasi', kondisi: 'Pasca kraniotomi evakuasi hematom subdural kronik hari ke-1, GCS 15, drain subdural terpasang.',
    terapi: 'Ceftriaxone profilaksis, parasetamol 1 g/8 jam IV, levetiracetam 500 mg/12 jam.', lanjut: 'Pantau GCS dan pupil tiap jam, CT kepala evaluasi besok.',
    kondisiKeluar: 'GCS 15 stabil, drain sudah dilepas, CT evaluasi tanpa perdarahan ulang.', lanjutKeluar: 'Mobilisasi bertahap di bangsal bedah saraf, rawat luka operasi.' },
  { keluhan: 'Demam tinggi', kondisi: 'Sepsis sumber saluran kemih pasca perawatan ICU 3 hari, tanpa vasopresor 24 jam, laktat 1,6 mmol/L.',
    terapi: 'Meropenem 1 g/8 jam IV sesuai kultur, cairan rumatan, kateter urin terpasang.', lanjut: 'Pantau MAP ≥65 mmHg dan diuresis ≥0,5 mL/kg/jam, kultur ulang bila demam.',
    kondisiKeluar: 'Afebris 48 jam, hemodinamik stabil, diuresis cukup.', lanjutKeluar: 'De-eskalasi antibiotik oral sesuai kultur, aff kateter urin.' },
];
const INSTRUKSI_AWAL = [
  [900, 'Hemodinamik belum stabil pada titrasi obat; observasi tanda vital tiap 15 menit.'],
  [1800, 'Risiko perburukan respirasi; observasi tanda vital dan SpO2 tiap 30 menit.'],
  [1800, 'Pemantauan neurologis ketat; GCS dan pupil tiap 30 menit.'],
];
const INSTRUKSI_LANJUT = [
  [3600, 'Kondisi membaik dan stabil 12 jam; observasi kembali tiap 1 jam.'],
  [7200, 'Persiapan pindah ke bangsal; observasi tiap 2 jam.'],
];

const pad2 = (n) => String(n).padStart(2, '0');
const petugas = (M, pola) => { const u = M.users.filter((x) => pola.test(x.username)); return u.length ? u : M.users; };
const lain = (ctx, daftar, kecuali) => ctx.pilih(daftar.filter((u) => u.uuid !== kecuali?.uuid).length ? daftar.filter((u) => u.uuid !== kecuali?.uuid) : daftar);

// Ruang perawatan baru di lantai rawat inap: lokasi Room (uuid sama dengan ruangan) + lokasi Bed + room_monitorings + tarif sewa.
async function buatRuang(ctx, { akhiran, nama, kelas, urutan = 0, jumlah, harga, dibuat }) {
  const lantai = await ctx.satu(`SELECT uuid, phone, email, url, kategori_ruangan_uuid FROM lokasi
    WHERE faskes_uuid = $1 AND code = $2 AND deleted_at IS NULL`, [ctx.faskes, `${ctx.F.kode}-LT2`])
    ?? await ctx.satu(`SELECT part_of_uuid AS uuid, phone, email, url, kategori_ruangan_uuid FROM lokasi
      WHERE faskes_uuid = $1 AND location_type = 'Room' AND pelayanan = 'RI' AND deleted_at IS NULL ORDER BY code LIMIT 1`, [ctx.faskes]);
  if (!lantai) throw new Error('Kamar rawat inap demo belum ada (jalankan npm run db:demo:seed)');
  const kode = `${ctx.F.kode}-${akhiran}`;
  // Nomor kamar lanjutan (seperti seeder ICU) agar tidak sama dengan kamar buatan seeder lain.
  const maks = await ctx.satu(`SELECT COALESCE(MAX(no_room), 200) AS n FROM lokasi WHERE faskes_uuid = $1 AND location_type = 'Room' AND deleted_at IS NULL`, [ctx.faskes]);
  const noRoom = Number(maks.n) + 1 + urutan;
  const umum = { phone: lantai.phone, email: lantai.email, url: lantai.url, is_poli: false, status: true, pelayanan: 'RI',
    kategori_ruangan_uuid: lantai.kategori_ruangan_uuid, class_code: String(KELAS[kelas]), class_name: kelas, created_at: dibuat };
  const kamar = ctx.tambah('lokasi', { ...umum, code: kode, name: nama, description: nama, location_type: 'Room', part_of_uuid: lantai.uuid, no_room: noRoom });
  ctx.tambah('ruangan', { uuid: kamar.uuid, code: kode, name: nama, no_room: noRoom, kategori_ruangan_uuid: lantai.kategori_ruangan_uuid,
    kelas_ruangan: KELAS[kelas], status: true, created_at: dibuat });
  const beds = [];
  for (let b = 1; b <= jumlah; b++) {
    const lok = ctx.tambah('lokasi', { ...umum, code: `${kode}-B${b}`, name: `Bed ${b} - ${nama}`, description: `Bed ${b} - ${nama}`,
      location_type: 'Bed', part_of_uuid: kamar.uuid, no_room: b });
    beds.push(ctx.tambah('room_monitorings', { room_uuid: kamar.uuid, lokasi_uuid: lok.uuid, no_bed: String(b), type: 'Bed',
      status_operasional: 'Tersedia', status: true, patient_uuid: null, created_at: dibuat }));
  }
  ctx.tambah('tarif', { jenis_tarif: 'Ruangan', code: `TR-${akhiran}`, name: `Sewa Kamar ${nama} (${kelas})`, grand_total: harga, mode: 'Single',
    is_mcu: false, lokasi_uuid: kamar.uuid, status: true, tindakan: '[]', unit_pelayanan: JSON.stringify([{ unit_pelayanan: 'Rawat Inap' }]),
    penjamin: JSON.stringify(ctx.M.penjamin.map((p) => ({ penjamin_uuid: p.uuid, penjamin_name: p.name, harga }))), created_at: dibuat });
  return { kamar, beds };
}

module.exports = {
  kode: 'hdu',
  nama: 'HDU',
  tahap: 1,
  modul: ['rawat_inap'],
  fitur: ['rawat_inap_hdu'],
  seed: async (ctx) => {
    const { M, SEKARANG, antara, pilih, peluang } = ctx;
    const seg = M.faskes.segmen;
    if (!JUMLAH[seg]) return `tidak diisi: HDU hanya untuk rumah sakit (segmen ${seg})`;
    const N = JUMLAH[seg];
    const nAktif = AKTIF[seg] ?? 1;
    const nMenunggu = MENUNGGU[seg] ?? 0;
    if (!M.users.length || !M.bed.length) throw new Error('User/bed rawat inap demo belum ada (jalankan npm run db:demo:seed)');
    const perawat = petugas(M, /perawat/);
    const dokter = petugas(M, /\.dr\./);
    const awal = SEKARANG - (ctx.HARI + 14) * HARI;

    const { kamar, beds } = await buatRuang(ctx, { akhiran: 'HDU', nama: 'Ruang HDU', kelas: 'Kelas 1', jumlah: BED[seg] ?? 3, harga: 1200000, dibuat: awal });
    const admin = petugas(M, /admin/)[0] ?? M.users[0];
    const konf = ctx.tambah('hdu_konfigurasi', { ruangan_uuid: kamar.uuid, nama: 'HDU Dewasa', aktif: true, versi: 1, pencatat: admin.uuid, created_at: awal });
    // Kebijakan observasi unit: versi awal tiap 2 jam, direvisi SPO menjadi tiap 1 jam di tengah periode. Ditambahkan setelah
    // episode karena tabel instruksi juga merujuk hdu_episode (urutan insert kerangka = urutan kemunculan tabel).
    const kebijakan = [[awal + JAM, 7200, 'Kebijakan awal unit HDU: observasi tanda vital dan skor peringatan dini tiap 2 jam.'],
      [SEKARANG - Math.floor(ctx.HARI / 2) * HARI, 3600, 'Revisi SPO observasi HDU: tanda vital dan skor peringatan dini tiap 1 jam.']];
    const tambahKebijakan = () => kebijakan.forEach(([t, interval, alasan]) => {
      konf.versi += 1;
      ctx.tambah('hdu_instruksi_observasi', { konfigurasi_uuid: konf.uuid, episode_uuid: null, interval_detik: interval, berlaku_mulai: t,
        alasan, versi: konf.versi, pencatat: admin.uuid, created_at: t });
      konf.updated_at = t;
    });

    // Pasien dewasa lengkap (alamat & tanggal lahir) tanpa rawat inap aktif/baru-baru ini agar tidak bertumpuk dengan admisi lain.
    const kandidat = await ctx.baris(`SELECT p.uuid, p.name, p.no_rm, p.gender, p.birth_detail_uuid FROM patients p
      JOIN birth_details b ON b.uuid = p.birth_detail_uuid AND b.deleted_at IS NULL
      JOIN addresses a ON a.uuid = p.address_uuid AND a.deleted_at IS NULL
      WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND COALESCE(p.is_new_born, false) = false
        AND p.gender IN ('Laki-laki', 'Perempuan') AND b.birth_date < now() - interval '18 years'
        AND NOT EXISTS (SELECT 1 FROM rawat_inaps r WHERE r.patient_uuid = p.uuid AND r.faskes_uuid = p.faskes_uuid
          AND r.deleted_at IS NULL AND (r.discharge_date IS NULL OR r.tanggal_daftar >= $2))
      ORDER BY p.no_rm LIMIT 500`, [ctx.faskes, SEKARANG - (ctx.HARI + 7) * HARI]);
    const pasien = ctx.acakSebagian(kandidat, N);
    // Bed bangsal kosong sebagai tujuan serah terima keluar yang masih menunggu (tidak diubah oleh seeder).
    const terisi = new Set((await ctx.baris(`SELECT monitoring_room_uuid FROM rawat_inaps WHERE faskes_uuid = $1 AND deleted_at IS NULL
      AND discharge_date IS NULL AND status_ri IN (1, 2, 3)`, [ctx.faskes])).map((r) => r.monitoring_room_uuid));
    const bedKosong = M.bed.filter((b) => !b.patient_uuid && !terisi.has(b.uuid));

    const perBed = Math.ceil(N / beds.length);
    const mulaiJendela = SEKARANG - (ctx.HARI - 1) * HARI;
    const slot = Math.floor((SEKARANG - mulaiJendela) / perBed);
    let aktif = 0;
    let menunggu = 0;
    for (let i = 0; i < N; i++) {
      const b = i % beds.length;
      const s = Math.floor(i / beds.length);
      const bed = beds[b];
      const isAktif = i + beds.length >= N && b < nAktif;
      const isMenunggu = isAktif && b < nMenunggu && bedKosong.length > 0;
      const kasus = pilih(KASUS);
      const dpjp = ctx.pilihDokter();

      // Waktu: t1 masuk HDU, t2 keluar HDU, t3 pulang.
      let t1;
      let t2 = null;
      if (isAktif) t1 = SEKARANG - antara(4 * JAM, 72 * JAM);
      else {
        const awalSlot = mulaiJendela + s * slot;
        const batas = Math.min(awalSlot + slot, SEKARANG - 2 * HARI) - 3 * JAM;
        t1 = awalSlot + antara(0, Math.floor(slot * 0.3));
        t2 = Math.min(t1 + antara(20 * JAM, 4 * HARI), batas);
        if (t2 - t1 < 12 * JAM) t1 = t2 - antara(12, 20) * JAM;
      }
      const t3 = t2 ? Math.min(t2 + antara(1 * HARI, 4 * HARI), SEKARANG - antara(2, 10) * JAM) : null;
      const daftar = t1 - antara(6 * JAM, 48 * JAM);
      const dirawat = daftar + antara(30, 120) * 60;
      const p = pasien[i] ?? ctx.pasien({ baru: true, umur: [25, 80], waktu: daftar });
      const asal = pilih(M.bed);
      const tujuanKeluar = isMenunggu ? bedKosong[menunggu % bedKosong.length] : pilih(M.bed);
      const rawatPetugas = pilih(perawat);

      const ri = ctx.tambah('rawat_inaps', {
        payment_method: peluang(0.6) ? 2 : 1, no_reg: ctx.kode('RIDHDU', daftar), no_pelayanan: ctx.kode('PLDHDU', daftar), upgrade_class: false, patient_uuid: p.uuid, name: p.name, no_rm: p.no_rm, gender: p.gender,
        birth_detail_uuid: p.birth_detail_uuid ?? null, practitioner_uuid: dpjp?.uuid ?? null, tanggal_daftar: daftar, tanggal_dirawat: dirawat,
        status_ri: isAktif ? (isMenunggu ? 2 : 3) : 4, encounter: pilih(['IGD', 'IGD', 'RJ']), complaint: kasus.keluhan,
        monitoring_room_uuid: isAktif ? bed.uuid : tujuanKeluar.uuid, lokasi_uuid: isAktif ? kamar.uuid : tujuanKeluar.room_uuid,
        no_spri: `SPRI/DHDU/${ctx.yymmdd(daftar)}/${ctx.pad(ctx.nomor(), 5)}`, discharge_date: t3, status_pulang: t3 ? 'home' : null,
        kondisi_pasien_pulang: t3 ? pilih(['268910001', '268910001', '359746009']) : null, petugas: rawatPetugas.username, status: true,
        created_at: daftar, updated_at: t3 ?? t1,
      });
      ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: asal.uuid, status: true, created_at: dirawat, updated_at: t1 });
      ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: bed.uuid, status: true, created_at: t1, updated_at: t2 ?? t1 });

      // Serah terima masuk: perpindahan diminta bangsal, disiapkan perawat pengirim, dikonfirmasi perawat HDU (berbeda).
      const pengirim = pilih(perawat);
      const penerima = lain(ctx, perawat, pengirim);
      const kejadianMasuk = Math.max(dirawat + 10 * 60, t1 - antara(10, 40) * 60);
      const pMasuk = ctx.tambah('perpindahans', { petugas: pengirim.username, admission_ri_uuid: ri.uuid, origin_monitoring_room_uuid: asal.uuid,
        destination_monitoring_room_uuid: bed.uuid, waktu_pindah: t1, keterangan: `Pindah ke HDU: ${kasus.keluhan.toLowerCase()}, butuh observasi ketat`,
        status_pindah: 'approve', status: true, created_at: Math.max(dirawat + 5 * 60, kejadianMasuk - antara(5, 60) * 60), updated_at: t1 });
      const konfirmasiMasuk = t1 + antara(1, 10) * 60;
      const ep = ctx.tambah('hdu_episode', {
        konfigurasi_uuid: konf.uuid, pasien_uuid: p.uuid, rawat_inap_uuid: ri.uuid, rekam_medis_uuid: null, room_monitoring_uuid: bed.uuid,
        perpindahan_masuk_uuid: pMasuk.uuid, perpindahan_keluar_uuid: null, status: 'aktif', waktu_masuk: t1, waktu_keluar: null, versi: 1,
        pencatat: penerima.uuid, created_at: konfirmasiMasuk, updated_at: konfirmasiMasuk,
      });
      ctx.tambah('hdu_serah_terima', { episode_uuid: ep.uuid, perpindahan_uuid: pMasuk.uuid, arah: 'masuk',
        ringkasan: { kondisi: kasus.kondisi, terapi_berjalan: kasus.terapi, tindak_lanjut: kasus.lanjut }, tujuan_icu: false,
        pengirim: pengirim.uuid, penerima: penerima.uuid, waktu_kejadian: kejadianMasuk, waktu_konfirmasi: konfirmasiMasuk, waktu_penerimaan: t1,
        versi: 2, created_at: Math.min(kejadianMasuk + antara(1, 5) * 60, t1), updated_at: konfirmasiMasuk });

      // Instruksi observasi episode (menggantikan kebijakan unit): ketat di awal, dilonggarkan saat membaik.
      const akhirEpisode = t2 ?? SEKARANG - 10 * 60;
      if (peluang(0.65)) {
        const [interval, alasan] = pilih(INSTRUKSI_AWAL);
        const berlaku = konfirmasiMasuk + antara(5, 60) * 60;
        if (berlaku < akhirEpisode) {
          ep.versi += 1;
          ctx.tambah('hdu_instruksi_observasi', { konfigurasi_uuid: konf.uuid, episode_uuid: ep.uuid, interval_detik: interval, berlaku_mulai: berlaku,
            alasan, versi: ep.versi, pencatat: pilih(dokter).uuid, created_at: berlaku });
          ep.updated_at = berlaku;
          const berlaku2 = berlaku + antara(12, 30) * JAM;
          if (peluang(0.7) && berlaku2 < akhirEpisode) {
            const [interval2, alasan2] = pilih(INSTRUKSI_LANJUT);
            ep.versi += 1;
            ctx.tambah('hdu_instruksi_observasi', { konfigurasi_uuid: konf.uuid, episode_uuid: ep.uuid, interval_detik: interval2, berlaku_mulai: berlaku2,
              alasan: alasan2, versi: ep.versi, pencatat: pilih(dokter).uuid, created_at: berlaku2 });
            ep.updated_at = berlaku2;
          }
        }
      }

      if (isAktif) {
        aktif += 1;
        Object.assign(bed, { patient_uuid: p.uuid, status_operasional: 'Penuh', updated_at: t1 });
        if (isMenunggu) {
          // Serah terima keluar sudah disiapkan perawat HDU, menunggu konfirmasi bangsal tujuan.
          const diminta = SEKARANG - antara(30, 120) * 60;
          const pKeluar = ctx.tambah('perpindahans', { petugas: penerima.username, admission_ri_uuid: ri.uuid, origin_monitoring_room_uuid: bed.uuid,
            destination_monitoring_room_uuid: tujuanKeluar.uuid, waktu_pindah: null, keterangan: 'Kondisi stabil, rencana pindah ke bangsal',
            status_pindah: 'pending', status: true, created_at: diminta, updated_at: diminta });
          const kejadian = diminta + antara(5, 20) * 60;
          ctx.tambah('hdu_serah_terima', { episode_uuid: ep.uuid, perpindahan_uuid: pKeluar.uuid, arah: 'keluar',
            ringkasan: { kondisi: kasus.kondisiKeluar, terapi_berjalan: kasus.terapi, tindak_lanjut: kasus.lanjutKeluar }, tujuan_icu: false,
            pengirim: penerima.uuid, penerima: null, waktu_kejadian: kejadian, waktu_konfirmasi: null, waktu_penerimaan: null, versi: 1,
            created_at: kejadian + 60, updated_at: kejadian + 60 });
          menunggu += 1;
        }
        continue;
      }

      // Serah terima keluar ke bangsal: disiapkan perawat HDU, dikonfirmasi perawat bangsal.
      const penerimaBangsal = lain(ctx, perawat, penerima);
      const kejadianKeluar = Math.max(t1 + 30 * 60, t2 - antara(10, 40) * 60);
      const pKeluar = ctx.tambah('perpindahans', { petugas: penerima.username, admission_ri_uuid: ri.uuid, origin_monitoring_room_uuid: bed.uuid,
        destination_monitoring_room_uuid: tujuanKeluar.uuid, waktu_pindah: t2, keterangan: 'Kondisi stabil, pindah ke bangsal',
        status_pindah: 'approve', status: true, created_at: kejadianKeluar - antara(5, 60) * 60, updated_at: t2 });
      const konfirmasiKeluar = t2 + antara(1, 10) * 60;
      ctx.tambah('hdu_serah_terima', { episode_uuid: ep.uuid, perpindahan_uuid: pKeluar.uuid, arah: 'keluar',
        ringkasan: { kondisi: kasus.kondisiKeluar, terapi_berjalan: kasus.terapi, tindak_lanjut: kasus.lanjutKeluar }, tujuan_icu: false,
        pengirim: penerima.uuid, penerima: penerimaBangsal.uuid, waktu_kejadian: kejadianKeluar, waktu_konfirmasi: konfirmasiKeluar, waktu_penerimaan: t2,
        versi: 2, created_at: Math.min(kejadianKeluar + antara(1, 5) * 60, t2), updated_at: konfirmasiKeluar });
      Object.assign(ep, { status: 'selesai', waktu_keluar: t2, perpindahan_keluar_uuid: pKeluar.uuid, versi: ep.versi + 1, updated_at: konfirmasiKeluar });
      ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: tujuanKeluar.uuid, status: true, created_at: t2, updated_at: t3 });
    }
    tambahKebijakan();
    return `${N} episode HDU (${aktif} aktif, ${menunggu} menunggu serah terima keluar), ${beds.length} bed, kebijakan observasi v${konf.versi}`;
  },
};

// Bantuan bersama untuk seeder NICU/PICU (database/demo/modul/nicu.cjs, picu.cjs).
module.exports.buatRuang = buatRuang;
module.exports.petugas = petugas;
module.exports.lain = lain;
module.exports.pad2 = pad2;
