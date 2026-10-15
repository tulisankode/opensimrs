import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { KEPERLUAN_PINJAM, daftarNilai, hariIni, ramah, tanggalValid, teks } from "./bersama.js";
import { izinPa } from "../umum/izin.js";

// Arsip blok parafin & slide PA: lokasi rak, status ada / dipinjam / dikembalikan, peminjaman untuk konsultasi /
// second opinion / IHK luar beserta riwayatnya. Blok & slide dibuat otomatis dari makroskopis (jumlah blok/slide);
// tambahan manual (potong ulang, slide IHK) lewat POST /.
const rute = express.Router();

const KOLOM = `b.uuid, b.order_item_uuid, b.jenis, b.kode, b.pewarnaan, b.keterangan, b.lokasi_rak, b.status, b.created_at, b.updated_at,
  i.no_pa, i.nama AS pemeriksaan, i.jenis AS jenis_pemeriksaan, i.status AS status_kasus, o.no_rm, o.no_order, pt.name AS nama_pasien,
  lp.diagnosis, pj.uuid AS peminjaman_uuid, pj.peminjam, pj.instansi, pj.keperluan, pj.waktu_pinjam,
  to_char(pj.rencana_kembali, 'YYYY-MM-DD') AS rencana_kembali,
  (pj.rencana_kembali IS NOT NULL AND pj.rencana_kembali < $TGL::date) AS terlambat`;
const DARI = `pa_blok_slide b JOIN pa_order_item i ON i.uuid = b.order_item_uuid JOIN pa_order o ON o.uuid = i.order_uuid
  LEFT JOIN patients pt ON pt.uuid = o.patient_uuid
  LEFT JOIN pa_laporan lp ON lp.order_item_uuid = i.uuid AND lp.deleted_at IS NULL
  LEFT JOIN LATERAL (SELECT * FROM pa_peminjaman x WHERE x.blok_slide_uuid = b.uuid AND x.deleted_at IS NULL AND x.waktu_kembali IS NULL
                      ORDER BY x.waktu_pinjam DESC LIMIT 1) pj ON true`;

const satuArsip = async (uuid, faskes, k) => {
  const r = await satu(`SELECT ${KOLOM.replace("$TGL", "$3")} FROM ${DARI} WHERE b.uuid = $1 AND b.faskes_uuid = $2 AND b.deleted_at IS NULL`, [uuid, faskes, hariIni()], k);
  if (!r) throw tidakDitemukan("Blok/slide");
  return r;
};

// ?cari= (kode / no PA / pasien / No. RM) · ?jenis=blok,slide · ?status=ada,dipinjam,dikembalikan · ?terlambat=1 · ?order_item_uuid=
rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid, hariIni()];
    // $2 (tanggal hari ini) selalu dirujuk agar tipenya diketahui pada kueri hitung.
    let w = "b.faskes_uuid = $1 AND b.deleted_at IS NULL AND $2::date IS NOT NULL";
    const jenis = daftarNilai(req.query.jenis).filter((j) => ["blok", "slide"].includes(j));
    if (jenis.length) {
      p.push(jenis);
      w += ` AND b.jenis = ANY($${p.length})`;
    }
    const status = daftarNilai(req.query.status).filter((s) => ["ada", "dipinjam", "dikembalikan"].includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND b.status = ANY($${p.length})`;
    }
    if (req.query.order_item_uuid) {
      p.push(req.query.order_item_uuid);
      w += ` AND b.order_item_uuid = $${p.length}`;
    }
    if (["1", "true"].includes(String(req.query.terlambat))) w += " AND pj.rencana_kembali < $2::date";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      const c = `$${p.length}`;
      w += ` AND (b.kode ILIKE ${c} OR i.no_pa ILIKE ${c} OR pt.name ILIKE ${c} OR o.no_rm ILIKE ${c} OR b.lokasi_rak ILIKE ${c} OR pj.peminjam ILIKE ${c})`;
    }
    const [total, ringkasan] = await Promise.all([
      satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p),
      satu(
        `SELECT COUNT(*) FILTER (WHERE b.jenis = 'blok')::int AS blok, COUNT(*) FILTER (WHERE b.jenis = 'slide')::int AS slide,
                COUNT(*) FILTER (WHERE b.status = 'dipinjam')::int AS dipinjam,
                COUNT(*) FILTER (WHERE pj.rencana_kembali < $2::date)::int AS terlambat,
                COUNT(*) FILTER (WHERE b.lokasi_rak IS NULL AND b.status <> 'dipinjam')::int AS tanpa_rak
           FROM ${DARI} WHERE b.faskes_uuid = $1 AND b.deleted_at IS NULL`,
        p.slice(0, 2),
      ),
    ]);
    const rows = await query(
      `SELECT ${KOLOM.replace("$TGL", "$2")} FROM ${DARI} WHERE ${w}
        ORDER BY i.no_pa DESC NULLS LAST, b.jenis, b.kode LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, { ...denganHalaman(rows, total.n, pg), ringkasan });
  }),
);

// Tambah blok/slide manual (potong ulang, slide IHK, pewarnaan khusus). Kode kosong = otomatis <noPA>-<B|S><n>.
rute.post(
  "/",
  izinPa("Arsip Blok & Slide", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    if (!["blok", "slide"].includes(b.jenis)) throw permintaanSalah("jenis harus blok atau slide");
    if (!b.order_item_uuid && !b.no_pa) throw permintaanSalah("order_item_uuid atau no_pa wajib diisi");
    const baru = await transaksi(async (k) => {
      const i = await satu(
        `SELECT uuid, no_pa FROM pa_order_item WHERE faskes_uuid = $1 AND deleted_at IS NULL AND no_pa IS NOT NULL AND (uuid = $2 OR no_pa = $3) FOR UPDATE`,
        [faskes, b.order_item_uuid || null, b.no_pa || null],
        k,
      );
      if (!i) throw permintaanSalah("Kasus PA (bernomor PA) tidak ditemukan");
      let kode = teks(b.kode, 60);
      if (!kode) {
        const huruf = b.jenis === "blok" ? "B" : "S";
        const r = await satu(
          `SELECT COALESCE(MAX(NULLIF(substring(kode FROM $2), '')::int), 0) + 1 AS n FROM pa_blok_slide WHERE order_item_uuid = $1 AND deleted_at IS NULL`,
          [i.uuid, `^${i.no_pa.replace(/-/g, "\\-")}-${huruf}(\\d+)$`],
          k,
        );
        kode = `${i.no_pa}-${huruf}${r.n}`;
      }
      return sisipkan(
        "pa_blok_slide",
        { faskes_uuid: faskes, order_item_uuid: i.uuid, jenis: b.jenis, kode, pewarnaan: teks(b.pewarnaan, 50) ?? null, keterangan: teks(b.keterangan) ?? null, lokasi_rak: teks(b.lokasi_rak, 100) ?? null, status: "ada" },
        k,
      ).catch((e) => ramah(e, `Kode ${kode} sudah dipakai`));
    });
    kirim(res, await satuArsip(baru.uuid, faskes), `${b.jenis === "blok" ? "Blok" : "Slide"} ${baru.kode} ditambahkan`);
  }),
);

// Atur lokasi rak sekaligus untuk banyak blok/slide: { uuids: [], lokasi_rak }.
rute.post(
  "/lokasi",
  izinPa("Arsip Blok & Slide", "UPDATE"),
  tangani(async (req, res) => {
    const uuids = Array.isArray(req.body?.uuids) ? req.body.uuids.filter(Boolean) : [];
    if (!uuids.length) throw permintaanSalah("uuids wajib diisi");
    const lokasi = teks(req.body?.lokasi_rak, 100) ?? null;
    const r = await query(
      `UPDATE pa_blok_slide SET lokasi_rak = $3, updated_at = $4 WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL RETURNING uuid`,
      [uuids, req.author.faskesUuid, lokasi, sekarang()],
    );
    kirim(res, { jumlah: r.length }, `Lokasi rak ${r.length} blok/slide diperbarui`);
  }),
);

rute.get(
  "/:uuid/riwayat",
  tangani(async (req, res) => {
    const a = await satuArsip(req.params.uuid, req.author.faskesUuid);
    const riwayat = await query(
      `SELECT uuid, peminjam, instansi, keperluan, catatan, waktu_pinjam, to_char(rencana_kembali, 'YYYY-MM-DD') AS rencana_kembali,
              petugas_pinjam, waktu_kembali, petugas_kembali, kondisi_kembali
         FROM pa_peminjaman WHERE blok_slide_uuid = $1 AND deleted_at IS NULL ORDER BY waktu_pinjam DESC`,
      [a.uuid],
    );
    kirim(res, { ...a, riwayat });
  }),
);

rute.put(
  "/:uuid",
  izinPa("Arsip Blok & Slide", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const r = await ubah("pa_blok_slide", req.params.uuid, req.author.faskesUuid, {
      lokasi_rak: teks(b.lokasi_rak, 100),
      pewarnaan: teks(b.pewarnaan, 50),
      keterangan: teks(b.keterangan),
    });
    if (!r) throw tidakDitemukan("Blok/slide");
    kirim(res, await satuArsip(r.uuid, req.author.faskesUuid), "Arsip diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izinPa("Arsip Blok & Slide", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const a = await satuArsip(req.params.uuid, faskes);
    if (a.status === "dipinjam") throw new Galat(409, "Blok/slide sedang dipinjam");
    await ubah("pa_blok_slide", a.uuid, faskes, { deleted_at: sekarang() });
    kirim(res, { uuid: a.uuid }, `${a.kode} dihapus dari arsip`);
  }),
);

// Pinjam: { peminjam, instansi?, keperluan?, rencana_kembali? (YYYY-MM-DD), catatan? }.
rute.post(
  "/:uuid/pinjam",
  izinPa("Arsip Blok & Slide", "PINJAM"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const peminjam = teks(b.peminjam, 200);
    if (!peminjam) throw permintaanSalah("peminjam wajib diisi");
    if (b.keperluan && !KEPERLUAN_PINJAM[b.keperluan]) throw permintaanSalah(`keperluan harus salah satu: ${Object.keys(KEPERLUAN_PINJAM).join(", ")}`);
    const rencana = b.rencana_kembali ? tanggalValid(b.rencana_kembali, "rencana_kembali") : null;
    if (rencana && rencana < hariIni()) throw permintaanSalah("rencana_kembali tidak boleh sebelum hari ini");
    await transaksi(async (k) => {
      const a = await satu(`SELECT * FROM pa_blok_slide WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!a) throw tidakDitemukan("Blok/slide");
      if (a.status === "dipinjam") throw new Galat(409, `${a.kode} sedang dipinjam`);
      await sisipkan(
        "pa_peminjaman",
        {
          faskes_uuid: faskes, blok_slide_uuid: a.uuid, peminjam, instansi: teks(b.instansi, 200) ?? null, keperluan: b.keperluan || null,
          catatan: teks(b.catatan) ?? null, waktu_pinjam: sekarang(), rencana_kembali: rencana, petugas_pinjam: req.author.username ?? null,
        },
        k,
      );
      await ubah("pa_blok_slide", a.uuid, faskes, { status: "dipinjam" }, k);
    });
    const a = await satuArsip(req.params.uuid, faskes);
    kirim(res, a, `${a.kode} dipinjam oleh ${peminjam}`);
  }),
);

// Kembali: { kondisi_kembali?, lokasi_rak? } → status 'dikembalikan' (kembali di arsip).
rute.post(
  "/:uuid/kembali",
  izinPa("Arsip Blok & Slide", "PINJAM"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    await transaksi(async (k) => {
      const a = await satu(`SELECT * FROM pa_blok_slide WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!a) throw tidakDitemukan("Blok/slide");
      if (a.status !== "dipinjam") throw new Galat(409, `${a.kode} tidak sedang dipinjam`);
      await query(
        `UPDATE pa_peminjaman SET waktu_kembali = $2, petugas_kembali = $3, kondisi_kembali = $4, updated_at = $2
          WHERE blok_slide_uuid = $1 AND deleted_at IS NULL AND waktu_kembali IS NULL`,
        [a.uuid, sekarang(), req.author.username ?? null, teks(b.kondisi_kembali) ?? null],
        k,
      );
      await ubah("pa_blok_slide", a.uuid, faskes, { status: "dikembalikan", lokasi_rak: teks(b.lokasi_rak, 100) }, k);
    });
    const a = await satuArsip(req.params.uuid, faskes);
    kirim(res, a, `${a.kode} dikembalikan ke arsip`);
  }),
);

export default rute;
