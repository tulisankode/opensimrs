// Pemetaan data OpenSIMRS ↔ sistem PA tujuan (REST/JSON generik ala adamLIS). Fungsi murni: tanpa database & jaringan.
//
// Keluar (SIMRS → LIS PA): POST {url_registrasi} — body { registrasi, pasien, dokter_pengirim, unit_asal, penjamin, pemeriksaan, kasus_induk }
// Masuk  (LIS PA → SIMRS): POST /adam-pa-lis/bridging — body { no_registrasi, no_pa, status, makroskopis, mikroskopis,
//                          diagnosis, icd_o_topografi, icd_o_morfologi, icd10, dokter_verifikator, addendum, alasan_tolak, url_pdf, url_viewer }

const strip = (v) => (v === undefined || v === null || String(v).trim() === "" ? "-" : String(v).trim());
const tanggalIso = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
};
const jenisKelamin = (g) => (String(g ?? "").toLowerCase().startsWith("f") ? "P" : String(g ?? "").toLowerCase().startsWith("m") ? "L" : "-");

/**
 * @param {object} item    kasus PA (pa_order_item + join pa_spesimen terakhir)
 * @param {object} order   order PA induk (pa_order + pasien)
 * @param {object} koneksi { kode_rs }
 * @param {object} ref     { pemeriksaan, unit, dokter, penjamin } kode LIS hasil mapping (boleh kosong)
 * @param {object|null} induk  kasus PA induk (untuk IHK lanjutan): { no_pa }
 */
export const buatRegistrasi = (item, order, koneksi, ref = {}, induk = null) => {
  const p = order.pasien ?? {};
  return {
    registrasi: {
      no_registrasi: item.no_registrasi,
      jenis_pemeriksaan: item.jenis,
      cito: !!order.cito,
      keterangan_klinis: strip(order.klinis),
      riwayat: strip(order.riwayat),
      diagnosis_klinis: strip(order.klinis),
      kode_rs: strip(koneksi.kode_rs),
    },
    pasien: {
      nama: strip(p.name),
      no_rm: strip(order.no_rm ?? p.no_rm),
      jenis_kelamin: jenisKelamin(p.gender),
      tanggal_lahir: tanggalIso(p.birth_date),
      nik: strip(p.no_identity),
      no_telepon: strip(p.phone),
    },
    dokter_pengirim: { kode: strip(ref.dokter?.kode_lis ?? order.dokter_pengirim_uuid), nama: strip(ref.dokter?.nama_lis ?? order.dokter_pengirim ?? order.dokter_pengirim_luar) },
    unit_asal: { kode: strip(ref.unit?.kode_lis ?? order.lokasi_asal_uuid), nama: strip(ref.unit?.nama_lis ?? order.lokasi_asal) },
    penjamin: { kode: strip(ref.penjamin?.kode_lis ?? (order.payment_method === 2 ? "ASURANSI" : "UMUM")), nama: strip(ref.penjamin?.nama_lis ?? (order.payment_method === 2 ? "Asuransi" : "Umum / Tunai")) },
    pemeriksaan: {
      kode: strip(ref.pemeriksaan?.kode_lis ?? item.kode),
      nama: strip(ref.pemeriksaan?.nama_lis ?? item.nama),
      jenis_spesimen: strip(item.jenis_spesimen),
      lokasi_jaringan: strip(item.lokasi_anatomi),
      lateralitas: strip(item.lateralitas),
      cara_pengambilan: strip(item.cara_pengambilan),
      jumlah_wadah: item.jumlah_wadah ?? null,
      fiksasi: strip(item.fiksasi),
    },
    kasus_induk: induk ? { no_pa: strip(induk.no_pa) } : null,
  };
};

// Pesan galat sistem PA (format adamLIS: { success:false, message, description? } atau { errors:[...] }).
export const daftarPesanGalat = (json) => {
  const hasil = [];
  const tambah = (v) => {
    const t = String(v ?? "").trim();
    if (t && !hasil.includes(t)) hasil.push(t);
  };
  for (const e of Array.isArray(json?.errors) ? json.errors : []) tambah(typeof e === "string" ? e : e?.message ?? e?.msg);
  if (Array.isArray(json?.message)) json.message.forEach((x) => tambah(typeof x === "string" ? x : x?.msg ?? x?.message ?? JSON.stringify(x)));
  else if (typeof json?.message === "string") tambah(json.message);
  if (typeof json?.description === "string") tambah(json.description);
  return hasil;
};

export const pesanGalatLis = (json, status) => {
  const daftar = daftarPesanGalat(json);
  return daftar.length ? daftar.join("; ") : `LIS PA menolak permintaan (HTTP ${status})`;
};

// Field laporan yang boleh dipetakan (nama field vendor → field SIMRS); lihat pa_lis_peta_hasil.
export const FIELD_HASIL_SIMRS = ["makroskopis", "mikroskopis", "diagnosis", "icd_o_topografi", "icd_o_morfologi", "icd10", "komentar"];

// Ambil nilai dari payload hasil berdasarkan dot-path (mapping field vendor) atau nama field SIMRS langsung (bawaan).
const ambilPath = (obj, path) => String(path ?? "").split(".").filter(Boolean).reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

/**
 * Normalisasi payload hasil LIS PA → field laporan SIMRS, memakai mapping field per koneksi bila ada (pa_lis_peta_hasil),
 * selain itu nama field SIMRS langsung dibaca dari payload (kontrak bawaan ala adamLIS, lihat buatRegistrasi di atas).
 * @param {object} body    payload hasil dari LIS PA
 * @param {Array}  peta    [{ field_simrs, field_lis }]
 */
export const petakanHasil = (body, peta = []) => {
  const petaMap = new Map(peta.map((p) => [p.field_simrs, p.field_lis]));
  const hasil = {};
  for (const f of FIELD_HASIL_SIMRS) {
    const lintasan = petaMap.get(f);
    const nilai = lintasan ? ambilPath(body, lintasan) : body?.[f];
    if (nilai !== undefined && nilai !== null && String(nilai).trim() !== "") hasil[f] = String(nilai).trim();
  }
  return hasil;
};
