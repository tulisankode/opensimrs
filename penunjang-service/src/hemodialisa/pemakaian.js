import express from "express";
import { query, satu, sisipkan, transaksi, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinHd } from "../umum/izin.js";
import { panggilLayanan } from "../umum/layanan.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { cariKunjungan } from "../umum/kunjungan.js";
import config from "../config.js";
import { angka, cekBatasDializer, hariIni, ramah, teks } from "./bersama.js";
import { ambilSesi } from "./sesi.js";

// Dializer per pasien (identitas serial, batas pemakaian dari aturan faskes) & pemakaian dializer/BHP per sesi (KF-9).
// Stok tidak dibangun ulang: pemakaian baru (BHP atau pemakaian pertama dializer) dibuat sebagai order alkes di
// farmasi-service pada kunjungan pasien (lokasi stok depo/unit HD) — pola sama dengan Kamar Operasi (pemakaian.js);
// pengurangan stok otoritatif terjadi saat farmasi memverifikasi order. Stok yang diperkirakan tidak cukup ditolak
// sebelum order dibuat (KT-14). Reuse dializer (pemakaian ke-2 dst.) tidak mengambil stok baru dan tidak ditagih ulang.
// Batas reuse ditegakkan dengan kunci baris dializer + UPDATE bersyarat (jumlah_pakai < pemakaian_maksimal) + CHECK di
// database, sehingga dua sesi bersamaan tidak dapat melampaui batas.
const rute = express.Router();
const izin = (aksi) => izinHd("Pemakaian BHP", aksi);

const JENIS_PELAYANAN = { RJ: "rj", RI: "ri", IGD: "igd" };

// ── Dializer ─────────────────────────────────────────────────────────────────
rute.get(
  "/dializer",
  izin("READ"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "d.faskes_uuid = $1 AND d.deleted_at IS NULL";
    if (req.query.registrasi_uuid) {
      p.push(String(req.query.registrasi_uuid));
      w += ` AND d.registrasi_uuid = $${p.length}`;
    }
    if (req.query.status) {
      p.push(String(req.query.status));
      w += ` AND d.status = $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT d.*, im.name AS nama_item, r.no_reg_hd, p.name AS nama_pasien,
                (SELECT COALESCE(json_agg(json_build_object('sesi_uuid', pm.sesi_uuid, 'pemakaian_ke', pm.pemakaian_ke, 'created_at', pm.created_at) ORDER BY pm.created_at), '[]')
                   FROM hd_pemakaian pm WHERE pm.dializer_uuid = d.uuid AND pm.deleted_at IS NULL) AS riwayat
           FROM hd_dializer d JOIN item_medis im ON im.uuid = d.item_medis_uuid JOIN hd_registrasi r ON r.uuid = d.registrasi_uuid
           JOIN patients p ON p.uuid = r.patient_uuid
          WHERE ${w} ORDER BY d.created_at DESC LIMIT 200`,
        p,
      ),
    );
  }),
);

// POST /dializer { registrasi_uuid, item_medis_uuid, serial } — batas pemakaian disalin dari aturan faskes saat didaftarkan;
// tanpa aturan untuk item tsb, dializer sekali pakai (batas 1) sampai kebijakan reuse faskes diisi di Datamaster.
rute.post(
  "/dializer",
  izin("CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["registrasi_uuid", "item_medis_uuid", "serial"]);
    const f = req.author.faskesUuid;
    const reg = await satu(`SELECT uuid, status FROM hd_registrasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.registrasi_uuid, f]);
    if (!reg) throw tidakDitemukan("Registrasi HD");
    if (reg.status !== "aktif") throw new Galat(409, "Registrasi HD nonaktif");
    const item = await satu(`SELECT uuid, name FROM item_medis WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [b.item_medis_uuid, f]);
    if (!item) throw tidakDitemukan("Item medis (atau sedang tidak aktif)");
    const aturan = await satu(`SELECT pemakaian_maksimal FROM hd_dializer_aturan WHERE faskes_uuid = $1 AND item_medis_uuid = $2 AND deleted_at IS NULL`, [f, item.uuid]);
    const serial = teks(b.serial, 100);
    if (!serial) throw permintaanSalah("serial wajib diisi");
    const baris = await sisipkan("hd_dializer", {
      faskes_uuid: f,
      registrasi_uuid: reg.uuid,
      item_medis_uuid: item.uuid,
      serial,
      pemakaian_maksimal: Number(aturan?.pemakaian_maksimal ?? 1),
      jumlah_pakai: 0,
      status: "aktif",
      dibuat_oleh: req.author.username ?? null,
    }).catch((e) => ramah(e, `Serial dializer ${serial} sudah terdaftar`));
    kirim(res, { ...baris, aturan_ditemukan: !!aturan }, aturan ? "Dializer didaftarkan" : "Dializer didaftarkan sebagai sekali pakai (belum ada aturan reuse untuk item ini)");
  }),
);

rute.post(
  "/dializer/:uuid/berhenti",
  izin("CREATE"),
  tangani(async (req, res) => {
    const alasan = teks(req.body?.alasan);
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const baris = await satu(
      `UPDATE hd_dializer SET status = 'berhenti', alasan_berhenti = $3, updated_at = $4 WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status = 'aktif' RETURNING *`,
      [req.params.uuid, req.author.faskesUuid, alasan, sekarang()],
    );
    if (!baris) throw new Galat(409, "Dializer tidak ditemukan atau sudah dihentikan");
    kirim(res, baris, "Pemakaian ulang dializer dihentikan");
  }),
);

// Lokasi stok aktif faskes (depo/unit HD) untuk form pemakaian.
rute.get(
  "/lokasi-stok",
  izin("READ"),
  tangani(async (req, res) =>
    kirim(
      res,
      await query(`SELECT uuid, code AS kode, name AS nama, jenis_lokasi FROM lokasi_stok WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status ORDER BY jenis_lokasi DESC, name`, [
        req.author.faskesUuid,
      ]),
    ),
  ),
);

// ── Pemakaian per sesi ───────────────────────────────────────────────────────
rute.get(
  "/sesi/:uuid/pemakaian",
  izin("READ"),
  tangani(async (req, res) => {
    const s = await ambilSesi(req.params.uuid, req.author.faskesUuid);
    kirim(
      res,
      await query(
        `SELECT pm.*, d.serial, d.pemakaian_maksimal FROM hd_pemakaian pm LEFT JOIN hd_dializer d ON d.uuid = pm.dializer_uuid
          WHERE pm.sesi_uuid = $1 AND pm.deleted_at IS NULL ORDER BY pm.created_at`,
        [s.uuid],
      ),
    );
  }),
);

// Order alkes ke farmasi untuk pemakaian yang mengambil stok; melempar 409 bila stok diperkirakan tidak cukup.
const orderStok = async ({ req, f, kunjungan, jadwal, item, qty, lokasiStokUuid, k }) => {
  if (!lokasiStokUuid) throw permintaanSalah("lokasi_stok_uuid wajib diisi untuk pemakaian yang mengambil stok");
  if (!kunjungan) throw new Galat(409, "Jadwal belum terhubung ke kunjungan (No. Reg); catat kehadiran dengan No. Reg agar BHP dapat dikeluarkan dari stok");
  if (!kunjungan.rekam_medis_uuid) throw new Galat(409, `Kunjungan ${kunjungan.no_reg} belum memiliki rekam medis; order BHP ke farmasi tidak dapat dibuat`);
  const lokasi = await satu(`SELECT uuid FROM lokasi_stok WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [lokasiStokUuid, f], k);
  if (!lokasi) throw tidakDitemukan("Lokasi stok");
  // Perkiraan ketersediaan (non-otoritatif) sebelum order dibuat; otoritas tetap pada verifikasi farmasi.
  const stok = await satu(
    `SELECT COALESCE(SUM(s.sisa_stok), 0)::int AS tersedia FROM stock_medis s JOIN item_medis_jenis_stok jm ON jm.uuid = s.item_medis_jenis_stok_uuid
      WHERE jm.item_medis_uuid = $1 AND s.lokasi_stok_uuid = $2 AND s.deleted_at IS NULL AND s.sisa_stok > 0 AND (s.exp_date IS NULL OR s.exp_date > now())`,
    [item.uuid, lokasiStokUuid],
    k,
  );
  if (stok.tersedia < qty) throw new Galat(409, `Stok ${item.name} di lokasi tersebut hanya tersedia ${stok.tersedia}`);
  const p = await satu(`SELECT no_rm FROM patients WHERE uuid = $1`, [kunjungan.patient_uuid], k);
  const dibuat = await panggilLayanan(`${config.farmasiUrl}/alkes`, {
    method: "POST",
    token: req.author.token,
    nama: "Farmasi (order BHP Hemodialisa)",
    body: {
      no_reg: kunjungan.no_reg,
      patient_uuid: kunjungan.patient_uuid,
      no_rm: p?.no_rm ?? null,
      jenis_pelayanan: JENIS_PELAYANAN[kunjungan.type] ?? "rj",
      rekam_medis_uuid: kunjungan.rekam_medis_uuid,
      rekam_medis_date: jadwal.tanggal_teks ?? hariIni(),
      lokasi_uuid: kunjungan.lokasi_uuid,
      lokasi_stok_uuid: lokasiStokUuid,
      payment_method: Number(kunjungan.payment_method ?? 1),
      alkes: [{ item_medis_uuid: item.uuid, qty }],
    },
  });
  const order = dibuat?.payload;
  if (!order?.uuid) throw new Galat(502, "Farmasi: respons order alkes tidak lengkap");
  return { order_alkes_uuid: order.uuid, harga_satuan: Number(order?.alkes_items?.[0]?.harga_satuan ?? 0) };
};

// POST /sesi/:uuid/pemakaian
//   { jenis: "dializer", dializer_uuid, lokasi_stok_uuid? }   lokasi stok wajib hanya pada pemakaian pertama dializer
//   { jenis: "bhp", item_medis_uuid, qty, lokasi_stok_uuid }
rute.post(
  "/sesi/:uuid/pemakaian",
  izin("CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!["dializer", "bhp"].includes(b.jenis)) throw permintaanSalah("jenis harus salah satu: dializer, bhp");
    if (b.jenis === "dializer") wajib(b, ["dializer_uuid"]);
    else wajib(b, ["item_medis_uuid", "qty", "lokasi_stok_uuid"]);
    const qty = b.jenis === "dializer" ? 1 : angka(b.qty, "qty", { min: 1, maks: 1000, bulat: true });

    const pemakaian = await transaksi(async (k) => {
      const s = await ambilSesi(req.params.uuid, f, k, true);
      if (!["asesmen", "berjalan", "selesai"].includes(s.status)) throw new Galat(409, `Sesi berstatus ${s.status}; pemakaian tidak dapat dicatat`);
      const jadwal = await satu(`SELECT j.*, to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal_teks, COALESCE(j.no_reg, r.no_reg) AS no_reg_kunjungan
           FROM hd_jadwal j JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid WHERE j.uuid = $1`, [s.jadwal_uuid], k);
      // Kunjungan sesi: No. Reg saat hadir, bila kosong kunjungan bawaan registrasi.
      const kunjungan = jadwal.no_reg_kunjungan ? await cariKunjungan(jadwal.no_reg_kunjungan, f) : null;

      if (b.jenis === "dializer") {
        const d = await satu(`SELECT * FROM hd_dializer WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [b.dializer_uuid, f], k);
        if (!d) throw tidakDitemukan("Dializer");
        if (d.registrasi_uuid !== jadwal.registrasi_uuid) throw new Galat(409, "Dializer terdaftar untuk pasien lain; dializer tidak boleh dipakai lintas pasien");
        const sudah = await satu(`SELECT 1 FROM hd_pemakaian WHERE sesi_uuid = $1 AND dializer_uuid = $2 AND deleted_at IS NULL`, [s.uuid, d.uuid], k);
        if (sudah) throw new Galat(409, `Dializer ${d.serial} sudah dicatat pada sesi ini`);
        const cek = cekBatasDializer(d);
        if (!cek.boleh) throw new Galat(409, cek.alasan);
        const item = await satu(`SELECT uuid, name FROM item_medis WHERE uuid = $1`, [d.item_medis_uuid], k);
        const stok = cek.pemakaian_ke === 1 ? await orderStok({ req, f, kunjungan, jadwal, item, qty: 1, lokasiStokUuid: b.lokasi_stok_uuid, k }) : null;
        const t = sekarang();
        const naik = await satu(
          `UPDATE hd_dializer SET jumlah_pakai = jumlah_pakai + 1,
                  status = CASE WHEN jumlah_pakai + 1 >= pemakaian_maksimal THEN 'berhenti' ELSE status END,
                  alasan_berhenti = CASE WHEN jumlah_pakai + 1 >= pemakaian_maksimal THEN 'Batas pemakaian tercapai' ELSE alasan_berhenti END,
                  updated_at = $2
            WHERE uuid = $1 AND status = 'aktif' AND jumlah_pakai < pemakaian_maksimal RETURNING jumlah_pakai`,
          [d.uuid, t],
          k,
        );
        if (!naik) throw new Galat(409, `Dializer ${d.serial} sudah mencapai batas pemakaian`);
        return sisipkan(
          "hd_pemakaian",
          {
            faskes_uuid: f,
            sesi_uuid: s.uuid,
            jenis: "dializer",
            dializer_uuid: d.uuid,
            item_medis_uuid: item.uuid,
            nama_item: item.name,
            qty: 1,
            pemakaian_ke: naik.jumlah_pakai,
            lokasi_stok_uuid: stok ? b.lokasi_stok_uuid : null,
            harga_satuan: stok?.harga_satuan ?? null,
            order_alkes_uuid: stok?.order_alkes_uuid ?? null,
            status_stok: stok ? "diorder" : "reuse",
            status_tagihan: stok && stok.harga_satuan > 0 ? "belum" : "tanpa_biaya",
            petugas: req.author.username ?? null,
          },
          k,
        ).catch((e) => ramah(e, `Dializer ${d.serial} sudah dicatat pada sesi ini`));
      }

      const item = await satu(`SELECT uuid, name FROM item_medis WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [b.item_medis_uuid, f], k);
      if (!item) throw tidakDitemukan("Item medis (atau sedang tidak aktif)");
      const stok = await orderStok({ req, f, kunjungan, jadwal, item, qty, lokasiStokUuid: b.lokasi_stok_uuid, k });
      return sisipkan(
        "hd_pemakaian",
        {
          faskes_uuid: f,
          sesi_uuid: s.uuid,
          jenis: "bhp",
          item_medis_uuid: item.uuid,
          nama_item: item.name,
          qty,
          lokasi_stok_uuid: b.lokasi_stok_uuid,
          harga_satuan: stok.harga_satuan,
          order_alkes_uuid: stok.order_alkes_uuid,
          status_stok: "diorder",
          status_tagihan: stok.harga_satuan > 0 ? "belum" : "tanpa_biaya",
          petugas: req.author.username ?? null,
        },
        k,
      );
    });

    // Tagihan BHP (ref per pemakaian, idempoten) di luar transaksi; gagal → status gagal, dapat dikirim ulang.
    const tagihan = pemakaian.status_tagihan === "belum" ? await tagihPemakaian(pemakaian.uuid, f, req.author.token) : { status_tagihan: pemakaian.status_tagihan };
    kirim(
      res,
      { ...pemakaian, ...tagihan },
      pemakaian.status_stok === "reuse" ? `Reuse dializer ke-${pemakaian.pemakaian_ke} dicatat` : `Pemakaian ${pemakaian.nama_item} dicatat; menunggu verifikasi stok oleh Farmasi`,
    );
  }),
);

export const tagihPemakaian = async (uuid, f, token) => {
  const pm = await satu(
    `SELECT pm.*, COALESCE(j.no_reg, r.no_reg) AS no_reg, r.patient_uuid, r.payment_method, r.no_reg_hd, r.uuid AS registrasi_uuid
       FROM hd_pemakaian pm JOIN hd_sesi se ON se.uuid = pm.sesi_uuid JOIN hd_jadwal j ON j.uuid = se.jadwal_uuid JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid
      WHERE pm.uuid = $1 AND pm.faskes_uuid = $2 AND pm.deleted_at IS NULL`,
    [uuid, f],
  );
  if (!pm) throw tidakDitemukan("Pemakaian");
  if (["terkirim", "tanpa_biaya"].includes(pm.status_tagihan)) return { status_tagihan: pm.status_tagihan, pesan_tagihan: null };
  let status = "terkirim";
  let pesan = null;
  try {
    await kirimTagihan({
      faskesUuid: f,
      patientUuid: pm.patient_uuid,
      noReg: pm.no_reg,
      paymentMethod: pm.payment_method,
      ref: `hd-pemakaian:${pm.uuid}`,
      items: [{ item_name: `BHP Hemodialisa: ${pm.nama_item}`, qty: pm.qty, price: Number(pm.harga_satuan), additional_info: { sesi_uuid: pm.sesi_uuid, item_medis_uuid: pm.item_medis_uuid } }],
      token,
      apsType: "HD",
      apsServiceName: "Unit Hemodialisa",
      apsServiceCode: pm.no_reg_hd,
      apsLayananUuid: pm.registrasi_uuid,
    });
  } catch (e) {
    status = "gagal";
    pesan = e.message;
  }
  await query(`UPDATE hd_pemakaian SET status_tagihan = $2, pesan_tagihan = $3, updated_at = $4 WHERE uuid = $1`, [pm.uuid, status, pesan, sekarang()]);
  return { status_tagihan: status, pesan_tagihan: pesan };
};

rute.post(
  "/pemakaian/:uuid/tagihan/kirim-ulang",
  izin("CREATE"),
  tangani(async (req, res) => {
    const hasil = await tagihPemakaian(req.params.uuid, req.author.faskesUuid, req.author.token);
    kirim(res, hasil, hasil.status_tagihan === "terkirim" ? "Tagihan BHP terkirim" : `Tagihan BHP ${hasil.status_tagihan}`);
  }),
);

export default rute;
