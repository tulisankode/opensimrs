import express from "express";
import config from "./config.js";
import { wajibLogin } from "./auth.js";
import {
  konfigurasiTersamar, simpanKonfigurasi, ujiKoneksi, referensi, cekPeserta,
  daftarPemetaan, simpanPemetaan, sinkronKunjungan, daftarKunjungan, jalankanPekerja,
  kandidatKunjunganMcu, operasiMcu, statusMcu,
} from "./pcare.js";
import * as vc from "./vclaim.js";
import fiturAktif from "./fitur-aktif.js";
import { ruteInternal as ruteAntrean } from "./antrean-route.js";

const rute = express.Router();
const tangani = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    res.status(status).json({ message: error.message });
  });
const kirim = (res, payload, message = "Data berhasil ditampilkan") => res.json({ message, payload });

rute.get("/health", (req, res) => res.json({ message: "OK", mode: config.mode, lingkungan: config.lingkungan }));
rute.use(wajibLogin);

// Konfigurasi PCare (rahasia tidak pernah dikirim utuh ke browser)
rute.get("/pcare/konfigurasi", tangani(async (req, res) => kirim(res, await konfigurasiTersamar(req.author.faskesUuid))));
rute.put(
  "/pcare/konfigurasi",
  tangani(async (req, res) => kirim(res, await simpanKonfigurasi(req.author.faskesUuid, req.body ?? {}), "Konfigurasi PCare disimpan"))
);
rute.post("/pcare/uji-koneksi", tangani(async (req, res) => kirim(res, await ujiKoneksi(req.author.faskesUuid), "Koneksi BPJS PCare berhasil")));

// Referensi PCare: poli | dokter | kesadaran | diagnosa?q= | status-pulang
rute.get(
  "/pcare/referensi/:jenis",
  tangani(async (req, res) => kirim(res, await referensi(req.author.faskesUuid, req.params.jenis, String(req.query.q ?? ""))))
);

// Cek peserta JKN: nomor kartu (13 digit) atau NIK (16 digit)
rute.get("/pcare/peserta/:nomor", tangani(async (req, res) => kirim(res, await cekPeserta(req.author.faskesUuid, req.params.nomor))));

// Pemetaan poli & dokter OpenSIMRS → kode BPJS
rute.get("/pcare/pemetaan", tangani(async (req, res) => kirim(res, await daftarPemetaan(req.author.faskesUuid))));
rute.put(
  "/pcare/pemetaan",
  tangani(async (req, res) => kirim(res, await simpanPemetaan(req.author.faskesUuid, req.body ?? {}), "Pemetaan disimpan"))
);

// Kunjungan rawat jalan BPJS → pendaftaran & kunjungan PCare
rute.get(
  "/pcare/kunjungan",
  tangani(async (req, res) => {
    const { data, pagination } = await daftarKunjungan(req.author.faskesUuid, req.query);
    res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
  })
);
rute.post(
  "/pcare/kunjungan/:uuid/kirim",
  tangani(async (req, res) => {
    const hasil = await sinkronKunjungan(req.author.faskesUuid, req.params.uuid);
    res.status(hasil.status === "ok" ? 200 : 422).json({
      message: hasil.status === "ok" ? "Data terkirim ke BPJS PCare" : hasil.pesan,
      payload: hasil,
    });
  })
);
rute.post(
  "/pcare/pekerja/jalankan",
  tangani(async (req, res) => {
    const hasil = await jalankanPekerja(req.author.faskesUuid);
    kirim(res, hasil[0] ?? { diproses: 0, berhasil: 0, gagal: 0 }, "Sinkronisasi PCare selesai");
  })
);

// MCU PCare (STD-0020) — dipanggil dari penunjang-service (lihat penunjang-service/src/mcu/pcare.js), yang
// meneruskan token pengguna apa adanya sehingga wajibLogin di atas tetap berlaku sebagai otorisasi layanan.
rute.get(
  "/pcare/mcu/kunjungan",
  tangani(async (req, res) => kirim(res, await kandidatKunjunganMcu(req.author.faskesUuid, req.query.patient_uuid)))
);
rute.get("/pcare/mcu/status/:pesertaUuid", tangani(async (req, res) => kirim(res, await statusMcu(req.author.faskesUuid, req.params.pesertaUuid))));
rute.post(
  "/pcare/mcu/operasi",
  tangani(async (req, res) => {
    // Kontrak penunjang-service → bpjs-service memakai snake_case (penunjang-service/src/mcu/pcare.js); dipetakan
    // eksplisit ke parameter operasiMcu (camelCase) agar field tidak hilang diam-diam.
    const b = req.body ?? {};
    const hasil = await operasiMcu(req.author.faskesUuid, {
      pesertaUuid: b.peserta_uuid,
      rawatJalanUuid: b.rawat_jalan_uuid,
      operasi: b.operasi,
      payload: b.payload ?? {},
      alasan: b.alasan,
      konfirmasi: !!b.konfirmasi,
      dikirimOleh: req.author.username ?? null,
    });
    const berhasil = !["gagal", "tidak_pasti"].includes(hasil.status);
    res.status(berhasil ? 200 : 422).json({ message: berhasil ? "Laporan MCU PCare diproses" : hasil.pesan, payload: hasil });
  })
);

// --- BPJS VClaim (FKRTL / rumah sakit) ---------------------------------------------------------------
const fk = (req) => req.author.faskesUuid;
rute.get("/vclaim/konfigurasi", tangani(async (req, res) => kirim(res, await vc.konfigurasiTersamar(fk(req)))));
rute.put(
  "/vclaim/konfigurasi",
  tangani(async (req, res) => kirim(res, await vc.simpanKonfigurasi(fk(req), req.body ?? {}), "Konfigurasi VClaim disimpan"))
);
rute.post("/vclaim/uji-koneksi", tangani(async (req, res) => kirim(res, await vc.ujiKoneksi(fk(req)), "Koneksi BPJS VClaim berhasil")));

// Peserta (nomor kartu 13 digit / NIK 16 digit) pada tanggal SEP (?tgl=yyyy-mm-dd)
rute.get("/vclaim/peserta/:nomor", tangani(async (req, res) => kirim(res, await vc.cekPeserta(fk(req), req.params.nomor, req.query.tgl))));
rute.get("/vclaim/rujukan/:noKartu", tangani(async (req, res) => kirim(res, await vc.daftarRujukan(fk(req), req.params.noKartu))));
// Referensi: diagnosa?q= | poli?q= | dokter?spesialis=&jnsPelayanan=&tgl=
rute.get("/vclaim/referensi/:jenis", tangani(async (req, res) => kirim(res, await vc.referensi(fk(req), req.params.jenis, req.query))));
// Pasien & kunjungan OpenSIMRS dengan nomor kartu BPJS tersebut
rute.get("/vclaim/pasien/:noKartu", tangani(async (req, res) => kirim(res, await vc.cariPasien(fk(req), req.params.noKartu))));

rute.get(
  "/vclaim/sep",
  tangani(async (req, res) => {
    const { data, pagination } = await vc.daftarSep(fk(req), req.query);
    res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
  })
);
rute.post("/vclaim/sep", tangani(async (req, res) => kirim(res, await vc.buatSep(fk(req), req.author.username, req.body ?? {}), "SEP berhasil dibuat")));
rute.delete("/vclaim/sep/:noSep", tangani(async (req, res) => kirim(res, await vc.hapusSep(fk(req), req.author.username, req.params.noSep), "SEP dihapus")));

rute.get("/vclaim/pemetaan-poli", tangani(async (req, res) => kirim(res, await vc.daftarPemetaanPoli(fk(req)))));
rute.put(
  "/vclaim/pemetaan-poli",
  tangani(async (req, res) => kirim(res, await vc.simpanPemetaanPoli(fk(req), req.body?.poli ?? []), "Pemetaan poli VClaim disimpan"))
);

// Rencana Kontrol & SPRI (fitur vclaim_rencana_kontrol, modul bpjs_fkrtl, mati bawaan — STD-0021)
const wajibFiturRencanaKontrol = async (req, res, next) => {
  const aktif = await fiturAktif("vclaim_rencana_kontrol", req.headers.authorization);
  if (aktif === false) return res.status(403).json({ message: "Fitur Rencana Kontrol & SPRI (VClaim) belum diaktifkan untuk faskes ini" });
  next();
};
rute.use(["/vclaim/rencana-kontrol", "/vclaim/spri"], wajibFiturRencanaKontrol);

rute.get(
  "/vclaim/rencana-kontrol",
  tangani(async (req, res) => {
    const { data, pagination } = await vc.daftarRencanaKontrol(fk(req), req.query);
    res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
  })
);
rute.post(
  "/vclaim/rencana-kontrol",
  tangani(async (req, res) => kirim(res, await vc.buatRencanaKontrol(fk(req), req.author.username, req.body ?? {}), "Rencana Kontrol berhasil dibuat"))
);
rute.get("/vclaim/rencana-kontrol/:uuid", tangani(async (req, res) => kirim(res, await vc.detailRencanaKontrol(fk(req), req.params.uuid))));
rute.put(
  "/vclaim/rencana-kontrol/:uuid",
  tangani(async (req, res) =>
    kirim(res, await vc.ubahRencanaKontrol(fk(req), req.author.username, req.params.uuid, req.body ?? {}), "Rencana Kontrol berhasil diubah")
  )
);
rute.delete(
  "/vclaim/rencana-kontrol/:uuid",
  tangani(async (req, res) => kirim(res, await vc.hapusRencanaKontrol(fk(req), req.author.username, req.params.uuid), "Rencana Kontrol dihapus"))
);

rute.get(
  "/vclaim/spri",
  tangani(async (req, res) => {
    const { data, pagination } = await vc.daftarSpri(fk(req), req.query);
    res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
  })
);
rute.post("/vclaim/spri", tangani(async (req, res) => kirim(res, await vc.buatSpri(fk(req), req.author.username, req.body ?? {}), "SPRI berhasil dibuat")));
rute.get("/vclaim/spri/:uuid", tangani(async (req, res) => kirim(res, await vc.detailSpri(fk(req), req.params.uuid))));
rute.put(
  "/vclaim/spri/:uuid",
  tangani(async (req, res) => kirim(res, await vc.ubahSpri(fk(req), req.author.username, req.params.uuid, req.body ?? {}), "SPRI berhasil diubah"))
);

// --- Antrean Online BPJS (Mobile JKN): konfigurasi & monitoring (izin "Antrian > Antrean Online BPJS") ----------
// Rute WS Antrean yang dipanggil BPJS (token WS, bukan JWT) dipasang terpisah di server.js: lihat antrean-route.js.
rute.use("/antrean", ruteAntrean);

export default rute;
