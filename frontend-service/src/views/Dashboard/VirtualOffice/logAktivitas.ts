import type { Snapshot } from './petaIsometrik'
import { WARNA_BEBAN } from './petaIsometrik'

// Log Aktivitas Virtual Office: diturunkan dari SELISIH dua snapshot berurutan (angka agregat), tanpa identitas pasien.
// Disimpan di memori halaman saja (maksimal MAKS_LOG entri terakhir), hilang saat halaman ditutup.
export type EntriLog = { id: string; waktu: number; teks: string; jenis: 'masuk' | 'layan' | 'selesai' | 'alur' | 'beban' | 'info'; kodeUnit?: string; kodeRuang?: string }
export const MAKS_LOG = 50

export const jamLog = (epoch: number) =>
  new Date(epoch * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')

export const turunkanLog = (lama: Snapshot | null, baru: Snapshot): EntriLog[] => {
  if (!lama) return []
  const w = baru.generatedAt
  const hasil: EntriLog[] = []
  const tambah = (e: Omit<EntriLog, 'id' | 'waktu'>) => hasil.push({ ...e, id: `${baru.generatedAt}:${hasil.length}`, waktu: w })
  if (lama.tanggal !== baru.tanggal) {
    tambah({ jenis: 'info', teks: 'Hari baru dimulai — angka kembali dihitung dari nol.' })
    return hasil
  }
  const unitLama = new Map(lama.unit.map((u) => [u.kodeUnit, u]))
  const nama = (kode: string) => baru.unit.find((u) => u.kodeUnit === kode)?.nama ?? kode

  for (const j of baru.jalur) {
    const l = lama.jalur.find((x) => x.asal === j.asal && x.tujuan === j.tujuan)
    const d = l ? j.jumlah - l.jumlah : 0
    const satuan = baru.unit.find((u) => u.kodeUnit === j.tujuan)?.satuan ?? 'transaksi'
    if (d > 0) tambah({ jenis: 'alur', teks: `${d} ${satuan} dari ${nama(j.asal)} ke ${nama(j.tujuan)}`, kodeUnit: j.tujuan })
  }
  for (const u of baru.unit) {
    const l = unitLama.get(u.kodeUnit)
    if (!l || u.terkunci || l.terkunci) continue
    if (u.galat && !l.galat) { tambah({ jenis: 'info', teks: `Data ${u.nama} gagal dimuat`, kodeUnit: u.kodeUnit }); continue }
    if (u.galat || l.galat) continue
    const satuan = u.satuan ?? 'transaksi'
    // Unit berzona dicatat per ruang (mis. "Poli Anak"), unit lain per unit.
    const subjek = u.ruang?.length
      ? u.ruang.map((r) => ({ nama: r.nama, kodeRuang: r.kodeRuang as string | undefined, b: r, a: l.ruang?.find((x) => x.kodeRuang === r.kodeRuang) }))
      : [{ nama: u.nama, kodeRuang: undefined, b: u, a: l }]
    for (const s of subjek) {
      if (!s.a) continue
      const d = (k: 'menunggu' | 'dilayani' | 'selesai') => ((s.b as any)[k] ?? 0) - ((s.a as any)[k] ?? 0)
      const ref = { kodeUnit: u.kodeUnit, kodeRuang: s.kodeRuang }
      if (d('menunggu') > 0) tambah({ jenis: 'masuk', teks: `${d('menunggu')} ${satuan} baru menunggu di ${s.nama}`, ...ref })
      if (d('dilayani') > 0) tambah({ jenis: 'layan', teks: `${d('dilayani')} ${satuan} mulai dilayani di ${s.nama}`, ...ref })
      if (d('selesai') > 0) tambah({ jenis: 'selesai', teks: `${d('selesai')} ${satuan} selesai di ${s.nama}`, ...ref })
    }
    if (u.beban !== l.beban && u.beban && l.beban && (u.beban === 'merah' || l.beban === 'merah')) {
      tambah({ jenis: 'beban', teks: `${u.nama} ${u.beban === 'merah' ? 'menjadi Padat' : `kembali ${WARNA_BEBAN[u.beban].label}`}`, kodeUnit: u.kodeUnit })
    }
  }
  return hasil
}
