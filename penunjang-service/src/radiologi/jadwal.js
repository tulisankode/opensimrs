import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { HARI, MODALITAS, STATUS_JADWAL, daftarNilai, dariMenit, hariIni, hariIso, keMenit, menitSekarang, ramah, slotRuang, tanggalValid } from "./bersama.js";
import { PILIH_RUANG, ambilRuang } from "./ruang.js";

// Penjadwalan pemeriksaan radiologi per ruang/alat.
// Alur: order tervalidasi → item dijadwalkan ke ruang + tanggal + jam (satu slot; satu jadwal dapat memuat beberapa
// item yang modalitasnya dilayani ruang tsb) → pasien hadir (no. antrean per ruang/tanggal) → radiografer memeriksa
// (worklist; jadwal → 'diperiksa') → expertise. "Segera" (CITO/IGD) = slot kosong terdekat hari ini.
// Item tanpa jadwal tetap dapat dikerjakan langsung dari worklist (alur lama & order MCU tidak terhambat).
// Bentrok: tumpang-tindih jam di ruang yang sama, atau pasien yang sama pada jam yang sama di ruang lain.
const rute = express.Router();

const PESAN_BENTROK = "Slot ruang tersebut sudah terisi pada jam itu; pilih jam atau ruang lain";

const PILIH_JADWAL = `
  j.uuid, j.order_uuid, j.ruang_uuid, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal,
  to_char(j.jam_mulai, 'HH24:MI') AS jam_mulai, to_char(j.jam_selesai, 'HH24:MI') AS jam_selesai,
  j.status, j.no_antrean, j.waktu_hadir, j.segera, j.catatan, j.alasan_batal, j.dibuat_oleh, j.created_at,
  r.kode AS ruang_kode, r.nama AS ruang, r.nama_alat,
  o.no_order, o.no_rm, o.no_reg, o.sumber, o.pelayanan, o.cito, o.klinis, o.status AS status_order, o.patient_uuid,
  p.name AS nama_pasien, p.gender, p.phone, bd.birth_date,
  COALESCE((SELECT json_agg(json_build_object('uuid', i.uuid, 'nama', i.nama, 'modalitas', i.modalitas, 'status', i.status,
                                              'kode', m.kode, 'persiapan', m.persiapan) ORDER BY i.created_at, i.nama)
              FROM rad_order_item i LEFT JOIN rad_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
             WHERE i.jadwal_uuid = j.uuid AND i.deleted_at IS NULL), '[]') AS items`;
const DARI_JADWAL = `
  rad_jadwal j
  JOIN rad_ruang r ON r.uuid = j.ruang_uuid
  JOIN rad_order o ON o.uuid = j.order_uuid
  LEFT JOIN patients p ON p.uuid = o.patient_uuid
  LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid`;

const satuJadwal = async (uuid, f, k) => {
  const j = await satu(`SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE j.uuid = $1 AND j.faskes_uuid = $2 AND j.deleted_at IS NULL`, [uuid, f], k);
  if (!j) throw tidakDitemukan("Jadwal radiologi");
  return j;
};
const kunciJadwal = async (uuid, f, k) => {
  const j = await satu(
    `SELECT *, to_char(tanggal, 'YYYY-MM-DD') AS tgl, to_char(jam_mulai, 'HH24:MI') AS mulai FROM rad_jadwal
      WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`,
    [uuid, f],
    k,
  );
  if (!j) throw tidakDitemukan("Jadwal radiologi");
  return j;
};

// Jadwal milik order yang sudah dibatalkan (mis. dibatalkan modul MCU langsung) ikut dibatalkan agar slot kembali.
const rapikanJadwalOrderBatal = (f, k) =>
  query(
    `UPDATE rad_jadwal j SET status = 'batal', alasan_batal = COALESCE(j.alasan_batal, 'Order dibatalkan'), updated_at = $2
       FROM rad_order o WHERE o.uuid = j.order_uuid AND j.faskes_uuid = $1 AND j.status IN ('terjadwal', 'hadir')
        AND (o.status = 'batal' OR o.deleted_at IS NOT NULL)`,
    [f, sekarang()],
    k,
  );

// Validasi slot: ruang aktif & buka pada hari itu, jam di dalam jam operasional, belum lewat, tidak tumpang-tindih
// dengan jadwal lain di ruang tsb maupun jadwal lain pasien yang sama. Baris ruang harus sudah dikunci (FOR UPDATE).
const cekSlot = async ({ f, ruang, tanggal, mulai, patientUuid, kecuali = null }, k) => {
  if (!ruang.status) throw permintaanSalah(`${ruang.nama} sedang nonaktif`);
  const hari = hariIso(tanggal);
  if (!ruang.hari_operasional.map(Number).includes(hari)) throw permintaanSalah(`${ruang.nama} tidak beroperasi pada hari ${HARI[hari]}`);
  const buka = keMenit(ruang.jam_buka);
  const tutup = keMenit(ruang.jam_tutup);
  const selesai = mulai + Number(ruang.durasi_slot);
  if (mulai < buka || selesai > tutup) throw permintaanSalah(`Jam di luar jam operasional ${ruang.nama} (${ruang.jam_buka}–${ruang.jam_tutup})`);
  const hi = hariIni();
  if (tanggal < hi) throw permintaanSalah("Tanggal jadwal sudah lewat");
  if (tanggal === hi && selesai <= menitSekarang()) throw permintaanSalah("Jam jadwal sudah lewat");
  await rapikanJadwalOrderBatal(f, k);
  const bentrok = await satu(
    `SELECT to_char(jam_mulai, 'HH24:MI') AS jam FROM rad_jadwal
      WHERE faskes_uuid = $1 AND ruang_uuid = $2 AND tanggal = $3 AND status <> 'batal' AND deleted_at IS NULL
        AND uuid IS DISTINCT FROM $4 AND jam_mulai < $6::time AND jam_selesai > $5::time LIMIT 1`,
    [f, ruang.uuid, tanggal, kecuali, dariMenit(mulai), dariMenit(selesai)],
    k,
  );
  if (bentrok) throw new Galat(409, `${PESAN_BENTROK} (sudah ada jadwal pukul ${bentrok.jam})`);
  const pasienBentrok = await satu(
    `SELECT r.nama AS ruang, to_char(j.jam_mulai, 'HH24:MI') AS jam FROM rad_jadwal j
       JOIN rad_order o ON o.uuid = j.order_uuid JOIN rad_ruang r ON r.uuid = j.ruang_uuid
      WHERE j.faskes_uuid = $1 AND o.patient_uuid = $2 AND j.tanggal = $3 AND j.status <> 'batal' AND j.deleted_at IS NULL
        AND j.uuid IS DISTINCT FROM $4 AND j.jam_mulai < $6::time AND j.jam_selesai > $5::time LIMIT 1`,
    [f, patientUuid, tanggal, kecuali, dariMenit(mulai), dariMenit(selesai)],
    k,
  );
  if (pasienBentrok) throw new Galat(409, `Pasien sudah dijadwalkan di ${pasienBentrok.ruang} pukul ${pasienBentrok.jam}; pilih jam lain`);
  return { jam_mulai: dariMenit(mulai), jam_selesai: dariMenit(selesai) };
};

// Slot kosong terdekat hari ini (slot yang sedang berjalan ikut dihitung) untuk jadwal "segera".
const slotSegera = async ({ f, ruang, patientUuid, kecuali = null }, k) => {
  const tanggal = hariIni();
  const hari = hariIso(tanggal);
  const saran = "Pasien tetap dapat langsung diperiksa dari menu Pemeriksaan & Hasil tanpa jadwal.";
  if (!ruang.hari_operasional.map(Number).includes(hari)) throw new Galat(409, `${ruang.nama} tidak beroperasi hari ini. ${saran}`);
  const kini = menitSekarang();
  for (const mulai of slotRuang(ruang).filter((t) => t + Number(ruang.durasi_slot) > kini)) {
    try {
      return { tanggal, ...(await cekSlot({ f, ruang, tanggal, mulai, patientUuid, kecuali }, k)) };
    } catch (e) {
      if (!(e instanceof Galat) || e.status !== 409) throw e;
    }
  }
  throw new Galat(409, `Tidak ada slot kosong lagi hari ini di ${ruang.nama}. ${saran}`);
};

const jamDariBody = (b) => (b.jam_mulai ? keMenit(b.jam_mulai, "jam_mulai") : null);

// ── Papan slot ───────────────────────────────────────────────────────────────

// GET /jadwal/papan?tanggal=&modalitas= → per ruang aktif: slot (jam mulai–selesai) beserta jadwal yang mengisinya.
rute.get(
  "/papan",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const tanggal = tanggalValid(req.query.tanggal || hariIni());
    await rapikanJadwalOrderBatal(f);
    const p = [f];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL AND status";
    const modalitas = daftarNilai(req.query.modalitas);
    if (modalitas.length) {
      p.push(modalitas);
      w += ` AND modalitas && $${p.length}::varchar[]`;
    }
    const [ruang, jadwal] = await Promise.all([
      query(`SELECT ${PILIH_RUANG} FROM rad_ruang WHERE ${w} ORDER BY kode`, p),
      query(`SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE j.faskes_uuid = $1 AND j.tanggal = $2 AND j.deleted_at IS NULL AND j.status <> 'batal' ORDER BY j.jam_mulai`, [f, tanggal]),
    ]);
    const hari = hariIso(tanggal);
    const hi = hariIni();
    const kini = tanggal === hi ? menitSekarang() : tanggal < hi ? 24 * 60 : -1;
    const hasil = ruang.map((r) => {
      const d = Number(r.durasi_slot);
      const milik = jadwal.filter((j) => j.ruang_uuid === r.uuid);
      const buka = r.hari_operasional.map(Number).includes(hari);
      const slot = buka
        ? slotRuang(r).map((t) => {
            const isi = milik.find((j) => keMenit(j.jam_mulai) < t + d && keMenit(j.jam_selesai) > t) ?? null;
            return { jam_mulai: dariMenit(t), jam_selesai: dariMenit(t + d), lewat: t + d <= kini, jadwal: isi };
          })
        : [];
      return {
        ...r,
        nama_modalitas: r.modalitas.map((m) => MODALITAS[m] ?? m),
        buka,
        slot,
        jumlah_slot: slot.length,
        terisi: milik.length,
        tersedia: slot.filter((s) => !s.jadwal && !s.lewat).length,
        // Jadwal di luar slot (mis. jam operasional diubah setelah dijadwalkan) tetap ditampilkan.
        di_luar_slot: milik.filter((j) => !slot.some((s) => s.jadwal?.uuid === j.uuid)),
      };
    });
    kirim(res, { tanggal, hari: HARI[hari], ruang: hasil });
  }),
);

// ── Daftar jadwal ────────────────────────────────────────────────────────────

rute.get(
  "/",
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "j.faskes_uuid = $1 AND j.deleted_at IS NULL";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.order_uuid) tambah(q.order_uuid, "j.order_uuid = $?");
    if (q.tanggal_mulai || q.tanggal) tambah(tanggalValid(q.tanggal_mulai || q.tanggal), "j.tanggal >= $?::date");
    if (q.tanggal_selesai || q.tanggal) tambah(tanggalValid(q.tanggal_selesai || q.tanggal), "j.tanggal <= $?::date");
    const ruang = daftarNilai(q.ruang_uuid);
    if (ruang.length) tambah(ruang, "j.ruang_uuid = ANY($?)");
    const status = daftarNilai(q.status).filter((s) => STATUS_JADWAL.includes(s));
    if (status.length) tambah(status, "j.status = ANY($?)");
    if (q.cari) tambah(`%${String(q.cari).trim()}%`, "(p.name ILIKE $? OR o.no_rm ILIKE $? OR o.no_order ILIKE $?)");
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_JADWAL} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE ${w}
        ORDER BY j.tanggal, r.kode, j.jam_mulai LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// GET /jadwal/menunggu?cari= → order tervalidasi yang masih punya item 'menunggu' tanpa jadwal aktif.
rute.get(
  "/menunggu",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await rapikanJadwalOrderBatal(f);
    const p = [f];
    let w = "";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w = ` AND (p.name ILIKE $${p.length} OR o.no_rm ILIKE $${p.length} OR o.no_order ILIKE $${p.length})`;
    }
    const rows = await query(
      `SELECT o.uuid, o.no_order, o.no_rm, o.sumber, o.pelayanan, o.cito, o.klinis, o.status, o.created_at, o.divalidasi_pada,
              p.name AS nama_pasien, p.gender, bd.birth_date,
              json_agg(json_build_object('uuid', i.uuid, 'nama', i.nama, 'modalitas', i.modalitas, 'kode', m.kode) ORDER BY i.created_at, i.nama) AS items
         FROM rad_order o
         JOIN rad_order_item i ON i.order_uuid = o.uuid AND i.deleted_at IS NULL AND i.status = 'menunggu'
         LEFT JOIN rad_jadwal j ON j.uuid = i.jadwal_uuid
         LEFT JOIN rad_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
         LEFT JOIN patients p ON p.uuid = o.patient_uuid
         LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status IN ('valid', 'diperiksa')
          AND (i.jadwal_uuid IS NULL OR j.status = 'batal' OR j.deleted_at IS NOT NULL) ${w}
        GROUP BY o.uuid, p.name, p.gender, bd.birth_date
        ORDER BY o.cito DESC, COALESCE(o.divalidasi_pada, o.created_at) LIMIT 200`,
      p,
    );
    kirim(res, rows);
  }),
);

rute.get("/:uuid", tangani(async (req, res) => kirim(res, await satuJadwal(req.params.uuid, req.author.faskesUuid))));

// ── Buat / ubah / hadir / batal ──────────────────────────────────────────────

// POST /jadwal { order_uuid, item_uuids?, ruang_uuid, tanggal, jam_mulai, segera?, catatan? }
// item_uuids kosong = semua item 'menunggu' tanpa jadwal yang modalitasnya dilayani ruang.
rute.post(
  "/",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["order_uuid", "ruang_uuid"]);
    const f = req.author.faskesUuid;
    const segera = Boolean(b.segera);
    if (!segera) wajib(b, ["tanggal", "jam_mulai"]);
    const hasil = await transaksi(async (k) => {
      const ruang = await ambilRuang(b.ruang_uuid, f, k, true);
      const o = await satu(`SELECT * FROM rad_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [b.order_uuid, f], k);
      if (!o) throw tidakDitemukan("Order radiologi");
      if (o.status === "order") throw new Galat(409, "Order belum divalidasi; validasi order terlebih dahulu");
      if (!["valid", "diperiksa"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status} tidak dapat dijadwalkan`);
      const kandidat = await query(
        `SELECT i.uuid, i.nama, i.modalitas FROM rad_order_item i LEFT JOIN rad_jadwal j ON j.uuid = i.jadwal_uuid
          WHERE i.order_uuid = $1 AND i.deleted_at IS NULL AND i.status = 'menunggu'
            AND (i.jadwal_uuid IS NULL OR j.status = 'batal' OR j.deleted_at IS NOT NULL)`,
        [o.uuid],
        k,
      );
      let items;
      if (Array.isArray(b.item_uuids) && b.item_uuids.length) {
        items = kandidat.filter((i) => b.item_uuids.includes(i.uuid));
        if (items.length !== new Set(b.item_uuids).size) throw new Galat(409, "Sebagian item sudah dijadwalkan, sudah diperiksa, atau bukan milik order ini");
        const tidakCocok = items.filter((i) => !ruang.modalitas.includes(i.modalitas));
        if (tidakCocok.length) throw permintaanSalah(`${ruang.nama} tidak melayani ${tidakCocok.map((i) => `${i.nama} (${i.modalitas})`).join(", ")}`);
      } else {
        items = kandidat.filter((i) => ruang.modalitas.includes(i.modalitas));
        if (!items.length) throw permintaanSalah(`Tidak ada item order yang menunggu jadwal dan dapat dikerjakan di ${ruang.nama}`);
      }
      const slot = segera
        ? await slotSegera({ f, ruang, patientUuid: o.patient_uuid }, k)
        : { tanggal: tanggalValid(b.tanggal), ...(await cekSlot({ f, ruang, tanggal: tanggalValid(b.tanggal), mulai: jamDariBody(b), patientUuid: o.patient_uuid }, k)) };
      const j = await sisipkan(
        "rad_jadwal",
        {
          faskes_uuid: f, order_uuid: o.uuid, ruang_uuid: ruang.uuid, ...slot, status: "terjadwal", segera,
          catatan: String(b.catatan ?? "").trim() || null, dibuat_oleh: req.author.username ?? null,
        },
        k,
      ).catch((e) => ramah(e, PESAN_BENTROK));
      await query(`UPDATE rad_order_item SET jadwal_uuid = $1, updated_at = $2 WHERE uuid = ANY($3)`, [j.uuid, sekarang(), items.map((i) => i.uuid)], k);
      return satuJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, `${hasil.nama_pasien ?? "Pasien"} dijadwalkan di ${hasil.ruang}, ${hasil.tanggal} pukul ${hasil.jam_mulai}`);
  }),
);

// PUT /jadwal/:uuid { ruang_uuid?, tanggal?, jam_mulai?, segera?, catatan? } — selama belum diperiksa.
rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const lama = await satu(`SELECT ruang_uuid FROM rad_jadwal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f], k);
      if (!lama) throw tidakDitemukan("Jadwal radiologi");
      const ruang = await ambilRuang(b.ruang_uuid || lama.ruang_uuid, f, k, true);
      const j = await kunciJadwal(req.params.uuid, f, k);
      if (!["terjadwal", "hadir"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status} tidak dapat diubah`);
      const o = await satu(`SELECT patient_uuid, status FROM rad_order WHERE uuid = $1`, [j.order_uuid], k);
      if (o.status === "batal") throw new Galat(409, "Order sudah dibatalkan");
      const items = await query(`SELECT nama, modalitas, status FROM rad_order_item WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [j.uuid], k);
      if (items.some((i) => i.status !== "menunggu")) throw new Galat(409, "Sebagian pemeriksaan sudah dikerjakan; jadwal tidak dapat diubah");
      const tidakCocok = items.filter((i) => !ruang.modalitas.includes(i.modalitas));
      if (tidakCocok.length) throw permintaanSalah(`${ruang.nama} tidak melayani ${tidakCocok.map((i) => `${i.nama} (${i.modalitas})`).join(", ")}`);
      const tanggal = b.tanggal ? tanggalValid(b.tanggal) : j.tgl;
      const mulai = b.jam_mulai ? jamDariBody(b) : keMenit(j.mulai);
      const slot = b.segera
        ? await slotSegera({ f, ruang, patientUuid: o.patient_uuid, kecuali: j.uuid }, k)
        : { tanggal, ...(await cekSlot({ f, ruang, tanggal, mulai, patientUuid: o.patient_uuid, kecuali: j.uuid }, k)) };
      // Pindah ruang/tanggal setelah hadir → nomor antrean baru di ruang/tanggal tujuan.
      let antrean;
      if (j.status === "hadir" && (ruang.uuid !== j.ruang_uuid || slot.tanggal !== j.tgl)) {
        if (slot.tanggal !== hariIni()) throw new Galat(409, "Pasien sudah hadir; jadwal hanya dapat dipindah ke ruang/jam lain hari ini");
        antrean = await antreanBaru(f, ruang.uuid, slot.tanggal, k);
      }
      await ubah(
        "rad_jadwal",
        j.uuid,
        f,
        { ruang_uuid: ruang.uuid, ...slot, no_antrean: antrean, segera: b.segera ? true : undefined, catatan: b.catatan === undefined ? undefined : String(b.catatan ?? "").trim() || null },
        k,
      ).catch((e) => ramah(e, PESAN_BENTROK));
      return satuJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, `Jadwal diubah: ${hasil.ruang}, ${hasil.tanggal} pukul ${hasil.jam_mulai}`);
  }),
);

const antreanBaru = async (f, ruangUuid, tanggal, k) =>
  (await satu(`SELECT COALESCE(MAX(no_antrean), 0)::int + 1 AS n FROM rad_jadwal WHERE faskes_uuid = $1 AND ruang_uuid = $2 AND tanggal = $3 AND deleted_at IS NULL`, [f, ruangUuid, tanggal], k)).n;

// POST /jadwal/:uuid/hadir — pasien datang (check-in) → nomor antrean ruang hari itu.
rute.post(
  "/:uuid/hadir",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const lama = await satu(`SELECT ruang_uuid FROM rad_jadwal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f], k);
      if (!lama) throw tidakDitemukan("Jadwal radiologi");
      await ambilRuang(lama.ruang_uuid, f, k, true); // serialisasi nomor antrean per ruang
      const j = await kunciJadwal(req.params.uuid, f, k);
      if (j.status !== "terjadwal") throw new Galat(409, `Jadwal berstatus ${j.status}; hanya jadwal terjadwal yang dapat ditandai hadir`);
      if (j.tgl !== hariIni()) throw new Galat(409, `Jadwal ini untuk tanggal ${j.tgl}; ubah jadwal ke hari ini bila pasien datang di luar jadwal`);
      const o = await satu(`SELECT status FROM rad_order WHERE uuid = $1`, [j.order_uuid], k);
      if (o.status === "batal") throw new Galat(409, "Order sudah dibatalkan");
      await ubah("rad_jadwal", j.uuid, f, { status: "hadir", waktu_hadir: sekarang(), no_antrean: await antreanBaru(f, j.ruang_uuid, j.tgl, k) }, k);
      return satuJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, `Pasien hadir — antrean ${hasil.ruang_kode}-${String(hasil.no_antrean).padStart(3, "0")}`);
  }),
);

// POST /jadwal/:uuid/batal { alasan } — slot kembali tersedia, item kembali "menunggu jadwal".
rute.post(
  "/:uuid/batal",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = String(req.body?.alasan ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const hasil = await transaksi(async (k) => {
      const j = await kunciJadwal(req.params.uuid, f, k);
      if (!["terjadwal", "hadir"].includes(j.status)) throw new Galat(409, `Jadwal berstatus ${j.status} tidak dapat dibatalkan`);
      const dikerjakan = await satu(`SELECT COUNT(*)::int n FROM rad_order_item WHERE jadwal_uuid = $1 AND deleted_at IS NULL AND status <> 'menunggu'`, [j.uuid], k);
      if (dikerjakan.n) throw new Galat(409, "Sebagian pemeriksaan sudah dikerjakan; jadwal tidak dapat dibatalkan");
      await ubah("rad_jadwal", j.uuid, f, { status: "batal", alasan_batal: alasan }, k);
      await query(`UPDATE rad_order_item SET jadwal_uuid = NULL, updated_at = $2 WHERE jadwal_uuid = $1`, [j.uuid, sekarang()], k);
      return satuJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, "Jadwal dibatalkan; slot kembali tersedia");
  }),
);

export default rute;
