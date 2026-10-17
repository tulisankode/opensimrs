// Pemetaan data OpenSIMRS ↔ LIS Mikrobiologi. Fungsi murni: tanpa database & jaringan.
//
// Keluar (SIMRS → LIS): POST {url_registrasi} — body { registrasi, pasien, dokter_pengirim, unit_asal, penjamin, pemeriksaan[] }
// Masuk  (LIS → SIMRS): POST /adam-lis/mikrobiologi/bridging — body { no_registrasi, kode_pemeriksaan_lis?, identitas_hasil_lis,
//   status, spesimen?, pewarnaan?, kultur?, laporan_sementara?, final?, isolat?: [...] }

const strip = (v) => (v === undefined || v === null || String(v).trim() === "" ? "-" : String(v).trim());

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

/**
 * @param {object} order   order mikrobiologi lengkap (detailOrder) + pasien, items[]
 * @param {object} koneksi { kode_rs }
 * @param {object} ref     { unit, dokter, penjamin } kode/nama LIS hasil Mapping LIS (mikro_pemetaan_ref), bila ada
 * @param {Map} spesimenLis jenis_spesimen → { kode_lis, nama_lis }
 */
export const buatRegistrasi = (order, koneksi, ref = {}, spesimenLis = new Map()) => {
  const p = order.pasien ?? {};
  return {
    registrasi: {
      no_registrasi: order.no_order,
      kode_rs: strip(koneksi.kode_rs),
      klinis: strip(order.klinis),
      antibiotik_sedang: strip(order.antibiotik_sedang),
      cito: !!order.cito,
    },
    pasien: {
      nama: strip(order.nama_pasien ?? p.name),
      no_rm: strip(order.no_rm),
      jenis_kelamin: jenisKelamin(order.gender ?? p.gender),
      tanggal_lahir: tanggalIso(order.birth_date ?? p.birth_date),
      nik: strip(p.no_identity),
      alamat: strip(p.address?.full_address),
    },
    dokter_pengirim: { kode: strip(ref.dokter?.kode_lis ?? order.dokter_pengirim_uuid), nama: strip(ref.dokter?.nama_lis ?? order.dokter_pengirim) },
    unit_asal: { kode: strip(ref.unit?.kode_lis ?? order.lokasi_asal_uuid), nama: strip(ref.unit?.nama_lis ?? order.lokasi_asal) },
    penjamin: { kode: strip(ref.penjamin?.kode_lis), nama: strip(ref.penjamin?.nama_lis) },
    pemeriksaan: (order.items ?? [])
      .filter((i) => i.status !== "ditolak")
      .map((i) => ({
        kode_pemeriksaan_lis: strip(i.kode_lis),
        nama_pemeriksaan: strip(i.nama),
        jenis_spesimen: strip(spesimenLis.get(i.jenis_spesimen)?.kode_lis ?? i.jenis_spesimen),
        nama_spesimen: strip(i.nama_spesimen),
        lokasi_spesimen: strip(i.lokasi_spesimen),
        no_mikro: strip(i.no_mikro),
      })),
  };
};

/** Pemeriksaan order yang belum punya Kode Pemeriksaan LIS (Mapping LIS › Pemeriksaan). */
export const pemeriksaanBelumDipetakan = (order) =>
  (order.items ?? []).filter((i) => i.status !== "ditolak" && !String(i.kode_lis ?? "").trim()).map((i) => i.nama);

// Pesan galat LIS bisa berupa teks atau daftar { msg } / { message }.
export const pesanGalatLis = (json, status) => {
  if (typeof json?.message === "string" && json.message) return json.message;
  if (Array.isArray(json?.errors) && json.errors.length) return json.errors.map((e) => (typeof e === "string" ? e : e?.message ?? JSON.stringify(e))).join("; ");
  return `LIS menolak permintaan (HTTP ${status})`;
};

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Cocokkan organisme dari payload hasil ke master mikro_organisme (kode_lis → kode_whonet → nama), lalu kepekaan
 * tiap antibiotik ke mikro_antibiotik (kode_lis → kode → nama). Yang tidak cocok tetap disimpan (nama/kode asal LIS)
 * dan ditandai "Tidak cocok dengan item" — tidak pernah dibuang (KT-7, aturan bisnis #11).
 * @param {Array} isolatLis  body.isolat dari LIS: [{ identitas_isolat, organisme:{kode,nama}, jumlah_koloni, kepekaan:[{antibiotik:{kode,nama}, mic, zona, interpretasi}] }]
 * @param {Array} organisme  master mikro_organisme [{ uuid, kode, nama, kelompok, kode_lis, kode_whonet }]
 * @param {Array} antibiotik master mikro_antibiotik [{ uuid, kode, nama, kode_lis }]
 */
export const petakanIsolat = (isolatLis = [], organisme = [], antibiotik = []) => {
  const tidakCocok = [];
  const isolat = isolatLis.map((x, n) => {
    const kodeOrg = norm(x?.organisme?.kode);
    const namaOrg = norm(x?.organisme?.nama);
    const org =
      organisme.find((o) => kodeOrg && norm(o.kode_lis) === kodeOrg) ??
      organisme.find((o) => kodeOrg && norm(o.kode_whonet) === kodeOrg) ??
      organisme.find((o) => namaOrg && norm(o.nama) === namaOrg);
    if (!org) tidakCocok.push({ jenis: "organisme", kode: x?.organisme?.kode ?? null, nama: x?.organisme?.nama ?? null });
    const kepekaan = (x?.kepekaan ?? []).map((kp) => {
      const kodeAb = norm(kp?.antibiotik?.kode);
      const namaAb = norm(kp?.antibiotik?.nama);
      const ab =
        antibiotik.find((a) => kodeAb && norm(a.kode_lis) === kodeAb) ??
        antibiotik.find((a) => kodeAb && norm(a.kode) === kodeAb) ??
        antibiotik.find((a) => namaAb && norm(a.nama) === namaAb);
      if (!ab) tidakCocok.push({ jenis: "antibiotik", kode: kp?.antibiotik?.kode ?? null, nama: kp?.antibiotik?.nama ?? null });
      return {
        antibiotik_uuid: ab?.uuid ?? null,
        kode: ab?.kode ?? kp?.antibiotik?.kode ?? null,
        nama: ab?.nama ?? kp?.antibiotik?.nama ?? "(tidak cocok dengan item)",
        mic: kp?.mic != null ? String(kp.mic) : null,
        zona: kp?.zona != null ? Number(kp.zona) : null,
        interpretasi: ["S", "I", "R"].includes(String(kp?.interpretasi ?? "").toUpperCase()) ? String(kp.interpretasi).toUpperCase() : null,
        cocok: !!ab,
      };
    });
    return {
      urutan: n + 1,
      identitas_isolat: String(x?.identitas_isolat ?? n + 1),
      organisme_uuid: org?.uuid ?? null,
      nama_organisme: org?.nama ?? x?.organisme?.nama ?? "(tidak cocok dengan item)",
      kelompok: org?.kelompok ?? null,
      jumlah_koloni: x?.jumlah_koloni != null ? String(x.jumlah_koloni) : null,
      kepekaan,
      cocok: !!org,
    };
  });
  return { isolat, tidakCocok };
};
