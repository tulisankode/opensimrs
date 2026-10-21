import test from "node:test";
import assert from "node:assert/strict";
import { konfigurasiSchema, serahTerimaSchema, selesaiSchema, instruksiSchema, paginasiSchema, periksaVersi, periksaWaktu, pilihInstruksi } from "../src/services/hdu-aturan.js";
import { punyaIzinHdu } from "../src/services/hdu-izin.js";
import HduRepository from "../src/repositories/hdu-repository.js";
import HduPerpindahanAdapter from "../src/services/hdu-perpindahan-adapter.js";
import HduService from "../src/services/hdu-service.js";
import migrasiHdu from "../../database/migrations/20261020120000-hdu_struktur.cjs";
import migrasiIndeks from "../../database/migrations/20261020190200-hdu_indeks_serah_terima.cjs";
import migrasiJenisKeluar from "../../database/migrations/20261021100000-intensif_jenis_keluar.cjs";

const id = "019a0000-0000-7000-8000-000000000001";
const author = { faskesUuid: "faskes-fiktif", user_uuid: "penerima-fiktif" };
const ditolak = (fungsi, status) => assert.throws(fungsi, (e) => e.hdu && e.status === status);

test("identitas klien, fasilitas, dan bidang tambahan ditolak", () => {
    const valid = { ruangan_uuid: id, nama: "HDU Fiktif", aktif: true };
    assert.equal(konfigurasiSchema.parse(valid).nama, "HDU Fiktif");
    for (const kolom of ["faskes_uuid", "pencatat", "penerima", "deleted_at"]) {
        assert.equal(konfigurasiSchema.safeParse({ ...valid, [kolom]: id }).success, false);
    }
    assert.equal(serahTerimaSchema.safeParse({ perpindahan_uuid: id, arah: "masuk", waktu_kejadian: 100,
        ringkasan: { kondisi: "Dicatat petugas", terapi_berjalan: "Tidak ada terapi berjalan", tindak_lanjut: "Observasi menurut instruksi" }, pengirim: id }).success, false);
});

test("interval wajib positif, integer, dibatasi operasional, dan beralasan", () => {
    const valid = { interval_detik: 900, berlaku_mulai: 200, alasan: "Instruksi petugas", versi: 1 };
    assert.equal(instruksiSchema.safeParse(valid).success, true);
    for (const interval_detik of [0, -1, 1.5, 604801, null]) assert.equal(instruksiSchema.safeParse({ ...valid, interval_detik }).success, false);
    assert.equal(instruksiSchema.safeParse({ ...valid, alasan: " " }).success, false);
    assert.equal(paginasiSchema.safeParse({ batas: 101 }).success, false);
    assert.equal(paginasiSchema.safeParse({ faskes_uuid: id }).success, false);
});

test("instruksi episode mengungguli unit sesuai waktu pengukuran; versi masa depan tidak dipakai", () => {
    const instruksi = [{ uuid: "episode-lama", berlaku_mulai: 100, versi: 2 }, { uuid: "episode-baru", berlaku_mulai: 300, versi: 3 }];
    const kebijakan = [{ uuid: "unit", berlaku_mulai: 50, versi: 1 }];
    assert.equal(pilihInstruksi(instruksi, kebijakan, 200).uuid, "episode-lama");
    assert.equal(pilihInstruksi(instruksi, kebijakan, 70).sumber, "unit");
    assert.equal(pilihInstruksi(instruksi, kebijakan, 350).uuid, "episode-baru");
    assert.equal(pilihInstruksi(instruksi, kebijakan, 10), null);
    assert.deepEqual(instruksi.map((r) => r.uuid), ["episode-lama", "episode-baru"]);
});

test("konflik versi dan waktu di luar episode ditolak", () => {
    periksaVersi({ versi: 2 }, 2);
    ditolak(() => periksaVersi({ versi: 2 }, 1), 409);
    periksaWaktu(150, 300, 100, 200);
    for (const waktu of [99, 201, 301]) ditolak(() => periksaWaktu(waktu, 300, 100, 200), 422);
});

test("izin diperiksa per tindakan, fitur, dan status pilihan", () => {
    const izin = [{ module: "Rawat Inap", subModules: [
        { name: "HDU Observasi", allows: ["READ", { name: "CREATE", checked: true }, { name: "KOREKSI", checked: false }] },
        { name: "HDU Konfigurasi", checked: false, allows: ["KELOLA"] },
        { name: "Detail Pasien", features: [{ name: "Asesmen", allows: ["CREATE TANDA VITAL"] }] },
    ] }];
    assert.equal(punyaIzinHdu(izin, "Rawat Inap", "HDU Observasi", "CREATE"), true);
    assert.equal(punyaIzinHdu(izin, "Rawat Inap", "HDU Observasi", "KOREKSI"), false);
    assert.equal(punyaIzinHdu(izin, "Rawat Inap", "HDU Konfigurasi", "KELOLA"), false);
    assert.equal(punyaIzinHdu(izin, "ICU", "Serah Terima", "KELOLA"), false);
    assert.equal(punyaIzinHdu(izin, "Rawat Inap", "Detail Pasien", "CREATE TANDA VITAL", "Asesmen"), true);
});

test("pengiriman ulang mengembalikan hasil yang sama dan menolak sidik berbeda", async () => {
    let tersimpan;
    let jumlah = 0;
    const db = {
        transaction: async (jalankan) => jalankan("transaksi-fiktif"),
        query: async (sql, opsi) => {
            assert.equal(opsi.transaction, "transaksi-fiktif");
            assert.equal(opsi.replacements.f, author.faskesUuid);
            if (sql.startsWith("SELECT * FROM hdu_operasi")) return tersimpan ? [tersimpan] : [];
            if (sql.startsWith("INSERT INTO hdu_operasi")) tersimpan = { ...opsi.replacements, hasil: JSON.parse(opsi.replacements.hasil) };
            return [];
        },
    };
    const repo = new HduRepository(db, author);
    const jalankan = async () => { jumlah++; return { uuid: id }; };
    assert.deepEqual(await repo.tulis("masuk", { nilai: 1 }, id, jalankan), { uuid: id });
    assert.deepEqual(await repo.tulis("masuk", { nilai: 1 }, id, jalankan), { uuid: id });
    assert.equal(jumlah, 1);
    await assert.rejects(() => repo.tulis("masuk", { nilai: 2 }, id, jalankan), (e) => e.status === 409);
    await assert.rejects(() => repo.tulis("keluar", { nilai: 1 }, id, jalankan), (e) => e.status === 409);
});

const perpindahanFiktif = () => ({
    p: { uuid: "pindah-fiktif", admission_ri_uuid: "admisi-fiktif", origin_monitoring_room_uuid: "asal-fiktif", destination_monitoring_room_uuid: "tujuan-fiktif", status_pindah: "pending" },
    ri: { uuid: "admisi-fiktif", status_ri: 3, patient_uuid: "pasien-fiktif", monitoring_room_uuid: "asal-fiktif" },
    asal: { uuid: "asal-fiktif", patient_uuid: "pasien-fiktif", room_uuid: "ruang-asal" },
    tujuan: { uuid: "tujuan-fiktif", patient_uuid: null, status_operasional: "Tersedia", room_uuid: "ruang-tujuan" },
});

test("perpindahan mengunci sumber dan membatasi setiap referensi menurut fasilitas serta soft delete", async () => {
    const data = perpindahanFiktif();
    const adapter = new HduPerpindahanAdapter(async (sql) => {
        assert.match(sql, /faskes_uuid = :f/);
        assert.match(sql, /deleted_at IS NULL/);
        if (sql.includes("FROM perpindahans")) { assert.match(sql, /FOR UPDATE/); return [data.p]; }
        if (sql.includes("FROM rawat_inaps")) { assert.match(sql, /FOR UPDATE/); return [data.ri]; }
        if (sql.includes("FROM patients")) return [{ uuid: data.ri.patient_uuid }];
        if (sql.includes("FROM room_monitorings")) { assert.match(sql, /ORDER BY uuid FOR UPDATE/); return [data.asal, data.tujuan]; }
        return [{ uuid: "ruang-asal" }, { uuid: "ruang-tujuan" }];
    });
    assert.equal((await adapter.kunci(data.p.uuid)).ri.uuid, data.ri.uuid);
});

test("tempat tidur terisi, tidak operasional, penempatan ganda, atau perpindahan selesai tidak ditimpa", async () => {
    let ditulis = false;
    const adapter = new HduPerpindahanAdapter(async (sql) => {
        if (sql.startsWith("UPDATE")) ditulis = true;
        return [{ uuid: "admisi-lain" }];
    });
    for (const ubah of [
        (d) => { d.tujuan.patient_uuid = "pasien-lain"; },
        (d) => { d.tujuan.status_operasional = "Perbaikan"; },
        (d) => { d.p.status_pindah = "approve"; },
        (d) => { d.asal.patient_uuid = null; },
        () => {},
    ]) {
        const data = perpindahanFiktif(); ubah(data);
        await assert.rejects(() => adapter.pindahkan(data, 100), (e) => e.status === 409);
    }
    assert.equal(ditulis, false);
});

test("keberhasilan perpindahan memperbarui semua sumber melalui transaksi pemanggil", async () => {
    const ditulis = [];
    const adapter = new HduPerpindahanAdapter(async (sql, data) => { if (/^(UPDATE|INSERT)/.test(sql)) ditulis.push({ sql, data }); return []; });
    const data = perpindahanFiktif();
    await adapter.pindahkan(data, 100);
    assert.equal(ditulis.length, 6);
    for (const { sql } of ditulis.filter((d) => d.sql.startsWith("UPDATE"))) { assert.match(sql, /faskes_uuid = :f/); assert.match(sql, /deleted_at IS NULL/); }
    assert.equal(ditulis[1].data.ruangan, data.tujuan.room_uuid);
    assert.equal(ditulis[3].data.uuid, "asal-fiktif");
    // Riwayat ruangan bed asal ditutup pada waktu pindah dan bed tujuan dicatat dalam transaksi yang sama.
    assert.match(ditulis[4].sql, /UPDATE riwayat_ruangan SET updated_at = :waktu/);
    assert.deepEqual([ditulis[4].data.bed, ditulis[4].data.waktu], ["asal-fiktif", 100]);
    assert.match(ditulis[5].sql, /INSERT INTO riwayat_ruangan .*:f/);
    assert.deepEqual([ditulis[5].data.ri, ditulis[5].data.bed, ditulis[5].data.waktu], [data.ri.uuid, data.tujuan.uuid, 100]);
});

test("serah terima sendiri, versi lama, dan eskalasi tanpa izin ICU tidak mengubah episode", async () => {
    const repo = new HduRepository({}, author);
    const st = { uuid: id, pengirim: author.user_uuid, versi: 1, arah: "masuk", waktu_kejadian: 10 };
    repo.satu = async () => st;
    await assert.rejects(() => repo.konfirmasi(() => assert.fail("Tidak boleh menulis"), id, { versi: 1, waktu_kejadian: 20 }, false), (e) => e.status === 403);
    await assert.rejects(() => repo.konfirmasi(() => assert.fail("Tidak boleh menulis"), id, { versi: 2, waktu_kejadian: 20 }, false), (e) => e.status === 409);
    const d = perpindahanFiktif();
    st.pengirim = "pengirim-fiktif"; st.arah = "keluar"; st.tujuan_icu = true; st.episode_uuid = id;
    repo.satu = async (q, tabel) => tabel === "hdu_serah_terima" ? st : { status: "aktif", rawat_inap_uuid: d.ri.uuid, room_monitoring_uuid: d.asal.uuid, waktu_masuk: 1 };
    const q = async (sql) => {
        assert.doesNotMatch(sql, /^(UPDATE|INSERT)/);
        if (sql.includes("FROM perpindahans")) return [d.p];
        if (sql.includes("FROM rawat_inaps")) return [d.ri];
        if (sql.includes("FROM patients")) return [{ uuid: d.ri.patient_uuid }];
        if (sql.includes("FROM room_monitorings")) return [d.asal, d.tujuan];
        if (sql.includes("FROM lokasi")) return [{ uuid: "ruang-asal" }, { uuid: "ruang-tujuan" }];
        return [];
    };
    await assert.rejects(() => repo.konfirmasi(q, id, { versi: 1, waktu_kejadian: 20 }, false), (e) => e.status === 403);
});

test("izin HDU tidak menggantikan izin perpindahan dan identitas kueri ditolak", async () => {
    const service = new HduService({});
    const req = { params: { uuid: id }, query: {}, get: () => id, body: { versi: 1, waktu_kejadian: 20 } };
    await assert.rejects(() => service.jalankan("konfirmasi", req, () => false, true), (e) => e.status === 403);
    await assert.rejects(() => service.jalankan("detail", { ...req, query: { faskes_uuid: "faskes-lain" } }, () => true, true), (e) => e.status === 422);
});

test("penerimaan HDU membuka episode hanya sesudah perpindahan berhasil", async () => {
    const d = perpindahanFiktif();
    d.ri.rekam_medis_uuid = null;
    const repo = new HduRepository({}, author);
    const st = { uuid: id, versi: 1, pengirim: "pengirim-fiktif", arah: "masuk", waktu_kejadian: 10 };
    const ditulis = [];
    repo.satu = async (q, tabel) => tabel === "hdu_serah_terima" ? st : { status: "aktif" };
    const q = async (sql) => {
        if (/^(UPDATE|INSERT)/.test(sql)) { ditulis.push(sql); return []; }
        if (sql.includes("FROM perpindahans")) return [d.p];
        if (sql.includes("FROM rawat_inaps") && sql.includes("FOR UPDATE")) return [d.ri];
        if (sql.includes("FROM patients")) return [{ uuid: d.ri.patient_uuid }];
        if (sql.includes("FROM room_monitorings")) return [d.asal, d.tujuan];
        if (sql.includes("FROM lokasi")) return [{ uuid: "ruang-asal" }, { uuid: "ruang-tujuan" }];
        if (sql.includes("FROM hdu_konfigurasi")) return [{ uuid: "unit-fiktif" }];
        return [];
    };
    await repo.konfirmasi(q, id, { versi: 1, waktu_kejadian: 20 }, false);
    assert.equal(ditulis.length, 8);
    assert.match(ditulis[0], /^UPDATE perpindahans/);
    assert.match(ditulis[5], /^INSERT INTO riwayat_ruangan/);
    assert.match(ditulis[6], /^INSERT INTO hdu_episode/);
    assert.match(ditulis[7], /^UPDATE hdu_serah_terima/);
    ditulis.length = 0;
    d.tujuan.patient_uuid = "pasien-lain";
    await assert.rejects(() => repo.konfirmasi(q, id, { versi: 1, waktu_kejadian: 20 }, false), (e) => e.status === 409);
    assert.equal(ditulis.length, 0);
});

test("eskalasi ICU menautkan episode dan kedua serah terima sebelum menutup HDU", async () => {
    const d = perpindahanFiktif();
    const repo = new HduRepository({}, author);
    const st = { uuid: id, versi: 1, pengirim: "pengirim-fiktif", arah: "keluar", waktu_kejadian: 10, tujuan_icu: true,
        episode_uuid: id, ringkasan: { kondisi: "Kondisi fiktif", terapi_berjalan: "Terapi fiktif", tindak_lanjut: "Penerimaan ICU" } };
    const ditulis = [];
    repo.satu = async (q, tabel) => tabel === "hdu_serah_terima" ? st : { status: "aktif", rawat_inap_uuid: d.ri.uuid, room_monitoring_uuid: d.asal.uuid, waktu_masuk: 1 };
    const q = async (sql) => {
        if (/^(UPDATE|INSERT)/.test(sql)) { ditulis.push(sql); return []; }
        if (sql.includes("FROM perpindahans")) return [d.p];
        if (sql.includes("FROM rawat_inaps") && sql.includes("FOR UPDATE")) return [d.ri];
        if (sql.includes("FROM patients")) return [{ uuid: d.ri.patient_uuid }];
        if (sql.includes("FROM room_monitorings")) return [d.asal, d.tujuan];
        if (sql.includes("FROM lokasi")) return [{ uuid: "ruang-asal" }, { uuid: "ruang-tujuan" }];
        return [];
    };
    await repo.konfirmasi(q, id, { versi: 1, waktu_kejadian: 20 }, true);
    assert.equal(ditulis.length, 10);
    assert.match(ditulis[6], /^INSERT INTO icu_perawatans/);
    assert.match(ditulis[7], /^INSERT INTO icu_serah_terimas/);
    assert.match(ditulis[8], /^UPDATE hdu_episode/);
    assert.match(ditulis[9], /^UPDATE hdu_serah_terima/);
});

test("perubahan interval menambah riwayat dan tidak menimpa instruksi lama", async () => {
    const repo = new HduRepository({}, author);
    const sekarang = Math.floor(Date.now() / 1000);
    repo.satu = async () => ({ versi: 1, status: "aktif", konfigurasi_uuid: id, created_at: sekarang - 100 });
    const ditulis = [];
    await repo.instruksi(async (sql, nilai) => { ditulis.push({ sql, nilai }); return []; }, id,
        { interval_detik: 600, berlaku_mulai: sekarang + 100, alasan: "Instruksi fiktif baru", versi: 1 }, "episode");
    assert.equal(ditulis.length, 2);
    assert.match(ditulis[0].sql, /^INSERT INTO hdu_instruksi_observasi/);
    assert.equal(ditulis[0].nilai.episode, id);
    assert.match(ditulis[1].sql, /^UPDATE hdu_episode/);
});

test("detail episode tidak membocorkan serah terima tanpa izin baca serah terima", async () => {
    const service = new HduService({ detail: async () => ({ episode: { uuid: id }, serah_terima: [{ ringkasan: "Kondisi fiktif" }] }) });
    const hasil = await service.jalankan("detail", { params: { uuid: id }, query: {} }, () => false, false);
    assert.equal(hasil.serah_terima, undefined);
});

test("kegagalan penulisan diteruskan keluar transaksi tanpa mencatat keberhasilan idempotensi", async () => {
    let dibatalkan = false;
    let hasilDicatat = false;
    const db = {
        transaction: async (jalankan) => { try { return await jalankan("transaksi-fiktif"); } catch (error) { dibatalkan = true; throw error; } },
        query: async (sql) => { if (sql.startsWith("INSERT INTO hdu_operasi")) hasilDicatat = true; return []; },
    };
    const repo = new HduRepository(db, author);
    await assert.rejects(() => repo.tulis("masuk", {}, id, async () => { throw new Error("Kegagalan sumber fiktif"); }));
    assert.equal(dibatalkan, true);
    assert.equal(hasilDicatat, false);
});

test("migrasi baru memakai DDL idempoten dan keunikan penempatan seluruh rawat inap", async () => {
    let ddl = "";
    await migrasiHdu.up({ sequelize: {
        transaction: async (jalankan) => jalankan("transaksi-fiktif"),
        query: async (sql, opsi) => { ddl += sql; assert.equal(opsi.transaction, "transaksi-fiktif"); },
    } });
    assert.match(ddl, /CREATE UNIQUE INDEX IF NOT EXISTS rawat_inaps_bed_aktif_hdu_uq/);
    assert.match(ddl, /WHERE deleted_at IS NULL AND discharge_date IS NULL AND status_ri IN \(1, 2, 3\)/);
    assert.match(ddl, /hdu_episode_pasien_aktif_uq/);
    assert.doesNotMatch(ddl, /CREATE TABLE (?!IF NOT EXISTS)/);
    assert.doesNotMatch(ddl, /DROP TABLE|DELETE FROM|UPDATE rawat_inaps/);
});

test("daftar serah terima memvalidasi filter, halaman, dan menolak fasilitas dari klien", async () => {
    const panggilan = [];
    const service = new HduService({ serahTerima: async (data) => { panggilan.push(data); return { items: [], paginasi: data }; } });
    const req = { params: {}, query: { halaman: "5", batas: "25", arah: "keluar", status_penerimaan: "menunggu" } };
    await service.jalankan("serahTerima", req);
    assert.deepEqual(panggilan, [{ halaman: 5, batas: 25, arah: "keluar", status_penerimaan: "menunggu" }]);
    for (const query of [{ faskes_uuid: id }, { halaman: "0" }, { batas: "101" }, { arah: "lain" }, { status_penerimaan: "approve" }]) {
        await assert.rejects(() => service.jalankan("serahTerima", { ...req, query }));
    }
    assert.equal(panggilan.length, 1);
});

test("halaman serah terima sesudah catatan ke-100 tetap memakai lingkup sumber dan urutan stabil", async () => {
    const panggilan = [];
    const repo = new HduRepository({ query: async (sql, opsi) => {
        panggilan.push({ sql, opsi });
        return sql.startsWith("SELECT COUNT") ? [{ jumlah: "126" }] : [{ uuid: id }];
    } }, author);
    const hasil = await repo.serahTerima({ halaman: 5, batas: 25, arah: "masuk", status_penerimaan: "menunggu" });
    assert.deepEqual(hasil, { items: [{ uuid: id }], paginasi: { halaman: 5, batas: 25, jumlah: 126 } });
    for (const { sql, opsi } of panggilan) {
        assert.equal(opsi.replacements.f, author.faskesUuid);
        assert.equal(opsi.replacements.offset, 100);
        assert.equal(opsi.replacements.arah, "masuk");
        assert.equal(opsi.replacements.status, "menunggu");
        assert.match(sql, /st.faskes_uuid = :f AND st.deleted_at IS NULL/);
        for (const alias of ["p", "ri", "pt"]) {
            assert.ok(sql.includes(`${alias}.faskes_uuid = st.faskes_uuid`));
            assert.ok(sql.includes(`${alias}.deleted_at IS NULL`));
        }
        assert.match(sql, /st.penerima IS NULL/);
        assert.match(sql, /st.penerima IS NOT NULL/);
    }
    assert.match(panggilan[0].sql, /ORDER BY st.created_at DESC, st.uuid DESC LIMIT :batas OFFSET :offset/);
    assert.equal(panggilan[0].sql.slice(panggilan[0].sql.indexOf("FROM"), panggilan[0].sql.indexOf("ORDER BY")).trim(),
        panggilan[1].sql.slice(panggilan[1].sql.indexOf("FROM")).trim());
});

test("indeks daftar serah terima bersifat idempoten dan tidak mengubah data klinis", async () => {
    let ddl = "";
    await migrasiIndeks.up({ sequelize: {
        transaction: async (jalankan) => jalankan("transaksi-fiktif"),
        query: async (sql, opsi) => { ddl += sql; assert.equal(opsi.transaction, "transaksi-fiktif"); },
    } });
    assert.match(ddl, /CREATE INDEX IF NOT EXISTS hdu_serah_terima_daftar_idx/);
    assert.match(ddl, /faskes_uuid, created_at DESC, uuid DESC/);
    assert.match(ddl, /WHERE deleted_at IS NULL/);
    assert.doesNotMatch(ddl, /DROP|DELETE|UPDATE|INSERT/);
});

test("penutupan episode tanpa perpindahan hanya untuk pulang atau meninggal", () => {
    const valid = { jenis_keluar: "meninggal", waktu_kejadian: 100, catatan: "Catatan fiktif", versi: 1 };
    assert.equal(selesaiSchema.safeParse(valid).success, true);
    for (const ubah of [{ jenis_keluar: "pindah" }, { catatan: " " }, { perpindahan_uuid: id }, { faskes_uuid: id }]) {
        assert.equal(selesaiSchema.safeParse({ ...valid, ...ubah }).success, false);
    }
});

test("episode HDU pasien meninggal ditutup tanpa perpindahan; pulang menunggu pemulangan admisi", async () => {
    const sekarang = Math.floor(Date.now() / 1000);
    const episode = { uuid: id, status: "aktif", versi: 1, rawat_inap_uuid: "admisi-fiktif", waktu_masuk: sekarang - 1000 };
    const ri = { uuid: "admisi-fiktif", status_ri: 3, discharge_date: null };
    const repo = new HduRepository({}, author);
    repo.satu = async (q, tabel) => tabel === "rawat_inaps" ? ri : episode;
    let ditulis = [];
    let menunggu = [];
    const q = async (sql, nilai) => {
        if (/^s*UPDATE/.test(sql)) { ditulis.push({ sql, nilai }); return []; }
        if (sql.includes("FROM hdu_serah_terima")) return menunggu;
        return [];
    };
    const data = { jenis_keluar: "meninggal", waktu_kejadian: sekarang - 10, catatan: "Catatan fiktif", versi: 1 };
    await repo.selesai(q, id, data);
    assert.equal(ditulis.length, 1);
    assert.match(ditulis[0].sql, /^UPDATE hdu_episode SET status = 'selesai'/);
    assert.match(ditulis[0].sql, /status = 'aktif' AND deleted_at IS NULL/);
    assert.equal(ditulis[0].nilai.jenis, "meninggal");
    assert.doesNotMatch(ditulis[0].sql, /perpindahan_keluar_uuid/);

    ditulis = [];
    await assert.rejects(() => repo.selesai(q, id, { ...data, jenis_keluar: "pulang" }), (e) => e.status === 409);
    await assert.rejects(() => repo.selesai(q, id, { ...data, versi: 2 }), (e) => e.status === 409);
    await assert.rejects(() => repo.selesai(q, id, { ...data, waktu_kejadian: sekarang - 5000 }), (e) => e.status === 422);
    menunggu = [{ uuid: "serah-terima-fiktif" }];
    await assert.rejects(() => repo.selesai(q, id, data), (e) => e.status === 409);
    menunggu = [];
    episode.status = "selesai";
    await assert.rejects(() => repo.selesai(q, id, data), (e) => e.status === 409);
    assert.equal(ditulis.length, 0);

    episode.status = "aktif"; ri.status_ri = 4; ri.discharge_date = sekarang;
    await repo.selesai(q, id, { ...data, jenis_keluar: "pulang" });
    assert.equal(ditulis[0].nilai.jenis, "pulang");
});

test("layanan meneruskan penutupan episode dengan kunci pengiriman dan skema penutupan", async () => {
    const panggilan = [];
    const repo = { tulis: async (operasi, data, kunci, jalankan) => { panggilan.push({ operasi, data, kunci }); return jalankan("q"); },
        selesai: async (q, uuid, data) => ({ uuid, jenis_keluar: data.jenis_keluar }) };
    const service = new HduService(repo);
    const req = { params: { uuid: id }, query: {}, get: () => id, body: { jenis_keluar: "meninggal", waktu_kejadian: 100, catatan: "Catatan fiktif", versi: 1 } };
    assert.deepEqual(await service.jalankan("selesai", req, () => false, false), { uuid: id, jenis_keluar: "meninggal" });
    assert.equal(panggilan[0].operasi, `selesai/${id}`);
    await assert.rejects(() => service.jalankan("selesai", { ...req, body: { ...req.body, jenis_keluar: "pindah" } }, () => true, false));
});

test("migrasi jenis keluar intensif idempoten dan tidak menghapus data", async () => {
    let ddl = "";
    await migrasiJenisKeluar.up({ sequelize: {
        transaction: async (jalankan) => jalankan("transaksi-fiktif"),
        query: async (sql, opsi) => { ddl += sql; assert.equal(opsi.transaction, "transaksi-fiktif"); },
    } });
    assert.match(ddl, /ALTER TABLE icu_perawatans ADD COLUMN IF NOT EXISTS jenis_keluar/);
    assert.match(ddl, /ALTER TABLE hdu_episode ADD COLUMN IF NOT EXISTS jenis_keluar/);
    assert.match(ddl, /ALTER TABLE icu_serah_terimas ALTER COLUMN perpindahan_uuid DROP NOT NULL/);
    for (const ubah of ddl.match(/UPDATE[^;]+;/g)) assert.match(ubah, /jenis_keluar IS NULL/);
    assert.doesNotMatch(ddl, /DROP TABLE|DELETE FROM|DROP COLUMN/);
});
