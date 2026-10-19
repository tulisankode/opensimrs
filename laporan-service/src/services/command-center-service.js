import { v7 as uuidv7 } from "uuid"
import { catatPeristiwaAudit } from "@opensimrs/model-sdk/audit-sequelize"
import sequelizeInstance from "../config/sequelize-db.js"
import CommandCenterRepository from "../repositories/command-center-repository.js"
import CommandCenterValidator from "../validations/command-center-validation.js"
import ZodValidator from "../validations/zod-validator.js"
import BadRequestException from "../exceptions/bad-request-exception.js"
import { punyaIzin } from "../helpers/izin.js"
import { dateToEpoch } from "../helpers/date-helper.js"
import { ZONA_WAKTU } from "../helpers/indikator-eksekutif.js"
import {
  INTERVAL_POLLING_DETIK, KATALOG_AMBANG, STATUS_DATA, SUMBER_AMBANG, bulatkan, evaluasiAmbang, sampelAmbang, statusSetelahTindakan,
  susunAntreanPoli, susunTempatTidur,
} from "../helpers/command-center.js"

// Command Center (STD-0037): dasbor operasional agregat per faskes token. Setiap sumber diambil terpisah
// (Promise.allSettled) sehingga kegagalan satu sumber hanya menandai bagian itu "gagal" (tidak diganti nol) dan
// peringatan dari sumber itu tidak ditutup. Faskes SELALU dari JWT; parameter klien tidak dipakai untuk cakupan.
const sekarang = () => Math.floor(Date.now() / 1000)
const tanggalHariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_WAKTU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

const ambilAman = async (sumber) => {
  const kunci = Object.keys(sumber)
  const hasil = await Promise.allSettled(kunci.map((k) => sumber[k]()))
  return Object.fromEntries(hasil.map((h, i) => {
    if (h.status === "rejected") console.error(`[command-center] sumber ${kunci[i]} gagal:`, h.reason?.message ?? h.reason)
    return [kunci[i], h.status === "fulfilled" ? { ok: true, data: h.value } : { ok: false }]
  }))
}

// Metadata tiap bagian (KF-8): definisi, sumber tabel, waktu pembaruan, status data.
const SUMBER = {
  tempat_tidur: {
    sumber: "Admisi › Monitoring Kamar (room_monitorings, ruangan) dan kunjungan rawat inap (rawat_inaps)",
    definisi: "Bed bertipe Bed yang aktif per ruangan & kelas. Terisi = ada pasien atau status Penuh; kosong = tanpa pasien dengan status Tersedia; status lain tidak dihitung kosong. BOR saat ini = terisi ÷ total bed × 100%.",
  },
  igd: {
    sumber: "Pendaftaran IGD (instalasi_gawat_darurats) dan SPRI rawat inap asal IGD (rawat_inaps)",
    definisi: "Dirawat = kunjungan IGD berstatus dirawat. Lama di IGD dihitung sejak waktu daftar. Menunggu kamar = SPRI rawat inap asal IGD yang belum mendapat bed, lama tunggu sejak SPRI dibuat.",
  },
  antrean_poli: {
    sumber: "Kunjungan rawat jalan hari ini (rawat_jalans) per poli",
    definisi: "Menunggu = sudah check-in/antre belum diperiksa; dilayani = sedang diperiksa; selesai = pulang. Waktu tunggu = mulai diperiksa − check-in (0–24 jam); tunggu terlama = pasien yang masih menunggu.",
  },
  antrean_admisi: {
    sumber: "Antrean admisi hari ini (antrian pelayanan admisi)",
    definisi: "Menunggu = belum dipanggil; dilayani = dipanggil/diproses; selesai = pendaftaran selesai. Lama menunggu dihitung sejak nomor antrean diambil.",
  },
}

const bagian = (kode, sumber, susun, keteranganKosong) => {
  const meta = SUMBER[kode]
  if (!sumber.ok) return { ...meta, status_data: STATUS_DATA.GAGAL, keterangan: "Sumber data gagal dimuat", diperbarui_pada: null }
  const isi = susun(sumber.data)
  const kosong = keteranganKosong?.(isi)
  return {
    ...meta,
    status_data: kosong ? STATUS_DATA.BELUM_TERSEDIA : STATUS_DATA.TERSEDIA,
    keterangan: kosong ?? null,
    diperbarui_pada: sekarang(),
    ...isi,
  }
}

const menit = (x) => bulatkan(x, 0)

// Galat berkode HTTP 4xx (ditangani error-middleware lewat properti code).
const galat = (pesan, kode) => Object.assign(new Error(pesan), { code: kode })

export default class CommandCenterService {
  static async pastikanFitur(author) {
    if (!author?.faskesUuid) throw new BadRequestException("Faskes aktif tidak ditemukan pada token; pilih faskes terlebih dahulu")
    const aktif = await CommandCenterRepository.fiturAktif(author.faskesUuid)
    if (!aktif) throw galat("Fitur Command Center tidak aktif untuk faskes ini (Setting › Manajemen Modul)", 403)
  }

  static async izinAksi(req) {
    const [aturAmbang, tinjau, eskalasi] = await Promise.all([
      punyaIzin(req, "Dashboard", "Command Center", "ATUR AMBANG"),
      punyaIzin(req, "Dashboard", "Command Center", "TINJAU PERINGATAN"),
      punyaIzin(req, "Dashboard", "Command Center", "ESKALASI PERINGATAN"),
    ])
    return { atur_ambang: aturAmbang, tinjau, eskalasi }
  }

  static async ringkasan(req) {
    const author = req.author
    const f = author.faskesUuid
    const now = sekarang()
    const awal = dateToEpoch(tanggalHariIni())
    const p = { f, now, awal, akhir: awal + 86399, zona: ZONA_WAKTU }

    const s = await ambilAman({
      tempatTidur: () => CommandCenterRepository.tempatTidur(p),
      rawatInap: () => CommandCenterRepository.rawatInap(p),
      igd: () => CommandCenterRepository.igd(p),
      perJam: () => CommandCenterRepository.kedatanganIgdPerJam(p),
      poli: () => CommandCenterRepository.antreanPoli(p),
      admisi: () => CommandCenterRepository.antreanAdmisi(p),
      ambang: () => CommandCenterRepository.daftarAmbang(f),
    })

    const tempatTidur = bagian("tempat_tidur", s.tempatTidur, (baris) => {
      const hasil = susunTempatTidur(baris)
      const ri = s.rawatInap.ok ? s.rawatInap.data : null
      hasil.ringkasan.ri_dirawat = ri?.dirawat ?? null
      hasil.ringkasan.ri_menunggu_kamar = ri?.menunggu_kamar ?? null
      return hasil
    }, (isi) => (isi.ringkasan.total === 0 ? "Belum ada bed rawat inap yang terdaftar (Admisi › Monitoring Kamar)" : null))

    const igdOk = s.igd.ok && s.rawatInap.ok
    const igd = bagian("igd", { ok: igdOk, data: s.igd.data }, (d) => {
      const ri = s.rawatInap.data
      const perJam = Array.from({ length: 24 }, () => 0)
      for (const r of s.perJam.ok ? s.perJam.data : []) if (r.jam >= 0 && r.jam < 24) perJam[r.jam] = Number(r.jumlah)
      return {
        ringkasan: {
          dirawat: d.dirawat ?? 0,
          kedatangan_hari_ini: d.kedatangan_hari_ini ?? 0,
          keluar_hari_ini: d.keluar_hari_ini ?? 0,
          rata_lama_dirawat_menit: menit(d.rata_lama_dirawat_menit),
          terlama_dirawat_menit: menit(d.terlama_dirawat_menit),
          rata_lama_keluar_menit: menit(d.rata_lama_keluar_menit),
          menunggu_kamar: ri.menunggu_kamar_igd ?? 0,
          menunggu_kamar_terlama_menit: menit(ri.menunggu_kamar_igd_terlama_menit),
          menunggu_kamar_rata_menit: menit(ri.menunggu_kamar_igd_rata_menit),
        },
        kedatangan_per_jam: s.perJam.ok ? perJam : null,
      }
    })

    const antreanPoli = bagian("antrean_poli", s.poli, susunAntreanPoli)

    const antreanAdmisi = bagian("antrean_admisi", s.admisi, (d) => ({
      ringkasan: {
        menunggu: d.menunggu ?? 0,
        dilayani: d.dilayani ?? 0,
        terlewat: d.terlewat ?? 0,
        selesai: d.selesai ?? 0,
        rata_menunggu_menit: menit(d.rata_menunggu_menit),
        terlama_menunggu_menit: menit(d.terlama_menunggu_menit),
      },
    }))

    // Evaluasi ambang deterministik; hanya kode yang sumbernya berhasil dimuat yang dibuka/ditutup peringatannya.
    const tersedia = (b) => b.status_data !== STATUS_DATA.GAGAL
    const okSumber = {
      tempat_tidur: tersedia(tempatTidur),
      igd: tersedia(igd),
      antrean_poli: tersedia(antreanPoli),
      antrean_admisi: tersedia(antreanAdmisi),
    }
    let peringatan = []
    let statusPeringatan = STATUS_DATA.TERSEDIA
    try {
      if (!s.ambang.ok) throw new Error("Ambang gagal dimuat")
      const pelanggaran = evaluasiAmbang(s.ambang.data, sampelAmbang({
        tempatTidur: okSumber.tempat_tidur ? tempatTidur : null,
        igd: okSumber.igd ? igd : null,
        antreanPoli: okSumber.antrean_poli ? antreanPoli : null,
        antreanAdmisi: okSumber.antrean_admisi ? antreanAdmisi : null,
      }))
      const kodeDievaluasi = KATALOG_AMBANG.map((a) => a.kode).filter((k) => okSumber[SUMBER_AMBANG[k]])
      await CommandCenterRepository.sinkronPeringatan(f, pelanggaran, kodeDievaluasi, uuidv7)
      peringatan = await CommandCenterService.lengkapiPeringatan(f, await CommandCenterRepository.daftarPeringatan(f, { aktif: true }))
    } catch (error) {
      console.error("[command-center] peringatan gagal:", error?.message ?? error)
      statusPeringatan = STATUS_DATA.GAGAL
    }

    return {
      diperbarui_pada: now,
      zona_waktu: ZONA_WAKTU,
      interval_polling_detik: INTERVAL_POLLING_DETIK,
      hari_ini: { mulai: p.awal, selesai: p.akhir },
      izin: await CommandCenterService.izinAksi(req),
      tempat_tidur: tempatTidur,
      igd,
      antrean_poli: antreanPoli,
      antrean_admisi: antreanAdmisi,
      ambang_aktif: s.ambang.ok ? s.ambang.data.filter((a) => a.aktif).length : null,
      status_peringatan: statusPeringatan,
      peringatan,
    }
  }

  static async lengkapiPeringatan(f, daftar) {
    const tindakan = await CommandCenterRepository.tindakanPeringatan(f, daftar.map((p) => p.uuid))
    const nama = new Map(KATALOG_AMBANG.map((a) => [a.kode, a.nama]))
    return daftar.map((p) => ({
      ...p,
      nama: nama.get(p.kode) ?? p.kode,
      tindakan: tindakan.filter((t) => t.peringatan_uuid === p.uuid).map(({ peringatan_uuid, ...t }) => t),
    }))
  }

  static async peringatan(author, query) {
    const f = author.faskesUuid
    const riwayat = query?.status === "riwayat"
    const daftar = await CommandCenterRepository.daftarPeringatan(f, { aktif: !riwayat, batas: riwayat ? 50 : 200 })
    return { status: riwayat ? "riwayat" : "aktif", peringatan: await CommandCenterService.lengkapiPeringatan(f, daftar) }
  }

  static async catatTindakan(author, uuid, body) {
    const t = ZodValidator.validate(CommandCenterValidator.TINDAKAN, { ...body, uuid })
    const hasil = await CommandCenterRepository.catatTindakan(author.faskesUuid, t.uuid, {
      uuid: uuidv7(), jenis: t.jenis, catatan: t.catatan, tujuan: t.jenis === "eskalasi" ? t.tujuan : null,
      petugas: author.username ?? null, petugas_uuid: author.user_uuid ?? null,
    }, statusSetelahTindakan)
    if (hasil === null) throw galat("Peringatan tidak ditemukan", 404)
    if (hasil === "selesai") throw galat("Peringatan sudah selesai (kondisi kembali di bawah ambang)", 409)
    await catatPeristiwaAudit(sequelizeInstance, {
      faskes_uuid: author.faskesUuid,
      layanan: "laporan",
      // Aksi audit terbatas (audit_trail_aksi_check): tindakan baru = "buat", jenis tinjau/eskalasi di ringkasan.
      aksi: "buat",
      entitas: "command_center_tindakan",
      identitas_akun: author.username,
      pengguna_uuid: author.user_uuid,
      peran: author.role,
      ringkasan_perubahan: { jenis: t.jenis, peringatan_uuid: t.uuid, status: hasil.status, tujuan: t.jenis === "eskalasi" ? t.tujuan : undefined },
    }).catch(() => {})
    return hasil
  }

  static async daftarAmbang(author) {
    const ambang = await CommandCenterRepository.daftarAmbang(author.faskesUuid)
    return { faskes_uuid: author.faskesUuid, katalog: KATALOG_AMBANG, ambang }
  }

  static async simpanAmbang(author, body) {
    const { ambang } = ZodValidator.validate(CommandCenterValidator.AMBANG, body)
    await CommandCenterRepository.simpanAmbang(author.faskesUuid, ambang, author.username ?? null, uuidv7)
    await catatPeristiwaAudit(sequelizeInstance, {
      faskes_uuid: author.faskesUuid,
      layanan: "laporan",
      aksi: "ubah",
      entitas: "command_center_ambang",
      identitas_akun: author.username,
      pengguna_uuid: author.user_uuid,
      peran: author.role,
      ringkasan_perubahan: { ambang },
    }).catch(() => {})
    return CommandCenterService.daftarAmbang(author)
  }
}
