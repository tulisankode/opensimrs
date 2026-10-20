// Pemuat khusus verifikasi: konfigurasi runtime dan akses database diganti sebelum modul aplikasi dimuat.
import { registerHooks } from "node:module";
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const konfigurasi = url('export default { pg: {}, port: 8099, host: "127.0.0.1", basePath: "/api/v3/penunjang", maxUploadMutuMb: 10, berkasSarprasMaksMb: 5, settingUrl: "http://127.0.0.1:8094/api/v3/setting" };');
const data = url('const tolak=()=>{throw new Error("Database dinonaktifkan selama verifikasi");}; export const query=tolak,satu=tolak,sisipkan=tolak,ubah=tolak,transaksi=tolak,sekarang=()=>1,uuidv7=()=>"019a0000-0000-7000-8000-000000000001",pool={connect:tolak,query:tolak};');
registerHooks({ resolve(s,c,lanjut) {
  if (s === "dotenv/config") return { url: url("export {};"), shortCircuit: true };
  const asal = c.parentURL && (s.startsWith(".") || s.startsWith("file:")) ? new URL(s,c.parentURL).href : s;
  if (/\/(?:rahasia\.js|\.env[^/]*)$/.test(asal)) throw new Error("Berkas rahasia tidak boleh dimuat");
  if (asal.endsWith("/penunjang-service/src/config.js")) return { url: konfigurasi, shortCircuit: true };
  if (asal.endsWith("/penunjang-service/src/db.js")) return { url: data, shortCircuit: true };
  return lanjut(s,c);
} });
