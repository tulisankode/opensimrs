import { QueryTypes } from "sequelize"
import sequelize from "../config/sequelize-db.js"

// Sumber data Virtual Office: agregat status TERKINI baris transaksi hari ini (tanggal lokal faskes) per unit.
// Aturan bersama:
// - cakupan selalu `faskes_uuid = :f` (dari JWT, ditentukan snapshot.js), baris terhapus (deleted_at) & batal tidak dihitung;
// - hanya COUNT/AVG yang dipilih: tidak ada nama, No. RM, NIK, diagnosis, atau hasil pemeriksaan pada hasil kueri;
// - setiap transaksi dihitung satu kali menurut status terakhirnya, sehingga perubahan status berulang tidak menggandakan
//   antrean dan status tidak pernah "mundur" karena urutan pembaruan;
// - hanya membaca (SELECT); tidak ada penulisan ke tabel sumber.
// Pemetaan status sumber → menunggu/dilayani/selesai didokumentasikan di docs/virtual-office/pemetaan-status.md.
const pilih = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT })
const satu = async (sql, replacements) => (await pilih(sql, replacements))[0] ?? {}
const angka = (x) => (x === null || x === undefined ? 0 : Number(x) || 0)
const pecahan = (x) => (x === null || x === undefined ? null : Math.round(Number(x) * 10) / 10)
const hitung = (b) => ({ menunggu: angka(b.menunggu), dilayani: angka(b.dilayani), selesai: angka(b.selesai) })
const metrik = (kode, label, nilai, satuan = "") => ({ kode, label, nilai, satuan })

// Pasien IGD berstatus "pelayanan" yang didaftarkan lebih dari 48 jam lalu dianggap data lama yang belum ditutup,
// bukan pasien yang masih berada di IGD.
const BATAS_AKTIF_IGD = 48 * 3600

const pendaftaran = async (p) => {
  const [antrean, reg] = await Promise.all([
    satu(
      `SELECT COUNT(*) FILTER (WHERE COALESCE(status_panggilan, 0) = 0)::int AS menunggu,
              COUNT(*) FILTER (WHERE status_panggilan IN (1, 3))::int AS dilayani,
              COUNT(*) FILTER (WHERE status_panggilan = 4)::int AS selesai,
              COUNT(*) FILTER (WHERE status_panggilan = 2)::int AS terlewat,
              COUNT(*)::int AS total
         FROM antrian
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND pelayanan = 'admisi' AND created_at BETWEEN :awal AND :akhir`,
      p
    ),
    satu(
      `SELECT (SELECT COUNT(*) FROM rawat_jalans WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_rj <> 0
                 AND tanggal_daftar BETWEEN :awal AND :akhir)::int AS rj,
              (SELECT COUNT(*) FROM rawat_jalans WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_rj IN (1, 2)
                 AND tanggal_daftar BETWEEN :awal AND :akhir)::int AS rj_belum_admisi,
              (SELECT COUNT(*) FROM instalasi_gawat_darurats WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_igd <> 0
                 AND tanggal_daftar BETWEEN :awal AND :akhir)::int AS igd,
              (SELECT COUNT(*) FROM rawat_inaps WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_ri <> 0
                 AND tanggal_daftar BETWEEN :awal AND :akhir)::int AS ri`,
      p
    ),
  ])
  const terdaftar = angka(reg.rj) + angka(reg.igd) + angka(reg.ri)
  const pakaiAntrean = angka(antrean.total) > 0
  // Faskes tanpa anjungan antrean admisi: menunggu = booking/check-in RJ yang belum diproses admisi.
  const dasar = pakaiAntrean
    ? hitung(antrean)
    : { menunggu: angka(reg.rj_belum_admisi), dilayani: 0, selesai: Math.max(terdaftar - angka(reg.rj_belum_admisi), 0) }
  return {
    ...dasar,
    keterangan: pakaiAntrean
      ? "Antrean admisi hari ini (menunggu dipanggil, sedang dipanggil/diproses, selesai)."
      : "Belum ada antrean admisi hari ini; dihitung dari pendaftaran kunjungan (booking/check-in belum diproses = menunggu).",
    metrik: [
      metrik("kunjungan_terdaftar", "Kunjungan terdaftar hari ini (RJ + IGD + RI)", terdaftar, "kunjungan"),
      ...(pakaiAntrean ? [metrik("terlewat", "Antrean terlewat", angka(antrean.terlewat), "antrean")] : []),
    ],
  }
}

const rawatJalan = async (p) => {
  const [poli, baris] = await Promise.all([
    pilih(
      `SELECT uuid, name FROM lokasi
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND COALESCE(is_poli, false) = true AND COALESCE(status, true) = true
        ORDER BY name`,
      p
    ),
    pilih(
      `SELECT x.lokasi_uuid AS kode, l.name AS nama,
              COUNT(*) FILTER (WHERE x.status_rj IN (1, 2, 3))::int AS menunggu,
              COUNT(*) FILTER (WHERE x.status_rj = 4)::int AS dilayani,
              COUNT(*) FILTER (WHERE x.status_rj = 5)::int AS selesai,
              AVG((x.tanggal_periksa - COALESCE(x.tanggal_checkin, x.tanggal_daftar)) / 60.0)
                FILTER (WHERE x.tanggal_periksa IS NOT NULL
                          AND x.tanggal_periksa - COALESCE(x.tanggal_checkin, x.tanggal_daftar) BETWEEN 0 AND 86400) AS tunggu
         FROM rawat_jalans x LEFT JOIN lokasi l ON l.uuid = x.lokasi_uuid AND l.faskes_uuid = x.faskes_uuid
        WHERE x.faskes_uuid = :f AND x.deleted_at IS NULL AND x.status_rj <> 0 AND x.tanggal_daftar BETWEEN :awal AND :akhir
        GROUP BY x.lokasi_uuid, l.name`,
      p
    ),
  ])
  const peta = new Map()
  for (const l of poli) peta.set(l.uuid, { kode_ruang: l.uuid, nama: l.name, menunggu: 0, dilayani: 0, selesai: 0, tunggu: null })
  for (const b of baris) {
    const kode = b.kode && (peta.has(b.kode) || b.nama) ? b.kode : "tanpa_poli"
    const ada = peta.get(kode) ?? { kode_ruang: kode, nama: kode === "tanpa_poli" ? "Tanpa poli" : b.nama, menunggu: 0, dilayani: 0, selesai: 0, tunggu: null }
    ada.menunggu += angka(b.menunggu)
    ada.dilayani += angka(b.dilayani)
    ada.selesai += angka(b.selesai)
    ada.tunggu = pecahan(b.tunggu)
    peta.set(kode, ada)
  }
  const ruang = [...peta.values()].map(({ tunggu, ...r }) => ({
    ...r,
    metrik: tunggu === null ? [] : [metrik("waktu_tunggu", "Rata-rata tunggu daftar → diperiksa", tunggu, "menit")],
  }))
  const total = ruang.reduce((a, r) => ({ menunggu: a.menunggu + r.menunggu, dilayani: a.dilayani + r.dilayani, selesai: a.selesai + r.selesai }), { menunggu: 0, dilayani: 0, selesai: 0 })
  const rata = await satu(
    `SELECT AVG((tanggal_periksa - COALESCE(tanggal_checkin, tanggal_daftar)) / 60.0) AS tunggu
       FROM rawat_jalans
      WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_rj <> 0 AND tanggal_daftar BETWEEN :awal AND :akhir
        AND tanggal_periksa IS NOT NULL AND tanggal_periksa - COALESCE(tanggal_checkin, tanggal_daftar) BETWEEN 0 AND 86400`,
    p
  )
  return {
    ...total,
    keterangan: "Kunjungan rawat jalan hari ini per poli: booking/check-in/antre poli = menunggu, diperiksa = dilayani, pulang = selesai.",
    metrik: [
      metrik("kunjungan", "Kunjungan hari ini", total.menunggu + total.dilayani + total.selesai, "kunjungan"),
      metrik("jumlah_poli", "Poli aktif", ruang.filter((r) => r.kode_ruang !== "tanpa_poli").length, "poli"),
      ...(rata.tunggu === null || rata.tunggu === undefined ? [] : [metrik("waktu_tunggu", "Rata-rata tunggu daftar → diperiksa", pecahan(rata.tunggu), "menit")]),
    ],
    ruang,
    masuk: { pendaftaran: total.menunggu + total.dilayani + total.selesai },
  }
}

const igd = async (p) => {
  const b = await satu(
      `SELECT COUNT(*) FILTER (WHERE status_igd = 1 AND rekam_medis_uuid IS NULL AND tanggal_daftar >= :batasIgd)::int AS menunggu,
              COUNT(*) FILTER (WHERE status_igd = 1 AND rekam_medis_uuid IS NOT NULL AND tanggal_daftar >= :batasIgd)::int AS dilayani,
              COUNT(*) FILTER (WHERE status_igd = 2 AND discharge_date BETWEEN :awal AND :akhir)::int AS selesai,
              COUNT(*) FILTER (WHERE tanggal_daftar BETWEEN :awal AND :akhir)::int AS masuk
         FROM instalasi_gawat_darurats
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_igd <> 0
          AND (tanggal_daftar >= :batasIgd OR discharge_date BETWEEN :awal AND :akhir)`,
      p
    )
  return {
    ...hitung(b),
    keterangan: "Pasien IGD aktif (≤ 48 jam): belum ada asesmen rekam medis = menunggu, sudah diasesmen = dilayani; pulang hari ini = selesai.",
    metrik: [metrik("masuk_hari_ini", "Pasien masuk hari ini", angka(b.masuk), "pasien")],
  }
}

const rawatInap = async (p) => {
  const [ruangan, pasien, asal] = await Promise.all([
    pilih(
      `SELECT r.uuid, r.name,
              COUNT(rm.uuid) FILTER (WHERE rm.type = 'Bed' AND COALESCE(rm.status, true) = true)::int AS bed,
              COUNT(rm.uuid) FILTER (WHERE rm.type = 'Bed' AND COALESCE(rm.status, true) = true AND rm.patient_uuid IS NOT NULL)::int AS terisi
         FROM ruangan r
         LEFT JOIN room_monitorings rm ON rm.room_uuid = r.uuid AND rm.faskes_uuid = r.faskes_uuid AND rm.deleted_at IS NULL
        WHERE r.faskes_uuid = :f AND r.deleted_at IS NULL AND COALESCE(r.status, true) = true
        GROUP BY r.uuid, r.name ORDER BY r.name`,
      p
    ),
    pilih(
      `SELECT COALESCE(rm.room_uuid, ru.uuid) AS kode,
              COUNT(*) FILTER (WHERE x.status_ri = 1)::int AS menunggu,
              COUNT(*) FILTER (WHERE x.status_ri IN (2, 3))::int AS dilayani,
              COUNT(*) FILTER (WHERE x.status_ri = 4)::int AS selesai,
              COUNT(*) FILTER (WHERE COALESCE(x.tanggal_dirawat, x.tanggal_daftar) BETWEEN :awal AND :akhir)::int AS masuk
         FROM rawat_inaps x
         LEFT JOIN room_monitorings rm ON rm.uuid = x.monitoring_room_uuid AND rm.faskes_uuid = x.faskes_uuid
         LEFT JOIN ruangan ru ON ru.uuid = x.lokasi_uuid AND ru.faskes_uuid = x.faskes_uuid
        WHERE x.faskes_uuid = :f AND x.deleted_at IS NULL
          AND (x.status_ri IN (1, 2, 3) OR (x.status_ri = 4 AND x.discharge_date BETWEEN :awal AND :akhir))
        GROUP BY 1`,
      p
    ),
    satu(
      `SELECT COUNT(*) FILTER (WHERE encounter = 'IGD')::int AS igd, COUNT(*) FILTER (WHERE encounter = 'RJ')::int AS rj
         FROM rawat_inaps
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_ri <> 0 AND tanggal_daftar BETWEEN :awal AND :akhir`,
      p
    ),
  ])
  const peta = new Map()
  for (const r of ruangan) peta.set(r.uuid, { kode_ruang: r.uuid, nama: r.name, menunggu: 0, dilayani: 0, selesai: 0, masuk: 0, bed: angka(r.bed), terisi: angka(r.terisi) })
  for (const b of pasien) {
    const kode = b.kode && peta.has(b.kode) ? b.kode : "belum_ditempatkan"
    const ada = peta.get(kode) ?? { kode_ruang: kode, nama: "Belum ditempatkan", menunggu: 0, dilayani: 0, selesai: 0, masuk: 0, bed: 0, terisi: 0 }
    ada.menunggu += angka(b.menunggu)
    ada.dilayani += angka(b.dilayani)
    ada.selesai += angka(b.selesai)
    ada.masuk += angka(b.masuk)
    peta.set(kode, ada)
  }
  // Ruangan tanpa bed dan tanpa pasien (mis. ruang administrasi) tidak ditampilkan sebagai ruang rawat.
  const ruang = [...peta.values()]
    .filter((r) => r.bed > 0 || r.menunggu + r.dilayani + r.selesai > 0)
    .map(({ masuk, bed, terisi, ...r }) => ({
      ...r,
      bor: bed > 0 ? Math.round((terisi / bed) * 1000) / 10 : null,
      metrik: [
        metrik("bed_terisi", "Bed terisi", `${terisi}/${bed}`, "bed"),
        metrik("masuk_hari_ini", "Masuk hari ini", masuk, "pasien"),
      ],
    }))
  const bed = ruangan.reduce((a, r) => a + angka(r.bed), 0)
  const terisi = ruangan.reduce((a, r) => a + angka(r.terisi), 0)
  const total = ruang.reduce((a, r) => ({ menunggu: a.menunggu + r.menunggu, dilayani: a.dilayani + r.dilayani, selesai: a.selesai + r.selesai }), { menunggu: 0, dilayani: 0, selesai: 0 })
  return {
    ...total,
    bor: bed > 0 ? Math.round((terisi / bed) * 1000) / 10 : null,
    keterangan: "Pasien rawat inap saat ini per ruangan: SPRI belum mendapat bed = menunggu, dirawat/pindah = dilayani, pulang hari ini = selesai. Beban = keterisian bed (BOR).",
    metrik: [
      metrik("bed_terisi", "Bed terisi", `${terisi}/${bed}`, "bed"),
      metrik("bor", "Keterisian bed (BOR)", bed > 0 ? Math.round((terisi / bed) * 1000) / 10 : null, "%"),
    ],
    ruang,
    masuk: { igd: angka(asal.igd), rawat_jalan: angka(asal.rj) },
  }
}

const laboratorium = async (p) => {
  const [b, asal] = await Promise.all([
    satu(
      `SELECT COUNT(*) FILTER (WHERE order_status = 1)::int AS menunggu,
              COUNT(*) FILTER (WHERE order_status = 2)::int AS dilayani,
              COUNT(*) FILTER (WHERE order_status = 3)::int AS selesai,
              COUNT(*) FILTER (WHERE cito = true AND order_status IN (1, 2))::int AS cito
         FROM order_lab
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND order_status <> 0 AND created_at BETWEEN :awal AND :akhir`,
      p
    ),
    pilih(
      `SELECT pelayanan::text AS pelayanan, COUNT(*)::int AS jumlah FROM order_lab
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND order_status <> 0 AND created_at BETWEEN :awal AND :akhir
        GROUP BY 1`,
      p
    ),
  ])
  const dari = Object.fromEntries(asal.map((a) => [a.pelayanan, angka(a.jumlah)]))
  return {
    ...hitung(b),
    keterangan: "Order laboratorium hari ini: order masuk = menunggu, diperiksa/menunggu validasi = dilayani, selesai = selesai.",
    metrik: [metrik("cito", "Order cito belum selesai", angka(b.cito), "order")],
    masuk: { rawat_jalan: dari.rajal ?? 0, igd: dari.igd ?? 0 },
  }
}

const radiologi = async (p) => {
  const [b, asal] = await Promise.all([
    satu(
      `SELECT COUNT(*) FILTER (WHERE status IN ('order', 'valid'))::int AS menunggu,
              COUNT(*) FILTER (WHERE status = 'diperiksa')::int AS dilayani,
              COUNT(*) FILTER (WHERE status = 'selesai')::int AS selesai,
              COUNT(*) FILTER (WHERE cito = true AND status IN ('order', 'valid', 'diperiksa'))::int AS cito
         FROM rad_order
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND status <> 'batal' AND created_at BETWEEN :awal AND :akhir`,
      p
    ),
    pilih(
      `SELECT pelayanan, COUNT(*)::int AS jumlah FROM rad_order
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND status <> 'batal' AND created_at BETWEEN :awal AND :akhir
        GROUP BY 1`,
      p
    ),
  ])
  const dari = Object.fromEntries(asal.map((a) => [a.pelayanan, angka(a.jumlah)]))
  return {
    ...hitung(b),
    keterangan: "Order radiologi hari ini: order/tervalidasi = menunggu, diperiksa = dilayani, selesai = selesai.",
    metrik: [metrik("cito", "Order cito belum selesai", angka(b.cito), "order")],
    masuk: { rawat_jalan: dari.rajal ?? 0, igd: dari.igd ?? 0 },
  }
}

const farmasi = async (p) => {
  const [b, asal] = await Promise.all([
    satu(
      `SELECT COUNT(*) FILTER (WHERE order_status = 1)::int AS menunggu,
              COUNT(*) FILTER (WHERE order_status IN (2, 3, 4))::int AS dilayani,
              COUNT(*) FILTER (WHERE order_status IN (5, 6))::int AS selesai,
              COUNT(*) FILTER (WHERE order_status = 4)::int AS siap
         FROM prescriptions
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND order_status <> 0 AND created_at BETWEEN :awal AND :akhir`,
      p
    ),
    pilih(
      `SELECT jenis_pelayanan::text AS pelayanan, COUNT(*)::int AS jumlah FROM prescriptions
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND order_status <> 0 AND created_at BETWEEN :awal AND :akhir
        GROUP BY 1`,
      p
    ),
  ])
  const dari = Object.fromEntries(asal.map((a) => [a.pelayanan, angka(a.jumlah)]))
  return {
    ...hitung(b),
    keterangan: "Resep hari ini: order resep = menunggu, telaah/penyiapan/siap diserahkan = dilayani, diserahkan = selesai.",
    metrik: [metrik("siap_diserahkan", "Siap diserahkan", angka(b.siap), "resep")],
    masuk: { rawat_jalan: dari.rj ?? 0, igd: dari.igd ?? 0 },
  }
}

const kasir = async (p) => {
  const [b, bayar] = await Promise.all([
    satu(
      `SELECT COUNT(*) FILTER (WHERE close_bill = true AND COALESCE(status, false) = false)::int AS menunggu,
              COUNT(*) FILTER (WHERE close_bill = false AND COALESCE(status, false) = false)::int AS dilayani,
              COUNT(*) FILTER (WHERE COALESCE(status, false) = true)::int AS selesai
         FROM bills
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND merge_with IS NULL AND created_at BETWEEN :awal AND :akhir`,
      p
    ),
    satu(
      `SELECT COUNT(*)::int AS jumlah FROM payment_history
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND created_at BETWEEN :awal AND :akhir`,
      p
    ),
  ])
  return {
    ...hitung(b),
    keterangan: "Tagihan dibuat hari ini: ditutup belum lunas = menunggu pembayaran, tagihan berjalan = dilayani, lunas = selesai.",
    metrik: [metrik("pembayaran", "Transaksi pembayaran hari ini", angka(bayar.jumlah), "transaksi")],
  }
}

export const PEMBACA = { pendaftaran, rawat_jalan: rawatJalan, igd, rawat_inap: rawatInap, laboratorium, radiologi, farmasi, kasir }

// Membaca agregat unit yang diminta. Kegagalan satu sumber tidak menggagalkan snapshot: unit ditandai `galat`
// (tidak pernah ditampilkan sebagai nol).
export const bacaSumber = async (faskes, kodeUnit, { awal, akhir, sekarang }) => {
  const p = { f: faskes, awal, akhir, batasIgd: sekarang - BATAS_AKTIF_IGD }
  const hasil = await Promise.all(
    kodeUnit.map(async (kode) => {
      if (!PEMBACA[kode]) return [kode, { galat: true }]
      try {
        return [kode, await PEMBACA[kode](p)]
      } catch (error) {
        console.error(`Virtual Office: sumber ${kode} gagal dibaca:`, error.message)
        return [kode, { galat: true }]
      }
    })
  )
  return Object.fromEntries(hasil)
}
