// Cek sintaks berkas frontend (.ts/.vue) setelah konflik diselesaikan: node --check hanya mengenal JavaScript, sehingga
// router/index.ts yang kurung tutupnya hilang lolos dan baru gagal saat aplikasi dibuka (Vite "Unexpected }").
// Pemakaian: node cek-sintaks-frontend.mjs <folder repo> <berkas relatif>...  → keluar 1 bila ada yang rusak.
// esbuild & @vue/compiler-sfc dipakai dari frontend-service/node_modules folder repo itu; tidak ada → dilewati.
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const [akar, ...berkas] = process.argv.slice(2);
let muat;
try {
  muat = createRequire(path.join(akar, "frontend-service", "package.json"));
  muat.resolve("esbuild");
} catch {
  console.log("Cek sintaks frontend dilewati: frontend-service/node_modules tidak ditemukan");
  process.exit(0);
}
const esbuild = muat("esbuild");
const sfc = muat("@vue/compiler-sfc");

const rusak = [];
for (const rel of berkas) {
  const teks = fs.readFileSync(path.join(akar, rel), "utf8");
  try {
    if (rel.endsWith(".ts")) esbuild.transformSync(teks, { loader: "ts" });
    else if (rel.endsWith(".vue")) {
      const { descriptor, errors } = sfc.parse(teks, { filename: rel });
      if (errors.length) throw errors[0];
      if (descriptor.script || descriptor.scriptSetup) sfc.compileScript(descriptor, { id: "cek", inlineTemplate: false });
      if (descriptor.template) {
        const t = sfc.compileTemplate({ source: descriptor.template.content, filename: rel, id: "cek" });
        if (t.errors.length) throw t.errors[0];
      }
    }
  } catch (e) {
    const pesan = e.errors?.[0]?.text ?? e.message ?? String(e);
    const baris = e.errors?.[0]?.location?.line ?? e.loc?.start?.line ?? e.loc?.line;
    rusak.push(`${rel}${baris ? `:${baris}` : ""}: ${String(pesan).split("\n")[0]}`);
  }
}
if (rusak.length) {
  console.log(rusak.join("\n"));
  process.exit(1);
}
console.log(`Sintaks ${berkas.length} berkas frontend valid`);
