import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { pasien } from "../umum/kunjungan.js";
import { JAM_SLOT, tanggalValid, slotValid, hariIni, ramah, rentang } from "./bersama.js";
import { ambilOrder, buatOrder, detailOrder, nomoriSesi, selaraskanStatus } from "./order.js";

// Ketersediaan slot, penjadwalan sesi terapi, dan booking terapi.
// Satu baris fisio_jadwal = satu sesi pada tanggal + jam_slot + bed. Booking = jadwal berstatus 'booking' tanpa order.
export const rute = express.Router();

const PESAN_BENTROK = "Bed sudah terisi pada tanggal & jam terapi tersebut; pilih bed atau jam lain";

const PILIH_JADWAL = `
  j.uuid, j.order_uuid, j.patient_uuid, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, j.jam_slot, j.bed_uuid,
  b.kode AS bed_kode, b.nama AS bed, b.ruangan, j.sesi_ke, j.status, j.catatan, j.dibuat_oleh, j.created_at::float8 AS created_at,
  COALESCE(p.name, j.nama_pasien) AS nama_pasien, COALESCE(p.phone, j.no_hp) AS no_hp, p.no_rm, p.gender,
  to_char(bd.birth_date, 'YYYY-MM-DD') AS tanggal_lahir,
  o.no_order, o.jenis_fisio, o.jumlah_sesi, o.status AS status_order, o.diagnosis,
  (SELECT e.uuid FROM fisio_evaluasi e WHERE e.jadwal_uuid = j.uuid AND e.deleted_at IS NULL LIMIT 1) AS evaluasi_uuid`;
const DARI_JADWAL = `
  fisio_jadwal j
  JOIN fisio_bed b ON b.uuid = j.bed_uuid
  LEFT JOIN fisio_order o ON o.uuid = j.order_uuid
  LEFT JOIN patients p ON p.uuid = COALESCE(o.patient_uuid, j.patient_uuid)
  LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid`;

const ambilJadwal = async (uuid, faskesUuid, k) => {
  const j = await satu(
    `SELECT *, to_char(tanggal, 'YYYY-MM-DD') AS tgl FROM fisio_jadwal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${k ? "FOR UPDATE" : ""}`,
    [uuid, faskesUuid],
    k,
  );
  if (!j) throw tidakDitemukan("Jadwal");
  return j;
};
const satuJadwal = (uuid, faskesUuid, k) => satu(`SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE j.uuid = $1 AND j.faskes_uuid = $2`, [uuid, faskesUuid], k);

// Bed harus aktif & milik faskes; slot harus kosong (pengecekan ramah sebelum unique index menolak).
const cekSlot = async ({ faskesUuid, tanggal, jamSlot, bedUuid, kecuali = null, orderUuid = null }, k) => {
  const bed = await satu(`SELECT uuid, status FROM fisio_bed WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [bedUuid, faskesUuid], k);
  if (!bed) throw tidakDitemukan("Bed");
  if (!bed.status) throw permintaanSalah("Bed sedang tidak aktif");
  const bentrok = await satu(
    `SELECT uuid FROM fisio_jadwal WHERE faskes_uuid = $1 AND tanggal = $2 AND jam_slot = $3 AND bed_uuid = $4
        AND status <> 'batal' AND deleted_at IS NULL AND uuid IS DISTINCT FROM $5`,
    [faskesUuid, tanggal, jamSlot, bedUuid, kecuali],
    k,
  );
  if (bentrok) throw new Galat(409, PESAN_BENTROK);
  if (orderUuid) {
    const ganda = await satu(
      `SELECT uuid FROM fisio_jadwal WHERE order_uuid = $1 AND tanggal = $2 AND jam_slot = $3 AND status <> 'batal'
          AND deleted_at IS NULL AND uuid IS DISTINCT FROM $4`,
      [orderUuid, tanggal, jamSlot, kecuali],
      k,
    );
    if (ganda) throw new Galat(409, "Order ini sudah memiliki sesi pada tanggal & jam tersebut");
  }
};

// ── Ketersediaan ─────────────────────────────────────────────────────────────────

// GET /slot?tanggal=YYYY-MM-DD → per jam terapi: daftar bed beserta pengisinya.
rute.get(
  "/slot",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const tanggal = tanggalValid(req.query.tanggal || hariIni());
    const [bed, jadwal] = await Promise.all([
      query(`SELECT uuid, kode, nama, ruangan FROM fisio_bed WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status ORDER BY ruangan NULLS LAST, kode`, [f]),
      query(`SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE j.faskes_uuid = $1 AND j.tanggal = $2 AND j.status <> 'batal' AND j.deleted_at IS NULL`, [f, tanggal]),
    ]);
    const jam = JAM_SLOT.map((s) => {
      const isi = bed.map((b) => ({ ...b, jadwal: jadwal.find((j) => j.jam_slot === s.slot && j.bed_uuid === b.uuid) ?? null }));
      return { ...s, total_bed: bed.length, terisi: isi.filter((x) => x.jadwal).length, tersedia: isi.filter((x) => !x.jadwal).length, bed: isi };
    });
    kirim(res, { tanggal, total_bed: bed.length, jam });
  }),
);

// GET /ketersediaan?tanggal_mulai=&tanggal_selesai= → jumlah bed tersedia per tanggal × jam (maks. 62 hari).
rute.get(
  "/ketersediaan",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { mulai, selesai } = rentang(req.query);
    const rows = await query(
      `WITH hari AS (SELECT d::date AS tanggal FROM generate_series($2::date, LEAST($3::date, $2::date + 61), '1 day') d),
            bed AS (SELECT COUNT(*)::int n FROM fisio_bed WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status)
       SELECT to_char(h.tanggal, 'YYYY-MM-DD') AS tanggal, s.slot AS jam_slot, (SELECT n FROM bed) AS total_bed,
              (SELECT COUNT(*)::int FROM fisio_jadwal j WHERE j.faskes_uuid = $1 AND j.tanggal = h.tanggal AND j.jam_slot = s.slot
                  AND j.status <> 'batal' AND j.deleted_at IS NULL) AS terisi
         FROM hari h CROSS JOIN generate_series(1, 6) s(slot) ORDER BY h.tanggal, s.slot`,
      [f, mulai, selesai],
    );
    kirim(
      res,
      rows.map((r) => ({ ...r, ...JAM_SLOT[r.jam_slot - 1], tersedia: Math.max(r.total_bed - r.terisi, 0) })),
    );
  }),
);

// ── Jadwal ───────────────────────────────────────────────────────────────────────

// GET /jadwal?tanggal_mulai=&tanggal_selesai=&status=&cari=&order_uuid=&booking=1
const daftarJadwal = tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "j.faskes_uuid = $1 AND j.deleted_at IS NULL";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.order_uuid) tambah(q.order_uuid, "j.order_uuid = $?");
    else {
      if (q.tanggal_mulai || q.tanggal) tambah(tanggalValid(q.tanggal_mulai || q.tanggal), "j.tanggal >= $?::date");
      if (q.tanggal_selesai || q.tanggal) tambah(tanggalValid(q.tanggal_selesai || q.tanggal), "j.tanggal <= $?::date");
    }
    if (q.status) tambah(String(q.status).split(","), "j.status = ANY($?)");
    if (q.bed_uuid) tambah(q.bed_uuid, "j.bed_uuid = $?");
    if (q.jam_slot) tambah(slotValid(q.jam_slot), "j.jam_slot = $?");
    if (q.patient_uuid) tambah(q.patient_uuid, "COALESCE(o.patient_uuid, j.patient_uuid) = $?");
    if (req.hanyaBooking || ["1", "true"].includes(String(q.booking))) w += " AND j.order_uuid IS NULL";
    if (q.cari) tambah(`%${q.cari}%`, "(COALESCE(p.name, j.nama_pasien) ILIKE $? OR p.no_rm ILIKE $? OR o.no_order ILIKE $? OR j.no_hp ILIKE $?)");
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_JADWAL} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE ${w} ORDER BY j.tanggal, j.jam_slot, b.kode LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
});
rute.get("/jadwal", daftarJadwal);

rute.get(
  "/jadwal/:uuid",
  tangani(async (req, res) => {
    const j = await satuJadwal(req.params.uuid, req.author.faskesUuid);
    if (!j) throw tidakDitemukan("Jadwal");
    kirim(res, j);
  }),
);

// POST /jadwal { order_uuid, tanggal, jam_slot, bed_uuid, catatan } — order harus sudah divalidasi.
rute.post(
  "/jadwal",
  tangani(async (req, res) => {
    wajib(req.body, ["order_uuid", "tanggal", "jam_slot", "bed_uuid"]);
    const f = req.author.faskesUuid;
    const tanggal = tanggalValid(req.body.tanggal);
    const jamSlot = slotValid(req.body.jam_slot);
    const hasil = await transaksi(async (k) => {
      const o = await ambilOrder(req.body.order_uuid, f, k);
      if (o.status === "order") throw new Galat(409, "Order belum divalidasi; validasi order terlebih dahulu");
      if (!["valid", "terjadwal"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status} tidak dapat dijadwalkan`);
      const n = await satu(`SELECT COUNT(*)::int n FROM fisio_jadwal WHERE order_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL`, [o.uuid], k);
      if (n.n >= o.jumlah_sesi) throw new Galat(409, `Seluruh ${o.jumlah_sesi} sesi order sudah terjadwal`);
      await cekSlot({ faskesUuid: f, tanggal, jamSlot, bedUuid: req.body.bed_uuid, orderUuid: o.uuid }, k);
      const j = await sisipkan(
        "fisio_jadwal",
        {
          faskes_uuid: f, order_uuid: o.uuid, patient_uuid: o.patient_uuid, tanggal, jam_slot: jamSlot, bed_uuid: req.body.bed_uuid,
          status: "terjadwal", catatan: req.body.catatan ?? null, dibuat_oleh: req.author.username ?? null,
        },
        k,
      ).catch((e) => ramah(e, PESAN_BENTROK));
      await nomoriSesi(o.uuid, k);
      await selaraskanStatus(o.uuid, f, k);
      return satuJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, `Sesi ${hasil.sesi_ke} berhasil dijadwalkan`);
  }),
);

// PUT /jadwal/:uuid { tanggal, jam_slot, bed_uuid, catatan } — hanya selama sesi belum dievaluasi.
rute.put(
  "/jadwal/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (["selesai", "batal"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status} tidak dapat diubah`);
      const ev = await satu(`SELECT uuid FROM fisio_evaluasi WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [j.uuid], k);
      if (ev) throw new Galat(409, "Sesi sudah dievaluasi; jadwal tidak dapat diubah");
      const tanggal = req.body.tanggal ? tanggalValid(req.body.tanggal) : j.tgl;
      const jamSlot = req.body.jam_slot ? slotValid(req.body.jam_slot) : j.jam_slot;
      const bedUuid = req.body.bed_uuid ?? j.bed_uuid;
      await cekSlot({ faskesUuid: f, tanggal, jamSlot, bedUuid, kecuali: j.uuid, orderUuid: j.order_uuid }, k);
      await ubah("fisio_jadwal", j.uuid, f, { tanggal, jam_slot: jamSlot, bed_uuid: bedUuid, catatan: req.body.catatan }, k).catch((e) => ramah(e, PESAN_BENTROK));
      if (j.order_uuid) await nomoriSesi(j.order_uuid, k);
      return satuJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, "Jadwal berhasil diubah");
  }),
);

// PUT /jadwal/:uuid/batal — membatalkan sesi atau booking; slot kembali tersedia.
const batalJadwal = tangani(async (req, res) => {
  const f = req.author.faskesUuid;
  const hasil = await transaksi(async (k) => {
    const j = await ambilJadwal(req.params.uuid, f, k);
    if (["selesai", "batal"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status} tidak dapat dibatalkan`);
    const catatan = req.body?.alasan ? [j.catatan, `Batal: ${req.body.alasan}`].filter(Boolean).join(" | ") : undefined;
    await ubah("fisio_jadwal", j.uuid, f, { status: "batal", catatan }, k);
    if (j.order_uuid) {
      await nomoriSesi(j.order_uuid, k);
      await selaraskanStatus(j.order_uuid, f, k);
    }
    return satuJadwal(j.uuid, f, k);
  });
  kirim(res, hasil, hasil.order_uuid ? "Jadwal dibatalkan" : "Booking dibatalkan; slot kembali tersedia");
});
rute.put("/jadwal/:uuid/batal", batalJadwal);

// PUT /jadwal/:uuid/hadir — pasien hadir (check-in sesi).
rute.put(
  "/jadwal/:uuid/hadir",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const j = await ambilJadwal(req.params.uuid, f);
    if (j.status !== "terjadwal") throw new Galat(409, `Jadwal berstatus ${j.status}; hanya jadwal terjadwal yang dapat ditandai hadir`);
    if (!j.order_uuid) throw new Galat(409, "Booking belum dilanjutkan menjadi order");
    await ubah("fisio_jadwal", j.uuid, f, { status: "hadir" });
    kirim(res, await satuJadwal(j.uuid, f), "Pasien ditandai hadir");
  }),
);

// ── Booking ──────────────────────────────────────────────────────────────────────

// GET /booking — daftar booking (jadwal tanpa order).
rute.get("/booking", (req, res) => {
  req.hanyaBooking = true;
  return daftarJadwal(req, res);
});

// POST /booking { patient_uuid | (nama_pasien, no_hp), tanggal, jam_slot, bed_uuid, catatan }
rute.post(
  "/booking",
  tangani(async (req, res) => {
    wajib(req.body, ["tanggal", "jam_slot", "bed_uuid"]);
    const f = req.author.faskesUuid;
    const b = req.body;
    const tanggal = tanggalValid(b.tanggal);
    if (tanggal < hariIni()) throw permintaanSalah("Tanggal booking sudah lewat");
    const jamSlot = slotValid(b.jam_slot);
    let identitas;
    if (b.patient_uuid) {
      const p = await pasien(b.patient_uuid, f);
      if (!p) throw tidakDitemukan("Pasien");
      identitas = { patient_uuid: p.uuid, nama_pasien: p.name, no_hp: b.no_hp || p.phone || null };
    } else {
      wajib(b, ["nama_pasien", "no_hp"]);
      identitas = { patient_uuid: null, nama_pasien: String(b.nama_pasien).trim(), no_hp: String(b.no_hp).trim() };
    }
    const hasil = await transaksi(async (k) => {
      await cekSlot({ faskesUuid: f, tanggal, jamSlot, bedUuid: b.bed_uuid }, k);
      const j = await sisipkan(
        "fisio_jadwal",
        { faskes_uuid: f, order_uuid: null, ...identitas, tanggal, jam_slot: jamSlot, bed_uuid: b.bed_uuid, status: "booking", catatan: b.catatan ?? null, dibuat_oleh: req.author.username ?? null },
        k,
      ).catch((e) => ramah(e, PESAN_BENTROK));
      return satuJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, "Booking terapi berhasil dibuat");
  }),
);

rute.put("/booking/:uuid/batal", batalJadwal);

// PUT /booking/:uuid/lanjut — booking → order (sumber booking) tanpa pendaftaran ulang; jadwal booking menjadi sesi 1.
// Body seperti POST /order: { patient_uuid (wajib bila booking pasien baru), jenis_fisio, tindakan, jumlah_sesi, ... }.
rute.put(
  "/booking/:uuid/lanjut",
  tangani(async (req, res) => {
    wajib(req.body, ["jenis_fisio"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (j.status !== "booking" || j.order_uuid) throw new Galat(409, "Booking sudah diproses atau dibatalkan");
      const patientUuid = req.body.patient_uuid ?? j.patient_uuid;
      if (!patientUuid) throw permintaanSalah("Pasien baru belum terdaftar: daftarkan / pilih pasien terlebih dahulu (patient_uuid)");
      const o = await buatOrder({ ...req.body, sumber: "booking", patient_uuid: patientUuid, rekam_medis_uuid: null, no_reg: req.body.no_reg ?? null }, req.author, k);
      await ubah("fisio_jadwal", j.uuid, f, { order_uuid: o.uuid, patient_uuid: patientUuid, status: "terjadwal" }, k);
      await nomoriSesi(o.uuid, k);
      return detailOrder(o.uuid, f, k);
    });
    kirim(res, hasil, `Booking dilanjutkan menjadi order ${hasil.no_order}`);
  }),
);

export default rute;
