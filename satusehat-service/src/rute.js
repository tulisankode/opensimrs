import express from "express";
import config from "./config.js";
import { query, satu } from "./db.js";
import { wajibLogin } from "./auth.js";
import { kredensialFaskes, sinkronRawatJalan, jalankanPekerja, ujiKoneksi } from "./sinkron.js";

const rute = express.Router();
const tangani = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    res.status(status).json({ message: error.message });
  });

rute.get("/health", (req, res) => res.json({ message: "OK", mode: config.mode, lingkungan: config.lingkungan }));

rute.use(wajibLogin);

// Ringkasan: konfigurasi + jumlah catatan per status
rute.get(
  "/status",
  tangani(async (req, res) => {
    const { faskesUuid } = req.author;
    const kred = await kredensialFaskes(faskesUuid);
    const jumlah = await query(
      `SELECT status, COUNT(*)::int AS total FROM satusehat_sinkron WHERE faskes_uuid = $1 GROUP BY status`,
      [faskesUuid]
    );
    const belumDiproses = await satu(
      `SELECT COUNT(*)::int AS total FROM rawat_jalans rj
       LEFT JOIN satusehat_sinkron s ON s.faskes_uuid = rj.faskes_uuid AND s.sumber = 'rawat_jalan' AND s.sumber_uuid = rj.uuid
       WHERE rj.faskes_uuid = $1 AND rj.deleted_at IS NULL AND rj.status_rj = 5 AND s.id IS NULL`,
      [faskesUuid]
    );
    res.json({
      message: "Data berhasil ditampilkan",
      payload: {
        mode: config.mode,
        lingkungan: config.lingkungan,
        aktif: kred.aktif,
        kredensialLengkap: !!(kred.clientId && kred.clientSecret && kred.orgId),
        organizationId: kred.orgId ?? null,
        pekerja: { aktif: config.pekerjaAktif, intervalMenit: config.pekerjaIntervalMenit, rentangHari: config.pekerjaRentangHari },
        jumlah: Object.fromEntries(jumlah.map((j) => [j.status, j.total])),
        belumDiproses: belumDiproses?.total ?? 0,
      },
    });
  })
);

rute.post(
  "/uji-koneksi",
  tangani(async (req, res) => {
    const hasil = await ujiKoneksi(req.author.faskesUuid);
    res.json({ message: "Koneksi SATUSEHAT berhasil", payload: hasil });
  })
);

// Daftar catatan sinkronisasi kunjungan rawat jalan (untuk halaman monitoring)
rute.get(
  "/sinkron",
  tangani(async (req, res) => {
    const { faskesUuid } = req.author;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const status = String(req.query.status ?? "");
    const cari = String(req.query.q ?? "").trim();

    const kondisi = [`rj.faskes_uuid = $1`, `rj.deleted_at IS NULL`, `rj.status_rj = 5`];
    const nilai = [faskesUuid];
    if (status === "belum") kondisi.push(`s.id IS NULL`);
    else if (status) {
      nilai.push(status);
      kondisi.push(`s.status = $${nilai.length}`);
    }
    if (cari) {
      nilai.push(`%${cari}%`);
      kondisi.push(`(p.name ILIKE $${nilai.length} OR rj.no_rm ILIKE $${nilai.length} OR rj.no_pelayanan ILIKE $${nilai.length})`);
    }
    const dari = `FROM rawat_jalans rj
      LEFT JOIN patients p ON p.uuid = rj.patient_uuid
      LEFT JOIN satusehat_sinkron s ON s.faskes_uuid = rj.faskes_uuid AND s.sumber = 'rawat_jalan' AND s.sumber_uuid = rj.uuid
      WHERE ${kondisi.join(" AND ")}`;

    const [total, data] = await Promise.all([
      satu(`SELECT COUNT(*)::int AS total ${dari}`, nilai),
      query(
        `SELECT rj.uuid, rj.no_pelayanan, rj.no_rm, p.name AS nama_pasien, rj.discharge_date,
                COALESCE(s.status, 'belum') AS status, s.encounter_id, s.percobaan, s.pesan, s.dikirim_at, s.updated_at
         ${dari} ORDER BY rj.discharge_date DESC NULLS LAST LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        nilai
      ),
    ]);
    res.json({ message: "Data berhasil ditampilkan", payload: data, pagination: { page, limit, total: total?.total ?? 0 } });
  })
);

rute.post(
  "/sinkron/rawat-jalan/:uuid",
  tangani(async (req, res) => {
    const hasil = await sinkronRawatJalan(req.author.faskesUuid, req.params.uuid);
    res.status(hasil.status === "terkirim" ? 200 : 422).json({
      message: hasil.status === "terkirim" ? "Kunjungan terkirim ke SATUSEHAT" : hasil.pesan,
      payload: hasil,
    });
  })
);

// Jalankan pengiriman otomatis sekarang untuk faskes pengguna
rute.post(
  "/pekerja/jalankan",
  tangani(async (req, res) => {
    const hasil = await jalankanPekerja(req.author.faskesUuid);
    res.json({ message: "Sinkronisasi selesai", payload: hasil[0] ?? { diproses: 0, terkirim: 0, gagal: 0 } });
  })
);

export default rute;
