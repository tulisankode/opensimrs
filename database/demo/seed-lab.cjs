'use strict';

// Master data demo modul laboratorium (lab-service), dipanggil seed-demo.cjs dan isi-master-penunjang.cjs per faskes
// yang modul laboratoriumnya aktif.
// ctx: { ins(tabel, baris) → uuid, satu(sql, params), db, F (spesifikasi faskes katalog-demo), fUuid, base
//        ({ faskes_uuid, created_at, updated_at }), punya(kodeModul), level (1 praktik … 3 RS), penjamin [{uuid,name}],
//        rupiah(n), NOW, komponen ({ JS: { uuid, nama }, JAL: … }, opsional) }. Kembalikan ringkasan singkat (string).
//
// Isi: kategori, item pemeriksaan (+ nilai rujukan / pilihan hasil), kelompok (panel), spesimen, tarif satuan dan paket
// (satu tarif_lab dengan beberapa tarif_lab_item). Kelengkapan mengikuti K.TINGKAT_LAB per segmen faskes.
//
// Idempoten: semua master dicari lewat `code` + faskes_uuid + deleted_at IS NULL; yang sudah ada dilewati tanpa diubah,
// kecuali kelompok yang sudah ada boleh mendapat anggota baru. Aman dijalankan ulang untuk menambah item/kelompok/paket baru.
const K = require('./katalog-demo.cjs');

const JK = { Male: 'Male', Female: 'Female', General: 'General' };

// Nilai rujukan angka → baris nilai_rujukan. Kolom batas bertipe integer dan penanda H/L membandingkan parseInt(hasil),
// jadi batas dibulatkan agar tidak memberi penanda palsu: rentang "a - b" → floor(a)..floor(b), "< b" → ceil(b), "≥ a" → ceil(a).
const barisRujukanAngka = ([jk, bawah, atas, tampilan]) => {
  if (bawah === null) return { jenis_kelamin: JK[jk], batas_bawah_nilai_normal: null, batas_atas_nilai_normal: Math.ceil(atas), operator_nilai_normal: '<', tampilan };
  if (atas === null) return { jenis_kelamin: JK[jk], batas_bawah_nilai_normal: Math.ceil(bawah), batas_atas_nilai_normal: null, operator_nilai_normal: '>=', tampilan };
  return { jenis_kelamin: JK[jk], batas_bawah_nilai_normal: Math.floor(bawah), batas_atas_nilai_normal: Math.floor(atas), operator_nilai_normal: '-', tampilan };
};
const UMUR_SEMUA = { umur_bawah_tahun: 0, umur_bawah_bulan: 0, umur_bawah_hari: 0, umur_atas_tahun: 999, umur_atas_bulan: 0, umur_atas_hari: 0 };

// Harga dasar satu komponen paket (untuk membagi harga paket ke tiap tarif_lab_item & membandingkan dengan harga satuan):
// tarif satuan yang menunjuk komponen tsb., atau (kelompok tanpa tarif sendiri) jumlah tarif satuan anggotanya.
const hargaSatuan = (ref) => {
  const t = K.TARIF_LAB.find(([, , , r]) => (ref.item && r.item === ref.item) || (ref.kelompok && r.kelompok === ref.kelompok));
  if (t) return t[2];
  if (ref.kelompok) {
    const kel = K.KELOMPOK_LAB.find(([kode]) => kode === ref.kelompok);
    return kel[4].reduce((n, item) => n + (hargaSatuan({ item }) || 0), 0);
  }
  return 0;
};

async function seed(ctx) {
  const { ins, satu, db, F, fUuid, base, punya, penjamin, rupiah } = ctx;
  const skala = Number(F?.skala) || 1;
  const tingkat = K.TINGKAT_LAB[F.segmen] ?? (ctx.level >= 3 ? 2 : 0);
  const n = { kategori: 0, item: 0, kelompok: 0, anggota: 0, spesimen: 0, tarif: 0, paket: 0 };

  const cariKode = async (tabel, code) =>
    (await satu(`SELECT uuid FROM "${tabel}" WHERE faskes_uuid = $1 AND code = $2 AND deleted_at IS NULL ORDER BY created_at LIMIT 1`, [fUuid, code]))?.uuid;
  const loincCache = {};
  const loinc = async (code) => {
    if (!(code in loincCache)) loincCache[code] = (await satu(`SELECT uuid FROM loinc WHERE code = $1 AND deleted_at IS NULL LIMIT 1`, [code]))?.uuid;
    if (!loincCache[code]) throw new Error(`LOINC ${code} tidak ada di tabel loinc`);
    return loincCache[code];
  };

  // ── Komponen tarif: Jasa Sarana & Jasa Analis (dibuat bila belum ada, mis. faskes yang modul lab-nya baru diaktifkan) ──
  const komponen = {};
  for (const [kode, nama] of [['JS', 'Jasa Sarana'], ['JAL', 'Jasa Analis']]) {
    let uuid = ctx.komponen?.[kode]?.uuid ?? (await cariKode('name_tarif_komponen', kode));
    if (!uuid) uuid = await ins('name_tarif_komponen', { ...base, code: kode, name: nama, status: true });
    komponen[kode] = uuid;
  }

  // ── Kategori ──
  const katLab = {};
  for (const [i, [kode, nama]] of K.KATEGORI_LAB.entries()) {
    katLab[kode] = await cariKode('category_pemeriksaan', kode);
    if (!katLab[kode]) {
      katLab[kode] = await ins('category_pemeriksaan', { ...base, code: kode, name: nama, status: true, no_urut: i + 1 });
      n.kategori++;
    }
  }

  // ── Item pemeriksaan (+ nilai rujukan / pilihan hasil) ──
  const itemLab = {};
  for (const [i, [kode, nama, kat, kodeLoinc, satuan, input, rujukan, minTingkat]] of K.ITEM_LAB.entries()) {
    const ada = await cariKode('item_pemeriksaan', kode);
    if (ada) { itemLab[kode] = ada; continue; } // item lama tidak diubah
    if (minTingkat > tingkat) continue;
    const angka = Array.isArray(rujukan);
    const teks = !angka && rujukan?.normal?.length > 0;
    const it = await ins('item_pemeriksaan', { ...base, category_pemeriksaan_uuid: katLab[kat], code: kode, name: nama, satuan,
      loinc_uuid: await loinc(kodeLoinc), status: true, no_urut: i + 1, jenis_input: input, status_nilai_rujukan: angka || teks });
    itemLab[kode] = it;
    n.item++;
    if (angka) {
      for (const r of rujukan) {
        await ins('nilai_rujukan', { ...base, item_pemeriksaan_uuid: it, ...UMUR_SEMUA, ...barisRujukanAngka(r), status: true });
      }
    }
    if (rujukan?.pilihan) await ins('pilihan_hasil_item_pemeriksaan', { ...base, item_pemeriksaan_uuid: it, pilihan_hasil: rujukan.pilihan });
    if (teks) {
      await ins('nilai_rujukan', { ...base, item_pemeriksaan_uuid: it, jenis_kelamin: 'General', ...UMUR_SEMUA,
        nilai_normal_text: rujukan.normal, tampilan: rujukan.normal.join(' / '), status: true });
    }
  }

  // ── Kelompok (panel); kelompok lama hanya ditambah anggota yang belum ada ──
  const kelompok = {};
  const anggotaKelompok = {}; // kode kelompok → [uuid item]
  for (const [kode, nama, kat, kodeLoinc, items, minTingkat] of K.KELOMPOK_LAB) {
    let kel = await cariKode('kelompok_pemeriksaan', kode);
    if (!kel) {
      if (minTingkat > tingkat) continue;
      kel = await ins('kelompok_pemeriksaan', { ...base, code: kode, name: nama, category_pemeriksaan_uuid: katLab[kat],
        loinc_uuid: await loinc(kodeLoinc), status: true });
      n.kelompok++;
    }
    kelompok[kode] = kel;
    const { rows } = await db.query(`SELECT item_pemeriksaan_uuid FROM item_kelompok_pemeriksaan WHERE kelompok_pemeriksaan_uuid = $1 AND deleted_at IS NULL`, [kel]);
    const sudah = new Set(rows.map((r) => r.item_pemeriksaan_uuid));
    for (const ki of items) {
      if (!itemLab[ki] || sudah.has(itemLab[ki])) continue; // item di atas tingkat faskes tidak ada → dilewati
      await ins('item_kelompok_pemeriksaan', { kelompok_pemeriksaan_uuid: kel, item_pemeriksaan_uuid: itemLab[ki], created_at: ctx.NOW, updated_at: ctx.NOW });
      sudah.add(itemLab[ki]);
      n.anggota++;
    }
    anggotaKelompok[kode] = [...sudah];
  }

  // ── Spesimen ──
  for (const [kode, nama] of K.SPESIMEN) {
    if (await cariKode('spesimen', kode)) continue;
    await ins('spesimen', { ...base, code: kode, name: nama, status: true });
    n.spesimen++;
  }

  // ── Tarif satuan & paket ──
  const pelayanan = ['rajal', 'aps', ...(punya('igd') ? ['igd'] : []), ...(punya('rawat_inap') ? ['ranap'] : [])];
  const uuidRef = (ref) => (ref.item ? itemLab[ref.item] : kelompok[ref.kelompok]);
  const isiRef = (ref) => (ref.item ? [itemLab[ref.item]] : anggotaKelompok[ref.kelompok] ?? []);
  const buatTarif = async (kode, nama, rincian) => {
    const total = rincian.reduce((s, r) => s + r.total, 0);
    const tl = await ins('tarif_lab', { ...base, code: kode, name: nama, grand_total: total, status: true });
    for (const r of rincian) {
      const tli = await ins('tarif_lab_item', { ...base, tarif_lab_uuid: tl, item_pemeriksaan_uuid: r.ref.item ? uuidRef(r.ref) : null,
        kelompok_pemeriksaan_uuid: r.ref.kelompok ? uuidRef(r.ref) : null, total_tarif: r.total });
      const sarana = rupiah(r.total * 0.6);
      await ins('tarif_komponen_tindakan_lab', { ...base, tarif_lab_uuid: tl, tarif_lab_item_uuid: tli, tarif_komponen_uuid: komponen.JS, tarif_per_komponen: sarana, prosentase_per_komponen: 0 });
      await ins('tarif_komponen_tindakan_lab', { ...base, tarif_lab_uuid: tl, tarif_lab_item_uuid: tli, tarif_komponen_uuid: komponen.JAL, tarif_per_komponen: r.total - sarana, prosentase_per_komponen: 0 });
    }
    for (const p of pelayanan) await ins('tarif_lab_pelayanan', { ...base, tarif_lab_uuid: tl, pelayanan: p });
    for (const pj of penjamin) await ins('tarif_lab_penjamin', { ...base, tarif_lab_uuid: tl, penjamin_uuid: pj.uuid });
    return total;
  };

  for (const [kode, nama, harga, ref, minTingkat] of K.TARIF_LAB) {
    if (minTingkat > tingkat || !uuidRef(ref) || (await cariKode('tarif_lab', kode))) continue;
    await buatTarif(kode, nama, [{ ref, total: rupiah(harga * skala) }]);
    n.tarif++;
  }

  for (const [kode, nama, harga, isi, minTingkat] of K.PAKET_LAB) {
    if (minTingkat > tingkat || (await cariKode('tarif_lab', kode))) continue;
    if (isi.some((ref) => !uuidRef(ref))) throw new Error(`${F.kode} ${kode}: komponen paket belum ada di master`);
    const semua = isi.flatMap(isiRef);
    if (new Set(semua).size !== semua.length) throw new Error(`${F.kode} ${kode}: item pemeriksaan paket tumpang tindih`);
    // Harga paket dibagi ke tiap komponen sebanding harga satuannya; sisa pembulatan masuk komponen terakhir.
    const total = rupiah(harga * skala);
    const bobot = isi.map(hargaSatuan);
    const jumlahSatuan = bobot.reduce((a, b) => a + b, 0);
    const jumlahSatuanFaskes = bobot.reduce((a, b) => a + rupiah(b * skala), 0);
    if (total >= jumlahSatuanFaskes) throw new Error(`${F.kode} ${kode}: harga paket (${total}) tidak lebih murah dari satuannya (${jumlahSatuanFaskes})`);
    let sisa = total;
    const rincian = isi.map((ref, i) => {
      const bagian = i === isi.length - 1 ? sisa : rupiah((total * bobot[i]) / jumlahSatuan);
      sisa -= bagian;
      return { ref, total: bagian };
    });
    await buatTarif(kode, nama, rincian);
    n.paket++;
  }

  const label = ['dasar', 'menengah', 'lengkap'][tingkat];
  return `Laboratorium (${label}): +${n.item} item, +${n.kelompok} kelompok (+${n.anggota} anggota), +${n.tarif} tarif satuan, `
    + `+${n.paket} paket${n.kategori ? `, +${n.kategori} kategori` : ''}${n.spesimen ? `, +${n.spesimen} spesimen` : ''}`;
}

module.exports = { seed };
