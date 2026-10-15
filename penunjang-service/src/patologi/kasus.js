import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { FIKSASI, HARI, JENIS, STATUS_ITEM, daftarNilai, epoch, icdoMorfologi, icdoTopografi, nomorPa, rentangOpsional, teks, tglLokal, NAMA_PRAKTISI } from "./bersama.js";
import { detailOrder, segarkanStatusOrder } from "./order.js";
import { izinPa } from "../umum/izin.js";

// Kasus PA (= item order) — penerimaan jaringan & pemeriksaan:
//   menunggu ─terima→ diterima (nomor PA, target selesai = terima + TAT hari) ─makroskopis/mikroskopis→ diproses
//   ─diagnosis→ verifikasi (draft, menunggu verifikasi Sp.PA) ─verifikasi→ selesai ─revisi→ verifikasi (addendum)
//   menunggu/ditolak ─tolak→ ditolak (alasan; dapat diterima ulang saat spesimen dikirim kembali)
// Order induk mengikuti (segarkanStatusOrder). Blok parafin & slide diarsipkan otomatis dari jumlah blok/slide.
const rute = express.Router();

const MAKS_GAMBAR = 4;
const MAKS_BYTE_GAMBAR = 1.5 * 1024 * 1024;

// ── Worklist ─────────────────────────────────────────────────────────────────

// ?status=menunggu,ditolak (status kasus) · ?jenis= · ?cari= · ?cito=1 · ?tanggal_mulai/selesai (tgl. order)
// ?belum_validasi=1 → sertakan order yang belum divalidasi (penerimaan dapat memvalidasi langsung) · ?terlambat=1
rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    const statusOrder = ["valid", "diproses", "selesai", "ditolak"];
    if (["1", "true"].includes(String(req.query.belum_validasi))) statusOrder.push("order");
    p.push(statusOrder);
    let w = `i.faskes_uuid = $1 AND i.deleted_at IS NULL AND o.deleted_at IS NULL AND o.status = ANY($2)`;
    const status = daftarNilai(req.query.status).filter((s) => STATUS_ITEM.includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND i.status = ANY($${p.length})`;
    }
    const jenis = daftarNilai(req.query.jenis).filter((j) => JENIS[j]);
    if (jenis.length) {
      p.push(jenis);
      w += ` AND i.jenis = ANY($${p.length})`;
    }
    const rentang = rentangOpsional(req.query);
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("o.created_at")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (["1", "true"].includes(String(req.query.cito))) w += " AND o.cito";
    if (["1", "true"].includes(String(req.query.terlambat))) w += ` AND i.status NOT IN ('selesai', 'ditolak', 'menunggu') AND i.target_selesai < ${sekarang()}`;
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      const c = `$${p.length}`;
      w += ` AND (pt.name ILIKE ${c} OR o.no_rm ILIKE ${c} OR o.no_order ILIKE ${c} OR i.no_pa ILIKE ${c} OR i.nama ILIKE ${c})`;
    }
    const dari = `FROM pa_order_item i JOIN pa_order o ON o.uuid = i.order_uuid
                  LEFT JOIN patients pt ON pt.uuid = o.patient_uuid LEFT JOIN birth_details bd ON bd.uuid = pt.birth_detail_uuid
                  LEFT JOIN pa_laporan lp ON lp.order_item_uuid = i.uuid AND lp.deleted_at IS NULL
                  LEFT JOIN pa_order_item ki ON ki.uuid = i.kasus_induk_uuid`;
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT i.uuid, i.order_uuid, i.pemeriksaan_uuid, i.nama, i.jenis, i.harga::float8 AS harga, i.status, i.no_pa, i.tat_hari,
              i.waktu_terima, i.target_selesai, i.waktu_selesai, i.kasus_induk_uuid, ki.no_pa AS no_pa_induk,
              (i.status NOT IN ('selesai', 'ditolak', 'menunggu') AND i.target_selesai < ${sekarang()}) AS terlambat,
              o.no_order, o.no_rm, o.no_reg, o.sumber, o.pelayanan, o.cito, o.klinis, o.lokasi_anatomi AS lokasi_anatomi_order,
              o.status AS status_order, o.created_at AS waktu_order, o.patient_uuid,
              pt.name AS nama_pasien, pt.gender, bd.birth_date,
              COALESCE(${NAMA_PRAKTISI("o.dokter_pengirim_uuid")}, o.dokter_pengirim_luar) AS dokter_pengirim,
              lp.status AS status_laporan, (lp.makroskopis IS NOT NULL) AS ada_makroskopis, (lp.mikroskopis IS NOT NULL) AS ada_mikroskopis,
              (lp.diagnosis IS NOT NULL) AS ada_diagnosis, lp.jumlah_blok, lp.jumlah_slide, lp.dokter_pa_nama, lp.revisi, lp.diagnosis,
              (SELECT s.lokasi_anatomi FROM pa_spesimen s WHERE s.order_item_uuid = i.uuid AND s.deleted_at IS NULL AND s.status = 'diterima'
                ORDER BY s.waktu_terima DESC LIMIT 1) AS lokasi_anatomi,
              (SELECT s.alasan_tolak FROM pa_spesimen s WHERE s.order_item_uuid = i.uuid AND s.deleted_at IS NULL AND s.status = 'ditolak'
                ORDER BY s.waktu_terima DESC LIMIT 1) AS alasan_tolak
         ${dari} WHERE ${w}
        ORDER BY CASE i.status WHEN 'menunggu' THEN 0 WHEN 'diterima' THEN 1 WHEN 'diproses' THEN 2 WHEN 'verifikasi' THEN 3 WHEN 'ditolak' THEN 4 ELSE 5 END,
                 o.cito DESC, COALESCE(i.target_selesai, o.created_at), i.created_at
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Kandidat kasus induk untuk order IHK: kasus PA pasien yang sudah bernomor PA (bukan IHK, tidak ditolak).
rute.get(
  "/induk",
  tangani(async (req, res) => {
    if (!req.query.patient_uuid) throw permintaanSalah("patient_uuid wajib diisi");
    kirim(
      res,
      await query(
        `SELECT i.uuid, i.no_pa, i.nama, i.jenis, i.status, i.waktu_terima, lp.diagnosis, lp.jumlah_blok,
                (SELECT string_agg(b.kode || COALESCE(' @' || b.lokasi_rak, ''), ', ' ORDER BY b.kode) FROM pa_blok_slide b
                  WHERE b.order_item_uuid = i.uuid AND b.deleted_at IS NULL AND b.jenis = 'blok') AS blok
           FROM pa_order_item i JOIN pa_order o ON o.uuid = i.order_uuid
           LEFT JOIN pa_laporan lp ON lp.order_item_uuid = i.uuid AND lp.deleted_at IS NULL
          WHERE i.faskes_uuid = $1 AND o.patient_uuid = $2 AND i.deleted_at IS NULL AND i.no_pa IS NOT NULL
            AND i.jenis <> 'ihk' AND i.status <> 'ditolak'
          ORDER BY i.waktu_terima DESC LIMIT 50`,
        [req.author.faskesUuid, req.query.patient_uuid],
      ),
    );
  }),
);

// ── Detail ───────────────────────────────────────────────────────────────────

export const detailKasus = async (uuid, faskes, k) => {
  const i = await satu(`SELECT order_uuid FROM pa_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskes], k);
  if (!i) throw tidakDitemukan("Kasus PA");
  const order = await detailOrder(i.order_uuid, faskes, k, true);
  const item = order.items.find((x) => x.uuid === uuid);
  const [spesimen, arsip, ihk, induk] = await Promise.all([
    query(`SELECT * FROM pa_spesimen WHERE order_item_uuid = $1 AND deleted_at IS NULL ORDER BY waktu_terima, created_at`, [uuid], k),
    query(
      `SELECT b.uuid, b.jenis, b.kode, b.pewarnaan, b.keterangan, b.lokasi_rak, b.status,
              pj.peminjam, pj.instansi, pj.waktu_pinjam, pj.rencana_kembali
         FROM pa_blok_slide b
         LEFT JOIN LATERAL (SELECT * FROM pa_peminjaman x WHERE x.blok_slide_uuid = b.uuid AND x.deleted_at IS NULL AND x.waktu_kembali IS NULL
                             ORDER BY x.waktu_pinjam DESC LIMIT 1) pj ON true
        WHERE b.order_item_uuid = $1 AND b.deleted_at IS NULL ORDER BY b.jenis, b.created_at, b.kode`,
      [uuid],
      k,
    ),
    // Pemeriksaan IHK tambahan yang merujuk kasus ini.
    query(
      `SELECT i.uuid, i.no_pa, i.nama, i.status, lp.diagnosis FROM pa_order_item i
         LEFT JOIN pa_laporan lp ON lp.order_item_uuid = i.uuid AND lp.deleted_at IS NULL
        WHERE i.kasus_induk_uuid = $1 AND i.deleted_at IS NULL ORDER BY i.created_at`,
      [uuid],
      k,
    ),
    item?.kasus_induk_uuid
      ? satu(
          `SELECT i.uuid, i.no_pa, i.nama, i.jenis, lp.diagnosis, lp.icd_o_topografi, lp.icd_o_morfologi FROM pa_order_item i
             LEFT JOIN pa_laporan lp ON lp.order_item_uuid = i.uuid AND lp.deleted_at IS NULL WHERE i.uuid = $1`,
          [item.kasus_induk_uuid],
          k,
        )
      : null,
  ]);
  return { ...item, spesimen, arsip, ihk, induk, order };
};

rute.get("/:uuid", tangani(async (req, res) => kirim(res, await detailKasus(req.params.uuid, req.author.faskesUuid))));

// Kunci kasus + order induk (FOR UPDATE).
const kunciKasus = async (uuid, faskes, k) => {
  const i = await satu(`SELECT * FROM pa_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskes], k);
  if (!i) throw tidakDitemukan("Kasus PA");
  const o = await satu(`SELECT * FROM pa_order WHERE uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [i.order_uuid], k);
  if (!o) throw tidakDitemukan("Order PA");
  if (o.status === "order") throw new Galat(409, "Order belum divalidasi");
  if (o.status === "batal") throw new Galat(409, "Order sudah dibatalkan");
  return { i, o };
};

// ── Penerimaan jaringan ──────────────────────────────────────────────────────

const dataSpesimen = (b) => {
  if (b.fiksasi && !FIKSASI[b.fiksasi]) throw permintaanSalah(`fiksasi harus salah satu: ${Object.keys(FIKSASI).join(", ")}`);
  const wadah = b.jumlah_wadah === undefined || b.jumlah_wadah === null || b.jumlah_wadah === "" ? 1 : Number(b.jumlah_wadah);
  if (!Number.isInteger(wadah) || wadah < 0 || wadah > 50) throw permintaanSalah("jumlah_wadah harus bilangan bulat 0–50");
  const lat = teks(b.lateralitas, 10) ?? null;
  if (lat && !["kanan", "kiri", "bilateral"].includes(lat)) throw permintaanSalah("lateralitas harus kanan, kiri, atau bilateral");
  const waktuTerima = epoch(b.waktu_terima) ?? sekarang();
  const waktuAmbil = epoch(b.waktu_pengambilan) ?? null;
  if (waktuTerima > sekarang() + 300) throw permintaanSalah("waktu_terima tidak boleh di masa depan");
  if (waktuAmbil && waktuAmbil > waktuTerima) throw permintaanSalah("waktu pengambilan tidak boleh setelah waktu penerimaan");
  return {
    jenis_spesimen: teks(b.jenis_spesimen, 200) ?? null,
    lokasi_anatomi: teks(b.lokasi_anatomi, 200) ?? null,
    lateralitas: lat,
    cara_pengambilan: teks(b.cara_pengambilan, 100) ?? null,
    jumlah_wadah: wadah,
    fiksasi: b.fiksasi || null,
    waktu_pengambilan: waktuAmbil,
    waktu_fiksasi: epoch(b.waktu_fiksasi) ?? null,
    waktu_terima: waktuTerima,
    kondisi: teks(b.kondisi) ?? null,
    catatan: teks(b.catatan) ?? null,
  };
};

// Terima jaringan/spesimen: nomor PA diberikan (sekali; diterima ulang setelah ditolak memakai nomor yang sama bila ada).
rute.post(
  "/:uuid/terima",
  izinPa("Penerimaan Jaringan", "TERIMA"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const s = dataSpesimen(b);
    if (!s.jenis_spesimen) throw permintaanSalah("jenis_spesimen wajib diisi");
    if (!s.lokasi_anatomi) throw permintaanSalah("lokasi_anatomi (organ/lokasi pengambilan) wajib diisi");
    const noPa = await transaksi(async (k) => {
      const { i } = await kunciKasus(req.params.uuid, faskes, k);
      if (!["menunggu", "ditolak"].includes(i.status)) throw new Galat(409, `Spesimen kasus ini sudah diterima (${i.no_pa ?? i.status})`);
      if (i.jenis === "histopatologi" && s.fiksasi && s.fiksasi !== "formalin_10" && !s.catatan)
        throw permintaanSalah("Jaringan histopatologi tidak difiksasi formalin 10%: jelaskan di catatan");
      const no = i.no_pa ?? (await nomorPa(faskes, i.jenis, k));
      await sisipkan("pa_spesimen", { faskes_uuid: faskes, order_item_uuid: i.uuid, status: "diterima", ...s, petugas: teks(b.petugas, 200) ?? req.author.username ?? null }, k);
      await ubah(
        "pa_order_item",
        i.uuid,
        faskes,
        { status: "diterima", no_pa: no, waktu_terima: s.waktu_terima, target_selesai: s.waktu_terima + Number(i.tat_hari || 0) * HARI },
        k,
      );
      await segarkanStatusOrder(i.order_uuid, faskes, k);
      return no;
    });
    kirim(res, await detailKasus(req.params.uuid, faskes), `Jaringan diterima, nomor PA ${noPa}`);
  }),
);

// Tolak spesimen (mis. tanpa label/identitas tidak sesuai, wadah bocor, tanpa fiksasi, jaringan kering/autolisis).
rute.post(
  "/:uuid/tolak",
  izinPa("Penerimaan Jaringan", "TOLAK"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const alasan = String(b.alasan_tolak ?? b.alasan ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan_tolak wajib diisi");
    const s = dataSpesimen(b);
    await transaksi(async (k) => {
      const { i } = await kunciKasus(req.params.uuid, faskes, k);
      if (!["menunggu", "ditolak"].includes(i.status)) throw new Galat(409, "Spesimen yang sudah diterima tidak dapat ditolak");
      await sisipkan("pa_spesimen", { faskes_uuid: faskes, order_item_uuid: i.uuid, status: "ditolak", ...s, alasan_tolak: alasan, petugas: teks(b.petugas, 200) ?? req.author.username ?? null }, k);
      await ubah("pa_order_item", i.uuid, faskes, { status: "ditolak" }, k);
      await segarkanStatusOrder(i.order_uuid, faskes, k);
    });
    kirim(res, await detailKasus(req.params.uuid, faskes), "Spesimen ditolak");
  }),
);

// ── Laporan: makroskopis, mikroskopis, diagnosis, verifikasi, revisi ───────────

const laporanAtauBaru = async (i, faskes, k) =>
  (await satu(`SELECT * FROM pa_laporan WHERE order_item_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [i.uuid], k)) ??
  (await sisipkan("pa_laporan", { faskes_uuid: faskes, order_item_uuid: i.uuid, status: "draft" }, k));

const bolehSunting = (i) => {
  if (["menunggu", "ditolak"].includes(i.status)) throw new Galat(409, "Jaringan belum diterima");
  if (i.status === "selesai") throw new Galat(409, "Laporan sudah diverifikasi; buka revisi terlebih dahulu");
};

const PEWARNAAN = { histopatologi: "HE", potong_beku: "HE", sitologi: "Papanicolaou", ihk: "IHK" };

// Arsip blok & slide mengikuti jumlah blok/slide: kode <noPA>-B<n> / <noPA>-S<n>. Kelebihan dihapus hanya bila masih
// di arsip (status 'ada') — blok/slide yang dipinjam atau pernah dipinjam tetap tercatat.
const sinkronArsip = async (i, jumlahBlok, jumlahSlide, faskes, k) => {
  const ada = await query(`SELECT uuid, jenis, kode, status FROM pa_blok_slide WHERE order_item_uuid = $1 AND deleted_at IS NULL`, [i.uuid], k);
  for (const [jenis, huruf, n] of [["blok", "B", jumlahBlok], ["slide", "S", jumlahSlide]]) {
    const pola = new RegExp(`^${i.no_pa.replace(/[-]/g, "\\-")}-${huruf}(\\d+)$`);
    const otomatis = ada.filter((b) => b.jenis === jenis && pola.test(b.kode));
    const nomor = new Set(otomatis.map((b) => Number(pola.exec(b.kode)[1])));
    for (let x = 1; x <= n; x++) {
      if (nomor.has(x)) continue;
      await sisipkan(
        "pa_blok_slide",
        { faskes_uuid: faskes, order_item_uuid: i.uuid, jenis, kode: `${i.no_pa}-${huruf}${x}`, pewarnaan: jenis === "slide" ? PEWARNAAN[i.jenis] : null, status: "ada" },
        k,
      );
    }
    for (const b of otomatis) {
      if (Number(pola.exec(b.kode)[1]) <= n || b.status !== "ada") continue;
      const pinjam = await satu(`SELECT 1 FROM pa_peminjaman WHERE blok_slide_uuid = $1 AND deleted_at IS NULL LIMIT 1`, [b.uuid], k);
      if (!pinjam) await ubah("pa_blok_slide", b.uuid, faskes, { deleted_at: sekarang() }, k);
    }
  }
};

const gambarValid = (daftar) => {
  if (!Array.isArray(daftar)) throw permintaanSalah("gambar_makro harus berupa array");
  if (daftar.length > MAKS_GAMBAR) throw permintaanSalah(`Maksimal ${MAKS_GAMBAR} foto makroskopis`);
  return daftar.map((g) => {
    const data = String(g?.data ?? "");
    const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(data);
    if (!m) throw permintaanSalah("Foto makroskopis harus data URL PNG/JPEG");
    if ((m[2].length * 3) / 4 > MAKS_BYTE_GAMBAR) throw permintaanSalah("Ukuran foto makroskopis maksimal 1,5 MB");
    return { nama: String(g?.nama ?? "foto").slice(0, 100), tipe: `image/${m[1].toLowerCase()}`, data };
  });
};

const bilBulat = (v, nama, maks) => {
  if (v === undefined) return undefined;
  const n = v === null || v === "" ? 0 : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > maks) throw permintaanSalah(`${nama} harus bilangan bulat 0–${maks}`);
  return n;
};

// Makroskopis (grossing): deskripsi, jumlah blok/kaset & slide, foto opsional, petugas.
rute.put(
  "/:uuid/makroskopis",
  izinPa("Pemeriksaan", "MAKROSKOPIS"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const makro = String(b.makroskopis ?? "").trim();
    const jumlahBlok = bilBulat(b.jumlah_blok, "jumlah_blok", 100);
    const jumlahSlide = bilBulat(b.jumlah_slide, "jumlah_slide", 200);
    const gambar = b.gambar_makro === undefined ? undefined : gambarValid(b.gambar_makro);
    await transaksi(async (k) => {
      const { i } = await kunciKasus(req.params.uuid, faskes, k);
      bolehSunting(i);
      if (!makro && i.jenis !== "ihk") throw permintaanSalah("makroskopis wajib diisi");
      const lp = await laporanAtauBaru(i, faskes, k);
      const blok = jumlahBlok ?? lp.jumlah_blok;
      const slide = jumlahSlide ?? (lp.jumlah_slide || blok);
      await ubah(
        "pa_laporan",
        lp.uuid,
        faskes,
        {
          makroskopis: makro || null,
          jumlah_blok: blok,
          jumlah_slide: slide,
          gambar_makro: gambar,
          petugas_makroskopis: teks(b.petugas_makroskopis, 200) ?? lp.petugas_makroskopis ?? req.author.username ?? null,
          waktu_makroskopis: lp.waktu_makroskopis ?? sekarang(),
        },
        k,
      );
      await sinkronArsip(i, blok, slide, faskes, k);
      if (i.status === "diterima") await ubah("pa_order_item", i.uuid, faskes, { status: "diproses" }, k);
    });
    kirim(res, await detailKasus(req.params.uuid, faskes), "Makroskopis disimpan");
  }),
);

rute.put(
  "/:uuid/mikroskopis",
  izinPa("Pemeriksaan", "MIKROSKOPIS"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const mikro = String(req.body?.mikroskopis ?? "").trim();
    if (!mikro) throw permintaanSalah("mikroskopis wajib diisi");
    await transaksi(async (k) => {
      const { i } = await kunciKasus(req.params.uuid, faskes, k);
      bolehSunting(i);
      const lp = await laporanAtauBaru(i, faskes, k);
      await ubah("pa_laporan", lp.uuid, faskes, { mikroskopis: mikro, waktu_mikroskopis: sekarang() }, k);
      if (i.status === "diterima") await ubah("pa_order_item", i.uuid, faskes, { status: "diproses" }, k);
    });
    kirim(res, await detailKasus(req.params.uuid, faskes), "Mikroskopis disimpan");
  }),
);

// Dokter Sp.PA dari pa_petugas (peran dokter, aktif).
const dokterPa = async (uuid, faskes, k) => {
  const d = await satu(`SELECT uuid, nama, sip FROM pa_petugas WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status AND peran = 'dokter'`, [uuid, faskes], k);
  if (!d) throw permintaanSalah("Dokter Sp.PA tidak ditemukan / tidak aktif (Datamaster › Pemeriksaan PA › Petugas)");
  return d;
};

// Diagnosis/kesimpulan (draft): teks + ICD-O topografi/morfologi + ICD-10 + komentar; menunggu verifikasi Sp.PA.
// Boleh sekaligus mengirim makroskopis/mikroskopis (formulir satu layar); mikroskopis wajib sudah ada.
rute.put(
  "/:uuid/diagnosis",
  izinPa("Pemeriksaan", "DIAGNOSIS"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const diagnosis = String(b.diagnosis ?? "").trim();
    if (!diagnosis) throw permintaanSalah("diagnosis wajib diisi");
    if (!b.dokter_pa_uuid) throw permintaanSalah("dokter_pa_uuid (dokter Sp.PA) wajib dipilih");
    const topo = icdoTopografi(b.icd_o_topografi);
    const morf = icdoMorfologi(b.icd_o_morfologi);
    const icd10 = teks(b.icd10, 20);
    await transaksi(async (k) => {
      const { i } = await kunciKasus(req.params.uuid, faskes, k);
      bolehSunting(i);
      const d = await dokterPa(b.dokter_pa_uuid, faskes, k);
      const lp = await laporanAtauBaru(i, faskes, k);
      const mikro = b.mikroskopis === undefined ? lp.mikroskopis : String(b.mikroskopis ?? "").trim() || null;
      if (!mikro) throw permintaanSalah("Isi mikroskopis terlebih dahulu");
      let icd10Nama;
      if (icd10 !== undefined) {
        icd10Nama = icd10 ? (await satu(`SELECT name FROM diagnosis WHERE code = $1 AND deleted_at IS NULL LIMIT 1`, [icd10], k))?.name ?? null : null;
        if (icd10 && !icd10Nama) throw permintaanSalah(`Kode ICD-10 ${icd10} tidak ditemukan`);
      }
      await ubah(
        "pa_laporan",
        lp.uuid,
        faskes,
        {
          mikroskopis: mikro,
          waktu_mikroskopis: b.mikroskopis === undefined ? undefined : lp.waktu_mikroskopis ?? sekarang(),
          diagnosis,
          icd_o_topografi: topo,
          icd_o_morfologi: morf,
          icd10: icd10,
          icd10_nama: icd10Nama,
          komentar: teks(b.komentar),
          template_uuid: b.template_uuid === undefined ? undefined : b.template_uuid || null,
          dokter_pa_uuid: d.uuid,
          dokter_pa_nama: d.nama,
          dokter_pa_sip: d.sip,
          waktu_diagnosis: sekarang(),
          status: "draft",
        },
        k,
      );
      await ubah("pa_order_item", i.uuid, faskes, { status: "verifikasi" }, k);
    });
    kirim(res, await detailKasus(req.params.uuid, faskes), "Diagnosis disimpan, menunggu verifikasi Sp.PA");
  }),
);

// Verifikasi Sp.PA: laporan final, kasus selesai (waktu selesai untuk TAT).
rute.post(
  "/:uuid/verifikasi",
  izinPa("Pemeriksaan", "VERIFIKASI"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    await transaksi(async (k) => {
      const { i } = await kunciKasus(req.params.uuid, faskes, k);
      if (i.status !== "verifikasi") throw new Galat(409, i.status === "selesai" ? "Laporan sudah diverifikasi" : "Diagnosis belum diisi");
      const lp = await satu(`SELECT * FROM pa_laporan WHERE order_item_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [i.uuid], k);
      if (!lp?.diagnosis || !lp?.mikroskopis) throw new Galat(409, "Mikroskopis dan diagnosis wajib diisi sebelum verifikasi");
      const d = await dokterPa(b.dokter_pa_uuid || lp.dokter_pa_uuid, faskes, k);
      const t = sekarang();
      await ubah(
        "pa_laporan",
        lp.uuid,
        faskes,
        { status: "verifikasi", dokter_pa_uuid: d.uuid, dokter_pa_nama: d.nama, dokter_pa_sip: d.sip, diverifikasi_oleh: req.author.username ?? null, waktu_verifikasi: t },
        k,
      );
      await ubah("pa_order_item", i.uuid, faskes, { status: "selesai", waktu_selesai: i.waktu_selesai ?? t }, k);
      await segarkanStatusOrder(i.order_uuid, faskes, k);
    });
    kirim(res, await detailKasus(req.params.uuid, faskes), "Laporan PA diverifikasi");
  }),
);

// Revisi/addendum laporan terverifikasi: kembali ke draft (status kasus 'verifikasi'), nomor revisi bertambah.
// Waktu selesai pertama dipertahankan untuk perhitungan TAT.
rute.post(
  "/:uuid/revisi",
  izinPa("Pemeriksaan", "VERIFIKASI"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const alasan = String(req.body?.alasan ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan revisi wajib diisi");
    await transaksi(async (k) => {
      const { i } = await kunciKasus(req.params.uuid, faskes, k);
      if (i.status !== "selesai") throw new Galat(409, "Hanya laporan terverifikasi yang dapat direvisi");
      const lp = await satu(`SELECT * FROM pa_laporan WHERE order_item_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [i.uuid], k);
      await ubah("pa_laporan", lp.uuid, faskes, { status: "draft", revisi: Number(lp.revisi || 0) + 1, alasan_revisi: alasan }, k);
      await ubah("pa_order_item", i.uuid, faskes, { status: "verifikasi" }, k);
      await segarkanStatusOrder(i.order_uuid, faskes, k);
    });
    kirim(res, await detailKasus(req.params.uuid, faskes), "Laporan dibuka untuk revisi");
  }),
);

export default rute;
