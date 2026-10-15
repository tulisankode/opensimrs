import * as XLSX from "xlsx-js-style";
import { epochToDate } from "@/utils/Helpers";
import axios from "axios";
import { useRJStore } from "./laporanrajal";
import { useRekapTindakanStore } from "./laporan/rekapTindakan";


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

// KUNJUNGAN RAWAT JALAN
export const downloadExportExcelKunjunganRajal = async (
  filter?: any
  ) => {
    try {
      const rjStore = useRJStore();
      const response = await rjStore.DownloadKunjunganRajal(filter || {});

      console.log("Full response object from store action:", response);
      const reportData = response.payload.data;

      if (!reportData || reportData.length === 0) {
        alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
        return;
      }

      const title = ["LAPORAN KUNJUNGAN RAWAT JALAN"];
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
        poli: "Poli",
        dokter: "Dokter",
        statusKeluarPasien: "Status Keluar Pasien",
        kondisiKeluar: "Kondisi Keluar",
      });

      for (let i = 0; i < reportData.length; i++) {
        const row = reportData[i];
        try {
          const patient = row.patient ?? {};
          const birthDetail = patient.birthDetail ?? {};
          const address = patient.address ?? {};
          const umur = `${birthDetail.ageYear ?? 0} Tahun ${birthDetail.ageMonth ?? 0} Bulan ${birthDetail.ageDay ?? 0} Hari`;
          const pegawai = row.practitioner ?? {};
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
            jenisKelamin: patient.gender === "Male" ? "L" : patient.gender === "Female" ? "P" : "-",
            tglLahir: birthDetail.birthDate?.split("T")[0] ?? "-",
            umur: umur,
            alamat: address.fullAddress ?? "-",
            poli: row.polyclinic?.name ?? "-",
            dokter: pegawai.name ?? "-",
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

      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Kunjungan Rajal");
      XLSX.writeFile(workbook, `Laporan Kunjungan Rawat Jalan.xlsx`);
    } catch (error) {
      console.error("Error exporting Kunjungan Rawat Jalan", error);
      alert("Gagal mengekspor data. Silakan cek konsol untuk detail.");
    }
};

// BATAL KUNJUNGAN RAWAT JALAN
export const downloadExportExcelBatalRawatJalan = async (
  filter?: any
) => {
  try {
    const rjStore = useRJStore();
    const response = await rjStore.DownloadBatalPoli(filter || {});

    const reportData = response.payload.data;

    if (!reportData || reportData.length === 0) {
      alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
      return;
    }

    const title = ["LAPORAN BATAL KUNJUNGAN RAWAT JALAN"];
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
        tglRegistrasi: epochToDate(row.tanggalDaftar, "dateTime") ?? "-",
        noreg: row.noReg ?? "-",
        noRm: patient.noRm ?? "-",
        namaPasien: patient.name ?? "-",
        poli: row.polyclinic?.name ?? "-",
        dokter: row.practitioner?.name ?? "-",
        tglBatal: epochToDate(row.deletedAt, "dateTime") ?? "-",
        petugas: row.petugas ?? "-",
        alasanBatal: row.alasanBatal ?? "-",
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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Batal Kunjungan Rajal");
    XLSX.writeFile(workbook, `Laporan Batal Kunjungan Rawat Jalan.xlsx`);
  } catch (error) {
    console.error("Error exporting Batal Kunjungan Rawat Jalan", error);
    alert("Gagal mengekspor data Batal Kunjungan Rawat Jalan. Silakan cek konsol untuk detail.");
  }
};

// REKAP TINDAKAN PASIEN RAWAT JALAN
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
      let namaBulan = "Jumlah";
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
      
      const jumlahHeader = `Jumlah Bulan ${namaBulan}`;


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
      XLSX.writeFile(workbook, `Laporan Rekap Tindakan Pasien.xlsx`);
    } catch (error) {
      console.error("Error exporting Rekap Tindakan Pasien", error);
      alert("Gagal mengekspor data Rekap Tindakan Pasien. Silakan cek konsol untuk detail.");
    }
  };