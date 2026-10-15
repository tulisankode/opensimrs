// Pemetaan data OpenSIMRS ↔ adamLIS (bridging_sim_rs). Fungsi murni: tanpa database & jaringan.
//
// Keluar  (SIMRS → LIS): POST {url_registrasi} — body { registrasi, pasien, dokter, unit, penjamin, tindakan[] }
// Masuk   (LIS → SIMRS): POST /adam-lis/bridging — body { no_registrasi, no_laboratorium, pasien, pemeriksaan[] }

const strip = (v) => (v === undefined || v === null || String(v).trim() === "" ? "-" : String(v).trim());

// Wilayah OpenSIMRS tersimpan kapital (JAWA TIMUR); master wilayah LIS memakai Kapital Tiap Kata (Jawa Timur).
const kapitalKata = (v) =>
  strip(v) === "-" ? "-" : strip(v).toLowerCase().replace(/(^|[\s\-/(.])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

const tanggalIso = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
};

const jenisKelamin = (g) => {
  const s = String(g ?? "").toLowerCase();
  if (["female", "p", "perempuan", "f"].includes(s)) return "P";
  if (["male", "l", "laki-laki", "laki", "m"].includes(s)) return "L";
  return "-";
};

const namaDokter = (d) => {
  const p = d?.pegawai ?? {};
  return [p.first_title ?? p.firstTitle, p.name, p.last_title ?? p.lastTitle].filter(Boolean).join(" ").trim();
};

/**
 * @param {object} order  order lab lengkap (findByUuid → toJSON) + lokasi_kode, penjamin
 * @param {object} koneksi { kode_rs }
 */
export const buatRegistrasi = (order, koneksi) => {
  const pasien = order.patient ?? {};
  const alamat = pasien.address ?? {};
  const lahir = pasien.birth_detail ?? pasien.birthDetail ?? {};
  const dokter = order.dokterPengirim ?? order.dokter_pengirim ?? null;
  const tunai = Number(order.payment_method) === 1 || !order.penjamin;
  // kode master LIS hasil pemetaan (unit / dokter / penjamin), bila ada
  const ref = order.lis_ref ?? {};
  return {
    registrasi: {
      no_registrasi: order.no_order,
      diagnosa_awal: strip(order.diagnosis),
      keterangan_klinis: strip([order.keluhan_utama, order.catatan].filter((x) => x && x !== "-").join("; ")),
      kode_rs: strip(koneksi.kode_rs),
    },
    pasien: {
      nama: strip(pasien.name),
      no_rm: strip(order.no_rm ?? pasien.noRm),
      jenis_kelamin: jenisKelamin(pasien.gender),
      alamat: strip(alamat.full_address ?? alamat.fullAddress),
      no_telphone: strip(pasien.phone),
      tanggal_lahir: tanggalIso(lahir.birth_date ?? lahir.birthDate),
      nik: strip(pasien.noIdentity ?? pasien.no_identity),
      ras: "-",
      berat_badan: strip(order.berat_badan ?? "0"),
      jenis_registrasi: order.cito ? "Cito" : "Reguler",
      m_provinsi_id: kapitalKata(alamat.provData?.name),
      m_kabupaten_id: kapitalKata(alamat.cityData?.name),
      m_kecamatan_id: kapitalKata(alamat.districtData?.name),
    },
    // kode praktisi (kode BPJS/SATUSEHAT) bila ada; selain itu uuid praktisi OpenSIMRS
    kode_dokter_pengirim: strip(ref.dokter?.kode_lis ?? dokter?.code_bpjs ?? dokter?.codeBpjs ?? dokter?.satu_sehat_id ?? dokter?.satuSehatId ?? order.dokter_pengirim_uuid),
    nama_dokter_pengirim: strip(ref.dokter?.nama_lis ?? namaDokter(dokter)),
    kode_unit_asal: strip(ref.unit?.kode_lis ?? order.lokasi_kode ?? order.lokasi?.code),
    nama_unit_asal: strip(ref.unit?.nama_lis ?? order.lokasi?.name),
    kode_penjamin: strip(ref.penjamin?.kode_lis ?? (tunai ? "UMUM" : order.penjamin?.code)),
    nama_penjamin: strip(ref.penjamin?.nama_lis ?? (tunai ? "UMUM" : order.penjamin?.name)),
    kode_icdt: strip(order.icdt?.kode),
    nama_icdt: strip(order.icdt?.nama),
    // kode tindakan = Kode Tindakan LIS pada tarif (Setting › Integrasi › Pemetaan Tarif), bila kosong kode tarif OpenSIMRS
    tindakan: (order.order_lab_pemeriksaan ?? [])
      .filter((p) => p.tarif_lab)
      .map((p) => ({ kode_tindakan: strip(p.tarif_lab.kode_lis || p.tarif_lab.code), nama_tindakan: strip(p.tarif_lab.name) })),
  };
};

// Pesan galat LIS bisa berupa teks atau daftar { value, msg, param }
// (sebagian versi adamLIS menaruh penyebab di "description", mis. { message: "Data gagal disimpan", description: "..." };
// gateway bulk MCU memakai { message|messsage, errors: [{ field?, message }] })
export const pesanGalatLis = (json, status) => {
  // format adamLIS per order (tanpa errors[]): pertahankan "message: description"
  if (!Array.isArray(json?.errors)) {
    const m = json?.message;
    const rinci = typeof json?.description === "string" && json.description ? json.description : "";
    if (Array.isArray(m)) return m.map((x) => x?.msg ?? JSON.stringify(x)).join("; ");
    if (typeof m === "string" && m) return rinci && !m.includes(rinci) ? `${m}: ${rinci}` : m;
  }
  const daftar = daftarPesanGalat(json);
  return daftar.length ? daftar.join("; ") : `LIS menolak permintaan (HTTP ${status})`;
};

// Semua pesan galat dalam respons LIS (toleran terhadap variasi format), tanpa label umum seperti "Bad request".
const LABEL_UMUM = /^(bad request|conflict?|notfound|not found|internal server error|unauthorized|data gagal disimpan)$/i;
export const daftarPesanGalat = (json) => {
  const hasil = [];
  const tambah = (v) => {
    const t = String(v ?? "").trim();
    if (t && !hasil.includes(t)) hasil.push(t);
  };
  for (const e of Array.isArray(json?.errors) ? json.errors : []) tambah(typeof e === "string" ? e : e?.message ?? e?.msg);
  for (const kunci of ["message", "messsage"]) {
    const m = json?.[kunci];
    if (Array.isArray(m)) m.forEach((x) => tambah(typeof x === "string" ? x : x?.msg ?? x?.message ?? JSON.stringify(x)));
    else if (typeof m === "string" && !(hasil.length && LABEL_UMUM.test(m.trim()))) tambah(m);
  }
  if (typeof json?.description === "string") tambah(json.description);
  if (hasil.length > 1) return hasil.filter((h) => !LABEL_UMUM.test(h));
  return hasil;
};

// --- Registrasi bulk MCU (gateway adamLIS: POST …/registrasi_bulk_mcu/create?kode_rs=&kode_lab=) -------------
// Body: { periksa_now, nama, perusahaan, data: [registrasi per order persis seperti buatRegistrasi] }. Semua field wajib
// tidak kosong (strip → "-"). Respons sukses 201 { payload: [{ nolab, nama_pasien, no_rm, no_registrasi }] }.
// Galat bersifat semua-atau-tidak-sama-sekali (400 validasi, 409 no_rm duplikat, 404, 500).

export const buatBodyBulk = ({ periksaNow = true, nama, perusahaan, data }) => ({
  periksa_now: periksaNow !== false,
  nama: strip(nama),
  perusahaan: strip(perusahaan),
  // registrasi bulk mewajibkan registrasi.username (tidak ada di registrasi per order); "-" bila tidak ada petugas
  data: (data ?? []).map((d) => ({ ...d, registrasi: { username: "-", ...d?.registrasi } })),
});

const lolos = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sebut = (teks, nilai) => {
  const v = String(nilai ?? "").trim();
  if (!v || v === "-") return false;
  return new RegExp(`(^|[^A-Za-z0-9])${lolos(v)}($|[^A-Za-z0-9])`, "i").test(teks);
};

/**
 * Tafsirkan respons bulk untuk item yang dikirim (urutan = data[]).
 * @param {{ok, status, json, pasti}} r  hasil postLis
 * @param {Array<{no_registrasi, no_rm, kode_tindakan: string[]}>} item
 * @returns {{ jenis: 'sukses'|'sebagian'|'gagal'|'tidak_pasti', hasil: Array<{status, pesan, no_lab}>, pesan }}
 *   sukses   : hasil per item (terkirim + no_lab; item yang tidak ada di payload per-item → tidak_pasti)
 *   sebagian : request ditolak karena item tertentu (hasil[i].status = 'gagal' untuk item tsb, null untuk sisanya →
 *              aman dikirim ulang tanpa item bermasalah, karena LIS menolak seluruh request)
 *   gagal    : seluruh item gagal (penyebab tidak dapat dikaitkan ke item tertentu)
 *   tidak_pasti : respons tidak diterima utuh → seluruh item tidak pasti (cek status sebelum kirim ulang)
 */
export const tafsirBulk = (r, item) => {
  const json = r?.json ?? {};
  if (r?.ok) {
    const payload = Array.isArray(json.payload) ? json.payload : Array.isArray(json.payload?.data) ? json.payload.data : null;
    if (!payload) {
      return { jenis: "sukses", pesan: json.message ?? "Registrasi bulk berhasil", hasil: item.map(() => ({ status: "terkirim", pesan: json.message || "Registrasi bulk berhasil (respons tanpa rincian per item)", no_lab: null })) };
    }
    const peta = new Map(payload.map((p) => [String(p?.no_registrasi ?? p?.no_reg ?? "").trim(), p]));
    return {
      jenis: "sukses",
      pesan: json.message ?? "Registrasi bulk berhasil",
      hasil: item.map((it) => {
        const p = peta.get(String(it.no_registrasi));
        if (!p) return { status: "tidak_pasti", pesan: "Tidak ada di rincian respons LIS — lakukan Cek Status", no_lab: null };
        const galat = p.success === false || p.error || p.galat;
        if (galat) return { status: "gagal", pesan: String(p.message ?? p.error ?? p.galat ?? "Ditolak LIS"), no_lab: null };
        return { status: "terkirim", pesan: json.message || "Registrasi berhasil", no_lab: p.nolab ?? p.no_lab ?? p.no_laboratorium ?? null };
      }),
    };
  }
  const pesanList = daftarPesanGalat(json);
  const pesan = pesanList.length ? pesanList.join("; ") : `LIS menolak permintaan (HTTP ${r?.status})`;
  if (!r?.pasti) return { jenis: "tidak_pasti", pesan, hasil: item.map(() => ({ status: "tidak_pasti", pesan: `${pesan} — status di LIS belum pasti, lakukan Cek Status`, no_lab: null })) };
  // Kaitkan pesan ke item: indeks data.N (validasi), no_rm (409 duplikat), no_registrasi, atau kode tindakan.
  const galatItem = new Map();
  const catat = (i, p) => galatItem.set(i, galatItem.has(i) ? `${galatItem.get(i)}; ${p}` : p);
  for (const p of pesanList) {
    const idx = /(?:^|[^A-Za-z0-9_])data\.(\d+)\./.exec(p);
    if (idx && item[Number(idx[1])]) {
      catat(Number(idx[1]), p);
      continue;
    }
    let cocok = item.map((it, i) => (sebut(p, it.no_rm) || sebut(p, it.no_registrasi) ? i : -1)).filter((i) => i >= 0);
    if (!cocok.length) cocok = item.map((it, i) => ((it.kode_tindakan ?? []).some((k) => sebut(p, k)) ? i : -1)).filter((i) => i >= 0);
    cocok.forEach((i) => catat(i, p));
  }
  if (galatItem.size && galatItem.size < item.length) {
    return { jenis: "sebagian", pesan, hasil: item.map((_, i) => (galatItem.has(i) ? { status: "gagal", pesan: galatItem.get(i), no_lab: null } : null)) };
  }
  return { jenis: "gagal", pesan, hasil: item.map((_, i) => ({ status: "gagal", pesan: galatItem.get(i) ?? pesan, no_lab: null })) };
};

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Cocokkan hasil LIS ke observation item order, berurutan: Kode LIS item (item_pemeriksaan.kode_lis),
 * kode item = kode_pemeriksaan_lis, lalu nama item = nama_pemeriksaan_lis. Hasil duplo memakai nilai terakhir.
 * @param {Array} pemeriksaan  body.pemeriksaan dari LIS
 * @param {Array} observasi    [{ uuid, item_kode_lis, item_kode, item_nama, tindakan: [kode tarif & kode tindakan LIS] }]
 */
export const petakanHasil = (pemeriksaan = [], observasi = []) => {
  const peta = new Map();
  const tidakTerpetakan = [];
  for (const p of pemeriksaan) {
    const kode = norm(p?.kode_pemeriksaan_lis);
    const nama = norm(p?.nama_pemeriksaan_lis);
    const cari = (daftar) =>
      daftar.find((o) => kode && norm(o.item_kode_lis) === kode) ??
      daftar.find((o) => kode && norm(o.item_kode) === kode) ??
      daftar.find((o) => nama && norm(o.item_nama) === nama);
    // Dibatasi dulu ke item milik tarif dengan kode_tindakan_simrs yang sama (kode tindakan LIS / kode tarif);
    // tarif satu item → langsung item itu (mencegah hasil menimpa item lain bila kode pemeriksaan LIS keliru).
    const tindakan = norm(p?.kode_tindakan_simrs);
    const milikTindakan = tindakan ? observasi.filter((o) => (o.tindakan ?? []).some((t) => norm(t) === tindakan)) : [];
    const cocok =
      (milikTindakan.length ? cari(milikTindakan) ?? (milikTindakan.length === 1 ? milikTindakan[0] : undefined) : undefined) ??
      cari(observasi);
    const nilai = p?.hasil?.nilai_hasil;
    if (!cocok) {
      tidakTerpetakan.push({ kode: p?.kode_pemeriksaan_lis ?? null, nama: p?.nama_pemeriksaan_lis ?? null, nilai: nilai ?? null });
      continue;
    }
    const flagLis = String(p?.hasil?.flag_kode ?? "").trim().toUpperCase();
    peta.set(cocok.uuid, { observation_item_uuid: cocok.uuid, result: nilai == null ? null : String(nilai), flag_lis: flagLis || null });
  }
  return { hasil: [...peta.values()], tidakTerpetakan };
};
