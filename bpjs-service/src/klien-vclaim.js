import config from "./config.js";
import { tandaTangan, dekripsiRespons, enkripsiRespons, GalatBpjs } from "./klien-pcare.js";

// Klien web service BPJS VClaim 2.0 (JKN API Gateway).
// Header: X-cons-id, X-timestamp, X-signature (HMAC-SHA256), user_key — tanpa X-authorization.
// Respons terenkripsi sama dengan PCare (AES-256-CBC + LZ-String).
// Katalog VClaim: POST/PUT/DELETE berisi JSON dengan Content-Type "Application/x-www-form-urlencoded".

const headerVclaim = (kred, timestamp) => ({
  "X-cons-id": kred.consId,
  "X-timestamp": String(timestamp),
  "X-signature": tandaTangan(kred.consId, kred.secretKey, timestamp),
  user_key: kred.userKey,
});

// --- simulasi -------------------------------------------------------------------------------------
const pesertaTiruan = (nomor) => ({
  noKartu: nomor.length === 13 ? nomor : "0001234567890",
  nik: nomor.length === 16 ? nomor : "3201010101900001",
  nama: "PESERTA SIMULASI",
  pisa: "1",
  sex: "L",
  mr: { noMR: null, noTelepon: "080000000000" },
  tglLahir: "1990-01-01",
  tglTAT: "2030-12-31",
  tglTMT: "2014-01-01",
  statusPeserta: { kode: "0", keterangan: "AKTIF" },
  provUmum: { kdProvider: "0114A026", nmProvider: "KLINIK SIMULASI" },
  jenisPeserta: { kode: "21", keterangan: "PBI (APBN)" },
  hakKelas: { kode: "3", keterangan: "KELAS III" },
  umur: { umurSaatPelayanan: "36 tahun", umurSekarang: "36 tahun" },
  informasi: { dinsos: null, prolanisPRB: null, noSKTM: null },
  cob: { noAsuransi: null, nmAsuransi: null },
});

const rujukanTiruan = (noKartu, asal) => ({
  noKunjungan: `${asal === "2" ? "1018R001" : "0114U163"}${noKartu.slice(-6)}Y000001`,
  tglKunjungan: new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10),
  provPerujuk: { kode: asal === "2" ? "1018R001" : "0114A026", nama: asal === "2" ? "RS SIMULASI" : "KLINIK SIMULASI" },
  poliRujukan: { kode: "INT", nama: "PENYAKIT DALAM" },
  diagnosa: { kode: "I10", nama: "Essential (primary) hypertension" },
  keluhan: "Pusing berulang",
  pelayanan: { kode: "2", nama: "Rawat Jalan" },
  peserta: pesertaTiruan(noKartu),
});

const tiruan = (metode, jalur, body) => {
  const s = jalur.replace(/^\//, "");
  const ok = (response) => ({ metaData: { code: "200", message: "Sukses" }, response });
  const kosong = (pesan) => ({ metaData: { code: "201", message: pesan }, response: null });
  const bagian = s.split("/");

  if (bagian[0] === "Peserta") {
    const nomor = bagian[2] ?? "";
    if (nomor.endsWith("0")) return kosong("Peserta Tidak Ditemukan");
    return ok({ peserta: pesertaTiruan(nomor) });
  }
  if (s.startsWith("Rujukan/List/Peserta/") || s.startsWith("Rujukan/RS/List/Peserta/")) {
    const noKartu = bagian[bagian.length - 1];
    const asal = s.startsWith("Rujukan/RS") ? "2" : "1";
    if (noKartu.endsWith("0")) return kosong("Data Tidak ditemukan");
    return asal === "1" ? ok({ rujukan: [rujukanTiruan(noKartu, asal)] }) : kosong("Data Tidak ditemukan");
  }
  if (s.startsWith("referensi/diagnosa/")) {
    const kata = decodeURIComponent(bagian[2] ?? "").toUpperCase();
    return ok({ diagnosa: [{ kode: kata, nama: `${kata} - Diagnosa simulasi` }] });
  }
  if (s.startsWith("referensi/poli/")) {
    return ok({ poli: [{ kode: "INT", nama: "PENYAKIT DALAM" }, { kode: "ANA", nama: "ANAK" }, { kode: "THT", nama: "THT-KL" }, { kode: "OBG", nama: "OBGYN" }] });
  }
  if (s.startsWith("referensi/dokter/")) {
    return ok({ list: [{ kode: "31486", nama: "dr. Simulasi, Sp.PD" }, { kode: "31487", nama: "dr. Simulasi, Sp.A" }] });
  }
  if (s.startsWith("referensi/propinsi")) {
    return ok({ list: [{ kode: "31", nama: "DKI JAKARTA" }, { kode: "35", nama: "JAWA TIMUR" }] });
  }
  if (metode === "POST" && s === "SEP/2.0/insert") {
    const t = body?.request?.t_sep;
    if (!t?.noKartu || !t?.diagAwal) return { metaData: { code: "201", message: "noKartu / diagAwal wajib diisi" }, response: null };
    const noSep = `${t.ppkPelayanan ?? "0000R000"}${t.tglSep.slice(2, 4)}${t.tglSep.slice(5, 7)}V${String(Date.now()).slice(-6)}`;
    return ok({
      sep: {
        noSep,
        tglSep: t.tglSep,
        jnsPelayanan: t.jnsPelayanan === "1" ? "Rawat Inap" : "Rawat Jalan",
        kelasRawat: t.klsRawat?.klsRawatHak,
        diagnosa: t.diagAwal,
        noRujukan: t.rujukan?.noRujukan,
        poli: t.poli?.tujuan,
        poliEksekutif: "-",
        catatan: t.catatan,
        penjamin: "-",
        informasi: { dinsos: null, prolanisPRB: null, noSKTM: null },
        peserta: { noKartu: t.noKartu, nama: "PESERTA SIMULASI", noMr: t.noMR, kelamin: "Laki-Laki", tglLahir: "1990-01-01", jnsPeserta: "PBI (APBN)", hakKelas: "Kelas 3", asuransi: "-" },
      },
    });
  }
  if (metode === "DELETE" && s === "SEP/2.0/delete") return ok(body?.request?.t_sep?.noSep ?? "");
  if (metode === "GET" && bagian[0] === "SEP") return ok({ noSep: bagian[1], tglSep: new Date().toISOString().slice(0, 10), jnsPelayanan: "Rawat Jalan" });

  // Rencana Kontrol (STD-0021)
  if (metode === "POST" && s === "RencanaKontrol/insert") {
    const t = body?.request?.t_rencontrol;
    if (!t?.noKartu || !t?.kodeDokter || !t?.poliKontrol || !t?.tglRencanaKontrol) {
      return { metaData: { code: "201", message: "noKartu / kodeDokter / poliKontrol / tglRencanaKontrol wajib diisi" }, response: null };
    }
    return ok({ noSuratKontrol: `RK${String(t.noKartu).slice(-6)}${String(Date.now()).slice(-8)}` });
  }
  if (metode === "PUT" && s === "RencanaKontrol/update") {
    const t = body?.request?.t_rencontrol;
    if (!t?.noSuratKontrol) return { metaData: { code: "201", message: "noSuratKontrol wajib diisi" }, response: null };
    return ok({ noSuratKontrol: t.noSuratKontrol });
  }
  if (metode === "DELETE" && s === "RencanaKontrol/delete") return ok(body?.request?.t_rencontrol?.noSuratKontrol ?? "");
  if (metode === "GET" && s.startsWith("RencanaKontrol/")) return ok({ list: [] });

  // SPRI (STD-0021)
  if (metode === "POST" && s === "SPRI/insert") {
    const t = body?.request?.t_sprirawat;
    if (!t?.noKartu || !t?.tglRencana) return { metaData: { code: "201", message: "noKartu / tglRencana wajib diisi" }, response: null };
    return ok({ noSuratSPRI: `SPRI${String(t.noKartu).slice(-6)}${String(Date.now()).slice(-8)}` });
  }
  if (metode === "PUT" && s === "SPRI/update") {
    const t = body?.request?.t_sprirawat;
    if (!t?.noSuratSPRI) return { metaData: { code: "201", message: "noSuratSPRI wajib diisi" }, response: null };
    return ok({ noSuratSPRI: t.noSuratSPRI });
  }
  if (metode === "GET" && s.startsWith("SPRI/")) return ok({ list: [] });

  return { metaData: { code: "404", message: `simulasi: ${metode} ${s} tidak tersedia` }, response: null };
};

// --- permintaan -----------------------------------------------------------------------------------
export const vclaim = async (kred, metode, jalur, body) => {
  for (const f of ["consId", "secretKey", "userKey"]) {
    if (!kred?.[f]) throw new GalatBpjs("Konfigurasi BPJS VClaim belum lengkap", 422);
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const h = headerVclaim(kred, timestamp);
  let json;

  if (config.mode === "mock") {
    json = tiruan(metode, jalur, body);
    if (json.response != null) json.response = enkripsiRespons(json.response, kred.consId, kred.secretKey, timestamp);
  } else {
    const url = `${config.vclaimUrl}/${jalur.replace(/^\//, "")}`;
    const init = { method: metode, headers: { ...h, Accept: "application/json" }, signal: AbortSignal.timeout(config.timeoutMs) };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "Application/x-www-form-urlencoded";
    }
    let teks = "";
    try {
      const res = await fetch(url, init);
      teks = await res.text();
      json = JSON.parse(teks);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new GalatBpjs(`Respons BPJS bukan JSON: ${teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}`, 502);
      }
      throw new GalatBpjs(`Gagal menghubungi BPJS VClaim: ${error.message}`, 502);
    }
  }

  const meta = json.metaData ?? json.metadata ?? {};
  let response = json.response ?? null;
  if (typeof response === "string" && response) {
    try {
      response = dekripsiRespons(response, kred.consId, kred.secretKey, h["X-timestamp"]);
    } catch {
      // sebagian respons (mis. hapus SEP) berupa teks biasa, bukan terenkripsi
    }
  }
  // VClaim: code "200" = sukses; "201" dipakai untuk "data tidak ditemukan"/validasi gagal
  if (String(meta.code) !== "200") {
    throw new GalatBpjs(meta.message || `Galat BPJS VClaim (kode ${meta.code})`, String(meta.code) === "201" ? 422 : 502, json);
  }
  return { pesan: meta.message, response };
};
