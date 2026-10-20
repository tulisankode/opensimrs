import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// Sequelize tidak mengganti replacement yang menempel pada "<" (mis. "waktu<:sampai"): SQL terkirim dengan ":sampai"
// mentah dan gagal "syntax error at or near ':'". Tulis dengan spasi: "waktu < :sampai".
test("replacement Sequelize tidak menempel pada operator <", () => {
  const temuan = [];
  const telusuri = (dir) => {
    for (const nama of fs.readdirSync(dir)) {
      const p = path.join(dir, nama);
      if (fs.statSync(p).isDirectory()) telusuri(p);
      else if (p.endsWith(".js")) {
        fs.readFileSync(p, "utf8").split("\n").forEach((baris, i) => {
          if (/[^<]<:[a-zA-Z_]/.test(baris)) temuan.push(`${path.relative(process.cwd(), p)}:${i + 1}`);
        });
      }
    }
  };
  telusuri(path.resolve("src"));
  assert.deepEqual(temuan, []);
});
