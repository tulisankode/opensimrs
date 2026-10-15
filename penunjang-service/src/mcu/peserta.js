import express from "express";
import { query, satu, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinMcu } from "../umum/izin.js";
import { itemPaket } from "./paket.js";
import { rentang, tanggalValid, hariIni, konflik, JENIS_MCU, namaStasiun, SQL_NAMA_DOKTER, LABEL_KESIMPULAN } from "./bersama.js";
import { rencanaLab, buatOrderLab, batalOrderLab, statusOrderLab, hasilLabPeserta } from "./lab.js";
import { tagihanPeserta, ambilPaketDaftar, ambilPerusahaanDaftar, daftarkanPeserta, pasienValid, ringkasPeserta } from "./daftar.js";

// Peserta MCU: pendaftaran perorangan / rombongan korporasi, daftar, detail, dan pembatalan.
// Pendaftaran membuat order radiologi (rad_order sumber 'mcu') & order laboratorium (lab-service, is_mcu) otomatis,
// keduanya tanpa tagihan terpisah. Perorangan ditagihkan ke kasir (layanan MCU); korporasi lewat invoice.
// Rombongan korporasi didaftarkan lewat impor Excel (lihat impor.js).
const rute = express.Router();

// ── Kueri bersama ────────────────────────────────────────────────────────────
const PILIH = `s.uuid, s.no_mcu, s.tanggal::text AS tanggal, s.patient_uuid, s.no_rm, s.cara_bayar, s.jenis_mcu, s.payment_method,
  s.perusahaan_uuid, s.paket_uuid, s.harga::float8 AS harga, s.harga_tambahan::float8 AS harga_tambahan, s.tambahan, s.kontrak_uuid,
  s.status, s.kesimpulan, s.saran, s.catatan_kesimpulan, s.dokter_pemeriksa_uuid, s.selesai_pada, s.rad_order_uuid, s.lab_order_uuid,
  s.invoice_uuid, s.alasan_batal, s.nik_karyawan, s.jabatan, s.bagian, s.no_registrasi, s.cito, s.unit_asal_uuid, s.dokter_pengirim_uuid,
  s.penjamin_uuid, s.diagnosa_awal, s.icd10_code, s.icd10_nama, s.stasiun, s.dibuat_oleh, s.created_at, s.updated_at, s.faskes_uuid,
  pt.name AS nama_pasien, pt.gender, pt.no_identity AS nik, pt.phone, bd.birth_date::text AS tanggal_lahir,
  DATE_PART('year', AGE(s.tanggal, bd.birth_date))::int AS umur,
  pr.nama AS nama_perusahaan, pk.nama AS nama_paket, pk.kode AS kode_paket, pk.harga::float8 AS harga_paket,
  iv.no_invoice, iv.status AS status_invoice, lo.no_order AS no_order_lab, lo.order_status AS status_order_lab,
  (SELECT name FROM penjamin pj WHERE pj.uuid = s.penjamin_uuid) AS nama_penjamin,
  (SELECT name FROM lokasi lk WHERE lk.uuid = s.unit_asal_uuid) AS nama_unit_asal`;
const DARI = `mcu_peserta s
  JOIN patients pt ON pt.uuid = s.patient_uuid
  LEFT JOIN birth_details bd ON bd.uuid = pt.birth_detail_uuid
  LEFT JOIN mcu_perusahaan pr ON pr.uuid = s.perusahaan_uuid
  LEFT JOIN mcu_paket pk ON pk.uuid = s.paket_uuid
  LEFT JOIN mcu_invoice iv ON iv.uuid = s.invoice_uuid
  LEFT JOIN order_lab lo ON lo.uuid = s.lab_order_uuid`;

// ── Status LIS per peserta (lab-service: lab_lis_kirim; hasil = observation_item order lab) ──────────────────
// belum | mengirim | terkirim | gagal | tidak_pasti | hasil_sebagian | hasil_lengkap | tanpa_order
const DARI_LIS = `${DARI}
  LEFT JOIN LATERAL (
    SELECT k.status, k.pesan, k.lis_no_lab, k.updated_at, k.percobaan FROM lab_lis_kirim k
     WHERE k.order_lab_uuid = s.lab_order_uuid AND k.faskes_uuid = s.faskes_uuid
     ORDER BY CASE k.status WHEN 'terkirim' THEN 0 WHEN 'mengirim' THEN 1 WHEN 'tidak_pasti' THEN 2 WHEN 'gagal' THEN 3 ELSE 4 END, k.updated_at DESC
     LIMIT 1) lk ON s.lab_order_uuid IS NOT NULL
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE COALESCE(TRIM(oi.result), '') <> '')::int AS terisi
      FROM observation_item oi WHERE oi.order_lab_uuid = s.lab_order_uuid AND oi.deleted_at IS NULL) li ON s.lab_order_uuid IS NOT NULL`;
export const SQL_STATUS_LIS = `CASE
    WHEN s.lab_order_uuid IS NULL OR lo.uuid IS NULL OR lo.order_status = 0 THEN 'tanpa_order'
    WHEN lk.status = 'terkirim' AND li.terisi > 0 AND li.terisi >= li.total THEN 'hasil_lengkap'
    WHEN lk.status = 'terkirim' AND li.terisi > 0 THEN 'hasil_sebagian'
    WHEN lk.status IN ('terkirim', 'mengirim', 'gagal', 'tidak_pasti') THEN lk.status
    ELSE 'belum' END`;
export const STATUS_LIS = ["belum", "mengirim", "terkirim", "gagal", "tidak_pasti", "hasil_sebagian", "hasil_lengkap", "tanpa_order"];

// Filter daftar peserta (dipakai daftar & aksi massal "semua sesuai filter").
export const filterPeserta = (q, faskesUuid) => {
  const p = [faskesUuid];
  let w = "s.faskes_uuid = $1 AND s.deleted_at IS NULL";
  if (q.semua_tanggal !== "1" && q.semua_tanggal !== "true" && q.semua_tanggal !== true) {
    const { mulai, selesai } = rentang(q);
    p.push(mulai, selesai);
    w += ` AND s.tanggal BETWEEN $${p.length - 1} AND $${p.length}`;
  }
  for (const [param, kolom] of [
    ["perusahaan_uuid", "s.perusahaan_uuid"],
    ["paket_uuid", "s.paket_uuid"],
    ["cara_bayar", "s.cara_bayar"],
    ["kesimpulan", "s.kesimpulan"],
    ["invoice_uuid", "s.invoice_uuid"],
  ]) {
    if (q[param]) {
      p.push(q[param]);
      w += ` AND ${kolom} = $${p.length}`;
    }
  }
  if (q.status) {
    const daftar = String(q.status).split(",").filter(Boolean);
    p.push(daftar);
    w += ` AND s.status = ANY($${p.length})`;
  }
  if (q.status_lis) {
    const daftar = String(q.status_lis).split(",").flatMap((x) => (x === "hasil" ? ["hasil_sebagian", "hasil_lengkap"] : [x])).filter((x) => STATUS_LIS.includes(x));
    if (daftar.length) {
      p.push(daftar);
      w += ` AND (${SQL_STATUS_LIS}) = ANY($${p.length})`;
    }
  }
  if (q.cari) {
    p.push(`%${q.cari}%`);
    w += ` AND (s.no_mcu ILIKE $${p.length} OR s.no_rm ILIKE $${p.length} OR pt.name ILIKE $${p.length} OR s.nik_karyawan ILIKE $${p.length}
               OR pt.no_identity ILIKE $${p.length} OR s.no_registrasi ILIKE $${p.length})`;
  }
  return { w, p };
};
export { DARI_LIS };

// Hasil radiologi (dibaca dari order radiologi yang dibuat saat pendaftaran).
export const radiologiPeserta = async (peserta, k) => {
  if (!peserta.rad_order_uuid) return null;
  const order = await satu(
    `SELECT uuid, no_order, status, alasan_batal, selesai_pada FROM rad_order WHERE uuid = $1 AND deleted_at IS NULL`,
    [peserta.rad_order_uuid],
    k,
  );
  if (!order) return null;
  const items = await query(
    `SELECT i.uuid, i.nama, i.modalitas, i.status, i.hasil, i.kesan, i.waktu_periksa, i.waktu_hasil, i.radiografer,
            ${SQL_NAMA_DOKTER("i.dokter_radiologi_uuid")} AS dokter_radiologi
       FROM rad_order_item i WHERE i.order_uuid = $1 AND i.deleted_at IS NULL ORDER BY i.created_at, i.nama`,
    [order.uuid],
    k,
  );
  return { ...order, items };
};

// Item lab paket yang tidak tercakup order lab aktif → diisi manual di stasiun Laboratorium MCU.
export const itemLabManual = (items, lab) => {
  const labItems = items.filter((i) => i.jenis === "lab");
  if (!lab || lab.batal) return labItems;
  const parameter = new Set(lab.hasil.map((h) => h.item_pemeriksaan_uuid));
  const tarif = new Set(lab.tarif_uuids ?? []);
  return labItems.filter((i) => (i.tarif_lab_uuid ? !tarif.has(i.tarif_lab_uuid) : !(i.ref_uuid && parameter.has(i.ref_uuid))));
};

// Detail lengkap peserta: identitas, paket & item, status per stasiun + data isian, hasil radiologi & laboratorium.
export const detailPeserta = async (uuid, faskesUuid, k) => {
  const s = await satu(
    `SELECT ${PILIH}, pt.title AS sapaan, pr.alamat AS alamat_perusahaan, pk.deskripsi AS deskripsi_paket,
            ${SQL_NAMA_DOKTER("s.dokter_pemeriksa_uuid")} AS dokter_pemeriksa, ${SQL_NAMA_DOKTER("s.dokter_pengirim_uuid")} AS dokter_pengirim
       FROM ${DARI} WHERE s.uuid = $1 AND s.faskes_uuid = $2 AND s.deleted_at IS NULL`,
    [uuid, faskesUuid],
    k,
  );
  if (!s) return null;
  const [items, baris, radiologi, lab] = await Promise.all([
    itemPaket(s.paket_uuid, k),
    query(`SELECT stasiun, data, status, petugas, waktu FROM mcu_pemeriksaan WHERE peserta_uuid = $1 AND deleted_at IS NULL`, [s.uuid], k),
    radiologiPeserta(s, k),
    hasilLabPeserta(s, k),
  ]);
  const radSelesai = !!radiologi?.items?.length && radiologi.items.every((i) => i.status === "selesai");
  const stasiun = (s.stasiun ?? []).map((kode) => {
    const b = baris.find((x) => x.stasiun === kode);
    let status = b?.status ?? "belum";
    if (kode === "radiologi" && radSelesai) status = "selesai";
    if (kode === "kesimpulan") status = s.kesimpulan ? "selesai" : "belum";
    return { kode, nama: namaStasiun(kode), status, data: b?.data ?? {}, petugas: b?.petugas ?? null, waktu: b?.waktu ?? null };
  });
  return {
    ...s,
    label_kesimpulan: s.kesimpulan ? LABEL_KESIMPULAN[s.kesimpulan] : null,
    items,
    stasiun,
    progres: { selesai: stasiun.filter((x) => x.status === "selesai").length, total: stasiun.length },
    radiologi,
    laboratorium: lab ? { ...lab, manual: itemLabManual(items, lab) } : { manual: itemLabManual(items, null) },
  };
};

// Status pembayaran tagihan kasir peserta perorangan (payment-service, database bersama): tagihan layanan MCU
// (service_bill type MCU, layanan = peserta) yang memuat item ref "mcu:<uuid>". Dianggap sudah dibayar bila tagihan
// (atau tagihan induk gabungan) berstatus lunas / ditutup, atau sudah ada pembayaran tercatat.
export const statusBayarPeserta = async (pesertaUuid, k) => {
  const rows = await query(
    `SELECT b.uuid, b.invoice_code, b.status, b.close_bill,
            (SELECT pb.status FROM bills pb WHERE pb.uuid = b.merge_with) AS status_induk,
            (SELECT COALESCE(SUM(ph.amount), 0) FROM payment_history ph
              WHERE ph.bill_uuid IN (b.uuid, COALESCE(b.merge_with, b.uuid)) AND ph.deleted_at IS NULL AND ph.status IS NOT FALSE)::float8 AS dibayar
       FROM service_bill sb JOIN bills b ON b.uuid = sb.bill_uuid AND b.deleted_at IS NULL
      WHERE sb.layanan_uuid = $1 AND sb.type = 'MCU' AND sb.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM bill_item bi WHERE bi.service_bill_uuid = sb.uuid AND bi.deleted_at IS NULL
                     AND bi.additional_field LIKE $2)`,
    [pesertaUuid, `%mcu:${pesertaUuid}%`],
    k,
  );
  const dibayar = rows.find((r) => r.status || r.close_bill || r.status_induk || r.dibayar > 0);
  return { ada: rows.length > 0, dibayar: !!dibayar, invoice: dibayar?.invoice_code ?? rows[0]?.invoice_code ?? null, nominal: dibayar?.dibayar ?? 0 };
};

// ── Daftar ───────────────────────────────────────────────────────────────────
rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const { w, p } = filterPeserta(req.query, req.author.faskesUuid);
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_LIS} WHERE ${w}`, p)).n;
    // Progres: stasiun tersimpan selesai (kecuali radiologi & kesimpulan) + radiologi (tersimpan selesai atau semua
    // hasil radiologi selesai) + kesimpulan.
    const rows = await query(
      `SELECT ${PILIH},
              (SELECT COUNT(*)::int FROM mcu_pemeriksaan m WHERE m.peserta_uuid = s.uuid AND m.status = 'selesai' AND m.deleted_at IS NULL
                  AND m.stasiun NOT IN ('radiologi', 'kesimpulan') AND s.stasiun ? m.stasiun)
                + CASE WHEN s.stasiun ? 'radiologi' AND (
                    EXISTS (SELECT 1 FROM mcu_pemeriksaan m WHERE m.peserta_uuid = s.uuid AND m.stasiun = 'radiologi' AND m.status = 'selesai' AND m.deleted_at IS NULL)
                    OR (EXISTS (SELECT 1 FROM rad_order_item ri WHERE ri.order_uuid = s.rad_order_uuid AND ri.deleted_at IS NULL)
                        AND NOT EXISTS (SELECT 1 FROM rad_order_item ri WHERE ri.order_uuid = s.rad_order_uuid AND ri.deleted_at IS NULL AND ri.status <> 'selesai'))
                  ) THEN 1 ELSE 0 END
                + CASE WHEN s.kesimpulan IS NOT NULL THEN 1 ELSE 0 END AS stasiun_selesai,
              jsonb_array_length(s.stasiun) AS stasiun_total,
              COALESCE(li.total, 0) AS lab_total, COALESCE(li.terisi, 0) AS lab_terisi,
              ${SQL_STATUS_LIS} AS status_lis, lk.pesan AS pesan_lis, lk.lis_no_lab AS no_lab_lis, lk.updated_at AS lis_diperbarui,
              lk.percobaan AS percobaan_lis
         FROM ${DARI_LIS} WHERE ${w}
        ORDER BY s.tanggal DESC, s.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const d = await detailPeserta(req.params.uuid, req.author.faskesUuid);
    if (!d) throw tidakDitemukan("Peserta MCU");
    kirim(res, d);
  }),
);

// ── Pendaftaran ──────────────────────────────────────────────────────────────
// Body: { cara_bayar: 'perorangan'|'korporasi', perusahaan_uuid?, paket_uuid, tanggal?, jenis_mcu?, payment_method?,
//         peserta: [{ patient_uuid, nik_karyawan?, jabatan?, bagian? }] }  (atau patient_uuids: [...] / patient_uuid)
// Rombongan korporasi dalam jumlah besar sebaiknya lewat impor Excel (/peserta/impor).
rute.post(
  "/",
  izinMcu("Peserta", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    wajib(b, ["paket_uuid"]);
    const caraBayar = b.cara_bayar || (b.perusahaan_uuid ? "korporasi" : "perorangan");
    if (!["perorangan", "korporasi"].includes(caraBayar)) throw permintaanSalah("cara_bayar harus perorangan atau korporasi");
    const jenisMcu = b.jenis_mcu || (caraBayar === "korporasi" ? "berkala" : "umum");
    if (!JENIS_MCU.includes(jenisMcu)) throw permintaanSalah(`jenis_mcu harus salah satu: ${JENIS_MCU.join(", ")}`);
    const tanggal = tanggalValid(b.tanggal || hariIni());

    let daftar = Array.isArray(b.peserta) ? b.peserta : [];
    if (!daftar.length && Array.isArray(b.patient_uuids)) daftar = b.patient_uuids.map((u) => ({ patient_uuid: u }));
    if (!daftar.length && b.patient_uuid) daftar = [{ patient_uuid: b.patient_uuid, nik_karyawan: b.nik_karyawan, jabatan: b.jabatan, bagian: b.bagian }];
    daftar = daftar.filter((d) => d?.patient_uuid);
    if (!daftar.length) throw permintaanSalah("Pilih minimal satu pasien terdaftar");
    if (daftar.length > 300) throw permintaanSalah("Maksimal 300 peserta per pendaftaran; gunakan impor Excel untuk rombongan besar");

    const paket = await ambilPaketDaftar(b.paket_uuid, f, caraBayar);
    const perusahaan = caraBayar === "korporasi" ? await ambilPerusahaanDaftar(b.perusahaan_uuid, f) : null;
    const siap = await pasienValid(f, daftar, tanggal);
    const hasil = await daftarkanPeserta(req.author, [
      { caraBayar, jenisMcu, tanggal, paket, perusahaan, paymentMethod: b.payment_method, daftar: siap },
    ]);
    kirim(res, hasil.map(ringkasPeserta), `${hasil.length} peserta MCU berhasil didaftarkan`);
  }),
);

// Buat ulang order laboratorium (mis. order sebelumnya dibatalkan di Laboratorium atau peserta lama sebelum integrasi).
rute.post(
  "/:uuid/order-lab",
  izinMcu("Peserta", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const s = await satu(`SELECT * FROM mcu_peserta WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f]);
    if (!s) throw tidakDitemukan("Peserta MCU");
    if (["batal", "selesai"].includes(s.status)) throw konflik(`Peserta MCU berstatus ${s.status}`);
    if (s.lab_order_uuid) {
      const st = await statusOrderLab(s.lab_order_uuid);
      if (st && Number(st.order_status) !== 0) throw konflik(`Peserta sudah memiliki order laboratorium aktif (${st.no_order})`);
    }
    const [paket, items] = await Promise.all([satu(`SELECT * FROM mcu_paket WHERE uuid = $1`, [s.paket_uuid]), itemPaket(s.paket_uuid)]);
    const rencana = await rencanaLab(items, f);
    if (!rencana.tarif.length) throw permintaanSalah("Paket tidak memiliki item laboratorium yang terhubung ke master tarif lab");
    const perusahaan = s.perusahaan_uuid ? await satu(`SELECT nama FROM mcu_perusahaan WHERE uuid = $1`, [s.perusahaan_uuid]) : null;
    const lab = await buatOrderLab({
      faskesUuid: f,
      peserta: { ...s, tanggal: (await satu(`SELECT tanggal::text t FROM mcu_peserta WHERE uuid = $1`, [s.uuid])).t },
      paket,
      perusahaan,
      tarifUuids: rencana.tarif.map((t) => t.uuid),
      token: req.author.token,
    });
    await ubah("mcu_peserta", s.uuid, f, { lab_order_uuid: lab.uuid });
    kirim(res, await detailPeserta(s.uuid, f), `Order laboratorium ${lab.no_order} dibuat`);
  }),
);

// Ubah data administrasi peserta (tanggal, data karyawan, jenis MCU) — tidak mengubah paket/harga.
rute.put(
  "/:uuid",
  izinMcu("Peserta", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const lama = await satu(`SELECT * FROM mcu_peserta WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f]);
    if (!lama) throw tidakDitemukan("Peserta MCU");
    if (lama.status === "batal") throw konflik("Peserta MCU sudah dibatalkan");
    if (b.jenis_mcu !== undefined && !JENIS_MCU.includes(b.jenis_mcu)) throw permintaanSalah(`jenis_mcu harus salah satu: ${JENIS_MCU.join(", ")}`);
    const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
    await ubah("mcu_peserta", lama.uuid, f, {
      tanggal: b.tanggal === undefined ? undefined : tanggalValid(b.tanggal),
      jenis_mcu: b.jenis_mcu,
      nik_karyawan: teks(b.nik_karyawan),
      jabatan: teks(b.jabatan),
      bagian: teks(b.bagian),
    });
    kirim(res, await detailPeserta(lama.uuid, f), "Data peserta MCU berhasil diperbarui");
  }),
);

// ── Pembatalan ───────────────────────────────────────────────────────────────
// Perorangan: ditolak bila tagihan kasir sudah dibayar (arahkan ke refund di Kasir); bila belum, tagihan ditarik.
// Order radiologi dibatalkan bila belum ada item yang diperiksa; order laboratorium (lab-service) dibatalkan bila
// belum ada hasil yang terisi.
rute.post(
  "/:uuid/batal",
  izinMcu("Peserta", "BATAL"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["alasan"]);
    const alasan = String(req.body.alasan).trim();
    const hasil = await transaksi(async (k) => {
      const s = await satu(`SELECT * FROM mcu_peserta WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!s) throw tidakDitemukan("Peserta MCU");
      if (s.status === "batal") throw konflik("Peserta MCU sudah dibatalkan");
      if (s.status === "selesai") throw konflik("Peserta MCU sudah selesai (kesimpulan terbit) dan tidak dapat dibatalkan");
      if (s.invoice_uuid) throw konflik("Peserta sudah masuk invoice korporasi; batalkan invoice terlebih dahulu");

      if (s.cara_bayar === "perorangan") {
        const bayar = await statusBayarPeserta(s.uuid, k);
        if (bayar.dibayar) {
          throw konflik(
            `Tagihan MCU ${s.no_mcu} sudah dibayar di Kasir${bayar.invoice ? ` (tagihan ${bayar.invoice})` : ""}. ` +
              "Pembatalan tidak dapat dilakukan dari modul MCU — proses pengembalian dana (refund) / pembatalan transaksi melalui Kasir terlebih dahulu.",
          );
        }
      }

      let radiologi = null;
      if (s.rad_order_uuid) {
        const diperiksa = await satu(
          `SELECT COUNT(*)::int n FROM rad_order_item WHERE order_uuid = $1 AND status <> 'menunggu' AND deleted_at IS NULL`,
          [s.rad_order_uuid],
          k,
        );
        if (diperiksa.n === 0) {
          const r = await satu(
            `UPDATE rad_order SET status = 'batal', alasan_batal = $1, updated_at = $2
              WHERE uuid = $3 AND faskes_uuid = $4 AND status IN ('order','valid') AND deleted_at IS NULL RETURNING no_order`,
            [`Peserta MCU ${s.no_mcu} dibatalkan: ${alasan}`, sekarang(), s.rad_order_uuid, f],
            k,
          );
          radiologi = r ? `Order radiologi ${r.no_order} dibatalkan` : null;
        } else {
          radiologi = "Order radiologi sudah diperiksa sehingga tidak dibatalkan";
        }
      }

      let labBatal = null;
      let laboratorium = null;
      if (s.lab_order_uuid) {
        const st = await statusOrderLab(s.lab_order_uuid, k);
        if (st && Number(st.order_status) !== 0) {
          if (st.terisi > 0 || Number(st.order_status) === 3) laboratorium = `Order laboratorium ${st.no_order} sudah berisi hasil sehingga tidak dibatalkan`;
          else labBatal = st;
        }
      }

      await ubah("mcu_peserta", s.uuid, f, { status: "batal", alasan_batal: alasan }, k);
      let paket = null;
      if (s.cara_bayar === "perorangan") {
        paket = (await satu(`SELECT nama, kode FROM mcu_paket WHERE uuid = $1`, [s.paket_uuid], k)) ?? { nama: "", kode: "" };
        await tagihanPeserta(s, paket, req.author, true);
      }
      if (labBatal) {
        try {
          await batalOrderLab(labBatal.uuid, `Peserta MCU ${s.no_mcu} dibatalkan: ${alasan}`, req.author.token);
          laboratorium = `Order laboratorium ${labBatal.no_order} dibatalkan`;
        } catch (e) {
          // Kembalikan tagihan yang sudah ditarik, lalu batalkan seluruh pembatalan (rollback).
          if (paket) await tagihanPeserta(s, paket, req.author).catch(() => {});
          throw e;
        }
      }
      return { uuid: s.uuid, no_mcu: s.no_mcu, radiologi, laboratorium, tagihan: s.cara_bayar === "perorangan" ? "Tagihan kasir ditarik" : null };
    });
    kirim(res, hasil, "Peserta MCU berhasil dibatalkan");
  }),
);

export default rute;
