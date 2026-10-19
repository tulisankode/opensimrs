import crypto from "crypto";
import { permintaanSalah } from "../umum/respons.js";
import { OFFSET_WIB, HARI, awalHariWib, cekPilihan, konflik, pilihan, teks, teksWajib, wajibPilihan } from "../sarpras/bersama.js";

// Konstanta & helper murni modul Akuntansi & Remunerasi (STD-0031). Tanpa database agar dapat diuji unit
// (test/akuntansi.test.js). Helper validasi umum (teks, enum, WIB) dipakai ulang dari sarpras/bersama.js.
//
// Uang: kolom NUMERIC(18,2); di JavaScript dihitung dalam SEN (bilangan bulat) agar penjumlahan tidak terkena galat
// floating point, lalu dikirim ke PostgreSQL sebagai teks "123456.78". Tanggal transaksi = awal hari Asia/Jakarta
// (epoch detik 00.00 WIB); periode akuntansi = bulan kalender WIB.
export { pilihan, teks, teksWajib, cekPilihan, wajibPilihan, konflik, awalHariWib };

export const KELOMPOK_AKUN = { aset: "Aset", kewajiban: "Kewajiban", ekuitas: "Ekuitas", pendapatan: "Pendapatan", beban: "Beban" };
export const SALDO_NORMAL = { debit: "Debit", kredit: "Kredit" };
// Klasifikasi laporan per kelompok (neraca: aset/kewajiban/ekuitas; laba rugi/laporan operasional: pendapatan/beban).
export const KLASIFIKASI = {
  aset_lancar: "Aset Lancar",
  aset_tidak_lancar: "Aset Tidak Lancar",
  kewajiban_pendek: "Kewajiban Jangka Pendek",
  kewajiban_panjang: "Kewajiban Jangka Panjang",
  ekuitas: "Ekuitas",
  pendapatan_usaha: "Pendapatan Usaha / Layanan",
  pendapatan_lain: "Pendapatan Lain-lain",
  beban_pelayanan: "Beban Pelayanan",
  beban_umum: "Beban Umum & Administrasi",
  beban_lain: "Beban Lain-lain",
};
export const KLASIFIKASI_KELOMPOK = {
  aset: ["aset_lancar", "aset_tidak_lancar"],
  kewajiban: ["kewajiban_pendek", "kewajiban_panjang"],
  ekuitas: ["ekuitas"],
  pendapatan: ["pendapatan_usaha", "pendapatan_lain"],
  beban: ["beban_pelayanan", "beban_umum", "beban_lain"],
};
export const JENIS_AKUN = { induk: "Induk (judul, tidak dapat dijurnal)", rinci: "Rinci (dapat dijurnal)" };
export const ARUS_KAS = { operasi: "Aktivitas Operasi", investasi: "Aktivitas Investasi", pendanaan: "Aktivitas Pendanaan" };
export const BUKU_PEMBANTU = { piutang: "Piutang (aging per penjamin)", utang: "Utang (aging per supplier)" };
export const JENIS_JURNAL = { otomatis: "Otomatis", manual: "Manual", penyesuaian: "Penyesuaian", koreksi: "Koreksi" };
export const STATUS_JURNAL = { menunggu: "Menunggu Persetujuan", final: "Final", ditolak: "Ditolak", dibatalkan: "Dibatalkan" };
export const STATUS_EVENT = { dijurnal: "Dijurnal", tertahan: "Tertahan", konflik: "Konflik (perlu rekonsiliasi)", dilewati: "Dilewati" };
export const STATUS_PERIODE = { terbuka: "Terbuka", tutup: "Tutup" };
// Ambang bawaan persetujuan tingkat 2 bila faskes belum mengaturnya (keputusan kebijakan faskes; dapat diubah di Periode).
export const AMBANG_TINGKAT_2_BAWAAN = "50000000.00";
export const NOMINAL_MAKS_SEN = 1e15; // Rp 10 triliun — batas wajar per baris, jauh di bawah batas NUMERIC(18,2)

// ── Uang (sen)
export const keSen = (v, nama = "nominal") => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw permintaanSalah(`${nama} harus berupa angka`);
    return Math.round(v * 100);
  }
  const t = String(v).trim().replace(",", ".");
  const m = /^(-)?(\d+)(?:\.(\d{1,2})\d*)?$/.exec(t);
  if (!m) throw permintaanSalah(`${nama} harus berupa angka`);
  const sen = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  return m[1] ? -sen : sen;
};
export const dariSen = (sen) => {
  const n = Math.round(Number(sen) || 0);
  const abs = Math.abs(n);
  return `${n < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};
// Nominal tidak negatif dari body (≤ 2 desimal; lebih dari itu ditolak agar tidak ada pembulatan diam-diam).
export const nominalWajib = (v, nama) => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number" && !Number.isFinite(v)) throw permintaanSalah(`${nama} harus berupa angka`);
  const t = typeof v === "number" ? String(v) : String(v).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) throw permintaanSalah(`${nama} harus berupa angka tidak negatif dengan paling banyak 2 desimal`);
  const sen = keSen(t, nama);
  if (sen > NOMINAL_MAKS_SEN) throw permintaanSalah(`${nama} melebihi batas`);
  return sen;
};

// ── Tanggal & periode (Asia/Jakarta)
export const periodeDari = (epoch) => {
  const d = new Date((Math.floor(Number(epoch)) + OFFSET_WIB) * 1000);
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1 };
};
export const rentangPeriode = (tahun, bulan) => ({
  awal: Date.UTC(tahun, bulan - 1, 1) / 1000 - OFFSET_WIB,
  akhir: Date.UTC(tahun, bulan, 1) / 1000 - OFFSET_WIB - 1,
});
export const awalTahun = (tahun) => Date.UTC(tahun, 0, 1) / 1000 - OFFSET_WIB;
export const akhirHariWib = (epoch) => awalHariWib(epoch) + HARI - 1;
export const periodeWajib = (q = {}) => {
  const tahun = Number(q.tahun);
  const bulan = Number(q.bulan);
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) throw permintaanSalah("tahun wajib diisi (2000–2100)");
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) throw permintaanSalah("bulan wajib diisi (1–12)");
  return { tahun, bulan };
};
// Tanggal transaksi dari body: epoch detik → awal hari WIB.
export const tanggalWajib = (v, nama = "tanggal") => {
  const n = Number(v);
  if (v === undefined || v === null || v === "" || !Number.isFinite(n) || n <= 0) throw permintaanSalah(`${nama} wajib berupa epoch detik`);
  return awalHariWib(n);
};
// Rentang laporan ?dari=&sampai= (epoch); bawaan: bulan berjalan WIB.
export const rentangWajib = (q = {}, sekarang = Math.floor(Date.now() / 1000)) => {
  const p = periodeDari(sekarang);
  const bawaan = rentangPeriode(p.tahun, p.bulan);
  const dari = q.dari ? awalHariWib(Number(q.dari)) : bawaan.awal;
  const sampai = q.sampai ? akhirHariWib(Number(q.sampai)) : bawaan.akhir;
  if (!Number.isFinite(dari) || !Number.isFinite(sampai)) throw permintaanSalah("dari/sampai harus berupa epoch detik");
  if (dari > sampai) throw permintaanSalah("Tanggal awal tidak boleh setelah tanggal akhir");
  if (sampai - dari > 366 * 5 * HARI) throw permintaanSalah("Rentang maksimal 5 tahun");
  return { dari, sampai };
};

// ── Hash data event (KF-6): JSON kanonis (kunci terurut) → SHA-256.
const kanonis = (nilai) => {
  if (Array.isArray(nilai)) return nilai.map(kanonis);
  if (nilai && typeof nilai === "object") return Object.fromEntries(Object.keys(nilai).sort().map((k) => [k, kanonis(nilai[k])]));
  return nilai;
};
export const hashData = (data) => crypto.createHash("sha256").update(JSON.stringify(kanonis(data ?? {}))).digest("hex");

// ── Keseimbangan jurnal (baris dalam sen: { debit, kredit }).
export const totalBaris = (baris) => (baris ?? []).reduce((t, b) => ({ debit: t.debit + (b.debit || 0), kredit: t.kredit + (b.kredit || 0) }), { debit: 0, kredit: 0 });
export const pastikanSeimbang = (baris) => {
  if (!Array.isArray(baris) || baris.length < 2) throw permintaanSalah("Jurnal minimal 2 baris");
  for (const [i, b] of baris.entries()) {
    if (!Number.isInteger(b.debit) || !Number.isInteger(b.kredit) || b.debit < 0 || b.kredit < 0) throw permintaanSalah(`Baris ${i + 1}: nominal tidak valid`);
    if ((b.debit > 0) === (b.kredit > 0)) throw permintaanSalah(`Baris ${i + 1}: isi tepat salah satu dari debit atau kredit`);
  }
  const t = totalBaris(baris);
  if (t.debit !== t.kredit) throw permintaanSalah(`Jurnal tidak seimbang: debit ${dariSen(t.debit)} ≠ kredit ${dariSen(t.kredit)} (selisih ${dariSen(t.debit - t.kredit)})`);
  return t;
};
// Gabungkan baris dengan komponen + sisi + dimensi sama, buang baris nol, dan ubah nilai negatif ke sisi seberang.
export const rapikanBaris = (baris) => {
  const peta = new Map();
  for (const b of baris) {
    const net = (b.debit || 0) - (b.kredit || 0);
    if (!net) continue;
    const kunci = [b.komponen, net > 0 ? "D" : "K", b.penjamin_uuid ?? "", b.supplier_uuid ?? ""].join("|");
    const ada = peta.get(kunci);
    if (ada) {
      if (net > 0) ada.debit += net;
      else ada.kredit += -net;
    } else peta.set(kunci, { ...b, debit: net > 0 ? net : 0, kredit: net < 0 ? -net : 0 });
  }
  return [...peta.values()];
};

// Validasi baris jurnal manual/penyesuaian/koreksi dari body (akun_uuid + debit/kredit). 400 bila tidak seimbang (KT-5).
export const validasiBarisManual = (v) => {
  if (!Array.isArray(v) || v.length < 2) throw permintaanSalah("baris jurnal minimal 2 baris (debit dan kredit)");
  if (v.length > 200) throw permintaanSalah("baris jurnal maksimal 200 baris");
  const baris = v.map((b, i) => {
    if (!b || typeof b !== "object") throw permintaanSalah(`baris ${i + 1} tidak valid`);
    const debit = nominalWajib(b.debit, `baris ${i + 1}: debit`);
    const kredit = nominalWajib(b.kredit, `baris ${i + 1}: kredit`);
    if (debit > 0 && kredit > 0) throw permintaanSalah(`baris ${i + 1}: isi hanya salah satu dari debit atau kredit`);
    if (!debit && !kredit) throw permintaanSalah(`baris ${i + 1}: debit atau kredit wajib diisi`);
    return {
      akun_uuid: teksWajib(b.akun_uuid, `baris ${i + 1}: akun_uuid`, 255),
      debit,
      kredit,
      uraian: teks(b.uraian, `baris ${i + 1}: uraian`, 500) ?? null,
      penjamin_uuid: teks(b.penjamin_uuid, `baris ${i + 1}: penjamin_uuid`, 255) ?? null,
      supplier_uuid: teks(b.supplier_uuid, `baris ${i + 1}: supplier_uuid`, 255) ?? null,
    };
  });
  pastikanSeimbang(baris);
  return baris;
};

// Baris pembalik untuk jurnal koreksi: sisi debit/kredit ditukar.
export const balikBaris = (baris) => baris.map((b) => ({ ...b, debit: b.kredit, kredit: b.debit }));

// Jumlah tingkat persetujuan: 1, atau 2 bila total ≥ ambang (ambang null = selalu 1 tingkat).
export const tingkatWajib = (totalSen, ambang) => (ambang !== null && ambang !== undefined && ambang !== "" && totalSen >= keSen(ambang) ? 2 : 1);

// Validasi keputusan persetujuan: pembuat ≠ penyetuju dan penyetuju tiap tingkat berbeda (KF-8, segregation of duties).
export const cekBolehSetujui = (jurnal, pengguna, penyetujuSebelumnya = []) => {
  if (jurnal.status !== "menunggu") throw konflik("Jurnal tidak sedang menunggu persetujuan");
  if (!pengguna) throw permintaanSalah("Pengguna tidak dikenali");
  if (String(jurnal.dibuat_oleh ?? "").toLowerCase() === String(pengguna).toLowerCase())
    throw konflik("Pembuat jurnal tidak boleh menyetujui jurnalnya sendiri");
  if (penyetujuSebelumnya.some((p) => String(p).toLowerCase() === String(pengguna).toLowerCase()))
    throw konflik("Penyetuju tingkat berikutnya harus orang yang berbeda dari penyetuju sebelumnya");
  return Number(jurnal.tingkat_disetujui || 0) + 1;
};

// ── Pemetaan event → akun. Komponen "pendapatan:RJ" dicari persis lebih dulu, lalu induknya "pendapatan" (fallback umum).
// `aturan`: [{ komponen, akun_uuid, berlaku_mulai, aktif }] untuk satu jenis event; dipilih aturan aktif dengan
// berlaku_mulai terbaru yang ≤ tanggal transaksi (KF-2/KF-3). null bila tidak ada (event ditahan, tanpa akun tebakan).
export const pilihAturan = (aturan, komponen, tanggal) => {
  const kandidat = (kode) =>
    aturan
      .filter((a) => a.komponen === kode && a.aktif !== false && Number(a.berlaku_mulai) <= tanggal)
      .sort((a, b) => Number(b.berlaku_mulai) - Number(a.berlaku_mulai))[0] ?? null;
  const persis = kandidat(komponen);
  if (persis) return persis;
  const i = komponen.indexOf(":");
  return i > 0 ? kandidat(komponen.slice(0, i)) : null;
};
// Petakan seluruh baris event ke akun; mengembalikan { baris, kurang: [komponen tanpa aturan] }.
export const petakanBaris = (barisEvent, aturan, tanggal) => {
  const kurang = [];
  const baris = barisEvent.map((b) => {
    const a = pilihAturan(aturan, b.komponen, tanggal);
    if (!a) kurang.push(b.komponen);
    return { ...b, akun_uuid: a?.akun_uuid ?? null };
  });
  return { baris, kurang: [...new Set(kurang)] };
};

// ── Saldo & laporan. `saldo`: [{ uuid, kode, nama, kelompok, saldo_normal, klasifikasi, kas_setara_kas, arus_kas,
// debit (sen), kredit (sen) }]. Saldo "normal" = debit − kredit untuk akun bersaldo normal debit, sebaliknya kredit − debit.
export const saldoNormal = (a) => (a.saldo_normal === "kredit" ? a.kredit - a.debit : a.debit - a.kredit);
// Nilai penyajian laporan menurut KELOMPOK (bukan saldo normal akun): aset & beban = debit − kredit, kewajiban, ekuitas &
// pendapatan = kredit − debit. Akun lawan (kontra) seperti akumulasi penyusutan atau potongan pendapatan dengan demikian
// tampil sebagai pengurang di kelompoknya, dan total laporan konsisten dengan neraca.
export const nilaiKelompok = (a) => (a.kelompok === "aset" || a.kelompok === "beban" ? a.debit - a.kredit : a.kredit - a.debit);
export const labaDari = (saldo) =>
  saldo.filter((a) => a.kelompok === "pendapatan" || a.kelompok === "beban").reduce((t, a) => t + (a.kredit - a.debit), 0);

const kelompokkan = (akun, urutan) =>
  urutan
    .map((k) => {
      const isi = akun.filter((a) => a.klasifikasi === k).map((a) => ({ uuid: a.uuid, kode: a.kode, nama: a.nama, nilai: a.nilai }));
      return { klasifikasi: k, nama: KLASIFIKASI[k], akun: isi, total: isi.reduce((t, a) => t + a.nilai, 0) };
    })
    .filter((g) => g.akun.length);

// Neraca per tanggal: aset = kewajiban + ekuitas, dengan surplus/defisit tahun berjalan dan tahun-tahun lalu dihitung
// dari akun pendapatan/beban (tanpa jurnal penutup). `saldoSd` = saldo s.d. tanggal; `saldoSebelumTahun` = s.d. akhir
// tahun sebelumnya (untuk memisahkan surplus akumulasi dari surplus tahun berjalan).
export const hitungNeraca = (saldoSd, saldoSebelumTahun) => {
  const nilai = (kelompok) => saldoSd.filter((a) => a.kelompok === kelompok).map((a) => ({ ...a, nilai: nilaiKelompok(a) })).filter((a) => a.nilai !== 0);
  const aset = kelompokkan(nilai("aset"), KLASIFIKASI_KELOMPOK.aset);
  const kewajiban = kelompokkan(nilai("kewajiban"), KLASIFIKASI_KELOMPOK.kewajiban);
  const ekuitasAkun = kelompokkan(nilai("ekuitas"), KLASIFIKASI_KELOMPOK.ekuitas);
  const surplusLalu = labaDari(saldoSebelumTahun);
  const surplusBerjalan = labaDari(saldoSd) - surplusLalu;
  const totalAset = aset.reduce((t, g) => t + g.total, 0);
  const totalKewajiban = kewajiban.reduce((t, g) => t + g.total, 0);
  const totalEkuitas = ekuitasAkun.reduce((t, g) => t + g.total, 0) + surplusLalu + surplusBerjalan;
  return {
    aset,
    kewajiban,
    ekuitas: ekuitasAkun,
    surplus_tahun_lalu: surplusLalu,
    surplus_tahun_berjalan: surplusBerjalan,
    total_aset: totalAset,
    total_kewajiban: totalKewajiban,
    total_ekuitas: totalEkuitas,
    seimbang: totalAset === totalKewajiban + totalEkuitas,
  };
};

// Laba rugi / laporan operasional untuk mutasi dalam rentang.
export const hitungLabaRugi = (mutasi) => {
  const nilai = (kelompok) => mutasi.filter((a) => a.kelompok === kelompok).map((a) => ({ ...a, nilai: nilaiKelompok(a) })).filter((a) => a.nilai !== 0);
  const pendapatan = kelompokkan(nilai("pendapatan"), KLASIFIKASI_KELOMPOK.pendapatan);
  const beban = kelompokkan(nilai("beban"), KLASIFIKASI_KELOMPOK.beban);
  const totalPendapatan = pendapatan.reduce((t, g) => t + g.total, 0);
  const totalBeban = beban.reduce((t, g) => t + g.total, 0);
  return { pendapatan, beban, total_pendapatan: totalPendapatan, total_beban: totalBeban, surplus: totalPendapatan - totalBeban };
};

// Arus kas metode LANGSUNG dari baris jurnal final dalam rentang. Untuk setiap jurnal yang menyentuh akun kas, setiap
// baris non-kas menyumbang (kredit − debit) ke arus kas sesuai kelompok arus kas akunnya — karena jurnal seimbang,
// jumlah sumbangan baris non-kas tepat sama dengan perubahan kas pada jurnal itu (tanpa alokasi/proporsi).
// `baris`: [{ jurnal_uuid, akun_uuid, kode, nama, kas_setara_kas, arus_kas, kelompok, debit, kredit }].
export const hitungArusKasLangsung = (baris) => {
  const perJurnal = new Map();
  for (const b of baris) {
    if (!perJurnal.has(b.jurnal_uuid)) perJurnal.set(b.jurnal_uuid, []);
    perJurnal.get(b.jurnal_uuid).push(b);
  }
  const grup = { operasi: new Map(), investasi: new Map(), pendanaan: new Map() };
  for (const isi of perJurnal.values()) {
    if (!isi.some((b) => b.kas_setara_kas) || isi.every((b) => b.kas_setara_kas)) continue;
    for (const b of isi.filter((x) => !x.kas_setara_kas)) {
      // Pendapatan/beban & akun tanpa kelompok arus kas → aktivitas operasi.
      const peta = grup[b.arus_kas] ?? grup.operasi;
      const ada = peta.get(b.akun_uuid) ?? { akun_uuid: b.akun_uuid, kode: b.kode, nama: b.nama, nilai: 0 };
      ada.nilai += b.kredit - b.debit;
      peta.set(b.akun_uuid, ada);
    }
  }
  const susun = (peta) => {
    const akun = [...peta.values()].filter((a) => a.nilai !== 0).sort((a, b) => a.kode.localeCompare(b.kode));
    return { akun, total: akun.reduce((t, a) => t + a.nilai, 0) };
  };
  const hasil = { operasi: susun(grup.operasi), investasi: susun(grup.investasi), pendanaan: susun(grup.pendanaan) };
  return { ...hasil, kenaikan_kas: hasil.operasi.total + hasil.investasi.total + hasil.pendanaan.total };
};

// Arus kas metode TIDAK LANGSUNG dari mutasi per akun dalam rentang: surplus + perubahan akun neraca non-kas
// (sumbangan = −(debit − kredit)) dikelompokkan per kelompok arus kas akunnya (bawaan: operasi).
export const hitungArusKasTidakLangsung = (mutasi) => {
  const surplus = labaDari(mutasi);
  const grup = { operasi: [], investasi: [], pendanaan: [] };
  for (const a of mutasi) {
    if (a.kas_setara_kas || a.kelompok === "pendapatan" || a.kelompok === "beban") continue;
    const nilai = a.kredit - a.debit;
    if (!nilai) continue;
    (grup[a.arus_kas] ?? grup.operasi).push({ akun_uuid: a.uuid, kode: a.kode, nama: a.nama, nilai });
  }
  const total = (x) => x.reduce((t, a) => t + a.nilai, 0);
  const operasi = { surplus, penyesuaian: grup.operasi, total: surplus + total(grup.operasi) };
  const investasi = { akun: grup.investasi, total: total(grup.investasi) };
  const pendanaan = { akun: grup.pendanaan, total: total(grup.pendanaan) };
  return { operasi, investasi, pendanaan, kenaikan_kas: operasi.total + investasi.total + pendanaan.total };
};

// Aging piutang/utang dengan pencocokan FIFO per pihak (penjamin/supplier). `baris` urut tanggal: untuk piutang debit
// menambah tagihan terbuka & kredit melunasi yang tertua; untuk utang sebaliknya. Sisa dikelompokkan menurut umur
// (hari sejak tanggal transaksi terhadap `acuan`): 0–30, 31–60, 61–90, > 90 hari. Sisa negatif = lebih bayar.
export const KELOMPOK_UMUR = { b0_30: "0–30 hari", b31_60: "31–60 hari", b61_90: "61–90 hari", b90: "> 90 hari" };
export const kelompokUmur = (hari) => (hari <= 30 ? "b0_30" : hari <= 60 ? "b31_60" : hari <= 90 ? "b61_90" : "b90");
export const hitungAging = (baris, jenis, acuan) => {
  const perPihak = new Map();
  for (const b of baris) {
    const pihak = (jenis === "piutang" ? b.penjamin_uuid : b.supplier_uuid) ?? "";
    if (!perPihak.has(pihak)) perPihak.set(pihak, { pihak_uuid: pihak || null, nama: b.nama_pihak ?? null, buka: [], lebih: 0 });
    const p = perPihak.get(pihak);
    if (b.nama_pihak && !p.nama) p.nama = b.nama_pihak;
    const tambah = jenis === "piutang" ? b.debit - b.kredit : b.kredit - b.debit;
    if (tambah > 0) {
      let sisa = tambah;
      // Lebih bayar sebelumnya langsung mengurangi tagihan baru.
      if (p.lebih > 0) {
        const pakai = Math.min(p.lebih, sisa);
        p.lebih -= pakai;
        sisa -= pakai;
      }
      if (sisa > 0) p.buka.push({ tanggal: Number(b.tanggal), sisa });
    } else if (tambah < 0) {
      let kurang = -tambah;
      while (kurang > 0 && p.buka.length) {
        const pertama = p.buka[0];
        const pakai = Math.min(pertama.sisa, kurang);
        pertama.sisa -= pakai;
        kurang -= pakai;
        if (!pertama.sisa) p.buka.shift();
      }
      p.lebih += kurang;
    }
  }
  const hasil = [...perPihak.values()].map((p) => {
    const umur = { b0_30: 0, b31_60: 0, b61_90: 0, b90: 0 };
    for (const x of p.buka) umur[kelompokUmur(Math.floor((awalHariWib(acuan) - awalHariWib(x.tanggal)) / HARI))] += x.sisa;
    const total = Object.values(umur).reduce((t, v) => t + v, 0) - p.lebih;
    return { pihak_uuid: p.pihak_uuid, nama: p.nama, ...umur, lebih_bayar: p.lebih, total };
  });
  return hasil.filter((h) => h.total !== 0 || h.lebih_bayar !== 0).sort((a, b) => b.total - a.total);
};
