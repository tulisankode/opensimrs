import test from "node:test";
import assert from "node:assert/strict";
import { NicuError, validasiIdentitas, validasiPerpindahan, pastikanVersi, punyaIzinNicu, jsonStabil } from "../src/helpers/nicu-aturan.js";
import { nicuSchemas, validasiIsi } from "../src/validations/nicu-request.js";
import NicuRepository from "../src/repositories/nicu-repository.js";
import { periksaAksesNicu } from "../src/helpers/nicu-izin.js";

const id = (n) => `0199a000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const faskes = id(1);
const author = { faskesUuid: faskes, user_uuid: id(2) };
const definisi = { fields: [{ kode: "nilai_uji", nama: "Parameter sintetis", tipe: "angka", satuan: "satuan uji", wajib: true }] };
const pasien = { uuid: id(3), is_new_born: true, birth_detail_uuid: id(4), no_rm: "TEST-NICU-001", no_identity: "9999000000000001" };
const ri = { uuid: id(5), patient_uuid: pasien.uuid, monitoring_room_uuid: id(6), status_ri: 3, discharge_date: null };
const pindah = { uuid: id(7), admission_ri_uuid: ri.uuid, destination_monitoring_room_uuid: id(6), origin_monitoring_room_uuid: id(8), status_pindah: "approve", waktu_pindah: 100 };

function fixture() {
    const data = {
        rawat_inaps: [{ ...ri }], patients: [{ ...pasien }], perpindahans: [{ ...pindah }],
        room_monitorings: [{ uuid: id(6), room_uuid: id(9), patient_uuid: pasien.uuid, no_bed: "INC-01" }],
        lokasi: [{ uuid: id(9) }], nicu_tempat: [{ uuid: id(10), room_monitoring_uuid: id(6), unit_uuid: id(9), status_alat: "siap", versi: 1 }],
        nicu_episode: [], nicu_penempatan: [], nicu_operasi: [], nicu_dokumen: [], nicu_dokumen_revisi: [],
        nicu_konfigurasi_versi: [{ uuid: id(11), unit_uuid: id(9), jenis: "observasi", status: "terbit", definisi, versi: 2 }],
    };
    for (const rows of Object.values(data)) for (const row of rows) Object.assign(row, { faskes_uuid: faskes, deleted_at: null });
    let counter = 100;
    const catatan = [];
    const query = async (sql, r, t) => {
        catatan.push({ sql, r, t });
        assert.equal(r.faskes, faskes);
        if (sql.includes("pg_advisory")) return [];
        if (sql.includes("FROM ref_modul")) return [{ modul: true, fitur: data.fiturMati ? false : true }];
        if (sql.includes("intensif_cek_bentrok")) return [{ modul: data.intensif ?? null }];
        if (sql.includes("FROM new_borns")) return [];
        if (sql.includes("SELECT uuid FROM perpindahans")) return data.perpindahans.filter((p) => p.admission_ri_uuid === r.ri && p.faskes_uuid === r.faskes && !p.deleted_at && p.status_pindah === "approve").sort((a, b) => b.waktu_pindah - a.waktu_pindah || b.uuid.localeCompare(a.uuid)).slice(0, 1);
        if (sql.includes("UNION ALL")) return data.bentrok ?? data.nicu_penempatan.filter((p) => p.tempat_uuid === r.tempat && !p.selesai_at && !p.deleted_at);
        if (sql.includes("SELECT uuid FROM nicu_tempat WHERE")) return data.nicu_tempat.filter((p) => p.room_monitoring_uuid === r.bed && p.faskes_uuid === r.faskes && !p.deleted_at);
        if (sql.startsWith("INSERT")) {
            const tabel = sql.match(/INSERT INTO (\w+)/)[1];
            const row = { ...r, versi: r.versi ?? 1, status: r.status ?? (tabel === "nicu_episode" ? "aktif" : "draf"), deleted_at: null };
            for (const key of ["isi", "sebelum", "sesudah", "hasil", "definisi"]) if (typeof row[key] === "string") row[key] = JSON.parse(row[key]);
            data[tabel].push(row);
            return [structuredClone(row)];
        }
        if (sql.startsWith("UPDATE")) {
            const tabel = sql.match(/UPDATE (\w+)/)[1];
            const row = data[tabel].find((p) => p.uuid === r.uuid && p.faskes_uuid === r.faskes && !p.deleted_at);
            assert.ok(row);
            const kolom = sql.split(" SET ")[1].split("WHERE")[0].matchAll(/(\w+) = :(\w+)/g);
            for (const [, key, param] of kolom) row[key] = ["isi"].includes(key) ? JSON.parse(r[param]) : r[param];
            return [structuredClone(row)];
        }
        if (sql.includes("FROM nicu_operasi")) return data.nicu_operasi.filter((p) => p.jenis === r.jenis && p.kunci === r.kunci && p.faskes_uuid === r.faskes && !p.deleted_at);
        if (sql.includes("FROM nicu_penempatan WHERE episode_uuid")) return data.nicu_penempatan.filter((p) => p.episode_uuid === r.uuid && !p.selesai_at && p.faskes_uuid === r.faskes && !p.deleted_at).map((p) => structuredClone(p));
        const tabel = sql.match(/SELECT \* FROM (\w+) WHERE uuid/)[1];
        return (data[tabel] ?? []).filter((p) => p.uuid === r.uuid && p.faskes_uuid === r.faskes && !p.deleted_at).map((p) => structuredClone(p));
    };
    let antrian = Promise.resolve();
    const transaction = (proses) => {
        const hasil = antrian.then(async () => {
            const sebelum = structuredClone(data);
            try { return await proses({ sintetis: true }); }
            catch (error) { for (const key of Object.keys(data)) data[key] = sebelum[key]; throw error; }
        });
        antrian = hasil.catch(() => {});
        return hasil;
    };
    const repo = new NicuRepository({ query, transaction, uuid: () => id(counter++), sekarang: () => 200 }, author);
    const masuk = { rawat_inap_uuid: ri.uuid, pasien_uuid: pasien.uuid, tempat_uuid: id(10), perpindahan_masuk_uuid: pindah.uuid, serah_terima: "Serah terima sintetis", verifikasi_identitas: true };
    return { repo, data, masuk, catatan };
}

test("izin NICU membedakan baca, tulis, koreksi, dan modul ICU", () => {
    const p = [{ module: "NICU", subModules: [{ name: "Dokumentasi", allows: ["READ", { name: "KOREKSI" }] }] }];
    assert.equal(punyaIzinNicu(p, "Dokumentasi", "READ"), true);
    assert.equal(punyaIzinNicu(p, "Dokumentasi", "KOREKSI"), true);
    assert.equal(punyaIzinNicu(p, "Dokumentasi", "CREATE"), false);
    assert.equal(punyaIzinNicu([{ ...p[0], module: "ICU" }], "Dokumentasi", "READ"), false);
    assert.equal(punyaIzinNicu([], "Episode", "READ"), false);
});

test("pemeriksa akses menolak sesi, modul mati, fitur mati dan izin yang tidak sah", async () => {
    const jalankan = (pengguna, { modul = true, fitur = true, permissions = "[]", superadmin = false } = {}) => periksaAksesNicu(pengguna, "Dokumentasi", "CREATE", {
        isSuperadmin: () => superadmin,
        query: async (sql, r) => {
            assert.equal(r.faskes, faskes);
            if (sql.includes("FROM users")) { assert.equal(r.uuid, author.user_uuid); return [{ permissions }]; }
            assert.ok(sql.includes("FROM ref_modul"));
            return [{ modul, fitur }];
        },
    });
    assert.equal((await jalankan(null)).status, 401);
    assert.equal((await jalankan(author, { modul: false, superadmin: true })).status, 403);
    assert.equal((await jalankan(author, { fitur: false, superadmin: true })).status, 403);
    assert.equal((await jalankan(author, { permissions: "bukan JSON" })).status, 403);
    assert.equal((await jalankan(author)).status, 403);
    assert.equal(await jalankan(author, { permissions: JSON.stringify([{ module: "NICU", subModules: [{ name: "Dokumentasi", allows: ["CREATE"] }] }]) }), null);
});

test("bayi memakai identitas sendiri dan relasi ambigu ditolak", () => {
    validasiIdentitas(ri, pasien, []);
    assert.throws(() => validasiIdentitas(ri, { ...pasien, is_new_born: false }, []), NicuError);
    assert.throws(() => validasiIdentitas(ri, { ...pasien, uuid: id(50) }, []), NicuError);
    const registrasi = { birth_detail_uuid: pasien.birth_detail_uuid, identifier_mom: "9999000000000002" };
    validasiIdentitas(ri, pasien, [registrasi]);
    assert.throws(() => validasiIdentitas(ri, pasien, [registrasi, registrasi]), NicuError);
    assert.throws(() => validasiIdentitas(ri, pasien, [{ ...registrasi, birth_detail_uuid: id(51) }]), NicuError);
    assert.throws(() => validasiIdentitas(ri, pasien, [{ ...registrasi, identifier_mom: pasien.no_identity }]), NicuError);
});

test("transaksi pasien lain, batal, tempat berbeda, atau pemulangan ditolak", () => {
    validasiPerpindahan(ri, pindah, id(6));
    for (const salah of [{ status_pindah: "pending" }, { admission_ri_uuid: id(20) }, { destination_monitoring_room_uuid: id(21) }]) {
        assert.throws(() => validasiPerpindahan(ri, { ...pindah, ...salah }, id(6)), NicuError);
    }
    assert.throws(() => validasiPerpindahan({ ...ri, status_ri: 4 }, pindah, id(6)), NicuError);
    assert.throws(() => pastikanVersi({ versi: 2 }, 1), (e) => e.status === 409);
});

test("body menolak faskes dan pelaku dari klien serta konfigurasi field asing", () => {
    const { masuk } = fixture();
    nicuSchemas.masuk.parse(masuk);
    assert.equal(nicuSchemas.masuk.safeParse({ ...masuk, faskes_uuid: id(98) }).success, false);
    assert.equal(nicuSchemas.masuk.safeParse({ ...masuk, pencatat: id(99) }).success, false);
    assert.equal(nicuSchemas.masuk.safeParse({ ...masuk, verifikasi_identitas: false }).success, false);
    assert.deepEqual(validasiIsi(definisi, { nilai_uji: 1 }), { nilai_uji: 1 });
    assert.throws(() => validasiIsi(definisi, {}));
    assert.throws(() => validasiIsi(definisi, { nilai_uji: "1" }));
    assert.throws(() => validasiIsi(definisi, { nilai_uji: 1, dosis: 10 }));
    assert.throws(() => validasiIsi(definisi, { nilai_uji: Infinity }));
});

test("penerimaan idempoten, kunci berbeda isi ditolak, seluruh kueri memakai faskes token", async () => {
    const { repo, data, masuk, catatan } = fixture();
    const a = await repo.operasi("masuk", "uji-masuk-001", masuk, (t) => repo.masuk(masuk, t));
    const b = await repo.operasi("masuk", "uji-masuk-001", masuk, () => { throw Error("Tidak boleh membuat ulang"); });
    assert.deepEqual(a, b);
    assert.equal(data.nicu_episode.length, 1);
    assert.equal(data.nicu_penempatan.length, 1);
    assert.equal(data.nicu_tempat[0].status_alat, "siap");
    assert.ok(catatan.every((q) => q.r.faskes === faskes));
    await assert.rejects(repo.operasi("masuk", "uji-masuk-001", { ...masuk, serah_terima: "Berbeda" }, () => {}), (e) => e.status === 409);
    assert.equal(jsonStabil({ b: 1, a: 2 }), jsonStabil({ a: 2, b: 1 }));
});

test("dua penerimaan bersamaan ke satu tempat menghasilkan satu episode pada adaptor terserialisasi", async () => {
    const { repo, data, masuk } = fixture();
    const hasil = await Promise.allSettled(["kunci-pertama", "kunci-kedua"].map((key) => repo.operasi("masuk", key, masuk, (t) => repo.masuk(masuk, t))));
    assert.equal(hasil.filter((h) => h.status === "fulfilled").length, 1);
    assert.equal(data.nicu_episode.length, 1);
});

test("isolasi faskes dan soft delete menolak sumber yang tidak terlihat", async () => {
    for (const perubahan of [{ faskes_uuid: id(99) }, { deleted_at: 150 }]) {
        const { repo, data, masuk } = fixture();
        Object.assign(data.rawat_inaps[0], perubahan);
        await assert.rejects(repo.operasi("masuk", "uji-isolasi", masuk, (t) => repo.masuk(masuk, t)), (e) => e.status === 404);
        assert.equal(data.nicu_episode.length, 0);
    }
});

test("status alat dan bentrok hunian sumber diperiksa sebelum penerimaan", async () => {
    for (const perubahan of [{ status_alat: "rusak" }, { status_alat: "pembersihan" }]) {
        const { repo, data, masuk } = fixture();
        Object.assign(data.nicu_tempat[0], perubahan);
        await assert.rejects(repo.operasi("masuk", "uji-tempat", masuk, (t) => repo.masuk(masuk, t)), (e) => e.status === 409);
        assert.equal(data.nicu_episode.length, 0);
    }
    const { repo, data, masuk } = fixture();
    data.room_monitorings[0].patient_uuid = id(98);
    await assert.rejects(repo.operasi("masuk", "uji-hunian", masuk, (t) => repo.masuk(masuk, t)), NicuError);
});

test("perpindahan mempertahankan episode dan mencatat penempatan tanpa mengubah alat", async () => {
    const { repo, data, masuk } = fixture();
    const episode = await repo.operasi("masuk", "uji-masuk", masuk, (t) => repo.masuk(masuk, t));
    data.room_monitorings.push({ ...data.room_monitorings[0], uuid: id(12), no_bed: "INC-02" });
    data.nicu_tempat.push({ ...data.nicu_tempat[0], uuid: id(13), room_monitoring_uuid: id(12) });
    data.rawat_inaps[0].monitoring_room_uuid = id(12);
    data.perpindahans.push({ ...data.perpindahans[0], uuid: id(14), destination_monitoring_room_uuid: id(12), origin_monitoring_room_uuid: id(6), waktu_pindah: 200 });
    const pindahData = { versi: 1, tempat_tujuan_uuid: id(13), perpindahan_uuid: id(14) };
    const hasil = await repo.operasi("pindah", "uji-pindah", pindahData, (t) => repo.pindah(episode.uuid, pindahData, t));
    assert.equal(hasil.uuid, episode.uuid);
    assert.equal(hasil.versi, 2);
    assert.equal(data.nicu_penempatan.length, 2);
    assert.equal(data.nicu_penempatan.filter((p) => !p.selesai_at).length, 1);
    assert.equal(data.nicu_tempat.every((p) => p.status_alat === "siap"), true);
});

test("koreksi mempertahankan nilai awal, alasan, pelaku dan versi; konfigurasi draf ditolak", async () => {
    const { repo, data, masuk } = fixture();
    const e = await repo.operasi("masuk", "uji-masuk", masuk, (t) => repo.masuk(masuk, t));
    const d = { konfigurasi_versi_uuid: id(11), waktu_pencatatan: 200, isi: { nilai_uji: 1 } };
    data.nicu_konfigurasi_versi[0].status = "draf";
    await assert.rejects(repo.operasi("dokumen", "uji-dokumen", d, (t) => repo.tambahDokumen(e.uuid, d, t)), NicuError);
    data.nicu_konfigurasi_versi[0].status = "terbit";
    const dokumen = await repo.operasi("dokumen", "uji-dokumen", d, (t) => repo.tambahDokumen(e.uuid, d, t));
    const koreksi = { versi: 1, alasan: "Koreksi sintetis", isi: { nilai_uji: 2 } };
    await repo.operasi("koreksi", "uji-koreksi", koreksi, (t) => repo.koreksi(dokumen.uuid, koreksi, t));
    assert.deepEqual(data.nicu_dokumen_revisi[0].sebelum, { nilai_uji: 1 });
    assert.deepEqual(data.nicu_dokumen_revisi[0].sesudah, { nilai_uji: 2 });
    assert.equal(data.nicu_dokumen_revisi[0].pencatat, author.user_uuid);
    assert.equal(data.nicu_dokumen_revisi[0].alasan, koreksi.alasan);
    assert.equal(data.nicu_dokumen[0].versi, 2);
    await assert.rejects(repo.operasi("koreksi", "uji-versi-lama", koreksi, (t) => repo.koreksi(dokumen.uuid, koreksi, t)), (e) => e.status === 409);
});

test("pemulangan belum valid mempertahankan episode; pemulangan sah menutup hunian", async () => {
    const { repo, data, masuk } = fixture();
    const e = await repo.operasi("masuk", "uji-masuk", masuk, (t) => repo.masuk(masuk, t));
    const selesai = { versi: 1, serah_terima: "Ringkasan sintetis" };
    await assert.rejects(repo.operasi("selesai", "uji-selesai", selesai, (t) => repo.selesai(e.uuid, selesai, t)), (e) => e.status === 409);
    assert.equal(data.nicu_episode[0].status, "aktif");
    assert.equal(data.nicu_penempatan[0].selesai_at, undefined);
    data.rawat_inaps[0].status_ri = 4;
    data.rawat_inaps[0].discharge_date = 200;
    await repo.operasi("selesai", "uji-selesai", selesai, (t) => repo.selesai(e.uuid, selesai, t));
    assert.equal(data.nicu_episode[0].status, "selesai");
    assert.equal(data.nicu_penempatan[0].selesai_at, data.nicu_episode[0].keluar_at);
    assert.equal(data.nicu_tempat[0].status_alat, "siap");
    await assert.rejects(repo.operasi("dokumen", "uji-setelah-selesai", {}, (t) => repo.tambahDokumen(e.uuid, {}, t)), (e) => e.status === 409);
});

test("penerbitan membutuhkan versi yang cocok dan konfigurasi terbit tidak ditimpa", async () => {
    const { repo, data } = fixture();
    data.nicu_konfigurasi_versi[0].status = "draf";
    const d = { versi: 2, referensi_pengesahan: "Referensi sintetis" };
    await repo.operasi("terbit", "uji-terbit", d, (t) => repo.terbitkan(id(11), d, t));
    assert.equal(data.nicu_konfigurasi_versi[0].status, "terbit");
    assert.equal(data.nicu_konfigurasi_versi[0].diterbitkan_oleh, author.user_uuid);
    await assert.rejects(repo.operasi("terbit", "uji-terbit-ulang", { ...d, versi: 3 }, (t) => repo.terbitkan(id(11), { ...d, versi: 3 }, t)), (e) => e.status === 409);
});

test("bentrok lintas unit dan transaksi lama tidak membentuk episode", async () => {
    const bentrok = fixture();
    bentrok.data.bentrok = [{ uuid: id(90) }];
    await assert.rejects(bentrok.repo.operasi("masuk", "uji-icu-aktif", bentrok.masuk, (t) => bentrok.repo.masuk(bentrok.masuk, t)), (e) => e.status === 409);
    assert.equal(bentrok.data.nicu_episode.length, 0);
    const lama = fixture();
    lama.data.perpindahans.push({ ...lama.data.perpindahans[0], uuid: id(91), waktu_pindah: 150 });
    await assert.rejects(lama.repo.operasi("masuk", "uji-transaksi-lama", lama.masuk, (t) => lama.repo.masuk(lama.masuk, t)), (e) => e.status === 409);
    assert.equal(lama.data.nicu_episode.length, 0);
});

test("transfer keluar memvalidasi pasien dan sumber lalu menutup episode tanpa mengubah alat", async () => {
    const { repo, data, masuk } = fixture();
    const e = await repo.operasi("masuk", "uji-masuk", masuk, (t) => repo.masuk(masuk, t));
    data.room_monitorings.push({ ...data.room_monitorings[0], uuid: id(30), no_bed: "BED-UJI-01" });
    data.rawat_inaps[0].monitoring_room_uuid = id(30);
    data.perpindahans.push({ ...data.perpindahans[0], uuid: id(31), destination_monitoring_room_uuid: id(30), origin_monitoring_room_uuid: id(6), waktu_pindah: 200 });
    const d = { versi: 1, perpindahan_keluar_uuid: id(31), serah_terima: "Transfer sintetis" };
    data.perpindahans.at(-1).admission_ri_uuid = id(98);
    await assert.rejects(repo.operasi("selesai", "uji-transfer", d, (t) => repo.selesai(e.uuid, d, t)), NicuError);
    assert.equal(data.nicu_episode[0].status, "aktif");
    data.perpindahans.at(-1).admission_ri_uuid = ri.uuid;
    const hasil = await repo.operasi("selesai", "uji-transfer", d, (t) => repo.selesai(e.uuid, d, t));
    assert.equal(hasil.status, "selesai");
    assert.equal(hasil.perpindahan_keluar_uuid, id(31));
    assert.equal(data.nicu_tempat[0].status_alat, "siap");
});
