import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { rentang, tanggalValid, LABEL_KESIMPULAN } from "./bersama.js";
import { izinMcu } from "../umum/izin.js";
import { flagAbnormal } from "./lab.js";

// Laporan MCU: rekap peserta per periode / perusahaan / paket, distribusi kesimpulan, dan pendapatan.
// ?tanggal_mulai=&tanggal_selesai=&perusahaan_uuid=&paket_uuid=&cara_bayar=
const rute = express.Router();

rute.get(
  "/",
  izinMcu("Laporan MCU", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const awalBulan = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).slice(0, 8) + "01";
    const { mulai, selesai } = rentang(q, awalBulan);
    const p = [req.author.faskesUuid, mulai, selesai];
    let w = "s.faskes_uuid = $1 AND s.deleted_at IS NULL AND s.tanggal BETWEEN $2 AND $3";
    for (const [param, kolom] of [
      ["perusahaan_uuid", "s.perusahaan_uuid"],
      ["paket_uuid", "s.paket_uuid"],
      ["cara_bayar", "s.cara_bayar"],
    ]) {
      if (q[param]) {
        p.push(q[param]);
        w += ` AND ${kolom} = $${p.length}`;
      }
    }
    const AGREGAT = `COUNT(*) FILTER (WHERE s.status <> 'batal')::int AS peserta,
      COUNT(*) FILTER (WHERE s.status = 'terdaftar')::int AS terdaftar,
      COUNT(*) FILTER (WHERE s.status = 'proses')::int AS proses,
      COUNT(*) FILTER (WHERE s.status = 'selesai')::int AS selesai,
      COUNT(*) FILTER (WHERE s.status = 'batal')::int AS batal,
      COUNT(*) FILTER (WHERE s.kesimpulan = 'fit' AND s.status = 'selesai')::int AS fit,
      COUNT(*) FILTER (WHERE s.kesimpulan = 'fit_catatan' AND s.status = 'selesai')::int AS fit_catatan,
      COUNT(*) FILTER (WHERE s.kesimpulan = 'unfit' AND s.status = 'selesai')::int AS unfit,
      COALESCE(SUM(s.harga + s.harga_tambahan) FILTER (WHERE s.status <> 'batal'), 0)::float8 AS pendapatan,
      COALESCE(SUM(s.harga + s.harga_tambahan) FILTER (WHERE s.status <> 'batal' AND s.cara_bayar = 'perorangan'), 0)::float8 AS pendapatan_perorangan,
      COALESCE(SUM(s.harga + s.harga_tambahan) FILTER (WHERE s.status <> 'batal' AND s.cara_bayar = 'korporasi'), 0)::float8 AS pendapatan_korporasi,
      COALESCE(SUM(s.harga + s.harga_tambahan) FILTER (WHERE s.status <> 'batal' AND iv.status IN ('terbit','sebagian','lunas')), 0)::float8 AS korporasi_tertagih,
      COALESCE(SUM(s.harga + s.harga_tambahan) FILTER (WHERE s.status <> 'batal' AND iv.status = 'lunas'), 0)::float8 AS korporasi_lunas,
      COALESCE(SUM(s.harga + s.harga_tambahan) FILTER (WHERE s.status <> 'batal' AND s.cara_bayar = 'korporasi' AND (iv.uuid IS NULL OR iv.status = 'draft')), 0)::float8
        AS korporasi_belum_ditagih`;
    const DARI = `mcu_peserta s
      LEFT JOIN mcu_invoice iv ON iv.uuid = s.invoice_uuid
      LEFT JOIN mcu_perusahaan pr ON pr.uuid = s.perusahaan_uuid
      LEFT JOIN mcu_paket pk ON pk.uuid = s.paket_uuid`;

    // Status pengiriman MCU PCare (STD-0020), hanya peserta berpenjamin BPJS sesuai filter rekap saat ini (KT-17).
    const pcarePromise = query(
      `SELECT COALESCE(pc.status, 'belum') AS status, COUNT(*)::int AS jumlah
         FROM mcu_peserta s LEFT JOIN mcu_pcare_kirim pc ON pc.faskes_uuid = s.faskes_uuid AND pc.peserta_uuid = s.uuid AND pc.deleted_at IS NULL
        WHERE ${w} AND EXISTS (SELECT 1 FROM penjamin pj WHERE pj.uuid = s.penjamin_uuid AND pj.name ILIKE 'BPJS%')
        GROUP BY 1 ORDER BY 1`,
      p,
    );
    const [ringkasan, perPerusahaan, perPaket, perTanggal, perJenis, pcare] = await Promise.all([
      satu(`SELECT ${AGREGAT} FROM ${DARI} WHERE ${w}`, p),
      query(
        `SELECT COALESCE(pr.nama, 'Perorangan') AS nama, s.perusahaan_uuid AS uuid, ${AGREGAT}
           FROM ${DARI} WHERE ${w} GROUP BY pr.nama, s.perusahaan_uuid ORDER BY peserta DESC, nama`,
        p,
      ),
      query(
        `SELECT pk.nama, pk.kode, s.paket_uuid AS uuid, ${AGREGAT}
           FROM ${DARI} WHERE ${w} GROUP BY pk.nama, pk.kode, s.paket_uuid ORDER BY peserta DESC, pk.nama`,
        p,
      ),
      query(`SELECT s.tanggal::text AS tanggal, ${AGREGAT} FROM ${DARI} WHERE ${w} GROUP BY s.tanggal ORDER BY s.tanggal`, p),
      query(`SELECT s.jenis_mcu, COUNT(*) FILTER (WHERE s.status <> 'batal')::int AS peserta FROM ${DARI} WHERE ${w} GROUP BY s.jenis_mcu ORDER BY 2 DESC`, p),
      pcarePromise,
    ]);

    // Temuan terbanyak: kategori IMT dari stasiun tanda vital (indikator kesehatan kerja yang umum dilaporkan).
    const imt = await query(
      `SELECT m.data->>'kategori_imt' AS kategori, COUNT(*)::int AS jumlah
         FROM mcu_pemeriksaan m JOIN mcu_peserta s ON s.uuid = m.peserta_uuid
        WHERE ${w} AND s.status <> 'batal' AND m.stasiun = 'tanda_vital' AND m.data ? 'kategori_imt' AND m.deleted_at IS NULL
        GROUP BY 1 ORDER BY 2 DESC`,
      p,
    );

    // Pembayaran invoice korporasi yang diterima dalam periode (basis kas).
    const pp = [req.author.faskesUuid, mulai, selesai];
    let wb = "b.faskes_uuid = $1 AND b.deleted_at IS NULL AND b.tanggal BETWEEN $2 AND $3";
    if (q.perusahaan_uuid) {
      pp.push(q.perusahaan_uuid);
      wb += ` AND iv.perusahaan_uuid = $${pp.length}`;
    }
    const diterima = await satu(
      `SELECT COALESCE(SUM(b.jumlah), 0)::float8 AS n FROM mcu_invoice_bayar b JOIN mcu_invoice iv ON iv.uuid = b.invoice_uuid WHERE ${wb}`,
      pp,
    );
    ringkasan.korporasi_diterima = diterima.n;

    kirim(res, {
      periode: { mulai, selesai },
      ringkasan,
      per_perusahaan: perPerusahaan,
      per_paket: perPaket,
      per_tanggal: perTanggal,
      per_jenis_mcu: perJenis,
      kategori_imt: imt,
      pcare,
    });
  }),
);

// ── Rekap hasil MCU per perusahaan untuk HRD ─────────────────────────────────
// ?perusahaan_uuid= (wajib) & (?invoice_uuid= | ?tanggal_mulai=&tanggal_selesai=)
// Per karyawan: kesimpulan + temuan utama (IMT, tekanan darah, gula darah, kolesterol, visus/buta warna, radiologi)
// dan ringkasan statistik (distribusi kesimpulan, prevalensi temuan abnormal, rekap per bagian).
const angka = (v) => {
  const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};
const RAD_NORMAL = /(dalam batas normal|tidak tampak kelainan|tak tampak kelainan|tidak ada kelainan|normal)/i;
const VISUS_NORMAL = /^6\/6(\s|$)|^20\/20/;

const temuanPeserta = (r) => {
  const tv = r.tv ?? {};
  const vs = r.visus ?? {};
  const labKunci = Array.isArray(r.lab_kunci) ? r.lab_kunci : [];
  const labManual = Array.isArray(r.lab_manual?.hasil) ? r.lab_manual.hasil : [];
  const cariLab = (pola) => {
    const a = labKunci.find((x) => pola.test(x.nama) && String(x.hasil ?? "").trim() !== "");
    if (a) return { nama: a.nama, nilai: a.hasil, satuan: a.satuan, flag: a.flag };
    const m = labManual.find((x) => pola.test(x.nama ?? "") && String(x.nilai ?? "").trim() !== "");
    return m ? { nama: m.nama, nilai: m.nilai, satuan: m.satuan, flag: m.flag } : null;
  };

  const imt = angka(tv.imt);
  const kategoriImt = tv.kategori_imt ?? null;
  const sis = angka(tv.sistole);
  const dia = angka(tv.diastole);
  const td = sis && dia ? `${sis}/${dia}` : null;
  const tdKategori = !td ? null : sis >= 140 || dia >= 90 ? "Hipertensi" : sis >= 120 || dia >= 80 ? "Pra-hipertensi" : "Normal";

  const gula = cariLab(/glukosa darah|gula darah/i);
  const gulaAbnormal = gula ? (gula.flag ? flagAbnormal(gula.flag) : /puasa/i.test(gula.nama) ? angka(gula.nilai) >= 126 || angka(gula.nilai) < 70 : angka(gula.nilai) >= 200) : null;
  const chol = cariLab(/kolesterol total|^kolesterol$/i);
  const cholAbnormal = chol ? (chol.flag ? flagAbnormal(chol.flag) : angka(chol.nilai) >= 200) : null;

  const od = vs.od ?? null;
  const os = vs.os ?? null;
  const butaWarna = vs.buta_warna ?? vs.butaWarna ?? null;
  const visusAbnormal = od || os ? !(VISUS_NORMAL.test(String(od ?? "")) && VISUS_NORMAL.test(String(os ?? ""))) : null;
  const butaWarnaAbnormal = butaWarna ? !/^normal/i.test(butaWarna) : null;

  const rad = Array.isArray(r.rad) ? r.rad : [];
  const radKesan = rad.map((x) => (x.kesan ? `${x.nama}: ${x.kesan}` : null)).filter(Boolean).join("; ") || null;
  const radDokter = r.rad_mcu?.hasil ?? null;
  const radAbnormal = radDokter ? /abnormal/i.test(radDokter) : rad.some((x) => x.kesan) ? rad.some((x) => x.kesan && !RAD_NORMAL.test(x.kesan)) : null;

  return {
    imt,
    kategori_imt: kategoriImt,
    imt_abnormal: kategoriImt ? kategoriImt !== "Normal" : null,
    tekanan_darah: td,
    kategori_td: tdKategori,
    td_abnormal: tdKategori ? tdKategori === "Hipertensi" : null,
    gula_darah: gula ? `${gula.nilai}${gula.satuan ? " " + gula.satuan : ""}` : null,
    gula_darah_nama: gula?.nama ?? null,
    gula_abnormal: gulaAbnormal,
    kolesterol: chol ? `${chol.nilai}${chol.satuan ? " " + chol.satuan : ""}` : null,
    kolesterol_abnormal: cholAbnormal,
    visus: od || os ? `OD ${od ?? "-"} / OS ${os ?? "-"}` : null,
    visus_abnormal: visusAbnormal,
    buta_warna: butaWarna,
    buta_warna_abnormal: butaWarnaAbnormal,
    radiologi: radKesan ?? (rad.length ? "Hasil belum tersedia" : null),
    radiologi_abnormal: radAbnormal,
  };
};

const TEMUAN = [
  ["imt_abnormal", "IMT tidak normal (kurang/lebih/obesitas)"],
  ["td_abnormal", "Hipertensi (TD >= 140/90 mmHg)"],
  ["gula_abnormal", "Gula darah tidak normal"],
  ["kolesterol_abnormal", "Kolesterol total tinggi"],
  ["visus_abnormal", "Visus tidak normal"],
  ["buta_warna_abnormal", "Buta warna"],
  ["radiologi_abnormal", "Radiologi abnormal / perlu tinjauan"],
];

rute.get(
  "/rekap-hrd",
  izinMcu("Laporan MCU", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const f = req.author.faskesUuid;
    if (!q.perusahaan_uuid) throw permintaanSalah("perusahaan_uuid wajib diisi");
    const perusahaan = await satu(`SELECT uuid, kode, nama, alamat, pic, telepon, email FROM mcu_perusahaan WHERE uuid = $1 AND faskes_uuid = $2`, [q.perusahaan_uuid, f]);
    if (!perusahaan) throw permintaanSalah("Perusahaan tidak ditemukan");
    const p = [f, perusahaan.uuid];
    let w = "s.faskes_uuid = $1 AND s.perusahaan_uuid = $2 AND s.status <> 'batal' AND s.deleted_at IS NULL";
    let invoice = null;
    let periode = null;
    if (q.invoice_uuid) {
      invoice = await satu(`SELECT uuid, no_invoice, periode_mulai::text AS periode_mulai, periode_selesai::text AS periode_selesai FROM mcu_invoice WHERE uuid = $1 AND faskes_uuid = $2`, [q.invoice_uuid, f]);
      if (!invoice) throw permintaanSalah("Invoice tidak ditemukan");
      p.push(invoice.uuid);
      w += ` AND s.invoice_uuid = $${p.length}`;
      periode = { mulai: invoice.periode_mulai, selesai: invoice.periode_selesai };
    } else {
      const awalBulan = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).slice(0, 8) + "01";
      periode = rentang(q, awalBulan);
      p.push(periode.mulai, periode.selesai);
      w += ` AND s.tanggal BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    const rows = await query(
      `SELECT s.uuid, s.no_mcu, s.tanggal::text AS tanggal, s.no_rm, s.nik_karyawan, s.jabatan, s.bagian, s.no_registrasi, s.status,
              s.kesimpulan, s.catatan_kesimpulan, s.saran, pt.name AS nama, pt.gender, DATE_PART('year', AGE(s.tanggal, bd.birth_date))::int AS umur,
              pk.nama AS nama_paket, tv.data AS tv, vs.data AS visus, lb.data AS lab_manual, rd.data AS rad_mcu,
              (SELECT json_agg(json_build_object('nama', ip.name, 'hasil', oi.result, 'flag', oi.flag, 'satuan', ip.satuan))
                 FROM observation_item oi JOIN item_pemeriksaan ip ON ip.uuid = oi.item_pemeriksaan_uuid
                WHERE oi.order_lab_uuid = s.lab_order_uuid AND oi.deleted_at IS NULL
                  AND (ip.name ILIKE '%glukosa darah%' OR ip.name ILIKE 'kolesterol total%')) AS lab_kunci,
              (SELECT json_agg(json_build_object('nama', ri.nama, 'kesan', ri.kesan, 'status', ri.status))
                 FROM rad_order_item ri WHERE ri.order_uuid = s.rad_order_uuid AND ri.deleted_at IS NULL) AS rad
         FROM mcu_peserta s JOIN patients pt ON pt.uuid = s.patient_uuid LEFT JOIN birth_details bd ON bd.uuid = pt.birth_detail_uuid
         JOIN mcu_paket pk ON pk.uuid = s.paket_uuid
         LEFT JOIN mcu_pemeriksaan tv ON tv.peserta_uuid = s.uuid AND tv.stasiun = 'tanda_vital' AND tv.deleted_at IS NULL
         LEFT JOIN mcu_pemeriksaan vs ON vs.peserta_uuid = s.uuid AND vs.stasiun = 'visus' AND vs.deleted_at IS NULL
         LEFT JOIN mcu_pemeriksaan lb ON lb.peserta_uuid = s.uuid AND lb.stasiun = 'laboratorium' AND lb.deleted_at IS NULL
         LEFT JOIN mcu_pemeriksaan rd ON rd.peserta_uuid = s.uuid AND rd.stasiun = 'radiologi' AND rd.deleted_at IS NULL
        WHERE ${w}
        ORDER BY s.bagian NULLS LAST, pt.name`,
      p,
    );
    const peserta = rows.map(({ tv, visus, lab_manual, rad_mcu, lab_kunci, rad, ...r }) => ({
      ...r,
      label_kesimpulan: r.kesimpulan ? LABEL_KESIMPULAN[r.kesimpulan] : null,
      temuan: temuanPeserta({ tv, visus, lab_manual, rad_mcu, lab_kunci, rad }),
    }));
    const total = peserta.length;
    const selesai = peserta.filter((x) => x.status === "selesai");
    const persen = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
    const kesimpulan = ["fit", "fit_catatan", "unfit"].map((kode) => {
      const n = selesai.filter((x) => x.kesimpulan === kode).length;
      return { kode, label: LABEL_KESIMPULAN[kode], jumlah: n, persen: persen(n, selesai.length) };
    });
    const temuan = TEMUAN.map(([kunci, label]) => {
      const diperiksa = peserta.filter((x) => x.temuan[kunci] !== null).length;
      const n = peserta.filter((x) => x.temuan[kunci] === true).length;
      return { kunci, label, jumlah: n, diperiksa, persen: persen(n, diperiksa) };
    });
    const imt = Object.entries(
      peserta.reduce((a, x) => {
        if (x.temuan.kategori_imt) a[x.temuan.kategori_imt] = (a[x.temuan.kategori_imt] ?? 0) + 1;
        return a;
      }, {}),
    ).map(([kategori, jumlah]) => ({ kategori, jumlah }));
    const perBagian = Object.values(
      peserta.reduce((a, x) => {
        const k = x.bagian || "(Tanpa bagian)";
        const r = (a[k] ??= { bagian: k, peserta: 0, selesai: 0, fit: 0, fit_catatan: 0, unfit: 0 });
        r.peserta += 1;
        if (x.status === "selesai") {
          r.selesai += 1;
          if (r[x.kesimpulan] !== undefined) r[x.kesimpulan] += 1;
        }
        return a;
      }, {}),
    );
    kirim(res, {
      perusahaan,
      invoice,
      periode: invoice ? periode : { mulai: periode.mulai, selesai: periode.selesai },
      ringkasan: { total, selesai: selesai.length, belum_selesai: total - selesai.length, kesimpulan, temuan, imt, per_bagian: perBagian },
      peserta,
    });
  }),
);

export default rute;

