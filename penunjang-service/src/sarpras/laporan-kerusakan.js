import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinSarpras, punyaIzin, wajibSalahSatu } from "../umum/izin.js";
import { nomorBaru } from "../umum/nomor.js";
import {
  PRIORITAS,
  STATUS_LAPORAN,
  angkaOpsional,
  boolOpsional,
  cekPilihan,
  epochOpsional,
  konflik,
  periode,
  teks,
  teksWajib,
  transisiLaporanSah,
  wajibPilihan,
  waktuRespons,
} from "./bersama.js";
import { NAMA_PEGAWAI, ambilAset, catatRiwayat, cekLokasi, cekPegawai } from "./dasar.js";
import { ambilBerkas, daftarBerkas, simpanBerkas } from "./berkas.js";
import { kurangiStokInventory } from "./inventory.js";
import { modulKatalogAktif } from "./fitur.js";

// Laporan kerusakan / work order perbaikan (KF-8–KF-11): lapor (status baru) → tugaskan teknisi (diproses, waktu
// respons tercatat) → dikerjakan (diproses ⇄ menunggu suku cadang, catat suku cadang) → tutup (selesai /
// tidak dapat diperbaiki). Setiap perubahan status mengunci baris laporan (SELECT … FOR UPDATE) di dalam transaksi
// sehingga dua permintaan bersamaan tidak dapat melompati urutan; transisi tidak sah → 409 tanpa mengubah status (KT-9).
const rute = express.Router();
const MODUL = "Sarana dan Prasarana (IPSRS)";

const PILIH = `w.*, a.kode_inventaris, a.nama AS nama_aset, a.kategori AS kategori_aset, a.status AS status_aset,
  l.name AS nama_lokasi_aset, lk.name AS nama_lokasi_kejadian, ${NAMA_PEGAWAI("pg")} AS nama_teknisi,
  (w.waktu_penugasan - w.waktu_laporan) AS waktu_respons, (w.waktu_selesai - w.waktu_laporan) AS waktu_penyelesaian`;
const DARI = `sarpras_laporan_kerusakan w
  JOIN sarpras_aset a ON a.uuid = w.aset_uuid AND a.faskes_uuid = w.faskes_uuid
  LEFT JOIN lokasi l ON l.uuid = a.lokasi_uuid AND l.faskes_uuid = a.faskes_uuid
  LEFT JOIN lokasi lk ON lk.uuid = w.lokasi_kejadian_uuid AND lk.faskes_uuid = w.faskes_uuid
  LEFT JOIN pegawai pg ON pg.uuid = w.teknisi_uuid AND pg.faskes_uuid = w.faskes_uuid`;

const ambilLaporan = async (uuid, faskesUuid, k, kunci = false) => {
  const w = await satu(
    `SELECT * FROM sarpras_laporan_kerusakan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`,
    [String(uuid), faskesUuid],
    k,
  );
  if (!w) throw tidakDitemukan("Laporan kerusakan");
  return w;
};

rute.get(
  "/",
  izinSarpras("Laporan Kerusakan", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const q = req.query;
    const p = [req.author.faskesUuid];
    let w = "w.faskes_uuid = $1 AND w.deleted_at IS NULL";
    const status = cekPilihan(q.status || undefined, { ...STATUS_LAPORAN, terbuka: "Terbuka" }, "status");
    if (status === "terbuka") w += ` AND w.status IN ('baru','diproses','menunggu_suku_cadang')`;
    else if (status) {
      p.push(status);
      w += ` AND w.status = $${p.length}`;
    }
    const prioritas = cekPilihan(q.prioritas || undefined, PRIORITAS, "prioritas");
    if (prioritas) {
      p.push(prioritas);
      w += ` AND w.prioritas = $${p.length}`;
    }
    for (const kol of ["aset_uuid", "teknisi_uuid"]) {
      if (q[kol]) {
        p.push(String(q[kol]));
        w += ` AND w.${kol} = $${p.length}`;
      }
    }
    const { mulai, selesai } = periode(q);
    if (mulai) {
      p.push(mulai);
      w += ` AND w.waktu_laporan >= $${p.length}`;
    }
    if (selesai) {
      p.push(selesai);
      w += ` AND w.waktu_laporan <= $${p.length}`;
    }
    if (q.cari) {
      p.push(`%${String(q.cari).trim()}%`);
      w += ` AND (w.nomor_laporan ILIKE $${p.length} OR a.nama ILIKE $${p.length} OR a.kode_inventaris ILIKE $${p.length} OR w.uraian ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM ${DARI} WHERE ${w}
        ORDER BY CASE w.status WHEN 'baru' THEN 0 WHEN 'diproses' THEN 1 WHEN 'menunggu_suku_cadang' THEN 2 ELSE 3 END,
                 CASE w.prioritas WHEN 'darurat' THEN 0 WHEN 'tinggi' THEN 1 WHEN 'sedang' THEN 2 ELSE 3 END, w.waktu_laporan DESC
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Detail + suku cadang (bila berizin Suku Cadang › READ) + metadata berkas (isi diambil lewat rute berkas berizin).
rute.get(
  "/:uuid",
  izinSarpras("Laporan Kerusakan", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const w = await satu(`SELECT ${PILIH} FROM ${DARI} WHERE w.uuid = $1 AND w.faskes_uuid = $2 AND w.deleted_at IS NULL`, [req.params.uuid, f]);
    if (!w) throw tidakDitemukan("Laporan kerusakan");
    const sukuCadang = (await punyaIzin(req, MODUL, "Suku Cadang", "READ"))
      ? await query(`SELECT * FROM sarpras_suku_cadang WHERE laporan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`, [w.uuid, f])
      : null;
    kirim(res, { ...w, suku_cadang: sukuCadang, berkas: await daftarBerkas("foto_kerusakan", w.uuid, f) });
  }),
);

rute.post(
  "/",
  izinSarpras("Laporan Kerusakan", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!b.aset_uuid) throw permintaanSalah("aset_uuid wajib diisi");
    const uraian = teksWajib(b.uraian, "uraian", 5000);
    const prioritas = wajibPilihan(b.prioritas, PRIORITAS, "prioritas");
    const n = sekarang();
    const waktuLaporan = epochOpsional(b.waktu_laporan, "waktu_laporan") ?? n;
    if (waktuLaporan > n + 300) throw permintaanSalah("waktu_laporan tidak boleh di masa depan");
    const pelaporNama = teks(b.pelapor_nama, "pelapor_nama", 255);
    const hasil = await transaksi(async (k) => {
      const aset = await ambilAset(b.aset_uuid, f, k, { bisaDikerjakan: true });
      const lokasiKejadian = b.lokasi_kejadian_uuid ? (await cekLokasi(b.lokasi_kejadian_uuid, f, k, "Lokasi kejadian")).uuid : null;
      const laporan = await sisipkan(
        "sarpras_laporan_kerusakan",
        {
          faskes_uuid: f,
          nomor_laporan: await nomorBaru(f, "WO", k),
          aset_uuid: aset.uuid,
          lokasi_kejadian_uuid: lokasiKejadian,
          uraian,
          prioritas,
          status: "baru",
          pelapor: req.author.username,
          pelapor_nama: pelaporNama ?? null,
          waktu_laporan: waktuLaporan,
        },
        k,
      );
      await catatRiwayat(k, f, aset.uuid, "kerusakan_dilaporkan", { laporan_uuid: laporan.uuid, nomor_laporan: laporan.nomor_laporan, prioritas }, req.author.username);
      return laporan;
    });
    kirim(res, hasil, "Laporan kerusakan berhasil dibuat");
  }),
);

// Penugasan teknisi (pegawai faskes) hanya dari status baru; waktu penugasan = dasar waktu respons (KT-8).
rute.patch(
  "/:uuid/tugaskan",
  izinSarpras("Laporan Kerusakan", "TUGASKAN"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!b.teknisi_uuid) throw permintaanSalah("teknisi_uuid wajib diisi");
    const prioritas = cekPilihan(b.prioritas, PRIORITAS, "prioritas");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (!transisiLaporanSah(lama.status, "diproses") || lama.status !== "baru") throw konflik(`Laporan berstatus ${STATUS_LAPORAN[lama.status]}; penugasan hanya untuk laporan baru`);
      const teknisi = await cekPegawai(b.teknisi_uuid, f, k, "Teknisi");
      const n = sekarang();
      const laporan = await ubah(
        "sarpras_laporan_kerusakan",
        lama.uuid,
        f,
        { teknisi_uuid: teknisi, prioritas: prioritas ?? lama.prioritas, waktu_penugasan: n, ditugaskan_oleh: req.author.username, status: "diproses" },
        k,
      );
      await catatRiwayat(
        k,
        f,
        lama.aset_uuid,
        "kerusakan_ditugaskan",
        { laporan_uuid: lama.uuid, teknisi_uuid: teknisi, prioritas: laporan.prioritas, waktu_respons: waktuRespons(lama.waktu_laporan, n) },
        req.author.username,
      );
      return laporan;
    });
    kirim(res, hasil, "Teknisi berhasil ditugaskan");
  }),
);

// Status pengerjaan: diproses ⇄ menunggu_suku_cadang (penutupan lewat /tutup).
rute.patch(
  "/:uuid/status",
  izinSarpras("Laporan Kerusakan", "UPDATE STATUS"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const status = wajibPilihan(b.status, STATUS_LAPORAN, "status");
    if (!["diproses", "menunggu_suku_cadang"].includes(status)) throw permintaanSalah("status hanya boleh diproses atau menunggu_suku_cadang; gunakan aksi Tutup untuk menyelesaikan laporan");
    const catatan = teks(b.catatan, "catatan", 2000);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (!transisiLaporanSah(lama.status, status) || lama.status === "baru")
        throw konflik(`Transisi status dari ${STATUS_LAPORAN[lama.status]} ke ${STATUS_LAPORAN[status]} tidak diperbolehkan`);
      const laporan = await ubah("sarpras_laporan_kerusakan", lama.uuid, f, { status }, k);
      await catatRiwayat(k, f, lama.aset_uuid, "status_kerusakan_diubah", { laporan_uuid: lama.uuid, status_sebelum: lama.status, status_sesudah: status, catatan }, req.author.username);
      return laporan;
    });
    kirim(res, hasil, "Status laporan berhasil diubah");
  }),
);

// Penutupan (KT-12): wajib tindakan; tidak dapat diperbaiki wajib alasan. Hanya dari diproses/menunggu suku cadang.
rute.post(
  "/:uuid/tutup",
  izinSarpras("Laporan Kerusakan", "TUTUP"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const status = wajibPilihan(b.status, STATUS_LAPORAN, "status");
    if (!["selesai", "tidak_dapat_diperbaiki"].includes(status)) throw permintaanSalah("status penutupan harus selesai atau tidak_dapat_diperbaiki");
    const tindakan = teksWajib(b.tindakan, "tindakan", 5000);
    const hasilKerja = teks(b.hasil, "hasil", 5000);
    const alasan = teks(b.alasan_tidak_dapat_diperbaiki, "alasan_tidak_dapat_diperbaiki", 2000);
    if (status === "tidak_dapat_diperbaiki" && !alasan) throw permintaanSalah("alasan_tidak_dapat_diperbaiki wajib diisi");
    const biaya = angkaOpsional(b.biaya, "biaya", { min: 0, maks: 999999999999 });
    const n = sekarang();
    const waktuSelesai = epochOpsional(b.waktu_selesai, "waktu_selesai") ?? n;
    if (waktuSelesai > n + 300) throw permintaanSalah("waktu_selesai tidak boleh di masa depan");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (!transisiLaporanSah(lama.status, status) || lama.status === "baru")
        throw konflik(lama.status === "baru" ? "Laporan belum ditugaskan ke teknisi" : `Laporan sudah berstatus ${STATUS_LAPORAN[lama.status]}`);
      if (waktuSelesai < Number(lama.waktu_laporan)) throw permintaanSalah("waktu_selesai tidak boleh sebelum waktu laporan");
      const laporan = await ubah(
        "sarpras_laporan_kerusakan",
        lama.uuid,
        f,
        { status, tindakan, hasil: hasilKerja ?? null, alasan_tidak_dapat_diperbaiki: status === "tidak_dapat_diperbaiki" ? alasan : null, biaya: biaya ?? null, waktu_selesai: waktuSelesai, ditutup_oleh: req.author.username },
        k,
      );
      await catatRiwayat(k, f, lama.aset_uuid, "kerusakan_selesai", { laporan_uuid: lama.uuid, nomor_laporan: lama.nomor_laporan, status, biaya: laporan.biaya }, req.author.username);
      return laporan;
    });
    kirim(res, hasil, "Laporan kerusakan berhasil ditutup");
  }),
);

// Suku cadang (KF-11): manual (nama barang bebas) atau mengurangi stok Gudang & Pengadaan bila kurangi_stok=true &
// modul inventory aktif. Baris suku cadang disisipkan di transaksi yang sama dengan panggilan stok/reduce dan baru
// di-commit setelah inventory berhasil; gagal → 502 & tidak ada baris tersimpan (KT-10). Tanpa inventory, pekerjaan
// tetap dapat dicatat tanpa transaksi stok (KT-11).
rute.post(
  "/:uuid/suku-cadang",
  izinSarpras("Suku Cadang", "CATAT PEMAKAIAN"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const namaBarang = teksWajib(b.nama_barang, "nama_barang", 255);
    const jumlah = angkaOpsional(b.jumlah, "jumlah", { min: 0, maks: 9999999 });
    if (!jumlah) throw permintaanSalah("jumlah wajib diisi dan lebih besar dari nol");
    const biaya = angkaOpsional(b.biaya, "biaya", { min: 0, maks: 999999999999 });
    const kurangiStok = boolOpsional(b.kurangi_stok) === true;
    if (kurangiStok) {
      for (const kol of ["item_uuid", "lokasi_stok_uuid", "jenis_stok_uuid"]) if (!teks(b[kol], kol, 255)) throw permintaanSalah(`${kol} wajib diisi untuk mengurangi stok`);
      if (!(await modulKatalogAktif("inventory", f))) throw permintaanSalah("Modul Gudang & Pengadaan tidak aktif; catat suku cadang tanpa pengurangan stok");
    }
    const hasil = await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (!["diproses", "menunggu_suku_cadang"].includes(lama.status)) throw konflik("Suku cadang hanya dapat dicatat untuk laporan yang sedang dikerjakan");
      const baris = await sisipkan(
        "sarpras_suku_cadang",
        {
          faskes_uuid: f,
          laporan_uuid: lama.uuid,
          nama_barang: namaBarang,
          jumlah,
          biaya: biaya ?? null,
          item_uuid: teks(b.item_uuid, "item_uuid", 255) ?? null,
          lokasi_stok_uuid: kurangiStok ? teks(b.lokasi_stok_uuid, "lokasi_stok_uuid", 255) : null,
          jenis_stok_uuid: kurangiStok ? teks(b.jenis_stok_uuid, "jenis_stok_uuid", 255) : null,
          dicatat_oleh: req.author.username,
        },
        k,
      );
      if (!kurangiStok) return baris;
      const referensi = await kurangiStokInventory({
        itemUuid: baris.item_uuid,
        jumlah,
        lokasiStokUuid: baris.lokasi_stok_uuid,
        jenisStokUuid: baris.jenis_stok_uuid,
        kodeReferensi: lama.nomor_laporan,
        keterangan: `Suku cadang ${namaBarang} untuk work order ${lama.nomor_laporan}`,
        token: req.author.token,
      });
      return ubah("sarpras_suku_cadang", baris.uuid, f, { referensi_transaksi_inventory: referensi }, k);
    });
    kirim(res, hasil, "Suku cadang berhasil dicatat");
  }),
);

rute.get(
  "/:uuid/suku-cadang",
  izinSarpras("Suku Cadang", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const w = await ambilLaporan(req.params.uuid, f);
    kirim(res, await query(`SELECT * FROM sarpras_suku_cadang WHERE laporan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`, [w.uuid, f]));
  }),
);

// Foto kerusakan: pelapor (CREATE) atau teknisi (UPDATE STATUS) boleh melampirkan.
rute.post(
  "/:uuid/berkas",
  wajibSalahSatu([MODUL, "Laporan Kerusakan", "CREATE"], [MODUL, "Laporan Kerusakan", "UPDATE STATUS"]),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const w = await ambilLaporan(req.params.uuid, f, k, true);
      return simpanBerkas(k, { faskesUuid: f, jenis: "foto_kerusakan", indukUuid: w.uuid, body: req.body ?? {}, pengguna: req.author.username });
    });
    kirim(res, hasil, "Foto kerusakan berhasil diunggah");
  }),
);

rute.get(
  "/:uuid/berkas/:berkasUuid",
  izinSarpras("Berkas", "READ"),
  tangani(async (req, res) => kirim(res, await ambilBerkas("foto_kerusakan", req.params.uuid, req.params.berkasUuid, req.author.faskesUuid))),
);

export default rute;
