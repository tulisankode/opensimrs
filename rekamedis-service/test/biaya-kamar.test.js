import { hitungSegmenKamar, pilihHargaKamar } from "../src/helpers/biaya-kamar.js";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// detik epoch untuk jam tertentu WIB
const wib = (tgl, jam = "10:00") => Math.floor(new Date(`${tgl}T${jam}:00+07:00`).getTime() / 1000);

describe("hitungSegmenKamar", () => {
    test("masuk & pulang hari yang sama dihitung 1 hari", () => {
        const s = hitungSegmenKamar({ mulai: wib("2026-10-13", "08:00"), selesai: wib("2026-10-13", "20:00"), kamarAwal: "A" });
        assert.deepEqual(s.map((x) => [x.kamar, x.hari]), [["A", 1]]);
    });

    test("tanggal pulang tidak dihitung, memakai tanggal WIB", () => {
        const s = hitungSegmenKamar({ mulai: wib("2026-10-13", "23:30"), selesai: wib("2026-10-16", "06:00"), kamarAwal: "A" });
        assert.equal(s[0].hari, 3);
    });

    test("pindah kamar: hari pindah masuk kamar tujuan, pindah bed sekamar diabaikan", () => {
        const s = hitungSegmenKamar({
            mulai: wib("2026-10-10"), selesai: wib("2026-10-15"), kamarAwal: "A",
            perpindahan: [
                { waktu: wib("2026-10-11"), kamar_tujuan: "A" },
                { waktu: wib("2026-10-12", "15:00"), kamar_tujuan: "B" },
            ],
        });
        assert.deepEqual(s.map((x) => [x.kamar, x.hari]), [["A", 2], ["B", 3]]);
    });

    test("pindah kamar di hari yang sama dengan masuk & pulang → 1 hari di kamar terakhir", () => {
        const s = hitungSegmenKamar({
            mulai: wib("2026-10-13", "08:00"), selesai: wib("2026-10-13", "20:00"), kamarAwal: "A",
            perpindahan: [{ waktu: wib("2026-10-13", "12:00"), kamar_tujuan: "B" }],
        });
        assert.deepEqual(s.map((x) => [x.kamar, x.hari]), [["B", 1]]);
    });
});

describe("pilihHargaKamar", () => {
    const penjamin = JSON.stringify([
        { penjamin_name: "BPJS", harga: 300000 },
        { penjamin_name: "TUNAI/UMUM", harga: 450000 },
    ]);
    test("tunai memakai harga TUNAI/UMUM", () => assert.deepEqual(pilihHargaKamar(penjamin, 1), { harga: 450000, penjamin: "TUNAI/UMUM" }));
    test("asuransi memakai harga non-tunai", () => assert.deepEqual(pilihHargaKamar(penjamin, 2), { harga: 300000, penjamin: "BPJS" }));
    test("tanpa harga → null", () => assert.equal(pilihHargaKamar("[]", 1), null));
});
