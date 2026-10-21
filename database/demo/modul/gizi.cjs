'use strict';

// Data demo Gizi rawat inap (penunjang-service/src/gizi): master diet, bentuk makanan & standar porsi (dibuat bila
// faskes belum punya), lalu per episode rawat inap: skrining gizi (MST/NRS-2002, sebagian besar ≤ 1x24 jam sejak
// dirawat; skrining ulang hari ke-7), asesmen & asuhan gizi (PAGT) untuk pasien berisiko, order diet (sebagian
// diganti di tengah perawatan: order lama 'dibatalkan'), dan daftar distribusi makan per bangsal × tanggal × waktu
// makan (pagi/siang/snack/sore; lampau 'selesai', hari ini 'dicetak'/'draf') beserta item snapshot pasien.
// Episode: rawat inap historis baru (ctx.rawatInap, status pulang; sebagian encounter 'RI' agar masuk laporan cakupan
// skrining) + episode aktif yang sudah ada di database dan belum punya data gizi (sebagian sengaja belum diskrining/
// diasesmen agar daftar kerja terisi). Kode skor & ambang mengikuti INSTRUMEN di gizi/bersama.js.

const JUMLAH = { rs_a: 70, rs_b: 45, rs_c: 30, rs_d: 18 };
const BENTUK = ['Biasa', 'Lunak', 'Saring', 'Cair'];
const DIET = [
  { kode: 'MB', nama: 'Makanan Biasa', bentuk: ['Biasa', 'Lunak'], kal: [1900, 2200], bobot: 30, desk: 'Makanan seimbang tanpa pembatasan khusus' },
  { kode: 'DM', nama: 'Diet Diabetes Melitus', bentuk: ['Biasa', 'Lunak'], kal: [1500, 1900], bobot: 14, desk: 'Pembatasan gula sederhana, karbohidrat kompleks terjadwal 3J' },
  { kode: 'RG', nama: 'Diet Rendah Garam II', bentuk: ['Biasa', 'Lunak'], kal: [1700, 2000], bobot: 12, desk: 'Natrium 600–800 mg/hari, tanpa garam dapur' },
  { kode: 'TKTP', nama: 'Diet Tinggi Kalori Tinggi Protein', bentuk: ['Biasa', 'Lunak'], kal: [2100, 2600], bobot: 12, desk: 'Energi 40–45 kkal/kg BB, protein 1,5–2 g/kg BB' },
  { kode: 'LBG', nama: 'Diet Lambung', bentuk: ['Lunak', 'Saring'], kal: [1700, 2000], bobot: 10, desk: 'Mudah cerna, tidak merangsang, porsi kecil sering' },
  { kode: 'DJ', nama: 'Diet Jantung III', bentuk: ['Lunak', 'Saring'], kal: [1300, 1800], bobot: 6, desk: 'Rendah garam & lemak jenuh, tidak menimbulkan gas' },
  { kode: 'RP', nama: 'Diet Rendah Protein 40 g', bentuk: ['Biasa', 'Lunak'], kal: [1700, 2000], bobot: 5, desk: 'Untuk penyakit ginjal kronik pra-dialisis' },
  { kode: 'RL', nama: 'Diet Rendah Lemak', bentuk: ['Biasa', 'Lunak'], kal: [1700, 2000], bobot: 4, desk: 'Lemak ≤ 20% energi, untuk gangguan kandung empedu/pankreas' },
  { kode: 'HT', nama: 'Diet Hati', bentuk: ['Lunak', 'Saring'], kal: [1700, 2100], bobot: 3, desk: 'Tinggi energi, protein disesuaikan, rendah lemak' },
  { kode: 'CE', nama: 'Diet Cair Formula Enteral', bentuk: ['Cair'], kal: [1200, 1800], bobot: 4, desk: 'Formula enteral via NGT 6x pemberian' },
];
const TAKARAN = {
  Biasa: ['Nasi 150 g, lauk hewani 50 g, lauk nabati 50 g, sayur 100 g, buah 100 g', 'porsi'],
  Lunak: ['Nasi tim 200 g, lauk hewani 50 g, lauk nabati 50 g, sayur 100 g, buah 100 g', 'porsi'],
  Saring: ['Bubur saring 300 g, lauk dihaluskan, sari buah 150 mL', 'porsi'],
  Cair: ['250', 'mL per pemberian (6x/hari)'],
};
const WAKTU_MAKAN = [['pagi', 6.5], ['siang', 11.5], ['snack', 15], ['sore', 17]];
const BELUM_KONFIRMASI = 'Belum tercatat/perlu konfirmasi';
const NRS = ['imt_rendah', 'penurunan_bb_3bulan', 'asupan_turun_seminggu', 'sakit_berat', 'usia_lanjut'];
const MST_BB = { tidak: 0, tidak_yakin: 2, ya_1_5: 1, ya_6_10: 2, ya_11_15: 3, ya_lebih_15: 4 };

module.exports = {
  kode: 'gizi',
  nama: 'Gizi',
  tahap: 1,
  modul: ['gizi'],
  seed: async (ctx) => {
    const { M, F } = ctx;
    const f = ctx.faskes;
    const users = M.users.map((u) => u.username);
    const perawat = users.filter((u) => /perawat/.test(u));
    const dokter = users.filter((u) => /\.dr\./.test(u));
    const oleh = (daftar) => (daftar.length ? ctx.pilih(daftar) : users.length ? ctx.pilih(users) : null);
    const ahliGizi = perawat.find((u) => /perawat2/.test(u)) ?? oleh(perawat); // belum ada akun ahli gizi di data demo
    const awalMaster = ctx.hariLalu(ctx.HARI + 90);

    // ── Master (pakai yang sudah ada) ──
    let bentuk = await ctx.baris(`SELECT uuid, nama FROM gizi_master_bentuk_makanan WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status`, [f]);
    let diet = await ctx.baris(`SELECT uuid, kode, nama_diet FROM gizi_master_diet WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status`, [f]);
    if (!bentuk.length) bentuk = BENTUK.map((nama) => ctx.tambah('gizi_master_bentuk_makanan', { nama, status: true, created_at: awalMaster }));
    const bentukNama = (n) => bentuk.find((b) => b.nama.toLowerCase() === n.toLowerCase()) ?? bentuk[0];
    if (!diet.length) {
      diet = DIET.map((d) => ctx.tambah('gizi_master_diet', { kode: d.kode, nama_diet: d.nama, deskripsi: d.desk, status: true, created_at: awalMaster }));
      DIET.forEach((d, i) => {
        for (const b of d.bentuk) {
          ctx.tambah('gizi_master_standar_porsi', {
            diet_uuid: diet[i].uuid, bentuk_makanan_uuid: bentukNama(b).uuid, takaran: TAKARAN[b][0], satuan: TAKARAN[b][1], created_at: awalMaster,
          });
        }
      });
    }
    // Profil diet (bobot/kalori/bentuk) dicocokkan lewat kode; diet faskes yang tidak dikenal memakai profil umum.
    const profil = diet.map((d) => ({ ...d, ...(DIET.find((x) => x.kode === d.kode) ?? { bentuk: ['Biasa'], kal: [1800, 2100], bobot: 5 }) }));
    const pilihDiet = () => profil[Number(ctx.berbobot(Object.fromEntries(profil.map((d, i) => [i, d.bobot]))))];

    const namaLokasi = new Map(M.lokasi.map((l) => [l.uuid, l.name]));
    const namaRuangan = new Map(M.ruangan.map((r) => [r.uuid, r.name]));
    const bedDari = new Map(M.bed.map((b) => [b.uuid, b]));

    // ── Episode ──
    // Penghitung ctx.kode/nomor mulai dari 0 di tiap seeder sehingga no_reg RIDM<tanggal><urut> dari ctx.rawatInap bisa
    // bentrok dengan seeder lain (rawat-inap, icu, …) pada faskes yang sama; geser ke rentang khusus modul ini.
    for (let i = 0; i < 6000; i++) ctx.nomor();
    const episode = [];
    const n = JUMLAH[F.segmen] ?? 12;
    for (let i = 0; i < n; i++) {
      const ri = ctx.rawatInap({ encounter: ctx.berbobot({ RI: 5, IGD: 4, RJ: 2 }), lamaHari: ctx.antara(2, 9) });
      episode.push({
        uuid: ri.uuid, nama: ri.name, no_rm: ri.no_rm, lokasi: ri.lokasi_uuid, kamar: ri.bed?.room_uuid ?? ri.lokasi_uuid, no_bed: ri.bed?.no_bed ?? null,
        dirawat: ri.dirawat, pulang: ri.pulang, aktif: false,
      });
    }
    // Episode aktif data dasar (seed-ramai/transaksi) yang belum tersentuh modul Gizi. Episode buatan seeder modul lain
    // (icu, ccu, rawat-inap, …) tidak dipakai: bila seeder itu diisi ulang, baris gizi yang merujuknya akan yatim.
    const aktif = await ctx.baris(
      `SELECT ri.uuid, ri.name, ri.no_rm, ri.lokasi_uuid, ri.monitoring_room_uuid, COALESCE(ri.tanggal_dirawat, ri.tanggal_daftar) AS dirawat
         FROM rawat_inaps ri
        WHERE ri.faskes_uuid = $1 AND ri.deleted_at IS NULL AND ri.status_ri IN (1, 2, 3)
          AND NOT EXISTS (SELECT 1 FROM gizi_skrining s WHERE s.admission_ri_uuid = ri.uuid AND s.deleted_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM gizi_order_diet o WHERE o.admission_ri_uuid = ri.uuid AND o.deleted_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM demo_jejak_modul j WHERE j.faskes_uuid = ri.faskes_uuid AND j.tabel = 'rawat_inaps' AND j.kunci = ri.uuid)
        ORDER BY ri.tanggal_daftar`,
      [f],
    );
    for (const r of aktif) {
      const bed = bedDari.get(r.monitoring_room_uuid);
      episode.push({
        uuid: r.uuid, nama: r.name, no_rm: r.no_rm, lokasi: r.lokasi_uuid, kamar: bed?.room_uuid ?? r.lokasi_uuid, no_bed: bed?.no_bed ?? null,
        dirawat: Math.max(Number(r.dirawat ?? ctx.SEKARANG - 86400), ctx.hariLalu(ctx.HARI + 30)), pulang: Infinity, aktif: true,
      });
    }

    const hit = { skrining: 0, berisiko: 0, asesmen: 0, order: 0, distribusi: 0, item: 0 };
    const skrining = (ep, t) => {
      const nrs = ctx.peluang(F.segmen === 'rs_a' || F.segmen === 'rs_b' ? 0.7 : 0.35);
      const risiko = ctx.peluang(0.32);
      let jawaban;
      if (nrs) {
        const ya = new Set(ctx.acakSebagian(NRS, risiko ? ctx.antara(3, 5) : ctx.antara(0, 2)));
        jawaban = NRS.map((kode) => ({ kode, nilai: ya.has(kode) ? 'ya' : 'tidak', skor: ya.has(kode) ? 1 : 0 }));
      } else {
        const bb = risiko ? ctx.berbobot({ tidak_yakin: 3, ya_1_5: 3, ya_6_10: 3, ya_11_15: 1 }) : ctx.berbobot({ tidak: 7, ya_1_5: 3 });
        const asupan = risiko ? (bb === 'ya_1_5' || ctx.peluang(0.6)) : bb === 'tidak' && ctx.peluang(0.3);
        jawaban = [{ kode: 'penurunan_bb', nilai: bb, skor: MST_BB[bb] }, { kode: 'asupan_turun', nilai: asupan ? 'ya' : 'tidak', skor: asupan ? 1 : 0 }];
      }
      const skor = jawaban.reduce((a, j) => a + j.skor, 0);
      const kategori = skor >= (nrs ? 3 : 2) ? 'berisiko' : 'tidak_berisiko';
      hit.skrining++;
      if (kategori === 'berisiko') hit.berisiko++;
      return ctx.tambah('gizi_skrining', {
        admission_ri_uuid: ep.uuid, instrumen: nrs ? 'nrs2002' : 'mst', jawaban, skor, kategori_risiko: kategori, petugas: oleh(perawat),
        waktu_skrining: t, created_at: t + ctx.antara(1, 10) * 60,
      });
    };
    const asesmen = (ep, sk, t) => {
      const bb = ctx.desimal(38, 72, 1);
      const tb = ctx.antara(148, 172);
      const imt = (bb / (tb / 100) ** 2).toFixed(1).replace('.', ',');
      const persen = ctx.pilih([40, 50, 60]);
      const a = ctx.tambah('gizi_asesmen', {
        admission_ri_uuid: ep.uuid, skrining_uuid: sk.uuid, ahli_gizi_uuid: ahliGizi,
        asesmen: `BB ${String(bb).replace('.', ',')} kg, TB ${tb} cm, IMT ${imt} kg/m². Asupan SMRS ±${persen}% kebutuhan. ${ctx.pilih(['Albumin 3,0 g/dL.', 'Hb 10,2 g/dL, albumin 3,2 g/dL.', 'Mual, nafsu makan menurun.', 'Riwayat diare 3 hari.'])}`,
        diagnosis_gizi: ctx.pilih([
          'NI-2.1 Asupan oral tidak adekuat berkaitan dengan penurunan nafsu makan ditandai asupan < 60% kebutuhan',
          'NC-3.2 Penurunan berat badan yang tidak diharapkan berkaitan dengan penyakit katabolik ditandai penurunan BB 6 kg dalam 3 bulan',
          'NI-5.1 Peningkatan kebutuhan protein berkaitan dengan proses penyembuhan luka ditandai albumin rendah',
          'NC-1.2 Kesulitan mengunyah/menelan berkaitan dengan penurunan kesadaran ditandai pemberian makan via NGT',
        ]),
        intervensi: `${ctx.pilih(['Diet TKTP', 'Diet sesuai order DPJP dengan modifikasi tekstur', 'Makanan cair formula enteral bertahap'])} ${ctx.antara(1800, 2400)} kkal, protein ${ctx.antara(60, 90)} g; 3x makan utama + 2x selingan; edukasi gizi pasien & keluarga`,
        monitoring_evaluasi: 'Pantau sisa makanan tiap waktu makan, BB tiap 3 hari, albumin/elektrolit sesuai advis DPJP',
        dibuat_oleh: ahliGizi, created_at: t,
      });
      if (ctx.peluang(0.4)) Object.assign(a, { diubah_oleh: ahliGizi, updated_at: t + ctx.antara(2, 3) * 86400, monitoring_evaluasi: `${a.monitoring_evaluasi}. Evaluasi: asupan meningkat ±${persen + 20}%, lanjutkan intervensi` });
      hit.asesmen++;
    };
    const order = (ep, t, dt = pilihDiet()) => {
      hit.order++;
      return ctx.tambah('gizi_order_diet', {
        admission_ri_uuid: ep.uuid, diet_uuid: dt.uuid, bentuk_makanan_uuid: bentukNama(ctx.pilih(dt.bentuk)).uuid, kalori: Math.round(ctx.antara(dt.kal[0], dt.kal[1]) / 50) * 50,
        rute: dt.kode === 'CE' ? 'enteral' : 'oral',
        pantangan: ctx.peluang(0.15) ? ctx.pilih(['Tidak makan daging sapi', 'Vegetarian (tanpa daging/ikan)', 'Tidak suka pedas', 'Tanpa santan']) : null,
        waktu_mulai: t, status: 'aktif', dibuat_oleh: oleh(dokter), created_at: t, _diet: dt,
      });
    };

    for (const ep of episode) {
      ep.alergi = ctx.peluang(0.12) ? ctx.pilih(['Udang', 'Telur', 'Kacang tanah', 'Susu sapi', 'Ikan tongkol']) : BELUM_KONFIRMASI;
      ep.order = [];
      // Episode aktif: ±20% sengaja belum diskrining (daftar "belum skrining"), sebagian berisiko belum diasesmen.
      if (ep.aktif && ctx.peluang(0.2)) continue;
      const batasT = Math.min(ep.pulang, ctx.SEKARANG - 600);
      const tSkr = Math.min(ep.dirawat + (ctx.peluang(0.9) ? ctx.antara(1, 20) : ctx.antara(25, 40)) * 3600, batasT);
      const sk = skrining(ep, tSkr);
      if (sk.kategori_risiko === 'berisiko' && !(ep.aktif && ctx.peluang(0.3))) {
        const tA = Math.min(tSkr + ctx.antara(3, 30) * 3600, batasT);
        if (tA > tSkr) asesmen(ep, sk, tA);
      }
      // Skrining ulang hari ke-7 untuk rawat inap panjang.
      if (ep.dirawat + 7 * 86400 < batasT) skrining(ep, ep.dirawat + 7 * 86400 + ctx.antara(8, 14) * 3600);
      const tO = Math.min(ep.dirawat + ctx.antara(1, 6) * 3600, batasT);
      const o1 = order(ep, tO);
      ep.order.push(o1);
      if (ctx.peluang(0.3) && tO + 2 * 86400 < batasT) {
        const tGanti = tO + ctx.antara(36, 96) * 3600;
        if (tGanti < batasT) {
          const lanjutan = o1._diet.kode === 'CE' ? profil.find((d) => d.kode === 'LBG') ?? pilihDiet() : pilihDiet();
          Object.assign(o1, { status: 'dibatalkan', alasan_batal: 'Digantikan order diet baru', updated_at: tGanti });
          ep.order.push(order(ep, tGanti, lanjutan));
        }
      }
    }

    // ── Distribusi makan per bangsal × tanggal × waktu makan ──
    const petugasGizi = oleh(perawat);
    for (let h = ctx.HARI - 1; h >= 0; h--) {
      for (const [waktu, jam] of WAKTU_MAKAN) {
        const T = ctx.hariLalu(h) + jam * 3600;
        if (T - 3 * 3600 > ctx.SEKARANG) continue;
        const perBangsal = new Map();
        for (const ep of episode) {
          if (!ep.lokasi || ep.dirawat > T - 3600 || ep.pulang <= T) continue;
          if (!perBangsal.has(ep.lokasi)) perBangsal.set(ep.lokasi, []);
          perBangsal.get(ep.lokasi).push(ep);
        }
        for (const [lokasi, daftar] of perBangsal) {
          const status = T + 3600 < ctx.SEKARANG ? 'selesai' : T - 3600 < ctx.SEKARANG ? 'dicetak' : 'draf';
          const dibuat = Math.min(T - ctx.antara(120, 180) * 60, ctx.SEKARANG - 60);
          const hdr = ctx.tambah('gizi_distribusi', {
            ruangan_uuid: lokasi, tanggal: ctx.tglIso(ctx.hariLalu(h)), waktu_makan: waktu, status, dibuat_oleh: petugasGizi,
            created_at: dibuat, updated_at: status === 'draf' ? dibuat : Math.min(status === 'selesai' ? T + 3600 : dibuat + 1800, ctx.SEKARANG),
          });
          hit.distribusi++;
          for (const ep of daftar) {
            const o = [...ep.order].reverse().find((x) => x.waktu_mulai <= T - 3600 && (x.status === 'aktif' || x.updated_at > T));
            ctx.tambah('gizi_distribusi_item', {
              distribusi_uuid: hdr.uuid, admission_ri_uuid: ep.uuid, order_diet_uuid: o?.uuid ?? null, nama_pasien: ep.nama, no_rm: ep.no_rm,
              nama_diet_snapshot: o?._diet.nama_diet ?? null, bentuk_makanan_snapshot: o ? bentuk.find((b) => b.uuid === o.bentuk_makanan_uuid)?.nama ?? null : null,
              pantangan_snapshot: o?.pantangan ?? null,
              lokasi_snapshot: { nama_bangsal: namaLokasi.get(ep.lokasi) ?? null, nama_kamar: namaRuangan.get(ep.kamar) ?? null, no_bed: ep.no_bed },
              alergi_snapshot: ep.alergi, created_at: dibuat,
            });
            hit.item++;
          }
        }
      }
    }
    // Kolom bantu _diet tidak disimpan.
    for (const ep of episode) for (const o of ep.order) delete o._diet;
    return `${n} episode baru + ${aktif.length} episode aktif, ${hit.skrining} skrining (${hit.berisiko} berisiko), ${hit.asesmen} asesmen, ${hit.order} order diet, ${hit.distribusi} distribusi (${hit.item} item)`;
  },
};
