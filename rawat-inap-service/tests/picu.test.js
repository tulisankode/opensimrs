import test from "node:test";
import assert from "node:assert/strict";
import PicuRepository, { PicuError } from "../src/repositories/picu-repository.js";
import { konfigurasiSchema, dokumentasiSchema, penerimaanSchema, periodeSchema, validasiIsi } from "../src/validations/picu-request.js";
import { punyaIzinPicu, punyaIzinModul } from "../src/picu/picu-policy.js";
import { buatPicuAkses, picuPermission } from "../src/middlewares/picu-permission-middleware.js";

const ids = {
    pasien: "019a0000-0000-7000-8000-000000000001", kunjungan: "019a0000-0000-7000-8000-000000000002",
    bed: "019a0000-0000-7000-8000-000000000003", pindah: "019a0000-0000-7000-8000-000000000004",
};
const author = { faskesUuid: "faskes-sintetis", user_uuid: "pengguna-sintetis" };
const masuk = { pasien_uuid: ids.pasien, kunjungan_uuid: ids.kunjungan, tempat_tidur_uuid: ids.bed,
    referensi_penerimaan_uuid: ids.pindah, sumber_penerimaan: "rawat_inap" };
const definisi = [{ kode: "hasil_ukur", nama: "Pengukuran sintetis", tipe: "angka", satuan: "satuan uji", wajib: true }];
const errorStatus = (status) => (e) => e instanceof PicuError && e.status === status;

function tiruan(jawab, izin = () => true) {
    const panggilan = [];
    const db = {
        async query(sql, options) { panggilan.push({ sql, ...options }); return jawab(sql, options); },
        async transaction(fn) { return fn({ sintetis: true }); },
    };
    return { repo: new PicuRepository(db, author, () => "uuid-sintetis", izin), panggilan };
}
test("konteks faskes dan pengguna wajib berasal dari autentikasi", () => {
    assert.throws(() => new PicuRepository({}, { user_uuid: "uji" }), errorStatus(401));
});
test("penerimaan menolak identitas server, sumber belum tersedia, dan UUID tidak sah", () => {
    assert.deepEqual(penerimaanSchema.parse(masuk), masuk);
    for (const data of [{ ...masuk, faskes_uuid: "palsu" }, { ...masuk, dibuat_oleh: "palsu" }, { ...masuk, sumber_penerimaan: "igd" }, { ...masuk, pasien_uuid: "bukan-uuid" }]) {
        assert.equal(penerimaanSchema.safeParse(data).success, false);
    }
});
test("konfigurasi tidak menerima nilai bawaan, parameter ganda, atau tipe tak dikenal", () => {
    const data = { jenis: "observasi", nama: "Formulir sintetis versi 1", definisi };
    assert.equal(konfigurasiSchema.safeParse(data).success, true);
    assert.equal(konfigurasiSchema.safeParse({ ...data, definisi: [definisi[0], definisi[0]] }).success, false);
    assert.equal(konfigurasiSchema.safeParse({ ...data, definisi: [{ ...definisi[0], nilai_bawaan: 1 }] }).success, false);
    assert.equal(konfigurasiSchema.safeParse({ ...data, definisi: [{ ...definisi[0], tipe: "alarm" }] }).success, false);
});
test("isi mengikuti parameter konfigurasi tanpa penafsiran atau ambang klinis", () => {
    assert.doesNotThrow(() => validasiIsi(definisi, { hasil_ukur: 0 }));
    assert.throws(() => validasiIsi(definisi, {}));
    assert.throws(() => validasiIsi(definisi, { hasil_ukur: "angka palsu" }));
    assert.throws(() => validasiIsi(definisi, { hasil_ukur: Infinity }));
    assert.throws(() => validasiIsi(definisi, { hasil_ukur: 1, ambang_otomatis: 2 }));
});
test("revisi mewajibkan alasan dan rentang waktu laporan harus valid", () => {
    assert.equal(dokumentasiSchema.safeParse({ konfigurasi_uuid: ids.bed, waktu_catatan: 1, isi: {}, koreksi_uuid: ids.pasien }).success, false);
    assert.equal(periodeSchema.safeParse({ mulai_at: 2, selesai_at: 1 }).success, false);
    assert.equal(periodeSchema.safeParse({ mulai_at: "0", selesai_at: "1", faskes_uuid: "palsu" }).success, false);
});
test("izin PICU terpisah dari ICU dan tidak memberi izin modul sumber", () => {
    const izin = [{ module: "PICU", subModules: [{ name: "Observasi", allows: ["CREATE"] }] }];
    assert.equal(punyaIzinPicu(izin, "Observasi", "CREATE"), true);
    assert.equal(punyaIzinPicu(izin, "Observasi", "FINALISASI"), false);
    assert.equal(punyaIzinModul(izin, "Laboratorium", "Order Lab", "READ"), false);
    assert.equal(punyaIzinPicu([{ module: "ICU", subModules: izin[0].subModules }], "Observasi", "CREATE"), false);
    assert.equal(punyaIzinPicu([{ module: "PICU", subModules: [{ name: "Observasi", allows: [{ name: "CREATE", checked: false }] }] }], "Observasi", "CREATE"), false);
});
test("middleware menolak modul dan fitur nonaktif serta izin kosong sebelum akses data PICU", async () => {
    let modulAktif = false;
    let fiturAktif = false;
    let permissions = [];
    const db = { query: async (sql, o) => {
        assert.equal(o.replacements.f, author.faskesUuid);
        if (sql.includes("FROM ref_modul")) { assert.equal(o.replacements.faskes, author.faskesUuid); return [{ modul: modulAktif, fitur: fiturAktif }]; }
        return [{ permissions }];
    } };
    const middleware = buatPicuAkses(db, () => author);
    const req = { path: "/dashboard", query: { faskes_uuid: "palsu" } };
    const res = { locals: {}, status(kode) { this.kode = kode; return this; }, json(hasil) { this.hasil = hasil; return this; } };
    let lanjut = false;
    await middleware(req, res, () => { lanjut = true; });
    assert.equal(res.kode, 403); assert.equal(lanjut, false);
    modulAktif = true;
    await middleware(req, res, () => { lanjut = true; });
    assert.equal(res.kode, 403); assert.equal(lanjut, false);
    fiturAktif = true;
    await middleware(req, res, () => { lanjut = true; });
    assert.equal(lanjut, true);
    picuPermission("Dasbor")(req, res, () => assert.fail("Izin kosong harus ditolak."));
    assert.equal(res.kode, 403);
    permissions = [{ module: "PICU", subModules: [{ name: "Dasbor", allows: ["READ"] }] }];
    await middleware(req, res, () => {});
    let diizinkan = false;
    picuPermission("Dasbor")(req, res, () => { diizinkan = true; });
    assert.equal(diizinkan, true);
});
test("middleware menolak konteks hilang dan kegagalan sumber izin", async () => {
    const res = { locals: {}, status(kode) { this.kode = kode; return this; }, json() { return this; } };
    await buatPicuAkses({}, () => null)({}, res, () => assert.fail());
    assert.equal(res.kode, 401);
    await buatPicuAkses({ query: async () => { throw new Error("Gangguan sintetis"); } }, () => author)({}, res, () => assert.fail());
    assert.equal(res.kode, 503);
});
test("idempotensi mengembalikan hasil sebelumnya tanpa memanggil proses ulang", async () => {
    const data = { lingkup: "episode", kunci: "kunci-uji-001" };
    let tersimpan;
    const { repo } = tiruan((sql, o) => {
        if (sql.startsWith("INSERT INTO picu_idempotensi")) tersimpan ??= { ringkasan: o.replacements.ringkasan, dibuat_oleh: author.user_uuid };
        if (sql.startsWith("SELECT * FROM picu_idempotensi")) return [tersimpan];
        if (sql.startsWith("UPDATE picu_idempotensi")) tersimpan.hasil = JSON.parse(o.replacements.hasil);
        return [];
    });
    let dipanggil = 0;
    const proses = async () => { dipanggil++; return { uuid: "episode-uji" }; };
    const hasil = await repo.tulis(data.lingkup, data.kunci, { a: 1, b: 2 }, proses);
    assert.deepEqual(await repo.tulis(data.lingkup, data.kunci, { b: 2, a: 1 }, proses), hasil);
    assert.equal(dipanggil, 1);
    await assert.rejects(repo.tulis(data.lingkup, data.kunci, { a: 3 }, proses), errorStatus(409));
});
test("kunci idempotensi wajib dan isi yang berbeda tidak disimpan sebagai sukses", async () => {
    const { repo, panggilan } = tiruan((sql, o) => sql.startsWith("SELECT * FROM picu_idempotensi")
        ? [{ ringkasan: "tidak-cocok", dibuat_oleh: author.user_uuid }] : []);
    await assert.rejects(repo.tulis("uji", "", {}, () => {}), errorStatus(422));
    assert.equal(panggilan.length, 0);
    await assert.rejects(repo.tulis("uji", "kunci-uji-002", {}, () => { throw new Error("Gagal sintetis"); }), errorStatus(409));
    assert.equal(panggilan.some((p) => p.sql.startsWith("UPDATE")), false);
});
test("kegagalan proses menggagalkan transaksi idempotensi tanpa mencatat hasil sukses", async () => {
    let hash;
    const { repo, panggilan } = tiruan((sql, o) => {
        if (sql.startsWith("INSERT INTO picu_idempotensi")) hash = o.replacements.ringkasan;
        if (sql.startsWith("SELECT * FROM picu_idempotensi")) return [{ ringkasan: hash, dibuat_oleh: author.user_uuid }];
        return [];
    });
    await assert.rejects(repo.tulis("uji", "kunci-gagal-001", {}, async () => { throw new Error("Penyimpanan sintetis gagal"); }), /Penyimpanan sintetis gagal/);
    assert.equal(panggilan.some((p) => p.sql.startsWith("UPDATE picu_idempotensi")), false);
});
test("dokumentasi dan koreksi menghasilkan baris serta riwayat baru dengan formulir historis", async () => {
    const { repo, panggilan } = tiruan((sql) => {
        if (sql.startsWith("SELECT * FROM picu_episode")) return [{ uuid: "episode-uji", status: "aktif", waktu_masuk: 1 }];
        if (sql.startsWith("SELECT * FROM picu_konfigurasi")) return [{ jenis: "observasi", definisi }];
        if (sql.includes("FROM ref_modul")) return [{ modul: true, fitur: true }];
        if (sql.startsWith("SELECT uuid FROM picu_dokumentasi")) return [{ uuid: "dokumen-lama" }];
        if (sql.startsWith("INSERT INTO picu_dokumentasi")) return [{ uuid: "dokumen-baru" }];
        return [];
    });
    const data = { konfigurasi_uuid: ids.bed, waktu_catatan: 10, isi: { hasil_ukur: 12 } };
    assert.equal((await repo.catat("episode-uji", data, {})).uuid, "dokumen-baru");
    await repo.catat("episode-uji", { ...data, koreksi_uuid: ids.pindah, alasan: "Koreksi sintetis" }, {});
    assert.equal(panggilan.filter((p) => p.sql.startsWith("INSERT INTO picu_dokumentasi")).length, 2);
    assert.equal(panggilan.filter((p) => p.sql.startsWith("INSERT INTO picu_riwayat")).length, 2);
    assert.equal(panggilan.some((p) => p.sql.startsWith("UPDATE picu_dokumentasi")), false);
    const koreksi = panggilan.find((p) => p.sql.startsWith("SELECT uuid FROM picu_dokumentasi"));
    assert.equal(koreksi.replacements.konfigurasi_uuid, ids.bed);
});
test("perpindahan berhasil menautkan hasil sumber dan hanya memperbarui episode PICU", async () => {
    const { repo, panggilan } = tiruan((sql) => {
        if (sql.startsWith("SELECT * FROM picu_episode")) return [{ uuid: "episode-uji", status: "aktif", versi: 1, pasien_uuid: ids.pasien, tempat_tidur_uuid: "asal", waktu_masuk: 1 }];
        if (sql.startsWith("SELECT * FROM rawat_inaps")) return [{ monitoring_room_uuid: "tujuan", status_ri: 3 }];
        if (sql.startsWith("SELECT * FROM perpindahans")) return [{ status_pindah: "approve", origin_monitoring_room_uuid: "asal", destination_monitoring_room_uuid: "tujuan", waktu_pindah: 2 }];
        if (sql.startsWith("SELECT * FROM room_monitorings")) return [{ uuid: "asal", patient_uuid: null }, { uuid: "tujuan", patient_uuid: ids.pasien, status_operasional: "Penuh" }];
        if (sql.startsWith("SELECT uuid FROM picu_tempat_tidur")) return [{ uuid: "pemetaan-uji" }];
        if (sql.startsWith("UPDATE picu_episode")) return [{ uuid: "episode-uji", tempat_tidur_uuid: "tujuan", versi: 2 }];
        return [];
    });
    const hasil = await repo.transisi("episode-uji", { versi: 1, referensi_uuid: ids.pindah, alasan: "Perpindahan sintetis" }, false, {});
    assert.equal(hasil.tempat_tidur_uuid, "tujuan");
    assert.equal(panggilan.some((p) => /UPDATE (room_monitorings|rawat_inaps|perpindahans)/.test(p.sql)), false);
    const histori = panggilan.find((p) => p.sql.startsWith("INSERT INTO picu_riwayat"));
    assert.equal(histori.replacements.asal, "asal"); assert.equal(histori.replacements.tujuan, "tujuan");
});
test("penerimaan hanya menulis episode setelah identitas, perpindahan, okupansi, dan ICU diperiksa", async () => {
    let status = "pending";
    let bentrok = null;
    const { repo, panggilan } = tiruan((sql) => {
        if (sql.includes("intensif_cek_bentrok")) return [{ modul: bentrok }];
        if (sql.startsWith("SELECT uuid FROM patients")) return [{ uuid: ids.pasien }];
        if (sql.startsWith("SELECT * FROM rawat_inaps")) return [{ uuid: ids.kunjungan, monitoring_room_uuid: ids.bed, status_ri: 3 }];
        if (sql.startsWith("SELECT * FROM perpindahans")) return [{ uuid: ids.pindah, status_pindah: status, destination_monitoring_room_uuid: ids.bed }];
        if (sql.startsWith("SELECT b.*")) return [{ uuid: ids.bed, patient_uuid: ids.pasien, status_operasional: "Penuh", status: true }];
        if (sql.startsWith("INSERT INTO picu_episode")) return [{ uuid: "episode-sintetis" }];
        return [];
    });
    await assert.rejects(repo.mulai(masuk, {}), errorStatus(409));
    assert.equal(panggilan.some((p) => p.sql.startsWith("INSERT")), false);
    status = "approve";
    bentrok = "NICU";
    await assert.rejects(repo.mulai(masuk, {}), (e) => e.status === 409 && /NICU/.test(e.message));
    assert.equal(panggilan.some((p) => p.sql.startsWith("INSERT")), false);
    bentrok = null;
    assert.equal((await repo.mulai(masuk, {})).uuid, "episode-sintetis");
    assert.ok(panggilan.some((p) => p.sql.startsWith("INSERT INTO picu_riwayat")));
    for (const p of panggilan) {
        assert.equal(p.replacements.f, author.faskesUuid);
        if (p.sql.startsWith("SELECT intensif_cek_bentrok")) assert.match(p.sql, /intensif_cek_bentrok\(:f,/);
        else if (p.sql.startsWith("SELECT")) assert.match(p.sql, /faskes_uuid.*:f|:f.*faskes_uuid/s);
    }
});
test("akses objek faskes lain atau terhapus gagal sebelum mutasi", async () => {
    const { repo, panggilan } = tiruan(() => []);
    await assert.rejects(repo.detail(ids.pasien), errorStatus(404));
    assert.equal(panggilan.length, 1);
    assert.match(panggilan[0].sql, /faskes_uuid = :f AND deleted_at IS NULL/);
});
test("versi episode berubah dan pemulangan belum selesai tidak menutup episode", async () => {
    const { repo, panggilan } = tiruan((sql) => {
        if (sql.startsWith("SELECT * FROM picu_episode")) return [{ uuid: "episode-uji", status: "aktif", versi: 2 }];
        if (sql.startsWith("SELECT * FROM rawat_inaps")) return [{ status_ri: 3 }];
        return [];
    });
    await assert.rejects(repo.transisi("episode-uji", { versi: 1 }, true, {}), errorStatus(409));
    await assert.rejects(repo.transisi("episode-uji", { versi: 2, jenis_keluar: "pulang" }, true, {}), errorStatus(409));
    assert.equal(panggilan.some((p) => p.sql.startsWith("UPDATE")), false);
});
test("konfigurasi belum berlaku dan izin profesi yang tidak diberikan menolak dokumentasi", async () => {
    let konfigurasiAda = false;
    const { repo, panggilan } = tiruan((sql) => {
        if (sql.startsWith("SELECT * FROM picu_episode")) return [{ status: "aktif", waktu_masuk: 1 }];
        if (sql.startsWith("SELECT * FROM picu_konfigurasi")) return konfigurasiAda ? [{ jenis: "observasi", definisi }] : [];
        return [];
    }, () => false);
    await assert.rejects(repo.catat("uji", {}, {}), errorStatus(404));
    konfigurasiAda = true;
    await assert.rejects(repo.catat("uji", {}, {}), errorStatus(403));
    assert.equal(panggilan.some((p) => p.sql.startsWith("INSERT")), false);
});
test("episode selesai menolak catatan baru dan dokumen final menolak finalisasi ulang", async () => {
    const { repo } = tiruan((sql) => {
        if (sql.startsWith("SELECT * FROM picu_episode")) return [{ status: "selesai" }];
        if (sql.startsWith("SELECT * FROM picu_dokumentasi")) return [{ jenis: "observasi", status: "final" }];
        return [];
    });
    await assert.rejects(repo.catat("uji", {}, {}), errorStatus(409));
    await assert.rejects(repo.finalisasi("uji", "dokumen-uji", {}), errorStatus(409));
});
test("transaksi sumber tidak dibaca tanpa izin sumber dan tidak membuat transaksi baru", async () => {
    const { repo, panggilan } = tiruan((sql) => sql.includes("FROM ref_modul") ? [{ modul: true, fitur: null }]
        : sql.startsWith("SELECT * FROM picu_episode") ? [{ kunjungan_uuid: ids.kunjungan, pasien_uuid: ids.pasien }] : []);
    await assert.rejects(repo.transaksiSumber("uji", "laboratorium", () => false), errorStatus(403));
    assert.equal(panggilan.length, 0);
    const hasil = await repo.transaksiSumber("uji", "radiologi", () => true);
    assert.deepEqual(hasil.items, []);
    assert.match(panggilan[2].sql, /r\.patient_uuid = o\.patient_uuid/);
    assert.equal(panggilan.some((p) => /INSERT|UPDATE|DELETE/.test(p.sql)), false);
});
