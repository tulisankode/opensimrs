import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi, uuidv7 } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { METODE, cekPilihan, hariIni, ramah, tanggalValid, teks, angkaOpsional, boolOpsional, pilihan } from "./bersama.js";
import { izinCssd } from "../umum/izin.js";

// Datamaster CSSD: master set (template jenis set + instrumen penyusun + set fisik berbarcode) dan mesin
// sterilisasi (+ uji Bowie-Dick harian per mesin).

const ambilMaster = (uuid, faskes) =>
  satu(
    `SELECT uuid, kode_set, nama_set, metode_sterilisasi_default, masa_berlaku_steril_jam, status_aktif, created_at, updated_at
       FROM cssd_master_set WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
    [uuid, faskes],
  );

const instrumenMaster = (masterUuid) =>
  query(
    `SELECT uuid, nama_instrumen, jumlah, satuan FROM cssd_master_set_instrumen WHERE master_set_uuid = $1 ORDER BY urutan, nama_instrumen`,
    [masterUuid],
  );

const setFisikMaster = (masterUuid, faskes) =>
  query(
    `SELECT uuid, kode_set_fisik, kode_barcode, status, lokasi_tipe, lokasi_uuid, tanggal_kedaluwarsa_steril
       FROM cssd_set WHERE master_set_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY kode_set_fisik`,
    [masterUuid, faskes],
  );

const detailMaster = async (uuid, faskes) => {
  const m = await ambilMaster(uuid, faskes);
  if (!m) return null;
  const [instrumen, setFisik] = await Promise.all([instrumenMaster(uuid), setFisikMaster(uuid, faskes)]);
  return { ...m, instrumen, set_fisik: setFisik };
};

const validasiInstrumen = (daftar) => {
  if (!Array.isArray(daftar) || !daftar.length) throw permintaanSalah("instrumen wajib diisi minimal satu");
  return daftar.map((i, n) => {
    if (!teks(i?.nama_instrumen)) throw permintaanSalah("nama_instrumen setiap baris instrumen wajib diisi");
    const jumlah = angkaOpsional(i.jumlah, "jumlah") ?? 1;
    if (jumlah < 1) throw permintaanSalah("jumlah instrumen harus lebih dari 0");
    return { nama_instrumen: teks(i.nama_instrumen), jumlah, satuan: teks(i.satuan) || "pcs", urutan: n };
  });
};

const kolomMaster = (b) => ({
  kode_set: b.kode_set === undefined ? undefined : String(b.kode_set).trim().toUpperCase(),
  nama_set: teks(b.nama_set),
  metode_sterilisasi_default: b.metode_sterilisasi_default === undefined ? undefined : cekPilihan(b.metode_sterilisasi_default, METODE, "metode_sterilisasi_default"),
  masa_berlaku_steril_jam: (() => {
    const v = angkaOpsional(b.masa_berlaku_steril_jam, "masa_berlaku_steril_jam");
    if (v !== undefined && v !== null && v <= 0) throw permintaanSalah("masa_berlaku_steril_jam harus lebih dari 0");
    return v;
  })(),
  status_aktif: boolOpsional(b.status_aktif),
});

export const master = express.Router();

master.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "ms.faskes_uuid = $1 AND ms.deleted_at IS NULL";
    if (req.query.q) {
      p.push(`%${String(req.query.q).trim()}%`);
      w += ` AND (ms.kode_set ILIKE $${p.length} OR ms.nama_set ILIKE $${p.length})`;
    }
    if (req.query.status_aktif !== undefined && req.query.status_aktif !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status_aktif)));
      w += ` AND ms.status_aktif = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM cssd_master_set ms WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ms.uuid, ms.kode_set, ms.nama_set, ms.metode_sterilisasi_default, ms.masa_berlaku_steril_jam, ms.status_aktif,
              (SELECT COUNT(*) FROM cssd_master_set_instrumen i WHERE i.master_set_uuid = ms.uuid)::int AS jumlah_instrumen,
              (SELECT COUNT(*) FROM cssd_set s WHERE s.master_set_uuid = ms.uuid AND s.deleted_at IS NULL)::int AS jumlah_set_fisik
         FROM cssd_master_set ms WHERE ${w} ORDER BY ms.nama_set LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

master.get(
  "/:uuid",
  tangani(async (req, res) => {
    const m = await detailMaster(req.params.uuid, req.author.faskesUuid);
    if (!m) throw tidakDitemukan("Master set");
    kirim(res, m);
  }),
);

// Registrasi master set beserta set fisik pertama (kode_set_fisik & kode_barcode opsional pada langkah ini;
// bila diisi, satu set fisik langsung tercatat berbarcode sesuai alur utama langkah 1).
master.post(
  "/",
  izinCssd("Master Set & Mesin", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["kode_set", "nama_set"]);
    const instrumen = validasiInstrumen(b.instrumen);
    const data = Object.fromEntries(Object.entries(kolomMaster(b)).filter(([, v]) => v !== undefined));
    const faskes = req.author.faskesUuid;
    const m = await transaksi(async (k) => {
      const baru = await sisipkan(
        "cssd_master_set",
        { faskes_uuid: faskes, metode_sterilisasi_default: "autoklaf", masa_berlaku_steril_jam: 168, status_aktif: true, ...data },
        k,
      ).catch((e) => ramah(e, `Kode set ${b.kode_set} sudah dipakai`));
      for (const i of instrumen) await sisipkan("cssd_master_set_instrumen", { master_set_uuid: baru.uuid, ...i }, k);
      if (teks(b.kode_barcode)) {
        await sisipkan(
          "cssd_set",
          {
            faskes_uuid: faskes,
            master_set_uuid: baru.uuid,
            kode_set_fisik: teks(b.kode_set_fisik) || baru.kode_set,
            kode_barcode: teks(b.kode_barcode),
            status: "kotor",
            lokasi_tipe: "cssd",
          },
          k,
        ).catch((e) => ramah(e, `Barcode ${b.kode_barcode} sudah dipakai`));
      }
      return baru;
    });
    kirim(res, await detailMaster(m.uuid, faskes), "Master set berhasil ditambahkan");
  }),
);

master.put(
  "/:uuid",
  izinCssd("Master Set & Mesin", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    if (b.kode_set === "" || b.nama_set === "") throw permintaanSalah("kode_set dan nama_set tidak boleh kosong");
    const data = kolomMaster(b);
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const ada = await satu(`SELECT uuid FROM cssd_master_set WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes], k);
      if (!ada) throw tidakDitemukan("Master set");
      await ubah("cssd_master_set", req.params.uuid, faskes, data, k).catch((e) => ramah(e, `Kode set ${b.kode_set} sudah dipakai`));
      if (b.instrumen !== undefined) {
        const instrumen = validasiInstrumen(b.instrumen);
        await query(`DELETE FROM cssd_master_set_instrumen WHERE master_set_uuid = $1`, [req.params.uuid], k);
        for (const i of instrumen) await sisipkan("cssd_master_set_instrumen", { master_set_uuid: req.params.uuid, ...i }, k);
      }
    });
    kirim(res, await detailMaster(req.params.uuid, faskes), "Master set berhasil diperbarui");
  }),
);

// Tambah set fisik (barcode) baru di bawah master set yang sudah ada — mis. "Laparotomi 02", "03", dst.
master.post(
  "/:uuid/set",
  izinCssd("Master Set & Mesin", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["kode_barcode"]);
    const faskes = req.author.faskesUuid;
    const m = await ambilMaster(req.params.uuid, faskes);
    if (!m) throw tidakDitemukan("Master set");
    const s = await sisipkan(
      "cssd_set",
      {
        faskes_uuid: faskes,
        master_set_uuid: m.uuid,
        kode_set_fisik: teks(b.kode_set_fisik) || m.kode_set,
        kode_barcode: teks(b.kode_barcode),
        status: "kotor",
        lokasi_tipe: "cssd",
      },
    ).catch((e) => ramah(e, `Barcode ${b.kode_barcode} sudah dipakai`));
    kirim(res, s, "Set fisik berhasil ditambahkan");
  }),
);

// Data label barcode/QR untuk dicetak dari peramban (pola sama dengan label antrian/kuitansi).
master.get(
  "/:uuid/label",
  tangani(async (req, res) => {
    const m = await ambilMaster(req.params.uuid, req.author.faskesUuid);
    if (!m) throw tidakDitemukan("Master set");
    const target = req.query.set_uuid ? [await satu(`SELECT uuid, kode_set_fisik, kode_barcode FROM cssd_set WHERE uuid = $1 AND master_set_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL`, [req.query.set_uuid, m.uuid, req.author.faskesUuid])].filter(Boolean)
      : await query(`SELECT uuid, kode_set_fisik, kode_barcode FROM cssd_set WHERE master_set_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY kode_set_fisik`, [m.uuid, req.author.faskesUuid]);
    kirim(res, { nama_set: m.nama_set, label: target });
  }),
);

master.delete(
  "/:uuid",
  izinCssd("Master Set & Mesin", "DELETE"),
  tangani(async (req, res) => {
    const t = await ubah("cssd_master_set", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Master set");
    kirim(res, { uuid: t.uuid }, "Master set berhasil dihapus");
  }),
);

// ── Mesin sterilisasi ────────────────────────────────────────────────────────

const ambilMesin = (uuid, faskes) =>
  satu(`SELECT uuid, nama_mesin, nomor_seri, metode, status_aktif, created_at, updated_at FROM cssd_mesin WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskes]);

export const mesin = express.Router();

mesin.get(
  "/",
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.q) {
      p.push(`%${String(req.query.q).trim()}%`);
      w += ` AND (nama_mesin ILIKE $${p.length} OR nomor_seri ILIKE $${p.length})`;
    }
    if (req.query.metode) {
      p.push(cekPilihan(String(req.query.metode), METODE, "metode"));
      w += ` AND metode = $${p.length}`;
    }
    if (req.query.status_aktif !== undefined && req.query.status_aktif !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status_aktif)));
      w += ` AND status_aktif = $${p.length}`;
    }
    kirim(res, await query(`SELECT uuid, nama_mesin, nomor_seri, metode, status_aktif FROM cssd_mesin WHERE ${w} ORDER BY nama_mesin`, p));
  }),
);

mesin.get(
  "/:uuid",
  tangani(async (req, res) => {
    const m = await ambilMesin(req.params.uuid, req.author.faskesUuid);
    if (!m) throw tidakDitemukan("Mesin");
    kirim(res, m);
  }),
);

const kolomMesin = (b) => ({
  nama_mesin: teks(b.nama_mesin),
  nomor_seri: teks(b.nomor_seri),
  metode: b.metode === undefined ? undefined : cekPilihan(b.metode, METODE, "metode"),
  status_aktif: boolOpsional(b.status_aktif),
});

mesin.post(
  "/",
  izinCssd("Master Set & Mesin", "CREATE"),
  tangani(async (req, res) => {
    wajib(req.body ?? {}, ["nama_mesin", "metode"]);
    const data = Object.fromEntries(Object.entries(kolomMesin(req.body ?? {})).filter(([, v]) => v !== undefined));
    const m = await sisipkan("cssd_mesin", { faskes_uuid: req.author.faskesUuid, status_aktif: true, ...data }).catch((e) => ramah(e, `Nomor seri ${req.body?.nomor_seri} sudah dipakai`));
    kirim(res, await ambilMesin(m.uuid, req.author.faskesUuid), "Mesin berhasil ditambahkan");
  }),
);

mesin.put(
  "/:uuid",
  izinCssd("Master Set & Mesin", "UPDATE"),
  tangani(async (req, res) => {
    const data = kolomMesin(req.body ?? {});
    if (data.nama_mesin === "" || data.metode === "") throw permintaanSalah("nama_mesin dan metode tidak boleh kosong");
    const m = await ubah("cssd_mesin", req.params.uuid, req.author.faskesUuid, data).catch((e) => ramah(e, `Nomor seri ${req.body?.nomor_seri} sudah dipakai`));
    if (!m) throw tidakDitemukan("Mesin");
    kirim(res, await ambilMesin(m.uuid, req.author.faskesUuid), "Mesin berhasil diperbarui");
  }),
);

// Uji Bowie-Dick harian per mesin — satu hasil per mesin/tanggal; koreksi hari yang sama di-upsert.
mesin.post(
  "/:uuid/bowie-dick",
  izinCssd("Siklus Sterilisasi", "BOWIE DICK"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const m = await ambilMesin(req.params.uuid, faskes);
    if (!m) throw tidakDitemukan("Mesin");
    const b = req.body ?? {};
    wajib(b, ["hasil"]);
    const tanggal = tanggalValid(b.tanggal || hariIni(), "tanggal");
    const hasil = cekPilihan(b.hasil, { lulus: "Lulus", gagal: "Gagal" }, "hasil");
    const baris = await satu(
      `INSERT INTO cssd_bowie_dick (uuid, faskes_uuid, mesin_uuid, tanggal, hasil, petugas_uuid, catatan, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (mesin_uuid, tanggal) DO UPDATE SET hasil = EXCLUDED.hasil, petugas_uuid = EXCLUDED.petugas_uuid, catatan = EXCLUDED.catatan, updated_at = EXCLUDED.updated_at
       RETURNING uuid, mesin_uuid, tanggal, hasil, petugas_uuid, catatan`,
      [uuidv7(), faskes, m.uuid, tanggal, hasil, teks(b.petugas_uuid), teks(b.catatan), sekarang()],
    );
    kirim(res, baris, hasil === "gagal" ? "Uji Bowie-Dick gagal tercatat; mesin tidak boleh dipakai untuk load baru sampai uji berikutnya lulus" : "Uji Bowie-Dick tercatat");
  }),
);

mesin.get(
  "/:uuid/bowie-dick",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const m = await ambilMesin(req.params.uuid, faskes);
    if (!m) throw tidakDitemukan("Mesin");
    const p = [m.uuid];
    let w = "mesin_uuid = $1";
    if (req.query.dari) {
      p.push(tanggalValid(req.query.dari, "dari"));
      w += ` AND tanggal >= $${p.length}`;
    }
    if (req.query.sampai) {
      p.push(tanggalValid(req.query.sampai, "sampai"));
      w += ` AND tanggal <= $${p.length}`;
    }
    kirim(res, await query(`SELECT uuid, tanggal, hasil, petugas_uuid, catatan FROM cssd_bowie_dick WHERE ${w} ORDER BY tanggal DESC`, p));
  }),
);

// Hasil Bowie-Dick terbaru hari ini (dipakai validasi pembuatan load mesin autoklaf).
export const bowieDickHariIni = (mesinUuid, tanggal) => satu(`SELECT hasil FROM cssd_bowie_dick WHERE mesin_uuid = $1 AND tanggal = $2`, [mesinUuid, tanggal]);

export const referensiPilihan = () => ({ metode: pilihan(METODE) });
