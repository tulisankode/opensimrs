// Pembentuk isian (payload) BPJS VClaim 2.0. Fungsi murni: tidak mengakses database maupun jaringan.
// Struktur mengikuti katalog "Insert SEP V2.0" (request.t_sep). Tahap ini: rawat jalan dengan rujukan
// (tujuan kunjungan normal), IGD (poli "IGD" tanpa rujukan) dan rawat inap (SPRI); kecelakaan lalu lintas belum didukung.

const OFFSET_WIB_MS = 7 * 3600 * 1000;

// Tanggal hari ini/epoch → yyyy-mm-dd (WIB), format tanggal VClaim
export const keTanggalVclaim = (nilai = Date.now()) => {
  if (typeof nilai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(nilai)) return nilai;
  const n = Number(nilai);
  if (!n) return null;
  return new Date((n > 1e12 ? n : n * 1000) + OFFSET_WIB_MS).toISOString().slice(0, 10);
};

export const JENIS_PELAYANAN = { RAWAT_INAP: "1", RAWAT_JALAN: "2" };
export const ASAL_RUJUKAN = { FASKES_1: "1", FASKES_2: "2" };

/**
 * @param {object} p
 * @param {string} p.ppkPelayanan  kode PPK rumah sakit
 * @param {string} p.noKartu
 * @param {string} p.tglSep        yyyy-mm-dd
 * @param {string} p.jnsPelayanan  "1" rawat inap | "2" rawat jalan
 * @param {string} p.klsRawatHak   hak kelas peserta ("1"/"2"/"3")
 * @param {string} p.noMR
 * @param {object} p.rujukan       { asal, tgl, no, ppk }
 * @param {string} p.diagAwal      kode ICD-10
 * @param {string} p.poliTujuan    kode poli VClaim (rawat inap: kosong)
 * @param {string} p.dpjp          kode dokter DPJP VClaim
 * @param {string} p.noSurat       nomor SPRI (rawat inap) / surat kontrol
 * @param {string} p.noTelp
 * @param {string} p.catatan
 * @param {string} p.user          nama pengguna pembuat SEP
 */
export const buatSep = ({
  ppkPelayanan, noKartu, tglSep, jnsPelayanan = JENIS_PELAYANAN.RAWAT_JALAN, klsRawatHak, noMR,
  rujukan = {}, diagAwal, poliTujuan = "", dpjp = "", noSurat = "", noTelp = "", catatan = "", user = "OpenSIMRS",
}) => {
  const rawatInap = jnsPelayanan === JENIS_PELAYANAN.RAWAT_INAP;
  return {
    request: {
      t_sep: {
        noKartu,
        tglSep: keTanggalVclaim(tglSep),
        ppkPelayanan,
        jnsPelayanan,
        klsRawat: { klsRawatHak: String(klsRawatHak ?? ""), klsRawatNaik: "", pembiayaan: "", penanggungJawab: "" },
        noMR: noMR ?? "",
        rujukan: {
          asalRujukan: rujukan.asal ?? ASAL_RUJUKAN.FASKES_1,
          tglRujukan: keTanggalVclaim(rujukan.tgl) ?? "",
          noRujukan: rujukan.no ?? "",
          ppkRujukan: rujukan.ppk ?? "",
        },
        catatan: catatan ?? "",
        diagAwal,
        poli: { tujuan: rawatInap ? "" : poliTujuan, eksekutif: "0" },
        cob: { cob: "0" },
        katarak: { katarak: "0" },
        jaminan: {
          lakaLantas: "0",
          noLP: "",
          penjamin: {
            tglKejadian: "",
            keterangan: "",
            suplesi: { suplesi: "0", noSepSuplesi: "", lokasiLaka: { kdPropinsi: "", kdKabupaten: "", kdKecamatan: "" } },
          },
        },
        tujuanKunj: "0",
        flagProcedure: "",
        kdPenunjang: "",
        assesmentPel: "",
        // SKDP: rawat inap wajib nomor SPRI; rawat jalan rujukan baru dikosongkan kecuali ada surat kontrol
        skdp: { noSurat: noSurat || "", kodeDPJP: rawatInap || noSurat ? dpjp : "" },
        dpjpLayan: rawatInap ? "" : dpjp,
        noTelp: noTelp || "",
        user: String(user ?? "OpenSIMRS").slice(0, 30),
      },
    },
  };
};

export const hapusSep = ({ noSep, user = "OpenSIMRS" }) => ({ request: { t_sep: { noSep, user: String(user).slice(0, 30) } } });

// --- Rencana Kontrol & SPRI (STD-0021) ---------------------------------------------------------------
// BELUM DIVERIFIKASI: jalur dan struktur payload Rencana Kontrol/SPRI di bawah belum dicocokkan dengan katalog resmi
// VClaim 2.0 maupun sandbox BPJS. Katalog publik VClaim 2.0 kemungkinan memakai noSEP (SEP kunjungan asal) untuk
// Rencana Kontrol serta RencanaKontrol/InsertSPRI & UpdateSPRI untuk SPRI. Karena itu operasi ini hanya berjalan di
// mode mock sampai BPJS_VCLAIM_RENKON_DIKONFIRMASI=true (config.vclaimRenkonDikonfirmasi; lihat vclaim.js
// #pastikanModeSurat). Setelah verifikasi, cukup sesuaikan JALUR_SURAT dan fungsi pembentuk di bawah ini.

export const JALUR_SURAT = {
  RENCANA_KONTROL_BUAT: "/RencanaKontrol/insert",
  RENCANA_KONTROL_UBAH: "/RencanaKontrol/update",
  SPRI_BUAT: "/SPRI/insert",
  SPRI_UBAH: "/SPRI/update",
  // Hapus surat kontrol & SPRI memakai satu layanan (nomor SPRI tercatat sebagai surat kontrol di VClaim)
  HAPUS: "/RencanaKontrol/delete",
  cariNomor: (noSurat) => `/RencanaKontrol/noSuratKontrol/${encodeURIComponent(noSurat)}`,
  // filter 2 = berdasarkan tanggal rencana kontrol
  daftarPeserta: (bulan, tahun, noKartu) =>
    `/RencanaKontrol/ListRencanaKontrol/Bulan/${bulan}/Tahun/${tahun}/Nokartu/${encodeURIComponent(noKartu)}/filter/2`,
};

const namaUser = (user) => String(user ?? "OpenSIMRS").slice(0, 30);

/**
 * @param {object} p
 * @param {string} p.noKartu
 * @param {string} p.noSep           SEP kunjungan asal (opsional sampai katalog diverifikasi)
 * @param {string} p.kodeDokter      kode dokter DPJP VClaim
 * @param {string} p.poliKontrol     kode poli spesialistik VClaim
 * @param {string} p.tglRencanaKontrol  yyyy-mm-dd
 * @param {string} p.user
 */
export const buatRencanaKontrol = ({ noKartu, noSep = "", kodeDokter, poliKontrol, tglRencanaKontrol, user = "OpenSIMRS" }) => ({
  request: {
    t_rencontrol: {
      noSEP: noSep || "",
      noKartu,
      kodeDokter,
      poliKontrol,
      tglRencanaKontrol: keTanggalVclaim(tglRencanaKontrol),
      user: namaUser(user),
    },
  },
});

export const ubahRencanaKontrol = ({ noSuratKontrol, noKartu, noSep = "", kodeDokter, poliKontrol, tglRencanaKontrol, user = "OpenSIMRS" }) => ({
  request: {
    t_rencontrol: {
      noSuratKontrol,
      noSEP: noSep || "",
      noKartu,
      kodeDokter,
      poliKontrol,
      tglRencanaKontrol: keTanggalVclaim(tglRencanaKontrol),
      user: namaUser(user),
    },
  },
});

// Hapus Rencana Kontrol maupun SPRI (lihat JALUR_SURAT.HAPUS)
export const hapusRencanaKontrol = ({ noSuratKontrol, user = "OpenSIMRS" }) => ({
  request: { t_rencontrol: { noSuratKontrol, user: namaUser(user) } },
});

/**
 * @param {object} p
 * @param {string} p.noKartu
 * @param {string} p.kodeDokter   kode dokter DPJP VClaim
 * @param {string} p.poliKontrol  kode poli/spesialis DPJP VClaim
 * @param {string} p.tglRencana   yyyy-mm-dd, tanggal rencana rawat inap
 * @param {string} p.user
 */
export const buatSpri = ({ noKartu, kodeDokter = "", poliKontrol = "", tglRencana, user = "OpenSIMRS" }) => ({
  request: { t_sprirawat: { noKartu, kodeDokter, poliKontrol, tglRencana: keTanggalVclaim(tglRencana), user: namaUser(user) } },
});

export const ubahSpri = ({ noSuratSPRI, noKartu, kodeDokter = "", poliKontrol = "", tglRencana, user = "OpenSIMRS" }) => ({
  request: {
    t_sprirawat: { noSuratSPRI, noKartu, kodeDokter, poliKontrol, tglRencana: keTanggalVclaim(tglRencana), user: namaUser(user) },
  },
});
