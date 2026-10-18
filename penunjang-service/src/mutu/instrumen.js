import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah } from "../umum/respons.js";
import { izinMutu, wajibSalahSatu } from "../umum/izin.js";
import { barisImpor, boolOpsional, bulatOpsional, konflik, teks, teksWajib, validasiHierarkiImpor } from "./bersama.js";
import { ambilMilik, catatAudit, tanganiMutu } from "./dasar.js";
import { wajibFiturMutu } from "./fitur.js";

// Instrumen akreditasi milik faskes (KF-2/KT-1..3): instrumen → bab → standar → elemen penilaian. Sistem TIDAK
// menyediakan isi instrumen; faskes mengisi manual atau mengimpor CSV. Kode unik per induk (409 bila ganda).
//   GET/POST /instrumen, PUT/DELETE /instrumen/:uuid, GET /instrumen/:uuid/struktur, POST /instrumen/:uuid/impor
//   POST /instrumen/:uuid/bab, PUT/DELETE /bab/:uuid, POST /bab/:uuid/standar, PUT/DELETE /standar/:uuid,
//   POST /standar/:uuid/elemen, PUT/DELETE /elemen/:uuid
// Penghapusan lunak berantai ke anak; ditolak (409) bila elemen di bawahnya masih dipetakan ke dokumen aktif.
const rute = express.Router();
const MODUL = "Mutu & Akreditasi";
rute.use(["/instrumen", "/bab", "/standar", "/elemen"], wajibFiturMutu("mutu_dokumen_kredensial"));
const bolehBacaStruktur = wajibSalahSatu([MODUL, "Instrumen Akreditasi", "READ"], [MODUL, "Dokumen Akreditasi", "READ"]);

const urutan = (v) => bulatOpsional(v, "urutan", { min: 0, maks: 100000 });

// Jumlah pemetaan dokumen aktif untuk elemen-elemen di bawah simpul (instrumen/bab/standar/elemen).
const JALUR = {
  instrumen: `JOIN mutu_standar s ON s.uuid = e.standar_uuid JOIN mutu_bab b ON b.uuid = s.bab_uuid WHERE b.instrumen_uuid = $1`,
  bab: `JOIN mutu_standar s ON s.uuid = e.standar_uuid WHERE s.bab_uuid = $1`,
  standar: `WHERE e.standar_uuid = $1`,
  elemen: `WHERE e.uuid = $1`,
};
const cekTidakDipetakan = async (k, tingkat, uuid) => {
  const r = await satu(
    `SELECT COUNT(*) n FROM mutu_dokumen_elemen de JOIN mutu_dokumen d ON d.uuid = de.dokumen_uuid AND d.deleted_at IS NULL
      JOIN mutu_elemen_penilaian e ON e.uuid = de.elemen_uuid AND e.deleted_at IS NULL ${JALUR[tingkat]} AND de.deleted_at IS NULL`,
    [uuid],
    k,
  );
  if (Number(r.n) > 0) throw konflik(`Tidak dapat dihapus: ${r.n} pemetaan dokumen masih menunjuk elemen di bawahnya. Lepaskan pemetaan terlebih dahulu.`);
};

// Hapus lunak simpul beserta seluruh turunannya.
const hapusBerantai = async (k, tingkat, uuid, faskes) => {
  const n = sekarang();
  if (tingkat === "instrumen") {
    await k.query(`UPDATE mutu_elemen_penilaian SET deleted_at = $1 WHERE deleted_at IS NULL AND standar_uuid IN (SELECT s.uuid FROM mutu_standar s JOIN mutu_bab b ON b.uuid = s.bab_uuid WHERE b.instrumen_uuid = $2) AND faskes_uuid = $3`, [n, uuid, faskes]);
    await k.query(`UPDATE mutu_standar SET deleted_at = $1 WHERE deleted_at IS NULL AND bab_uuid IN (SELECT uuid FROM mutu_bab WHERE instrumen_uuid = $2) AND faskes_uuid = $3`, [n, uuid, faskes]);
    await k.query(`UPDATE mutu_bab SET deleted_at = $1 WHERE deleted_at IS NULL AND instrumen_uuid = $2 AND faskes_uuid = $3`, [n, uuid, faskes]);
  } else if (tingkat === "bab") {
    await k.query(`UPDATE mutu_elemen_penilaian SET deleted_at = $1 WHERE deleted_at IS NULL AND standar_uuid IN (SELECT uuid FROM mutu_standar WHERE bab_uuid = $2) AND faskes_uuid = $3`, [n, uuid, faskes]);
    await k.query(`UPDATE mutu_standar SET deleted_at = $1 WHERE deleted_at IS NULL AND bab_uuid = $2 AND faskes_uuid = $3`, [n, uuid, faskes]);
  } else if (tingkat === "standar") {
    await k.query(`UPDATE mutu_elemen_penilaian SET deleted_at = $1 WHERE deleted_at IS NULL AND standar_uuid = $2 AND faskes_uuid = $3`, [n, uuid, faskes]);
  }
};

// ── Instrumen
rute.get(
  "/instrumen",
  bolehBacaStruktur,
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const pg = halaman(req.query);
    const aktif = boolOpsional(req.query.aktif);
    const cari = teks(req.query.cari, "cari", 100);
    const syarat = [`i.faskes_uuid = $1`, `i.deleted_at IS NULL`];
    const p = [f];
    if (aktif !== undefined) syarat.push(`i.aktif = $${p.push(aktif)}`);
    if (cari) syarat.push(`(i.nama ILIKE $${p.push(`%${cari}%`)} OR i.kode ILIKE $${p.length})`);
    const where = syarat.join(" AND ");
    const total = (await satu(`SELECT COUNT(*) n FROM mutu_instrumen i WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT i.*,
         (SELECT COUNT(*) FROM mutu_bab b WHERE b.instrumen_uuid = i.uuid AND b.deleted_at IS NULL)::int AS jumlah_bab,
         (SELECT COUNT(*) FROM mutu_elemen_penilaian e JOIN mutu_standar s ON s.uuid = e.standar_uuid AND s.deleted_at IS NULL
            JOIN mutu_bab b ON b.uuid = s.bab_uuid AND b.deleted_at IS NULL WHERE b.instrumen_uuid = i.uuid AND e.deleted_at IS NULL)::int AS jumlah_elemen
       FROM mutu_instrumen i WHERE ${where} ORDER BY i.aktif DESC, i.nama LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, pg.limit, pg.offset],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/instrumen",
  izinMutu("Instrumen Akreditasi", "CREATE"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const data = {
      faskes_uuid: req.author.faskesUuid,
      kode: teks(b.kode, "kode", 50) ?? null,
      nama: teksWajib(b.nama, "nama", 255),
      periode: teks(b.periode, "periode", 50) ?? null,
      keterangan: teks(b.keterangan, "keterangan") ?? null,
      aktif: boolOpsional(b.aktif) ?? true,
    };
    const hasil = await transaksi(async (k) => {
      const row = await sisipkan("mutu_instrumen", data, k);
      await catatAudit(k, req, "instrumen", row.uuid, "buat", null, row);
      return row;
    });
    kirim(res, hasil, "Instrumen berhasil ditambahkan");
  }, "Kode instrumen sudah dipakai"),
);

rute.put(
  "/instrumen/:uuid",
  izinMutu("Instrumen Akreditasi", "UPDATE"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const perubahan = {
      kode: teks(b.kode, "kode", 50),
      nama: b.nama === undefined ? undefined : teksWajib(b.nama, "nama", 255),
      periode: teks(b.periode, "periode", 50),
      keterangan: teks(b.keterangan, "keterangan"),
      aktif: boolOpsional(b.aktif),
    };
    const hasil = await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_instrumen", req.params.uuid, req.author.faskesUuid, k, { nama: "Instrumen", kunci: true });
      const baru = await ubah("mutu_instrumen", lama.uuid, req.author.faskesUuid, perubahan, k);
      await catatAudit(k, req, "instrumen", lama.uuid, "ubah", lama, baru);
      return baru;
    });
    kirim(res, hasil, "Instrumen berhasil diperbarui");
  }, "Kode instrumen sudah dipakai"),
);

rute.get(
  "/instrumen/:uuid/struktur",
  bolehBacaStruktur,
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const instrumen = await ambilMilik("mutu_instrumen", req.params.uuid, f, undefined, { nama: "Instrumen" });
    const bab = await query(`SELECT uuid, kode, nama, urutan FROM mutu_bab WHERE instrumen_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY urutan, kode`, [instrumen.uuid, f]);
    const standar = await query(
      `SELECT s.uuid, s.bab_uuid, s.kode, s.nama, s.urutan FROM mutu_standar s JOIN mutu_bab b ON b.uuid = s.bab_uuid
        WHERE b.instrumen_uuid = $1 AND s.faskes_uuid = $2 AND s.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY s.urutan, s.kode`,
      [instrumen.uuid, f],
    );
    const elemen = await query(
      `SELECT e.uuid, e.standar_uuid, e.kode, e.uraian, e.urutan,
         EXISTS (SELECT 1 FROM mutu_dokumen_elemen de JOIN mutu_dokumen d ON d.uuid = de.dokumen_uuid
                  WHERE de.elemen_uuid = e.uuid AND de.deleted_at IS NULL AND d.deleted_at IS NULL AND d.status = 'disahkan') AS ada_bukti
       FROM mutu_elemen_penilaian e JOIN mutu_standar s ON s.uuid = e.standar_uuid JOIN mutu_bab b ON b.uuid = s.bab_uuid
       WHERE b.instrumen_uuid = $1 AND e.faskes_uuid = $2 AND e.deleted_at IS NULL AND s.deleted_at IS NULL AND b.deleted_at IS NULL
       ORDER BY e.urutan, e.kode`,
      [instrumen.uuid, f],
    );
    kirim(res, {
      instrumen,
      bab: bab.map((x) => ({
        ...x,
        standar: standar.filter((s) => s.bab_uuid === x.uuid).map((s) => ({ ...s, elemen: elemen.filter((e) => e.standar_uuid === s.uuid) })),
      })),
    });
  }),
);

rute.delete(
  "/instrumen/:uuid",
  izinMutu("Instrumen Akreditasi", "DELETE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_instrumen", req.params.uuid, f, k, { nama: "Instrumen", kunci: true });
      await cekTidakDipetakan(k, "instrumen", lama.uuid);
      await hapusBerantai(k, "instrumen", lama.uuid, f);
      await ubah("mutu_instrumen", lama.uuid, f, { deleted_at: sekarang() }, k);
      await catatAudit(k, req, "instrumen", lama.uuid, "hapus", lama, null);
    });
    kirim(res, { uuid: req.params.uuid }, "Instrumen berhasil dihapus");
  }),
);

// ── Bab, standar, elemen (anak dari induknya; kode unik per induk)
const TINGKAT = {
  bab: { tabel: "mutu_bab", induk: "instrumen", tabelInduk: "mutu_instrumen", fk: "instrumen_uuid", nama: "Bab", isi: "nama" },
  standar: { tabel: "mutu_standar", induk: "bab", tabelInduk: "mutu_bab", fk: "bab_uuid", nama: "Standar", isi: "nama" },
  elemen: { tabel: "mutu_elemen_penilaian", induk: "standar", tabelInduk: "mutu_standar", fk: "standar_uuid", nama: "Elemen penilaian", isi: "uraian" },
};
const NAMA_INDUK = { instrumen: "Instrumen", bab: "Bab", standar: "Standar" };
const isian = (t, b, baru) => ({
  kode: baru || b.kode !== undefined ? teksWajib(b.kode, "kode", 50) : undefined,
  [t.isi]: baru || b[t.isi] !== undefined ? teksWajib(b[t.isi], t.isi, t.isi === "uraian" ? 5000 : 255) : undefined,
  urutan: urutan(b.urutan),
});

for (const [tingkat, t] of Object.entries(TINGKAT)) {
  rute.post(
    `/${t.induk}/:uuid/${tingkat}`,
    izinMutu("Instrumen Akreditasi", "CREATE"),
    tanganiMutu(async (req, res) => {
      const f = req.author.faskesUuid;
      const data = isian(t, req.body ?? {}, true);
      const hasil = await transaksi(async (k) => {
        const induk = await ambilMilik(t.tabelInduk, req.params.uuid, f, k, { nama: NAMA_INDUK[t.induk] });
        const row = await sisipkan(t.tabel, { faskes_uuid: f, [t.fk]: induk.uuid, ...data, urutan: data.urutan ?? 0 }, k);
        await catatAudit(k, req, tingkat, row.uuid, "buat", null, row);
        return row;
      });
      kirim(res, hasil, `${t.nama} berhasil ditambahkan`);
    }, `Kode ${t.nama.toLowerCase()} sudah dipakai pada induk yang sama`),
  );

  rute.put(
    `/${tingkat}/:uuid`,
    izinMutu("Instrumen Akreditasi", "UPDATE"),
    tanganiMutu(async (req, res) => {
      const f = req.author.faskesUuid;
      const data = isian(t, req.body ?? {}, false);
      const hasil = await transaksi(async (k) => {
        const lama = await ambilMilik(t.tabel, req.params.uuid, f, k, { nama: t.nama, kunci: true });
        const baru = await ubah(t.tabel, lama.uuid, f, data, k);
        await catatAudit(k, req, tingkat, lama.uuid, "ubah", lama, baru);
        return baru;
      });
      kirim(res, hasil, `${t.nama} berhasil diperbarui`);
    }, `Kode ${t.nama.toLowerCase()} sudah dipakai pada induk yang sama`),
  );

  rute.delete(
    `/${tingkat}/:uuid`,
    izinMutu("Instrumen Akreditasi", "DELETE"),
    tanganiMutu(async (req, res) => {
      const f = req.author.faskesUuid;
      await transaksi(async (k) => {
        const lama = await ambilMilik(t.tabel, req.params.uuid, f, k, { nama: t.nama, kunci: true });
        await cekTidakDipetakan(k, tingkat, lama.uuid);
        await hapusBerantai(k, tingkat, lama.uuid, f);
        await ubah(t.tabel, lama.uuid, f, { deleted_at: sekarang() }, k);
        await catatAudit(k, req, tingkat, lama.uuid, "hapus", lama, null);
      });
      kirim(res, { uuid: req.params.uuid }, `${t.nama} berhasil dihapus`);
    }),
  );
}

// ── Impor CSV (KT-2): body { isi_csv, hanya_validasi? }. Baris tanpa bab/standar induk lengkap ditolak dan dilaporkan
// (nomor baris + alasan); baris valid disimpan dalam satu transaksi (bab/standar dengan kode yang sama dipakai ulang,
// elemen dengan kode yang sama diperbarui uraiannya). hanya_validasi = true → laporan saja, tanpa menyimpan.
rute.post(
  "/instrumen/:uuid/impor",
  izinMutu("Instrumen Akreditasi", "IMPORT"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const isi = req.body?.isi_csv;
    if (typeof isi !== "string" || !isi.trim()) throw permintaanSalah("isi_csv wajib berisi teks CSV");
    const baris = barisImpor(isi);
    const ditolak = validasiHierarkiImpor(baris);
    const nomorDitolak = new Set(ditolak.map((d) => d.baris));
    const valid = baris.map((r, i) => ({ ...r, nomor: i + 2 })).filter((r) => !nomorDitolak.has(r.nomor));
    const hanyaValidasi = boolOpsional(req.body?.hanya_validasi) === true;
    const ringkasan = { total_baris: baris.length, baris_valid: valid.length, bab: 0, standar: 0, elemen_baru: 0, elemen_diperbarui: 0, ditolak };
    if (hanyaValidasi || !valid.length) {
      await ambilMilik("mutu_instrumen", req.params.uuid, f, undefined, { nama: "Instrumen" });
      return kirim(res, { ...ringkasan, disimpan: false }, valid.length ? "Validasi impor selesai" : "Tidak ada baris valid untuk disimpan");
    }
    await transaksi(async (k) => {
      const instrumen = await ambilMilik("mutu_instrumen", req.params.uuid, f, k, { nama: "Instrumen", kunci: true });
      const babMap = new Map(
        (await query(`SELECT uuid, kode FROM mutu_bab WHERE instrumen_uuid = $1 AND deleted_at IS NULL`, [instrumen.uuid], k)).map((x) => [x.kode, x.uuid]),
      );
      const standarMap = new Map();
      const urut = { bab: babMap.size, standar: 0, elemen: 0 };
      for (const r of valid) {
        let babUuid = babMap.get(r.bab_kode);
        if (!babUuid) {
          babUuid = (await sisipkan("mutu_bab", { faskes_uuid: f, instrumen_uuid: instrumen.uuid, kode: r.bab_kode, nama: r.bab_nama, urutan: ++urut.bab }, k)).uuid;
          babMap.set(r.bab_kode, babUuid);
          ringkasan.bab++;
        }
        const kunciStandar = `${babUuid}|${r.standar_kode}`;
        let standarUuid = standarMap.get(kunciStandar);
        if (!standarUuid) {
          standarUuid = (await satu(`SELECT uuid FROM mutu_standar WHERE bab_uuid = $1 AND kode = $2 AND deleted_at IS NULL`, [babUuid, r.standar_kode], k))?.uuid;
          if (!standarUuid) {
            standarUuid = (await sisipkan("mutu_standar", { faskes_uuid: f, bab_uuid: babUuid, kode: r.standar_kode, nama: r.standar_nama, urutan: ++urut.standar }, k)).uuid;
            ringkasan.standar++;
          }
          standarMap.set(kunciStandar, standarUuid);
        }
        const elemen = await satu(`SELECT uuid, uraian FROM mutu_elemen_penilaian WHERE standar_uuid = $1 AND kode = $2 AND deleted_at IS NULL`, [standarUuid, r.elemen_kode], k);
        if (!elemen) {
          await sisipkan("mutu_elemen_penilaian", { faskes_uuid: f, standar_uuid: standarUuid, kode: r.elemen_kode, uraian: r.elemen_uraian, urutan: ++urut.elemen }, k);
          ringkasan.elemen_baru++;
        } else if (elemen.uraian !== r.elemen_uraian) {
          await ubah("mutu_elemen_penilaian", elemen.uuid, f, { uraian: r.elemen_uraian }, k);
          ringkasan.elemen_diperbarui++;
        }
      }
      await catatAudit(k, req, "instrumen", instrumen.uuid, "impor", null, { ...ringkasan, ditolak: ditolak.length });
    });
    kirim(res, { ...ringkasan, disimpan: true }, ditolak.length ? `Impor selesai, ${ditolak.length} baris ditolak` : "Impor instrumen berhasil");
  }),
);

export default rute;
