import * as XLSX from "xlsx-js-style";

interface PendapatanData {
    totalPendapatan: number;
    totalTunai: number;
    totalDebit: number;
    totalKredit: number;
}

interface PembayaranKunjunganData {
    invoiceCode: string;
    billCode: string;
    noRm: string;
    patientName: string;
    paymentDate: number;
    paymentType: string;
    amount: number;
    cashierName: string;
    note: string;
}

interface ClosingCashierData {
    type: string;
    shiftTimeOpen: number;
    shiftTimeClosed: number;
    shiftType: string;
    shiftList: string;
    daysTimeClosed: number;
    cashierName: string;
    petugasList: string;
}

const formatDateToYyyyMmDd = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};



//export Laporan Pendapatan
export const downloadExportExcelPendapatan = async (
    reportData: PendapatanData,
    startDate: Date,
    endDate: Date
) => {
    try {
        const title = ["LAPORAN PENDAPATAN"];

        const formatDateToYyyyMmDd = (date: Date): string => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const formattedStartDate = formatDateToYyyyMmDd(startDate);
        const formattedEndDate = formatDateToYyyyMmDd(endDate);
        const tanggalExport = [`Tanggal: ${formattedStartDate} s/d ${formattedEndDate}`];

        const dataForSheet = [];

        const headers = {
            no: "No.",
            total_pendapatan: "Total Pendapatan",
            total_tunai: "Total Tunai",
            total_debit: "Total Debit",
            total_kredit: "Total Kredit (Asuransi/Piutang)",
        };
        dataForSheet.push(headers);

        const dataRow = {
            no: 1,
            total_pendapatan: reportData.totalPendapatan,
            total_tunai: reportData.totalTunai,
            total_debit: reportData.totalDebit,
            total_kredit: reportData.totalKredit,
        };
        dataForSheet.push(dataRow);

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { skipHeader: true });

        XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
        XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });

        XLSX.utils.sheet_add_json(worksheet, dataForSheet, { origin: "A4", skipHeader: true });

        worksheet["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Merge A1 sampai E1
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Merge A2 sampai E2
        ];

        worksheet["A1"].s = {
            alignment: { horizontal: "center", vertical: "center" },
            font: { bold: true, sz: 14 },
        };
        worksheet["A2"].s = {
            alignment: { horizontal: "center", vertical: "center" },
            font: { bold: true, sz: 11 },
        };

        // Style untuk Header Tabel (di baris ke-4)
        const headerCells = ["A4", "B4", "C4", "D4", "E4"];
        headerCells.forEach(cell => {
            worksheet[cell].s = {
                alignment: { horizontal: "center", vertical: "center" },
                font: { bold: true },
                fill: { fgColor: { rgb: "D3D3D3" } }, 
            };
        });

        worksheet["!cols"] = [
            { wch: 5 },   // No
            { wch: 20 },  // Total Pendapatan
            { wch: 20 },  // Total Tunai
            { wch: 20 },  // Total Debit
            { wch: 35 },  // Total Kredit
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Pendapatan");
        XLSX.writeFile(workbook, "Laporan Pendapatan.xlsx");

    } catch (error) {
        console.error("Error saat mengekspor Laporan Pendapatan:", error);
    }
};

//export Laporan Kunjungan
export const downloadExportExcelPembayaranKunjungan = async (
    reportData: PembayaranKunjunganData[],
    startDate: Date,
    endDate: Date,
    shift: string,
    epochToDate: Function
) => {
    try {
        const title = ["LAPORAN PEMBAYARAN KUNJUNGAN"];
        const formattedStartDate = formatDateToYyyyMmDd(startDate);
        const formattedEndDate = formatDateToYyyyMmDd(endDate);
        const tanggalExport = [`Tanggal: ${formattedStartDate} s/d ${formattedEndDate}`];

        let shiftText = "Semua";
        if (shift === "1") shiftText = "Pagi";
        else if (shift === "2") shiftText = "Siang";
        else if (shift === "3") shiftText = "Malam";
        const shiftExport = [`Shift : ${shiftText}`];

        const dataForSheet: any[] = [];
        dataForSheet.push([
            "No.", "No. Invoice", "No. Registrasi", "No.RM", "Nama Pasien",
            "Waktu Bayar", "Cara Bayar", "Total Biaya", "Kasir", "Keterangan"
        ]);

        reportData.forEach((row, index) => {
            dataForSheet.push([
                index + 1,
                row.invoiceCode || "-",
                row.billCode || "-",
                row.noRm || "-",
                row.patientName || "-",
                epochToDate(row.paymentDate, "dateTime") || "-",
                row.paymentType || "-",
                row.amount || 0,
                row.cashierName || "-",
                row.note || "-"
            ]);
        });

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([]); 

        XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
        XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });
        XLSX.utils.sheet_add_aoa(worksheet, [shiftExport], { origin: "A3" });
        XLSX.utils.sheet_add_aoa(worksheet, dataForSheet, { origin: "A5" }); 

        worksheet["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // Merge A1 sampai J1
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // Merge A2 sampai J2
            { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }, // Merge A3 sampai J3
        ];

        ["A1", "A2", "A3"].forEach(cell => {
            worksheet[cell].s = {
                alignment: { horizontal: "center", vertical: "center" },
                font: { bold: true, sz: 12 },
            };
        });
        worksheet["A1"].s.font.sz = 14; 

        const headerRow = ["A5", "B5", "C5", "D5", "E5", "F5", "G5", "H5", "I5", "J5"];
        headerRow.forEach(cell => {
            worksheet[cell].s = {
                font: { bold: true },
                alignment: { horizontal: "center", vertical: "center" },
                fill: { fgColor: { rgb: "D3D3D3" } },
            };
        });

        worksheet["!cols"] = [
            { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Lap Pembayaran Kunjungan");
        XLSX.writeFile(workbook, "Laporan Pembayaran Kunjungan.xlsx");

    } catch (error) {
        console.error("Error saat mengekspor Laporan Pembayaran Kunjungan:", error);
    }
};

//export Laporan Closing Cashier
export const downloadExportExcelClosingCashier = async (
    reportData: ClosingCashierData[],
    startDate: Date,
    endDate: Date,
    epochToDate: Function
) => {
    try {
        const title = ["LAPORAN CLOSING KASIR"];
        const formattedStartDate = formatDateToYyyyMmDd(startDate);
        const formattedEndDate = formatDateToYyyyMmDd(endDate);
        const tanggalExport = [`Tanggal: ${formattedStartDate} s/d ${formattedEndDate}`];

        const shiftTypeMap: { [key: string]: string } = {
            "1": "Pagi", "2": "Siang", "3": "Malam",
        };

        const dataForSheet: any[] = [];
        dataForSheet.push([
            "No.", "Jenis Kasir", "Tgl. Open Kasir", "Tgl. Closing Kasir",
            "Shift", "Tgl. Close Harian", "Petugas"
        ]);

        reportData.forEach((row, index) => {
            const isShiftClosing = row.type === 'SHIFT';
            dataForSheet.push([
                index + 1,
                isShiftClosing ? "Closing kasir" : "Closing harian",
                isShiftClosing ? (row.shiftTimeOpen ? epochToDate(row.shiftTimeOpen, "date") : "-") : "-", 
                isShiftClosing ? (row.shiftTimeClosed ? epochToDate(row.shiftTimeClosed, "date") : "-") : "-",
                isShiftClosing ? shiftTypeMap[row.shiftType] : row.shiftList,
                isShiftClosing ? "-" : (row.daysTimeClosed ? epochToDate(row.daysTimeClosed, "date") : "-"),
                row.cashierName || row.petugasList || "-"
            ]);
        });

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([]); 

        XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
        XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });
        XLSX.utils.sheet_add_aoa(worksheet, [[]], { origin: "A3" }); 

        XLSX.utils.sheet_add_aoa(worksheet, dataForSheet, { origin: "A4" });

        worksheet["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        ];

        ["A1", "A2"].forEach(cell => {
            worksheet[cell].s = {
                alignment: { horizontal: "center", vertical: "center" },
                font: { bold: true, sz: 12 },
            };
        });
        worksheet["A1"].s.font.sz = 14;
4
        const headerRow = ["A4", "B4", "C4", "D4", "E4", "F4", "G4"];
        headerRow.forEach(cell => {
            worksheet[cell].s = {
                font: { bold: true },
                alignment: { horizontal: "center", vertical: "center" },
                fill: { fgColor: { rgb: "D3D3D3" } },
            };
        });

        worksheet["!cols"] = [
            { wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
            { wch: 25 }, { wch: 20 }, { wch: 25 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Lap Closing Kasir");
        XLSX.writeFile(workbook, "Laporan Closing Kasir.xlsx");

    } catch (error) {
        console.error("Error saat mengekspor Laporan Closing Kasir:", error);
    }
};