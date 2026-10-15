import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { cariKunjungan, kunjunganDariRekamMedis, pasien, namaPraktisi } from "../umum/kunjungan.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { jenisValid, tglLokal, tanggalValid } from "./bersama.js";
import { terapkanPaket } from "./paket.js";

// Order terapi fisioterapi: dari RME (dokter DPJP), APS (admin fisio) atau lanjutan booking.
// Alur status: order → (validasi: tagihan dikirim) valid → (ada jadwal) terjadwal → (semua sesi dievaluasi) selesai.
// batal dapat dilakukan sebelum selesai (tagihan dihapus, jadwal dibatalkan).
// Order paket (paket_uuid): tindakan & jumlah sesi diisi dari paket; harga paket dialokasikan ke tindakan
// (fisio_order_tindakan.nilai_paket, nilai seluruh sesi) sehingga tagihan & laporan berjumlah = harga paket.
const rute = express.Router();

// ── Helper (dipakai juga oleh jadwal.js & evaluasi.js) ─────────────────────────────

export const PILIH_ORDER = `
  o.uuid, o.faskes_uuid, o.no_order, o.patient_uuid, o.no_rm, o.no_reg, o.rekam_medis_uuid, o.sumber, o.pelayanan,
  o.lokasi_asal_uuid, o.dokter_pengirim_uuid, o.payment_method, o.penjamin_uuid, o.jenis_fisio, o.diagnosis, o.keluhan,
  o.catatan, o.jumlah_sesi, o.paket_uuid, fp.kode AS paket_kode, fp.nama AS paket_nama, fp.harga::float8 AS paket_harga, o.status, o.alasan_batal, o.divalidasi_oleh, o.divalidasi_pada::float8 AS divalidasi_pada, o.dibuat_oleh,
  o.created_at::float8 AS created_at, o.updated_at::float8 AS updated_at,
  p.name AS nama_pasien, p.gender, p.phone AS no_hp, to_char(bd.birth_date, 'YYYY-MM-DD') AS tanggal_lahir,
  NULLIF(TRIM(CONCAT_WS(' ', pgw.first_title, pgw.name, NULLIF(pgw.last_title, ''))), '') AS dokter_pengirim,
  (SELECT string_agg(t.nama, ', ' ORDER BY t.nama) FROM fisio_order_tindakan t
     WHERE t.order_uuid = o.uuid AND t.deleted_at IS NULL) AS tindakan_ringkas,
  (SELECT COALESCE(SUM(COALESCE(t.nilai_paket, t.harga * t.qty * o.jumlah_sesi)), 0) FROM fisio_order_tindakan t
     WHERE t.order_uuid = o.uuid AND t.deleted_at IS NULL)::float8 AS total_biaya,
  ((SELECT COALESCE(SUM(t.harga * t.qty), 0) FROM fisio_order_tindakan t
     WHERE t.order_uuid = o.uuid AND t.deleted_at IS NULL) * o.jumlah_sesi)::float8 AS total_satuan,
  (SELECT COUNT(*) FROM fisio_jadwal j WHERE j.order_uuid = o.uuid AND j.status <> 'batal' AND j.deleted_at IS NULL)::int AS sesi_terjadwal,
  (SELECT COUNT(*) FROM fisio_jadwal j WHERE j.order_uuid = o.uuid AND j.status = 'selesai' AND j.deleted_at IS NULL)::int AS sesi_selesai,
  (SELECT json_build_object('uuid', j.uuid, 'tanggal', to_char(j.tanggal, 'YYYY-MM-DD'), 'jam_slot', j.jam_slot,
            'bed', b.nama, 'status', j.status, 'sesi_ke', j.sesi_ke)
     FROM fisio_jadwal j JOIN fisio_bed b ON b.uuid = j.bed_uuid
    WHERE j.order_uuid = o.uuid AND j.status IN ('booking', 'terjadwal', 'hadir') AND j.deleted_at IS NULL
    ORDER BY j.tanggal, j.jam_slot LIMIT 1) AS jadwal_berikutnya`;

export const DARI_ORDER = `
  fisio_order o
  LEFT JOIN patients p ON p.uuid = o.patient_uuid
  LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
  LEFT JOIN practitioner pr ON pr.uuid = o.dokter_pengirim_uuid
  LEFT JOIN pegawai pgw ON pgw.uuid = pr.pegawai_uuid
  LEFT JOIN fisio_paket fp ON fp.uuid = o.paket_uuid`;

// Order mentah (dikunci FOR UPDATE bila di dalam transaksi).
export const ambilOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(
    `SELECT * FROM fisio_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${k ? "FOR UPDATE" : ""}`,
    [uuid, faskesUuid],
    k,
  );
  if (!o) throw tidakDitemukan("Order fisioterapi");
  return o;
};

export const tindakanOrder = (orderUuid, k) =>
  query(
    `SELECT t.uuid, t.tindakan_uuid, t.nama, t.harga::float8 AS harga, t.qty, t.nilai_paket::float8 AS nilai_paket, m.kode
       FROM fisio_order_tindakan t LEFT JOIN fisio_tindakan m ON m.uuid = t.tindakan_uuid
      WHERE t.order_uuid = $1 AND t.deleted_at IS NULL ORDER BY t.created_at, t.nama`,
    [orderUuid],
    k,
  );

// Kirim / hapus tagihan order ke Pembayaran. Item = tindakan, qty = qty tindakan × jumlah sesi.
// Order paket: satu baris per tindakan berisi bagian harga paket (qty 1, price = nilai_paket) agar total tepat
// = harga paket tanpa pembulatan pecahan per sesi; nama item memuat nama paket & jumlah tindakan.
export const tagihanOrder = async (order, author, k, hapus = false) => {
  const paket = order.paket_uuid ? await satu(`SELECT kode, nama FROM fisio_paket WHERE uuid = $1`, [order.paket_uuid], k) : null;
  const items = hapus
    ? []
    : (await tindakanOrder(order.uuid, k)).map((t) => {
        const qty = Number(t.qty) * Number(order.jumlah_sesi);
        const info = { kode_tindakan: t.kode, no_order: order.no_order, jenis_fisio: order.jenis_fisio, sesi: order.jumlah_sesi };
        if (paket && t.nilai_paket !== null && t.nilai_paket !== undefined) {
          return {
            item_name: `Fisioterapi (${paket.nama}): ${t.nama} × ${qty}`,
            qty: 1,
            price: Number(t.nilai_paket),
            // bill_item.additional_field varchar(255): cukup kode paket (nama paket sudah di item_name).
            additional_info: { ...info, qty_tindakan: qty, kode_paket: paket.kode },
          };
        }
        return { item_name: `Fisioterapi: ${t.nama}`, qty, price: Number(t.harga), additional_info: info };
      });
  return kirimTagihan({
    faskesUuid: order.faskes_uuid,
    patientUuid: order.patient_uuid,
    noReg: order.pelayanan === "aps" ? null : order.no_reg,
    paymentMethod: order.payment_method,
    ref: `fisio:${order.uuid}`,
    items,
    token: author.token,
    hapus,
    apsType: "FISIO",
    apsServiceName: "Fisioterapi",
    apsServiceCode: order.no_order,
    apsLayananUuid: order.uuid,
    apsPraktisi: await namaPraktisi(order.dokter_pengirim_uuid),
  });
};

// Susun ulang nomor sesi (sesi_ke) jadwal aktif order berdasarkan urutan tanggal & jam.
export const nomoriSesi = (orderUuid, k) =>
  query(
    `UPDATE fisio_jadwal j SET sesi_ke = u.n FROM (
       SELECT uuid, ROW_NUMBER() OVER (ORDER BY tanggal, jam_slot, created_at) AS n
         FROM fisio_jadwal WHERE order_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL
     ) u WHERE j.uuid = u.uuid`,
    [orderUuid],
    k,
  );

// Selaraskan status order setelah jadwal/evaluasi berubah (hanya order yang sudah divalidasi).
export const selaraskanStatus = async (orderUuid, faskesUuid, k) => {
  const o = await satu(`SELECT uuid, status, jumlah_sesi FROM fisio_order WHERE uuid = $1 AND faskes_uuid = $2`, [orderUuid, faskesUuid], k);
  if (!o || !["valid", "terjadwal", "selesai"].includes(o.status)) return o?.status;
  const j = await satu(
    `SELECT COUNT(*) FILTER (WHERE status <> 'batal')::int AS aktif, COUNT(*) FILTER (WHERE status = 'selesai')::int AS selesai
       FROM fisio_jadwal WHERE order_uuid = $1 AND deleted_at IS NULL`,
    [orderUuid],
    k,
  );
  const status = j.selesai >= o.jumlah_sesi ? "selesai" : j.aktif > 0 ? "terjadwal" : "valid";
  if (status !== o.status) await ubah("fisio_order", orderUuid, faskesUuid, { status }, k);
  return status;
};

// Detail lengkap order: data order, tindakan, jadwal (dengan bed), evaluasi.
export const detailOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE o.uuid = $1 AND o.faskes_uuid = $2 AND o.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order fisioterapi");
  const [tindakan, jadwal, evaluasi] = await Promise.all([
    tindakanOrder(uuid, k),
    query(
      `SELECT j.uuid, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, j.jam_slot, j.bed_uuid, b.kode AS bed_kode, b.nama AS bed,
              b.ruangan, j.sesi_ke, j.status, j.catatan, j.created_at, e.uuid AS evaluasi_uuid
         FROM fisio_jadwal j JOIN fisio_bed b ON b.uuid = j.bed_uuid
         LEFT JOIN fisio_evaluasi e ON e.jadwal_uuid = j.uuid AND e.deleted_at IS NULL
        WHERE j.order_uuid = $1 AND j.deleted_at IS NULL ORDER BY j.status = 'batal', j.tanggal, j.jam_slot`,
      [uuid],
      k,
    ),
    query(
      `SELECT e.*, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, j.jam_slot, j.sesi_ke
         FROM fisio_evaluasi e LEFT JOIN fisio_jadwal j ON j.uuid = e.jadwal_uuid
        WHERE e.order_uuid = $1 AND e.deleted_at IS NULL ORDER BY j.tanggal NULLS LAST, j.jam_slot, e.created_at`,
      [uuid],
      k,
    ),
  ]);
  return { ...o, tindakan, jadwal, evaluasi };
};

// Validasi & snapshot tindakan dari master. Mengembalikan baris siap disisipkan.
const siapkanTindakan = async (daftar, faskesUuid, k) => {
  if (!Array.isArray(daftar) || daftar.length === 0) throw permintaanSalah("Minimal satu tindakan terapi dipilih");
  const uuids = daftar.map((t) => (typeof t === "string" ? t : t.tindakan_uuid ?? t.uuid));
  const master = await query(
    `SELECT uuid, nama, harga FROM fisio_tindakan WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL AND status`,
    [uuids, faskesUuid],
    k,
  );
  return daftar.map((t, i) => {
    const m = master.find((x) => x.uuid === uuids[i]);
    if (!m) throw permintaanSalah("Tindakan terapi tidak ditemukan atau tidak aktif");
    const qty = Math.max(Number(t?.qty) || 1, 1);
    return { tindakan_uuid: m.uuid, nama: m.nama, harga: m.harga, qty, nilai_paket: null };
  });
};

// Isi tindakan + jumlah sesi: dari paket (b.paket_uuid) atau dari pilihan tindakan satuan.
const isiOrder = async (b, faskesUuid, k) => {
  if (b.paket_uuid) {
    const pk = await terapkanPaket(b.paket_uuid, faskesUuid, k);
    return { paket_uuid: pk.paket.uuid, jenis_fisio: pk.jenis_fisio, jumlah_sesi: pk.jumlah_sesi, tindakan: pk.tindakan };
  }
  return { paket_uuid: null, jenis_fisio: undefined, jumlah_sesi: undefined, tindakan: await siapkanTindakan(b.tindakan, faskesUuid, k) };
};

const jumlahSesiValid = (n) => {
  const v = Number(n ?? 1);
  if (!Number.isInteger(v) || v < 1 || v > 100) throw permintaanSalah("jumlah_sesi harus 1 sampai 100");
  return v;
};

// Buat order (dipakai POST /order dan lanjut booking). b: body snake_case.
export const buatOrder = async (b, author, k) => {
  const f = author.faskesUuid;
  const sumber = b.sumber ?? "aps";
  if (!["rme", "aps", "booking"].includes(sumber)) throw permintaanSalah("sumber harus rme, aps atau booking");
  const isi = await isiOrder(b, f, k);
  const jenis = jenisValid(b.jenis_fisio || isi.jenis_fisio);

  // Kunjungan asal: dari rekam medis (RME) atau No. Reg.
  let kunjungan = null;
  if (b.rekam_medis_uuid) kunjungan = await kunjunganDariRekamMedis(b.rekam_medis_uuid, f);
  if (!kunjungan && b.no_reg) kunjungan = await cariKunjungan(b.no_reg, f);
  if (sumber === "rme" && !kunjungan) throw permintaanSalah("Kunjungan asal (rekam medis / No. Reg) tidak ditemukan");

  const patientUuid = kunjungan?.patient_uuid ?? b.patient_uuid;
  if (!patientUuid) throw permintaanSalah("patient_uuid wajib diisi (pasien terdaftar)");
  const p = await pasien(patientUuid, f);
  if (!p) throw tidakDitemukan("Pasien");

  const order = await sisipkan(
    "fisio_order",
    {
      faskes_uuid: f,
      no_order: await nomorBaru(f, "FIS", k),
      patient_uuid: p.uuid,
      no_rm: p.no_rm,
      no_reg: kunjungan?.no_reg ?? null,
      rekam_medis_uuid: b.rekam_medis_uuid ?? kunjungan?.rekam_medis_uuid ?? null,
      sumber,
      pelayanan: kunjungan?.pelayanan ?? "aps",
      lokasi_asal_uuid: kunjungan?.lokasi_uuid ?? b.lokasi_asal_uuid ?? null,
      dokter_pengirim_uuid: b.dokter_pengirim_uuid ?? kunjungan?.practitioner_uuid ?? null,
      payment_method: Number(kunjungan?.payment_method ?? b.payment_method ?? 1),
      penjamin_uuid: b.penjamin_uuid ?? null,
      jenis_fisio: jenis,
      diagnosis: b.diagnosis ?? null,
      keluhan: b.keluhan ?? null,
      catatan: b.catatan ?? null,
      jumlah_sesi: isi.jumlah_sesi ?? jumlahSesiValid(b.jumlah_sesi),
      paket_uuid: isi.paket_uuid,
      status: "order",
      dibuat_oleh: author.username ?? null,
    },
    k,
  );
  for (const t of isi.tindakan) await sisipkan("fisio_order_tindakan", { faskes_uuid: f, order_uuid: order.uuid, ...t }, k);
  return order;
};

// ── Rute ───────────────────────────────────────────────────────────────────────────

rute.get(
  "/",
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "o.faskes_uuid = $1 AND o.deleted_at IS NULL";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.status) tambah(String(q.status).split(","), "o.status = ANY($?)");
    if (q.jenis_fisio) tambah(String(q.jenis_fisio).split(","), "o.jenis_fisio = ANY($?)");
    if (q.sumber) tambah(String(q.sumber).split(","), "o.sumber = ANY($?)");
    if (q.patient_uuid) tambah(q.patient_uuid, "o.patient_uuid = $?");
    if (q.rekam_medis_uuid) tambah(q.rekam_medis_uuid, "o.rekam_medis_uuid = $?");
    if (q.no_reg) tambah(q.no_reg, "o.no_reg = $?");
    if (q.tanggal_mulai) tambah(tanggalValid(q.tanggal_mulai, "tanggal_mulai"), `${tglLokal("o.created_at")} >= $?::date`);
    if (q.tanggal_selesai) tambah(tanggalValid(q.tanggal_selesai, "tanggal_selesai"), `${tglLokal("o.created_at")} <= $?::date`);
    if (q.cari) tambah(`%${q.cari}%`, "(p.name ILIKE $? OR o.no_rm ILIKE $? OR o.no_order ILIKE $? OR o.no_reg ILIKE $?)");
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_ORDER} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE ${w} ORDER BY o.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Ringkasan jumlah order per status (untuk chip/tab).
rute.get(
  "/ringkasan",
  tangani(async (req, res) => {
    const rows = await query(
      `SELECT status, COUNT(*)::int AS jumlah FROM fisio_order WHERE faskes_uuid = $1 AND deleted_at IS NULL GROUP BY status`,
      [req.author.faskesUuid],
    );
    kirim(res, Object.fromEntries(rows.map((r) => [r.status, r.jumlah])));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => kirim(res, await detailOrder(req.params.uuid, req.author.faskesUuid))),
);

rute.post(
  "/",
  tangani(async (req, res) => {
    if (!req.body?.paket_uuid) wajib(req.body, ["jenis_fisio"]);
    const hasil = await transaksi(async (k) => {
      const o = await buatOrder(req.body, req.author, k);
      return detailOrder(o.uuid, req.author.faskesUuid, k);
    });
    kirim(res, hasil, `Order ${hasil.no_order} berhasil dibuat`);
  }),
);

// Ubah order (jenis, diagnosis, keluhan, catatan, jumlah sesi, tindakan). Bila sudah divalidasi, tagihan dikirim ulang.
// paket_uuid: string = terapkan paket (tindakan & jumlah sesi dari paket), null = lepas paket (tarif satuan).
// Order paket tanpa paket_uuid di body tidak boleh mengubah tindakan / jumlah sesi (harga paket akan tidak sesuai).
rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body;
    const hasil = await transaksi(async (k) => {
      const o = await ambilOrder(req.params.uuid, f, k);
      if (["batal", "selesai"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status} tidak dapat diubah`);
      if (b.paket_uuid === undefined && o.paket_uuid && (b.tindakan !== undefined || (b.jumlah_sesi !== undefined && Number(b.jumlah_sesi) !== o.jumlah_sesi))) {
        throw permintaanSalah("Order memakai paket; pilih paket lain atau lepaskan paket (paket_uuid: null) untuk mengubah tindakan / jumlah sesi");
      }
      const isi = b.paket_uuid || (b.paket_uuid === null && (o.paket_uuid || b.tindakan !== undefined)) ? await isiOrder(b, f, k) : null;
      const perubahan = {
        jenis_fisio: b.jenis_fisio === undefined ? undefined : jenisValid(b.jenis_fisio),
        diagnosis: b.diagnosis,
        keluhan: b.keluhan,
        catatan: b.catatan,
        dokter_pengirim_uuid: b.dokter_pengirim_uuid,
        jumlah_sesi: isi?.jumlah_sesi ?? (b.jumlah_sesi === undefined ? undefined : jumlahSesiValid(b.jumlah_sesi)),
        paket_uuid: isi ? isi.paket_uuid : undefined,
      };
      if (isi?.jenis_fisio && b.jenis_fisio === undefined) perubahan.jenis_fisio = isi.jenis_fisio;
      if (perubahan.jumlah_sesi !== undefined) {
        const j = await satu(`SELECT COUNT(*)::int n FROM fisio_jadwal WHERE order_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL`, [o.uuid], k);
        if (perubahan.jumlah_sesi < j.n) throw permintaanSalah(`Sudah ada ${j.n} sesi terjadwal; jumlah sesi tidak boleh kurang dari itu`);
      }
      const baru = await ubah("fisio_order", o.uuid, f, perubahan, k);
      const tindakan = isi ? isi.tindakan : b.tindakan !== undefined ? await siapkanTindakan(b.tindakan, f, k) : null;
      if (tindakan) {
        await query(`DELETE FROM fisio_order_tindakan WHERE order_uuid = $1`, [o.uuid], k);
        for (const t of tindakan) await sisipkan("fisio_order_tindakan", { faskes_uuid: f, order_uuid: o.uuid, ...t }, k);
      }
      if (baru.divalidasi_pada) await tagihanOrder(baru, req.author, k);
      await selaraskanStatus(o.uuid, f, k);
      return detailOrder(o.uuid, f, k);
    });
    kirim(res, hasil, "Order berhasil diperbarui");
  }),
);

// Validasi: kirim tagihan ke Pembayaran lalu status valid (atau terjadwal bila sudah ada jadwal dari booking).
rute.put(
  "/:uuid/validasi",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const o = await ambilOrder(req.params.uuid, f, k);
      if (o.status !== "order") throw new Galat(409, `Order berstatus ${o.status}; hanya order baru yang dapat divalidasi`);
      const baru = await ubah("fisio_order", o.uuid, f, { status: "valid", divalidasi_oleh: req.author.username ?? null, divalidasi_pada: sekarang() }, k);
      const tagihan = await tagihanOrder(baru, req.author, k);
      await selaraskanStatus(o.uuid, f, k);
      return { ...(await detailOrder(o.uuid, f, k)), tagihan };
    });
    kirim(res, hasil, `Order ${hasil.no_order} berhasil divalidasi`);
  }),
);

// Batal order: wajib alasan; jadwal yang belum selesai dibatalkan; tagihan dihapus bila sudah divalidasi.
rute.put(
  "/:uuid/batal",
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const o = await ambilOrder(req.params.uuid, f, k);
      if (["batal", "selesai"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status} tidak dapat dibatalkan`);
      const ev = await satu(`SELECT COUNT(*)::int n FROM fisio_evaluasi WHERE order_uuid = $1 AND deleted_at IS NULL`, [o.uuid], k);
      if (ev.n > 0) throw new Galat(409, `Order sudah memiliki ${ev.n} sesi yang dievaluasi sehingga tidak dapat dibatalkan`);
      await query(
        `UPDATE fisio_jadwal SET status = 'batal', updated_at = $2 WHERE order_uuid = $1 AND status <> 'selesai' AND deleted_at IS NULL`,
        [o.uuid, sekarang()],
        k,
      );
      const baru = await ubah("fisio_order", o.uuid, f, { status: "batal", alasan_batal: req.body.alasan }, k);
      if (o.divalidasi_pada) await tagihanOrder(baru, req.author, k, true);
      return detailOrder(o.uuid, f, k);
    });
    kirim(res, hasil, `Order ${hasil.no_order} dibatalkan`);
  }),
);

export default rute;
