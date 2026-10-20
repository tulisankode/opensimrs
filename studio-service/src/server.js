import express from "express";
import config from "./config.js";
import rute from "./rute.js";
import { query, sekarang } from "./db.js";
import { mulaiPenjadwal } from "./penjadwal.js";
import { waktuMulaiProses } from "./proses.js";

const app = express();

// CORS sebelum autentikasi: preflight OPTIONS tidak membawa token
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(config.basePath, rute);

// Tugas yang tertinggal saat layanan berhenti tidak bisa dilanjutkan → tandai gagal. Hanya tugas yang proses agennya
// sudah tidak ada (atau masih antri > 5 menit), agar tugas milik instans lain yang masih hidup tidak ikut tertutup.
// Tugas yang menunggu slot agen (menunggu_slot) dan tunda_kuota tidak disentuh: penjadwal melanjutkannya.
// Windows cepat memakai ulang nomor PID (mis. agen yang mati saat restart → PID-nya dipakai node studio-service yang
// baru), jadi PID yang ada belum tentu agen tugas itu: proses yang lahir setelah tugas dimulai dianggap bukan agennya.
const prosesHidup = (pid, mulaiTugas) => {
  try {
    process.kill(pid, 0);
  } catch (e) {
    if (e.code !== "EPERM") return false;
  }
  const lahir = waktuMulaiProses(pid);
  return !(lahir && mulaiTugas && lahir > Number(mulaiTugas) + 5);
};
query(`SELECT uuid, status, pid, mulai, created_at FROM studio_tugas WHERE status IN ('antri', 'jalan') AND NOT COALESCE(menunggu_slot, false)`)
  .then(async (tertinggal) => {
    for (const t of tertinggal) {
      const hidup = t.pid ? prosesHidup(Number(t.pid), t.mulai ?? t.created_at) : t.status === "antri" && sekarang() - Number(t.created_at) < 300;
      if (hidup) continue;
      await query(
        `UPDATE studio_tugas SET status = 'gagal', pesan_galat = 'studio-service dimulai ulang saat tugas berjalan', selesai = $2, updated_at = $2 WHERE uuid = $1`,
        [t.uuid, sekarang()],
      );
    }
  })
  .catch((e) => console.error("[studio] tabel studio_* belum ada? jalankan npm run db:migrate —", e.message));

mulaiPenjadwal();

app.listen(config.port, config.host, () => {
  console.log(`studio-service berjalan di ${config.host}:${config.port}${config.basePath} (repo: ${config.repoDir}, instalasi ${config.aktifInstalasi ? "aktif" : "NONAKTIF"})`);
});
