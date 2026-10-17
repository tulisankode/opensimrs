import express from "express";
import { satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, Galat } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { nomorBaru } from "../umum/nomor.js";
import { modulAktif } from "../umum/modul.js";
import { susunItem, sisipkanItem } from "../patologi/order.js";
import { ambilJadwal, detailJadwal, timJadwal } from "./jadwal.js";
import { tindakanOrder } from "./order.js";
import { checklistJadwal } from "./checklist.js";
import { PERAN_JASA, kelasTertinggi } from "./bersama.js";

// Laporan Operasi & Laporan Anestesi. Laporan operasi: draft → final (hanya bila sign in/time out/sign out lengkap,
// KF-11/KT-9) → tagihan dibentuk (KF-16/17) → PA dibuat bila diminta & modul aktif (KF-18/KT-17/18). Final yang
// sudah terbentuk hanya dapat diubah lewat alur revisi beraudit (pola pa_laporan: status kembali draft, revisi++).
const rute = express.Router();

const ambilLaporanOperasi = (jadwalUuid, faskesUuid, k) =>
  satu(`SELECT * FROM ok_laporan_operasi WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${k ? "FOR UPDATE" : ""}`, [jadwalUuid, faskesUuid], k);

const detailLaporanOperasi = async (jadwalUuid, faskesUuid, k) => {
  const [jadwal, laporan, anestesi, checklist] = await Promise.all([
    detailJadwal(jadwalUuid, faskesUuid, k),
    ambilLaporanOperasi(jadwalUuid, faskesUuid, k),
    satu(`SELECT * FROM ok_laporan_anestesi WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [jadwalUuid, faskesUuid], k),
    checklistJadwal(jadwalUuid, k),
  ]);
  return { jadwal, laporan, anestesi, checklist };
};

// ── Laporan Operasi (draf) ───────────────────────────────────────────────────────

rute.get(
  "/jadwal/:uuid/laporan-operasi",
  izinOk("Laporan Operasi", "READ"),
  tangani(async (req, res) => {
    await ambilJadwal(req.params.uuid, req.author.faskesUuid);
    kirim(res, await detailLaporanOperasi(req.params.uuid, req.author.faskesUuid));
  }),
);

// PUT /jadwal/:uuid/laporan-operasi { diagnosis_pra, diagnosis_pasca, tindakan_dilakukan, temuan, komplikasi,
//   jumlah_perdarahan_ml, kirim_pa, pa_pemeriksaan_uuid(s), lokasi_anatomi, klinis }
rute.put(
  "/jadwal/:uuid/laporan-operasi",
  izinOk("Laporan Operasi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (j.status === "batal") throw new Galat(409, "Jadwal operasi sudah dibatalkan");
      let lp = await ambilLaporanOperasi(j.uuid, f, k);
      if (lp?.status === "final") throw new Galat(409, "Laporan sudah final; gunakan revisi untuk mengubahnya");

      const data = {
        diagnosis_pra: b.diagnosis_pra,
        diagnosis_pasca: b.diagnosis_pasca,
        tindakan_dilakukan: b.tindakan_dilakukan,
        temuan: b.temuan,
        komplikasi: b.komplikasi,
        jumlah_perdarahan_ml: b.jumlah_perdarahan_ml === undefined ? undefined : Number(b.jumlah_perdarahan_ml),
      };
      if (!lp) {
        lp = await sisipkan(
          "ok_laporan_operasi",
          {
            faskes_uuid: f,
            jadwal_uuid: j.uuid,
            diagnosis_pra: data.diagnosis_pra ?? null,
            diagnosis_pasca: data.diagnosis_pasca ?? null,
            tindakan_dilakukan: data.tindakan_dilakukan ?? null,
            temuan: data.temuan ?? null,
            komplikasi: data.komplikasi ?? null,
            jumlah_perdarahan_ml: data.jumlah_perdarahan_ml ?? null,
            status: "draft",
            dibuat_oleh: req.author.username ?? null,
          },
          k,
        );
      } else {
        lp = await ubah("ok_laporan_operasi", lp.uuid, f, data, k);
      }

      if (b.kirim_pa !== undefined) {
        lp = await prosesKirimPa(lp, j, Boolean(b.kirim_pa), b, f, req, k);
      }
      return detailLaporanOperasi(j.uuid, f, k);
    });
    kirim(res, hasil, "Laporan operasi berhasil disimpan");
  }),
);

// Kirim jaringan ke Patologi Anatomi (A3/KT-17) atau tandai tertunda bila modul PA tidak aktif (KT-18).
const prosesKirimPa = async (lp, jadwal, kirim, b, faskes, req, k) => {
  if (!kirim || lp.pa_order_uuid) return ubah("ok_laporan_operasi", lp.uuid, faskes, { kirim_pa: kirim }, k);
  const aktif = await modulAktif("patologi_anatomi", faskes);
  if (!aktif) return ubah("ok_laporan_operasi", lp.uuid, faskes, { kirim_pa: true, status_pa: "tertunda" }, k);

  const order = await satu(`SELECT * FROM ok_order WHERE uuid = $1 AND faskes_uuid = $2`, [jadwal.order_uuid, faskes], k);
  const daftarItem = b.pa_pemeriksaan_uuids ?? (b.pa_pemeriksaan_uuid ? [b.pa_pemeriksaan_uuid] : []);
  if (!daftarItem.length) throw permintaanSalah("Pilih minimal satu pemeriksaan Patologi Anatomi untuk jaringan yang dikirim");
  const master = await susunItem({ items: daftarItem }, faskes, order.patient_uuid, k);

  const pelayanan = { rajal: "rajal", ranap: "ranap", igd: "igd" }[order.sumber] ?? "aps";
  const paOrder = await sisipkan(
    "pa_order",
    {
      faskes_uuid: faskes,
      no_order: await nomorBaru(faskes, "OPA", k),
      patient_uuid: order.patient_uuid,
      no_rm: order.no_rm,
      no_reg: order.no_reg,
      rekam_medis_uuid: order.rekam_medis_uuid,
      pelayanan,
      sumber: "rme",
      lokasi_asal_uuid: order.lokasi_asal_uuid,
      dokter_pengirim_uuid: order.dokter_pengirim_uuid,
      dokter_pengirim_luar: null,
      faskes_perujuk: null,
      payment_method: Number(order.payment_method) || 1,
      klinis: b.klinis ?? order.diagnosis_nama ?? null,
      lokasi_anatomi: b.lokasi_anatomi ?? null,
      cito: order.jenis_operasi === "cito",
      status: "order",
      dibuat_oleh: req.author.username ?? null,
      ok_laporan_operasi_uuid: lp.uuid,
    },
    k,
  );
  await sisipkanItem(paOrder.uuid, faskes, master, k);
  return ubah("ok_laporan_operasi", lp.uuid, faskes, { kirim_pa: true, pa_order_uuid: paOrder.uuid, status_pa: "terkirim" }, k);
};

// ── Finalisasi & tagihan ──────────────────────────────────────────────────────────

const tarifKomponen = (kode, faskes, k) => satu(`SELECT uuid, name, grand_total::float8 AS harga FROM tarif WHERE faskes_uuid = $1 AND code = $2 AND status AND deleted_at IS NULL`, [faskes, kode], k);

// Komponen tagihan operasi: tindakan (per ICD-9-CM), sewa OK, dan jasa tim (operator/asisten/anestesi) per kelas
// operasi tertinggi di antara rencana tindakan. Kode tarif memakai konvensi OK-TINDAKAN-<icd9>, OK-SEWA-<kode ruang>,
// OK-JASA-<PERAN>-<kelas>. Komponen tanpa tarif terkonfigurasi tidak menggagalkan finalisasi (KF-17/KT-16): dicatat
// di tagihan_menunggu agar dapat ditindaklanjuti (mis. setelah Datamaster › Tarif dilengkapi).
const bentukTagihan = async (jadwal, order, faskes, author, k) => {
  const [tindakan, tim, ruang] = await Promise.all([
    tindakanOrder(order.uuid, k),
    timJadwal(jadwal.uuid, k),
    satu(`SELECT kode, nama FROM ok_ruang WHERE uuid = $1`, [jadwal.ruang_uuid], k),
  ]);
  const items = [];
  const menunggu = [];

  for (const t of tindakan) {
    const kode = `OK-TINDAKAN-${t.kode_icd9cm}`;
    const tarif = await tarifKomponen(kode, faskes, k);
    if (tarif) items.push({ item_name: `Tindakan Operasi: ${t.nama_tindakan}`, qty: 1, price: tarif.harga, additional_info: { kode_icd9cm: t.kode_icd9cm } });
    else menunggu.push(`Tindakan ${t.nama_tindakan} (tarif ${kode} belum dikonfigurasi)`);
  }

  const kodeSewa = `OK-SEWA-${ruang.kode}`;
  const tarifSewa = await tarifKomponen(kodeSewa, faskes, k);
  if (tarifSewa) items.push({ item_name: `Sewa Ruang OK: ${ruang.nama}`, qty: 1, price: tarifSewa.harga, additional_info: { ruang: ruang.kode } });
  else menunggu.push(`Sewa ruang ${ruang.nama} (tarif ${kodeSewa} belum dikonfigurasi)`);

  const kelas = kelasTertinggi(tindakan) ?? "kecil";
  const peranDicatat = new Set();
  for (const anggota of tim) {
    if (!PERAN_JASA.includes(anggota.peran) || peranDicatat.has(anggota.peran)) continue;
    peranDicatat.add(anggota.peran);
    const kodeJasa = `OK-JASA-${anggota.peran.toUpperCase()}-${kelas.toUpperCase()}`;
    const tarifJasa = await tarifKomponen(kodeJasa, faskes, k);
    if (tarifJasa) items.push({ item_name: `Jasa ${anggota.peran} (${kelas}): ${anggota.nama ?? ""}`.trim(), qty: 1, price: tarifJasa.harga, additional_info: { peran: anggota.peran, kelas } });
    else menunggu.push(`Jasa ${anggota.peran} kelas ${kelas} (tarif ${kodeJasa} belum dikonfigurasi)`);
  }

  const tagihan = await kirimTagihan({
    faskesUuid: faskes,
    patientUuid: order.patient_uuid,
    noReg: order.no_reg,
    paymentMethod: order.payment_method,
    ref: `ok:${jadwal.uuid}`,
    items,
    token: author.token,
    hapus: items.length === 0,
  });
  return { tagihan, menunggu };
};

rute.post(
  "/jadwal/:uuid/laporan-operasi/finalisasi",
  izinOk("Laporan Operasi", "FINALISASI"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      const lp = await ambilLaporanOperasi(j.uuid, f, k);
      if (!lp) throw permintaanSalah("Laporan operasi belum diisi");
      if (lp.status === "final") throw new Galat(409, "Laporan operasi sudah final");
      if (!lp.diagnosis_pasca || !lp.tindakan_dilakukan) throw permintaanSalah("Diagnosis pasca-operasi dan tindakan yang dilakukan wajib diisi sebelum finalisasi");
      const checklist = await checklistJadwal(j.uuid, k);
      if (!checklist.lengkap) {
        const kurang = ["sign_in", "time_out", "sign_out"].filter((t) => !checklist[t]);
        throw new Galat(409, `Checklist keselamatan bedah belum lengkap: ${kurang.join(", ")} belum diisi`);
      }
      const order = await satu(`SELECT * FROM ok_order WHERE uuid = $1 AND faskes_uuid = $2`, [j.order_uuid, f], k);
      const { menunggu } = await bentukTagihan(j, order, f, req.author, k);
      const final = await ubah(
        "ok_laporan_operasi",
        lp.uuid,
        f,
        { status: "final", tagihan_menunggu: menunggu, difinalisasi_oleh: req.author.username ?? null, waktu_finalisasi: sekarang() },
        k,
      );
      return { laporan: final, tagihan_menunggu: menunggu };
    });
    kirim(res, hasil, "Laporan operasi berhasil difinalkan");
  }),
);

// Buka kembali laporan final untuk koreksi beraudit (pola pa_laporan): status → draft, revisi++, alasan wajib.
rute.post(
  "/jadwal/:uuid/laporan-operasi/revisi",
  izinOk("Laporan Operasi", "FINALISASI"),
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      const lp = await ambilLaporanOperasi(j.uuid, f, k);
      if (!lp || lp.status !== "final") throw new Galat(409, "Hanya laporan final yang dapat direvisi");
      return ubah("ok_laporan_operasi", lp.uuid, f, { status: "draft", revisi: Number(lp.revisi || 0) + 1, alasan_revisi: req.body.alasan }, k);
    });
    kirim(res, hasil, "Laporan operasi dibuka untuk revisi");
  }),
);

// ── Laporan Anestesi ───────────────────────────────────────────────────────────────

rute.get(
  "/jadwal/:uuid/laporan-anestesi",
  izinOk("Laporan Anestesi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await ambilJadwal(req.params.uuid, f);
    kirim(res, await satu(`SELECT * FROM ok_laporan_anestesi WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f]));
  }),
);

const aldrete = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10) throw permintaanSalah(`${nama} harus 0 sampai 10`);
  return n;
};

// PUT /jadwal/:uuid/laporan-anestesi { jenis_anestesi, obat[], monitoring[], aldrete_masuk, aldrete_keluar, serah_terima }
rute.put(
  "/jadwal/:uuid/laporan-anestesi",
  izinOk("Laporan Anestesi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (j.status === "batal") throw new Galat(409, "Jadwal operasi sudah dibatalkan");
      const ada = await satu(`SELECT * FROM ok_laporan_anestesi WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [j.uuid, f], k);
      if (b.obat !== undefined && !Array.isArray(b.obat)) throw permintaanSalah("obat harus berupa array");
      if (b.monitoring !== undefined && !Array.isArray(b.monitoring)) throw permintaanSalah("monitoring harus berupa array");
      const aldreteMasuk = aldrete(b.aldrete_masuk, "aldrete_masuk");
      const aldreteKeluar = aldrete(b.aldrete_keluar, "aldrete_keluar");
      const data = {
        jenis_anestesi: b.jenis_anestesi,
        obat: b.obat,
        monitoring: b.monitoring,
        aldrete_masuk: aldreteMasuk,
        waktu_aldrete_masuk: aldreteMasuk === undefined ? undefined : ada?.waktu_aldrete_masuk ?? sekarang(),
        aldrete_keluar: aldreteKeluar,
        waktu_aldrete_keluar: aldreteKeluar === undefined || aldreteKeluar === null ? undefined : sekarang(),
        serah_terima: b.serah_terima,
      };
      if (!ada) {
        return sisipkan(
          "ok_laporan_anestesi",
          {
            faskes_uuid: f,
            jadwal_uuid: j.uuid,
            jenis_anestesi: data.jenis_anestesi ?? null,
            obat: data.obat ?? [],
            monitoring: data.monitoring ?? [],
            aldrete_masuk: data.aldrete_masuk ?? null,
            waktu_aldrete_masuk: data.waktu_aldrete_masuk ?? null,
            aldrete_keluar: data.aldrete_keluar ?? null,
            waktu_aldrete_keluar: data.waktu_aldrete_keluar ?? null,
            serah_terima: data.serah_terima ?? null,
            petugas: req.author.username ?? null,
          },
          k,
        );
      }
      return ubah("ok_laporan_anestesi", ada.uuid, f, data, k);
    });
    kirim(res, hasil, "Laporan anestesi berhasil disimpan");
  }),
);

export default rute;
