// Penjadwal tugas agen (±60 detik): melanjutkan tugas tunda_kuota yang jam reset kuotanya sudah tiba, lalu memulai
// tugas yang menunggu slot agen (maks_agen_bersamaan). Diam bila Studio tidak aktif (STUDIO_PENGEMBANG, Mode
// Pengembang mati, atau kill switch). Aman bila beberapa proses studio-service berjalan: tugas diklaim atomik.
import config from "./config.js";
import { query, sekarang } from "./db.js";
import { bacaSemua } from "./pengaturan.js";
import { lanjutkanTugasTunda, mulaiAntrianSlot } from "./alur.js";

// Klaim atomik: hanya satu proses yang berhasil mengubah baris tunda_kuota → dilanjutkan (UPDATE ... RETURNING).
export const SQL_KLAIM_TUNDA = `UPDATE studio_tugas SET status = 'dilanjutkan', updated_at = $1
  WHERE status = 'tunda_kuota' AND lanjut_pada IS NOT NULL AND lanjut_pada <= $1 RETURNING *`;

export const klaimTundaJatuhTempo = (waktu = sekarang(), klien = undefined) => query(SQL_KLAIM_TUNDA, [waktu], klien);

let sedangBerjalan = false;
let galatTerakhir = null;

export const detak = async ({ lanjutkan = lanjutkanTugasTunda, mulaiSlot = mulaiAntrianSlot, klien = undefined } = {}) => {
  if (sedangBerjalan || !config.aktifInstalasi) return { dilanjutkan: 0, dimulai: 0 };
  sedangBerjalan = true;
  try {
    const { nilai } = await bacaSemua();
    if (!nilai.mode_pengembang?.aktif || nilai.kill_switch?.aktif) return { dilanjutkan: 0, dimulai: 0 };
    const jatuhTempo = await klaimTundaJatuhTempo(sekarang(), klien);
    for (const t of jatuhTempo) {
      await lanjutkan(t).catch(async (e) => {
        console.error("[studio] gagal melanjutkan tugas tunda kuota:", e.message);
        await query(`UPDATE studio_tugas SET status = 'gagal', pesan_galat = $2, selesai = $3, updated_at = $3 WHERE uuid = $1`,
          [t.uuid, `Gagal dilanjutkan otomatis: ${e.message}`, sekarang()], klien).catch(() => {});
      });
    }
    const dimulai = await mulaiSlot();
    galatTerakhir = null;
    return { dilanjutkan: jatuhTempo.length, dimulai };
  } catch (e) {
    // Tabel belum dimigrasi / DB mati: catat sekali, jangan membanjiri log tiap menit.
    if (galatTerakhir !== e.message) console.error("[studio] penjadwal:", e.message);
    galatTerakhir = e.message;
    return { dilanjutkan: 0, dimulai: 0 };
  } finally {
    sedangBerjalan = false;
  }
};

export const mulaiPenjadwal = (selang = 60_000) => {
  if (!config.aktifInstalasi) return null;
  setTimeout(() => detak(), 10_000).unref?.();
  const p = setInterval(() => detak(), selang);
  p.unref?.();
  return p;
};
