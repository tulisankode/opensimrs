import test from "node:test";
import assert from "node:assert/strict";
import { hitungLaporanIcu } from "../src/services/icu-laporan-service.js";
const episode = [{ uuid: "e", layanan_kode: "burn", room_monitoring_uuid: "b", waktu_masuk: 100, waktu_keluar: 200, kondisi_keluar: "hidup" }];
const kapasitas = ["b", "kosong"].map((bed) => ({ room_monitoring_uuid: bed, layanan_kode: "burn", berlaku_mulai: 100, berlaku_sampai: null }));
test("Bed kosong masuk kapasitas dan periode bersebelahan tidak menghitung keluar dua kali", () => {
    const a = hitungLaporanIcu(episode, [], kapasitas, 100, 200, 400);
    const b = hitungLaporanIcu(episode, [], kapasitas, 200, 300, 400);
    assert.equal(a.bor, 50); assert.equal(a.jumlah_episode_selesai, 0); assert.equal(b.jumlah_episode_selesai, 1);
});
test("Kapasitas historis tidak tersedia menghasilkan BOR null", () => {
    assert.equal(hitungLaporanIcu(episode, [], [], 100, 300, 400).bor, null);
    assert.equal(hitungLaporanIcu(episode, [], kapasitas, 90, 300, 400).bor, null);
});
test("Ventilator hanya pada populasi tersaring dan unik per admisi/hari", () => {
    const obs = ["e", "lain", "e"].map((id) => ({ perawatan_uuid: id, rawat_inap_uuid: "admisi-fiktif", ventilator_terpasang: true, waktu_pengukuran: 150 }));
    assert.equal(hitungLaporanIcu(episode, obs, kapasitas, 100, 300, 400).hari_ventilator, 1);
});
