import ZodValidator from "../validations/zod-validator.js";
import StokOpnameValidation from "../validations/stok-opname-validation.js";
import StokOpnameRepository from "../repositories/stok-opname-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import {uuidv7} from "uuidv7";
import Utils from "../helpers/utils.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import StokOpnameItemRepository from "../repositories/stok-opname-item-repository.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import ItemMedisJenisStokRepository from "../repositories/item-medis-jenis-stok-repository.js";
import StokOpnameMapper from "../mappers/stok-opname-mapper.js";
import InternalServerException from "../errors/internal-server-exception.js";
import HargaItemRepository from "../repositories/harga-item-repository.js";
import RiwayatMutasiService from "./riwayat-mutasi-service.js";
import UserRepository from "../repositories/user-repository.js";
import ExcellHelper from "../helpers/excell-helper.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";

export default class StokOpnameService {
    static async getAll(req) {
        ZodValidator.validate(StokOpnameValidation.GET_ALL, req);
        return await StokOpnameRepository.getAll(req);
    }

    static async getDetail(req) {
        const header = await StokOpnameRepository.getDetail(req.stok_opname_uuid);
        if (!header) throw new BadRequestException(`Stok Opname dengan UUID ${req.stok_opname_uuid} tidak ditemukan.`);
        const petugasSo = header.petugas_so;
        const itemsPagination = await StokOpnameItemRepository.getPaginationByStokOpname(req);
        const modifiedData = itemsPagination.data.map(item => { item.petugas_so = petugasSo;  return item; });
        itemsPagination.data = modifiedData;
        return itemsPagination;
    }

    static async getStockCard(req) {
        ZodValidator.validate(StokOpnameValidation.GET_STOCK_CARD, req);
        if (req.jenis_stok_uuids) req.jenis_stok_uuids = req.jenis_stok_uuids.split(",");
        if (req.jenis_items) req.jenis_items = req.jenis_items.split(",");
        const rawItems = await StokOpnameRepository.getStockCard(req);
        const mappedData = StokOpnameMapper.toStockCardDTO(rawItems, req.type);
        const page = parseInt(req.page) || 1;
        const limit = parseInt(req.limit) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedData = mappedData.slice(startIndex, endIndex);
        return {
            data: paginatedData,
            pagination: Utils.paginationHelper(page, limit, mappedData.length)
        };
    }

    // Fungsi untuk membuat atau memperbarui stok opname
    static async create(req, headers) {
        await ZodValidator.validate(StokOpnameValidation.SAVE, req);
        const transaction = await sequelizeInstance.transaction();
        try {
            const [petugasSoData, petugasPengubahData] = await Promise.all([
                UserRepository.findByUuid(req.petugas_so),
                UserRepository.findByUuid(req.petugas_pengubah)
            ]);

            const petugasSoUsername = petugasSoData.username;
            const petugasPengubahUsername = petugasPengubahData.username;

            await this._fillMissingItems(req);
            await this._prepareOpnameHeader(req, petugasSoUsername);

            const filterApi = {};

            if (req.jenis_items && req.jenis_items.length > 0) {
                filterApi.jenis_item = req.jenis_items[0]; 
            } else {
                filterApi.jenis_item = "obat";
            }

            const allMasterItems = await FarmasiExternalRepository.getAllItemMedis(filterApi, headers);

            const itemMedisMap = new Map(allMasterItems.filter(item => item && item.code).map(item => [item.code, item]));

            this._validateItemCodes(req.items, itemMedisMap);

            const itemMedisUuids = [];
            req.items.forEach(item => {
                const medis = itemMedisMap.get(item.kode_item);
                if (medis) itemMedisUuids.push(medis.uuid);
            });

            const stockMap = await this._validateStockIds(req.items);

            const jenisStokNames = req.items.map(item => item.jenis_stok).filter(Boolean);
            const jenisStokData = await ItemMedisJenisStokRepository.getForStokOpname({
                faskes_uuid: req.faskes_uuid,
                item_medis_uuids: itemMedisUuids,
                names: jenisStokNames,
            });

            const jenisStokMap = new Map(
                jenisStokData.map(js => {
                    const jenisStokName = js.detail_stok?.name;
                    if (!js.item_medis_uuid || !jenisStokName) return null;
                    const key = `${js.item_medis_uuid}-${jenisStokName.trim().toLowerCase()}`;
                    return [key, js.uuid];
                }).filter(Boolean)
            );

            const jenisStokUuids = Array.from(jenisStokMap.values());
            const hargaItemMap = await HargaItemRepository.findManyByItemJenisStok(
                jenisStokUuids, 
                req.faskes_uuid
            );
            await this._saveOpnameAndItems(
                req, itemMedisMap, stockMap, jenisStokMap, 
                hargaItemMap, { petugasPengubahUsername, petugasSoUsername } ,transaction 
            );

            if (req.type === "final") {
                await this._processFinalOpnameValidationsAndAdjust(
                    req, itemMedisMap, stockMap, transaction
                );
                await this._createMutationHistory(
                    req, itemMedisMap, jenisStokMap, petugasSoUsername, transaction
                );
            }
            
            await transaction.commit();
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }

    // Mengisi request items dari database jika tidak disediakan dalam request
    static async _fillMissingItems(req) {
        if (req.items && req.items.length > 0) return;
        if (!req.stok_opname_uuid) throw new BadRequestException("items tidak boleh kosong");
        const stokOpnameItems = await StokOpnameItemRepository.getByStokOpname(req.stok_opname_uuid);
        if (stokOpnameItems.length <= 0) throw new BadRequestException("Items tidak boleh kosong");
        req.items = stokOpnameItems.map(item => ({
            kode_item: item.kode_item,
            stok_fisik: item.stok_fisik,
            stok_sistem: item.stok_sistem,
            id_stok: item.id_stok,
            ed: item.ed,
            jenis_stok: item.jenis_stok,
        }));
    }

    // Menyiapkan header stok opname, baik untuk data baru atau data yang sudah ada
    static async _prepareOpnameHeader(req, petugasSoUsername) {
        if (!req.stok_opname_uuid) {
            req.stok_opname_uuid = uuidv7();
            req.no_stok_opname = Utils.generate4Code("SO");
            req.petugas_so = petugasSoUsername;
        } else {
            const stokOpname = await StokOpnameRepository.getDetail(req.stok_opname_uuid);
            if (!stokOpname) throw new BadRequestException(`Stok Opname dengan UUID ${req.stok_opname_uuid} tidak ditemukan.`);
            req.no_stok_opname = stokOpname.no_stok_opname;
            req.petugas_so = stokOpname.petugas_so;
            req.petugas_so = stokOpname.petugas_so;
        }
    }

    static async _processFinalOpnameValidationsAndAdjust(req, itemMedisMap, stockMap, transaction) {
        this._validateItemCodes(req.items, itemMedisMap);
        const itemsToAdjust = req.items
            .filter(item => item.id_stok)
            .map(item => {
                const originalStock = stockMap.get(item.id_stok);
                if (!originalStock) {
                    throw new InternalServerException(`Stok asli ${item.id_stok} tidak ditemukan di Map.`);
                }
                return { ...originalStock,  ...item };
            });
        if (itemsToAdjust.length > 0) {
            await StockMedisRepository.bulkAdjustStock(itemsToAdjust, req.faskes_uuid, transaction);
        }
    }

    static _validateItemCodes(items, itemMedisMap) {
        items.forEach(item => {
            if (!itemMedisMap.has(item.kode_item)) {
                throw new BadRequestException(`Item dengan kode ${item.kode_item} tidak ditemukan di master data Farmasi.`);
            }
        });
    }

    // Memvalidasi bahwa semua ID stok yang disediakan ada di database
    static async _validateStockIds(items) {
        const stockIds = items.filter(item => item.id_stok).map(item => item.id_stok);
        if (stockIds.length === 0) return new Map();

        const stocks = await StockMedisRepository.getSome(stockIds);
        const stockMap = new Map(stocks.map(stock => [stock.uuid, stock.toJSON()]));
        const stockNotFoundError = [];

        stockIds.forEach(stockId => {
            if (!stockMap.has(stockId)) stockNotFoundError.push(stockId);
        });

        if (stockNotFoundError.length > 0) {
            throw new BadRequestException(`Item dengan id stok ${stockNotFoundError.join(", ")} tidak ditemukan`);
        }
        return stockMap;
    }

    // Menyimpan header Stok Opname dan semua item terkait.
    static async _saveOpnameAndItems(req, itemMedisMap, stockMap, jenisStokMap, hargaItemMap, petugas, transaction) {
        await StokOpnameRepository.upsert({
            uuid: req.stok_opname_uuid,
            faskes_uuid: req.faskes_uuid,
            no_stok_opname: req.no_stok_opname,
            status: req.type,
            petugas_so: petugas.petugasSoUsername, 
            petugas_pengubah: petugas.petugasPengubahUsername,
            tanggal_cut_off: req.tanggal_cut_off,
            judul_stok_opname: req.judul_stok_opname,
            jenis_stoks: req.jenis_stoks,
            kategori_item: req.kategori_item,
            jenis_items: req.jenis_items,
            lokasi_stok_uuid: req.lokasi_stok_uuid,
            error_message: null,
        }, transaction);

        await StokOpnameItemRepository.destroyByStokOpname(req.stok_opname_uuid, transaction);

        const itemsToCreate = req.items.map(item => {
            const itemMedis = itemMedisMap.get(item.kode_item);
            const satuanName = itemMedis.satuan_penggunaan?.name;
            const namaItem = itemMedis.name;
            const itemUuid = itemMedis.uuid;
            
            if (!itemMedis) {
                throw new BadRequestException(`Item Medis dengan kode '${item.kode_item}' tidak ditemukan di Data Master Farmasi.`);
            }
            
            if (!namaItem || !itemUuid || !satuanName) {
                throw new InternalServerException(`Data master untuk kode item ${item.kode_item} tidak lengkap (UUID/Nama/Satuan hilang). Cek data master Farmasi.`);
            }

            let fixJenisItem = itemMedis.jenis_item; 
            if (!fixJenisItem && req.jenis_items && req.jenis_items.length > 0) {
                fixJenisItem = req.jenis_items[0]; 
            }
            const originalStock = stockMap.get(item.id_stok);
            const stokSistem = item.stok_sistem ?? originalStock?.sisa_stok ?? 0;
            const stokAwalBatch = originalStock?.stok ?? 0; 
            let stokKeluar = (stokAwalBatch > 0) ? stokAwalBatch - stokSistem : 0;
            if (stokKeluar < 0) {
                stokKeluar = 0;
            }
            const hargaDasar = originalStock?.harga_satuan ?? 0;
            
            const jenisStokKey = `${itemUuid}-${item.jenis_stok.trim().toLowerCase()}`; 
            const jenis_stok_uuid = jenisStokMap.get(jenisStokKey); 
            const hargaData = jenis_stok_uuid ? hargaItemMap.get(jenis_stok_uuid) : null;
            const hargaAkhir = hargaData?.harga_terakhir ?? 0;

            return {
                kode_item: item.kode_item,
                stok_fisik: item.stok_fisik,
                id_stok: item.id_stok,
                ed: item.ed,
                jenis_stok: item.jenis_stok,
                stok_opname_uuid: req.stok_opname_uuid,
                faskes_uuid: req.faskes_uuid,
                nama: itemMedis.name,
                item_uuid: itemMedis.uuid,
                kategori: req.kategori_item,
                jenis_item: fixJenisItem,
                satuan: satuanName,
                stok_sistem: stokSistem,
                stok_awal: stokAwalBatch,
                stok_masuk: stokAwalBatch, 
                stok_keluar: stokKeluar, 
                harga_dasar: hargaDasar,
                harga_akhir: hargaAkhir
            };
        });

        await StokOpnameItemRepository.bulkCreate(itemsToCreate, transaction);
    }

    static async _createMutationHistory(req, itemMedisMap, jenisStokMap, petugasSoUsername, transaction) {
        const mutasiItems = [];
        for (const item of req.items) {
            const itemMedis = itemMedisMap.get(item.kode_item);

            const jenisStokKey = `${itemMedis.uuid}-${item.jenis_stok.trim().toLowerCase()}`;
            const jenis_stok_uuid = jenisStokMap.get(jenisStokKey);

            if (!jenis_stok_uuid) {
                throw new BadRequestException(`Jenis stok ${item.jenis_stok} untuk item ${item.kode_item} tidak ditemukan`);
            }

            const stokSistem = item.stok_sistem ?? 0;
            const stokFisik = item.stok_fisik;
            const selisih = stokFisik - stokSistem;

            if (selisih !== 0) {
                mutasiItems.push({
                    item_uuid: itemMedis.uuid,
                    exp_date: new Date(item.ed),
                    stok_awal: stokSistem,
                    stok_mutasi: selisih,
                    jenis_stok_uuid: jenis_stok_uuid,
                    lokasi_stok_uuid: req.lokasi_stok_uuid,
                    type: selisih < 0 ? "defisit" : "surplus"
                });
            }
        }

        if (mutasiItems.length > 0) {
            await RiwayatMutasiService.create({
                faskes_uuid: req.faskes_uuid,
                sumber_mutasi: "inventory",
                with_check_stock: false,
                petugas: petugasSoUsername,
                code: req.no_stok_opname,
                keterangan: { description: "Stok Opname" },
                items: mutasiItems
            }, { transaction });
        }
    }
    
    static async deleteItems(req) {
        ZodValidator.validate(StokOpnameValidation.DELETE_SOME, req);
        await StokOpnameItemRepository.deleteSome(req.uuids);
    }

    static async importStockCard(req, headers) {
        // 1. Baca File Excel
        const sheet = ExcellHelper.readFirstSheet(req.fileBuffer);
        const rawJson = ExcellHelper.sheetToJson(sheet, 6);

        // 2. Parsing Header Excel
        const headerInfo = this._parseHeaderData(sheet);

        // 3. Mapping Data Mentah Excel Format Item
        const mappedItems = StokOpnameMapper.mapExcelToItems(rawJson);

        // 4. Menyiapkan Context
        this._prepareImportContext(req, headerInfo, mappedItems);

        // 5. Validasi & Ambil Master Data
        const { itemMedisMap, stockMap, jenisStokMap, hargaItemMap } =  await this._fetchAndValidateMasterData(req, headers);
        
        // 6. Menyusun Data Preview 
        const previewItems = req.items.map(item => {
            // A. Ambil Data Master Item Berdasarkan Kode
            const itemMedis = itemMedisMap.get(item.kode_item);

            // B. Ambil Data Stok Asli Sistem
            const originalStock = stockMap.get(item.id_stok);

            // C. Kalkulasi Stok Sistem
            const stokSistem = item.stok_sistem ?? originalStock?.sisa_stok ?? 0;
            const stokFisik = item.stok_fisik;
            const selisih = stokFisik - stokSistem;

            // D. Ambil Harga
            const jenisStokKey = `${itemMedis.uuid}-${item.jenis_stok.trim().toLowerCase()}`;
            const jenis_stok_uuid = jenisStokMap.get(jenisStokKey);
            const hargaData = jenis_stok_uuid ? hargaItemMap.get(jenis_stok_uuid) : null;

            let formattedEd = null;
            if (item.ed) {
                const dateObj = new Date(item.ed * 1000);
                formattedEd = dateObj.toISOString().split("T")[0];
            }

            // E. Return Object Payload
            return {
                kode_item: item.kode_item,
                nama_item: itemMedis.name,
                jenis_item: itemMedis.jenis_item,
                satuan: itemMedis.satuan_penggunaan?.name,
                id_stok: item.id_stok,
                jenis_stok: item.jenis_stok,
                jenis_stok_uuid: jenis_stok_uuid,
                ed: formattedEd,
                stok_sistem: stokSistem,
                stok_fisik: stokFisik,
                selisih: selisih,
                harga_dasar: originalStock?.harga_satuan ?? 0,
                harga_jual: hargaData?.harga_terakhir ?? 0,
            };
        });

        return {
            judul_stok_opname: headerInfo.judul,
            tanggal_cut_off: headerInfo.tanggal_cut_off,
            items: previewItems,
        };
    }

    // Ambil Judul & Tanggal
    static _parseHeaderData(sheet) {
        const rawTgl = ExcellHelper.getCellValue(sheet, "A4") || "";
        const cleanTglString = rawTgl.replace("Tgl Cut Off:", "").trim();
        const tglCutOffSeconds = ExcellHelper.parseDateToUnix(cleanTglString) || Math.floor(Date.now() / 1000);
        
        return {
            judul: `Import SO - ${cleanTglString}`,
            tanggal_cut_off: tglCutOffSeconds
        };
    }

    // Masukkan hasil mapping ke req object
    static _prepareImportContext(req, headerInfo, items) {
        req.items = items;
        req.judul_stok_opname = headerInfo.judul;
        req.type = "draft";
        req.tanggal_cut_off = headerInfo.tanggal_cut_off;
        const unique = (arr, key) => [...new Set(arr.map(i => i[key]).filter(Boolean))];
        req.jenis_stoks = unique(items, "jenis_stok");
        req.jenis_items = unique(items, "jenis_item");
        req.kategori_item = "medis"; 
    }

    // Validasi ke Database (Wajib di Service karena pakai Repository)
    static async _fetchAndValidateMasterData(req, headers) {
        const targetJenis = req.jenis_items?.[0];
        if (!targetJenis) {
            throw new BadRequestException("Kolom 'jenis_item' di file Excel tidak boleh kosong");
        }

        const allItemMedis = await FarmasiExternalRepository.getAllItemMedis({ jenis_item: targetJenis }, headers);

        const excelCodes = req.items.map(item => String(item.kode_item).trim());

        const filteredItemMedises = allItemMedis.filter(item => {
            if (!item.code) return false;
            return excelCodes.includes(String(item.code).trim());
        });
        
        const foundCodes = new Set(filteredItemMedises.map(im => String(im.code).trim()));
        const missing = excelCodes.find(code => !foundCodes.has(code));
        if (missing) {
            throw new BadRequestException(`Item dengan kode '${missing}' tidak ditemukan di database Farmasi (Kategori: ${targetJenis}).`);
        }

        const itemMedisMap = new Map(filteredItemMedises.map(item => [item.code, item]));

        const stockMap = await this._validateStockIds(req.items); 

        const itemMedisUuids = Array.from(itemMedisMap.values()).map(item => item.uuid);
        const jenisStokData = await ItemMedisJenisStokRepository.getForStokOpname({
            faskes_uuid: req.faskes_uuid,
            item_medis_uuids: itemMedisUuids,
            names: req.jenis_stoks,
        });

        const jenisStokMap = new Map(
            jenisStokData.map(js => {
                const name = js.detail_stok?.name;
                if (!js.item_medis_uuid || !name) return null;
                const key = `${js.item_medis_uuid}-${name.trim().toLowerCase()}`;
                return [key, js.uuid];
            }).filter(Boolean)
        );

        const hargaItemMap = await HargaItemRepository.findManyByItemJenisStok(
            Array.from(jenisStokMap.values()), 
            req.faskes_uuid
        );

        return { itemMedisMap, stockMap, jenisStokMap, hargaItemMap };
    }
}