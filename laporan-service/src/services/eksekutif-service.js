import { v7 as uuidv7 } from "uuid"
import { catatPeristiwaAudit } from "@opensimrs/model-sdk/audit-sequelize"
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran"
import sequelizeInstance from "../config/sequelize-db.js"
import EksekutifRepository from "../repositories/eksekutif-repository.js"
import EksekutifValidator from "../validations/eksekutif-validation.js"
import ZodValidator from "../validations/zod-validator.js"
import BadRequestException from "../exceptions/bad-request-exception.js"
import { GalatIzin } from "../helpers/izin.js"
import { dateToEpoch } from "../helpers/date-helper.js"
import {
  INDIKATOR_BELUM_TERSEDIA, KATALOG_INDIKATOR, STATUS_DATA, ZONA_WAKTU, bagiAman, bulatkan, cariIndikator, hariPeriode,
  hitungIndikatorRawatInap, periodeSebelumnya, perubahanPersen, statusTarget, targetBerlaku,
} from "../helpers/indikator-eksekutif.js"

// Dashboard Eksekutif (STD-0034): orkestrasi sumber agregat lintas modul. Setiap sumber diambil terpisah
// (Promise.allSettled) sehingga kegagalan satu sumber hanya menandai indikator terkait "gagal" (KT-6/KT-16) dan
// tidak pernah diganti nol. Cakupan faskes berasal dari JWT; hanya super admin yang boleh memilih faskes lain
// (faskes manapun yang terdaftar, sama dengan hak ganti faskes super admin di auth-service).
const sekarang = () => Math.floor(Date.now() / 1000)

const tanggalHariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_WAKTU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

const ambilAman = async (sumber) => {
  const kunci = Object.keys(sumber)
  const hasil = await Promise.allSettled(kunci.map((k) => sumber[k]()))
  return Object.fromEntries(hasil.map((h, i) => {
    if (h.status === "rejected") console.error(`[dashboard-eksekutif] sumber ${kunci[i]} gagal:`, h.reason?.message ?? h.reason)
    return [kunci[i], h.status === "fulfilled" ? { ok: true, data: h.value, pada: sekarang() } : { ok: false, galat: h.reason?.message ?? "Gagal mengambil data" }]
  }))
}

export default class EksekutifService {
  // Daftar faskes yang boleh dihitung untuk permintaan ini (KF-2/KT-2).
  static async cakupanFaskes(author, diminta = []) {
    const milikToken = author?.faskesUuid
    if (!diminta.length) {
      if (!milikToken) throw new BadRequestException("Faskes aktif tidak ditemukan pada token; pilih faskes terlebih dahulu")
      diminta = [milikToken]
    } else if (!isSuperadmin(author) && diminta.some((f) => f !== milikToken)) {
      throw new GalatIzin("Akses ditolak: faskes yang dipilih di luar cakupan akses Anda")
    }
    const ada = await EksekutifRepository.faskesAda(diminta)
    if (ada.length !== diminta.length) throw new BadRequestException("Faskes yang dipilih tidak ditemukan")
    return ada
  }

  static async ringkasan(author, query, { ekspor = false } = {}) {
    const filter = ZodValidator.validate(EksekutifValidator.RINGKASAN, query)
    const daftarFaskes = await EksekutifService.cakupanFaskes(author, filter.faskes_uuid)
    const faskes = daftarFaskes.map((f) => f.uuid)
    const mulai = filter.startDate
    const selesai = filter.endDate
    const hari = hariPeriode(mulai, selesai)
    const lalu = periodeSebelumnya(mulai, selesai)
    const p = { faskes, mulai, selesai }
    const pLalu = { faskes, mulai: lalu.mulai, selesai: lalu.selesai }
    const satuFaskes = faskes.length === 1

    const s = await ambilAman({
      kunjungan: () => EksekutifRepository.kunjungan(p),
      kunjunganLalu: () => EksekutifRepository.kunjungan(pLalu),
      rawatInap: () => EksekutifRepository.komponenRawatInap(p),
      rawatInapLalu: () => EksekutifRepository.komponenRawatInap(pLalu),
      waktuTunggu: () => EksekutifRepository.waktuTunggu(p),
      waktuTungguLalu: () => EksekutifRepository.waktuTunggu(pLalu),
      keuangan: () => EksekutifRepository.keuangan(p),
      keuanganLalu: () => EksekutifRepository.keuangan(pLalu),
      sep: () => EksekutifRepository.sepBpjs(p),
      sepLalu: () => EksekutifRepository.sepBpjs(pLalu),
      mutu: () => EksekutifRepository.mutu({ faskes, hariIni: dateToEpoch(tanggalHariIni()) }),
      sdm: () => EksekutifRepository.sdm({ faskes }),
      tren: () => EksekutifRepository.tren(p, hari > 62 ? "month" : "day"),
      target: () => (satuFaskes ? EksekutifRepository.daftarTarget(faskes[0]) : Promise.resolve([])),
    })

    const nilaiRi = (sumber) => (sumber.ok ? hitungIndikatorRawatInap({
      hariPerawatan: sumber.data.hari_perawatan, tempatTidur: sumber.data.tempat_tidur, hari,
      keluar: sumber.data.keluar, lamaDirawat: sumber.data.lama_dirawat, mati: sumber.data.mati, mati48: sumber.data.mati_48,
    }) : null)
    const ri = nilaiRi(s.rawatInap)
    const riLalu = nilaiRi(s.rawatInapLalu)
    const jumlahSep = (sumber) => (sumber.ok ? sumber.data.reduce((a, x) => a + Number(x.jumlah || 0), 0) : null)
    const ratarataTunggu = (sumber) => (sumber.ok && Number(sumber.data.sampel) > 0 ? Number(sumber.data.rata_rata) : null)

    // kode → { sumber, nilai, nilaiLalu, komponen, alasan (bila belum dapat dihitung), posisi saat ini? }
    const bahan = {
      kunjungan_rj: { sumber: s.kunjungan, lalu: s.kunjunganLalu, ambil: (d) => d.kunjungan_rj },
      kunjungan_ri: { sumber: s.kunjungan, lalu: s.kunjunganLalu, ambil: (d) => d.kunjungan_ri },
      kunjungan_igd: { sumber: s.kunjungan, lalu: s.kunjunganLalu, ambil: (d) => d.kunjungan_igd },
      ...Object.fromEntries(["bor", "alos", "toi", "bto", "gdr", "ndr"].map((k) => [k, {
        sumber: s.rawatInap, lalu: s.rawatInapLalu, nilai: ri?.[k] ?? null, nilaiLalu: riLalu?.[k] ?? null,
        komponen: s.rawatInap.ok ? { ...s.rawatInap.data, hari_periode: hari } : null,
        alasan: !s.rawatInap.ok ? null : Number(s.rawatInap.data.tempat_tidur) === 0 && ["bor", "toi", "bto"].includes(k)
          ? "Jumlah tempat tidur (TT) belum diisi di data bed rawat inap"
          : "Belum ada pasien keluar rawat inap pada periode ini",
      }])),
      waktu_tunggu_rj: {
        sumber: s.waktuTunggu, lalu: s.waktuTungguLalu, nilai: ratarataTunggu(s.waktuTunggu), nilaiLalu: ratarataTunggu(s.waktuTungguLalu),
        komponen: s.waktuTunggu.ok ? {
          sampel: s.waktuTunggu.data.sampel, median: s.waktuTunggu.data.median === null ? null : bulatkan(Number(s.waktuTunggu.data.median), 0),
          persen_dalam_60_menit: bulatkan((bagiAman(s.waktuTunggu.data.dalam_60_menit, s.waktuTunggu.data.sampel) ?? NaN) * 100, 1),
          diabaikan: s.waktuTunggu.data.diabaikan,
        } : null,
        alasan: "Belum ada kunjungan rawat jalan dengan waktu check-in dan mulai diperiksa pada periode ini",
      },
      pendapatan: { sumber: s.keuangan, lalu: s.keuanganLalu, ambil: (d) => d.pendapatan, komponen: s.keuangan.ok ? { jumlah_tagihan: s.keuangan.data.jumlah_tagihan, per_unit: s.keuangan.data.per_unit, per_penjamin: s.keuangan.data.per_penjamin } : null },
      kas_diterima: { sumber: s.keuangan, lalu: s.keuanganLalu, ambil: (d) => d.kas_diterima, komponen: s.keuangan.ok ? { jumlah_pembayaran: s.keuangan.data.jumlah_pembayaran } : null },
      piutang: { sumber: s.keuangan, lalu: s.keuanganLalu, ambil: (d) => d.piutang, komponen: s.keuangan.ok ? { tagihan_belum_lunas: s.keuangan.data.tagihan_belum_lunas } : null },
      sep_bpjs: { sumber: s.sep, lalu: s.sepLalu, nilai: jumlahSep(s.sep), nilaiLalu: jumlahSep(s.sepLalu), komponen: s.sep.ok ? { per_jenis_pelayanan: s.sep.data } : null },
      kesiapan_akreditasi: {
        sumber: s.mutu, posisi: true,
        nilai: s.mutu.ok ? bagiAman(s.mutu.data.elemen_terbukti * 100, s.mutu.data.total_elemen) : null,
        komponen: s.mutu.ok ? { total_elemen: s.mutu.data.total_elemen, elemen_terbukti: s.mutu.data.elemen_terbukti } : null,
        alasan: "Belum ada instrumen akreditasi aktif dengan elemen penilaian (modul Mutu & Akreditasi)",
      },
      kredensial_kedaluwarsa: {
        sumber: s.mutu, posisi: true, ambil: (d) => d.kredensial_kedaluwarsa,
        komponen: s.mutu.ok ? { kredensial_aktif: s.mutu.data.kredensial_aktif } : null,
      },
      jumlah_pegawai: { sumber: s.sdm, posisi: true, ambil: (d) => d.jumlah_pegawai, komponen: s.sdm.ok ? { nakes: s.sdm.data.nakes, non_nakes: s.sdm.data.non_nakes } : null },
      rasio_nakes_tt: {
        sumber: s.sdm, posisi: true, nilai: s.sdm.ok ? bagiAman(s.sdm.data.nakes, s.sdm.data.tempat_tidur) : null,
        komponen: s.sdm.ok ? { nakes: s.sdm.data.nakes, tempat_tidur: s.sdm.data.tempat_tidur } : null,
        alasan: "Jumlah tempat tidur (TT) belum diisi di data bed rawat inap",
      },
    }

    const targetPerKode = new Map((s.target.ok ? s.target.data : []).map((t) => [t.kode, t]))
    const indikator = KATALOG_INDIKATOR.map((def) => {
      const b = bahan[def.kode]
      const ok = b.sumber.ok
      const mentah = !ok ? null : b.ambil ? Number(b.ambil(b.sumber.data)) : b.nilai
      const nilai = mentah === null || mentah === undefined || !Number.isFinite(mentah) ? null : mentah
      const mentahLalu = b.posisi || !b.lalu?.ok ? null : b.ambil ? Number(b.ambil(b.lalu.data)) : b.nilaiLalu
      const nilaiLalu = mentahLalu === null || mentahLalu === undefined || !Number.isFinite(mentahLalu) ? null : mentahLalu
      const statusData = !ok ? STATUS_DATA.GAGAL : nilai === null ? STATUS_DATA.BELUM_DAPAT_DIHITUNG : STATUS_DATA.TERSEDIA
      const berlaku = satuFaskes ? targetBerlaku(targetPerKode.get(def.kode), def, hari) : null
      return {
        kode: def.kode,
        nama: def.nama,
        kelompok: def.kelompok,
        satuan: def.satuan,
        rumus: def.rumus,
        status_data: statusData,
        keterangan: statusData === STATUS_DATA.GAGAL ? "Sumber data gagal dimuat" : statusData === STATUS_DATA.BELUM_DAPAT_DIHITUNG ? (b.alasan ?? "Belum ada data") : null,
        nilai: statusData === STATUS_DATA.TERSEDIA ? bulatkan(nilai, def.desimal) : null,
        nilai_sebelumnya: statusData === STATUS_DATA.TERSEDIA && nilaiLalu !== null ? bulatkan(nilaiLalu, def.desimal) : null,
        perubahan_persen: statusData === STATUS_DATA.TERSEDIA ? bulatkan(perubahanPersen(nilai, nilaiLalu), 1) : null,
        komponen: b.komponen ?? null,
        target: berlaku ? { min: bulatkan(berlaku.min, 2), maks: bulatkan(berlaku.maks, 2), toleransi_persen: berlaku.toleransi_persen, disesuaikan_periode: berlaku.disesuaikan_periode } : null,
        status_target: statusData === STATUS_DATA.TERSEDIA ? statusTarget(nilai, berlaku) : null,
        acuan: def.acuan,
        skala: def.skala,
        periode: b.posisi ? { posisi_saat_ini: true } : { mulai, selesai },
        dimensi_rincian: def.dimensi_rincian,
        diperbarui_pada: ok ? b.sumber.pada : null,
      }
    })

    return {
      periode: { mulai, selesai, hari, zona_waktu: ZONA_WAKTU, pembanding: lalu },
      faskes: daftarFaskes,
      target_berlaku: satuFaskes,
      diperbarui_pada: sekarang(),
      indikator,
      belum_tersedia: INDIKATOR_BELUM_TERSEDIA.map((x) => ({ ...x, status_data: STATUS_DATA.BELUM_TERSEDIA })),
      tren: s.tren.ok
        ? { status_data: STATUS_DATA.TERSEDIA, satuan: hari > 62 ? "bulan" : "hari", data: s.tren.data }
        : { status_data: STATUS_DATA.GAGAL, satuan: null, data: [] },
      ...(ekspor ? { dicetak_oleh: author?.name ?? author?.username ?? null } : {}),
    }
  }

  static async rincian(author, kode, query) {
    const filter = ZodValidator.validate(EksekutifValidator.RINCIAN, { ...query, kode })
    const daftarFaskes = await EksekutifService.cakupanFaskes(author, filter.faskes_uuid)
    const indikator = cariIndikator(filter.kode)
    const baris = await EksekutifRepository.rincian(filter.kode, filter.dimensi, {
      faskes: daftarFaskes.map((f) => f.uuid), mulai: filter.startDate, selesai: filter.endDate,
    })
    return {
      kode: indikator.kode,
      nama: indikator.nama,
      satuan: indikator.satuan,
      dimensi: filter.dimensi,
      periode: { mulai: filter.startDate, selesai: filter.endDate, zona_waktu: ZONA_WAKTU },
      faskes: daftarFaskes,
      baris: (baris ?? []).map((r) => ({ label: r.label, nilai: r.nilai === null ? null : Number(r.nilai), jumlah: r.jumlah ?? null })),
      diperbarui_pada: sekarang(),
    }
  }

  static async ekspor(author, body) {
    const hasil = await EksekutifService.ringkasan(author, body, { ekspor: true })
    await catatPeristiwaAudit(sequelizeInstance, {
      faskes_uuid: author?.faskesUuid ?? hasil.faskes[0]?.uuid,
      layanan: "laporan",
      aksi: "ekspor",
      entitas: "dashboard_eksekutif",
      identitas_akun: author?.username,
      pengguna_uuid: author?.user_uuid,
      peran: author?.role,
      ringkasan_perubahan: { periode: `${hasil.periode.mulai} s.d. ${hasil.periode.selesai}`, faskes: hasil.faskes.map((f) => f.uuid) },
    }).catch(() => {})
    return hasil
  }

  // Target KPI hanya untuk faskes aktif pada token (target berbeda per faskes).
  static async daftarTarget(author) {
    if (!author?.faskesUuid) throw new BadRequestException("Faskes aktif tidak ditemukan pada token")
    const target = await EksekutifRepository.daftarTarget(author.faskesUuid)
    return {
      faskes_uuid: author.faskesUuid,
      katalog: KATALOG_INDIKATOR.map(({ kode, nama, kelompok, satuan, skala, acuan, rumus }) => ({ kode, nama, kelompok, satuan, skala, acuan, rumus })),
      target,
    }
  }

  static async simpanTarget(author, body) {
    if (!author?.faskesUuid) throw new BadRequestException("Faskes aktif tidak ditemukan pada token")
    const { target } = ZodValidator.validate(EksekutifValidator.TARGET, body)
    await EksekutifRepository.simpanTarget(author.faskesUuid, target, author.username ?? null, uuidv7)
    await catatPeristiwaAudit(sequelizeInstance, {
      faskes_uuid: author.faskesUuid,
      layanan: "laporan",
      aksi: "ubah",
      entitas: "dashboard_target_kpi",
      identitas_akun: author.username,
      pengguna_uuid: author.user_uuid,
      peran: author.role,
      ringkasan_perubahan: { target },
    }).catch(() => {})
    return EksekutifService.daftarTarget(author)
  }
}
