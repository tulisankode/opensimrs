'use strict';

// Data demo Unit Hemodialisa (penunjang-service/src/hemodialisa): master (mesin, shift, item & aturan reuse dializer —
// dibuat bila faskes belum punya), registrasi HD kronis (2x/minggu, pasangan hari Sen–Kam/Sel–Jum/Rab–Sab) dan akut
// (satu kali), resep sah (+ resep lama nonaktif), jadwal rutin N hari terakhir s.d. 2 minggu ke depan, sesi
// (asesmen pra-HD → berjalan → selesai, sebagian batal), observasi intradialitik per jam, adekuasi bulanan (Kt/V
// Daugirdas II & URR, rumus sama dengan bersama.js), dializer per pasien (reuse terbatas) & pemakaian dializer/BHP.
// Tagihan sesi berstatus 'tertunda' (tarif HD-KRONIS/HD-AKUT belum dikonfigurasi di faskes demo), pemakaian tanpa
// order farmasi ('tanpa_biaya'). Tabel bridging HDIS (hd_hdis_*) tidak diisi.

const JUMLAH = { rs_a: { kronis: 25, akut: 4 }, rs_b: { kronis: 18, akut: 3 }, rs_c: { kronis: 12, akut: 2 }, rs_d: { kronis: 6, akut: 1 } };
const MESIN = { rs_a: 8, rs_b: 6, rs_c: 4, rs_d: 3 };
const SHIFT = [
  { kode: 'PAGI', nama: 'Shift Pagi', jam_mulai: '06:30', jam_selesai: '11:30' },
  { kode: 'SIANG', nama: 'Shift Siang', jam_mulai: '12:00', jam_selesai: '17:00' },
  { kode: 'SORE', nama: 'Shift Sore', jam_mulai: '17:30', jam_selesai: '22:30' },
];
// Item BHP HD (kode unik per faskes). maks = batas pemakaian dializer menurut kebijakan reuse faskes (fiktif).
const ITEM = [
  { kode: 'HD-DLZ-LF16', nama: 'Dializer Low Flux 1,6 m²', maks: 8, kebijakan: 'Reuse maks. 8 kali dengan uji volume priming (TCV) ≥ 80% — kebijakan demo' },
  { kode: 'HD-DLZ-HF18', nama: 'Dializer High Flux 1,8 m²', maks: 1, kebijakan: 'Sekali pakai untuk HD akut/pasien infeksius — kebijakan demo' },
  { kode: 'HD-BL-AV', nama: 'AV Blood Line Set Dewasa' },
  { kode: 'HD-FN-16G', nama: 'AV Fistula Needle 16G' },
];
const PASANGAN_HARI = [[1, 4], [2, 5], [3, 6]]; // ISO: 1 Senin … 6 Sabtu
const METODE_ADEKUASI = 'Daugirdas generasi kedua single-pool (Kt/V) & URR — bawaan, perlu disahkan tenaga klinis';
const PESAN_TARIF = (jenis) => `Tarif HD-${jenis.toUpperCase()} / HD-TINDAKAN belum dikonfigurasi di Datamaster › Tarif`;
const AKSES = [
  { teks: 'AV fistula radiosefalika kiri', jarum: true, bobot: 6 },
  { teks: 'AV fistula brakiosefalika kanan', jarum: true, bobot: 2 },
  { teks: 'AV graft brakialis kiri', jarum: true, bobot: 1 },
  { teks: 'CDL (kateter double lumen) jugularis interna kanan', jarum: false, bobot: 3 },
];
const ANTIKOAGULAN = [
  { teks: 'Heparin bolus 2.000 IU, kontinu 1.000 IU/jam, stop 1 jam sebelum selesai', kontinu: true },
  { teks: 'Heparin bolus 1.500 IU, kontinu 500 IU/jam', kontinu: true },
  { teks: 'Heparin minimal: bolus 1.000 IU tanpa kontinu', kontinu: false },
  { teks: 'Tanpa heparin, bilas NaCl 0,9% 100 mL tiap 30 menit', kontinu: false },
];
const DIALISAT = ['Bikarbonat, Na 140 mEq/L, K 2 mEq/L, Ca 1,25 mmol/L, suhu 36,5 °C', 'Bikarbonat, Na 138 mEq/L, K 2 mEq/L, Ca 1,5 mmol/L, suhu 36,5 °C'];
const KOMPLIKASI = {
  hipotensi: { bobot: 8, keluhan: 'Pusing, lemas', tindakan: 'UF rate diturunkan, posisi Trendelenburg, bolus NaCl 0,9% 100 mL' },
  kram: { bobot: 5, keluhan: 'Kram otot betis', tindakan: 'UF dihentikan sementara, NaCl 0,9% 100 mL, peregangan otot' },
  mual_muntah: { bobot: 3, keluhan: 'Mual', tindakan: 'Ondansetron 4 mg IV sesuai advis DPJP' },
  sakit_kepala: { bobot: 3, keluhan: 'Sakit kepala', tindakan: 'Parasetamol 500 mg per oral' },
  hipertensi: { bobot: 3, keluhan: 'Tengkuk terasa berat', tindakan: 'Lapor DPJP, observasi TD tiap 30 menit' },
  gatal: { bobot: 2, keluhan: 'Gatal di lengan', tindakan: 'Edukasi, lapor DPJP' },
  masalah_akses: { bobot: 2, keluhan: 'Aliran darah tidak lancar', tindakan: 'Reposisi jarum arteri, QB diturunkan sementara' },
};

module.exports = {
  kode: 'hemodialisa',
  nama: 'Unit Hemodialisa',
  tahap: 1,
  modul: ['hemodialisa'],
  seed: async (ctx) => {
    const { M, F } = ctx;
    const f = ctx.faskes;
    const jml = JUMLAH[F.segmen] ?? JUMLAH.rs_d;
    const users = M.users.map((u) => u.username);
    const perawat = users.filter((u) => /perawat/.test(u));
    const dokter = users.filter((u) => /\.dr\./.test(u));
    const oleh = (daftar) => (daftar.length ? ctx.pilih(daftar) : users.length ? ctx.pilih(users) : null);
    const durasi = (mulai, selesai) => Math.round(((selesai - mulai) / 3600) * 100) / 100;

    // ── Master: mesin, shift, item & aturan dializer (pakai yang sudah ada) ──
    let mesin = await ctx.baris(`SELECT uuid, kode, status FROM hd_mesin WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY kode`, [f]);
    if (!mesin.length) {
      const n = MESIN[F.segmen] ?? 3;
      for (let i = 1; i <= n; i++) {
        const rawat = i === n && n >= 6; // unit besar: satu mesin sedang perawatan berkala
        mesin.push(ctx.tambah('hd_mesin', {
          kode: `MHD-${ctx.pad(i, 2)}`, nama: `Mesin HD ${ctx.pad(i, 2)} (${i % 2 ? 'Nipro Surdial X' : 'Fresenius 4008S'})`,
          status: rawat ? 'perawatan' : 'aktif', keterangan: rawat ? 'Kalibrasi & penggantian filter dialisat berkala' : null,
          created_at: ctx.hariLalu(ctx.HARI + 120),
        }));
      }
    }
    mesin = mesin.filter((m) => m.status === 'aktif');
    let shift = await ctx.baris(`SELECT uuid, kode, to_char(jam_mulai, 'HH24:MI') AS jam_mulai FROM hd_shift WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif ORDER BY urutan, jam_mulai`, [f]);
    if (!shift.length) {
      shift = SHIFT.slice(0, F.segmen === 'rs_a' ? 3 : 2).map((s, i) => ctx.tambah('hd_shift', { ...s, urutan: i + 1, aktif: true, created_at: ctx.hariLalu(ctx.HARI + 120) }));
    }
    if (!mesin.length || !shift.length) return 'mesin/shift aktif tidak tersedia, dilewati';

    const item = {};
    for (const it of ITEM) {
      let ada = await ctx.satu(`SELECT uuid, name FROM item_medis WHERE faskes_uuid = $1 AND code = $2 AND deleted_at IS NULL LIMIT 1`, [f, it.kode]);
      if (!ada) {
        const contoh = await ctx.satu(`SELECT * FROM item_medis WHERE faskes_uuid = $1 AND jenis_item = 'alkes' AND deleted_at IS NULL ORDER BY code LIMIT 1`, [f]);
        if (!contoh) return 'item alkes contoh tidak ada (jalankan seed-demo), dilewati';
        ada = ctx.tambah('item_medis', {
          code: it.kode, name: it.nama, bentuk_sediaan_uuid: contoh.bentuk_sediaan_uuid, dosis: 1, satuan_dosis_uuid: contoh.satuan_dosis_uuid,
          isi_kemasan: 1, satuan_kemasan_uuid: contoh.satuan_kemasan_uuid, satuan_penggunaan_uuid: contoh.satuan_penggunaan_uuid,
          manufacture_uuid: contoh.manufacture_uuid, jenis_item: 'alkes', kategori_obat_uuid: contoh.kategori_obat_uuid, status: true,
          created_at: ctx.hariLalu(ctx.HARI + 120),
        });
        ada.name = it.nama;
      }
      item[it.kode] = { uuid: ada.uuid, nama: ada.name, maks: it.maks };
      if (it.maks) {
        const aturan = await ctx.satu(`SELECT pemakaian_maksimal FROM hd_dializer_aturan WHERE faskes_uuid = $1 AND item_medis_uuid = $2 AND deleted_at IS NULL`, [f, ada.uuid]);
        if (aturan) item[it.kode].maks = Number(aturan.pemakaian_maksimal);
        else ctx.tambah('hd_dializer_aturan', { item_medis_uuid: ada.uuid, pemakaian_maksimal: it.maks, dasar_kebijakan: it.kebijakan, diubah_oleh: oleh(dokter), created_at: ctx.hariLalu(ctx.HARI + 100) });
      }
    }
    const namaItem = new Map(Object.values(item).map((x) => [x.uuid, x.nama]));
    const lokasiStok = M.lokasiStok.find((l) => /depo|farmasi|apotek/i.test(l.name)) ?? M.lokasiStok[0] ?? null;

    // ── Pasien & slot ──
    const pasienHd = ctx.acakSebagian(M.pasien, jml.kronis + jml.akut);
    while (pasienHd.length < jml.kronis + jml.akut) pasienHd.push(ctx.pasien({ baru: true }));
    const slot = [];
    for (const hari of PASANGAN_HARI) for (const s of shift) for (const m of mesin) slot.push({ hari, s, m });
    const slotKronis = ctx.acakSebagian(slot, Math.min(jml.kronis, slot.length));
    const terpakai = new Set(); // mesin|shift|tanggal
    const jamShift = (s) => s.jam_mulai.split(':').reduce((a, b, i) => a + Number(b) * (i ? 60 : 3600), 0);
    const isoHari = (e) => ((new Date((e + ctx.WIB) * 1000).getUTCDay() + 6) % 7) + 1;

    const hit = { registrasi: 0, jadwal: 0, sesi: 0, observasi: 0, adekuasi: 0, dializer: 0 };
    let nomorReg = 0;
    const noRegHd = (t) => `HD${ctx.yymmdd(t)}${ctx.pad(++nomorReg, 4)}`;

    // Satu sesi HD (selesai/berjalan) beserta observasi, pemakaian, dan (opsional) adekuasi.
    const buatSesi = ({ reg, resep, jadwal, mulaiShift, pasien, dializer, adekuasi }) => {
      const kering = pasien.kering;
      const idwg = ctx.desimal(0.8, 3.8, 1);
      const beratPra = Number((kering + idwg).toFixed(1));
      const asesmenPada = mulaiShift + ctx.antara(5, 25) * 60;
      const mulai = asesmenPada + ctx.antara(10, 25) * 60;
      if (mulai > ctx.SEKARANG - 600) return null; // belum dimulai → biarkan jadwal 'terjadwal'
      const komplikasi = ctx.peluang(0.13) ? ctx.berbobot(Object.fromEntries(Object.entries(KOMPLIKASI).map(([k, v]) => [k, v.bobot]))) : null;
      const dihentikanDini = komplikasi && ['hipotensi', 'kram'].includes(komplikasi) && ctx.peluang(0.25);
      const lamaRencana = resep.durasi_menit * 60;
      const lamaAktual = dihentikanDini ? lamaRencana - ctx.antara(30, 60) * 60 : lamaRencana + ctx.antara(-5, 10) * 60;
      const selesaiRencana = mulai + lamaAktual;
      const selesai = selesaiRencana <= ctx.SEKARANG - 300 ? selesaiRencana : null; // null → masih berjalan
      const ufTarget = Math.min(Math.round((idwg + ctx.desimal(0.1, 0.4, 2)) * 10) * 100, 4500);
      const sistolik = ctx.antara(130, 175);
      const diastolik = ctx.antara(75, 100);
      const nadi = ctx.antara(72, 96);
      const sesi = ctx.tambah('hd_sesi', {
        jadwal_uuid: jadwal.uuid, resep_uuid: resep.uuid, status: selesai ? 'selesai' : 'berjalan',
        asesmen_pra: {
          identitas_terkonfirmasi: true, resep_terkonfirmasi: true, berat_pra_kg: beratPra, berat_kering_kg: kering,
          td_sistolik: sistolik, td_diastolik: diastolik, nadi, suhu: ctx.desimal(36.2, 37.0, 1),
          keluhan: ctx.peluang(0.2) ? ctx.pilih(['Sesak ringan saat berbaring', 'Bengkak kedua tungkai', 'Badan lemas', 'Gatal-gatal']) : null,
          kondisi_akses_vaskular: pasien.akses.jarum ? ctx.pilih(['Thrill (+), bruit (+), tidak ada tanda infeksi', 'Thrill (+), bruit (+)']) : ctx.pilih(['Exit site kering, tidak ada tanda infeksi', 'Balutan bersih, aliran lancar']),
          catatan: null,
        },
        asesmen_oleh: pasien.perawat, asesmen_pada: asesmenPada, mulai_pada: mulai, selesai_pada: selesai,
        dibuka_oleh: pasien.perawat, dimulai_oleh: pasien.perawat, ditutup_oleh: selesai ? pasien.perawat : null,
        status_tagihan: selesai ? 'tertunda' : 'belum', pesan_tagihan: selesai ? PESAN_TARIF(reg.jenis) : null,
        created_at: asesmenPada - ctx.antara(1, 5) * 60, updated_at: selesai ?? mulai,
      });
      hit.sesi++;

      // Observasi per jam (menit 0, 60, …) sampai selesai/sekarang; komplikasi pada satu titik pertengahan.
      const batas = selesai ?? ctx.SEKARANG - 60;
      const titik = [];
      for (let t = mulai; t <= Math.min(mulai + lamaAktual, batas); t += 3600) titik.push(t);
      if (selesai && selesai - titik[titik.length - 1] > 900) titik.push(selesai - ctx.antara(2, 8) * 60);
      const iKomp = komplikasi ? Math.min(titik.length - 1, ctx.antara(1, 3)) : -1;
      const ufRate = Math.round(ufTarget / (lamaRencana / 3600));
      titik.forEach((t, i) => {
        const jamKe = (t - mulai) / 3600;
        const turun = Math.round(jamKe * ctx.antara(2, 6));
        let sis = sistolik - turun + ctx.antara(-6, 6);
        let dia = diastolik - Math.round(turun / 2) + ctx.antara(-4, 4);
        let nd = nadi + ctx.antara(-4, 6);
        const kode = i === iKomp ? komplikasi : null;
        if (kode === 'hipotensi') { sis = ctx.antara(82, 92); dia = ctx.antara(48, 58); nd = ctx.antara(98, 112); }
        if (kode === 'hipertensi') { sis = ctx.antara(180, 198); dia = ctx.antara(100, 110); }
        const qb = Number(resep.qb_ml_menit);
        const parameter = {
          td_sistolik: sis, td_diastolik: dia, nadi: nd, qb_ml_menit: kode === 'masalah_akses' ? qb - 50 : qb, qd_ml_menit: Number(resep.qd_ml_menit),
          uf_volume_ml: Math.min(Math.round((ufRate * jamKe) / 10) * 10, ufTarget), uf_rate_ml_jam: kode === 'hipotensi' || kode === 'kram' ? Math.round(ufRate / 2) : ufRate,
          tmp_mmhg: ctx.antara(80, 180), tekanan_arteri_mmhg: -ctx.antara(120, 200), tekanan_vena_mmhg: ctx.antara(110, 190),
          konduktivitas_ms_cm: ctx.desimal(13.8, 14.2, 1), suhu_dialisat: 36.5,
          ...(pasien.antikoagulan.kontinu && jamKe < lamaRencana / 3600 - 1 ? { heparin_ml_jam: 1 } : {}),
          ...(i === 0 || kode ? { suhu: ctx.desimal(36.2, 37.2, 1) } : {}),
        };
        ctx.tambah('hd_observasi', {
          sesi_uuid: sesi.uuid, waktu_pengukuran: t,
          parameter: Object.fromEntries(Object.entries(parameter).map(([k, v]) => [k, { nilai: v, satuan: SATUAN[k] }])),
          keluhan: kode ? KOMPLIKASI[kode].keluhan : null, komplikasi: kode ? [kode] : [], tindakan: kode ? KOMPLIKASI[kode].tindakan : null,
          sumber: 'manual', dicatat_oleh: pasien.perawat, perlu_tinjau: false, digantikan: false, created_at: t + ctx.antara(1, 4) * 60,
        });
        hit.observasi++;
      });

      // Pemakaian dializer (reuse terbatas) & BHP.
      const d = dializer();
      d.jumlah_pakai += 1;
      if (d.jumlah_pakai >= d.pemakaian_maksimal) Object.assign(d, { status: 'berhenti', alasan_berhenti: 'Batas pemakaian tercapai', updated_at: mulai });
      else if (d.jumlah_pakai >= 3 && ctx.peluang(0.04)) Object.assign(d, { status: 'berhenti', alasan_berhenti: 'Volume priming (TCV) < 80% pada uji reuse', updated_at: mulai });
      const pertama = d.jumlah_pakai === 1;
      ctx.tambah('hd_pemakaian', {
        sesi_uuid: sesi.uuid, jenis: 'dializer', dializer_uuid: d.uuid, item_medis_uuid: d.item_medis_uuid, nama_item: namaItem.get(d.item_medis_uuid), qty: 1,
        pemakaian_ke: d.jumlah_pakai, lokasi_stok_uuid: pertama ? lokasiStok?.uuid ?? null : null, status_stok: pertama ? 'diorder' : 'reuse',
        status_tagihan: 'tanpa_biaya', petugas: pasien.perawat, created_at: mulai - 300,
      });
      const bhp = [[item['HD-BL-AV'], 1], ...(pasien.akses.jarum ? [[item['HD-FN-16G'], 2]] : [])];
      for (const [it, qty] of bhp) {
        ctx.tambah('hd_pemakaian', {
          sesi_uuid: sesi.uuid, jenis: 'bhp', item_medis_uuid: it.uuid, nama_item: it.nama, qty, lokasi_stok_uuid: lokasiStok?.uuid ?? null,
          status_stok: 'diorder', status_tagihan: 'tanpa_biaya', petugas: pasien.perawat, created_at: mulai - 240,
        });
      }

      let ufAktual = null;
      if (selesai) {
        ufAktual = dihentikanDini ? Math.round((ufRate * (lamaAktual / 3600)) / 50) * 50 : ufTarget - ctx.antara(0, 4) * 50;
        sesi.catatan_pasca = {
          berat_pasca_kg: Number((beratPra - ufAktual / 1000 + ctx.desimal(0.1, 0.3, 1)).toFixed(1)), uf_aktual_ml: ufAktual,
          td_sistolik: sistolik - ctx.antara(5, 20), td_diastolik: diastolik - ctx.antara(0, 10), nadi: nadi + ctx.antara(-6, 6),
          keluhan: dihentikanDini ? KOMPLIKASI[komplikasi].keluhan : null,
          kondisi_pulang: dihentikanDini ? 'HD dihentikan lebih awal, kondisi stabil setelah tindakan' : ctx.pilih(['Baik, pulang mandiri', 'Baik, pulang diantar keluarga', 'Stabil']),
          catatan: dihentikanDini ? `HD dihentikan ${Math.round((lamaRencana - lamaAktual) / 60)} menit lebih awal (${komplikasi.replace('_', '/')})` : null,
        };
        jadwal.status = 'selesai';
        jadwal.updated_at = selesai;
        if (adekuasi) {
          const durasiJam = durasi(mulai, selesai);
          const berat = sesi.catatan_pasca.berat_pasca_kg;
          const lengkap = ctx.peluang(0.93);
          const pre = ctx.antara(55, 95);
          const urr = ctx.desimal(0.6, 0.76, 3);
          const post = Math.round(pre * (1 - urr));
          const r = post / pre;
          const ktv = -Math.log(r - 0.008 * durasiJam) + (4 - 3.5 * r) * (ufAktual / 1000 / berat);
          ctx.tambah('hd_adekuasi', lengkap ? {
            sesi_uuid: sesi.uuid, metode: METODE_ADEKUASI, input: { bun_pre: pre, bun_post: post, durasi_jam: durasiJam, uf_liter: ufAktual / 1000, berat_pasca_kg: berat },
            kt_v: Math.round(ktv * 100) / 100, urr: Math.round((1 - r) * 10000) / 100, status: 'tersedia', alasan: null, riwayat: [],
            dihitung_oleh: oleh(dokter), dihitung_pada: selesai + ctx.antara(2, 6) * 3600, created_at: selesai + ctx.antara(2, 6) * 3600,
          } : {
            sesi_uuid: sesi.uuid, metode: null, input: { bun_pre: pre, bun_post: null, durasi_jam: durasiJam, uf_liter: ufAktual / 1000, berat_pasca_kg: berat },
            kt_v: null, urr: null, status: 'belum_tersedia', alasan: 'Data belum lengkap: bun_post', riwayat: [],
            dihitung_oleh: pasien.perawat, dihitung_pada: selesai + 600, created_at: selesai + 600,
          });
          hit.adekuasi++;
        }
      } else {
        jadwal.status = 'berjalan';
        jadwal.updated_at = mulai;
      }
      jadwal.hadir_pada = asesmenPada - 600;
      return sesi;
    };

    // Dializer per registrasi: pakai yang aktif, daftarkan baru bila habis/berhenti.
    const pengelolaDializer = (reg, it, pasien) => {
      let kini = null;
      return (t) => {
        if (!kini || kini.status !== 'aktif') {
          kini = ctx.tambah('hd_dializer', {
            registrasi_uuid: reg.uuid, item_medis_uuid: it.uuid, serial: ctx.kode(`DLZ-${F.kode}-`, t), pemakaian_maksimal: it.maks,
            jumlah_pakai: 0, status: 'aktif', alasan_berhenti: null, dibuat_oleh: pasien.perawat, created_at: (t ?? ctx.SEKARANG) - 1800,
          });
          hit.dializer++;
        }
        return kini;
      };
    };

    const buatResep = (reg, pasien, t, status) => ctx.tambah('hd_resep', {
      registrasi_uuid: reg.uuid, durasi_menit: pasien.durasi, qb_ml_menit: pasien.qb, qd_ml_menit: 500,
      uf_goal_ml: Math.round((pasien.idwgRata + 0.3) * 10) * 100, antikoagulan: pasien.antikoagulan.teks, dialisat: pasien.dialisat,
      akses_vaskular: pasien.akses.teks, catatan: reg.jenis === 'akut' ? 'HD inisiasi, evaluasi fungsi ginjal tiap sesi' : null,
      status, dibuat_oleh: oleh(dokter), disahkan_oleh: status === 'draft' ? null : oleh(dokter), disahkan_pada: status === 'draft' ? null : t + 1800,
      created_at: t, updated_at: t + 1800,
    });

    const profilPasien = (akut) => {
      const akses = akut ? { teks: 'Kateter double lumen femoral kanan (akut)', jarum: false } : AKSES[Number(ctx.berbobot(Object.fromEntries(AKSES.map((a, i) => [i, a.bobot]))))];
      return {
        kering: ctx.desimal(42, 78, 1), idwgRata: ctx.desimal(1.5, 2.8, 1), akses, perawat: oleh(perawat),
        durasi: akut ? ctx.pilih([180, 240]) : ctx.pilih([240, 240, 270, 300]), qb: ctx.pilih(akut ? [180, 200] : [200, 220, 250, 250, 280, 300]),
        antikoagulan: akut ? ANTIKOAGULAN[ctx.pilih([2, 3])] : ANTIKOAGULAN[Number(ctx.berbobot({ 0: 6, 1: 3, 2: 1 }))], dialisat: ctx.pilih(DIALISAT),
      };
    };

    // ── HD kronis: jadwal rutin 2x/minggu ──
    const awalJendela = ctx.HARI - 1;
    const akhirDepan = 13; // jadwal rutin sampai 2 minggu ke depan
    slotKronis.forEach((sl, idx) => {
      const p = pasienHd[idx];
      const pasien = profilPasien(false);
      const baru = ctx.peluang(0.12);
      const regMulai = baru ? ctx.hariLalu(ctx.antara(12, 45)) + ctx.antara(8, 14) * 3600 : ctx.hariLalu(ctx.antara(ctx.HARI + 10, 700)) + ctx.antara(8, 14) * 3600;
      const berhentiHari = idx > 0 && ctx.peluang(0.05) ? ctx.antara(7, 30) : null; // registrasi dinonaktifkan di tengah periode
      const reg = ctx.tambah('hd_registrasi', {
        patient_uuid: p.uuid, no_reg_hd: noRegHd(regMulai), jenis: 'kronis', no_reg: null, payment_method: ctx.peluang(0.88) ? 2 : 1,
        status: berhentiHari ? 'nonaktif' : 'aktif', catatan: ctx.pilih(['CKD stadium 5 on HD rutin', 'CKD stadium 5 ec nefropati diabetik', 'CKD stadium 5 ec hipertensi', 'CKD stadium 5 ec glomerulonefritis kronis']),
        alasan_nonaktif: berhentiHari ? ctx.pilih(['Pindah ke unit HD faskes lain (dekat domisili)', 'Beralih ke CAPD']) : null,
        dibuat_oleh: oleh(perawat), created_at: regMulai, updated_at: berhentiHari ? ctx.hariLalu(berhentiHari) + 15 * 3600 : regMulai,
      });
      hit.registrasi++;
      // Resep: resep lama (nonaktif) bila pasien lama dan resep diganti di tengah periode; resep sah terkini.
      const gantiResep = !baru && ctx.peluang(0.3) ? ctx.antara(10, 40) : null;
      let resepLama = null;
      if (gantiResep) {
        resepLama = buatResep(reg, { ...pasien, qb: pasien.qb - 20 > 180 ? pasien.qb - 20 : pasien.qb, durasi: 240 }, regMulai + 3600, 'nonaktif');
        resepLama.updated_at = ctx.hariLalu(gantiResep) + 9 * 3600;
      }
      const resepSah = buatResep(reg, pasien, gantiResep ? ctx.hariLalu(gantiResep) + 8 * 3600 : regMulai + 3600, 'sah');
      const resepUntuk = (t) => (resepLama && t < Number(resepSah.disahkan_pada) ? resepLama : resepSah);
      const dializer = pengelolaDializer(reg, item['HD-DLZ-LF16'], pasien);
      const rencana = ctx.uuidv7();
      const mulaiHari = Math.min(awalJendela, Math.floor((ctx.hariLalu(0) - regMulai) / 86400) - 1);
      const sampaiHari = berhentiHari ? berhentiHari + 1 : -akhirDepan;
      const bulanAdekuasi = new Set();
      for (let n = mulaiHari; n >= sampaiHari; n--) {
        const hari = ctx.hariLalu(n);
        if (!sl.hari.includes(isoHari(hari))) continue;
        const tgl = ctx.tglIso(hari);
        terpakai.add(`${sl.m.uuid}|${sl.s.uuid}|${tgl}`);
        const mulaiShift = hari + jamShift(sl.s);
        const jadwal = ctx.tambah('hd_jadwal', {
          registrasi_uuid: reg.uuid, mesin_uuid: sl.m.uuid, shift_uuid: sl.s.uuid, tanggal: tgl, pola: 'rutin', rencana_uuid: rencana, no_reg: null,
          versi: 1, status: 'terjadwal', catatan: null, hadir_pada: null, alasan_batal: null, dibatalkan_oleh: null, dibuat_oleh: reg.dibuat_oleh,
          created_at: Math.max(regMulai + 7200, ctx.hariLalu(awalJendela + 1)), updated_at: Math.max(regMulai + 7200, ctx.hariLalu(awalJendela + 1)),
        });
        hit.jadwal++;
        if (n < 0 || mulaiShift > ctx.SEKARANG) continue; // jadwal mendatang
        if (ctx.peluang(0.035)) {
          Object.assign(jadwal, {
            status: 'batal', versi: 2, alasan_batal: ctx.pilih(['Pasien dirawat inap di RS lain', 'Pasien berhalangan hadir (sakit)', 'Pasien pulang kampung, HD di faskes lain sementara']),
            dibatalkan_oleh: pasien.perawat, updated_at: mulaiShift - ctx.antara(2, 20) * 3600,
          });
          continue;
        }
        if (ctx.peluang(0.012)) {
          // Batal saat asesmen: sesi batal, jadwal tetap 'hadir' (sesuai alur aplikasi).
          const t = mulaiShift + 900;
          ctx.tambah('hd_sesi', {
            jadwal_uuid: jadwal.uuid, resep_uuid: resepUntuk(t).uuid, status: 'batal', status_tagihan: 'belum', dibuka_oleh: pasien.perawat,
            alasan_batal: ctx.pilih(['TD 196/112 mmHg saat asesmen, HD ditunda sesuai advis DPJP', 'Demam 38,6 °C, dirujuk ke IGD']), created_at: t, updated_at: t + 1200,
          });
          Object.assign(jadwal, { status: 'hadir', hadir_pada: t - 600, updated_at: t + 1200 });
          continue;
        }
        const bulan = tgl.slice(0, 7);
        const adekuasi = !bulanAdekuasi.has(bulan) && Number(tgl.slice(8)) <= 10;
        const sesi = buatSesi({ reg, resep: resepUntuk(mulaiShift), jadwal, mulaiShift, pasien, dializer: () => dializer(mulaiShift), adekuasi });
        if (sesi && adekuasi && sesi.status === 'selesai') bulanAdekuasi.add(bulan);
      }
    });

    // ── HD akut: 1–3 sesi satu kali di slot kosong, lalu registrasi nonaktif ──
    for (let i = 0; i < jml.akut; i++) {
      const p = pasienHd[jml.kronis + i] ?? ctx.pasien({ baru: true });
      const pasien = profilPasien(true);
      const awal = ctx.antara(10, ctx.HARI - 5);
      const regMulai = ctx.hariLalu(awal) + ctx.antara(7, 10) * 3600;
      const reg = ctx.tambah('hd_registrasi', {
        patient_uuid: p.uuid, no_reg_hd: noRegHd(regMulai), jenis: 'akut', no_reg: null, payment_method: ctx.peluang(0.7) ? 2 : 1, status: 'nonaktif',
        catatan: ctx.pilih(['AKI stadium 3 ec sepsis, indikasi HD cito', 'AKI on CKD dengan hiperkalemia', 'Overload cairan refrakter diuretik']),
        alasan_nonaktif: ctx.pilih(['Fungsi ginjal membaik, HD dihentikan', 'Dilanjutkan HD rutin di faskes asal']), dibuat_oleh: oleh(perawat), created_at: regMulai,
      });
      hit.registrasi++;
      const resep = buatResep(reg, pasien, regMulai + 1800, 'sah');
      const dializer = pengelolaDializer(reg, item['HD-DLZ-HF18'], pasien);
      let n = awal;
      let akhir = regMulai;
      for (let k = 0, jumlah = ctx.antara(1, 3); k < jumlah && n >= 1; n -= ctx.antara(1, 2)) {
        const hari = ctx.hariLalu(n);
        const tgl = ctx.tglIso(hari);
        const kosong = mesin.flatMap((m) => shift.map((s) => ({ m, s }))).find(({ m, s }) => !terpakai.has(`${m.uuid}|${s.uuid}|${tgl}`) && (k > 0 || hari + jamShift(s) > regMulai));
        if (!kosong) continue;
        terpakai.add(`${kosong.m.uuid}|${kosong.s.uuid}|${tgl}`);
        const mulaiShift = hari + jamShift(kosong.s);
        const jadwal = ctx.tambah('hd_jadwal', {
          registrasi_uuid: reg.uuid, mesin_uuid: kosong.m.uuid, shift_uuid: kosong.s.uuid, tanggal: tgl, pola: 'satu_kali', rencana_uuid: null, versi: 1,
          status: 'terjadwal', catatan: k === 0 ? 'HD inisiasi (akut)' : null, dibuat_oleh: reg.dibuat_oleh, created_at: Math.min(regMulai + 1200, mulaiShift - 600),
        });
        hit.jadwal++;
        const sesi = buatSesi({ reg, resep, jadwal, mulaiShift, pasien, dializer: () => dializer(mulaiShift), adekuasi: k === 0 });
        if (sesi?.selesai_pada) akhir = Number(sesi.selesai_pada);
        k++;
      }
      reg.updated_at = akhir + 3600;
    }
    return `${mesin.length} mesin aktif, ${shift.length} shift, ${hit.registrasi} registrasi, ${hit.jadwal} jadwal, ${hit.sesi} sesi, ${hit.observasi} observasi, ${hit.adekuasi} adekuasi, ${hit.dializer} dializer`;
  },
};

const SATUAN = {
  td_sistolik: 'mmHg', td_diastolik: 'mmHg', nadi: 'x/menit', suhu: '°C', napas: 'x/menit', spo2: '%', qb_ml_menit: 'mL/menit', qd_ml_menit: 'mL/menit',
  uf_volume_ml: 'mL', uf_rate_ml_jam: 'mL/jam', tmp_mmhg: 'mmHg', tekanan_arteri_mmhg: 'mmHg', tekanan_vena_mmhg: 'mmHg', konduktivitas_ms_cm: 'mS/cm',
  suhu_dialisat: '°C', heparin_ml_jam: 'mL/jam',
};
