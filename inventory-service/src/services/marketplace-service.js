import crypto from "node:crypto";
import { uuidv7 } from "uuidv7";
import moment from "moment";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import BadRequestException from "../errors/bad-request-exception.js";
import NotfoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import { enkripsi, dekripsi, buatKunci, samarkan, hashKunci } from "../helpers/rahasia-marketplace.js";
import UnauthorizedException from "../errors/unauthorized-exception.js";
import ItemMedisJenisStokRepository from "../repositories/item-medis-jenis-stok-repository.js";
import MarketplaceRepository from "../repositories/marketplace-repository.js";
import InventoryBarangRepository from "../repositories/inventory-barang-repository.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";
import MarketplaceAdapterService, { MarketplaceTidakPastiException } from "./marketplace-adapter-service.js";
import MarketplaceValidation from "../validations/marketplace-validation.js";

// Status pesanan yang mengizinkan checkout dicoba (ulang). Status sesudahnya dianggap sudah terkirim ke mitra
// dan checkout bersifat idempoten: panggilan ulang tidak membuat pesanan mitra baru (KT-8).
const STATUS_BOLEH_CHECKOUT = ["draft", "menunggu_konfirmasi"];

// Urutan maju status pesanan. Pembaruan dari mitra (webhook/tarik) yang datang terlambat tidak boleh memundurkan
// status (mis. "dikirim" sesudah "diterima"); status akhir (diterima/dibatalkan) tidak diubah lagi.
const URUTAN_STATUS = {
    draft: 0,
    menunggu_konfirmasi: 1,
    dibayar: 2,
    dikemas: 3,
    dikirim: 4,
    diterima_sebagian: 5,
    diterima: 6,
};
const STATUS_AKHIR = ["diterima", "dibatalkan"];
export const statusBolehBerubah = (lama, baru) => {
    if (!baru || lama === baru) return false;
    if (STATUS_AKHIR.includes(lama)) return false;
    if (baru === "dibatalkan") return true;
    return (URUTAN_STATUS[baru] ?? -1) > (URUTAN_STATUS[lama] ?? -1);
};

// Dekripsi untuk tampilan tersamar saja; kunci enkripsi yang berganti tidak boleh membuat daftar koneksi gagal dimuat.
const dekripsiAman = (nilai) => {
    try {
        return dekripsi(nilai);
    } catch {
        return null;
    }
};

// Perbandingan kunci masuk webhook dalam waktu konstan (hash dulu agar panjang buffer sama).
export const kunciCocok = (diharapkan, diterima) => {
    if (!diharapkan || !diterima) return false;
    return crypto.timingSafeEqual(Buffer.from(hashKunci(diharapkan), "hex"), Buffer.from(hashKunci(String(diterima)), "hex"));
};

const nonSecretKoneksi = (k) => ({
    uuid: k.uuid,
    mitra_kode: k.mitra_kode,
    nama_mitra: k.nama_mitra,
    base_url: k.base_url,
    akun_afiliasi: k.akun_afiliasi,
    supplier_uuid: k.supplier_uuid,
    mode_mock: k.mode_mock,
    aktif: k.aktif,
    kunci_tersimpan: !!k.api_key_enc,
    api_key_samaran: k.api_key_enc ? samarkan(dekripsiAman(k.api_key_enc)) : null,
    kunci_masuk_tersimpan: !!k.kunci_masuk_enc,
});

export default class MarketplaceService {
    // --- Konfigurasi koneksi ---
    static async getKonfigurasi(payload) {
        const validated = await MarketplaceValidation.GET_KONFIGURASI.parseAsync(payload);
        const list = await MarketplaceRepository.listKoneksi(validated.faskes_uuid);
        return list.map(nonSecretKoneksi);
    }

    static async putKonfigurasi(payload) {
        const validated = await MarketplaceValidation.PUT_KONFIGURASI.parseAsync(payload);
        const supplier = await MarketplaceRepository.findSupplier({ uuid: validated.supplier_uuid, faskes_uuid: validated.faskes_uuid });
        if (!supplier) {
            throw new BadRequestException([{ field: "supplier_uuid", message: "Supplier (datamaster) tidak ditemukan untuk faskes ini" }]);
        }
        const existing = await MarketplaceRepository.findKoneksi({ faskes_uuid: validated.faskes_uuid, mitra_kode: validated.mitra_kode });

        const data = {
            faskes_uuid: validated.faskes_uuid,
            mitra_kode: validated.mitra_kode,
            nama_mitra: validated.nama_mitra,
            base_url: validated.base_url,
            akun_afiliasi: validated.akun_afiliasi ?? null,
            supplier_uuid: validated.supplier_uuid,
            mode_mock: validated.mode_mock,
            aktif: validated.aktif,
        };
        if (validated.api_key) data.api_key_enc = enkripsi(validated.api_key);

        let kunciMasukBaru = null;
        if (!existing || !existing.kunci_masuk_enc) {
            kunciMasukBaru = buatKunci();
            data.kunci_masuk_enc = enkripsi(kunciMasukBaru);
        }

        const koneksi = await MarketplaceRepository.upsertKoneksi(data);
        const hasil = nonSecretKoneksi(koneksi);
        // Kunci masuk hanya ditampilkan satu kali, saat pertama kali dibuat (pola sama dengan Bridging UTD).
        if (kunciMasukBaru) hasil.kunci_masuk_baru = kunciMasukBaru;
        return hasil;
    }

    // --- Penawaran ---
    static async cariPenawaran(payload) {
        const validated = await MarketplaceValidation.GET_PENAWARAN.parseAsync(payload);
        const koneksi = await MarketplaceRepository.findKoneksi({ faskes_uuid: validated.faskes_uuid, mitra_kode: validated.mitra_kode });
        if (!koneksi || !koneksi.aktif) {
            throw new BadRequestException([{ field: "mitra_kode", message: "Koneksi marketplace belum dikonfigurasi/aktif untuk faskes ini" }]);
        }
        const penawaran = await MarketplaceAdapterService.cariPenawaran(koneksi, { q: validated.q, limit: validated.limit });
        const produkIds = penawaran.map((p) => p.produk_mitra_id);
        const pemetaanList = produkIds.length
            ? await Promise.all(produkIds.map((id) => MarketplaceRepository.findPemetaan({ faskes_uuid: validated.faskes_uuid, mitra_kode: validated.mitra_kode, produk_mitra_id: id })))
            : [];
        const pemetaanMap = new Map(produkIds.map((id, i) => [id, pemetaanList[i]]));
        return penawaran.map((p) => ({ ...p, terpetakan: !!pemetaanMap.get(p.produk_mitra_id)?.aktif }));
    }

    static async getKonversiItem(payload, headers) {
        const validated = await MarketplaceValidation.GET_KONVERSI_ITEM.parseAsync(payload);
        return this._konversiItem(validated.item_uuid, validated.faskes_uuid, headers);
    }

    // Endpoint farmasi /datamaster/item-medis/conversions mengembalikan SEMUA konversi faskes (parameter
    // item_medis_uuid diabaikan), jadi hasilnya wajib disaring per item di sini agar satuan item lain tidak terpilih.
    static async _konversiItem(item_uuid, faskes_uuid, headers) {
        const conversionList = await FarmasiExternalRepository.getConversionByItem({ item_medis_uuid: item_uuid, faskes_uuid }, headers);
        return (conversionList || []).filter((c) => c.item_medis_uuid === item_uuid && c.status !== false);
    }

    // --- Pemetaan produk ---
    static async upsertPemetaan(payload, headers) {
        const validated = await MarketplaceValidation.PUT_PEMETAAN.parseAsync(payload);
        const konversi = await this._validasiKonversi(validated.item_uuid, validated.satuan_uuid, validated.faskes_uuid, headers);
        const pemetaan = await MarketplaceRepository.upsertPemetaan({
            faskes_uuid: validated.faskes_uuid,
            mitra_kode: validated.mitra_kode,
            produk_mitra_id: validated.produk_mitra_id,
            nama_produk_mitra: validated.nama_produk_mitra,
            kemasan_mitra: validated.kemasan_mitra,
            item_uuid: validated.item_uuid,
            satuan_uuid: validated.satuan_uuid,
            konversi_uuid: konversi.uuid,
            konversi: konversi.konversi,
            aktif: true,
        });
        return pemetaan;
    }

    static async listPemetaan(payload) {
        const validated = await MarketplaceValidation.GET_PEMETAAN.parseAsync(payload);
        return MarketplaceRepository.listPemetaan(validated);
    }

    static async _validasiKonversi(item_uuid, satuan_uuid, faskes_uuid, headers) {
        const conversionList = await this._konversiItem(item_uuid, faskes_uuid, headers);
        const selected = conversionList.find((c) => c.satuan_pembelian_uuid === satuan_uuid);
        if (!selected) {
            throw new BadRequestException([{ field: "satuan_uuid", message: "Satuan pembelian tidak valid/tidak ada relasi konversi untuk item ini" }]);
        }
        if (!selected.konversi || selected.konversi <= 0) {
            throw new BadRequestException([{ field: "satuan_uuid", message: "Data master konversi tidak valid (nilai konversi 0)" }]);
        }
        return selected;
    }

    // --- Permintaan ---
    static async createPermintaan(payload, headers) {
        const validated = await MarketplaceValidation.CREATE_PERMINTAAN.parseAsync(payload);
        const koneksi = await MarketplaceRepository.findKoneksi({ faskes_uuid: validated.faskes_uuid, mitra_kode: validated.mitra_kode });
        if (!koneksi || !koneksi.aktif) {
            throw new BadRequestException([{ field: "mitra_kode", message: "Koneksi marketplace belum dikonfigurasi/aktif untuk faskes ini" }]);
        }

        const itemRows = [];
        const itemUuids = new Set();
        let nilaiPerkiraan = 0;
        for (const item of validated.items) {
            const pemetaan = await MarketplaceRepository.findPemetaan({
                faskes_uuid: validated.faskes_uuid,
                mitra_kode: validated.mitra_kode,
                produk_mitra_id: item.produk_mitra_id,
            });
            if (!pemetaan || !pemetaan.aktif) {
                throw new BadRequestException([{ field: "items", message: `Produk mitra ${item.produk_mitra_id} belum dipetakan ke master barang` }]);
            }
            const konversi = await this._validasiKonversi(pemetaan.item_uuid, pemetaan.satuan_uuid, validated.faskes_uuid, headers);
            const totalHarga = item.jumlah * item.harga_satuan;
            itemUuids.add(pemetaan.item_uuid);
            nilaiPerkiraan += totalHarga;
            itemRows.push({
                produk_mitra_id: item.produk_mitra_id,
                nama_produk_mitra: item.nama_produk_mitra ?? pemetaan.nama_produk_mitra,
                item_uuid: pemetaan.item_uuid,
                satuan_uuid: pemetaan.satuan_uuid,
                konversi_uuid: konversi.uuid,
                konversi: konversi.konversi,
                jumlah: item.jumlah,
                harga_satuan: item.harga_satuan,
                total_harga: totalHarga,
                stok_penawaran: item.stok_penawaran ?? null,
                estimasi_kirim: item.estimasi_kirim ?? null,
                penawaran_diambil_pada: moment().unix(),
            });
        }

        // Sama dengan pembuatan PO biasa (PengadaanBarangService.create): semua item harus terdaftar pada jenis stok
        // yang dipilih, karena checkout nanti membuat PO dengan jenis stok ini.
        const validItemsCount = await ItemMedisJenisStokRepository.countValidItemsForJenisStok(
            [...itemUuids],
            validated.jenis_stok_uuid,
            validated.faskes_uuid
        );
        if (validItemsCount !== itemUuids.size) {
            throw new BadRequestException([{ field: "items", message: "Terdapat item yang tidak sesuai dengan Jenis Stok yang dipilih. Harap periksa kembali." }]);
        }

        const dataPesanan = {
            faskes_uuid: validated.faskes_uuid,
            mitra_kode: validated.mitra_kode,
            nomor_internal: Utils.generate4Code("MKT"),
            pemohon_uuid: validated.pemohon_uuid,
            pemohon_nama: validated.pemohon_nama,
            jenis_stok_uuid: validated.jenis_stok_uuid,
            lokasi_stok_uuid: validated.lokasi_stok_uuid,
            kategori_item: validated.kategori_item,
            jenis_item: validated.jenis_item,
            metode_pembelian: validated.metode_pembelian,
            catatan: validated.catatan,
            nilai_perkiraan: nilaiPerkiraan,
            status_persetujuan: "menunggu",
            status_pesanan: "draft",
            diajukan_pada: moment().unix(),
        };

        const transaction = await sequelizeInstance.transaction();
        try {
            const pesanan = await MarketplaceRepository.createPesanan(dataPesanan, itemRows, transaction);
            await transaction.commit();
            return MarketplaceRepository.findDetail({ uuid: pesanan.uuid, faskes_uuid: validated.faskes_uuid });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async getDetail(payload) {
        const validated = await MarketplaceValidation.GET_DETAIL_PESANAN.parseAsync(payload);
        const detail = await MarketplaceRepository.findDetail(validated);
        if (!detail) throw new NotfoundException(`Pesanan marketplace dengan UUID ${validated.uuid} tidak ditemukan`);
        return detail;
    }

    static async listPesanan(payload) {
        const validated = await MarketplaceValidation.GET_LIST_PESANAN.parseAsync(payload);
        return MarketplaceRepository.listPesanan(validated);
    }

    // --- Persetujuan ---
    static async putuskanPersetujuan(payload) {
        const validated = await MarketplaceValidation.PERSETUJUAN.parseAsync(payload);
        const detail = await MarketplaceRepository.findDetail({ uuid: validated.uuid, faskes_uuid: validated.faskes_uuid });
        if (!detail) throw new NotfoundException(`Pesanan marketplace dengan UUID ${validated.uuid} tidak ditemukan`);
        if (detail.pesanan.status_persetujuan !== "menunggu") {
            throw new BadRequestException([{ field: "status", message: `Permintaan sudah ${detail.pesanan.status_persetujuan}, tidak bisa diputuskan ulang` }]);
        }

        const urutan = (await MarketplaceRepository.hitungJenjangPersetujuan(validated.uuid)) + 1;
        const transaction = await sequelizeInstance.transaction();
        try {
            await MarketplaceRepository.createPersetujuan({
                faskes_uuid: validated.faskes_uuid,
                pesanan_uuid: validated.uuid,
                urutan,
                pemberi_uuid: validated.pemberi_uuid,
                pemberi_nama: validated.pemberi_nama,
                keputusan: validated.keputusan,
                alasan: validated.alasan,
                diputuskan_pada: moment().unix(),
            }, transaction);
            await MarketplaceRepository.updatePesanan(
                { uuid: validated.uuid, faskes_uuid: validated.faskes_uuid },
                { status_persetujuan: validated.keputusan === "setujui" ? "disetujui" : "ditolak", alasan_batal: validated.keputusan === "tolak" ? validated.alasan : null },
                transaction
            );
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        return MarketplaceRepository.findDetail({ uuid: validated.uuid, faskes_uuid: validated.faskes_uuid });
    }

    // --- Checkout (idempoten) ---
    static async checkout(payload) {
        const validated = await MarketplaceValidation.CHECKOUT.parseAsync(payload);
        const detail = await MarketplaceRepository.findDetail(validated);
        if (!detail) throw new NotfoundException(`Pesanan marketplace dengan UUID ${validated.uuid} tidak ditemukan`);
        const { pesanan, items } = detail;

        if (pesanan.status_persetujuan !== "disetujui") {
            throw new BadRequestException([{ field: "status_persetujuan", message: "Permintaan belum disetujui, checkout tidak dapat dilakukan" }]);
        }
        // Idempoten: pesanan yang sudah punya nomor mitra/status lanjut tidak dikirim ulang ke mitra (KT-8).
        if (pesanan.nomor_pesanan_mitra || !STATUS_BOLEH_CHECKOUT.includes(pesanan.status_pesanan)) {
            return this.getDetail(validated);
        }

        const koneksi = await MarketplaceRepository.findKoneksi({ faskes_uuid: validated.faskes_uuid, mitra_kode: pesanan.mitra_kode });
        if (!koneksi || !koneksi.aktif) {
            throw new BadRequestException([{ field: "mitra_kode", message: "Koneksi marketplace tidak aktif, checkout dibatalkan" }]);
        }

        let hasil;
        try {
            hasil = await MarketplaceAdapterService.checkout(koneksi, {
                idempotencyKey: pesanan.nomor_internal,
                items: items.map((i) => ({ produk_mitra_id: i.produk_mitra_id, jumlah: i.jumlah, harga_satuan: i.harga_satuan })),
                catatan: pesanan.catatan,
            });
        } catch (error) {
            if (error instanceof MarketplaceTidakPastiException) {
                // G7 — hasil tidak pasti: tahan di menunggu_konfirmasi, JANGAN buat PO, boleh diulang kunci yang sama.
                await MarketplaceRepository.updatePesanan(validated, { status_pesanan: "menunggu_konfirmasi" });
            }
            throw error;
        }

        // Respons tanpa status eksplisit belum mengonfirmasi pembayaran; checkout hanya memastikan pesanan terkirim.
        const statusLokal = MarketplaceAdapterService.petakanStatus(hasil.status) || "menunggu_konfirmasi";
        if (!hasil.nomor_pesanan_mitra) {
            // Mitra membalas sukses tanpa nomor pesanan: tidak bisa dilacak/diterima, perlakukan sebagai tidak pasti.
            await MarketplaceRepository.updatePesanan(validated, { status_pesanan: "menunggu_konfirmasi" });
            throw new MarketplaceTidakPastiException("Mitra tidak mengembalikan nomor pesanan; ulangi checkout untuk konfirmasi");
        }
        const transaction = await sequelizeInstance.transaction();
        try {
            // Kunci baris pesanan: dua checkout bersamaan (klik ganda/dua pengguna) mendapat pesanan mitra yang sama
            // berkat Idempotency-Key, tetapi PO hanya boleh dibuat satu kali.
            const terkunci = await MarketplaceRepository.kunciPesanan(validated, transaction);
            if (terkunci?.pembelian_barang_supplier_uuid) {
                await transaction.rollback();
                return this.getDetail(validated);
            }
            const po = await this._buatPoDariPesanan(pesanan, items, koneksi, transaction);
            await MarketplaceRepository.updatePesanan(validated, {
                nomor_pesanan_mitra: hasil.nomor_pesanan_mitra,
                status_pesanan: statusLokal,
                pembelian_barang_supplier_uuid: po.uuid,
                checkout_pada: moment().unix(),
            }, transaction);
            if (hasil.tagihan) {
                await MarketplaceRepository.upsertTagihan({ pesanan_uuid: pesanan.uuid, faskes_uuid: validated.faskes_uuid }, {
                    referensi_tagihan: hasil.tagihan.referensi_tagihan ?? hasil.nomor_pesanan_mitra,
                    nilai: hasil.tagihan.nilai ?? pesanan.nilai_perkiraan,
                    tanggal: hasil.tagihan.tanggal ?? moment().unix(),
                    status_dikonfirmasi: "belum",
                }, transaction);
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        return this.getDetail(validated);
    }

    static async _buatPoDariPesanan(pesanan, items, koneksi, transaction) {
        const dataPo = {
            kategori_item: pesanan.kategori_item,
            jenis_stok_uuid: pesanan.jenis_stok_uuid,
            jenis_item: pesanan.jenis_item,
            supplier_uuid: koneksi.supplier_uuid,
            tanggal_pembelian: pesanan.diajukan_pada,
            metode_pembelian: pesanan.metode_pembelian,
            catatan_po: `Checkout marketplace ${koneksi.nama_mitra} — pesanan ${pesanan.nomor_internal}`,
            isCito: false,
            total_item: items.length,
            diskon: 0,
            materai: 0,
            ppn: 0,
            grand_total: items.reduce((acc, i) => acc + Number(i.total_harga), 0),
            petugas_pembuat_po: pesanan.pemohon_nama || pesanan.pemohon_uuid,
            petugas_pembuat_po_uuid: pesanan.pemohon_uuid,
            status: "verifikasi",
            lokasi_stok_uuid: pesanan.lokasi_stok_uuid,
            faskes_uuid: pesanan.faskes_uuid,
            no_po: Utils.generate4Code("MP"),
        };
        const po = await InventoryBarangRepository.createPembelianBarang(dataPo, transaction);
        const itemsToCreate = items.map((item) => ({
            uuid: uuidv7(),
            pembelian_barang_supplier_uuid: po.uuid,
            faskes_uuid: pesanan.faskes_uuid,
            item_uuid: item.item_uuid,
            qty_order: item.jumlah,
            harga_satuan: item.harga_satuan,
            total_harga: item.total_harga,
            konversi_uuid: item.konversi_uuid,
        }));
        await InventoryBarangRepository.bulkCreate(itemsToCreate, transaction);
        return po;
    }

    // Terapkan satu pembaruan status dari mitra (webhook/tarik) secara atomik: catat peristiwa (dedup lewat unique
    // index faskes_uuid+sumber+peristiwa_mitra_id), ubah status hanya bila maju, dan perbarui catatan tagihan.
    // Bila gagal di tengah jalan seluruhnya dibatalkan, jadi pengiriman ulang dari mitra tidak terbuang sebagai duplikat.
    static async _terapkanPembaruan({ pesanan, faskes_uuid, sumber, peristiwa_mitra_id, status_mitra, tagihan, nomor_pesanan_mitra }) {
        const statusLokalMitra = MarketplaceAdapterService.petakanStatus(status_mitra);
        const transaction = await sequelizeInstance.transaction();
        try {
            const terkunci = await MarketplaceRepository.kunciPesanan({ uuid: pesanan.uuid, faskes_uuid }, transaction);
            const statusLama = terkunci?.status_pesanan ?? pesanan.status_pesanan;
            const berubah = statusBolehBerubah(statusLama, statusLokalMitra);
            let catatan = null;
            if (!statusLokalMitra) catatan = "Status mitra tidak dikenal, status lokal tidak diubah (KT-10)";
            else if (!berubah && statusLokalMitra !== statusLama) catatan = `Status ${statusLokalMitra} diabaikan: tidak boleh mundur dari ${statusLama}`;

            const { duplikat } = await MarketplaceRepository.catatPeristiwa({
                faskes_uuid,
                pesanan_uuid: pesanan.uuid,
                sumber,
                peristiwa_mitra_id,
                status_mitra,
                status_lokal: statusLokalMitra,
                valid: !!statusLokalMitra,
                catatan,
                payload: { status: status_mitra },
            }, transaction);
            if (duplikat) {
                await transaction.rollback();
                return { duplikat: true, berubah: false };
            }

            await MarketplaceRepository.updatePesanan(
                { uuid: pesanan.uuid, faskes_uuid },
                berubah ? { status_pesanan: statusLokalMitra, sinkron_terakhir_pada: moment().unix() } : { sinkron_terakhir_pada: moment().unix() },
                transaction
            );
            if (tagihan) {
                await MarketplaceRepository.upsertTagihan({ pesanan_uuid: pesanan.uuid, faskes_uuid }, {
                    referensi_tagihan: tagihan.referensi_tagihan ?? nomor_pesanan_mitra,
                    nilai: tagihan.nilai ?? pesanan.nilai_perkiraan,
                    tanggal: tagihan.tanggal ?? moment().unix(),
                    status_dikonfirmasi: tagihan.status_dikonfirmasi ?? "belum",
                }, transaction);
            }
            await transaction.commit();
            return { duplikat: false, berubah };
        } catch (error) {
            if (!transaction.finished) await transaction.rollback();
            throw error;
        }
    }

    // --- Sinkron status (tarik) ---
    static async sinkronStatus(payload) {
        const validated = await MarketplaceValidation.SINKRON_STATUS.parseAsync(payload);
        const detail = await MarketplaceRepository.findDetail(validated);
        if (!detail) throw new NotfoundException(`Pesanan marketplace dengan UUID ${validated.uuid} tidak ditemukan`);
        const { pesanan } = detail;
        if (!pesanan.nomor_pesanan_mitra) {
            throw new BadRequestException([{ field: "status", message: "Pesanan belum checkout, belum ada nomor pesanan mitra" }]);
        }
        const koneksi = await MarketplaceRepository.findKoneksi({ faskes_uuid: validated.faskes_uuid, mitra_kode: pesanan.mitra_kode });
        if (!koneksi) {
            throw new BadRequestException([{ field: "mitra_kode", message: "Koneksi marketplace untuk pesanan ini tidak ditemukan" }]);
        }
        const hasil = await MarketplaceAdapterService.cekStatus(koneksi, pesanan.nomor_pesanan_mitra);
        await this._terapkanPembaruan({
            pesanan,
            faskes_uuid: validated.faskes_uuid,
            sumber: "tarik",
            peristiwa_mitra_id: `tarik-${uuidv7()}`,
            status_mitra: hasil.status,
            tagihan: hasil.tagihan,
            nomor_pesanan_mitra: pesanan.nomor_pesanan_mitra,
        });
        return this.getDetail(validated);
    }

    // --- Webhook (berkunci per koneksi; faskes_uuid HANYA dari koneksi yang ditemukan — bukan dari payload) ---
    static async webhook(koneksi_uuid, headers, body) {
        // Koneksi tidak dikenal & kunci salah dibalas sama (401) agar UUID koneksi tidak bisa ditebak lewat respons.
        const koneksi = await MarketplaceRepository.findKoneksiByUuid(String(koneksi_uuid ?? ""));
        let kunciMasuk = null;
        try {
            kunciMasuk = koneksi ? dekripsi(koneksi.kunci_masuk_enc) : null;
        } catch {
            kunciMasuk = null;
        }
        if (!kunciCocok(kunciMasuk, headers["x-api-key"])) {
            throw new UnauthorizedException("Kunci masuk webhook tidak valid");
        }

        const validated = await MarketplaceValidation.WEBHOOK.parseAsync({ ...body, koneksi_uuid });
        const pesanan = await MarketplaceRepository.findPesananByNomorMitra({
            faskes_uuid: koneksi.faskes_uuid,
            mitra_kode: koneksi.mitra_kode,
            nomor_pesanan_mitra: validated.nomor_pesanan_mitra,
        });
        if (!pesanan) return { diterima: false, duplikat: false, pesan: "nomor_pesanan_mitra tidak dikenal" };

        // Dedup: id peristiwa dari mitra bila ada, selain itu kombinasi nomor pesanan+status (cukup untuk
        // menolak pengiriman ulang webhook yang identik — G8/KT-9).
        const peristiwaId = validated.peristiwa_id || `${validated.nomor_pesanan_mitra}:${validated.status}`;
        const { duplikat } = await this._terapkanPembaruan({
            pesanan,
            faskes_uuid: koneksi.faskes_uuid,
            sumber: "webhook",
            peristiwa_mitra_id: peristiwaId,
            status_mitra: validated.status,
            tagihan: validated.tagihan,
            nomor_pesanan_mitra: validated.nomor_pesanan_mitra,
        });
        return { diterima: true, duplikat };
    }

    // --- Penerimaan: hanya menautkan ke PO, pencatatan penerimaan tetap lewat alur Penerimaan Pembelian ---
    static async getPenerimaanInfo(payload) {
        const validated = await MarketplaceValidation.GET_DETAIL_PESANAN.parseAsync(payload);
        const detail = await MarketplaceRepository.findDetail(validated);
        if (!detail) throw new NotfoundException(`Pesanan marketplace dengan UUID ${validated.uuid} tidak ditemukan`);
        const po = await MarketplaceRepository.findPoRingkas(detail.pesanan.pembelian_barang_supplier_uuid, validated.faskes_uuid);
        return {
            pembelian_barang_supplier_uuid: po?.uuid ?? null,
            no_po: po?.no_po ?? null,
            status_po: po?.status ?? null,
            siap_diterima: po?.status === "verifikasi",
            sudah_diterima: po?.status === "diterima",
        };
    }

    // --- Laporan ---
    static async laporan(payload) {
        const validated = await MarketplaceValidation.GET_LAPORAN.parseAsync(payload);
        const list = await MarketplaceRepository.listPesanan({
            faskes_uuid: validated.faskes_uuid,
            status_pesanan: validated.status,
            mitra_kode: validated.mitra_kode,
            dari: validated.dari,
            sampai: validated.sampai,
            page: validated.page,
            limit: validated.limit,
        });
        // Rentang tanggal disaring di query (bukan sesudah paginasi) agar jumlah halaman & total tetap benar.
        const data = await Promise.all(
            list.data
                .map(async (row) => {
                    const po = await MarketplaceRepository.findPoRingkas(row.pembelian_barang_supplier_uuid, row.faskes_uuid);
                    const selisih = await MarketplaceRepository.hitungSelisihPo(row.pembelian_barang_supplier_uuid);
                    return {
                        uuid: row.uuid,
                        nomor_internal: row.nomor_internal,
                        nomor_pesanan_mitra: row.nomor_pesanan_mitra,
                        mitra_kode: row.mitra_kode,
                        nilai_perkiraan: row.nilai_perkiraan,
                        status_persetujuan: row.status_persetujuan,
                        status_pesanan: row.status_pesanan,
                        no_po: po?.no_po ?? null,
                        status_po: po?.status ?? null,
                        qty_dipesan: selisih?.qty_dipesan ?? null,
                        qty_diterima: selisih?.qty_diterima ?? null,
                        selisih: selisih?.selisih ?? null,
                        diajukan_pada: row.diajukan_pada,
                        checkout_pada: row.checkout_pada,
                    };
                })
        );
        return { data, pagination: list.pagination };
    }
}
