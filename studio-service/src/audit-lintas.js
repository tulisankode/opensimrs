// Audit cepat — pemeriksaan LINTAS BERKAS (fungsi murni): pemanggilan metode statis kelas yang diimpor dicocokkan
// dengan definisinya. Menangkap bug seperti `AlkesRepository.editAlkes(req, transaction)` padahal definisinya
// `editAlkes(dataToUpdate, uuid, transaction)` — transaksi Sequelize terkirim sebagai uuid ("Converting circular structure
// to JSON") dan pemanggil satu-argumen membuat WHERE uuid = undefined.

// Pisah teks argumen/parameter pada koma tingkat teratas (abaikan koma di dalam (), [], {}, string, template).
export const pisahTingkatAtas = (teks) => {
  const hasil = [];
  let dalam = 0, kutip = null, awal = 0;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      if (c === "\\") i++;
      else if (c === kutip) kutip = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") kutip = c;
    else if ("([{".includes(c)) dalam++;
    else if (")]}".includes(c)) dalam--;
    else if (c === "," && dalam === 0) { hasil.push(teks.slice(awal, i).trim()); awal = i + 1; }
  }
  const akhir = teks.slice(awal).trim();
  if (akhir || hasil.length) hasil.push(akhir);
  return hasil.filter((x, i, a) => x !== "" || i < a.length - 1);
};

// Isi tanda kurung yang dibuka di posisi `buka` (indeks karakter "(") sampai pasangannya; null bila tidak seimbang.
export const isiKurung = (teks, buka) => {
  let dalam = 0, kutip = null;
  for (let i = buka; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      if (c === "\\") i++;
      else if (c === kutip) kutip = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") kutip = c;
    else if (c === "(") dalam++;
    else if (c === ")" && --dalam === 0) return teks.slice(buka + 1, i);
  }
  return null;
};

// Definisi kelas ber-metode statis: { nama, metode: Map(nama → [{ nama, wajib, sisa }]) }.
export const definisiKelas = (isi) => {
  const kelas = isi.match(/\bclass\s+(\w+)/)?.[1];
  if (!kelas) return null;
  const metode = new Map();
  for (const m of isi.matchAll(/\bstatic\s+(?:async\s+)?(\w+)\s*\(/g)) {
    const buka = m.index + m[0].length - 1;
    const teks = isiKurung(isi, buka);
    if (teks == null) continue;
    // Badan metode (kurung kurawal seimbang setelah daftar parameter) — parameter yang tidak dipakai tidak wajib.
    const awalBadan = isi.indexOf("{", buka + teks.length + 2);
    let badan = "";
    if (awalBadan >= 0) {
      let dalam = 0;
      for (let i = awalBadan; i < isi.length; i++) {
        if (isi[i] === "{") dalam++;
        else if (isi[i] === "}" && --dalam === 0) { badan = isi.slice(awalBadan + 1, i); break; }
      }
    }
    const params = pisahTingkatAtas(teks).filter(Boolean).map((p) => {
      const nama = p.match(/^(?:\.\.\.)?\s*([A-Za-z_$][\w$]*)/)?.[1] ?? p.slice(0, 20);
      const dipakai = !badan || p.startsWith("{") || new RegExp(`\\b${nama.replace(/\$/g, "\\$")}\\b`).test(badan);
      return { nama, wajib: !p.includes("=") && !p.startsWith("...") && dipakai, sisa: p.startsWith("...") };
    });
    if (!metode.has(m[1])) metode.set(m[1], params);
  }
  return { nama: kelas, metode };
};

const MIRIP_TRANSAKSI = /^(transaction|transaksi|tx|trx|t)$/;
const PARAM_TRANSAKSI = /transaction|transaksi|^(tx|trx|t|opsi|options|opts)$/i; // termasuk externalTransaction

// Periksa pemanggilan `Impor.metode(...)` di `isi` terhadap definisi kelas impor. impor: Map(namaLokal → definisi).
// Kembalikan [{ tingkat, judul, rincian, baris }].
export const periksaPanggilan = (isi, impor) => {
  const hasil = [];
  const nomorBaris = (i) => isi.slice(0, i).split("\n").length;
  for (const m of isi.matchAll(/\b([A-Z][\w$]*)\.(\w+)\s*\(/g)) {
    const def = impor.get(m[1]);
    const params = def?.metode.get(m[2]);
    if (!params) continue;
    const teks = isiKurung(isi, m.index + m[0].length - 1);
    if (teks == null) continue;
    const args = pisahTingkatAtas(teks).filter((a) => a !== "");
    if (args.some((a) => a.startsWith("..."))) continue;
    const wajib = params.filter((p) => p.wajib).length;
    const adaSisa = params.some((p) => p.sisa);
    const tanda = `${def.nama}.${m[2]}(${params.map((p) => p.nama).join(", ")})`;
    const baris = nomorBaris(m.index);
    // Transaksi terkirim ke parameter yang bukan transaksi → objek Sequelize masuk WHERE/payload.
    const salahPosisi = args.findIndex((a, i) => MIRIP_TRANSAKSI.test(a) && params[i] && !PARAM_TRANSAKSI.test(params[i].nama));
    if (salahPosisi >= 0) {
      hasil.push({ tingkat: "tinggi", judul: "Transaksi dikirim ke parameter yang salah",
        rincian: `${m[1]}.${m[2]}(…) mengirim "${args[salahPosisi]}" sebagai parameter "${params[salahPosisi].nama}" — definisi ${tanda}. Objek transaksi Sequelize bisa masuk WHERE/payload ("Converting circular structure to JSON")`, baris });
    } else if (args.length < wajib) {
      // Parameter transaksi yang tidak dikirim aman (Sequelize berjalan tanpa transaksi) → bukan temuan.
      const hilang = params.filter((p) => p.wajib).slice(args.length).map((p) => p.nama).filter((n) => !PARAM_TRANSAKSI.test(n));
      if (!hilang.length) continue;
      hasil.push({ tingkat: "tinggi", judul: "Argumen pemanggilan kurang",
        rincian: `${m[1]}.${m[2]}(…) dipanggil dengan ${args.length} argumen, definisi ${tanda} mewajibkan ${wajib}: "${hilang.join('", "')}" akan undefined`, baris });
    } else if (!adaSisa && args.length > params.length) {
      hasil.push({ tingkat: "rendah", judul: "Argumen pemanggilan berlebih",
        rincian: `${m[1]}.${m[2]}(…) dipanggil dengan ${args.length} argumen, definisi ${tanda} hanya menerima ${params.length} — argumen terakhir diabaikan (perlu dicek)`, baris });
    }
  }
  return hasil;
};

// Impor default/bernama relatif: [{ nama, spesifik }].
export const imporKelas = (isi) => {
  const hasil = [];
  for (const m of isi.matchAll(/\bimport\s+([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    if (m[1]) hasil.push({ nama: m[1], spesifik: m[3] });
    for (const n of (m[2] ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
      const [asli, alias] = n.split(/\s+as\s+/);
      hasil.push({ nama: (alias ?? asli).trim(), spesifik: m[3], ekspor: asli.trim() });
    }
  }
  return hasil;
};
