import * as XLSX from "xlsx-js-style";
import { epochToDate } from "@/utils/Helpers";
import axios from "axios";
import { useRIStore } from "./laporanranap";
import { useRekapTindakanStore } from "@/stores/rawatJalan/laporan/rekapTindakan";


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

  const formattedStartDate = formatTanggalIndonesia(filter?.startDate);
  const formattedEndDate = formatTanggalIndonesia(filter?.endDate);

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

// KUNJUNGAN RAWAT INAP
export const downloadExportExcelKunjunganRanap = async (filter?: any) => {
  try {
    const riStore = useRIStore();
    const response = await riStore.DownloadKunjunganRanap(filter || {});

    console.log("Full response object from store action:", response);
    const reportData = response.payload.data;

    if (!reportData || reportData.length === 0) {
      alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
      return;
    }

    const title = ["LAPORAN KUNJUNGAN RAWAT INAP"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No",
      tglRegistrasi: "Tanggal Registrasi",
      noreg: "No. Registrasi",
      noRm: "No. RM",
      namaPasien: "Nama Pasien",
      jenisKelamin: "Jenis Kelamin",
      tglLahir: "Tanggal Lahir",
      umur: "Umur",
      alamat: "Alamat",
      dokter: "Dokter",
      ruangan: "Ruangan",
      kelas: "Kelas",
      noBed: "No. Bed",
      // Isi kolom: kondisi pulang (Stabil/Perbaikan) lalu status pulang (Pulang/Dirujuk/Meninggal).
      statusKeluarPasien: "Kondisi Keluar",
      kondisiKeluar: "Status Keluar Pasien",
    });

    for (let i = 0; i < reportData.length; i++) {
      const row = reportData[i];
      try {
        const patient = row.patient ?? {};
        const birthDetail = patient.birthDetail ?? {};
        const address = patient.address ?? {};
        const monitoringRoom = row.monitoringRoom ?? {};
        const room = monitoringRoom.room ?? {};
        const practitioner = row.practitioner ?? {};
        const pegawai = practitioner.pegawai ?? {};

        const umur = patient.birthDetail == null ? "-" : `${birthDetail.ageYear ?? 0} Tahun ${birthDetail.ageMonth ?? 0} Bulan ${birthDetail.ageDay ?? 0} Hari`;

        const mapKondisiPasien = (code: string) => {
          switch (code) {
            case '359746009': return 'Stabil';
            case '162668006': return 'Tidak Stabil';
            case '268910001': return 'Perbaikan';
            default: return code || '-';
          }
        };

        const mapStatusPulang = (status: string) => {
            switch (status) {
                case 'home': return 'Pulang atas persetujuan dokter';
                case 'aadvice': return 'Pulang atas permintaan sendiri';
                case 'other-hfc':
                case 'other-hcf': return 'Dirujuk';
                case 'exp-lt48h': return 'Meninggal < 48 jam';
                case 'exp-gt48h': return 'Meninggal > 48 jam';
                case 'oth': return 'Lain-lain';
                default: return status || '-';
            }
        };

        data.push({
          No: i + 1,
          tglRegistrasi: epochToDate(row.tanggalDaftar, "dateTime"),
          noreg: row.noReg ?? "-",
          noRm: patient.noRm ?? "-",
          namaPasien: patient.name ?? "-",
          jenisKelamin: ["Male", "Laki-laki"].includes(patient.gender) ? "L" : ["Female", "Perempuan"].includes(patient.gender) ? "P" : "-",
          tglLahir: birthDetail.birthDate?.split("T")[0] ?? "-",
          umur: umur,
          alamat: address.fullAddress ?? "-",
          dokter: pegawai.name ?? "-",
          ruangan: room.name ?? "-",
          kelas: room.className ?? "-",
          noBed: monitoringRoom.noBed ?? "-",
          statusKeluarPasien: mapKondisiPasien(row.kondisiPasienPulang),
          kondisiKeluar: mapStatusPulang(row.statusPulang),
        });
      } catch (error) {
        console.error(`Gagal memproses baris data ke-${i}:`, row);
        console.error("Pesan Error:", error);
        data.push({ No: i + 1, tglRegistrasi: "DATA ERROR", noreg: row.noReg });
      }
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
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
    const headers = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4"];
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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Kunjungan Ranap");
    XLSX.writeFile(workbook, `Laporan Kunjungan Rawat Inap.xlsx`);
  } catch (error) {
    console.error("Error exporting Kunjungan Rawat Inap", error);
    alert("Gagal mengekspor data. Silakan cek konsol untuk detail.");
  }
};

// BATAL RAWAT INAP
export const downloadExportExcelBatalRawatRanap = async (filter?: any) => {
  try {
    const riStore = useRIStore();
    const response = await riStore.DownloadBatalRawat(filter || {});

    console.log("Full response object from store action:", response);
    const reportData = response.payload.data;

    if (!reportData || reportData.length === 0) {
      alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
      return;
    }

    const title = ["LAPORAN BATAL RAWAT INAP"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No",
      tglRegistrasi: "Tanggal Registrasi",
      noreg: "No. Registrasi",
      noRm: "No. RM",
      namaPasien: "Nama Pasien",
      dokter: "Dokter DPJP",
      ruangan: "Ruangan",
      kelas : "Kelas",
      noBed : "No. Bed",
      tglBatal: "Tanggal Batal",
      petugas: "Petugas",
      alasanBatal: "Alasan Batal",
    });

    for (let i = 0; i < reportData.length; i++) {
      const row = reportData[i];
      try {
        const patient = row.patient ?? {};
        const monitoringRoom = row.monitoringRoom ?? {};
        // Pembatalan SPRI belum punya bed: ruangan diambil dari ruangan SPRI.
        const room = monitoringRoom.room ?? row.ruangan ?? {};
        const practitioner = row.practitioner ?? {};
        const pegawai = practitioner.pegawai ?? {};
        
        data.push({
          No: i + 1,
          tglRegistrasi: epochToDate(row.tanggalDaftar, "dateTime") ?? "-",
          noreg: row.noReg ?? "-",
          noRm: patient.noRm ?? "-",
          namaPasien: patient.name ?? "-",
          dokter: pegawai.name ?? "-",
          ruangan: room.name ?? "-",
          kelas: room.className ?? "-",
          noBed: monitoringRoom.noBed ?? "-",
          tglBatal: epochToDate(row.deletedAt, "dateTime") ?? "-",
          petugas: row.petugas ?? "-",
          alasanBatal: row.alasanBatal ?? "-",
        });
      } catch (error) {
          console.error(`Gagal memproses baris data ke-${i}:`, row);
          console.error("Pesan Error:", error);
          data.push({ No: i + 1, tglRegistrasi: "DATA ERROR", noreg: row.noReg });
      }
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
    const headers = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "I4", "J4", "K4", "L4"];
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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Batal Rawat Inap");
    XLSX.writeFile(workbook, `Laporan Batal Rawat Inap.xlsx`);
  } catch (error) {
    console.error("Error exporting Batal Rawat Inap", error);
    alert("Gagal mengekspor data Batal Rawat Inap. Silakan cek konsol untuk detail.");
  }
};

// REKAP TINDAKAN PASIEN RAWAT INAP
export const downloadExportExcelRekapTindakanPasien = async (
  filter?: any
) => {
  try {
    const rekapTindakanStore = useRekapTindakanStore()
    const response = await rekapTindakanStore.downloadTindakanPasien(filter || {});

    const reportData = response.payload.data;

    if (!reportData || reportData.length === 0) {
      alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
      return;
    }

    let bulanTahunTerpilih = "Bulan Ini";
    let namaBulan = "Ini";

    if (filter?.timestamp) {
      const tanggal = new Date(Number(filter.timestamp) * 1000);

  
      bulanTahunTerpilih = tanggal.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });

      namaBulan = tanggal.toLocaleDateString("id-ID", {
        month: "long",
      });
    }

    const title = ["LAPORAN REKAP TINDAKAN PASIEN"];
    const tanggalExport = [`Periode : ${bulanTahunTerpilih}`];

    const jumlahHeader = `Jumlah Di Bulan ${namaBulan}`;

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No",
      tindakan: "Tindakan",
      jumlah: jumlahHeader,
    });

    for (let i = 0; i < reportData.length; i++) {
      const row = reportData[i];
      data.push({
        No: i + 1,
        tindakan: row.namaTindakan ?? "-",
        jumlah: row.total ?? "-",
      });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [tanggalExport], { origin: "A2" });

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
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
    const headers = ["A4", "B4", "C4"];
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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Rekap Tindakan");
    XLSX.writeFile(workbook, `Laporan Rekap Tindakan Pasien RI.xlsx`);
  } catch (error) {
    console.error("Error exporting Rekap Tindakan Pasien RI", error);
    alert("Gagal mengekspor data Rekap Tindakan Pasien. Silakan cek konsol untuk detail.");
  }
};

// PERPINDAHAN PASIEN RAWAT INAP
export const downloadExportExcelPerpindahanPasien = async (filter?: any) => {
  try {
    const riStore = useRIStore();
    const response = await riStore.DownloadPerpindahan(filter || {});

    console.log("Full response object from store action:", response);
    const reportData = response.payload.data;

    if (!reportData || reportData.length === 0) {
      alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
      return;
    }

    const title = ["LAPORAN PERPINDAHAN PASIEN"];
    const tanggalExport = [getPeriodeTeksFromFilter(filter)];

    const data: any[] = [];
    data.push({});
    data.push({});
    data.push({});
  
    data.push({
      No: "No",
      namaPasien: "Nama Pasien",
      noRm: "No. Rm",
      jenisPelayanan: "Jenis Pelayanan",
      penjamin: "Penjamin",
      dariRuangan: "Dari Ruangan",
      dariKelas: "Dari Kelas",
      keRuangan: "Ke Ruangan",
      keKelas: "Ke Kelas",
      dokter: "Dokter",
    });

    for (let i = 0; i < reportData.length; i++) {
      const row = reportData[i];
      try {
        const ri = row.rawatInap || {};
        const patient = ri.patient || {};
        
        const origin = row.originMonitoringRoom || {};
        const originRoom = origin.room || {};
        
        const dest = row.destinationMonitoringRoom || {};
        const destRoom = dest.room || {};
        
        const practitioner = ri.practitioner || {};
        const pegawai = practitioner.pegawai || {};

        const doctorName = `${pegawai.firstTitle || ""} ${pegawai.name || ""} ${pegawai.lastTitle || ""}`.trim();

        const originText = `${originRoom.name || "-"} / ${origin.noBed || "-"}`;
        const destText = `${destRoom.name || "-"} / ${dest.noBed || "-"}`;

        const originClass = originRoom.className ?? "-";
        const destClass = destRoom.className ?? "-";

        data.push({
          No: i + 1,
          namaPasien: patient.name || ri.name || "-",
          noRm: ri.noRm || patient.noRm || "-",
          jenisPelayanan: "Rawat Inap",
          penjamin: ri.paymentMethod === 1 ? "TUNAI" : "ASURANSI",
          dariRuangan: originText,
          dariKelas: originClass,
          keRuangan: destText,
          keKelas: destClass,
          dokter: doctorName || "-",
        });
      } catch (error) {
        console.error(`Gagal memproses baris data ke-${i}:`, row);
        data.push({ No: i + 1, namaPasien: "DATA ERROR" });
      }
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
    
    const headers = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "I4", "J4"];
    headers.forEach((header) => {
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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Perpindahan Pasien");
    XLSX.writeFile(workbook, `Laporan Perpindahan Pasien.xlsx`);

  } catch (error) {
    console.error("Error exporting Perpindahan Pasien", error);
    alert("Gagal mengekspor data Perpindahan Pasien. Silakan cek konsol untuk detail.");
  }
};