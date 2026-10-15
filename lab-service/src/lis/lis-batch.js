import os from "node:os";
import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { buatRegistrasi, buatBodyBulk, tafsirBulk } from "./lis-peta.js";
import {
  GalatLis, koneksiUntukKirim, dataOrder, klaimKirim, selesaikanKirim, tandaiKlaimMacet, validasiOrderMcu, kirimOrderBatch,
  alasanTidakDikirim, statusBukanKlaim, tindakanBelumDipetakan, panggilLisBulk, tarikHasil, cekStatusOrder, BATAS_BULK,
} from "./lis-service.js";

// Kirim / ambil hasil / cek status LIS secara massal. Batch dibuat lalu diproses DI SERVER secara asinkron (endpoint
// langsung mengembalikan uuid batch; frontend memantau progres), sehingga ratusan order tidak kena timeout & browser
// boleh ditutup. Tahan restart: batch 'proses' yang detaknya berhenti diambil alih (oleh instans ini setelah restart atau
// instans lain); item yang sedang dikirim saat pemroses mati ditandai 'tidak_pasti' (bukan dikirim ulang otomatis).
//
// Anti kirim dobel berlapis:
//  1. klaim atomik per order di lab_lis_kirim (klaimKirim) — hanya status baru/gagal yang bisa diklaim;
//  2. satu batch hanya diproses satu pemroses (UPDATE … WHERE status/detak … RETURNING);
//  3. order yang sudah terkirim (ke koneksi mana pun) atau tidak pasti dilewati.

const q = (sql, bind = []) => sequelizeInstance.query(sql, { bind, type: QueryTypes.SELECT });
const exec = (sql, bind = []) => sequelizeInstance.query(sql, { bind });
const sekarang = () => Math.floor(Date.now() / 1000);
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

export const PEMROSES = `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const DETAK_MS = 10000;
const DETAK_MACET_DETIK = Number(process.env.LIS_BATCH_MACET_DETIK) || 60;
const MAKS_ITEM = 1000;
const MAKS_ULANG_OTOMATIS = 10; // kirim ulang otomatis sisa batch bulk setelah item bermasalah dikeluarkan
const sedangDiproses = new Set();

const JENIS = ["kirim", "hasil", "cek"];
const BERHASIL = ["terkirim", "diterima", "sebagian"];

// --- Pembuatan & pembacaan -------------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {string} p.faskesUuid
 * @param {string} p.pengguna
 * @param {'kirim'|'hasil'|'cek'} p.jenis
 * @param {Array<{order_lab_uuid, ref_uuid?}>} p.items
 */
export const buatBatch = async ({ faskesUuid, pengguna, sumber = "mcu", jenis = "kirim", items = [], koneksiUuid = null, opsi = {}, judul = null, indukUuid = null }) => {
  if (!JENIS.includes(jenis)) throw new GalatLis("Jenis batch harus kirim, hasil, atau cek");
  const unik = new Map();
  for (const it of items) {
    const o = String(it?.order_lab_uuid ?? "").trim();
    if (o && !unik.has(o)) unik.set(o, it?.ref_uuid ? String(it.ref_uuid) : null);
  }
  if (!unik.size) throw new GalatLis("Tidak ada order lab yang dapat diproses");
  if (unik.size > MAKS_ITEM) throw new GalatLis(`Maksimal ${MAKS_ITEM} order per batch`);
  const koneksi = jenis === "kirim" ? await koneksiUntukKirim(faskesUuid, koneksiUuid) : null;
  const t = sekarang();
  const batch = await sequelizeInstance.transaction(async (transaction) => {
    const [b] = await sequelizeInstance.query(
      `INSERT INTO lab_lis_batch (faskes_uuid, koneksi_uuid, sumber, jenis, mode_kirim, judul, opsi, induk_uuid, jumlah, status, dibuat_oleh, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 'antri', $10, $11, $11) RETURNING *`,
      {
        bind: [faskesUuid, koneksi?.uuid ?? null, sumber, jenis, koneksi?.mode_kirim ?? null, judul ? String(judul).slice(0, 255) : null,
          JSON.stringify({ periksa_now: opsi?.periksa_now !== false }), indukUuid, unik.size, pengguna ?? null, t],
        type: QueryTypes.SELECT,
        transaction,
      }
    );
    const orders = [...unik.keys()];
    await sequelizeInstance.query(
      `INSERT INTO lab_lis_batch_item (batch_uuid, order_lab_uuid, ref_uuid, urutan, updated_at)
       SELECT $1, o, r, i, $4 FROM unnest($2::varchar[], $3::varchar[]) WITH ORDINALITY AS x(o, r, i)`,
      { bind: [b.uuid, orders, orders.map((o) => unik.get(o)), t], transaction }
    );
    return b;
  });
  setImmediate(() => jalankan(batch.uuid).catch((e) => console.error("[LIS batch]", e)));
  return ringkasBatch(batch);
};

const ringkasBatch = (b) => ({
  uuid: b.uuid,
  sumber: b.sumber,
  jenis: b.jenis,
  mode_kirim: b.mode_kirim,
  judul: b.judul,
  opsi: b.opsi,
  induk_uuid: b.induk_uuid,
  jumlah: b.jumlah,
  berhasil: b.berhasil,
  gagal: b.gagal,
  dilewati: b.dilewati,
  tidak_pasti: b.tidak_pasti,
  diproses: b.berhasil + b.gagal + b.dilewati + b.tidak_pasti,
  status: b.status,
  pesan: b.pesan,
  lis: b.lis ?? null,
  dibuat_oleh: b.dibuat_oleh,
  created_at: b.created_at,
  updated_at: b.updated_at,
  selesai_pada: b.selesai_pada,
});

export const daftarBatch = async (faskesUuid, { sumber = "", page = 1, limit = 10 } = {}) => {
  const batas = Math.min(50, Math.max(1, Number(limit) || 10));
  const hal = Math.max(1, Number(page) || 1);
  const [total] = await q(`SELECT COUNT(*)::int AS n FROM lab_lis_batch WHERE faskes_uuid = $1 AND ($2 = '' OR sumber = $2)`, [faskesUuid, String(sumber ?? "")]);
  const rows = await q(
    `SELECT b.*, c.nama AS lis FROM lab_lis_batch b LEFT JOIN lab_lis_koneksi c ON c.uuid = b.koneksi_uuid
     WHERE b.faskes_uuid = $1 AND ($2 = '' OR b.sumber = $2) ORDER BY b.created_at DESC, b.id DESC LIMIT ${batas} OFFSET ${(hal - 1) * batas}`,
    [faskesUuid, String(sumber ?? "")]
  );
  return { data: rows.map(ringkasBatch), pagination: { page: hal, limit: batas, total: total?.n ?? 0 } };
};

export const detailBatch = async (faskesUuid, uuid, { denganItem = true } = {}) => {
  const [b] = await q(
    `SELECT b.*, c.nama AS lis FROM lab_lis_batch b LEFT JOIN lab_lis_koneksi c ON c.uuid = b.koneksi_uuid WHERE b.uuid::text = $1 AND b.faskes_uuid = $2`,
    [uuid, faskesUuid]
  );
  if (!b) throw new GalatLis("Batch LIS tidak ditemukan", 404);
  const hasil = ringkasBatch(b);
  if (!denganItem) return hasil;
  hasil.items = await q(
    `SELECT i.order_lab_uuid, i.ref_uuid, i.urutan, i.status, i.pesan, i.lis_no_lab, i.updated_at, o.no_order, o.no_rm, p.name AS nama_pasien
     FROM lab_lis_batch_item i LEFT JOIN order_lab o ON o.uuid = i.order_lab_uuid LEFT JOIN patients p ON p.uuid = o.patient_uuid
     WHERE i.batch_uuid = $1 ORDER BY (i.status = 'gagal') DESC, (i.status = 'tidak_pasti') DESC, i.urutan`,
    [b.uuid]
  );
  return hasil;
};

/** Hentikan batch: item yang belum diproses tetap 'antri' (bisa dikirim ulang lewat "Kirim Ulang yang Gagal"). */
export const hentikanBatch = async (faskesUuid, uuid) => {
  const rows = await q(
    `UPDATE lab_lis_batch SET status = 'dihentikan', pesan = 'Dihentikan petugas', updated_at = $3, selesai_pada = $3
     WHERE uuid::text = $1 AND faskes_uuid = $2 AND status IN ('antri', 'proses') RETURNING uuid`,
    [uuid, faskesUuid, sekarang()]
  );
  if (!rows.length) throw new GalatLis("Batch sudah selesai atau tidak ditemukan", 409);
  return detailBatch(faskesUuid, uuid, { denganItem: false });
};

/**
 * Item batch yang perlu diulang: kirim → item gagal / belum diproses (antri, mis. batch dihentikan); hasil → gagal/antri;
 * cek → masih tidak pasti. Order yang sudah terkirim / tidak pasti tetap dilewati saat diproses (klaim atomik).
 */
export const itemUlang = async (faskesUuid, uuid) => {
  const [b] = await q(`SELECT uuid, jenis, koneksi_uuid, sumber, judul, opsi, status FROM lab_lis_batch WHERE uuid::text = $1 AND faskes_uuid = $2`, [uuid, faskesUuid]);
  if (!b) throw new GalatLis("Batch LIS tidak ditemukan", 404);
  if (["antri", "proses"].includes(b.status)) throw new GalatLis("Batch masih berjalan — tunggu selesai atau hentikan dulu", 409);
  const status = b.jenis === "cek" ? ["tidak_pasti"] : ["gagal", "antri"];
  const items = await q(`SELECT order_lab_uuid, ref_uuid FROM lab_lis_batch_item WHERE batch_uuid = $1 AND status = ANY($2::varchar[]) ORDER BY urutan`, [b.uuid, status]);
  return { batch: b, items };
};

// --- Pemrosesan -----------------------------------------------------------------------------------------

const ambilAlih = async (uuid) => {
  const t = sekarang();
  const [b] = await q(
    `UPDATE lab_lis_batch SET status = 'proses', pemroses = $2, detak = $3, updated_at = $3
     WHERE uuid::text = $1 AND (status = 'antri' OR (status = 'proses' AND (pemroses = $2 OR detak IS NULL OR detak < $4)))
     RETURNING *`,
    [uuid, PEMROSES, t, t - DETAK_MACET_DETIK]
  );
  return b ?? null;
};

const masihBerjalan = async (uuid) => {
  const [b] = await q(`SELECT status, pemroses FROM lab_lis_batch WHERE uuid = $1`, [uuid]);
  return b?.status === "proses" && b?.pemroses === PEMROSES;
};

const catatItem = (batchUuid, orderUuid, { status, pesan, no_lab = null }) =>
  exec(`UPDATE lab_lis_batch_item SET status = $3, pesan = $4, lis_no_lab = COALESCE($5, lis_no_lab), updated_at = $6 WHERE batch_uuid = $1 AND order_lab_uuid = $2`, [
    batchUuid, orderUuid, status, pesan ? String(pesan).slice(0, 2000) : null, no_lab, sekarang(),
  ]);

const hitungUlang = (uuid) =>
  exec(
    `UPDATE lab_lis_batch b SET berhasil = x.berhasil, gagal = x.gagal, dilewati = x.dilewati, tidak_pasti = x.tidak_pasti, updated_at = $2
     FROM (SELECT COUNT(*) FILTER (WHERE status = ANY($3::varchar[]))::int AS berhasil, COUNT(*) FILTER (WHERE status = 'gagal')::int AS gagal,
                  COUNT(*) FILTER (WHERE status = 'dilewati')::int AS dilewati, COUNT(*) FILTER (WHERE status = 'tidak_pasti')::int AS tidak_pasti
           FROM lab_lis_batch_item WHERE batch_uuid = $1) x
     WHERE b.uuid = $1`,
    [uuid, sekarang(), BERHASIL]
  );

/** Proses satu batch sampai habis (aman dipanggil berulang; hanya satu pemroses yang mendapat batch). */
export const jalankan = async (uuid) => {
  if (sedangDiproses.has(uuid)) return;
  sedangDiproses.add(uuid);
  const detak = setInterval(() => {
    exec(`UPDATE lab_lis_batch SET detak = $2 WHERE uuid = $1 AND pemroses = $3 AND status = 'proses'`, [uuid, sekarang(), PEMROSES]).catch(() => {});
  }, DETAK_MS);
  try {
    const b = await ambilAlih(uuid);
    if (!b) return;
    // Diambil alih dari pemroses yang mati: order batch ini yang masih 'mengirim' milik pemroses lain → tidak pasti.
    await exec(
      `UPDATE lab_lis_kirim SET status = 'tidak_pasti', updated_at = $3,
              pesan = 'Pengiriman terputus (layanan berhenti/restart) sebelum respons LIS diterima — lakukan Cek Status sebelum mengirim ulang'
       WHERE batch_uuid = $1 AND status = 'mengirim' AND diklaim_oleh NOT LIKE $2`,
      [b.uuid, `${PEMROSES}%`, sekarang()]
    );
    await exec(`UPDATE lab_lis_batch_item SET status = 'antri' WHERE batch_uuid = $1 AND status = 'proses'`, [b.uuid]);
    const pengguna = b.dibuat_oleh;
    if (b.jenis === "kirim") {
      const koneksi = (await q(`SELECT * FROM lab_lis_koneksi WHERE uuid = $1 AND deleted_at IS NULL`, [b.koneksi_uuid]))[0];
      if (!koneksi?.aktif) {
        await exec(`UPDATE lab_lis_batch_item SET status = 'gagal', pesan = 'Koneksi LIS dihapus/nonaktif', updated_at = $2 WHERE batch_uuid = $1 AND status = 'antri'`, [b.uuid, sekarang()]);
      } else if (b.mode_kirim === "bulk") await prosesBulk(b, koneksi, pengguna);
      else await prosesPerOrder(b, koneksi, pengguna);
    } else {
      await prosesPerOrder(b, null, pengguna);
    }
    await hitungUlang(b.uuid);
    await exec(
      `UPDATE lab_lis_batch SET status = 'selesai', selesai_pada = $2, updated_at = $2 WHERE uuid = $1 AND status = 'proses' AND pemroses = $3`,
      [b.uuid, sekarang(), PEMROSES]
    );
  } catch (e) {
    console.error("[LIS batch]", uuid, e);
    // hentikan dengan pesan (item belum diproses tetap 'antri' → bisa "Kirim Ulang yang Gagal"), jangan diulang terus
    await exec(`UPDATE lab_lis_batch_item SET status = 'antri' WHERE batch_uuid::text = $1 AND status = 'proses'`, [uuid]).catch(() => {});
    await hitungUlang(uuid).catch(() => {});
    await exec(
      `UPDATE lab_lis_batch SET status = 'dihentikan', pesan = $2, updated_at = $3, selesai_pada = $3 WHERE uuid::text = $1 AND status = 'proses' AND pemroses = $4`,
      [uuid, `Galat pemroses: ${e.message}`.slice(0, 500), sekarang(), PEMROSES]
    ).catch(() => {});
  } finally {
    clearInterval(detak);
    sedangDiproses.delete(uuid);
  }
};

const itemAntri = (batchUuid, limit = 50) =>
  q(`SELECT order_lab_uuid FROM lab_lis_batch_item WHERE batch_uuid = $1 AND status = 'antri' ORDER BY urutan LIMIT ${limit}`, [batchUuid]);

// Order yang sudah terkirim / sedang dikirim / tidak pasti di koneksi LAIN tidak dikirim lagi oleh kirim massal.
const sudahDiKoneksiLain = async (faskesUuid, orderUuid, koneksiUuid) =>
  (
    await q(
      `SELECT k.status, k.lis_no_lab, c.nama FROM lab_lis_kirim k JOIN lab_lis_koneksi c ON c.uuid = k.koneksi_uuid
       WHERE k.faskes_uuid = $1 AND k.order_lab_uuid = $2 AND k.koneksi_uuid <> $3 AND k.status IN ('terkirim', 'mengirim', 'tidak_pasti') LIMIT 1`,
      [faskesUuid, orderUuid, koneksiUuid]
    )
  )[0];

// Mode per_order (dan ambil hasil / cek status): maks_paralel pekerja, masing-masing berjeda jeda_ms antar-request.
const prosesPerOrder = async (b, koneksi, pengguna) => {
  const paralel = b.jenis === "kirim" ? Math.max(1, koneksi.maks_paralel ?? 2) : 2;
  const jeda = koneksi?.jeda_ms ?? 0;
  const pemroses = `${PEMROSES}:${b.uuid}`;
  let antrean = [];
  let habis = false;
  const ambil = async () => {
    if (!antrean.length && !habis) {
      if (!(await masihBerjalan(b.uuid))) {
        habis = true;
        return null;
      }
      // tandai sementara agar pekerja lain tidak mengambil item yang sama
      antrean = (await itemAntri(b.uuid, 25)).map((r) => r.order_lab_uuid);
      if (!antrean.length) habis = true;
      else await exec(`UPDATE lab_lis_batch_item SET status = 'proses' WHERE batch_uuid = $1 AND order_lab_uuid = ANY($2::varchar[]) AND status = 'antri'`, [b.uuid, antrean]);
    }
    return antrean.shift() ?? null;
  };
  let kunci = Promise.resolve();
  const ambilBerurutan = () => (kunci = kunci.then(ambil, ambil));
  const pekerja = async () => {
    for (;;) {
      const orderUuid = await ambilBerurutan();
      if (!orderUuid) return;
      let hasil;
      try {
        if (b.jenis === "kirim") {
          const lain = await sudahDiKoneksiLain(b.faskes_uuid, orderUuid, koneksi.uuid);
          hasil = lain
            ? { status: "dilewati", pesan: `Sudah ${lain.status === "terkirim" ? "terkirim" : lain.status === "mengirim" ? "sedang dikirim" : "dikirim (status tidak pasti)"} ke ${lain.nama}` }
            : await kirimOrderBatch({ koneksi, faskesUuid: b.faskes_uuid, orderUuid, pemroses, batchUuid: b.uuid, pengguna });
        } else if (b.jenis === "hasil") {
          const r = await tarikHasil(b.faskes_uuid, orderUuid);
          hasil = { status: r.status === "sebagian" ? "sebagian" : "diterima", pesan: r.pesan };
        } else {
          hasil = await cekStatusOrder(b.faskes_uuid, orderUuid);
        }
      } catch (e) {
        hasil = { status: e?.status === 409 && b.jenis === "hasil" ? "dilewati" : "gagal", pesan: e.message };
      }
      await catatItem(b.uuid, orderUuid, hasil);
      await hitungUlang(b.uuid);
      if (jeda) await tidur(jeda);
    }
  };
  await Promise.all(Array.from({ length: paralel }, pekerja));
  // item yang sempat ditandai 'proses' tetapi batch dihentikan → kembali antri
  await exec(`UPDATE lab_lis_batch_item SET status = 'antri' WHERE batch_uuid = $1 AND status = 'proses'`, [b.uuid]);
};

// Mode bulk: kelompokkan per perusahaan & tanggal MCU (body bulk memuat satu nama/perusahaan), maksimal ukuran_batch
// item per request dan tanpa no_rm ganda dalam satu request (LIS menolak seluruh request bila ada no_rm duplikat).
const prosesBulk = async (b, koneksi, pengguna) => {
  const ukuran = Math.min(BATAS_BULK, Math.max(1, koneksi.ukuran_batch ?? 100));
  const pemroses = `${PEMROSES}:${b.uuid}`;
  const periksaNow = b.opsi?.periksa_now !== false;
  for (;;) {
    if (!(await masihBerjalan(b.uuid))) return;
    const antri = (await itemAntri(b.uuid, ukuran * 3)).map((r) => r.order_lab_uuid);
    if (!antri.length) return;
    // siapkan & klaim: order bermasalah diputus lokal agar tidak menggagalkan satu request bulk
    const siap = [];
    for (const orderUuid of antri) {
      let order;
      try {
        order = await dataOrder(b.faskes_uuid, orderUuid);
      } catch (e) {
        await catatItem(b.uuid, orderUuid, { status: "gagal", pesan: e.message });
        continue;
      }
      const cegah = alasanTidakDikirim(order);
      if (cegah) {
        await catatItem(b.uuid, orderUuid, cegah);
        continue;
      }
      const belum = tindakanBelumDipetakan(order);
      if (belum.length) {
        await catatItem(b.uuid, orderUuid, { status: "gagal", pesan: `Data Tindakan ${belum.join(", ")} Belum Dimappingkan (Kode Tindakan LIS kosong di Mapping LIS › Tindakan)` });
        continue;
      }
      const lain = await sudahDiKoneksiLain(b.faskes_uuid, orderUuid, koneksi.uuid);
      if (lain) {
        await catatItem(b.uuid, orderUuid, { status: "dilewati", pesan: `Sudah ${lain.status === "terkirim" ? "terkirim" : "dikirim"} ke ${lain.nama}` });
        continue;
      }
      siap.push({ orderUuid, order, body: buatRegistrasi(order, koneksi) });
    }
    // kelompok per perusahaan + tanggal, pecah per ukuran & tanpa no_rm ganda
    const grup = new Map();
    for (const s of siap) {
      const perusahaan = s.order.mcu?.perusahaan ?? "Perorangan";
      const tanggal = s.order.mcu?.tanggal ?? new Date().toISOString().slice(0, 10);
      const kunci = `${perusahaan}|${tanggal}`;
      if (!grup.has(kunci)) grup.set(kunci, { perusahaan, tanggal, item: [] });
      grup.get(kunci).item.push(s);
    }
    for (const g of grup.values()) {
      const potongan = [];
      for (const s of g.item) {
        const rm = String(s.body.pasien.no_rm);
        let p = potongan.find((x) => x.length < ukuran && !x.some((y) => String(y.body.pasien.no_rm) === rm));
        if (!p) potongan.push((p = []));
        p.push(s);
      }
      for (const p of potongan) {
        if (!(await masihBerjalan(b.uuid))) {
          return;
        }
        await kirimPotonganBulk({ b, koneksi, pengguna, pemroses, periksaNow, perusahaan: g.perusahaan, tanggal: g.tanggal, potongan: p });
        await hitungUlang(b.uuid);
        if (koneksi.jeda_ms) await tidur(koneksi.jeda_ms);
      }
    }
  }
};

const kirimPotonganBulk = async ({ b, koneksi, pengguna, pemroses, periksaNow, perusahaan, tanggal, potongan }) => {
  // klaim atomik per order; yang tidak terklaim (terkirim / sedang dikirim proses lain / tidak pasti) dilewati
  let sisa = [];
  for (const s of potongan) {
    const kirimUuid = await klaimKirim({
      faskesUuid: b.faskes_uuid, koneksiUuid: koneksi.uuid, orderUuid: s.orderUuid, noRegistrasi: s.body.registrasi.no_registrasi, pemroses, batchUuid: b.uuid,
    });
    if (!kirimUuid) await catatItem(b.uuid, s.orderUuid, await statusBukanKlaim(b.faskes_uuid, s.orderUuid, koneksi.uuid));
    else sisa.push({ ...s, kirimUuid });
  }
  const selesai = async (s, h, respons, body) => {
    await selesaikanKirim({ kirimUuid: s.kirimUuid, pemroses, status: h.status, pesan: h.pesan, noLab: h.no_lab, permintaan: body, respons, pengguna });
    if (h.status === "terkirim") await validasiOrderMcu(b.faskes_uuid, s.order);
    await catatItem(b.uuid, s.orderUuid, h);
  };
  for (let putaran = 1; sisa.length; putaran++) {
    if (putaran > MAKS_ULANG_OTOMATIS) {
      for (const s of sisa) await selesai(s, { status: "gagal", pesan: `Batas ${MAKS_ULANG_OTOMATIS}x kirim ulang otomatis tercapai — kirim ulang manual` }, null, null);
      return;
    }
    // perpanjang klaim (request bulk bisa lama) agar tidak dianggap macet
    await exec(`UPDATE lab_lis_kirim SET diklaim_pada = $2 WHERE uuid = ANY($1::uuid[]) AND diklaim_oleh = $3 AND status = 'mengirim'`, [
      sisa.map((s) => s.kirimUuid), sekarang(), pemroses,
    ]);
    const body = buatBodyBulk({ periksaNow, nama: `MCU ${perusahaan} ${tanggal}`, perusahaan, data: sisa.map((s) => s.body) });
    const r = await panggilLisBulk(koneksi, body);
    const t = tafsirBulk(
      r,
      sisa.map((s) => ({ no_registrasi: s.body.registrasi.no_registrasi, no_rm: s.body.pasien.no_rm, kode_tindakan: s.body.tindakan.map((x) => x.kode_tindakan) }))
    );
    const ringkasRespons = { http: r.status, ...(r.json ?? {}) };
    if (t.jenis !== "sebagian") {
      for (let i = 0; i < sisa.length; i++) await selesai(sisa[i], t.hasil[i], ringkasRespons, sisa[i].body);
      return;
    }
    // LIS menolak seluruh request karena item tertentu: keluarkan item tsb (gagal), kirim ulang sisanya otomatis
    const lanjut = [];
    for (let i = 0; i < sisa.length; i++) {
      if (t.hasil[i]) await selesai(sisa[i], { ...t.hasil[i], pesan: `${t.hasil[i].pesan} (dikeluarkan dari batch; item lain dikirim ulang otomatis)` }, ringkasRespons, sisa[i].body);
      else lanjut.push(sisa[i]);
    }
    sisa = lanjut;
    await hitungUlang(b.uuid);
  }
};

// --- Pemulihan setelah restart / pemroses mati -----------------------------------------------------------

let pemantau = null;
export const mulaiPemantauBatch = () => {
  if (pemantau) return;
  const putar = async () => {
    try {
      await tandaiKlaimMacet();
      const rows = await q(
        `SELECT uuid FROM lab_lis_batch WHERE status = 'antri' OR (status = 'proses' AND (detak IS NULL OR detak < $1)) ORDER BY created_at LIMIT 10`,
        [sekarang() - DETAK_MACET_DETIK]
      );
      for (const r of rows) jalankan(r.uuid).catch((e) => console.error("[LIS batch]", e));
    } catch (e) {
      if (!/does not exist/.test(String(e?.message))) console.error("[LIS batch] pemantau:", e.message);
    }
  };
  setTimeout(putar, 5000);
  pemantau = setInterval(putar, 30000);
  pemantau.unref?.();
};
