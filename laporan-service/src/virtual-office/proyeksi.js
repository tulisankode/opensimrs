// Proyeksi sintetis terisolasi; tidak menerima payload transaksi dari API pengguna.
export class ProyeksiSimulasi {
  constructor(konfigurasi) {
    this.konfigurasi = konfigurasi
    this.pekerjaan = new Map()
    this.event = new Set()
  }
  terapkan(event) {
    const kunci = JSON.stringify([event.faskes_uuid, event.source_service, event.source_kind, event.source_uuid])
    const identitas = JSON.stringify([event.faskes_uuid, event.source_service, event.event_uuid])
    if (!Number.isSafeInteger(event.source_revision) || event.source_revision < 1) return "tidak_valid"
    if (this.event.has(identitas)) return "duplikat"
    const lama = this.pekerjaan.get(kunci)
    if (lama && event.source_revision <= lama.revisi) return event.source_revision === lama.revisi ? "konflik" : "terlambat"
    if (!this.konfigurasi.unit.some((u) => u.kode_unit === event.kode_unit)) return "belum_dipetakan"
    const status = Object.hasOwn(this.konfigurasi.pemetaan, event.event_type) ? this.konfigurasi.pemetaan[event.event_type] : "belum_dipetakan"
    this.event.add(identitas)
    this.pekerjaan.set(kunci, { faskes: event.faskes_uuid, unit: event.kode_unit, revisi: event.source_revision, status })
    return status
  }
  ringkasan(faskes, kodeUnit) {
    const hasil = { antre: 0, aktif: 0, tertunda: 0, selesai: 0, belum_dipetakan: 0, perlu_perhatian: 0, waktu_tunggu: null, sla: null }
    const kelompok = { antre: "antre", diproses: "aktif", selesai: "selesai", belum_dipetakan: "belum_dipetakan", menunggu_dependensi: "tertunda", menunggu_validasi: "tertunda", terhambat: "tertunda", perlu_perhatian: "perlu_perhatian" }
    for (const p of this.pekerjaan.values()) {
      if (p.faskes === faskes && p.unit === kodeUnit) hasil[kelompok[p.status]]++
    }
    return hasil
  }
}
