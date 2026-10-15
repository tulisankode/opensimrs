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
