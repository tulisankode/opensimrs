'use strict';

// Modul Rawat Inap: episode rawat inap historis 60 hari terakhir untuk halaman Ruangan (status pulang), laporan
// Kunjungan Rawat Inap, Perpindahan Pasien, Pembatalan Dirawat (rawat-inap-service /report/*), daftar Perpindahan
// Bangsal (/transfer-bed/*), laporan Keperawatan Inap & kunjungan Admisi (log_pelayanan RI), serta indikator BOR/LOS.
// Tabel: addresses, birth_details, patients (pasien baru lengkap alamat & tanggal lahir — laporan memakai join wajib),
//   insurance_accounts, insurance_admissions (admission_type 3), rawat_inaps, riwayat_ruangan, perpindahans, log_pelayanan.
// Alur status:
//   - pulang: status_ri 4 lewat ctx.rawatInap, lalu dilengkapi no_pelayanan, penjamin, status_pulang (kode resume medis
//     home/aadvice/other-hfc/exp-lt48h/exp-gt48h/oth) dan kondisi pulang (SNOMED Stabil/Tidak Stabil/Perbaikan).
//   - pindah kamar disetujui: perpindahans 'approve' + waktu_pindah, riwayat_ruangan bed asal (sampai pindah) dan bed
//     tujuan (sampai pulang), rawat_inaps.monitoring_room_uuid = bed tujuan (seperti HduPerpindahanAdapter.pindahkan).
//   - pindah kamar ditolak: perpindahans 'reject' tanpa waktu_pindah, bed tidak berubah.
//   - menunggu pindah: perpindahans 'pending' pada pasien yang SEDANG dirawat (status_ri 3 dari seed-ramai/transaksi)
//     → status_ri 2 seperti RequestMoveBed; dikembalikan ke 3 oleh `bersihkan`. Bed (room_monitorings) tidak diubah.
//   - batal dirawat: status_ri 0 + alasan_batal, petugas, deleted_at (= waktu batal; laporan memfilter deleted_at),
//     log_pelayanan status false + cancel_*. Bed rencana tetap diisi karena laporan pembatalan mewajibkan join bed.
// Bed historis dijadwalkan agar tidak tumpang tindih dengan episode lain (termasuk pasien yang sedang dirawat).

const JUMLAH = { rs_a: 80, rs_b: 60, rs_c: 40, rs_d: 25, klinik_utama: 10 };
const MENUNGGU_PINDAH = { rs_a: 3, rs_b: 2 };

const KELUHAN = {
  IGD: ['Demam tinggi 3 hari', 'Sesak napas', 'Nyeri dada kiri', 'Nyeri perut kanan bawah', 'Muntah dan diare', 'Penurunan kesadaran', 'Kejang', 'Lemas, BAB hitam', 'Cedera kepala ringan pasca kecelakaan'],
  RJ: ['Rencana operasi elektif', 'Gula darah tidak terkontrol', 'Hipertensi tidak terkontrol', 'Anemia berat', 'Kemoterapi terjadwal', 'Evaluasi gagal jantung', 'Infeksi saluran kemih berulang'],
};
const STATUS_PULANG = { home: 78, aadvice: 7, 'other-hfc': 6, oth: 3, 'exp-gt48h': 3, 'exp-lt48h': 2 };
const KONDISI = { stabil: '359746009', tidakStabil: '162668006', perbaikan: '268910001' };
const ALASAN_PINDAH = ['Permintaan naik kelas perawatan', 'Penyesuaian kelas sesuai hak penjamin', 'Membutuhkan ruang isolasi', 'Observasi lebih dekat dengan nurse station',
  'Kamar asal dalam perbaikan', 'Permintaan keluarga pasien', 'Kondisi membaik, pindah ke ruang perawatan biasa'];
const ALASAN_TOLAK = ['Kamar tujuan sudah dipesan pasien lain', 'Penjamin tidak menanggung kenaikan kelas', 'Kondisi pasien belum stabil untuk dipindah'];
const ALASAN_BATAL = ['Pasien menolak rawat inap', 'Keluarga memilih dirawat di rumah sakit lain', 'Kamar sesuai kelas penjamin penuh', 'Salah input pendaftaran',
  'Pasien pulang atas permintaan sendiri sebelum masuk kamar', 'Kepesertaan penjamin tidak aktif'];
const TEMPAT_LAHIR = ['Surabaya', 'Sidoarjo', 'Malang', 'Gresik', 'Mojokerto', 'Pasuruan', 'Jombang', 'Lamongan'];
const JALAN = ['Jl. Melati', 'Jl. Kenanga', 'Jl. Diponegoro', 'Jl. Ahmad Yani', 'Jl. Pahlawan', 'Perum Griya Asri Blok B', 'Jl. Sudirman', 'Jl. Merdeka'];

module.exports = {
  kode: 'rawat-inap',
  nama: 'Rawat Inap',
  tahap: 1,
  modul: ['rawat_inap'],

  // Pasien sedang dirawat yang diberi permintaan pindah (pending) dikembalikan ke status dirawat sebelum barisnya dihapus.
  bersihkan: async ({ q, faskes }) => {
    await q(`UPDATE rawat_inaps r SET status_ri = 3 FROM perpindahans p
      WHERE p.faskes_uuid = $1 AND p.status_pindah = 'pending' AND r.uuid = p.admission_ri_uuid AND r.faskes_uuid = $1 AND r.status_ri = 2
        AND p.uuid IN (SELECT kunci FROM demo_jejak_modul WHERE faskes_uuid = $1 AND modul = 'rawat-inap' AND tabel = 'perpindahans')`, [faskes]);
  },

  seed: async (ctx) => {
    const { M, F, faskes, SEKARANG, HARI } = ctx;
    const JAM = 3600;
    const HARIDETIK = 86400;

    // Bed valid untuk laporan: ruangan (lokasi) & lokasi bed aktif. Kelas dari lokasi ruangan (class_code 1–3, 4 VIP, 5 VVIP).
    const bed = await ctx.baris(`SELECT rm.uuid, rm.room_uuid, rm.no_bed, rm.patient_uuid, rm.status_operasional, l.name AS ruang, COALESCE(NULLIF(l.class_code, ''), '3')::int AS kelas
      FROM room_monitorings rm JOIN lokasi l ON l.uuid = rm.room_uuid AND l.deleted_at IS NULL
      JOIN lokasi bl ON bl.uuid = rm.lokasi_uuid AND bl.deleted_at IS NULL
      WHERE rm.faskes_uuid = $1 AND rm.deleted_at IS NULL AND rm.type = 'Bed' ORDER BY l.name, rm.no_bed`, [faskes]);
    if (!bed.length) return 'tidak ada bed rawat inap — dilewati';
    const dokter = M.dokter.filter((d) => !/^drg/i.test(d.name));
    if (!dokter.length && !M.dokter.length) return 'tidak ada dokter — dilewati';
    const pilihDokter = () => ctx.pilih(dokter.length ? dokter : M.dokter);

    const penjamin = await ctx.baris(`SELECT uuid, code, name FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskes]);
    const tunai = penjamin.find((p) => /tunai/i.test(p.name));
    const bpjs = penjamin.find((p) => /bpjs/i.test(p.name));
    const swasta = penjamin.filter((p) => p !== tunai && p !== bpjs);
    const petugas = (pola) => {
      const u = M.users.filter((x) => pola.test(x.username));
      return (u.length ? ctx.pilih(u) : ctx.pilih(M.users))?.username ?? 'admin';
    };

    // ── Jadwal bed: interval terisi [a, b) per bed, diawali episode yang sudah ada di database ──
    const terisi = new Map(bed.map((b) => [b.uuid, []]));
    for (const r of await ctx.baris(`SELECT monitoring_room_uuid AS bed, COALESCE(tanggal_dirawat, tanggal_daftar) AS a, COALESCE(discharge_date, $2) AS b
      FROM rawat_inaps WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status_ri <> 0 AND monitoring_room_uuid IS NOT NULL`, [faskes, SEKARANG + 30 * HARIDETIK])) {
      terisi.get(r.bed)?.push([Number(r.a), Number(r.b)]);
    }
    // Bed terisi tanpa episode aktif yang tercatat (data lama): anggap terisi sejak 3 hari lalu.
    for (const b of bed) {
      if (b.patient_uuid && !terisi.get(b.uuid).some(([, y]) => y > SEKARANG)) terisi.get(b.uuid).push([SEKARANG - 3 * HARIDETIK, SEKARANG + 30 * HARIDETIK]);
    }
    const bebas = (b, a, z) => terisi.get(b.uuid).every(([x, y]) => z <= x || a >= y);
    const kelasCocok = (kelasHak) => (b) => (kelasHak ? b.kelas === kelasHak : true);
    const cariBed = (a, z, syarat = () => true, kecuali = null) => {
      const calon = bed.filter((b) => b.uuid !== kecuali && syarat(b) && bebas(b, a, z));
      const lain = calon.length ? calon : bed.filter((b) => b.uuid !== kecuali && bebas(b, a, z));
      return lain.length ? ctx.pilih(lain) : null;
    };
    const tempati = (b, a, z) => terisi.get(b.uuid).push([a, z]);

    // ── Pasien: pasien lama yang lengkap (alamat + tanggal lahir) dan pasien baru buatan modul ini ──
    const lengkap = await ctx.baris(`SELECT p.uuid, p.name, p.no_rm, p.gender, p.birth_detail_uuid FROM patients p
      JOIN addresses a ON a.uuid = p.address_uuid AND a.deleted_at IS NULL JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid AND bd.deleted_at IS NULL
      WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND COALESCE(p.is_new_born, false) = false
        AND NOT EXISTS (SELECT 1 FROM rawat_inaps r WHERE r.patient_uuid = p.uuid AND r.deleted_at IS NULL AND r.status_ri IN (1, 2, 3))
      ORDER BY p.created_at DESC LIMIT 200`, [faskes]);
    const profil = await ctx.satu(`SELECT village, postal_code FROM addresses WHERE faskes_uuid = $1 AND village ~ '^[0-9]{10}$' AND prov !~ '^[0-9]+$' LIMIT 1`, [faskes]);
    const kab = String(F.kab ?? profil?.village?.slice(0, 4) ?? '3578');
    const kelurahan = await ctx.baris(`SELECT code FROM kelurahan WHERE code LIKE $1 ORDER BY (kecamatan_code = $2) DESC, code LIMIT 40`,
      [`${kab}%`, profil?.village?.slice(0, 6) ?? '']);
    const hariIni = new Date((SEKARANG + ctx.WIB) * 1000);
    let noPasien = 0;
    const pasienBaru = (t) => {
      const lk = ctx.peluang(0.5);
      const umur = ctx.peluang(0.12) ? ctx.antara(1, 16) : ctx.antara(18, 84);
      const lahir = new Date(Date.UTC(hariIni.getUTCFullYear() - umur, ctx.antara(0, 11), ctx.antara(1, 28)));
      if (lahir > hariIni) lahir.setUTCFullYear(lahir.getUTCFullYear() - 1);
      let th = hariIni.getUTCFullYear() - lahir.getUTCFullYear();
      let bl = hariIni.getUTCMonth() - lahir.getUTCMonth();
      let hr = hariIni.getUTCDate() - lahir.getUTCDate();
      if (hr < 0) { bl -= 1; hr += 30; }
      if (bl < 0) { th -= 1; bl += 12; }
      const kel = kelurahan.length ? ctx.pilih(kelurahan).code : profil?.village ?? null;
      const jalan = `${ctx.pilih(JALAN)} No. ${ctx.antara(1, 120)}`;
      const alamat = ctx.tambah('addresses', {
        full_address: jalan, prov: kel ? kel.slice(0, 2) : '35', city: kel ? kel.slice(0, 4) : kab, district: kel ? kel.slice(0, 6) : null, village: kel,
        rt: ctx.pad(ctx.antara(1, 12), 3), rw: ctx.pad(ctx.antara(1, 8), 3), postal_code: profil?.postal_code ?? null, country: 'id-ID', created_at: t, updated_at: t,
      });
      const lahirIso = lahir.toISOString().slice(0, 10);
      const bd = ctx.tambah('birth_details', {
        birth_place: ctx.pilih(TEMPAT_LAHIR), birth_date: `${lahirIso}T00:00:00Z`, age_year: th, age_month: bl, age_day: hr, status: true, created_at: t, updated_at: t,
      });
      const kawin = umur >= 25 && ctx.peluang(0.8);
      const n = ++noPasien;
      const p = ctx.tambah('patients', {
        no_rm: `DMRI${F.kode}${ctx.pad(n, 5)}`, title: umur < 17 ? 'An. (Anak)' : lk ? (kawin ? 'Tn. (Tuan)' : 'Sdr. (Saudara)') : kawin ? 'Ny. (Nyonya)' : 'Nn. (Nona)',
        name: `${ctx.namaFiktif(lk)} (Demo)`, identity: 'NIK', no_identity: `9999${ctx.pad(ctx.antara(0, 99999999), 8)}${ctx.pad(n, 4)}`,
        birth_detail_uuid: bd.uuid, gender: lk ? 'Laki-laki' : 'Perempuan', phone: '080000000000', religion: ctx.berbobot({ Islam: 85, Kristen: 7, Katolik: 4, Hindu: 2, Buddha: 2 }),
        address_uuid: alamat.uuid, language: 'ID', mother_name: ctx.namaFiktif(false).split(' ')[0], maritial_status: kawin ? 'Kawin' : 'Belum Kawin',
        is_new_born: false, status: true, created_at: t, updated_at: t,
      });
      return p;
    };
    // Pasien per episode: 25% pasien lama yang lengkap, 10% rawat inap ulang pasien modul ini (tanpa tumpang tindih).
    const riwayatPasien = new Map(); // uuid → [[a, z]]
    const dipakai = [];
    let pasienLama = 0;
    const pilihPasien = (a, z) => {
      const bebasP = (p) => (riwayatPasien.get(p.uuid) ?? []).every(([x, y]) => z + HARIDETIK <= x || a >= y + HARIDETIK);
      const ulang = ctx.peluang(0.1) ? dipakai.filter(bebasP) : [];
      const lama = !ulang.length && ctx.peluang(0.25) ? lengkap.filter(bebasP) : [];
      let p = ulang.length ? ctx.pilih(ulang) : lama.length ? ctx.pilih(lama) : null;
      if (p) pasienLama++;
      else { p = pasienBaru(a - ctx.antara(10, 120) * 60); dipakai.push(p); }
      if (!riwayatPasien.has(p.uuid)) riwayatPasien.set(p.uuid, []);
      riwayatPasien.get(p.uuid).push([a, z]);
      return p;
    };

    // ── Penjamin per kunjungan: akun asuransi pasien (dipakai ulang) + insurance_admissions per no_reg ──
    const akun = new Map();
    const pilihPenjamin = () => {
      const k = ctx.berbobot({ bpjs: bpjs ? 55 : 0, tunai: tunai ? 30 : 0, swasta: swasta.length ? 15 : 0 });
      return k === 'bpjs' ? bpjs : k === 'swasta' ? ctx.pilih(swasta) : tunai ?? penjamin[0] ?? null;
    };
    const daftarPenjamin = (p, pj, noReg, t, kelasHak) => {
      if (!pj) return;
      const kunci = `${p.uuid}|${pj.uuid}`;
      if (!akun.has(kunci)) {
        akun.set(kunci, ctx.tambah('insurance_accounts', {
          patient_uuid: p.uuid, code: pj.code, name: pj.name, account_number: pj === tunai ? null : `9999${ctx.pad(ctx.antara(0, 999999999), 9)}`,
          class_entitle: pj === bpjs ? `kelas${kelasHak ?? 3}` : null, membership_status: true, status: true, created_at: t, updated_at: t,
        }));
      }
      ctx.tambah('insurance_admissions', { no_reg: noReg, insurance_account_uuid: akun.get(kunci).uuid, admission_type: 3, status: true, created_at: t, updated_at: t });
    };

    // Waktu pendaftaran: separuh episode jatuh di 2 minggu terakhir.
    const waktuDaftar = (minHari, encounter) => {
      const lo = Math.min(minHari, HARI - 1);
      const h = ctx.peluang(0.55) && lo <= 13 ? ctx.antara(lo, 13) : ctx.antara(Math.max(lo, 14), HARI - 1);
      return encounter === 'IGD' ? ctx.waktu(h, h, 0, 24) : ctx.waktu(h, h, 8, 15);
    };
    const asli = (tabel, uuid) => ctx._tulis.findLast(([t, b]) => t === tabel && (b.uuid === uuid || b.admission_uuid === uuid))?.[1];
    const noPelayanan = (t) => `RI${ctx.yymmdd(t)}${ctx.pad(9000 + (ctx.nomor() % 1000), 4)}`;
    const logPelayanan = (ri, extra = {}) => ctx.tambah('log_pelayanan', {
      tgl_registrasi: ri.tanggal_daftar, noreg: ri.no_reg, no_pelayanan: ri.no_pelayanan, jenis_kunjungan: 'RI', patient_uuid: ri.patient_uuid,
      practitioner_uuid: ri.practitioner_uuid, lokasi_uuid: ri.lokasi_uuid, payment_method: ri.payment_method, discharge_date: ri.discharge_date ?? null,
      status: true, created_at: ri.tanggal_daftar, updated_at: ri.updated_at, ...extra,
    });

    const N = JUMLAH[F.segmen] ?? 10;
    const nBatal = Math.max(1, Math.round(N * 0.1));
    const hitung = { pulang: 0, approve: 0, reject: 0, pending: 0, batal: 0 };

    // ── Episode pulang (sebagian pindah kamar) ──
    for (let i = 0; i < N - nBatal; i++) {
      const encounter = ctx.berbobot({ IGD: 55, RJ: 45 });
      const sp = ctx.berbobot(STATUS_PULANG);
      const lama = sp === 'exp-lt48h' ? 1 : Number(ctx.berbobot({ 1: 6, 2: 16, 3: 22, 4: 20, 5: 13, 6: 8, 7: 6, 9: 4, 12: 3, 15: 2 }));
      const mulai = waktuDaftar(lama + 1, encounter);
      const perkiraanPulang = Math.min(mulai + (lama + 1) * HARIDETIK, SEKARANG - JAM);
      const pj = pilihPenjamin();
      const hak = pj === bpjs ? Number(ctx.berbobot({ 1: 25, 2: 30, 3: 45 })) : null;
      const pindah = lama >= 3 && ctx.peluang(0.22) ? 'approve' : lama >= 2 && ctx.peluang(0.08) ? 'reject' : null;
      // Bed awal (dan bed tujuan bila pindah disetujui) dipilih dari bed yang bebas sepanjang masa rawat.
      const tPindahKira = pindah === 'approve' ? mulai + Math.round((perkiraanPulang - mulai) * ctx.desimal(0.25, 0.65, 2)) : perkiraanPulang;
      const syaratAwal = pj === bpjs ? kelasCocok(hak) : pj === tunai ? () => true : (b) => b.kelas >= 1;
      const bedAwal = cariBed(mulai, tPindahKira + 6 * JAM, syaratAwal);
      if (!bedAwal) continue;
      const p = pilihPasien(mulai, perkiraanPulang);
      const ri = ctx.rawatInap({ pasien: p, mulai, lamaHari: lama, encounter, bed: bedAwal, keluhan: ctx.pilih(KELUHAN[encounter]) });
      const row = asli('rawat_inaps', ri.uuid);
      const dok = ri.dokter && !/^drg/i.test(ri.dokter.name) ? ri.dokter : pilihDokter();
      Object.assign(row, {
        payment_method: pj === tunai ? 1 : 2, no_pelayanan: noPelayanan(mulai), practitioner_uuid: dok?.uuid ?? row.practitioner_uuid,
        birth_detail_uuid: p.birth_detail_uuid, status_pulang: sp, upgrade_class: false,
        kondisi_pasien_pulang: sp.startsWith('exp') || sp === 'other-hfc' ? KONDISI.tidakStabil : ctx.berbobot({ [KONDISI.perbaikan]: 55, [KONDISI.stabil]: 45 }),
        ...(sp === 'other-hfc' ? { tujuan_rujuk: 'HOSP', transport_rujuk: 'AMB', is_internal: false } : {}),
        ...(sp === 'oth' ? { status_pulang_keterangan: 'Pulang paksa karena alasan biaya' } : {}),
        instruksi_tindak_lanjut: sp === 'home' ? 'Kontrol poli spesialis 7 hari setelah pulang' : null,
      });
      tempati(bedAwal, ri.dirawat, ri.pulang);
      daftarPenjamin(p, pj, row.no_reg, mulai, hak);

      if (pindah === 'approve') {
        const tPindah = Math.min(tPindahKira, ri.pulang - 6 * JAM);
        const tujuan = tPindah > ri.dirawat + JAM ? cariBed(tPindah, ri.pulang, (b) => b.room_uuid !== bedAwal.room_uuid, bedAwal.uuid) : null;
        if (tujuan) {
          // Jadwal bed awal dipangkas sampai waktu pindah; riwayat_ruangan bed asal ditutup saat pindah.
          const jad = terisi.get(bedAwal.uuid);
          jad[jad.length - 1] = [ri.dirawat, tPindah];
          tempati(tujuan, tPindah, ri.pulang);
          const rrAsal = asli('riwayat_ruangan', ri.uuid);
          rrAsal.updated_at = tPindah;
          ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: tujuan.uuid, status: true, created_at: tPindah, updated_at: ri.pulang });
          ctx.tambah('perpindahans', {
            petugas: petugas(/perawat/), admission_ri_uuid: ri.uuid, origin_monitoring_room_uuid: bedAwal.uuid, destination_monitoring_room_uuid: tujuan.uuid,
            waktu_pindah: tPindah, keterangan: tujuan.kelas > bedAwal.kelas ? ALASAN_PINDAH[0] : ctx.pilih(ALASAN_PINDAH.slice(1)), status_pindah: 'approve', status: true,
            created_at: tPindah - ctx.antara(20, 180) * 60, updated_at: tPindah,
          });
          Object.assign(row, { monitoring_room_uuid: tujuan.uuid, lokasi_uuid: tujuan.room_uuid, upgrade_class: tujuan.kelas > bedAwal.kelas && pj !== tunai });
          hitung.approve++;
        }
      } else if (pindah === 'reject') {
        const tMinta = ri.dirawat + Math.round((ri.pulang - ri.dirawat) * ctx.desimal(0.2, 0.6, 2));
        const tujuan = ctx.pilih(bed.filter((b) => b.room_uuid !== bedAwal.room_uuid).length ? bed.filter((b) => b.room_uuid !== bedAwal.room_uuid) : bed.filter((b) => b !== bedAwal));
        if (tujuan) {
          ctx.tambah('perpindahans', {
            petugas: petugas(/perawat/), admission_ri_uuid: ri.uuid, origin_monitoring_room_uuid: bedAwal.uuid, destination_monitoring_room_uuid: tujuan.uuid,
            waktu_pindah: null, keterangan: `${ctx.pilih(ALASAN_PINDAH)} — ditolak: ${ctx.pilih(ALASAN_TOLAK)}`.slice(0, 255), status_pindah: 'reject', status: true,
            created_at: tMinta, updated_at: tMinta + ctx.antara(30, 240) * 60,
          });
          hitung.reject++;
        }
      }
      logPelayanan(row);
      hitung.pulang++;
    }

    // ── Batal dirawat (status_ri 0) ──
    for (let i = 0; i < nBatal; i++) {
      const encounter = ctx.berbobot({ IGD: 60, RJ: 40 });
      const t = waktuDaftar(1, encounter);
      const tBatal = Math.min(t + ctx.antara(20, 360) * 60, SEKARANG - 600);
      const pj = pilihPenjamin();
      const b = ctx.pilih(bed);
      const p = pilihPasien(t, tBatal);
      const dok = pilihDokter();
      const ri = ctx.tambah('rawat_inaps', {
        payment_method: pj === tunai ? 1 : 2, no_reg: ctx.kode('RIDM', t), no_pelayanan: noPelayanan(t), patient_uuid: p.uuid, name: p.name, no_rm: p.no_rm,
        gender: p.gender, birth_detail_uuid: p.birth_detail_uuid, practitioner_uuid: dok?.uuid ?? null, tanggal_daftar: t, tanggal_dirawat: null, status_ri: 0, encounter,
        monitoring_room_uuid: b.uuid, lokasi_uuid: b.room_uuid, no_spri: `SPRI/DM/${ctx.yymmdd(t)}/${ctx.pad(ctx.nomor(), 5)}`, complaint: ctx.pilih(KELUHAN[encounter]),
        upgrade_class: false, alasan_batal: ctx.pilih(ALASAN_BATAL), petugas: petugas(/pendaftaran|admin/), status: true, created_at: t, updated_at: tBatal, deleted_at: tBatal,
      });
      daftarPenjamin(p, pj, ri.no_reg, t, pj === bpjs ? 3 : null);
      logPelayanan(ri, { status: false, cancel_reason: ri.alasan_batal, cancel_date: tBatal, cancel_by: ri.petugas, updated_at: tBatal });
      hitung.batal++;
    }

    // ── Menunggu pindah (pending) pada pasien yang sedang dirawat & menempati bednya; bed tujuan kosong & tersedia ──
    const aktif = await ctx.baris(`SELECT r.uuid, r.monitoring_room_uuid, r.tanggal_dirawat FROM rawat_inaps r
      JOIN room_monitorings rm ON rm.uuid = r.monitoring_room_uuid AND rm.patient_uuid = r.patient_uuid AND rm.deleted_at IS NULL
      JOIN patients p ON p.uuid = r.patient_uuid AND p.deleted_at IS NULL
      JOIN addresses a ON a.uuid = p.address_uuid AND a.deleted_at IS NULL JOIN birth_details bd ON bd.uuid = r.birth_detail_uuid AND bd.deleted_at IS NULL
      JOIN practitioner pr ON pr.uuid = r.practitioner_uuid AND pr.deleted_at IS NULL
      WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL AND r.status_ri = 3 AND r.discharge_date IS NULL
        AND NOT EXISTS (SELECT 1 FROM perpindahans x WHERE x.admission_ri_uuid = r.uuid AND x.status_pindah = 'pending' AND x.deleted_at IS NULL)
      ORDER BY r.tanggal_dirawat DESC`, [faskes]);
    const kosong = bed.filter((b) => !b.patient_uuid && b.status_operasional === 'Tersedia' && bebas(b, SEKARANG - JAM, SEKARANG + JAM));
    for (const r of ctx.acakSebagian(aktif, MENUNGGU_PINDAH[F.segmen] ?? 1)) {
      const asal = bed.find((b) => b.uuid === r.monitoring_room_uuid);
      const i = kosong.findIndex((b) => b.room_uuid !== asal?.room_uuid);
      if (!asal || i < 0) continue;
      const [tujuan] = kosong.splice(i, 1);
      const t = Math.max(Number(r.tanggal_dirawat ?? 0) + JAM, SEKARANG - ctx.antara(20, 240) * 60);
      ctx.tambah('perpindahans', {
        petugas: petugas(/perawat/), admission_ri_uuid: r.uuid, origin_monitoring_room_uuid: asal.uuid, destination_monitoring_room_uuid: tujuan.uuid,
        waktu_pindah: null, keterangan: tujuan.kelas > asal.kelas ? ALASAN_PINDAH[0] : ctx.pilih(ALASAN_PINDAH.slice(1)), status_pindah: 'pending', status: true,
        created_at: t, updated_at: t,
      });
      ctx.ubahSetelah(`UPDATE rawat_inaps SET status_ri = 2, updated_at = $2 WHERE uuid = $1 AND status_ri = 3`, [r.uuid, t]);
      hitung.pending++;
    }

    return `${hitung.pulang} pulang (${hitung.approve} pindah kamar, ${hitung.reject} pindah ditolak), ${hitung.batal} batal dirawat, `
      + `${hitung.pending} menunggu pindah; pasien ${noPasien} baru + ${pasienLama} lama/rawat ulang`;
  },
};
