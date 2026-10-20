// Waktu mulai proses (epoch detik) untuk membedakan agen sebuah tugas dari proses lain yang kebetulan memakai ulang
// PID-nya. null bila tidak bisa dibaca (proses sudah tidak ada atau perintah sistem gagal).
import { execFileSync } from "child_process";

export const waktuMulaiProses = (pid) => {
  try {
    if (process.platform === "win32") {
      const iso = execFileSync("powershell.exe", ["-NoProfile", "-Command", `(Get-Process -Id ${Number(pid)}).StartTime.ToUniversalTime().ToString('o')`], {
        encoding: "utf8", windowsHide: true, timeout: 15000,
      }).trim();
      const t = Date.parse(iso);
      return Number.isNaN(t) ? null : Math.floor(t / 1000);
    }
    const teks = execFileSync("ps", ["-o", "lstart=", "-p", String(Number(pid))], { encoding: "utf8", timeout: 5000 }).trim();
    const t = Date.parse(teks);
    return Number.isNaN(t) ? null : Math.floor(t / 1000);
  } catch {
    return null;
  }
};
