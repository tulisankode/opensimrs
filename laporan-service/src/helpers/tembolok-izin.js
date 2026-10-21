// Milidetik hanya dipakai untuk umur tembolok di memori, bukan waktu tersimpan atau respons API.
const SIMPAN_MS = 60 * 1000

export const buatTembolok = (jam = Date.now) => {
  const data = new Map()
  return {
    ambil(kunci) {
      const ada = data.get(kunci)
      if (ada && jam() - ada.pada < SIMPAN_MS) return ada.nilai
      return null
    },
    simpan(kunci, nilai) {
      data.set(kunci, { pada: jam(), nilai })
    },
  }
}
