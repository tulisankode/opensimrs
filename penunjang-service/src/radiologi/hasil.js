import express from "express";
import { query, satu, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { NAMA_PRAKTISI, STATUS_ITEM, daftarNilai, hariIni, rentangOpsional, tanggalValid, tglLokal } from "./bersama.js";
import { detailOrder } from "./order.js";

// Worklist pemeriksaan radiologi (per item pemeriksaan) untuk radiografer & dokter Sp.Rad:
// menunggu → diperiksa (radiografer, waktu) → selesai (expertise: hasil, kesan, dokter radiologi, lampiran).
// Order ikut berubah: 'diperiksa' saat item pertama dikerjakan, 'selesai' bila semua item selesai.
const rute = express.Router();

const MAKS_LAMPIRAN = 5;

rute.get(
  "/worklist",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    // Hanya order yang sudah divalidasi (termasuk order MCU yang langsung 'valid').
    let w = "i.faskes_uuid = $1 AND i.deleted_at IS NULL AND o.deleted_at IS NULL AND o.status IN ('valid', 'diperiksa', 'selesai')";
    const status = daftarNilai(req.query.status).filter((s) => STATUS_ITEM.includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND i.status = ANY($${p.length})`;
    }
    const modalitas = daftarNilai(req.query.modalitas);
    if (modalitas.length) {
      p.push(modalitas);
      w += ` AND i.modalitas = ANY($${p.length})`;
    }
    const sumber = daftarNilai(req.query.sumber);
    if (sumber.length) {
      p.push(sumber);
      w += ` AND o.sumber = ANY($${p.length})`;
    }
    const rentang = rentangOpsional(req.query);
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("o.created_at")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (["1", "true"].includes(String(req.query.cito))) w += " AND o.cito";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (p.name ILIKE $${p.length} OR o.no_rm ILIKE $${p.length} OR o.no_order ILIKE $${p.length} OR i.nama ILIKE $${p.length})`;
    }
    // Ruang: ruang tempat diperiksa, atau ruang jadwal bila belum diperiksa.
    const ruang = daftarNilai(req.query.ruang_uuid);
    if (ruang.length) {
      p.push(ruang);
      w += ` AND COALESCE(i.ruang_uuid, j.ruang_uuid) = ANY($${p.length})`;
    }
    // Jadwal: tanggal jadwal tertentu, dan/atau kategori kedatangan (belum_dijadwalkan | terjadwal | hadir).
    if (req.query.tanggal_jadwal) {
      p.push(tanggalValid(req.query.tanggal_jadwal === "hari_ini" ? hariIni() : req.query.tanggal_jadwal, "tanggal_jadwal"));
      w += ` AND j.tanggal = $${p.length}`;
    }
    const kedatangan = daftarNilai(req.query.kedatangan);
    if (kedatangan.length) {
      const syarat = [];
      if (kedatangan.includes("belum_dijadwalkan")) syarat.push("j.uuid IS NULL");
      if (kedatangan.includes("terjadwal")) syarat.push("j.status = 'terjadwal'");
      if (kedatangan.includes("hadir")) syarat.push("j.status = 'hadir'");
      if (syarat.length) w += ` AND (${syarat.join(" OR ")})`;
    }
    const dari = `FROM rad_order_item i JOIN rad_order o ON o.uuid = i.order_uuid LEFT JOIN patients p ON p.uuid = o.patient_uuid
                  LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
                  LEFT JOIN rad_jadwal j ON j.uuid = i.jadwal_uuid AND j.status <> 'batal' AND j.deleted_at IS NULL
                  LEFT JOIN rad_ruang r ON r.uuid = COALESCE(i.ruang_uuid, j.ruang_uuid)`;
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT i.uuid, i.order_uuid, i.pemeriksaan_uuid, i.nama, i.modalitas, i.harga::float8 AS harga, i.status,
              i.radiografer, i.waktu_periksa, i.dokter_radiologi_uuid, ${NAMA_PRAKTISI("i.dokter_radiologi_uuid")} AS dokter_radiologi,
              i.waktu_hasil, (i.hasil IS NOT NULL) AS ada_hasil, jsonb_array_length(i.lampiran) AS jumlah_lampiran,
              o.no_order, o.no_rm, o.no_reg, o.sumber, o.pelayanan, o.cito, o.klinis, o.status AS status_order,
              o.tanpa_tagihan, o.created_at AS waktu_order, o.patient_uuid,
              p.name AS nama_pasien, p.gender, bd.birth_date,
              ${NAMA_PRAKTISI("o.dokter_pengirim_uuid")} AS dokter_pengirim,
              i.ruang_uuid, i.jadwal_uuid, i.radiografer_uuid, r.kode AS ruang_kode, r.nama AS ruang, j.ruang_uuid AS jadwal_ruang_uuid,
              to_char(j.tanggal, 'YYYY-MM-DD') AS jadwal_tanggal, to_char(j.jam_mulai, 'HH24:MI') AS jadwal_jam,
              j.status AS jadwal_status, j.no_antrean, j.waktu_hadir
         ${dari} WHERE ${w}
        ORDER BY CASE i.status WHEN 'menunggu' THEN 0 WHEN 'diperiksa' THEN 1 ELSE 2 END, o.cito DESC,
                 CASE j.status WHEN 'hadir' THEN 0 WHEN 'terjadwal' THEN 1 ELSE 2 END, j.tanggal, j.jam_mulai, o.created_at, i.created_at
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Kunci item + order induk dalam transaksi.
const kunciItem = async (uuid, faskesUuid, k) => {
  const i = await satu(`SELECT * FROM rad_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskesUuid], k);
  if (!i) throw tidakDitemukan("Item pemeriksaan radiologi");
  const o = await satu(`SELECT * FROM rad_order WHERE uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [i.order_uuid], k);
  if (!o) throw tidakDitemukan("Order radiologi");
  if (o.status === "order") throw new Galat(409, "Order belum divalidasi");
  if (o.status === "batal") throw new Galat(409, "Order sudah dibatalkan");
  return { i, o };
};

// Detail satu item + order lengkap (untuk dialog hasil & cetak).
rute.get(
  "/item/:uuid",
  tangani(async (req, res) => {
    const i = await satu(`SELECT order_uuid FROM rad_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, req.author.faskesUuid]);
    if (!i) throw tidakDitemukan("Item pemeriksaan radiologi");
    const order = await detailOrder(i.order_uuid, req.author.faskesUuid);
    kirim(res, { ...order.items.find((x) => x.uuid === req.params.uuid), order });
  }),
);

// Radiografer mengerjakan pemeriksaan (akuisisi citra) di ruang/alat tertentu.
// Body: { radiografer_uuid? | radiografer?, ruang_uuid?, waktu_periksa? }. Ruang bawaan = ruang jadwal item.
// Item terjadwal → jadwal berstatus 'diperiksa' (pasien dianggap hadir bila belum check-in).
rute.post(
  "/item/:uuid/periksa",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const waktu = b.waktu_periksa ? Number(b.waktu_periksa) : sekarang();
    if (!Number.isFinite(waktu) || waktu <= 0) throw permintaanSalah("waktu_periksa tidak valid");
    let namaRadiografer = String(b.radiografer ?? "").trim();
    if (b.radiografer_uuid) {
      const r = await satu(
        `SELECT TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = $1 AND pr.faskes_uuid = $2 AND pr.deleted_at IS NULL`,
        [b.radiografer_uuid, faskes],
      );
      if (!r) throw permintaanSalah("Radiografer tidak ditemukan");
      namaRadiografer = r.nama;
    }
    await transaksi(async (k) => {
      const { i, o } = await kunciItem(req.params.uuid, faskes, k);
      if (i.status === "selesai") throw new Galat(409, "Pemeriksaan sudah selesai (expertise sudah diisi)");
      const j = i.jadwal_uuid
        ? await satu(`SELECT * FROM rad_jadwal WHERE uuid = $1 AND status <> 'batal' AND deleted_at IS NULL FOR UPDATE`, [i.jadwal_uuid], k)
        : null;
      let ruangUuid = b.ruang_uuid || i.ruang_uuid || j?.ruang_uuid || null;
      // Tanpa jadwal & tanpa pilihan: bila hanya satu ruang aktif yang melayani modalitas item, pakai ruang itu.
      if (!ruangUuid && i.modalitas) {
        const tunggal = await query(
          `SELECT uuid FROM rad_ruang WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status AND $2 = ANY(modalitas) LIMIT 2`,
          [faskes, i.modalitas],
          k,
        );
        if (tunggal.length === 1) ruangUuid = tunggal[0].uuid;
      }
      if (ruangUuid) {
        const r = await satu(`SELECT nama, modalitas, status FROM rad_ruang WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [ruangUuid, faskes], k);
        if (!r) throw permintaanSalah("Ruang tidak ditemukan");
        if (i.modalitas && !r.modalitas.includes(i.modalitas)) throw permintaanSalah(`${r.nama} tidak melayani modalitas ${i.modalitas}`);
      }
      await ubah(
        "rad_order_item",
        i.uuid,
        faskes,
        {
          status: "diperiksa",
          radiografer: namaRadiografer || req.author.username || null,
          radiografer_uuid: b.radiografer_uuid || null,
          ruang_uuid: ruangUuid,
          waktu_periksa: waktu,
        },
        k,
      );
      if (j && ["terjadwal", "hadir"].includes(j.status)) {
        await ubah("rad_jadwal", j.uuid, faskes, { status: "diperiksa", waktu_hadir: j.waktu_hadir ?? waktu }, k);
      }
      if (o.status === "valid") await ubah("rad_order", o.uuid, faskes, { status: "diperiksa" }, k);
    });
    kirim(res, await itemDanOrder(req.params.uuid, faskes), "Pemeriksaan dicatat");
  }),
);

// Expertise dokter Sp.Rad: hasil + kesan. Bisa direvisi selama order belum batal.
rute.put(
  "/item/:uuid/hasil",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const hasil = String(b.hasil ?? "").trim();
    const kesan = String(b.kesan ?? "").trim();
    if (!hasil) throw permintaanSalah("hasil (uraian expertise) wajib diisi");
    if (!kesan) throw permintaanSalah("kesan wajib diisi");
    if (!b.dokter_radiologi_uuid) throw permintaanSalah("dokter_radiologi_uuid wajib diisi");
    const dokter = await satu(`SELECT uuid FROM practitioner WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.dokter_radiologi_uuid, faskes]);
    if (!dokter) throw permintaanSalah("Dokter radiologi tidak ditemukan");
    let lampiran;
    if (b.lampiran !== undefined) {
      if (!Array.isArray(b.lampiran)) throw permintaanSalah("lampiran harus berupa array");
      if (b.lampiran.length > MAKS_LAMPIRAN) throw permintaanSalah(`Maksimal ${MAKS_LAMPIRAN} lampiran`);
      lampiran = b.lampiran.map((l) => ({ nama: String(l?.nama ?? "lampiran"), tipe: String(l?.tipe ?? ""), data: String(l?.data ?? l?.url ?? "") }));
      if (lampiran.some((l) => !l.data)) throw permintaanSalah("Isi lampiran kosong");
    }
    const selesaiSemua = await transaksi(async (k) => {
      const { i, o } = await kunciItem(req.params.uuid, faskes, k);
      if (i.status === "menunggu") throw new Galat(409, "Pemeriksaan belum dikerjakan radiografer");
      await ubah(
        "rad_order_item",
        i.uuid,
        faskes,
        { status: "selesai", hasil, kesan, dokter_radiologi_uuid: b.dokter_radiologi_uuid, waktu_hasil: i.waktu_hasil && i.status === "selesai" ? i.waktu_hasil : sekarang(), lampiran },
        k,
      );
      const sisa = await satu(`SELECT COUNT(*)::int n FROM rad_order_item WHERE order_uuid = $1 AND deleted_at IS NULL AND status <> 'selesai'`, [o.uuid], k);
      if (!sisa.n && o.status !== "selesai") await ubah("rad_order", o.uuid, faskes, { status: "selesai", selesai_pada: sekarang() }, k);
      else if (sisa.n && o.status === "valid") await ubah("rad_order", o.uuid, faskes, { status: "diperiksa" }, k);
      return !sisa.n;
    });
    kirim(res, await itemDanOrder(req.params.uuid, faskes), selesaiSemua ? "Expertise disimpan, order selesai" : "Expertise disimpan");
  }),
);

const itemDanOrder = async (itemUuid, faskes) => {
  const i = await satu(`SELECT order_uuid FROM rad_order_item WHERE uuid = $1`, [itemUuid]);
  const order = await detailOrder(i.order_uuid, faskes, undefined, false);
  return { ...order.items.find((x) => x.uuid === itemUuid), order };
};

export default rute;
