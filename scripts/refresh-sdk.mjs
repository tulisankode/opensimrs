// Memasang ulang SDK lokal (packages/*) ke setiap layanan setelah kode SDK diubah.
// SDK dipasang sebagai salinan (install-links=true di .npmrc layanan), jadi perubahan di packages/
// baru terlihat setelah skrip ini dijalankan:  npm run sdk:refresh  [-- nama-layanan ...]
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pilihan = process.argv.slice(2);

const layanan = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.endsWith("-service"))
  .map((d) => d.name)
  .filter((nama) => !pilihan.length || pilihan.includes(nama));

for (const nama of layanan) {
  const pkg = join(root, nama, "package.json");
  if (!existsSync(pkg)) continue;
  const deps = Object.keys(JSON.parse(readFileSync(pkg, "utf8")).dependencies ?? {}).filter((d) => d.startsWith("@opensimrs/"));
  if (!deps.length) continue;
  for (const d of deps) rmSync(join(root, nama, "node_modules", ...d.split("/")), { recursive: true, force: true });
  console.log(`→ ${nama}: ${deps.join(", ")}`);
  execSync("npm install --no-audit --no-fund", { cwd: join(root, nama), stdio: "inherit" });
}
