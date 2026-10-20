import { onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'

// Utilitas animasi Virtual Office: preferensi gerak berkurang, count-up angka, dan perulangan requestAnimationFrame
// yang berhenti sendiri saat tab tersembunyi atau tidak ada lagi yang dianimasikan.

export const useGerakKurang = () => {
  const kurang = ref(false)
  let mq: MediaQueryList | null = null
  const ubah = () => (kurang.value = !!mq?.matches)
  onMounted(() => {
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      ubah()
      mq.addEventListener?.('change', ubah)
    } catch {
      /* matchMedia tidak tersedia */
    }
  })
  onUnmounted(() => mq?.removeEventListener?.('change', ubah))
  return kurang
}

// Perulangan rAF: `langkah(t)` mengembalikan true selama masih perlu frame berikutnya.
export const buatPerulangan = (langkah: (t: number) => boolean) => {
  let id = 0
  const jalan = (t: number) => {
    id = 0
    if (document.hidden) return
    if (langkah(t)) id = requestAnimationFrame(jalan)
  }
  return {
    mulai: () => { if (!id && !document.hidden) id = requestAnimationFrame(jalan) },
    henti: () => { if (id) cancelAnimationFrame(id); id = 0 },
  }
}

const halus = (u: number) => 1 - Math.pow(1 - u, 3)

// Count-up: nilai tampil bergerak dari angka lama ke angka baru (≈0,9 dtk). Gerak berkurang / tab tersembunyi = langsung.
export const useAngkaHalus = (sumber: () => Record<string, number>, kurang: Ref<boolean>, durasi = 900) => {
  const tampil = shallowRef<Record<string, number>>({ ...sumber() })
  let dari: Record<string, number> = {}
  let ke: Record<string, number> = {}
  let awal = 0
  const loop = buatPerulangan((t) => {
    if (!awal) awal = t
    const u = Math.min(1, (t - awal) / durasi)
    const e = halus(u)
    const baru: Record<string, number> = {}
    for (const k in ke) baru[k] = Math.round((dari[k] ?? ke[k]) + (ke[k] - (dari[k] ?? ke[k])) * e)
    tampil.value = baru
    return u < 1
  })
  watch(sumber, (nilai) => {
    loop.henti()
    if (kurang.value || document.hidden) { tampil.value = { ...nilai }; return }
    dari = { ...tampil.value }
    ke = { ...nilai }
    awal = 0
    loop.mulai()
  })
  onUnmounted(loop.henti)
  return tampil
}
