import express from "express";
import { query, satu, sisipkan, sekarang, transaksi, uuidv7 } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinLaundry } from "../umum/izin.js";
import { KATEGORI_LINEN, STATUS_BATCH, URUTAN_TAHAP, beratPositif, bulatPositif, cekPilihan, cekTransisiTahap, epochOpsional, periode, rincianUnik, teks } from "./bersama.js";
import { catatTransaksiStok } from "./stok.js";
import { cekUnitAlur, daftarKode, galatPosisi, jumlahDariKode, kunciUnitDariKode, kunciUnitRincian, normalKode, pindahkanUnit, statusSiklus } from "./unit-alur.js";

// Pemrosesan batch (UC-2): batch dibentuk dari rincian penerimaan terkonfirmasi berkategori sama (boleh lintas
// ruangan — KF-7), berat dicatat dalam kg terpisah dari jumlah unit. Tahapan pencucian → pengeringan →
// setrika/lipat berurutan; saat setrika/lipat selesai, linen masuk stok bersih laundry (sekali, di transaksi yang sama).
// Jenis per unit (STD-0030): unit kotor dipindai masuk batch (kode_unit, boleh tanpa rincian_asal — asal diturunkan
// dari unit); saat batch selesai seluruh unit batch masuk stok bersih dan siklus cucinya bertambah tepat satu.

export const rute = express.Router();

rute.get(
  "/batch",
  izinLaundry("Batch", "READ"),
  tangani(async (req, res) => {
    const { dari, sampai } = periode(req.query);
    const p = [req.author.faskesUuid];
    let w = "b.faskes_uuid = $1 AND b.deleted_at IS NULL";
    if (req.query.status) {
      p.push(cekPilihan(req.query.status, STATUS_BATCH, "status"));
      w += ` AND b.status = $${p.length}`;
    }
    if (req.query.kategori) {
      p.push(cekPilihan(req.query.kategori, KATEGORI_LINEN, "kategori"));
      w += ` AND b.kategori = $${p.length}`;
    }
    if (dari) {
      p.push(dari);
      w += ` AND b.waktu_mulai >= $${p.length}`;
    }
    if (sampai) {
      p.push(sampai);
      w += ` AND b.waktu_mulai <= $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT b.*,
                (SELECT COALESCE(json_agg(t ORDER BY array_position(ARRAY['pencucian','pengeringan','setrika_lipat']::varchar[], t.tahap)), '[]')
                   FROM laundry_batch_tahap t WHERE t.batch_uuid = b.uuid AND t.faskes_uuid = b.faskes_uuid AND t.deleted_at IS NULL) AS tahapan,
                (SELECT COALESCE(json_agg(json_build_object('uuid', a.uuid, 'rincian_penerimaan_uuid', a.rincian_penerimaan_uuid, 'jumlah_diproses', a.jumlah_diproses,
                          'jenis_linen_uuid', d.jenis_linen_uuid, 'nama_linen', j.nama, 'lokasi_uuid', pn.lokasi_uuid, 'nama_ruangan', l.name)), '[]')
                   FROM laundry_batch_asal a
                   JOIN laundry_penerimaan_rincian d ON d.uuid = a.rincian_penerimaan_uuid AND d.faskes_uuid = a.faskes_uuid
                   JOIN laundry_penerimaan pn ON pn.uuid = d.penerimaan_uuid AND pn.faskes_uuid = d.faskes_uuid
                   JOIN laundry_jenis_linen j ON j.uuid = d.jenis_linen_uuid AND j.faskes_uuid = d.faskes_uuid
                   LEFT JOIN lokasi l ON l.uuid = pn.lokasi_uuid AND l.faskes_uuid = pn.faskes_uuid
                  WHERE a.batch_uuid = b.uuid AND a.faskes_uuid = b.faskes_uuid AND a.deleted_at IS NULL) AS asal
           FROM laundry_batch b WHERE ${w} ORDER BY b.waktu_mulai DESC LIMIT 500`,
        p,
      ),
    );
  }),
);

rute.post(
  "/batch",
  izinLaundry("Batch", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["berat_kg"]);
    const kodeBatch = b.kode_unit === undefined || b.kode_unit === null ? null : daftarKode(b.kode_unit);
    if (!kodeBatch && (b.rincian_asal === undefined || b.rincian_asal === null)) throw permintaanSalah("rincian_asal atau kode_unit wajib diisi");
    const beratKg = beratPositif(b.berat_kg, "berat_kg");
    const waktuMulai = epochOpsional(b.waktu_mulai, "waktu_mulai", sekarang());
    const f = req.author.faskesUuid;
    // Unit hasil pindai dikelompokkan per rincian penerimaan asalnya (unit kotor selalu memegang rincian_uuid).
    const masukan = Array.isArray(b.rincian_asal) ? [...b.rincian_asal] : [];
    if (kodeBatch) {
      const peta = await query(
        `SELECT upper(p.nilai) AS nilai, u.kode_unit, u.rincian_uuid, u.lokasi_tipe, u.lokasi_uuid, u.status FROM laundry_unit_pengenal p
           JOIN laundry_unit u ON u.uuid = p.unit_uuid AND u.faskes_uuid = p.faskes_uuid AND u.deleted_at IS NULL
          WHERE p.faskes_uuid = $1 AND upper(p.nilai) = ANY($2::text[]) AND p.aktif AND p.deleted_at IS NULL`,
        [f, kodeBatch],
      );
      const ke = new Map(peta.map((r) => [r.nilai, r]));
      const takDikenal = kodeBatch.filter((x) => !ke.has(x));
      if (takDikenal.length) throw permintaanSalah(`Kode unit tidak dikenal: ${takDikenal.join(", ")}`);
      const grup = new Map();
      for (const x of kodeBatch) {
        const u = ke.get(x);
        if (u.lokasi_tipe !== "kotor" || !u.rincian_uuid) throw galatPosisi(u, "unit tidak berada di antrean cuci (kotor)");
        grup.set(u.rincian_uuid, [...(grup.get(u.rincian_uuid) ?? []), x]);
      }
      for (const [rincianUuid, kode] of grup) {
        if (masukan.some((m) => String(m?.rincian_penerimaan_uuid) === rincianUuid)) throw permintaanSalah("Rincian asal yang sama dikirim ganda (rincian_asal dan kode_unit)");
        masukan.push({ rincian_penerimaan_uuid: rincianUuid, kode_unit: kode });
      }
    }
    const asal = rincianUnik(masukan, "rincian_penerimaan_uuid", "Asal batch");
    const hasil = await transaksi(async (k) => {
      // Kunci rincian asal (urutan uuid tetap) agar dua batch bersamaan tidak memproses sisa yang sama dua kali.
      const refs = [];
      for (const x of asal) {
        const r = await satu(
          `SELECT d.* FROM laundry_penerimaan_rincian d JOIN laundry_penerimaan p ON p.uuid = d.penerimaan_uuid AND p.faskes_uuid = d.faskes_uuid
            WHERE d.uuid = $1 AND d.faskes_uuid = $2 AND p.status = 'selesai' AND d.deleted_at IS NULL AND p.deleted_at IS NULL FOR UPDATE OF d`,
          [String(x.rincian_penerimaan_uuid), f],
          k,
        );
        if (!r) throw permintaanSalah("Asal batch tidak valid atau penerimaan belum dikonfirmasi");
        // Rincian yang memegang unit kotor: yang masuk batch = unit hasil pindai, atau seluruh unit bila jumlahnya sama.
        const unitRincian = await kunciUnitRincian(k, f, "rincian_uuid", r.uuid, "kotor");
        let units = [];
        let jumlah;
        if (x.kode_unit !== undefined && x.kode_unit !== null) {
          if (!unitRincian.length) throw permintaanSalah("Rincian asal ini dihitung per jumlah atau unitnya sudah diproses; kode unit tidak dipakai");
          const kode = daftarKode(x.kode_unit);
          const milik = new Set(unitRincian.map((u) => u.uuid));
          units = await kunciUnitDariKode(k, f, kode);
          for (const u of units) if (!milik.has(u.uuid)) throw galatPosisi(u, "unit bukan antrean cuci rincian ini");
          cekUnitAlur(units, { lokasiTipe: "kotor", keterangan: "unit tidak berada di antrean cuci" });
          jumlah = jumlahDariKode(kode, x.jumlah_diproses, "jumlah_diproses");
        } else {
          jumlah = bulatPositif(x.jumlah_diproses, "jumlah_diproses");
          if (unitRincian.length && jumlah !== unitRincian.length)
            throw permintaanSalah(`Linen pada rincian ini dilacak per unit: pindai kode unit yang masuk batch (sebagian ${jumlah} dari ${unitRincian.length})`);
          units = unitRincian;
        }
        const total = await satu(
          `SELECT COALESCE(SUM(jumlah_diproses), 0)::numeric AS jumlah FROM laundry_batch_asal WHERE rincian_penerimaan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
          [r.uuid, f],
          k,
        );
        const sisa = Number(r.jumlah_diterima ?? 0) - Number(total.jumlah);
        if (jumlah > sisa) throw permintaanSalah(`Jumlah yang diproses melebihi sisa linen kotor yang belum dicuci (sisa ${sisa})`);
        refs.push({ ...r, jumlah, units });
      }
      if (new Set(refs.map((x) => x.kategori)).size !== 1) throw permintaanSalah("Kategori berbeda harus diproses dalam batch terpisah");
      const uuid = uuidv7();
      const batch = await sisipkan(
        "laundry_batch",
        {
          uuid,
          faskes_uuid: f,
          kode: teks(b.kode) ?? `LDR-${new Date(waktuMulai * 1000).toISOString().slice(0, 10).replace(/-/g, "")}-${uuid.slice(-6).toUpperCase()}`,
          status: "proses",
          kategori: refs[0].kategori,
          berat_kg: beratKg,
          waktu_mulai: waktuMulai,
          petugas_uuid: req.author.username,
          catatan: teks(b.catatan) ?? null,
        },
        k,
      );
      for (const x of refs) {
        await sisipkan("laundry_batch_asal", { faskes_uuid: f, batch_uuid: batch.uuid, rincian_penerimaan_uuid: x.uuid, jumlah_diproses: x.jumlah }, k);
        await pindahkanUnit(k, x.units, { lokasi_tipe: "batch", dokumen_uuid: batch.uuid }, { faskes: f, peristiwa: "masuk_batch", dokumenTipe: "batch", dokumenUuid: batch.uuid, pelaku: req.author.username, waktu: batch.created_at });
      }
      for (const tahap of URUTAN_TAHAP) await sisipkan("laundry_batch_tahap", { faskes_uuid: f, batch_uuid: batch.uuid, tahap, status: "belum" }, k);
      return batch;
    });
    kirim(res, hasil, "Batch laundry berhasil dibuat");
  }),
);

rute.patch(
  "/batch/:uuid/tahap/:tahap",
  izinLaundry("Batch", "UPDATE"),
  tangani(async (req, res) => {
    wajib(req.body, ["status"]);
    const f = req.author.faskesUuid;
    const tahap = String(req.params.tahap);
    const status = String(req.body.status);
    const hasil = await transaksi(async (k) => {
      const b = await satu(`SELECT * FROM laundry_batch WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!b) throw tidakDitemukan("Batch");
      if (b.status !== "proses") throw permintaanSalah("Batch sudah selesai");
      const tahapan = await query(`SELECT * FROM laundry_batch_tahap WHERE batch_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.uuid, f], k);
      const { selesaiBatch } = cekTransisiTahap(tahapan, tahap, status);
      const waktu = sekarang();
      const t = await satu(
        `UPDATE laundry_batch_tahap
            SET status = $1::varchar, waktu_mulai = COALESCE(waktu_mulai, $2::bigint),
                waktu_selesai = CASE WHEN $1::varchar = 'selesai' THEN $2::bigint ELSE NULL END,
                petugas_uuid = $3, catatan = COALESCE($4::text, catatan), updated_at = $2::bigint
          WHERE batch_uuid = $5 AND tahap = $6 AND faskes_uuid = $7 AND deleted_at IS NULL RETURNING *`,
        [status, waktu, req.author.username, teks(req.body.catatan) ?? null, b.uuid, tahap, f],
        k,
      );
      let batch = b;
      let unitSelesai = [];
      if (selesaiBatch) {
        // Unit dalam batch: opsional diverifikasi dengan hasil pindai (harus persis sama), lalu masuk stok bersih dan
        // siklus cuci +1. Batch terkunci (FOR UPDATE) & status "selesai" hanya sekali + indeks unik
        // laundry_unit_siklus_batch → siklus tidak mungkin bertambah dua kali untuk batch yang sama.
        const unitBatch = await kunciUnitRincian(k, f, "dokumen_uuid", b.uuid, "batch");
        if (req.body.kode_unit !== undefined && req.body.kode_unit !== null) {
          const kode = daftarKode(req.body.kode_unit);
          const ada = new Set(unitBatch.map((u) => normalKode(u.kode_unit)));
          const asing = kode.filter((x) => !ada.has(x));
          const kurang = unitBatch.filter((u) => !kode.includes(normalKode(u.kode_unit))).map((u) => u.kode_unit);
          if (asing.length || kurang.length) {
            const rinci = [asing.length ? `bukan bagian batch ini: ${asing.join(", ")}` : "", kurang.length ? `belum dipindai: ${kurang.join(", ")}` : ""];
            throw permintaanSalah(`Hasil pindai tidak cocok dengan isi batch — ${rinci.filter(Boolean).join("; ")}`);
          }
        }
        unitSelesai = await pindahkanUnit(k, unitBatch, { lokasi_tipe: "laundry", lokasi_uuid: null, dokumen_uuid: null, rincian_uuid: null, tambahSiklus: true }, {
          faskes: f,
          peristiwa: "selesai_cuci",
          dokumenTipe: "batch",
          dokumenUuid: b.uuid,
          pelaku: req.author.username,
          waktu,
        });
        batch = await satu(`UPDATE laundry_batch SET status = 'selesai', waktu_selesai = $1, updated_at = $1 WHERE uuid = $2 RETURNING *`, [waktu, b.uuid], k);
        // Linen bersih masuk stok laundry per jenis (jumlah unit dari asal batch).
        const perJenis = await query(
          `SELECT d.jenis_linen_uuid, SUM(a.jumlah_diproses)::numeric AS jumlah FROM laundry_batch_asal a
             JOIN laundry_penerimaan_rincian d ON d.uuid = a.rincian_penerimaan_uuid AND d.faskes_uuid = a.faskes_uuid
            WHERE a.batch_uuid = $1 AND a.faskes_uuid = $2 AND a.deleted_at IS NULL GROUP BY d.jenis_linen_uuid ORDER BY d.jenis_linen_uuid`,
          [b.uuid, f],
          k,
        );
        for (const x of perJenis)
          await catatTransaksiStok(k, {
            faskesUuid: f,
            lokasiTipe: "laundry",
            jenisLinenUuid: x.jenis_linen_uuid,
            sumberTipe: "batch_selesai",
            sumberUuid: b.uuid,
            arah: "masuk",
            jumlah: Number(x.jumlah),
            alasan: `Batch ${b.kode} selesai`,
            petugasUuid: req.author.username,
            waktuTransaksi: waktu,
          });
      }
      // Peringatan umur pakai (KT-17) untuk unit yang baru selesai dicuci.
      const unitPeringatan = unitSelesai
        .map((u) => ({ uuid: u.uuid, kode_unit: u.kode_unit, siklus_cuci: Number(u.siklus_cuci), batas_siklus: u.batas_siklus, status_siklus: statusSiklus(u.siklus_cuci, u.batas_siklus, u.peringatan_siklus) }))
        .filter((u) => u.status_siklus !== "normal");
      return { batch, tahap: t, unit_selesai: unitSelesai.length, unit_peringatan: unitPeringatan };
    });
    const pesan = hasil.batch.status === "selesai" ? "Batch selesai; linen bersih masuk stok laundry" : "Tahap batch berhasil diperbarui";
    kirim(res, hasil, hasil.unit_peringatan.length ? `${pesan}. ${hasil.unit_peringatan.length} unit mendekati/mencapai batas umur pakai` : pesan);
  }),
);

export default rute;
