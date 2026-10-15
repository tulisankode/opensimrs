import ExcellHelper from "../helpers/excell-helper.js";

export default class StokOpnameMapper {
    static toStockCardDTO(result, reqType) {
        if (!result) return [];
        const stockCardMap = new Map();
        for (const item of result) {
            for (const jenisStok of item.jenis_stok) {
                const hasStocks = jenisStok.stocks && jenisStok.stocks.length > 0;
                if (hasStocks) {
                    for (const stock of jenisStok.stocks) {
                        this._aggregateStock(stockCardMap, stock, jenisStok, item, reqType);
                    }
                } else if (reqType !== "master_stok") {
                    this._addEmptyStockEntry(stockCardMap, jenisStok, item);
                }
            }
        }
        return Array.from(stockCardMap.values());
     }

     static _aggregateStock(map, stock, jenisStok, item, reqType) {
        const expDate = stock.exp_date || null;
        const key = this._getCompositeKey(expDate, item, stock, jenisStok);
        const existingStock = map.get(key);
        if (existingStock) {
            existingStock.stok += stock.sisa_stok;
            existingStock.stok_masuk += stock.stok;
            existingStock.stok_keluar += (stock.stok - stock.sisa_stok);
        } else {
            const newEntry = this._createNewStockEntry(stock, jenisStok, item, expDate, reqType);
            map.set(key, newEntry);
        }
     }

     static _getCompositeKey(expDate, item, stock, jenisStok) {
        const kategoriObat = item.kategori_obat?.name;
        const jenisStokName = jenisStok.detail_stok.name;
        return `${expDate}-${item.name}-${stock.harga_satuan}-${kategoriObat}-${item.jenis_item}-${jenisStokName}`;
     }

     static _createNewStockEntry(stock, jenisStok, item, expDate, reqType) {
        const isSisaStokZero = stock.sisa_stok === 0;
        const useZeroValues = (reqType !== "master_stok" && isSisaStokZero);

        return {
            name: item.name,
            exp_date: useZeroValues ? "-" : expDate,
            harga_satuan: useZeroValues ? 0 : stock.harga_satuan,
            stok_masuk: useZeroValues ? 0 : stock.stok,
            stok: stock.sisa_stok,
            stok_keluar: useZeroValues ? 0 : (stock.stok - stock.sisa_stok),
            kategori_obat: item.kategori_obat?.name,
            jenis_item: item.jenis_item,
            jenis_stok: jenisStok.detail_stok.name,
            id: isSisaStokZero ? "-" : stock.uuid, 
            code: item.code,
        };
     }

     static _addEmptyStockEntry(map, jenisStok, item) {
        const key = this._getCompositeKey(null, item, { harga_satuan: 0 }, jenisStok);
        if (!map.has(key)) {
            map.set(key, {
                name: item.name,
                exp_date: "-",
                harga_satuan: 0,
                stok_masuk: 0,
                stok: 0,
                stok_keluar: 0,
                kategori_obat: item.kategori_obat?.name,
                jenis_item: item.jenis_item,
                jenis_stok: jenisStok.detail_stok.name,
                id: "-",
                code: item.code,
            });
        }
     }

     static mapExcelToItems(jsonData) {
        return jsonData.map(row => {
            if (!row["KODE ITEM"]) return null;
            return {
                kode_item: row["KODE ITEM"],
                nama: row["NAMA"],
                kategori: row["KATEGORI"],
                jenis_item: row["JENIS ITEM"],
                jenis_stok: row["JENIS STOK"] || "Gudang", 
                satuan: row["SATUAN"],
                stok_awal: row["STOK AWAL"],
                stok_masuk: row["STOK MASUK"],
                stok_keluar: row["STOK KELUAR"],
                stok_sistem: row["STOK SISTEM"],
                stok_fisik: row["STOK FISIK"],
                ed: ExcellHelper.parseDateToUnix(row["ED"]), 
                harga_dasar: row["HARGA DASAR"],
                harga_akhir: row["HARGA AKHIR"],
                id_stok: row["ID"],
            };
        }).filter(item => item !== null); 
    }
} 