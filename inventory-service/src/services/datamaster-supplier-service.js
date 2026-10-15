import NotfoundException from "../errors/notfound-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import DatamasterSupplierRepository from "../repositories/datamaster-supplier-repository.js";
import DatamasterSupplierValidation from "../validations/datamaster-supplier-validation.js";
import BadRequestException from "../errors/bad-request-exception.js";
import SupplierMapper from "../mappers/supplier-mapper.js";
import WilayahRepository from "../repositories/wilayah-repository.js";
import ExcellHelper from "../helpers/excell-helper.js";

export default class DatamasterSupplierService {
    static async create(payload) {
        const validatedData = await DatamasterSupplierValidation.CREATE_SUPPLIER.parseAsync(payload);
        const isExist = await DatamasterSupplierRepository.getCode(
            validatedData.code,
            validatedData.faskes_uuid
        );
        if (isExist) {
            throw new BadRequestException([{ field: "code", message: "Kode sudah digunakan" }]);
        }
        const transaction = await sequelizeInstance.transaction();
        try {
            const createdSupplier = await DatamasterSupplierRepository.create(validatedData, transaction);
            const itemsToCreate = SupplierMapper.prepareSupplierItemsForDb(
                validatedData.supllier_items, 
                createdSupplier.uuid,
                validatedData.faskes_uuid
            );
            if (itemsToCreate.length > 0) await DatamasterSupplierRepository.bulkCreateSupplierItem(itemsToCreate, transaction); 
            await transaction.commit();
            const finalSupplierData = await DatamasterSupplierRepository.getByUuid({
                 uuid: createdSupplier.uuid, 
                 faskes_uuid: validatedData.faskes_uuid 
            });
            return SupplierMapper.toDetailDTO(finalSupplierData);

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async getByUuid(payload) {
        const validatedPayload = await DatamasterSupplierValidation.GET_SUPLLIER_BY_UUID.parseAsync(payload);
        const result = await DatamasterSupplierRepository.getByUuid(validatedPayload);
        if (!result) throw new NotfoundException("Data supplier tidak ditemukan");
        return SupplierMapper.toDetailDTO(result);
    }

    static async getAll(options) {
        const validatedOptions = await DatamasterSupplierValidation.GET_ALL_SUPPLIER.parseAsync(options);
        const result = await DatamasterSupplierRepository.getAll(validatedOptions);
        result.data = result.data.map(SupplierMapper.toListDTO);
        return result;
    }

    static async getAllWithoutPagination(options) {
        const validatedOptions = await DatamasterSupplierValidation.GET_ALL_SUPPLIER_WITHOUT_PAGINATION.parseAsync(options);
        return await DatamasterSupplierRepository.getAllWithoutPagination(validatedOptions);
    }

    static async update(req) {
        const validatedData = await DatamasterSupplierValidation.UPDATE_SUPPLIER.parseAsync(req);

        if (validatedData.code) {
            const isExist = await DatamasterSupplierRepository.getCode(
                validatedData.code,
                validatedData.faskes_uuid,
                validatedData.uuid,
            );
            if (isExist) throw new BadRequestException([{ field: "code", message: "Kode ini sudah terdaftar" }]);
        }

        const transaction = await sequelizeInstance.transaction();
        try {
            await DatamasterSupplierRepository.update(validatedData, transaction);
            if (validatedData.supllier_items) {
                await DatamasterSupplierRepository.deleteAllSupplierItem(validatedData.uuid, transaction);
                if (validatedData.supllier_items.length > 0) {
                    const newItems = validatedData.supllier_items.map((item) => ({
                        ...item,
                        supllier_uuid: validatedData.uuid,
                        faskes_uuid: validatedData.faskes_uuid
                    }));
                    await DatamasterSupplierRepository.bulkCreateSupplierItem(newItems, transaction);
                }
            }
            await transaction.commit();
            return await DatamasterSupplierRepository.getByUuid({
                uuid: validatedData.uuid,
                faskes_uuid: validatedData.faskes_uuid,
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async delete(payload) {
        const validatedData = await DatamasterSupplierValidation.DELETE_SUPPLIER.parseAsync(payload);
        return await DatamasterSupplierRepository.delete(validatedData);
    }

    static async importSuppliers(serviceInput) {
        const { fileBuffer, faskes_uuid } = serviceInput;

        // 1. Baca File & Normalisasi
        const sheet = ExcellHelper.readFirstSheet(fileBuffer);
        const rawRows = ExcellHelper.sheetToJson(sheet);

        const sanitizeKey = (key) => typeof key === "string" ? key.replace(/\*/g, "").trim() : key;
        const dataRows = rawRows.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => newRow[sanitizeKey(key)] = row[key]);
            return newRow;
        });

        if (dataRows.length === 0) throw new BadRequestException("File kosong, tidak ada data supplier untuk diimpor.");

        // 2. Validasi Header
        const headers = Object.keys(dataRows[0]);
        const expectedHeaders = [
            "Kode_supplier", "Nama_supplier", "Provinsi", "Kabupaten", 
            "Kecamatan", "Alamat", "No_tlp", "Kategori_item", "Kelurahan"
        ];
        const missingHeaders = expectedHeaders.filter(eh => !headers.includes(eh));
        if (missingHeaders.length > 0) {
            throw new BadRequestException({
                message: "Format file tidak valid",
                errors: missingHeaders.map(col => ({
                    message: `${col} wajib diisi`
                }))
            });
        }


        // --- VALIDASI TAHAP A: DUPLIKASI KODE (Case Insensitive) ---
        const fileCodesMap = new Map(); 
        const duplicateCodesInFile = new Set();
        const validRowsStructure = []; 

        // Iterasi pertama: Cek format baris & Duplikat Internal File
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rawCode = row["Kode_supplier"];
            const rawName = row["Nama_supplier"];
            const rawNoTlp = row["No_tlp"];

            const codeString = rawCode ? String(rawCode).trim() : ""; 
            const nameString = rawName ? String(rawName).trim() : "";

            if (codeString) {
                const lowerCode = codeString.toLowerCase();
                if (fileCodesMap.has(lowerCode)) {
                    duplicateCodesInFile.add(codeString);
                    duplicateCodesInFile.add(fileCodesMap.get(lowerCode)); 
                } else {
                    fileCodesMap.set(lowerCode, codeString);
                }
            }

            const supplierData = {
                "Kode_supplier": codeString, 
                "Nama_supplier": nameString, 
                "Provinsi": row["Provinsi"],
                "Kabupaten": row["Kabupaten"],
                "Kecamatan": row["Kecamatan"],
                "Kelurahan": row["Kelurahan"],
                "Alamat": row["Alamat"],
                "No_tlp": (rawNoTlp === null || rawNoTlp === undefined) ? null : String(rawNoTlp),
                "Kategori_item": row["Kategori_item"],
            };

            const validationResult = DatamasterSupplierValidation.IMPORT_SUPPLIER_ROW.safeParse(supplierData);

            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(e => {
                    return `${e.path.join(".")} ${e.message}`; 
                });
                
                throw new BadRequestException({
                    message: "Validasi Gagal",
                    errors: [{ message: `Import gagal pada baris ${i+2}: ${errors.join(", ")}` }]
                });
            }

            validRowsStructure.push(validationResult.data);
        }

        // TAMPILKAN ERROR DUPLIKAT DI FILE
        if (duplicateCodesInFile.size > 0) {
            const duplicatesArray = Array.from(duplicateCodesInFile);
            throw new BadRequestException({
                message: "Validasi Gagal",
                errors: [{ message: `Kode supplier duplikat di dalam file: ${duplicatesArray.join(", ")}` }]
            });
        }

        // --- VALIDASI TAHAP B: DUPLIKASI DATABASE ---
        const uniqueCodes = Array.from(fileCodesMap.values());
        const supplierInDb = await DatamasterSupplierRepository.findCodesInFaskes(uniqueCodes, faskes_uuid);
        
        if (supplierInDb.length > 0) {
            const existingCodes = supplierInDb.map(s => s.code);
            throw new BadRequestException(
                `Import gagal. Terdapat kode supplier yang sudah terdaftar di sistem: ${existingCodes.join(", ")}. Harap gunakan kode lain.`
            );
        }

        // --- VALIDASI TAHAP C: WILAYAH (Lookups & Mismatch) ---
        const provinsiNames = [...new Set(validRowsStructure.map(s => s["Provinsi"]))];
        const kabupatenNames = [...new Set(validRowsStructure.map(s => s["Kabupaten"]))];
        const kecamatanNames = [...new Set(validRowsStructure.map(s => s["Kecamatan"]))];
        const kelurahanNames = [...new Set(validRowsStructure.map(s => s["Kelurahan"]))];

        const [provinsiMap, kabupatenMap, kecamatanMap, kelurahanMap] = await Promise.all([
            WilayahRepository.findProvinsiByNames(provinsiNames),
            WilayahRepository.findKabupatenByNames(kabupatenNames),
            WilayahRepository.findKecamatanByNames(kecamatanNames),
            WilayahRepository.findKelurahanByNames(kelurahanNames)
        ]);

        const mismatchErrors = [];
        const finalSuppliersToSave = [];

        for (const data of validRowsStructure) {
            const provinsiName = data["Provinsi"];
            const kabupatenName = data["Kabupaten"];
            const kecamatanName = data["Kecamatan"];
            const kelurahanName = data["Kelurahan"];

            const provinsiCode = provinsiMap.get(provinsiName.toLowerCase());
            const kabupatenCode = kabupatenMap.get(kabupatenName.toLowerCase());
            const kecamatanCode = kecamatanMap.get(kecamatanName.toLowerCase());
            const kelurahanCode = kelurahanMap.get(kelurahanName.toLowerCase());

            // Validasi Ketersediaan Data Wilayah
            if (!provinsiCode) {
                mismatchErrors.push(`Provinsi '${provinsiName}' tidak ditemukan atau tidak valid.`);
            } else if (!kabupatenCode) {
                mismatchErrors.push(`Kabupaten '${kabupatenName}' tidak sesuai dengan Provinsi '${provinsiName}' (atau data tidak ditemukan).`);
            } else if (!kecamatanCode) {
                 mismatchErrors.push(`Kecamatan '${kecamatanName}' tidak valid.`);
            } else if (!kelurahanCode) {
                 mismatchErrors.push(`Kelurahan '${kelurahanName}' tidak valid.`);
            } else {
                finalSuppliersToSave.push({
                    ...data,
                    provinsi_code_lookup: provinsiCode,
                    kabupaten_code_lookup: kabupatenCode,
                    kecamatan_code_lookup: kecamatanCode,
                    kelurahan_code_lookup: kelurahanCode
                });
            }
        }

        // Tampilan Error Wilayah
        if (mismatchErrors.length > 0) {
            const uniqueErrors = [...new Set(mismatchErrors)];
            const formattedList = uniqueErrors.map(e => `• ${e}`);

            throw new BadRequestException({
                message: "Import gagal. Terdapat ketidaksesuaian data pada beberapa entri.",
                detail: formattedList,
                note: "Seluruh proses import dibatalkan. Harap periksa kembali data pada file."
            });
        }

        const transaction = await sequelizeInstance.transaction();
        try {
            const suppliersToCreate = finalSuppliersToSave.map(data => ({
                faskes_uuid: faskes_uuid,
                code: data["Kode_supplier"],
                name: data["Nama_supplier"],
                alamat: data["Alamat"],
                no_tlp: data["No_tlp"],
                status: true,
                provinsi_code: data.provinsi_code_lookup,
                kabupaten_code: data.kabupaten_code_lookup,
                kecamatan_code: data.kecamatan_code_lookup,
                kelurahan_code: data.kelurahan_code_lookup,
            }));

            const createdSuppliers = await DatamasterSupplierRepository.bulkCreate(suppliersToCreate, transaction);
            
            const allSupplierItemsToCreate = [];
            const createdSupplierMap = new Map(createdSuppliers.map(s => [s.code, s.uuid]));

            for (const originalData of finalSuppliersToSave) {
                const supplierUuid = createdSupplierMap.get(originalData["Kode_supplier"]);
                const kategoriItemString = originalData["Kategori_item"];

                if (supplierUuid && kategoriItemString) {
                    const categories = kategoriItemString.split(",").map(c => c.trim()).filter(Boolean);
                    categories.forEach(kategori => {
                        allSupplierItemsToCreate.push({
                            supllier_uuid: supplierUuid,
                            faskes_uuid: faskes_uuid,
                            kategori_item: kategori.toLowerCase()
                        });
                    });
                }
            }

            if (allSupplierItemsToCreate.length > 0) {
                await DatamasterSupplierRepository.bulkCreateSupplierItem(allSupplierItemsToCreate, transaction);
            }

            await transaction.commit();

            return {
                summary: {
                    total_rows_processed: dataRows.length,
                    success_count: finalSuppliersToSave.length,
                    error_count: 0
                }
            };

        } catch (error) {
            await transaction.rollback();
            throw error; 
        }
    }
}
