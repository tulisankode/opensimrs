import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { STATUS_PERMINTAAN, cekPilihan, ramah, teks, angkaOpsional } from "./bersama.js";
import { izinCssd } from "../umum/izin.js";
import { cariKunjungan, pasien } from "../umum/kunjungan.js";

// Penyimpanan & distribusi: stok set layak per lokasi, permintaan unit, serah terima distribusi/konfirmasi,
// dan pencatatan pemakaian pada pasien (set tidak layak/kedaluwarsa/belum di CSSD ditolak backend — KF-17).

export const rute = express.Router();

// Stok = set berstatus layak, belum kedaluwarsa, per lokasi saat ini (bukan tabel stok terpisah — aturan bisnis #7).
rute.get(
  "/stok",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const p = [faskes, sekarang()];
    let w = "s.faskes_uuid = $1 AND s.status = 'layak' AND (s.tanggal_kedaluwarsa_steril IS NULL OR s.tanggal_kedaluwarsa_steril > $2) AND s.deleted_at IS NULL";
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND s.lokasi_uuid = $${p.length}`;
    }
    if (req.query.master_set_uuid) {
      p.push(String(req.query.master_set_uuid));
      w += ` AND s.master_set_uuid = $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT s.lokasi_tipe, s.lokasi_uuid, s.master_set_uuid, ms.nama_set, COUNT(*)::int AS jumlah
           FROM cssd_set s JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid
          WHERE ${w} GROUP BY s.lokasi_tipe, s.lokasi_uuid, s.master_set_uuid, ms.nama_set ORDER BY ms.nama_set`,
        p,
      ),
    );
  }),
);

// ── Permintaan unit ────────────────────────────────────────────────────────────

rute.get(
  "/permintaan",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "pm.faskes_uuid = $1";
    if (req.query.unit_uuid) {
      p.push(String(req.query.unit_uuid));
      w += ` AND pm.unit_uuid = $${p.length}`;
    }
    if (req.query.status) {
      p.push(cekPilihan(req.query.status, STATUS_PERMINTAAN, "status"));
      w += ` AND pm.status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM cssd_permintaan pm WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT pm.uuid, pm.unit_uuid, pm.master_set_uuid, ms.nama_set, pm.jumlah, pm.status, pm.alasan_penolakan, pm.waktu_permintaan, pm.waktu_selesai
         FROM cssd_permintaan pm JOIN cssd_master_set ms ON ms.uuid = pm.master_set_uuid
        WHERE ${w} ORDER BY pm.waktu_permintaan DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/permintaan",
  izinCssd("Penyimpanan & Distribusi", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["unit_uuid", "master_set_uuid", "jumlah"]);
    const jumlah = angkaOpsional(b.jumlah, "jumlah");
    if (!jumlah || jumlah < 1) throw permintaanSalah("jumlah harus lebih dari 0");
    const ms = await satu(`SELECT uuid FROM cssd_master_set WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.master_set_uuid, faskes]);
    if (!ms) throw tidakDitemukan("Master set");
    // Permintaan tidak mengurangi stok sampai serah terima tercatat (aturan bisnis & KF-18).
    const p = await sisipkan("cssd_permintaan", {
      faskes_uuid: faskes,
      unit_uuid: teks(b.unit_uuid),
      master_set_uuid: ms.uuid,
      jumlah,
      status: "menunggu",
      petugas_uuid: teks(b.petugas_uuid),
      waktu_permintaan: sekarang(),
    });
    kirim(res, p, "Permintaan tercatat, menunggu diproses CSSD");
  }),
);

rute.put(
  "/permintaan/:uuid",
  izinCssd("Penyimpanan & Distribusi", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const status = cekPilihan(req.body?.status, STATUS_PERMINTAAN, "status");
    if (!status || status === "menunggu") throw permintaanSalah("status wajib diisi: disetujui, ditolak, atau selesai");
    if (status === "ditolak" && !teks(req.body?.alasan_penolakan)) throw permintaanSalah("alasan_penolakan wajib diisi bila status ditolak");
    const selesai = ["ditolak", "selesai"].includes(status) ? sekarang() : null;
    const p = await satu(
      `UPDATE cssd_permintaan SET status = $1, alasan_penolakan = $2, waktu_selesai = $3, updated_at = $4
        WHERE uuid = $5 AND faskes_uuid = $6 RETURNING uuid, status, alasan_penolakan`,
      [status, teks(req.body?.alasan_penolakan), selesai, sekarang(), req.params.uuid, faskes],
    );
    if (!p) throw tidakDitemukan("Permintaan");
    kirim(res, p, "Permintaan diperbarui");
  }),
);

// ── Serah terima distribusi & konfirmasi ────────────────────────────────────────

rute.post(
  "/distribusi",
  izinCssd("Penyimpanan & Distribusi", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["unit_tujuan_uuid"]);
    const setUuid = Array.isArray(b.set_uuid) ? [...new Set(b.set_uuid.filter(Boolean))] : [];
    if (!setUuid.length) throw permintaanSalah("set_uuid wajib diisi minimal satu set");
    const waktu = Number(b.waktu) || sekarang();

    const hasil = await transaksi(async (k) => {
      const set = await query(
        `SELECT uuid, status, lokasi_tipe, tanggal_kedaluwarsa_steril FROM cssd_set WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`,
        [setUuid, faskes],
        k,
      );
      if (set.length !== setUuid.length) throw permintaanSalah("Sebagian set tidak ditemukan");
      const tidakLayak = set.filter((s) => s.status !== "layak" || s.lokasi_tipe !== "cssd" || (s.tanggal_kedaluwarsa_steril && s.tanggal_kedaluwarsa_steril <= waktu));
      if (tidakLayak.length) throw permintaanSalah(`Set berikut tidak layak/kedaluwarsa/tidak berada di CSSD: ${tidakLayak.map((s) => s.uuid).join(", ")}`);

      const serah = [];
      for (const s of set) {
        serah.push(
          await sisipkan(
            "cssd_serah_terima",
            {
              faskes_uuid: faskes,
              set_uuid: s.uuid,
              jenis: "distribusi",
              unit_tujuan_uuid: teks(b.unit_tujuan_uuid),
              kondisi: "baik",
              permintaan_uuid: teks(b.permintaan_uuid),
              petugas_serah_uuid: teks(b.petugas_serah_uuid),
              petugas_terima_uuid: teks(b.petugas_terima_uuid),
              waktu,
            },
            k,
          ),
        );
      }
      await query(`UPDATE cssd_set SET lokasi_tipe = 'unit', lokasi_uuid = $2, updated_at = $3 WHERE uuid = ANY($1)`, [setUuid, teks(b.unit_tujuan_uuid), sekarang()], k);
      if (b.permintaan_uuid) {
        await query(`UPDATE cssd_permintaan SET status = 'selesai', waktu_selesai = $2, updated_at = $2 WHERE uuid = $1 AND faskes_uuid = $3`, [b.permintaan_uuid, sekarang(), faskes], k);
      }
      return serah;
    });
    kirim(res, hasil, "Serah terima distribusi tercatat");
  }),
);

rute.post(
  "/distribusi/:uuid/konfirmasi",
  izinCssd("Penyimpanan & Distribusi", "KONFIRMASI"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const s = await satu(
      `UPDATE cssd_serah_terima SET dikonfirmasi_oleh = $1, dikonfirmasi_pada = $2, catatan_konfirmasi = $3
        WHERE uuid = $4 AND faskes_uuid = $5 AND jenis = 'distribusi' RETURNING uuid, set_uuid, dikonfirmasi_oleh, dikonfirmasi_pada`,
      [teks(b.petugas_terima_uuid), Number(b.waktu) || sekarang(), teks(b.catatan), req.params.uuid, faskes],
    );
    if (!s) throw tidakDitemukan("Serah terima distribusi");
    kirim(res, s, "Penerimaan unit tercatat");
  }),
);

// ── Pemakaian pada pasien ────────────────────────────────────────────────────

rute.post(
  "/pemakaian",
  izinCssd("Pemakaian Pasien", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["unit_uuid", "nama_tindakan"]);

    // Rujukan pasien/kunjungan wajib diverifikasi terhadap akses & faskes pengguna (KF-20, G5).
    let pasienUuid = teks(b.pasien_uuid);
    let kunjunganUuid = null;
    if (b.no_reg) {
      const kj = await cariKunjungan(String(b.no_reg).trim(), faskes);
      if (!kj) throw permintaanSalah("Kunjungan tidak ditemukan untuk no_reg tersebut");
      pasienUuid = kj.patient_uuid;
      kunjunganUuid = kj.uuid;
    } else if (pasienUuid) {
      const p = await pasien(pasienUuid, faskes);
      if (!p) throw permintaanSalah("Pasien tidak ditemukan pada faskes ini");
    } else {
      throw permintaanSalah("no_reg atau pasien_uuid wajib diisi untuk mencatat pemakaian");
    }

    const waktu = Number(b.waktu_pakai) || sekarang();
    const hasil = await transaksi(async (k) => {
      const s = await satu(
        `SELECT uuid, status, lokasi_tipe, tanggal_kedaluwarsa_steril, load_terakhir_uuid FROM cssd_set
          WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`,
        [b.set_uuid, faskes],
        k,
      );
      if (!s) throw tidakDitemukan("Set");
      if (s.status !== "layak" || (s.tanggal_kedaluwarsa_steril && s.tanggal_kedaluwarsa_steril <= waktu)) {
        throw permintaanSalah("Set tidak layak atau sudah kedaluwarsa; tidak dapat dicatat sebagai pemakaian");
      }
      const p = await sisipkan(
        "cssd_pemakaian",
        {
          faskes_uuid: faskes,
          set_uuid: s.uuid,
          load_asal_uuid: s.load_terakhir_uuid,
          kunjungan_uuid: kunjunganUuid,
          pasien_uuid: pasienUuid,
          nama_tindakan: teks(b.nama_tindakan),
          unit_uuid: teks(b.unit_uuid),
          waktu_pakai: waktu,
          petugas_uuid: teks(b.petugas_uuid),
          catatan: teks(b.catatan),
        },
        k,
      );
      // Set yang sudah dipakai kembali menjadi kotor (siklus berulang dari penerimaan alat kotor — alur utama #11).
      await query(`UPDATE cssd_set SET status = 'kotor', updated_at = $2 WHERE uuid = $1`, [s.uuid, sekarang()], k);
      return p;
    });
    kirim(res, hasil, "Pemakaian set pada pasien tercatat");
  }),
);
