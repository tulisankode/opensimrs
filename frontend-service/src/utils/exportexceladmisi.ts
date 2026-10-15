import * as XLSX from "xlsx-js-style";
import { epochToDate } from "./Helpers";
import axios from "axios";
import { useAdmisiReportStore } from "@/stores/admisi/laporan";

interface RekapRow {
  name: string;
  total: number;
  [date: string]: any;
}

const getPeriodeTeksFromFilter = (filter?: any) => {
  const formatTanggalIndonesia = (timestamp: any) => {
    if (!timestamp) return null;
    const tanggal = new Date(Number(timestamp) * 1000);
    return tanggal.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formattedStartDate = formatTanggalIndonesia(filter?.start_date);
  const formattedEndDate = formatTanggalIndonesia(filter?.end_date);

  if (formattedStartDate && formattedEndDate) {
    if (formattedStartDate === formattedEndDate) {
      return `Tanggal : ${formattedStartDate}`;
    }
    return `Periode : ${formattedStartDate} - ${formattedEndDate}`;
  }

  const today = new Date().toLocaleDateString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
  });
  return `Tanggal Export: ${today}`;
};

// STATUS KAMAR
export const downloadExportExcelStatusKamar = async (filter?: any) => {
  try {
    const admisiReportStore = useAdmisiReportStore();
      const response = await admisiReportStore.ExportStatusKamarReport(filter || {});

      console.log("Full response object from store action:", response);
      const reportData = response.payload;

      if (!reportData || reportData.length === 0) {
        alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
        return;
      }

    const today = new Date();
    const formattedDate = today.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const title = ["LAPORAN STATUS KAMAR"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No",
      roomClass: "Kelas",
      room: "Kamar",
      totalPatients: "Jumlah Pasien",
    });

    for (let i = 0; i < reportData.length; i++) {
      const row = reportData[i];
      const room = row.room ?? {};

      data.push({
        No: i + 1,
        roomClass: room.className ?? "-",
        room: room.name ?? "-",
        totalPatients: row.jumlahPasien ?? "-",
      });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });
    
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ];
    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };
    worksheet["A2"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 11 },
    };

    const headerStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true },
    };
    const headers = ["A4", "B4", "C4", "D4"];
    headers.forEach(header => {
      if (worksheet[header]) {
        worksheet[header].s = headerStyle;
      }
    });

    const columnWidths = data.reduce((widths: any, row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);
    worksheet["!cols"] = columnWidths.map((wch: any) => ({ wch }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Status Kamar");
    XLSX.writeFile(workbook, `Laporan Status Kamar.xlsx`);
  } catch (error) {
    console.error("Error exporting Status Kamar", error);
    alert("Gagal mengekspor data Status Kamar. Silakan cek konsol untuk detail.");
  }
};

// KUNJUNGAN
export const downloadExportExcelKunjungan = async (
  filter?: any
  ) => {
    try {
      const admisiReportStore = useAdmisiReportStore();
      const response = await admisiReportStore.ExportKunjunganReport(filter || {});

      console.log("Full response object from store action:", response);
      const reportData = response.payload;

      if (!reportData || reportData.length === 0) {
        alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
        return;
      }

      const today = new Date();
      const formattedDate = today.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const title = ["LAPORAN KUNJUNGAN"];
      const tanggalExport = [getPeriodeTeksFromFilter(filter)];

      const data: any[] = [];
      data.push({});
      data.push({});
      data.push({});
      data.push({
        No: "No",
        tglRegistrasi: "Tanggal Registrasi",
        jenisKunjungan: "Jenis Kunjungan",
        noreg: "No. Registrasi",
        noRm: "No. RM",
        namaPasien: "Nama Pasien",
        jenisKelamin: "Jenis Kelamin",
        tglLahir: "Tanggal Lahir",
        umur: "Umur",
        alamat: "Alamat",
        jenisId: "Jenis Identitas",
        noIdentitas: "No. Identitas",
        dokter: "Dokter",
        poli: "Poli",
        penjamin: "Penjamin",
        noPenjamin: "No. Penjamin",
      });

      for (let i = 0; i < reportData.length; i++) {
        const row = reportData[i];
        try {
          const patient = row.patient ?? {};
          const insurance = patient.insurance?.[0] ?? {};
          const birthDetail = patient.birthDetail ?? {};
          const address = patient.address ?? {};

          const umur = `${birthDetail.ageYear ?? 0} Tahun ${birthDetail.ageMonth ?? 0} Bulan ${birthDetail.ageDay ?? 0} Hari`;

          data.push({
            No: i + 1,
            tglRegistrasi: epochToDate(row.tglRegistrasi, "dateTime"),
            jenisKunjungan: row.jenisKunjungan ?? "-",
            noreg: row.noreg ?? "-",
            noRm: patient.noRm ?? "-",
            namaPasien: patient.name ?? "-",
            jenisKelamin: patient.gender === "Male" ? "L" : patient.gender === "Female" ? "P" : "-",
            tglLahir: patient.birthDetail.birthDate?.split("T")[0] ?? "-",
            umur: umur,
            alamat: address.fullAddress ?? "-",
            jenisId: patient.identity ?? "-",
            noIdentitas: patient.noIdentity ?? "-",
            dokter: row.practitioner?.pegawai?.nama ?? "-",
            poli: row.lokasi?.name ?? "-",
            penjamin: insurance.name ?? "-",
            noPenjamin: insurance.accountNumber ?? "-",
          });
        } catch (error) {
          console.error(`Gagal memproses baris data ke-${i}:`, row);
          console.error("Pesan Error:", error);
          data.push({ No: i + 1, tglRegistrasi: "DATA ERROR", noreg: row.noreg });
        }
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

      XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
      XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });

      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
      ];

      worksheet["A1"].s = {
        alignment: { horizontal: "center", vertical: "center" },
        font: { bold: true, sz: 14 },
      };
      worksheet["A2"].s = {
        alignment: { horizontal: "center", vertical: "center" },
        font: { bold: true, sz: 11 },
      };

      const headerStyle = {
        alignment: { horizontal: "center", vertical: "center" },
        font: { bold: true },
      };
      const headers = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4", "P4"];
      headers.forEach(header => {
        if (worksheet[header]) {
          worksheet[header].s = headerStyle;
        }
      });

      const columnWidths = data.reduce((widths: any, row: any) => {
        Object.keys(row).forEach((key, colIdx) => {
          const cellValue = row[key] ? row[key].toString() : "";
          widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
        });
        return widths;
      }, []);
      worksheet["!cols"] = columnWidths.map((wch: any) => ({ wch }));

      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Kunjungan");
      XLSX.writeFile(workbook, `Laporan Kunjungan.xlsx`);
    } catch (error) {
      console.error("Error exporting Kunjungan", error);
      alert("Gagal mengekspor data. Silakan cek konsol untuk detail.");
    }
};

// BATAL KUNJUNGAN
export const downloadExportExcelBatalKunjungan = async (
  filter?: any
) => {
  try {
    const admisiReportStore = useAdmisiReportStore();
      const response = await admisiReportStore.ExportBatalKunjunganReport(filter || {});

      console.log("Full response object from store action:", response);
      const reportData = response.payload;

      if (!reportData || reportData.length === 0) {
        alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
        return;
      }

    const today = new Date();
    const formattedDate = today.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const title = ["LAPORAN BATAL KUNJUNGAN"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No",
      tglRegistrasi: "Tanggal Registrasi",
      jenisKunjungan: "Jenis Kunjungan",
      noreg: "No. Registrasi",
      noRm: "No. RM",
      namaPasien: "Nama Pasien",
      poli: "Poliklinik",
      dokter: "Dokter DPJP",
      tglBatal: "Tanggal Batal",
      petugas: "Petugas",
      alasanBatal: "Alasan Batal",
    });

    for (let i = 0; i < reportData.length; i++) {
      const row = reportData[i];
      const patient = row.patient ?? {};
      
      data.push({
        No: i + 1,
        tglRegistrasi: epochToDate(row.tglRegistrasi, "date") ?? "-",
        jenisKunjungan: row.jenisKunjungan ?? "-",
        noreg: row.noreg ?? "-",
        noRm: patient.noRm ?? "-",
        namaPasien: patient.name ?? "-",
        poli: row.lokasi?.name ?? "-",
        dokter: row.practitioner?.pegawai?.nama ?? "-",
        tglBatal: epochToDate(row.cancelDate, "date") ?? "-",
        petugas: row.cancelBy ?? "-",
        alasanBatal: row.cancelReason ?? "-",
      });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    ];

    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };
    worksheet["A2"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 11 },
    };
    
    const headerStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true },
    };
    const headers = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "I4", "J4", "K4"];
    headers.forEach(header => {
      if (worksheet[header]) {
        worksheet[header].s = headerStyle;
      }
    });

    const columnWidths = data.reduce((widths: any, row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);
    worksheet["!cols"] = columnWidths.map((wch: any) => ({ wch }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Batal Kunjungan");
    XLSX.writeFile(workbook, `Laporan Batal Kunjungan.xlsx`);
  } catch (error) {
    console.error("Error exporting Batal Kunjungan", error);
    alert("Gagal mengekspor data Batal Kunjungan. Silakan cek konsol untuk detail.");
  }
};

// KEPERAWATAN INAP PASIEN
export const downloadExportExcelKeperawatanInapPasien = async (
  filter?: any
) => {
  try {
    const admisiReportStore = useAdmisiReportStore();
      const response = await admisiReportStore.ExportKeperawatanInapPasienReport(filter || {});

      console.log("Full response object from store action:", response);
      const reportData = response.payload;

      if (!reportData || reportData.length === 0) {
        alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
        return;
      }

    const today = new Date();
    const formattedDate = today.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const title = ["LAPORAN KEPERAWATAN INAP PASIEN"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No.",
      namaPasien: "Nama Pasien",
      noRm: "No. RM",
      ruangan: "Ruangan",
      kelas: "Kelas",
      noBed: "No. Bed",
      tglMasuk: "Tanggal Masuk",
      tglKeluar: "Tanggal Keluar",
    });

    for (let i = 0; i < reportData.length; i++) {
    const row = reportData[i];
        
    data.push({
      No: i + 1,
      namaPasien: row.patient.name ?? "-",
      noRm: row.noRm ?? "-",
      ruangan: row.monitoringRoom?.room?.name ?? "-",
      kelas: row.monitoringRoom?.room?.className ?? "-",
      noBed: row.monitoringRoom?.noBed ?? "-",
      tglMasuk: row.tanggalDirawat ? epochToDate(row.tanggalDirawat, "date") : "-",
      tglKeluar: row.dischargeDate ? epochToDate(row.dischargeDate, "date") : "-",
    });
  }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });

    // Jumlah kolom sekarang 8 (A-H) karena ada tambahan Nama Pasien
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, 
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    ];

    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };
    worksheet["A2"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 11 },
    };

    const headerStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true },
    };
    const headers = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4"];
    headers.forEach(header => {
      if (worksheet[header]) {
        worksheet[header].s = headerStyle;
      }
    });

    const columnWidths = data.reduce((widths: any[], row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);
    worksheet["!cols"] = columnWidths.map((wch: number) => ({ wch }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Keperawatan Inap");
    XLSX.writeFile(workbook, `Laporan Keperawatan Inap Pasien.xlsx`);
  } catch (error) {
    console.error("Error exporting Keperawatan Inap Pasien", error);
    alert("Gagal mengekspor data Keperawatan Inap Pasien. Silakan cek konsol untuk detail.");
  }
};

// BAYI BARU LAHIR
export const downloadExportExcelBayiBaruLahir = async (
  filter?: any
) => {
   try {
    const admisiReportStore = useAdmisiReportStore();
      const response = await admisiReportStore.ExportBayiBaruLahirReport(filter || {});

      console.log("Full response object from store action:", response);
      const reportData = response.payload;

      if (!reportData || reportData.length === 0) {
        alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
        return;
      }

    const today = new Date();
    const formattedDate = today.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const title = ["LAPORAN BAYI BARU LAHIR"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No.",
      tglRegistrasi: "Tanggal Registrasi",
      noRmBaby: "No. RM",
      nameBaby: "Nama Bayi",
      genderBaby: "Jenis Kelamin",
      birthPlace: "Tempat Lahir",
      birthDate: "Tanggal Lahir",
      birthTimeBaby: "Jam Lahir",
      identitasIbu: "Identitas Ibu",
      namaIbu: "Nama Ibu",
      jenisKunjungan: "Jenis Kunjungan"
    });

    for (let i = 0; i < reportData.length; i++) {
      const row = reportData[i];
      const birthDetail = row.birthDetail ?? {};
      const tglRegistrasiStr = row.tanggalDaftar 
        ? epochToDate(new Date(row.tanggalDaftar).getTime() / 1000, "date") as string
        : "-";
      
      const tglLahirStr = birthDetail.birthDate
        ? epochToDate(new Date(birthDetail.birthDate).getTime() / 1000, "date") as string
        : "-";

      data.push({
        No: i + 1,
        tglRegistrasi: tglRegistrasiStr,
        noRmBaby: row.noRmBaby ?? "-",
        nameBaby: row.nameBaby ?? "-",
        genderBaby: row.genderBaby === "Male" ? "L" : row.genderBaby === "Female" ? "P" : "-",
        birthPlace: birthDetail.birthPlace ?? "-",
        birthDate: tglLahirStr,
        birthTimeBaby: row.birthTimeBaby ?? "-",
        identitasIbu: birthDetail.patient.noIdentity ?? "-",
        namaIbu: row.nameMom ?? "-",
        jenisKunjungan: birthDetail?.patient?.logPelayanan?.jenisKunjungan ?? "-",
      });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    ];

    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };
    worksheet["A2"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 11 },
    };

    const headerStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true },
    };
    const headers = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "I4", "J4", "K4"];
    headers.forEach(header => {
      if (worksheet[header]) {
        worksheet[header].s = headerStyle;
      }
    });
    
    const columnWidths = data.reduce((widths: any[], row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);
    worksheet["!cols"] = columnWidths.map((wch: number) => ({ wch }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Bayi Baru Lahir");
    XLSX.writeFile(workbook, `Laporan Bayi Baru Lahir.xlsx`);
  } catch (error) {
    console.error("Error exporting Bayi Baru Lahir", error);
    alert("Gagal mengekspor data Bayi Baru Lahir. Silakan cek konsol untuk detail.");
  }
};

// REKAP KUNJUNGAN
export const downloadExportExcelRekapKunjungan = async (
  filter: any,
  
  rekapTabelFilter: string[],
  dateRangeColumns: string[],

  rekapData: RekapRow[],
  totalKunjunganPerDay: { [key: string]: number },
  grandTotalKunjungan: number,

  rekapDokterData: RekapRow[],
  totalDokterPerDay: { [key: string]: number },
  grandTotalDokter: number,

  rekapPenjaminData: RekapRow[],
  totalPenjaminPerDay: { [key: string]: number },
  grandTotalPenjamin: number
) => {
  try {
    const title = ["LAPORAN REKAP KUNJUNGAN"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const dynamicHeaders = dateRangeColumns.map(dateStr => {
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
    });
    const tableHeader = ["Data", "Nama", ...dynamicHeaders, "Total"];
    const totalColumns = tableHeader.length;

    const aoaData: (string | number)[][] = [
      title,
      tanggalExport,
      [],
      tableHeader
    ];

    const addSection = (
      category: string,
      data: RekapRow[],
      totalPerDay: { [key: string]: number },
      grandTotal: number
    ) => {
      if (!data || data.length === 0) return;

      data.forEach((item, index) => {
        const rowData: (string | number)[] = [];
        rowData.push(index === 0 ? category : "");
        rowData.push(item.name);
        dateRangeColumns.forEach(dateStr => {
          rowData.push(item[dateStr] || 0);
        });
        rowData.push(item.total);
        aoaData.push(rowData);
      });

      const footerData: (string | number)[] = ["", "Total Harian"];
      dateRangeColumns.forEach(dateStr => {
        footerData.push(totalPerDay[dateStr] || 0);
      });
      footerData.push(grandTotal);
      aoaData.push(footerData);
    };
    
    if (rekapTabelFilter.includes("kunjungan")) {
      addSection("Jenis Kunjungan", rekapData, totalKunjunganPerDay, grandTotalKunjungan);
    }
    if (rekapTabelFilter.includes("dpjp")) {
      addSection("Dokter DPJP", rekapDokterData, totalDokterPerDay, grandTotalDokter);
    }
    if (rekapTabelFilter.includes("penjamin")) {
      addSection("Penjamin", rekapPenjaminData, totalPenjaminPerDay, grandTotalPenjamin);
    }

    if (aoaData.length <= 4) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

    const thinBorder = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const centerBoldStyle = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    const lightBlueFill = { fgColor: { rgb: "DDEBF7" } }; // Warna biru muda

    const tableHeaderStyle = { ...centerBoldStyle, border: thinBorder, fill: lightBlueFill };

    const categoryStyle = { font: { bold: true }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };

    const totalRowStyle = { font: { bold: true }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder, fill: lightBlueFill };
    const totalNumberStyle = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder, fill: lightBlueFill };

    worksheet["A1"].s = { ...centerBoldStyle, font: { ...centerBoldStyle.font, sz: 14 } };
    worksheet["A2"].s = { ...centerBoldStyle, font: { ...centerBoldStyle.font, sz: 11 } };

    aoaData.forEach((row, r) => {
      if (r < 3) return;

      row.forEach((cell, c) => {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[cellAddress]) return;

        if (r === 3) {
          worksheet[cellAddress].s = tableHeaderStyle;
        } else {
          worksheet[cellAddress].s = { border: thinBorder, alignment: { vertical: "center" } };
          const isTotalRow = row[1] === "Total Harian";
          
          if (isTotalRow) {
            if (c === 1) {
              worksheet[cellAddress].s = totalRowStyle;
            } else {
              worksheet[cellAddress].s = totalNumberStyle;
            }
          } else {
            if (c === 0) {
              if (cell !== "") worksheet[cellAddress].s = categoryStyle;
            } else if (c === 1) {
              worksheet[cellAddress].s.alignment = { ...worksheet[cellAddress].s.alignment, horizontal: "left" };
            } else {
              worksheet[cellAddress].s.alignment = { ...worksheet[cellAddress].s.alignment, horizontal: "center" };
            }
          }
        }
      });
    });

    const columnWidths = aoaData.reduce((widths: any[], row: any[]) => {
      row.forEach((cell, colIdx) => {
        const cellValue = cell ? cell.toString() : "";
        let cellLength = cellValue.length;
        if (colIdx === 0) cellLength = Math.max(cellLength, 15);
        if (colIdx === 1) cellLength = Math.max(cellLength, 20);
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellLength + 2);
      });
      return widths;
    }, []);
    worksheet["!cols"] = columnWidths.map((wch: number) => ({ wch }));
    
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalColumns - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalColumns - 1 } },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet2");
    XLSX.writeFile(workbook, `Laporan Rekap Kunjungan.xlsx`);

  } catch (error) {
    console.error("Error exporting Rekap Kunjungan", error);
    alert("Gagal mengekspor data Rekap Kunjungan. Silakan cek konsol untuk detail.");
  }
};