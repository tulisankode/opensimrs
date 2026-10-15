import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import {
  INTERPRETASI, NAMA_PRAKTISI, PENANDA, PEWARNAAN, SPESIMEN, STATUS_ITEM, STATUS_KULTUR, angkaOpsional, cekPilihan, daftarNilai,
  rentangOpsional, tafsir, teks, tglLokal,
} from "./bersama.js";
import { detailOrder, hasilLengkap } from "./order.js";
import { izinMikro } from "../umum/izin.js";

// Pemeriksaan mikrobiologi per item (spesimen):
//   menunggu → diterima (penerimaan spesimen, nomor mikro) → diproses (pewarnaan / kultur / isolat / AST diisi)
//   → sementara (laporan sementara, dapat dicetak) → selesai (verifikasi Sp.MK, final) ; menunggu/diterima → ditolak.
// Order ikut berubah: 'diproses' saat spesimen pertama diterima, 'selesai' bila semua item final/ditolak.
const rute = express.Router();

// ── Worklist ─────────────────────────────────────────────────────────────────

rute.get(
  "/worklist",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "i.faskes_uuid = $1 AND i.deleted_at IS NULL AND o.deleted_at IS NULL AND o.status IN ('valid', 'diproses', 'selesai')";
    const status = daftarNilai(req.query.status).filter((s) => STATUS_ITEM.includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND i.status = ANY($${p.length})`;
    }
    for (const [param, kol] of [["spesimen", "i.jenis_spesimen"], ["sumber", "o.sumber"], ["jenis", "i.jenis"]]) {
      const v = daftarNilai(req.query[param]);
      if (!v.length) continue;
      p.push(v);
      w += ` AND ${kol} = ANY($${p.length})`;
    }
    const rentang = rentangOpsional(req.query);
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("o.created_at")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (["1", "true"].includes(String(req.query.cito))) w += " AND o.cito";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (pt.name ILIKE $${p.length} OR o.no_rm ILIKE $${p.length} OR o.no_order ILIKE $${p.length} OR i.no_mikro ILIKE $${p.length} OR i.nama ILIKE $${p.length})`;
    }
    const dari = `FROM mikro_order_item i JOIN mikro_order o ON o.uuid = i.order_uuid
                  LEFT JOIN patients pt ON pt.uuid = o.patient_uuid LEFT JOIN birth_details bd ON bd.uuid = pt.birth_detail_uuid
                  LEFT JOIN mikro_spesimen s ON s.uuid = i.spesimen_uuid
                  LEFT JOIN mikro_hasil h ON h.item_uuid = i.uuid AND h.deleted_at IS NULL`;
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT i.uuid, i.order_uuid, i.nama, i.jenis, i.jenis_spesimen, i.lokasi_spesimen, i.status, i.no_mikro, i.tat_hari,
              o.no_order, o.no_rm, o.no_reg, o.sumber, o.pelayanan, o.cito, o.klinis, o.antibiotik_sedang, o.status AS status_order,
              o.created_at AS waktu_order, o.patient_uuid, pt.name AS nama_pasien, pt.gender, bd.birth_date,
              ${NAMA_PRAKTISI("o.dokter_pengirim_uuid")} AS dokter_pengirim,
              s.waktu_ambil, s.waktu_terima, h.status AS status_hasil, h.kultur_status, h.sementara_pada, h.diverifikasi_pada,
              (SELECT string_agg(x.nama_organisme, ', ' ORDER BY x.urutan) FROM mikro_isolat x WHERE x.hasil_uuid = h.uuid AND x.deleted_at IS NULL) AS organisme
         ${dari} WHERE ${w}
        ORDER BY CASE i.status WHEN 'menunggu' THEN 0 WHEN 'diterima' THEN 1 WHEN 'diproses' THEN 2 WHEN 'sementara' THEN 3 WHEN 'ditolak' THEN 4 ELSE 5 END,
                 o.cito DESC, o.created_at, i.created_at
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows.map((r) => ({ ...r, nama_spesimen: SPESIMEN[r.jenis_spesimen] ?? r.jenis_spesimen })), total, pg));
  }),
);

// ── Helper ───────────────────────────────────────────────────────────────────

const kunciItem = async (uuid, faskesUuid, k) => {
  const i = await satu(`SELECT * FROM mikro_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskesUuid], k);
  if (!i) throw tidakDitemukan("Item pemeriksaan mikrobiologi");
  const o = await satu(`SELECT * FROM mikro_order WHERE uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [i.order_uuid], k);
  if (!o) throw tidakDitemukan("Order mikrobiologi");
  if (o.status === "order") throw new Galat(409, "Order belum divalidasi");
  if (o.status === "batal") throw new Galat(409, "Order sudah dibatalkan");
  const m = await satu(`SELECT dengan_pewarnaan, dengan_kultur, dengan_ast, jenis FROM mikro_pemeriksaan WHERE uuid = $1`, [i.pemeriksaan_uuid], k);
  const h = await satu(`SELECT * FROM mikro_hasil WHERE item_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [i.uuid], k);
  return { i, o, m: m ?? {}, h };
};

// Status order mengikuti item: ada spesimen diterima → diproses; semua item final/ditolak (≥1 final) → selesai.
const sinkronOrder = async (o, k) => {
  const r = await satu(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE status = 'selesai')::int AS selesai,
            COUNT(*) FILTER (WHERE status IN ('selesai', 'ditolak'))::int AS tuntas,
            COUNT(*) FILTER (WHERE status IN ('diterima', 'diproses', 'sementara', 'selesai'))::int AS jalan
       FROM mikro_order_item WHERE order_uuid = $1 AND deleted_at IS NULL`,
    [o.uuid],
    k,
  );
  let status = o.status;
  if (r.selesai && r.tuntas === r.n) status = "selesai";
  else if (r.jalan) status = "diproses";
  else if (o.status !== "order") status = "valid";
  if (status !== o.status) {
    await ubah("mikro_order", o.uuid, o.faskes_uuid, { status, selesai_pada: status === "selesai" ? sekarang() : null }, k);
  }
};

const waktuOpsional = (v, nama) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw permintaanSalah(`${nama} tidak valid (detik epoch)`);
  return Math.floor(n);
};

// Detail item lengkap: item + hasil (isolat, kepekaan) + riwayat spesimen + order (tanpa hasil item lain).
const detailItem = async (itemUuid, faskes) => {
  const i = await satu(`SELECT order_uuid FROM mikro_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [itemUuid, faskes]);
  if (!i) throw tidakDitemukan("Item pemeriksaan mikrobiologi");
  const order = await detailOrder(i.order_uuid, faskes, undefined, false);
  const item = order.items.find((x) => x.uuid === itemUuid);
  const [hasil, spesimen] = await Promise.all([
    item.hasil_uuid ? hasilLengkap([item.hasil_uuid]).then((m) => m.get(item.hasil_uuid)) : null,
    query(`SELECT * FROM mikro_spesimen WHERE item_uuid = $1 AND deleted_at IS NULL ORDER BY created_at`, [itemUuid]),
  ]);
  return { ...item, hasil, riwayat_spesimen: spesimen, order };
};

rute.get(
  "/item/:uuid",
  tangani(async (req, res) => kirim(res, await detailItem(req.params.uuid, req.author.faskesUuid))),
);

// ── Penerimaan & penolakan spesimen ──────────────────────────────────────────

// Terima spesimen: nomor mikro otomatis (MB-YYYYMMDD-0001), waktu ambil/terima, kualitas. Spesimen yang ditolak dapat
// diterima ulang (spesimen baru). Body: { waktu_ambil?, waktu_terima?, diambil_oleh?, volume?, wadah?, kualitas?,
//   catatan?, lokasi_spesimen? }.
rute.post(
  "/item/:uuid/terima",
  izinMikro("Pemeriksaan", "INPUT HASIL"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const waktuTerima = waktuOpsional(b.waktu_terima, "waktu_terima") ?? sekarang();
    const waktuAmbil = waktuOpsional(b.waktu_ambil, "waktu_ambil");
    if (waktuAmbil && waktuAmbil > waktuTerima) throw permintaanSalah("Waktu ambil tidak boleh setelah waktu terima");
    const no = await transaksi(async (k) => {
      const { i, o, h } = await kunciItem(req.params.uuid, faskes, k);
      if (!["menunggu", "ditolak"].includes(i.status)) throw new Galat(409, `Spesimen sudah diterima (status ${i.status})`);
      const noMikro = await nomorBaru(faskes, "MB", k);
      const lokasi = b.lokasi_spesimen === undefined ? i.lokasi_spesimen : teks(b.lokasi_spesimen);
      const s = await sisipkan(
        "mikro_spesimen",
        {
          faskes_uuid: faskes, item_uuid: i.uuid, no_mikro: noMikro, jenis_spesimen: i.jenis_spesimen, lokasi_spesimen: lokasi,
          waktu_ambil: waktuAmbil, waktu_terima: waktuTerima, diambil_oleh: teks(b.diambil_oleh) ?? null,
          diterima_oleh: req.author.username ?? null, volume: teks(b.volume) ?? null, wadah: teks(b.wadah) ?? null,
          kualitas: teks(b.kualitas) ?? null, catatan: teks(b.catatan) ?? null, status: "diterima",
        },
        k,
      );
      await ubah("mikro_order_item", i.uuid, faskes, { status: "diterima", spesimen_uuid: s.uuid, no_mikro: noMikro, lokasi_spesimen: lokasi }, k);
      if (h) await ubah("mikro_hasil", h.uuid, faskes, { deleted_at: sekarang() }, k);
      await sisipkan("mikro_hasil", { faskes_uuid: faskes, item_uuid: i.uuid, spesimen_uuid: s.uuid, status: "draft", sumber: "manual" }, k);
      await sinkronOrder(o, k);
      return noMikro;
    });
    kirim(res, await detailItem(req.params.uuid, faskes), `Spesimen diterima, nomor mikro ${no}`);
  }),
);

// Tolak spesimen (sebelum diproses): mis. wadah tidak steril, volume kurang, label tidak sesuai, transport > 2 jam.
rute.post(
  "/item/:uuid/tolak",
  izinMikro("Pemeriksaan", "INPUT HASIL"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const alasan = String(b.alasan ?? b.alasan_tolak ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan penolakan wajib diisi");
    await transaksi(async (k) => {
      const { i, o, h } = await kunciItem(req.params.uuid, faskes, k);
      if (!["menunggu", "diterima"].includes(i.status)) throw new Galat(409, `Spesimen berstatus ${i.status}, tidak dapat ditolak`);
      if (i.status === "diterima" && i.spesimen_uuid) {
        await ubah("mikro_spesimen", i.spesimen_uuid, faskes, { status: "ditolak", alasan_tolak: alasan }, k);
      } else {
        const s = await sisipkan(
          "mikro_spesimen",
          {
            faskes_uuid: faskes, item_uuid: i.uuid, no_mikro: null, jenis_spesimen: i.jenis_spesimen, lokasi_spesimen: i.lokasi_spesimen,
            waktu_ambil: waktuOpsional(b.waktu_ambil, "waktu_ambil"), waktu_terima: sekarang(), diterima_oleh: req.author.username ?? null,
            status: "ditolak", alasan_tolak: alasan,
          },
          k,
        );
        await ubah("mikro_order_item", i.uuid, faskes, { spesimen_uuid: s.uuid }, k);
      }
      await ubah("mikro_order_item", i.uuid, faskes, { status: "ditolak" }, k);
      if (h) await ubah("mikro_hasil", h.uuid, faskes, { deleted_at: sekarang() }, k);
      await sinkronOrder(o, k);
    });
    kirim(res, await detailItem(req.params.uuid, faskes), "Spesimen ditolak");
  }),
);

// ── Input hasil ──────────────────────────────────────────────────────────────

// Simpan hasil (draft / revisi laporan sementara): pewarnaan, kultur, isolat + kepekaan (isolat diganti seluruhnya).
// Body: { pewarnaan_jenis?, gram_temuan?: [{ sifat: 'positif'|'negatif', bentuk, susunan?, jumlah? }], sel_leukosit?, sel_epitel?,
//   hasil_pewarnaan?, kultur_status?, media?, mulai_inkubasi?, lama_inkubasi_jam?, keterangan_kultur?, hasil_teks?, kesimpulan?,
//   catatan?, isolat?: [{ organisme_uuid, jumlah_koloni?, koloni_cfu?, penanda?: [], catatan?,
//   kepekaan?: [{ antibiotik_uuid, metode?, mic?, zona?, interpretasi?, dilaporkan? }] }] }.
// Interpretasi kosong diisi otomatis dari breakpoint panel kelompok organisme (atau breakpoint umum antibiotik).
rute.put(
  "/item/:uuid/hasil",
  izinMikro("Pemeriksaan", "INPUT HASIL"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const gram = b.gram_temuan === undefined ? undefined : Array.isArray(b.gram_temuan) ? b.gram_temuan : null;
    if (gram === null) throw permintaanSalah("gram_temuan harus berupa daftar");
    const data = {
      pewarnaan_jenis: b.pewarnaan_jenis === undefined ? undefined : cekPilihan(b.pewarnaan_jenis || null, PEWARNAAN, "pewarnaan_jenis"),
      gram_temuan: gram?.map((g) => ({
        sifat: ["positif", "negatif"].includes(g?.sifat) ? g.sifat : null,
        bentuk: String(g?.bentuk ?? "").trim() || null,
        susunan: String(g?.susunan ?? "").trim() || null,
        jumlah: String(g?.jumlah ?? "").trim() || null,
      })),
      sel_leukosit: teks(b.sel_leukosit),
      sel_epitel: teks(b.sel_epitel),
      hasil_pewarnaan: teks(b.hasil_pewarnaan),
      kultur_status: b.kultur_status === undefined ? undefined : cekPilihan(b.kultur_status || null, STATUS_KULTUR, "kultur_status"),
      media: teks(b.media),
      mulai_inkubasi: b.mulai_inkubasi === undefined ? undefined : waktuOpsional(b.mulai_inkubasi, "mulai_inkubasi"),
      lama_inkubasi_jam: angkaOpsional(b.lama_inkubasi_jam, "lama_inkubasi_jam"),
      keterangan_kultur: teks(b.keterangan_kultur),
      hasil_teks: teks(b.hasil_teks),
      kesimpulan: teks(b.kesimpulan),
      catatan: teks(b.catatan),
      laporan_sementara: teks(b.laporan_sementara),
      diisi_oleh: req.author.username ?? null,
    };
    if (data.lama_inkubasi_jam != null && (data.lama_inkubasi_jam < 0 || data.lama_inkubasi_jam > 2000)) throw permintaanSalah("lama_inkubasi_jam tidak wajar");
    if (data.gram_temuan?.some((g) => !g.sifat && !g.bentuk)) throw permintaanSalah("Setiap temuan Gram wajib berisi sifat atau bentuk");

    let isolat;
    if (b.isolat !== undefined) {
      if (!Array.isArray(b.isolat)) throw permintaanSalah("isolat harus berupa daftar");
      if (b.isolat.length > 10) throw permintaanSalah("Maksimal 10 isolat per spesimen");
      const orgUuids = [...new Set(b.isolat.map((x) => x?.organisme_uuid).filter(Boolean))];
      if (b.isolat.some((x) => !x?.organisme_uuid))
        throw permintaanSalah("organisme_uuid wajib diisi pada setiap isolat");
      const org = await query(`SELECT uuid, nama, kelompok FROM mikro_organisme WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [orgUuids, faskes]);
      if (org.length !== orgUuids.length) throw permintaanSalah("Sebagian organisme tidak ditemukan");
      const abUuids = [...new Set(b.isolat.flatMap((x) => (x.kepekaan ?? []).map((kp) => kp?.antibiotik_uuid)).filter(Boolean))];
      const ab = abUuids.length
        ? await query(
            `SELECT uuid, kode, nama, bp_zona_s, bp_zona_r, bp_mic_s, bp_mic_r FROM mikro_antibiotik WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL`,
            [abUuids, faskes],
          )
        : [];
      if (ab.length !== abUuids.length) throw permintaanSalah("Sebagian antibiotik tidak ditemukan");
      const panel = await query(
        `SELECT kelompok, antibiotik_uuid, urutan, bp_zona_s, bp_zona_r, bp_mic_s, bp_mic_r FROM mikro_panel_antibiotik
          WHERE faskes_uuid = $1 AND deleted_at IS NULL AND antibiotik_uuid = ANY($2)`,
        [faskes, abUuids],
      );
      isolat = b.isolat.map((x, n) => {
        const o = org.find((r) => r.uuid === x.organisme_uuid);
        const penanda = [...new Set((x.penanda ?? []).map(String))];
        const salah = penanda.filter((pp) => !PENANDA[pp]);
        if (salah.length) throw permintaanSalah(`Penanda resistensi tidak dikenal: ${salah.join(", ")}`);
        if (!Array.isArray(x.kepekaan ?? [])) throw permintaanSalah("kepekaan harus berupa daftar");
        const sudah = new Set();
        const kepekaan = (x.kepekaan ?? []).map((kp, idx) => {
          const a = ab.find((r) => r.uuid === kp?.antibiotik_uuid);
          if (!a) throw permintaanSalah("antibiotik_uuid wajib diisi pada setiap baris kepekaan");
          if (sudah.has(a.uuid)) throw permintaanSalah(`Antibiotik ${a.nama} ganda pada isolat ${o.nama}`);
          sudah.add(a.uuid);
          const zona = angkaOpsional(kp.zona, `zona ${a.nama}`);
          if (zona != null && (zona < 0 || zona > 100)) throw permintaanSalah(`Zona hambat ${a.nama} tidak wajar`);
          const mic = String(kp.mic ?? "").trim() || null;
          if (mic && mic.length > 20) throw permintaanSalah(`MIC ${a.nama} terlalu panjang`);
          let interpretasi = String(kp.interpretasi ?? "").trim().toUpperCase() || null;
          if (interpretasi && !INTERPRETASI.includes(interpretasi)) throw permintaanSalah(`Interpretasi ${a.nama} harus S, I, atau R`);
          const pn = panel.find((r) => r.kelompok === o.kelompok && r.antibiotik_uuid === a.uuid);
          const bpPanel = pn && (pn.bp_zona_s != null || pn.bp_mic_s != null) ? pn : null;
          if (!interpretasi) interpretasi = tafsir({ zona, mic }, bpPanel ?? a);
          const metode = kp.metode ? cekPilihan(kp.metode, { disk: 1, mic: 1, etest: 1, lain: 1 }, "metode") : zona != null ? "disk" : mic ? "mic" : null;
          return {
            antibiotik_uuid: a.uuid, kode: a.kode, nama: a.nama, urutan: pn?.urutan ?? 100 + idx, metode, mic, zona, interpretasi,
            dilaporkan: kp.dilaporkan === undefined ? true : Boolean(kp.dilaporkan),
          };
        });
        return {
          urutan: n + 1, organisme_uuid: o.uuid, nama_organisme: o.nama, kelompok: o.kelompok,
          jumlah_koloni: String(x.jumlah_koloni ?? "").trim() || null, koloni_cfu: angkaOpsional(x.koloni_cfu, "koloni_cfu") ?? null,
          penanda: `{${penanda.join(",")}}`, catatan: String(x.catatan ?? "").trim() || null, kepekaan,
        };
      });
    }

    await transaksi(async (k) => {
      const { i, o, h } = await kunciItem(req.params.uuid, faskes, k);
      if (["menunggu", "ditolak"].includes(i.status)) throw new Galat(409, "Spesimen belum diterima");
      if (i.status === "selesai" || h?.status === "final") throw new Galat(409, "Hasil sudah final; buka verifikasi untuk merevisi");
      const hasil = h ?? (await sisipkan("mikro_hasil", { faskes_uuid: faskes, item_uuid: i.uuid, spesimen_uuid: i.spesimen_uuid, status: "draft" }, k));
      await ubah("mikro_hasil", hasil.uuid, faskes, data, k);
      if (isolat) {
        await query(`DELETE FROM mikro_isolat WHERE hasil_uuid = $1`, [hasil.uuid], k);
        for (const x of isolat) {
          const { kepekaan, ...baris } = x;
          const iso = await sisipkan("mikro_isolat", { faskes_uuid: faskes, hasil_uuid: hasil.uuid, ...baris, sumber: "manual" }, k);
          for (const kp of kepekaan) await sisipkan("mikro_kepekaan", { faskes_uuid: faskes, isolat_uuid: iso.uuid, ...kp, sumber: "manual" }, k);
        }
      }
      if (i.status === "diterima") await ubah("mikro_order_item", i.uuid, faskes, { status: "diproses" }, k);
      await sinkronOrder(o, k);
    });
    kirim(res, await detailItem(req.params.uuid, faskes), "Hasil mikrobiologi disimpan");
  }),
);

// Laporan sementara (preliminary): mis. "Gram negatif batang, kultur dalam proses". Dapat diterbitkan ulang.
rute.post(
  "/item/:uuid/sementara",
  izinMikro("Pemeriksaan", "LAPORAN SEMENTARA"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const laporan = String(req.body?.laporan_sementara ?? "").trim();
    await transaksi(async (k) => {
      const { i, o, h } = await kunciItem(req.params.uuid, faskes, k);
      if (!["diterima", "diproses", "sementara"].includes(i.status) || !h) throw new Galat(409, `Item berstatus ${i.status}, laporan sementara tidak dapat diterbitkan`);
      const isi = laporan || h.laporan_sementara;
      if (!isi) throw permintaanSalah("laporan_sementara wajib diisi");
      await ubah("mikro_hasil", h.uuid, faskes, { status: "sementara", laporan_sementara: isi, sementara_pada: sekarang(), sementara_oleh: req.author.username ?? null }, k);
      await ubah("mikro_order_item", i.uuid, faskes, { status: "sementara" }, k);
      await sinkronOrder(o, k);
    });
    kirim(res, await detailItem(req.params.uuid, faskes), "Laporan sementara diterbitkan");
  }),
);

// Verifikasi dokter Sp.MK → hasil final. Body: { dokter_mikro_uuid, kesimpulan? }.
rute.post(
  "/item/:uuid/verifikasi",
  izinMikro("Pemeriksaan", "VERIFIKASI"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    if (!b.dokter_mikro_uuid) throw permintaanSalah("dokter_mikro_uuid (dokter Sp.MK pemverifikasi) wajib diisi");
    const dokter = await satu(`SELECT uuid FROM practitioner WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.dokter_mikro_uuid, faskes]);
    if (!dokter) throw permintaanSalah("Dokter pemverifikasi tidak ditemukan");
    await transaksi(async (k) => {
      const { i, o, m, h } = await kunciItem(req.params.uuid, faskes, k);
      if (!["diproses", "sementara"].includes(i.status) || !h) throw new Galat(409, `Item berstatus ${i.status}, belum dapat diverifikasi`);
      const isolat = await satu(`SELECT COUNT(*)::int n FROM mikro_isolat WHERE hasil_uuid = $1 AND deleted_at IS NULL`, [h.uuid], k);
      if (m.dengan_kultur) {
        if (!h.kultur_status || h.kultur_status === "dalam_proses") throw permintaanSalah("Hasil kultur belum ditetapkan (masih dalam proses)");
        if (h.kultur_status === "tumbuh" && !isolat.n) throw permintaanSalah("Kultur tumbuh: identifikasi minimal satu isolat");
      } else if (m.dengan_pewarnaan && !h.hasil_pewarnaan && !(h.gram_temuan ?? []).length) {
        throw permintaanSalah("Hasil pewarnaan belum diisi");
      } else if (!m.dengan_kultur && !m.dengan_pewarnaan && !h.hasil_teks && !h.kesimpulan) {
        throw permintaanSalah("Hasil pemeriksaan belum diisi");
      }
      await ubah(
        "mikro_hasil",
        h.uuid,
        faskes,
        {
          status: "final", dokter_mikro_uuid: b.dokter_mikro_uuid, diverifikasi_oleh: req.author.username ?? null, diverifikasi_pada: sekarang(),
          kesimpulan: b.kesimpulan === undefined ? undefined : teks(b.kesimpulan),
        },
        k,
      );
      await ubah("mikro_order_item", i.uuid, faskes, { status: "selesai" }, k);
      await sinkronOrder(o, k);
    });
    kirim(res, await detailItem(req.params.uuid, faskes), "Hasil diverifikasi (final)");
  }),
);

// Buka verifikasi untuk revisi (amandemen). Alasan dicatat pada catatan hasil.
rute.post(
  "/item/:uuid/buka-verifikasi",
  izinMikro("Pemeriksaan", "VERIFIKASI"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const alasan = String(req.body?.alasan ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    await transaksi(async (k) => {
      const { i, o, h } = await kunciItem(req.params.uuid, faskes, k);
      if (i.status !== "selesai" || h?.status !== "final") throw new Galat(409, "Hasil belum final");
      const kembali = h.sementara_pada ? "sementara" : "draft";
      const tgl = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }).format(new Date());
      await ubah(
        "mikro_hasil",
        h.uuid,
        faskes,
        { status: kembali, catatan: [h.catatan, `[Revisi ${tgl} oleh ${req.author.username ?? "-"}: ${alasan}]`].filter(Boolean).join("\n") },
        k,
      );
      await ubah("mikro_order_item", i.uuid, faskes, { status: kembali === "sementara" ? "sementara" : "diproses" }, k);
      await sinkronOrder(o, k);
    });
    kirim(res, await detailItem(req.params.uuid, faskes), "Verifikasi dibuka untuk revisi");
  }),
);

export default rute;
