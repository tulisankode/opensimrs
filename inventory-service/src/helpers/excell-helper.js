import * as XLSX from "xlsx";
import BadRequestException from "../errors/bad-request-exception.js";

export default class ExcellHelper {
    
    // 1. Membaca Sheet Pertama
    static readFirstSheet(fileBuffer) {
        try {
            const wb = XLSX.read(fileBuffer, { type: "buffer" });
            const sheetName = wb.SheetNames[0];
            if (!sheetName) throw new Error("Workbook tidak memiliki sheet.");
            const sheet = wb.Sheets[sheetName];
            if (!sheet) throw new Error(`Sheet '${sheetName}' kosong.`);
            return sheet;
        } catch (e) {
            throw new BadRequestException(`Gagal membaca file Excel: ${e.message}`);
        }
    }

    // 2. Helper Konversi Tanggal
    static parseDateToUnix(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return Math.floor(dateStr.getTime() / 1000);
        if (typeof dateStr !== "string") return null;
        
        const parts = dateStr.trim().split("-");
        if (parts.length === 3) {
            const dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return Math.floor(dateObj.getTime() / 1000);
        }
        return null;
    }

    // 3. Ambil Value Cell
    static getCellValue(sheet, cellAddress) {
        return sheet[cellAddress] ? sheet[cellAddress].v : null;
    }

    // 4. Convert ke JSON
    static sheetToJson(sheet, range = 0) {
        const data = XLSX.utils.sheet_to_json(sheet, {
            raw: true,
            defval: null,
            range: range
        });
        if (!data || data.length === 0) {
            throw new BadRequestException("File kosong, tidak ada data untuk diimpor.");
        }
        return data;
    }
}