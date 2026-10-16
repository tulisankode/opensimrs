import express from "express";
import config from "./config.js";
import rute from "./rute.js";
import { query, sekarang } from "./db.js";

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
const prosesHidup = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
query(`SELECT uuid, status, pid, created_at FROM studio_tugas WHERE status IN ('antri', 'jalan')`)
  .then(async (tertinggal) => {
    for (const t of tertinggal) {
      const hidup = t.pid ? prosesHidup(Number(t.pid)) : t.status === "antri" && sekarang() - Number(t.created_at) < 300;
      if (hidup) continue;
      await query(
        `UPDATE studio_tugas SET status = 'gagal', pesan_galat = 'studio-service dimulai ulang saat tugas berjalan', selesai = $2, updated_at = $2 WHERE uuid = $1`,
        [t.uuid, sekarang()],
      );
    }
  })
  .catch((e) => console.error("[studio] tabel studio_* belum ada? jalankan npm run db:migrate —", e.message));

app.listen(config.port, config.host, () => {
  console.log(`studio-service berjalan di ${config.host}:${config.port}${config.basePath} (repo: ${config.repoDir}, instalasi ${config.aktifInstalasi ? "aktif" : "NONAKTIF"})`);
});
