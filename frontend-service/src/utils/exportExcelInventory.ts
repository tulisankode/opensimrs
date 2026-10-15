import * as XLSX from "xlsx-js-style";
import { epochToDate, formatStringDate } from "@/utils/Helpers";

// Fungsi export datamaster
export const exportSupplierToExcel = (rows: any[]) => {
    if (!rows || rows.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const title = ["DATAMASTER SUPPLIER"];
    const data = [];

    data.push({});
    data.push({});

    // Header tabel
    data.push({
        A: "No",
        B: "Kode Supplier",
        C: "Nama Supplier",
        D: "Provinsi",
        E: "Kabupaten",
        F: "Kecamatan",
        G: "Kelurahan",
        H: "Alamat",
        I: "No. Telepon",
        J: "Kategori Item",
        K: "Status"
    });
    // Isi data baris
    rows.forEach((row, index) => {
        data.push({
            A: index + 1,
            B: row.code,
            C: row.name,
            D: row.provinsi || '-',
            E: row.kabupaten || '-',
            F: row.kecamatan || '-',
            G: row.kelurahan || '-',
            H: row.alamat || '-',
            I: row.noTlp || '-',
            J: row.kategoriItem && Array.isArray(row.kategoriItem) ? row.kategoriItem.join(", ") : '-',
            K: row.status ? "AKTIF" : "NON-AKTIF",
        });
    });

    // Workbook dan Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // judul dan merge cell
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];

    // Style untuk judul
    worksheet["A1"].s = {
        alignment: { horizontal: "center", vertical: "center" },
        font: { bold: true, sz: 14 },
        fill: { fgColor: { rgb: "D9D9D9" } },
    };
    // lebar kolom 
    worksheet["!cols"] = [
        { wch: 5 },   // A: No
        { wch: 15 },  // B: Kode Supplier
        { wch: 35 },  // C: Nama Supplier
        { wch: 20 },  // D: Provinsi
        { wch: 20 },  // E: Kabupaten
        { wch: 20 },  // F: Kecamatan
        { wch: 20 },  // G: Kelurahan
        { wch: 40 },  // H: Alamat
        { wch: 20 },  // I: No. Telepon
        { wch: 25 },  // J: Kategori Item
        { wch: 15 },  // K: Status
    ];

    // range tabel 
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:K1");
    for (let R = 2; R <= range.e.r; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cell_address]) continue;

            // Style untuk header tabel (baris ke-3)
            if (R === 2) {
                worksheet[cell_address].s = {
                    font: { bold: true, sz: 11 },
                    fill: { fgColor: { rgb: "9fe2db" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin" }, bottom: { style: "thin" },
                        left: { style: "thin" }, right: { style: "thin" },
                    },
                };
            } else { // Style untuk data
                worksheet[cell_address].s = {
                    border: {
                        top: { style: "thin" }, bottom: { style: "thin" },
                        left: { style: "thin" }, right: { style: "thin" },
                    },
                };
            }
        }
    }
    //Buat dan Unduh File Excel
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Supplier");
    XLSX.writeFile(workbook, `Datamaster Supplier.xlsx`);
};

// Excel Laporan Obat expired --
export const exportReportDrugToExcel = (rows: any[], clinicProfile: any,periode: string, fileName: string = "Laporan Obat Expired") => {
    if (!rows || rows.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const data: any[] = []; 

    // 2. HEADER BARU (Urutan: Judul, Nama, Alamat)
    data.push({ A: "LAPORAN OBAT EXPIRED" }); // Baris 1: Judul Laporan
    data.push({ A: clinicProfile.name || "Nama Klinik Tidak Ditemukan" }); // Baris 2: Nama Klinik
    data.push({ A: clinicProfile.address?.fullAddress || "Alamat Klinik Tidak Ditemukan" }); // Baris 3: Alamat
    data.push({ A: `Periode : ${periode}` });
    data.push({}); // Baris 4: Spasi

    // Baris 5: Header tabel (A-O)
    data.push({
        A: "No",
        B: "Lokasi",
        C: "Kode Item",
        D: "Nama Item",
        E: "Jenis Item",
        F: "Jenis Stok",
        G: "Stok Akhir",
        H: "Satuan",
        I: "Supplier",
        J: "Tanggal Penerimaan",
        K: "No. Pembelian",
        L: "No. Faktur",
        M: "Tanggal Expired",
        N: "Harga Satuan",
        O: "Total Harga"
    });

    // Baris 6: Mulai isi data
    rows.forEach((row, index) => {
        data.push({
            A: index + 1,
            B: row.lokasi,
            C: row.kodeItem,
            D: row.namaItem,
            E: row.jenisItem,
            F: row.jenisStok,
            G: Number(row.stokAkhir) || 0,
            H: row.satuan,
            I: row.supplier,
            J: epochToDate(Number(row.tglPenerimaan), "date"),
            K: row.noPembelian,
            L: row.noFaktur,
            M: formatStringDate(row.tglExpired, "date"),
            N: Number(row.hargaSatuan) || 0,
            O: Number(row.totalHarga) || 0
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });
    const workbook = XLSX.utils.book_new();

    // 3. TAMBAHKAN MERGE (Gabungkan sel A-O untuk header)
    worksheet["!merges"] = [
        // Gabungkan A1 sampai O1 (Kolom 0 sampai 14)
        { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }, 
        // Gabungkan A2 sampai O2
        { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
        // Gabungkan A3 sampai O3
        { s: { r: 2, c: 0 }, e: { r: 2, c: 14 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 14 } }
    ];

    // 4. STYLE HEADER BARU (Judul, Nama, Alamat) - DENGAN ALIGNMENT CENTER
    if (worksheet["A1"]) { // Judul Laporan
        worksheet["A1"].s = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: "center" },
        };
    }
    if (worksheet["A2"]) { // Nama Klinik
        worksheet["A2"].s = {
            font: { bold: true, sz: 12 },
            alignment: { horizontal: "center" },
        };
    }
     if (worksheet["A3"]) { // Alamat
        worksheet["A3"].s = {
            font: { sz: 10 },
            alignment: { horizontal: "center" },
        };
    }
    if (worksheet["A4"]) { // Style Periode
        worksheet["A4"].s = {
            font: { sz: 10, italic: true },
            alignment: { horizontal: "center" },
        };
    }

    // Lebar kolom (A-O) - Tidak berubah
    worksheet["!cols"] = [
        { wch: 5 },  { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, 
        { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 20 }, 
        { wch: 15}, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ];

    // 5. PENYESUAIAN INDEKS BARIS STYLING
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:O1");
    const headerRowIndex = 5; // Header Tabel sekarang di Baris 5 (index 4)
    const dataRowStartIndex = 6; // Data sekarang mulai di Baris 6 (index 5)
    
    // Style Header Tabel (Mulai dari index 4)
    for (let C = 0; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: headerRowIndex, c: C }); // <-- Pakai index baru
        if (!worksheet[cell_address]) continue;

        worksheet[cell_address].s = {
            font: { sz: 11 },
            fill: { fgColor: { rgb: "CCCCCC" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" },
            },
        };
    }

    // Style Data (Mulai dari index 5)
    for (let R = dataRowStartIndex; R <= range.e.r; ++R) { // <-- Pakai index baru
        for (let C = 0; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cell_address]) continue;

            worksheet[cell_address].s = {
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" },
                },
                alignment: { vertical: "center", horizontal: "left" }
            };

            // (Pusatkan kolom tertentu)
            if ([0, 2, 4, 5, 6, 7, 9, 10, 11, 12].includes(C)) {
                worksheet[cell_address].s.alignment.horizontal = "center";
            }

            // (Format Angka & Rupiah)
            if ([6, 13, 14].includes(C)) {
                worksheet[cell_address].t = 'n';
                if (C === 13 || C === 14) { 
                    worksheet[cell_address].s.numFmt = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"??_);_(@_)';
                    worksheet[cell_address].s.alignment.horizontal = "right";
                }
            }
        }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Obat Expired");
    XLSX.writeFile(workbook, `${fileName}.xlsx`); // <-- Gunakan fileName dinamis
};

// Excel Laporan Persediaan 
export const exportReportInventoryToExcel = (rows: any[], clinicProfile: any, periode: string,fileName: string = "Laporan Persediaan") => {
    if (!rows || rows.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const data: any[] = [];
    let grandTotal = 0;

    data.push({ A: "LAPORAN PERSEDIAAN" }); // Baris 1: Judul Laporan
    data.push({ A: clinicProfile.name || "Nama Klinik Tidak Ditemukan" }); // Baris 2: Nama Klinik
    data.push({ A: clinicProfile.address?.fullAddress  || "Alamat Klinik Tidak Ditemukan" }); // Baris 3: Alamat
    data.push({ A: `Periode : ${periode}` });
    data.push({}); // Baris 4: Spasi 

    // Column header (Sekarang di Baris 5)
    data.push({
        A: "No",
        B: "Lokasi",
        C: "Kode Item",
        D: "Nama Item",
        E: "Kategori Item",
        F: "Jenis Item",
        G: "Jenis Stok",
        H: "Stok Akhir",
        I: "Satuan",
        J: "HNA",
        K: "HPP",
        L: "Nilai Persediaan"
    });

    // Isi data baris (Mulai Baris 6)
    rows.forEach((row, index) => {
        const totalHarga = Number(row.totalHarga) || 0;
        data.push({
            A: index + 1,
            B: row.lokasi || '-',
            C: row.kodeItem || '-',
            D: row.namaItem || '-',
            E: row.kategoriItem || '-',
            F: row.jenisItem || '-',
            G: row.jenisStok || '-',
            H: Number(row.stokAkhir) || 0,
            I: row.satuan || '-',
            J: Number(row.hna) || 0,
            K: Number(row.hja) || 0, 
            L: totalHarga
        });
        grandTotal += totalHarga; // Kalkulasi Grand Total
    });

    // Baris Spacer setelah data
    data.push({});
    // Baris Grand Total
    data.push({
        K: "GRAND TOTAL:", // Label di kolom K
        L: grandTotal // Nilai di kolom L
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });
    const workbook = XLSX.utils.book_new();

    // 4. MERGE 
    worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, 
        { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } }
    ];

    // 5. STYLE HEADER (Judul, Nama, Alamat) - ALIGNMENT CENTER
    if (worksheet["A1"]) { // Judul Laporan
        worksheet["A1"].s = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: "center" },
        };
    }
    if (worksheet["A2"]) { // Nama Klinik
        worksheet["A2"].s = {
            font: { bold: true, sz: 12 },
            alignment: { horizontal: "center" },
        };
    }
     if (worksheet["A3"]) { // Alamat
        worksheet["A3"].s = {
            font: { sz: 10 },
            alignment: { horizontal: "center" },
        };
    }
    if (worksheet["A4"]) { // Style Periode
        worksheet["A4"].s = {
            font: { sz: 10, italic: true },
            alignment: { horizontal: "center" },
        };
    }

    // Lebar kolom (A-L) 
    worksheet["!cols"] = [
        { wch: 5 },  { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, 
        { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, 
        { wch: 15 }, { wch: 18 },
    ];

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:L1");
    const headerRowIndex = 5; 
    const dataRowStartIndex = 6; 

    // Style Header Tabel (Mulai dari index 4)
    for (let C = 0; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
        if (!worksheet[cell_address]) continue;
        // (Styling dari kode lama Anda)
        worksheet[cell_address].s = {
            font: { sz: 11 },
            fill: { fgColor: { rgb: "CCCCCC" } },
            alignment: { horizontal: "center", vertical: "center" }, 
            border: {
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" },
            },
        };
    }

    for (let R = dataRowStartIndex; R < data.length - 2; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cell_address]) continue;

            // (Styling dari kode lama Anda)
            worksheet[cell_address].s = {
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" },
                },
                alignment: { vertical: "center", horizontal: "left" } 
            };
            if ([0, 2, 6, 8].includes(C)) {
                worksheet[cell_address].s.alignment.horizontal = "center";
            }
            if (C === 7) {
                worksheet[cell_address].t = 'n';
                worksheet[cell_address].s.alignment.horizontal = "center";
            }
            if ([9, 10, 11].includes(C)) {
                worksheet[cell_address].t = 'n';
                worksheet[cell_address].s.numFmt = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"??_);_(@_)';
                worksheet[cell_address].s.alignment.horizontal = "right";
            }
        }
    }

    // Style Grand Total (Logika dari kode lama Anda)
    const totalRowIndex = data.length - 1;
    const totalLabelCell = XLSX.utils.encode_cell({ r: totalRowIndex, c: 10 }); // Kolom K
    const totalValueCell = XLSX.utils.encode_cell({ r: totalRowIndex, c: 11 }); // Kolom L

    if (worksheet[totalLabelCell]) {
        worksheet[totalLabelCell].s = { font: { bold: true }, alignment: { horizontal: "right" } };
    }
    if (worksheet[totalValueCell]) {
        worksheet[totalValueCell].t = 'n';
        worksheet[totalValueCell].s = {
            font: { bold: true },
            numFmt: '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"??_);_(@_)',
            alignment: { horizontal: "right" }
        };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Persediaan");
    XLSX.writeFile(workbook, `${fileName}.xlsx`); // Menggunakan fileName dinamis
};

// Excel Kartu Stok
export const exportKartuStok = (rows: any[], clinicProfile: any, fileName: string = "Kartu Stok") => {
    if (!rows || rows.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    //  FORMAT TANGGAL CETAK (DD Bulan YYYY)
    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const now = new Date();
    const tanggalCetak = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    const data: any[] = []; 

    //  HEADER LAPORAN
    data.push({ A: "LAPORAN KARTU STOK " }); // Baris 1: Judul
    data.push({ A: clinicProfile.name || "Nama Klinik Tidak Ditemukan" }); // Baris 2: Nama Klinik
    data.push({ A: clinicProfile.address?.fullAddress || "Alamat Klinik Tidak Ditemukan" }); // Baris 3: Alamat
    data.push({ A: `Tanggal Cetak : ${tanggalCetak}` }); // Baris 4: Tanggal Cetak 
    data.push({}); // Baris 5: Spasi

    // Baris 6: Header tabel (A-G) 
    data.push({
        A: "Kode item",
        B: "Nama item",
        C: "Jenis item",
        D: "Kategori",
        E: "Lokasi",
        F: "Sisa Stok",
        G: "Satuan",
    });

    // Baris 7: Mulai isi data -> 
    rows.forEach((row) => {
        data.push({
            A: row.kodeItem || "-",
            B: row.nama || "-",
            C: row.jenisItem || "-",
            D: row.kategoriItem || row.kategori || "-",
            E: row.lokasiStok?.name || row.lokasiStok || "-", 
            F: Number(row.sisaStok) || 0, 
            G: row.satuanObat || row.satuanTerkecil?.name || row.satuan || "-",
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });
    const workbook = XLSX.utils.book_new();

    //  MERGE CELLS (A-G)
    worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Judul
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // Nama Klinik
        { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }, // Alamat
        { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }  // Tanggal Cetak 
    ];

    // STYLE HEADER TEKS
    // A1: Judul
    if (worksheet["A1"]) { 
        worksheet["A1"].s = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: "center" }, 
        };
    }
    // A2: Nama Klinik
    if (worksheet["A2"]) { 
        worksheet["A2"].s = {
            font: { bold: true, sz: 12 }, 
            alignment: { horizontal: "center" }, 
        };
    }
    // A3: Alamat
    if (worksheet["A3"]) { 
        worksheet["A3"].s = {
            font: { sz: 10 },
            alignment: { horizontal: "center" }, 
        };
    }
    // A4: Tanggal Cetak (BARU - Style italic biar rapi)
    if (worksheet["A4"]) { 
        worksheet["A4"].s = {
            font: { sz: 10, italic: true },
            alignment: { horizontal: "center" }, 
        };
    }

    // Lebar kolom 
    worksheet["!cols"] = [
        { wch: 15 }, // A: Kode item
        { wch: 40 }, // B: Nama item
        { wch: 15 }, // C: Jenis item
        { wch: 15 }, // D: Kategori
        { wch: 20 }, // E: Lokasi
        { wch: 10 }, // F: Sisa Stok
        { wch: 10 }, // G: Satuan
    ];

    // INDEKS BARIS UNTUK TABEL 
    const headerRowIndex = 5; // Sebelumnya 4
    const dataRowStartIndex = 6; // Sebelumnya 5
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:G1");
    
    // Style Header Tabel
    for (let C = 0; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: headerRowIndex, c: C }); 
        if (!worksheet[cell_address]) continue;

        worksheet[cell_address].s = {
            font: { sz: 11 },
            fill: { fgColor: { rgb: "CCCCCC" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" },
            },
        };
    }

    // Style Data Tabel
    for (let R = dataRowStartIndex; R <= range.e.r; ++R) { 
        for (let C = 0; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cell_address]) continue;

            worksheet[cell_address].s = {
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" },
                },
                alignment: { vertical: "center", horizontal: "left" }
            };

            // Center alignment untuk kolom tertentu
            if ([0, 2, 3, 5, 6].includes(C)) {
                worksheet[cell_address].s.alignment.horizontal = "center";
            }

            // Format number untuk Sisa Stok
            if (C === 5) {
                worksheet[cell_address].t = 'n';
            }
        }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Kartu Stok");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};


// Export Stok opname
export const exportStokOpnameToExcel = (rows: any[], clinicProfile: any, fileName: string = "Lembar Kerja SO") => {
    if (!rows || rows.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const data: any[] = [];
    
    // 1. ISI DATA HEADER
    data.push({ A: clinicProfile.name || "Nama Instansi Tidak Ditemukan" }); // Row 0
    data.push({ A: "LEMBAR KERJA STOCK OPNAME" }); // Row 1
    data.push({ A: rows[0]?.judulStokOpname || "Judul Stok Opname" }); // Row 2
    data.push({ A: "Tgl Cut Off: " + (rows[0]?.tglCutOff || "-") }); // Row 3
    data.push({ A: "Note: Hanya kolom berwarna hijau yang bisa diisi/diubah" }); // Row 4 
    data.push({}); // Row 5: Spasi

    // Baris 6: Header tabel (A-O) 
    data.push({
        A: "NO.",
        B: "KODE ITEM", // Kuning
        C: "NAMA",
        D: "KATEGORI",
        E: "JENIS ITEM",
        F: "JENIS STOK",
        G: "STOK AWAL",   
        H: "STOK MASUK",  
        I: "STOK KELUAR", 
        J: "STOK SISTEM", 
        K: "STOK FISIK",  
        L: "ED",          
        M: "HARGA DASAR", 
        N: "HARGA AKHIR", 
        O: "ID"           
    });

    // Baris 7: Mulai isi data
    rows.forEach((row, index) => {
        data.push({
            A: index + 1,
            B: row.code || "-",
            C: row.namaItem || "-",
            D: row.kategoriItem || "-",
            E: row.jenisItem || "-",
            F: row.jenisStok || "-",
            G: Number(row.stokAwal) || 0,
            H: Number(row.stokMasuk) || 0,
            I: Number(row.stokKeluar) || 0,
            J: Number(row.stokSistem) || 0,
            K: Number(row.stokFisik) || 0,
            L: row.expDate || "-",
            M: Number(row.hargaDasar) || 0,
            N: Number(row.hargaAkhir) || 0,
            O: row.idStok || "-"
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });
    const workbook = XLSX.utils.book_new();

    // 3. MERGE CELL HEADER (Center All)
    worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }, // A1-O1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } }, // A2-O2
        { s: { r: 2, c: 0 }, e: { r: 2, c: 14 } }, // A3-O3
        { s: { r: 3, c: 0 }, e: { r: 3, c: 14 } }, // A4-O4
        { s: { r: 4, c: 0 }, e: { r: 4, c: 14 } }  // A5-O5
    ];
    
    // 4. STYLE HEADER TEKS (Center)
    const centerStyle = {
        alignment: { horizontal: "center", vertical: "center" }
    };
    
    if (worksheet["A1"]) worksheet["A1"].s = { ...centerStyle, font: { bold: true, sz: 14 } };
    if (worksheet["A2"]) worksheet["A2"].s = { ...centerStyle, font: { bold: true, sz: 16 } };
    if (worksheet["A3"]) worksheet["A3"].s = { ...centerStyle, font: { bold: true, sz: 12 } };
    if (worksheet["A4"]) worksheet["A4"].s = { ...centerStyle, font: { bold: true, sz: 12 } };
    
    if (worksheet["A5"]) worksheet["A5"].s = { 
        ...centerStyle, 
        font: { italic: true, color: { rgb: "000000" }, sz: 11 } 
    };

    // 5. STYLE TABEL
    const headerRowIndex = 6; 
    
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:O1"); // Range mentok di O
    
    // Lebar Kolom 
    worksheet["!cols"] = [
        { wch: 5 },  // A No
        { wch: 15 }, // B Kode
        { wch: 35 }, // C Nama
        { wch: 25 }, // D Kategori
        { wch: 15 }, // E Jenis Item
        { wch: 15 }, // F Jenis Stok
        { wch: 12 }, // G Stok Awal
        { wch: 12 }, // H Stok Masuk
        { wch: 12 }, // I Stok Keluar
        { wch: 12 }, // J Stok Sistem
        { wch: 12 }, // K Stok Fisik
        { wch: 15 }, // L ED
        { wch: 15 }, // M Harga Dasar
        { wch: 15 }, // N Harga Akhir
        { wch: 40 }  // O ID
    ];

    // Definisi Warna
    const colorBasic = { rgb: "CCCCCC" }; 
    const colorYellow = { rgb: "FFFF00" }; 
    const colorGreen = { rgb: "00FF00" }; 
    const colorWhite = { rgb: "FFFFFF" }; 
    const yellowCols = [1, 9, 14]; 
    const greenCols = [10, 11];

    // Loop Styling Tabel (Header & Data)
    for (let R = headerRowIndex; R <= range.e.r; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cell_address]) continue;

            // Default Style
            const style: any = {
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" },
                },
                alignment: { vertical: "center", horizontal: "left" }
            };

            // Tentukan Warna Background
            let bgColor = colorWhite; 

            if (R === headerRowIndex) {
                bgColor = colorBasic; 
                style.font = { bold: true };
                style.alignment.horizontal = "center";
            }

            // Override warna khusus
            if (yellowCols.includes(C)) {
                bgColor = colorYellow;
            } else if (greenCols.includes(C)) {
                bgColor = colorGreen;
            }

            style.fill = { fgColor: bgColor };

            // Format Data Spesifik
            if (R !== headerRowIndex) {
                // Center Alignment
                // Index 6 sekarang adalah Stok Awal , dst.
                if ([0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(C)) {
                    style.alignment.horizontal = "center";
                }
                
                // Format Number (Stok Awal s/d Stok Fisik)
                // Index 6 (G) s/d 10 (K)
                if ([6, 7, 8, 9, 10].includes(C)) {
                    worksheet[cell_address].t = 'n';
                }
                
                // Format Currency (Harga Dasar & Harga Akhir)
                // Index 12 (M) & 13 (N)
                if ([12, 13].includes(C)) {
                    worksheet[cell_address].t = 'n';
                    style.numFmt = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"??_);_(@_)';
                    style.alignment.horizontal = "right";
                }
            }

            worksheet[cell_address].s = style;
        }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Lembar Kerja SO");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};