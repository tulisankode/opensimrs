// Tata letak denah Virtual Office (fungsi murni, tanpa database). Satuan = petak lantai; sumbu x ke timur, y ke selatan.
// Frontend hanya memproyeksikan koordinat ini ke isometrik, sehingga posisi ruang ditentukan konfigurasi server (KF-14).
// - Unit tunggal = satu ruang ukuran `ukuran_unit`.
// - Unit `per_ruang` (poli, ruangan rawat inap) = zona berisi kisi ruang anak `ukuran_ruang` + `jarak_ruang`.
// - Unit disusun per baris `denah.baris` dari kiri ke kanan; antarbaris/antarunit dipisah koridor `jarak` petak.
export const tataLetak = (unit, denah) => {
  const { jarak = 2, tepi = 1, ukuran_unit: uu = { w: 4, d: 3 }, ukuran_ruang: ur = { w: 3, d: 3 }, jarak_ruang: jr = 1, maks_kolom_ruang: mk = 4 } = denah ?? {}
  const kode = new Set(unit.map((u) => u.kode_unit))
  const baris = (denah?.baris ?? []).map((b) => b.filter((k) => kode.has(k))).filter((b) => b.length)
  const terpakai = new Set(baris.flat())
  const sisa = unit.map((u) => u.kode_unit).filter((k) => !terpakai.has(k))
  if (sisa.length) baris.push(sisa)

  const ukuran = (u) => {
    const n = u.ruang?.length ?? 0
    if (!n) return { w: uu.w, d: uu.d, kolom: 0 }
    // Sampai `maks_kolom_ruang` ruang: satu baris; lebih dari itu: kisi mendekati persegi.
    const kolom = n <= mk ? n : Math.min(mk, Math.ceil(Math.sqrt(n)))
    const jb = Math.ceil(n / kolom)
    return { w: kolom * ur.w + (kolom - 1) * jr + 2, d: jb * ur.d + (jb - 1) * jr + 2, kolom }
  }

  const peta = new Map(unit.map((u) => [u.kode_unit, u]))
  const hasil = new Map()
  let y = tepi
  let lebar = 0
  for (const b of baris) {
    let x = tepi
    let dalam = 0
    for (const k of b) {
      const u = peta.get(k)
      const { w, d, kolom } = ukuran(u)
      const ruang = (u.ruang ?? []).map((r, i) => ({
        ...r,
        posisi: { x: x + 1 + (i % kolom) * (ur.w + jr), y: y + 1 + Math.floor(i / kolom) * (ur.d + jr), w: ur.w, d: ur.d },
      }))
      hasil.set(k, { ...u, posisi: { x, y, w, d }, ...(u.ruang ? { ruang } : {}) })
      x += w + jarak
      dalam = Math.max(dalam, d)
    }
    lebar = Math.max(lebar, x - jarak + tepi)
    y += dalam + jarak
  }
  return { unit: unit.map((u) => hasil.get(u.kode_unit)), denah: { lebar, dalam: y - jarak + tepi } }
}
