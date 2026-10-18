import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorMessage } from "./generate-message.js";

export const antrianPermission = {
  module: "Antrian",
  subModules: [
    {
      name: "Konfigurasi",
      allows: ["READ", "CREATE", "UPDATE", "DELETE"],
    },
    {
      name: "Data Antrian",
      allows: ["READ"],
    },
    {
      name: "Layar",
      allows: ["READ"],
    },
    {
      name: "Apm",
      allows: ["CREATE PASIEN JKN", "CREATE PASIEN NON-JKN", "CHECKIN", "PRINT"],
    },
    {
      name: "Antrean Online BPJS",
      allows: ["READ", "KONFIGURASI", "KIRIM ULANG"],
    },
  ],
};

export const admisiPermission = {
  module: "Admisi",
  subModules: [
    {
      name: "Antrian",
      allows: ["PANGGIL", "LEWATI", "PROSSES", "SELESAI", "CHECKIN"],
    },
    {
      name: "Admisi RJ",
      allows: ["READ", "CREATE PASIEN RJ", "CREATE GENERAL CONSENT", "UPDATE ADMISI RJ", "CETAK KUNJUNGAN", "CETAK LABEL", "DELETE GENERAL CONSENT", "BATAL RJ"],
    },
    {
      name: "Admisi RI",
      allows: [
        "READ",
        "CREATE BAYI BARU LAHIR",
        "CREATE PASIEN RI",
        "CREATE GENERAL CONSENT",
        "UPDATE ADMISI RI",
        "CETAK GENERAL CONSENT",
        "CETAK KUNJUNGAN",
        "CETAK LABEL",
        "UPDATE ADMISI RI",
        "DELETE GENERAL CONSENT",
      ],
    },
    {
      name: "Admisi IGD",
      allows: [
        "CREATE PASIEN IGD",
        "CREATE GENERAL CONSENT",
        "UPDATE ADMISI IGD",
        "UPDATE GENERAL CONSENT",
        "BATAL IGD",
        "CETAK GENERAL CONSENT",
        "CETAK KUNJUNGAN",
        "CETAK LABEL",
        "DELETE GENERAL CONSENT",
      ],
    },
    {
      name: "SEP",
      allows: ["READ", "CREATE SEP", "CREATE SEP MANUAL", "DELETE", "SIMPAN SEP MANUAL", "DELETE PASIEN"],
    },
    {
      // Rencana Kontrol & SPRI via VClaim (fitur vclaim_rencana_kontrol, modul bpjs_fkrtl) — STD-0021
      name: "Rencana Kontrol & SPRI",
      allows: ["READ", "CREATE RENCANA KONTROL", "UPDATE RENCANA KONTROL", "DELETE RENCANA KONTROL", "CREATE SPRI", "UPDATE SPRI", "DELETE SPRI", "PILIH SURAT SEP"],
    },
    {
      name: "Data Pasien",
      allows: [
        "READ",
        "CREATE PASIEN",
        "UPDATE BERKAS RM",
        "UPDATE DATA PASIEN",
        "DELETE PASIEN",
        "DELETE BERKAS RM",
        "IMPORT DATA PASIEN",
        "CETAK KARTU PASIEN",
        "UPLOAD BERKAS RM",
        "PREVIEW BERKAS RM",
        "GENERAL CONSENT",
      ],
    },
    {
      name: "Monitoring Kamar",
      allows: ["READ", "CREATE BAD", "DELETE BAD", "SETTING BAD"],
    },
    {
      name: "Laporan Admisi",
      features: [
        {
          name: "Kunjungan",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Penjamin",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Batal Kunjungan",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Status kamar",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Keperawatan Inap Pasien",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Bayi Baru Lahir",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekap Jumlah Pasien BPJS",
          allows: ["READ", "CETAK LAPORAN"],
        },
      ],
    },
  ],
};

export const rawatJalanPermission = {
  module: "Rawat Jalan",
  subModules: [
    {
      name: "Antrian",
      allows: ["PANGGIL", "LEWATI", "PROSSES", "SELESAI"],
    },
    {
      name: "Poli",
      allows: ["READ", "BATAL KUNJUNGAN"],
    },
    {
      name: "BPJS-PCARE",
      features: [
        {
          name: "Monitoring Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
        {
          name: "Monitoring Riwayat Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
        {
          name: "Monitoring Obat Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
      ],
    },
    {
      name: "Laporan Rawat Jalan",
      features: [
        {
          name: "Kunjungan",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Pembatalan Poli",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekap Pembatalan Pasien",
          allows: ["READ", "CETAK LAPORAN"],
        },
      ],
    },
    {
      name: "RME",
      features: [
        {
          name: "Rekap Medis",
          allows: [
            "READ",
            "UPDATE PEMERIKSAAN GIGI",
            "UPDATE PEMERIKSAAN MATA",
            "UPDATE PEMERIKSAAN FISIK",
            "UPDATE DERAJAT LUKA BAKAR",
            "UPDATE PEMERIKSAAN DAN TINDAKAN",
            "UPDATE REKAM MEDIS",
            "CETAK LABEL",
          ],
        },
        {
          name: "Asesmen",
          allows: ["READ", "CREATE ALERGI", "CREATE ANAMESIS", "CREATE TANDA VITAL", "CREATE ANTROPOMETRI", "CREATE ASESMENT NYERI", "CREATE KESADARAN", "CREATE PEMERIKSAAN FISIK"],
        },
        {
          name: "SOAP",
          allows: ["READ", "CREATE OBAT", "CREATEE OBAT RACIKAN", "UPDATE OBAT", "DELETE OBAT"],
        },
        {
          name: "Akses Dan Penunjang",
          allows: [
            "READ",
            "CREATE ALKES",
            "CREATE ALKES MULTIPLE",
            "DELETE LIST ALKES",
            "DELETE LIST ALKES MULTIPLE",
            "DELETE SEMUA",
            "AMBIL ITEM",
            "SIMPAN ORDER",
            "CREATE TINDAKAN",
            "DELETE LIST TINDAKAN",
          ],
        },
        {
          name: "Inform Consent",
          allows: ["READ", "CREATE"],
        },
        {
          name: "Unggah Berkas",
          allows: ["READ", "UPDATE FILE", "DELETE FILE", "CARI FILE"],
        },
        {
          name: "Resume Dan DISHCARGE",
          allows: ["READ", "CETAK RESUME MEDIS", "SIMPAN RESUME MEDIS", "DISHCARGE"],
        },
        {
          name: "Cetak Hasil Dan Surat",
          allows: ["READ", "CETAK HASIL", "CREATE SURAT", "DELETE SURAT KERERANGAN", "CETAK SURAT"],
        },
      ],
    },
  ],
};

export const rawatInapPermission = {
  module: "Rawat Inap",
  subModules: [
    {
      name: "Rawat Inap",
      allows: ["READ", "BATAL DIRAWAT"],
    },
    {
      name: "Perpindahan Bangsal",
      allows: ["READ", "BATAL TERIMA", "SETUJU DAN TERIMA"],
    },
    {
      name: "BPJS-PCARE",
      features: [
        {
          name: "Monitoring Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
        {
          name: "Monitoring Riwayat Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
        {
          name: "Monitoring Obat Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
      ],
    },
    {
      name: "Laporan",
      features: [
        {
          name: "Monitoring Rawat Inap",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Perpindahan Pasien",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Pembatalan Berobat",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekap Tindakan Pasien",
          allows: ["READ", "CETAK LAPORAN"],
        },
      ],
    },
    {
      name: "Detail Pasien",
      features: [
        {
          name: "Rekam Medis",
          allows: ["READ", "UPDATE PEMERIKSAAN FISIK", "UPDATE DERAJAT LUKA BAKAR", "UPDATE PEMERIKSAAN DAN TINDAKAN", "UPDATE REKAM MEDIS", "DELETE SESI"],
        },
        {
          name: "Asesmen",
          allows: [
            "READ",
            "TIDAK ADA ALERGI",
            "CREATE ALERGI",
            "CREATE ANAMESIS",
            "CREATE TANDA VITAL",
            "CREATE ANTROPOMETRI",
            "CREATE ASESMENT NYERI",
            "CREATE KESADARAN",
            "CREATE PEMERIKSAAN FISIK",
            "CREATE DERAJAT LUKA BAKAR",
            "CREATE CATATAN HASIL PENUNJANG",
            "CREATE DIAGNOSIS DIAGNOSIS PENUNJANG",
            "CREATE ASUHAN KEPERAWATAN",
            "CREATE CATATAN PERAWAT",
            "CREATE INTRUKSI MEDIS",
            "CREATE PEMERIKSAAN DAN TINDAKAN",
          ],
        },
        {
          name: "SOAP Dokter",
          allows: ["READ", "PLAN CREATE OBAT", "PLAN CREATE RACIKAN", "PLAN UPDATE OBAT", "PLAN DELETE OBAT"],
        },
        {
          name: "Inform Consent",
          allows: ["READ", "CREATE"],
        },
        {
          name: "Alkes Dan Penunjang",
          allows: [
            "READ",
            "ORDER ALKES CREATE ALKES",
            "ORDER ALKES CREATE ALKES MULTIPLE",
            "ORDER ALKES DELETE ALKES",
            "ORDER ALKES DELETE MULTIPLE",
            "ORDER ALKES DELETE SEMUA",
            "ORDER ALKES AMBIL ITEM",
            "ORDER LAB SIMPAN ORDER",
            "ORDER FISIO CREATE TINDAKAN",
          ],
        },
        {
          name: "Perpindahan",
          allows: ["READ", "PINDAHKAN PASIEN"],
        },
        {
          name: "FPO",
          allows: ["CREATE PEMBERIAN OBAT", "UPDATE PEMBERIAN OBAT", "TANGGAL PEMERIKSAAN", "TANGGAL PEMBERIAN OBAT"],
        },
        {
          name: "Unggah Berkas",
          allows: ["READ", "UPDATE FILE", "DELETE FILE", "CARI FILE"],
        },
        {
          name: "Resume Dan Dishcarge",
          allows: ["READ", "CETAK RESUME MEDIS", "SIMPAN RESUME MEDIS", "DISHCARGE"],
        },
        {
          name: "Cetak Hasil Dan Surat",
          allows: ["READ", "CETAK HASIL PEMERIKSAAN", "SURAT KETERANGAN CREATE SURAT", "SURAT KETERANGAN DELETE SURAT KETERANGAN", "SURAT KETERANGAN CETAK SURAT"],
        },
      ],
    },
  ],
};

export const icuPermission = {
  module: "ICU",
  subModules: [
    { name: "Dasbor", allows: ["READ"] },
    { name: "Perawatan", allows: ["READ"] },
    { name: "Serah Terima", allows: ["READ", "KELOLA"] },
    { name: "Flowsheet Observasi", allows: ["READ", "CREATE", "KOREKSI"] },
    { name: "Balance Cairan", allows: ["READ", "CREATE"] },
    { name: "Skor SOFA", allows: ["READ", "CREATE"] },
    { name: "Laporan ICU", allows: ["READ", "CETAK LAPORAN"] },
  ],
};

export const igdPermission = {
  module: "IGD",
  subModules: [
    {
      name: "IGD",
      allows: ["READ", "BATAL IGD"],
    },
    {
      name: "BPJS-PCARE",
      features: [
        {
          name: "Monitoring Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
        {
          name: "Monitoring Riwayat Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
        {
          name: "Monitoring Obat Kunjungan",
          allows: ["READ", "CETAK BPJS"],
        },
      ],
    },
    {
      name: "Laporan IGD",
      features: [
        {
          name: "Kunjungan",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Pembatalan Berobat",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekap Tindakan Pasien",
          allows: ["READ", "CETAK LAPORAN"],
        },
      ],
    },
    {
      name: "Detail Pasien",
      features: [
        {
          name: "Rekam Medis",
          allows: ["READ", "UPDATE PEMERIKSAAN FISIK", "UPDATE DERAJAT LUKA BAKAR", "UPDATE PEMERIKSAAN DAN TINDAKAN", "UPDATE REKAM MEDIS", "DELETE SESI"],
        },
        {
          name: "Asesmen",
          allows: [
            "READ",
            "TIDAK ADA ALERGI",
            "CREATE ALERGI",
            "CREATE ANAMESIS IGD",
            "CREATE TRIASE",
            "CREATE TANDA VITAL",
            "CREATE ANTROPOMETRI",
            "CREATE ASESMENT NYERI",
            "CREATE KESADARAN",
            "CREATE PEMERIKSAAN FISIK",
            "CREATE DERAJAT LUKA BAKAR",
            "CREATE CATATAN HASIL PENUNJANG",
            "CREATE DIAGNOSIS DIAGNOSIS PENUNJANG",
            "CREATE ASUHAN KEPERAWATAN",
            "CREATE CATATAN PERAWAT",
            "CREATE INTRUKSI MEDIS",
            "CREATE PEMERIKSAAN DAN TINDAKAN",
          ],
        },
        {
          name: "SOAP Dokter",
          allows: ["READ", "PLAN CREATE OBAT", "PLAN CREATE RACIKAN", "PLAN UPDATE OBAT", "PLAN DELETE OBAT"],
        },
        {
          name: "Inform Consent",
          allows: ["READ", "CREATE"],
        },
        {
          name: "Alkes Dan Penunjang",
          allows: [
            "READ",
            "ORDER ALKES CREATE ALKES",
            "ORDER ALKES CREATE ALKES MULTIPLE",
            "ORDER ALKES DELETE ALKES",
            "ORDER ALKES DELETE MULTIPLE",
            "ORDER ALKES DELETE SEMUA",
            "ORDER ALKES AMBIL ITEM",
            "ORDER LAB SIMPAN ORDER",
            "ORDER FISIO CREATE TINDAKAN",
          ],
        },
        {
          name: "Perpindahan",
          allows: ["READ", "PINDAHKAN PASIEN"],
        },
        {
          name: "FPO",
          allows: ["CREATE PEMBERIAN OBAT", "UPDATE PEMBERIAN OBAT", "TANGGAL PEMERIKSAAN", "TANGGAL PEMBERIAN OBAT"],
        },
        {
          name: "Unggah Berkas",
          allows: ["READ", "UPDATE FILE", "DELETE FILE", "CARI FILE"],
        },
        {
          name: "Resume Dan Dishcarge",
          allows: ["READ", "CETAK RESUME MEDIS", "SIMPAN RESUME MEDIS", "DISHCARGE"],
        },
        {
          name: "Cetak Hasil Dan Surat",
          allows: ["READ", "CETAK HASIL PEMERIKSAAN", "SURAT KETERANGAN CREATE SURAT", "SURAT KETERANGAN DELETE SURAT KETERANGAN", "SURAT KETERANGAN CETAK SURAT"],
        },
      ],
    },
  ],
};

export const farmasiPermission = {
  module: "Farmasi",
  subModules: [
    {
      name: "Panggil Antrian",
      allows: ["PANGGIL", "LEWATI", "VERIFIKASI", "PENYERAHAN OBAT"],
    },
    {
      name: "Resep Dokter",
      allows: [
        "READ",
        "UPDATE OBAT",
        "RESEP MASUK BATAL ORDER",
        "RESEP MASUK PINDAH LOKASI",
        "RESEP MASUK CETAK",
        "RESEP MASUK SIMPAN TELAAH",
        "RESEP MASUK VERIFIKASI",
        "EDIT OBAT",
        "SIMPAN EDIT",
        "OBAT DIGERUS",
        "SIMPAN DAN UBAH MENJADI RACIK",
        "MENUNGGU PEMBAYARAN BATAL",
        "MENUGGU PEMBAYARAN CETAK",
        "OBAT DISIAPKAN TUNAI CETAK",
        "OBAT DISIAPKAN TUNAI OBAT SIAP DISERAHKAN",
        "OBAT DISIAPKAN ASURANSI BATAL",
        "OBAT DISIAPKAN ASURANSI CETAK",
        "OBAT DISIAPKAN ASURANSI OBAT SIAP DISERAHKAN",
        "PENYERAHAN OBAT BATAL PENYERAHAN",
        "PENYERAHAN OBAT CETAK",
        "PENYERAHAN OBAT SERAHKAN OBAT",
      ],
    },
    {
      name: "Penjualan Obat",
      allows: ["READ", "CREATE BELI OBAT", "CREATE ITEM", "CREATE ITEM OBAT", "CREATE ITEM MULTIPLE", "BATAL PEMBELIAN"],
    },
    {
      name: "Retur Obat dan Material",
      allows: ["READ", "RETUR"],
    },
    {
      name: "Farmasi Ruangan",
      allows: [
        "READ",
        "ORDER MASUK UPDATE ITEM",
        "ORDER MASUK BATAL",
        "ORDER MASUK PINDAH LOKASI ORDER",
        "ORDER MASUK CETAK",
        "ORDER MASUK VERIFIKASI",
        "SEDANG DISIAPKAN BATAL",
        "SEDANG DISIAPKAN CETAK",
        "SEDANG DISIAPKAN ALKES SIAP DISERAHKAN",
        "PENYERAHAN BATAL",
        "PENYERAHAN CETAK",
        "PENYERAHAN SERAHKAN",
      ],
    },
    {
      name: "Riwayat Transaksi",
      allows: ["READ", "CETAK"],
    },
    {
      name: "Datamaster",
      features: [
        {
          name: "Satuan",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Bentuk Sediaan",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Kategori Obat",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Manufaktur",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Jenis Stok",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Lokasi Stok",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Item Medis",
          allows: ["READ", "CREATE ITEM MEDIS", "UPDATE", "DELETE ITEM MEDIS", "CREATE KONVERSI SATUAN", "DELETE SATUAN PEMBELIAN", "IMPORT", "EXPORT"],
        },
        {
          name: "Aturan Pakai",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Komposisi",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Konfigurasi Harga",
          allows: [
            "READ",
            "CREATE TARIF JASA BARU EMBALASE DAN RACIK",
            "UPDATE TARIF JASA BARU EMBALASE DAN RACIK",
            "DELETE TARIF JASA BARU EMBALASE DAN RACIK",
            "SIMPAN PERUBAHAN",
            "SIMPAN BENTUK RACIKAN",
            "INPUT MARGIN",
            "INPUT PPN",
          ],
        },
      ],
    },
    {
      name: "Riwayat Transaksi",
      features: [
        {
          name: "Pendapatan",
          allows: ["READ", "CETAK"],
        },
        {
          name: "Waktu Tunggu",
          allows: ["READ", "CETAK"],
        },
        {
          name: "Rekap Pendapatan Per Apotik",
          allows: ["READ", "CETAK"],
        },
      ],
    },
  ],
};

export const laboraturiumPermission = {
  module: "Laboratorium",
  subModules: [
    {
      name: "Order Lab",
      allows: ["READ", "CREATE", "UPDATE PROFILE PASIEN", "UPDATE ORDER LAB", "BATAL ORDER", "REKAM MEDIS", "CETAK LABEL", "CETAK PENGANTAR", "VALIDASI ORDER", "RIWAYAT PEMERIKSAAN RM", "TANDAI RUJUKAN", "KIRIM RUJUKAN", "BATAL RUJUKAN"],
    },
    {
      name: "Hasil Pemeriksaan",
      allows: ["READ", "DETAIL RM", "RIWAYAT", "RIWAYAT PEMERIKSAAN RM", "RIWAYAT PEMERIKSAAN LAB", "CETAK LABEL", "CETAK HASIL", "SIMPAN HASIL", "SELESAI", "UNGGAH BERKAS RUJUKAN"],
    },
    {
      name: "Expertise",
      allows: ["READ", "DETAIL RM", "RIWAYAT", "CETAK HASIL", "SIMPAN EXPERTISE"],
    },
    {
      name: "Datamaster",
      features: [
        {
          name: "Kategori Pemeriksaan",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Kelompok Pemeriksaan",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Item Pemeriksaan",
          allows: ["READ", "CREATE ITEM PEMERIKSAAN", "UPDATE ITEM PEMERIKSAAN", "DELETE ITEM PEMERIKSAAN", "NILAI RUJUKAN", "UPDATE NILAI RUJUKAN", "IMPORT", "EXPORT"],
        },
        {
          name: "Spesimen",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Laboratorium Rujukan",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Tarif Lab",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
      ],
    },
    {
      name: "Laporan",
      features: [
        {
          name: "Kunjungan",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Waktu Tunggu TAT",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekap Jumlah Pemeriksaan",
          allows: ["READ", "CETAK LAPORAN"],
        },
      ],
    },
  ],
};

export const fisioTerapiPermission = {
  module: "Fisioterapi",
  subModules: [
    {
      name: "Order Fisioterapi",
      allows: [
        "READ",
        "CREATE ORDER",
        "CREATE TINDAKAN",
        "UPDATE ASSESMENT MEDIS",
        "UPDATE RINCIAN PEMERIKSAAN & BIAYA",
        "UPDATE PROFILE PASIEN",
        "DELETE ITEM LIST TINDAKAN",
        "BATAL ORDER",
        "REKAM MEDIS",
        "VALIDASI DOKTER",
        "CETAK LABEL",
        "RIWAYAT",
      ],
    },
    {
      name: "Penjadwalan Terapi",
      allows: ["READ", "REKAM MEDIS", "RIWAYAT PEMERIKSAAN", "SIMPAN DAN MULAI TERAPI"],
    },
    {
      name: "Evaluasi Terapi",
      allows: ["READ", "EVALUASI"],
    },
    {
      name: "Booking Terapi",
      allows: ["READ", "CREATE BOOKING TERAPI", "UPDATE BOOKING", "BATAL BOOKING", "DAFTAR"],
    },
    {
      name: "Datamaster",
      features: [
        {
          name: "Bed Ruangan",
          allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
        },
        {
          name: "Tindakan Terapi",
          allows: ["READ", "CREATE", "UPDATE", "DELETE"],
        },
        {
          name: "Paket Terapi",
          allows: ["READ", "CREATE", "UPDATE", "DELETE"],
        },
      ],
    },
    {
      name: "Laporan Fisio",
      features: [
        {
          name: "Kunjungan",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekapitulasi Kunjungan Jenis Fisioterapi",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekapitulasi Terapi",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Rekapitulasi Pendapatan Fisioterapi",
          allows: ["READ", "CETAK LAPORAN"],
        },
      ],
    },
    {
      name: "RME",
      features: [
        {
          name: "Rekam Medis",
          allows: ["READ", "UPDATE PEMERIKSAAN GIGI", "UPDATE PEMERIKSAAN MATA", "UPDATE PEMERIKSAAN FISIK", "UPDATE DERAJAT LUKA BAKAR", "UPDATE RM"],
        },
        {
          name: "Assesmen",
          allows: [
            "READ",
            "TIDAK ADA ALERGI",
            "CREATE ALERGI",
            "CREATE ANAMNESIS",
            "CREATE TANDA VITAL",
            "CREATE ANTROPOMETRI",
            "CREATE ASESMEN NYERI",
            "CREATE KESADARAN",
            "CREATE PEMERIKSAAN FISIK",
            "CREATE DERAJAT LUKA BAKAR",
            "CREATE CATATAN HASIL PENUNJANG",
            "CREATE DIAGNOSIS DOKTER",
            "CREATE ASUHAN KEPERAWATAN",
            "CREATE CATATAN PERAWAT",
            "CREATE INSTRUKSI MEDIS",
            "CREATE PEMERIKSAAN DAN TINDAKAN",
          ],
        },
        {
          name: "SOAPIER",
          allows: ["READ", "PLAN CREATE OBAT", "PLAN CREATE OBAT RACIKAN", "PLAN UPDATE OBAT", "PLAN DELETE OBAT"],
        },
        {
          name: "Alkes dan Penunjang",
          allows: [
            "READ",
            "ORDER ALKES CREATE ALKES",
            "ORDER ALKES CREATE OBAT MULTIPLE",
            "ORDER ALKES DELETE ALKES",
            "ORDER ALKES DELETE ALKES MULTIPLE",
            "ORDER ALKES DELETE SEMUA",
            "ORDER ALKES AMBIL ITEM",
            "ORDER ALKES SIMPAN ORDER",
            "ORDER ALKES CREATE TINDAKAN",
          ],
        },
        {
          name: "Inform Consent",
          allows: ["READ", "CETAK LABEL", "CREATE"],
        },
        {
          name: "Unggah Berkas",
          allows: ["READ", "UPDATE FILE TERUNGGAH", "DELETE FILE TERUNGGAH"],
        },
        {
          name: "Resume dan Discharge",
          allows: ["READ", "CETAK RESUME MEDIS", "SIMPAN RESUME MEDIS", "DISCHARGE"],
        },
        {
          name: "Cetak Hasil dan Surat",
          allows: ["READ", "CETAK HASIL PEMERIKSAAN CETAK HASIL", "SURAT KETERANGAN CREATE SURAT", "SURAT KETERANGAN CETAK SURAT"],
        },
      ],
    },
  ],
};

export const radiologiPermission = {
  module: "Radiologi",
  subModules: [
    { name: "Order Radiologi", allows: ["READ", "CREATE", "VALIDASI", "BATAL", "CETAK"] },
    { name: "Penjadwalan", allows: ["READ", "CREATE", "UPDATE", "BATAL", "CETAK"] },
    { name: "Pemeriksaan", allows: ["READ", "PERIKSA", "INPUT HASIL", "CETAK HASIL"] },
    {
      name: "Datamaster",
      features: [
        { name: "Pemeriksaan Radiologi", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Paket Radiologi", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Ruang & Alat", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Template Expertise", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Petugas Radiologi", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Mapping PACS", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      ],
    },
    { name: "Laporan Radiologi", features: [{ name: "Kunjungan", allows: ["READ", "CETAK LAPORAN"] }] },
  ],
};

export const mcuPermission = {
  module: "MCU",
  subModules: [
    { name: "Peserta", allows: ["READ", "CREATE", "IMPOR", "UPDATE", "KIRIM LIS", "BATAL", "HAPUS", "KESIMPULAN", "CETAK"] },
    { name: "Pemeriksaan", allows: ["READ", "INPUT HASIL"] },
    {
      name: "Datamaster",
      features: [
        { name: "Paket MCU", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Perusahaan", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      ],
    },
    { name: "Tagihan Korporasi", allows: ["READ", "CREATE", "UPDATE", "PEMBAYARAN", "CETAK"] },
    { name: "Laporan MCU", allows: ["READ", "CETAK LAPORAN"] },
    // Pelaporan hasil MCU ke BPJS PCare (STD-0020): KIRIM mencakup kirim pertama & kirim ulang; UBAH/HAPUS
    // dipisah karena mengubah/menghapus laporan yang sudah terkirim di PCare berisiko lebih tinggi.
    { name: "MCU PCare", allows: ["READ", "KIRIM", "UBAH", "HAPUS"] },
  ],
};

export const programPuskesmasPermission = {
  module: "Program Puskesmas",
  subModules: [
    { name: "KIA", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
    { name: "KB", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
    { name: "Imunisasi", allows: ["READ", "CREATE", "UPDATE", "DELETE", "KIRIM SATUSEHAT"] },
    { name: "MTBS/MTBM", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
    { name: "Sasaran Program", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Kegiatan UKM", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
    {
      name: "Datamaster",
      features: [
        { name: "Jenis Vaksin & Jadwal", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Format Laporan Dinkes", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      ],
    },
    { name: "Laporan Dinkes", allows: ["READ", "CETAK LAPORAN", "EKSPOR EXCEL"] },
  ],
};

export const patologiAnatomiPermission = {
  module: "Patologi Anatomi",
  subModules: [
    { name: "Order PA", allows: ["READ", "CREATE", "VALIDASI", "BATAL", "CETAK"] },
    { name: "Penerimaan Jaringan", allows: ["READ", "TERIMA", "TOLAK"] },
    { name: "Pemeriksaan", allows: ["READ", "MAKROSKOPIS", "MIKROSKOPIS", "DIAGNOSIS", "VERIFIKASI", "CETAK HASIL"] },
    { name: "Arsip Blok & Slide", allows: ["READ", "UPDATE", "PINJAM"] },
    {
      name: "Datamaster",
      features: [
        { name: "Pemeriksaan PA", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Template Laporan PA", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      ],
    },
    { name: "Laporan PA", features: [{ name: "Kunjungan", allows: ["READ", "CETAK LAPORAN"] }] },
  ],
};

export const mikrobiologiPermission = {
  module: "Mikrobiologi",
  subModules: [
    { name: "Order Mikrobiologi", allows: ["READ", "CREATE", "VALIDASI", "BATAL", "CETAK"] },
    { name: "Pemeriksaan", allows: ["READ", "INPUT HASIL", "LAPORAN SEMENTARA", "VERIFIKASI", "CETAK HASIL"] },
    {
      name: "Datamaster",
      features: [
        { name: "Pemeriksaan Mikrobiologi", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Organisme", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Antibiotik", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      ],
    },
    {
      name: "Laporan Mikrobiologi",
      features: [
        { name: "Kunjungan", allows: ["READ", "CETAK LAPORAN"] },
        { name: "Antibiogram", allows: ["READ", "CETAK LAPORAN"] },
      ],
    },
    { name: "Konfigurasi LIS Mikrobiologi", allows: ["LIHAT", "KELOLA"] },
    { name: "Mapping LIS Mikrobiologi", allows: ["LIHAT", "KELOLA"] },
    { name: "Pengiriman LIS Mikrobiologi", allows: ["LIHAT", "KIRIM ULANG", "CEK STATUS"] },
  ],
};

export const kodingRmPermission = {
  module: "Koding Rekam Medis",
  subModules: [
    { name: "Worklist", allows: ["READ"] },
    { name: "Koding", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Klarifikasi", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Checklist", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Peminjaman", allows: ["READ", "CREATE", "UPDATE", "HAPUS"] },
    { name: "Retensi", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Laporan Koding", allows: ["READ"] },
  ],
};

export const kamarOperasiPermission = {
  module: "Kamar Operasi",
  subModules: [
    { name: "Order Operasi", allows: ["READ", "CREATE", "UPDATE", "KLARIFIKASI", "BATAL"] },
    { name: "Jadwal OK", allows: ["READ", "CREATE", "UPDATE", "BATAL", "VALIDASI"] },
    { name: "Pra-Operasi", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Checklist Keselamatan", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Laporan Operasi", allows: ["READ", "CREATE", "UPDATE", "FINALISASI"] },
    { name: "Laporan Anestesi", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Pemakaian BHP", allows: ["READ", "CREATE"] },
    {
      name: "Datamaster",
      features: [{ name: "Ruang OK", allows: ["READ", "CREATE", "UPDATE", "DELETE"] }],
    },
    { name: "Laporan Rekap", allows: ["READ", "CETAK LAPORAN"] },
  ],
};

export const giziPermission = {
  module: "Gizi",
  subModules: [
    { name: "Skrining", allows: ["READ", "CREATE"] },
    { name: "Asesmen Gizi", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Order Diet", allows: ["READ", "CREATE", "UPDATE", "BATAL"] },
    { name: "Distribusi", allows: ["READ", "CREATE", "CETAK"] },
    {
      name: "Datamaster",
      features: [
        { name: "Master Diet", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Bentuk Makanan", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
        { name: "Standar Porsi", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      ],
    },
    { name: "Laporan Gizi", allows: ["READ", "CETAK LAPORAN"] },
  ],
};

// Laundry & Linen (STD-0023, penunjang-service). Konfirmasi serah terima & distribusi dipisah dari CREATE (dua
// petugas berbeda — KF-5/KF-10); "Permintaan Linen" untuk petugas ruangan. Pelacakan per unit (STD-0030): pindai di
// setiap titik alur memakai aksi submodul alur di atas; "Pemindaian Unit" hanya membaca hasil pindai, "Unit Linen"
// registrasi/tautan bed/cetak label, "Koreksi Unit" ubah status & pindah lokasi beralasan, cara pencatatan per jenis
// mengikuti Datamaster › Jenis Linen › UPDATE.
export const laundryPermission = {
  module: "Laundry",
  subModules: [
    { name: "Stok & Par Level", allows: ["READ", "UPDATE"] },
    { name: "Penerimaan", allows: ["READ", "CREATE", "KONFIRMASI"] },
    { name: "Batch", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Permintaan Linen", allows: ["READ", "CREATE", "BATAL"] },
    { name: "Distribusi", allows: ["READ", "CREATE", "KONFIRMASI"] },
    { name: "Koreksi Stok", allows: ["READ", "CREATE"] },
    { name: "Datamaster", features: [{ name: "Jenis Linen", allows: ["READ", "CREATE", "UPDATE", "DELETE"] }] },
    { name: "Laporan Laundry", allows: ["READ", "CETAK LAPORAN"] },
    { name: "Unit Linen", allows: ["READ", "CREATE", "UPDATE", "CETAK LABEL"] },
    { name: "Pemindaian Unit", allows: ["READ"] },
    { name: "Koreksi Unit", allows: ["READ", "UPDATE"] },
    { name: "Laporan Unit", allows: ["READ", "CETAK LAPORAN"] },
  ],
};

// UTD / UPTD Produksi Darah (penunjang-service). "Lihat Hasil Reaktif" dipisah dari IMLTD READ (KF-18): hasil reaktif
// & identitas donor terkait hanya tampil bagi peran yang diberi izin ini secara eksplisit.
export const utdPermission = {
  module: "UTD",
  subModules: [
    { name: "Donor", allows: ["READ", "CREATE", "UPDATE", "SELEKSI", "CETAK KARTU"] },
    { name: "Aftap", allows: ["READ", "CREATE"] },
    { name: "IMLTD", allows: ["READ", "INPUT HASIL", "PELEPASAN"] },
    { name: "Lihat Hasil Reaktif", allows: ["READ"] },
    { name: "Komponen", allows: ["READ", "CREATE"] },
    {
      name: "Distribusi",
      features: [
        { name: "Permintaan", allows: ["READ", "CREATE"] },
        { name: "Distribusi", allows: ["READ", "CREATE"] },
        { name: "Pemusnahan", allows: ["READ", "CREATE"] },
      ],
    },
    { name: "Laporan UTD", allows: ["READ", "CETAK LAPORAN"] },
  ],
};

export const bankDarahPermission = {
  module: "Bank Darah RS (BDRS)",
  subModules: [
    { name: "Permintaan Darah", allows: ["READ", "CREATE", "UPDATE", "LENGKAPI", "BATAL"] },
    { name: "Uji Silang Serasi", allows: ["READ", "CATAT PEMERIKSAAN", "CATAT CROSSMATCH", "OVERRIDE DARURAT"] },
    { name: "Stok & Penerimaan", allows: ["READ", "TERIMA KANTONG", "MUSNAHKAN", "KEMBALIKAN"] },
    { name: "Serah Terima", allows: ["READ", "KONFIRMASI PENYERAH", "KONFIRMASI PENERIMA"] },
    { name: "Pemantauan Transfusi", allows: ["READ", "CATAT TRANSFUSI", "LAPOR REAKSI"] },
    { name: "Pengaturan", allows: ["READ", "UPDATE"] },
    { name: "Datamaster", features: [{ name: "Komponen Darah", allows: ["READ", "CREATE", "UPDATE", "DELETE"] }] },
    {
      name: "Laporan BDRS",
      features: [
        { name: "Pemakaian Darah", allows: ["READ", "CETAK LAPORAN"] },
        { name: "Rasio Crossmatch-Transfusi", allows: ["READ", "CETAK LAPORAN"] },
        { name: "Hemovigilans", allows: ["READ", "CETAK LAPORAN"] },
      ],
    },
  ],
};

export const cssdPermission = {
  module: "CSSD",
  subModules: [
    { name: "Master Set & Mesin", allows: ["READ", "CREATE", "UPDATE", "DELETE", "CETAK LABEL"] },
    { name: "Penerimaan & Dekontaminasi", allows: ["READ", "CREATE"] },
    { name: "Siklus Sterilisasi", allows: ["READ", "CREATE", "UPDATE", "INPUT HASIL", "BOWIE DICK"] },
    { name: "Penyimpanan & Distribusi", allows: ["READ", "CREATE", "UPDATE", "KONFIRMASI", "UPDATE STATUS"] },
    { name: "Pemakaian Pasien", allows: ["READ", "CREATE"] },
    { name: "Recall", allows: ["READ", "TINDAK LANJUT"] },
    { name: "Laporan CSSD", allows: ["READ", "CETAK LAPORAN"] },
  ],
};

// Manajemen Ambulans (STD-0024, penunjang-service). "Catatan Pendamping" dipisah dari izin Perjalanan & Laporan:
// catatan pendamping adalah catatan perjalanan beraksesibilitas terbatas (KF-10), tidak tampil di laporan umum.
export const ambulansPermission = {
  module: "Manajemen Ambulans",
  subModules: [
    { name: "Permintaan", allows: ["READ", "CREATE", "BATAL"] },
    { name: "Penugasan", allows: ["READ", "CREATE", "BATAL"] },
    { name: "Perjalanan", allows: ["READ", "CATAT TAHAP", "SELESAIKAN"] },
    { name: "Catatan Pendamping", allows: ["READ"] },
    { name: "Armada", allows: ["READ", "CREATE", "UPDATE", "UBAH STATUS"] },
    { name: "Servis Armada", allows: ["READ", "CREATE"] },
    { name: "Kru & Jadwal Jaga", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
    { name: "Tarif", allows: ["READ", "CREATE", "UPDATE"] },
    { name: "Biaya & Kuitansi", allows: ["READ", "TERUSKAN"] },
    { name: "Laporan Ambulans", allows: ["READ", "EKSPOR"] },
  ],
};

// Mutu & Akreditasi (penunjang-service /mutu). Submodul fitur Dokumen Akreditasi & Kredensial Staf (STD-0028); fitur mutu
// berikutnya (indikator mutu, IKP, PPI) menambah submodul baru di modul yang sama. "Akses Surveior" terpisah dari
// "Dokumen Akreditasi" › READ: surveior hanya membaca dokumen yang dibagikan & belum lewat batas waktunya.
// "Indikator Mutu" (STD-0025, fitur mutu_indikator): pengumpul data (INPUT DATA) dipisah dari validator (VALIDASI);
// TINDAK LANJUT = analisis & rencana perbaikan; EKSPOR = laporan capaian.
export const mutuPermission = {
  module: "Mutu & Akreditasi",
  subModules: [
    { name: "Dasbor Kesiapan", allows: ["READ"] },
    { name: "Instrumen Akreditasi", allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT"] },
    { name: "Dokumen Akreditasi", allows: ["READ", "CREATE", "UPDATE", "REVISI", "UBAH STATUS", "TINJAU", "PETAKAN ELEMEN", "BAGIKAN SURVEIOR", "DELETE"] },
    { name: "Kredensial Staf", allows: ["READ", "CREATE", "UPDATE", "VERIFIKASI", "CABUT", "DELETE"] },
    { name: "Akses Surveior", allows: ["READ"] },
    { name: "Indikator Mutu", allows: ["READ", "CREATE", "UPDATE", "DELETE", "INPUT DATA", "VALIDASI", "TINDAK LANJUT", "EKSPOR"] },
  ],
};

export const sarprasPermission = {
  module: "Sarana dan Prasarana (IPSRS)",
  subModules: [
    { name: "Aset", allows: ["READ", "CREATE", "UPDATE", "PINDAH LOKASI", "UBAH STATUS", "CETAK QR"] },
    { name: "Laporan Kerusakan", allows: ["READ", "CREATE", "TUGASKAN", "UPDATE STATUS", "TUTUP"] },
    { name: "Suku Cadang", allows: ["READ", "CATAT PEMAKAIAN"] },
    { name: "Pemeliharaan", allows: ["READ", "CREATE JADWAL", "UPDATE JADWAL", "NONAKTIFKAN JADWAL", "CATAT PELAKSANAAN"] },
    { name: "Kalibrasi", allows: ["READ", "CREATE", "UPDATE JADWAL", "UNGGAH SERTIFIKAT"] },
    { name: "Berkas", allows: ["READ"] },
    { name: "Utilitas", allows: ["READ", "CREATE"] },
    { name: "Laporan Sarpras", allows: ["READ", "EKSPOR"] },
    { name: "Pengaturan", allows: ["READ", "UPDATE"] },
  ],
};

// Unit Hemodialisa (STD-0033, penunjang-service/src/hemodialisa). Resep HD › SAHKAN untuk dokter; Sesi HD › KOREKSI
// untuk koreksi observasi/adekuasi beraudit; Datamaster › Mapping HDIS juga membuka koneksi HDIS (selain Setting).
export const hemodialisaPermission = {
  module: "Hemodialisa",
  subModules: [
    { name: "Registrasi & Jadwal", allows: ["READ", "CREATE", "UPDATE", "BATAL"] },
    { name: "Resep HD", allows: ["READ", "CREATE", "UPDATE", "SAHKAN"] },
    { name: "Sesi HD", allows: ["READ", "ASESMEN", "MULAI", "OBSERVASI", "TUTUP", "KOREKSI", "BATAL"] },
    { name: "Pemakaian BHP", allows: ["READ", "CREATE"] },
    { name: "Datamaster", features: [
      { name: "Mesin & Shift", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      { name: "Aturan Reuse Dializer", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
      { name: "Mapping HDIS", allows: ["READ", "CREATE", "UPDATE", "DELETE"] },
    ] },
    { name: "Laporan Hemodialisa", allows: ["READ", "CETAK LAPORAN"] },
  ],
};

// HR / SDM (STD-0035, penunjang-service /hr). Fase 1: kepegawaian & kredensial pegawai. Kredensial adalah data yang sama
// dengan Mutu & Akreditasi › Kredensial Staf (satu tabel), tetapi diatur izin modul ini. Submodul fase berikutnya
// (jadwal dinas, kehadiran/cuti, pelatihan, penggajian) ditambahkan bersama fiturnya agar Hak Akses tidak menjanjikan
// fitur yang belum ada.
export const sdmPermission = {
  module: "HR / SDM",
  subModules: [
    { name: "Kepegawaian", allows: ["READ", "CREATE", "UPDATE", "DELETE", "TAUTKAN AKUN"] },
    { name: "Kredensial", allows: ["READ", "CREATE", "UPDATE", "UNGGAH DOKUMEN", "VERIFIKASI", "CABUT", "DELETE"] },
  ],
};

export const trainingPermission = {
  module: "Training",
  subModules: [
    {
      name: "Daftar Kelas",
      allows: ["READ", "CREATE DAFTAR KELAS", "BATAL DAFTAR"],
    },
    {
      name: "Booking Kelas",
      allows: ["READ", "CREATE BOOKING", "UPDATE BOOKING", "BATAL BOOKING", "DAFTAR"],
    },
    {
      name: "Datamaster",
      features: [
        { name: "Kelas", allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT KELAS", "EKSPOR KELAS"] },
      ],
    },
    {
      name: "Laporan",
      allows: ["READ"],
    },
  ],
};

export const pembayaranPermission = {
  module: "Pembayaran",
  subModules: [
    {
      name: "Kasir",
      allows: ["READ", "OPEN KASIR", "BAYAR", "CETAK INVOICE", "CETAK RINCIAN BIAYA", "CLOSE HARIAN", "CLOSE BILL", "CLOSE KASIR"],
    },
    {
      name: "Transaksi",
      allows: ["READ", "CETAK INVOICE", "CETAK RINCIAN BIAYA"],
    },
    {
      name: "Closed Bill",
      allows: ["READ", "LUNASKAN"],
    },
    {
      name: "Laporan Pembayaran",
      features: [
        {
          name: "Kunjungan",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          name: "Closing Kasir",
          allows: ["READ", "CETAK LAPORAN"],
        },
      ],
    },
  ],
};

export const stokPermission = {
  module: "STOK",
  subModules: [
    {
      name: "Permintaan Barang",
      features: [
        {
          name: "Permintaan Unit",
          allows: ["READ", "CREATE PERMINTAAN", "CREATE ITEM", "CREATE ITEM MULTIPLE", "DELETE ITEM MULTIPLE", "DELETE SEMUA", "AMBIL ITEM", "BATAL PERMINTAAN"],
        },
      ],
    },
    {
      name: "Pengeluaran Barang",
      features: [
        {
          name: "Verifikasi dan Pengiriman Unit",
          allows: ["READ", "TOLAK PERMINTAAN", "VERIFIKASI", "CETAK", "KIRIM BARANG"],
        },
        {
          name: "Pengeluaran Unit",
          allows: ["READ", "CREATE PENGELUARAN", "CREATE ITEM", "CREATE ITEM MULTIPLE", "DELETE ITEM PENGELUARAN", "DELETE ITEM MULTIPLE", "DELETE SEMUA", "AMBIL ITEM", "CETAK"],
        },
        {
          name: "Retur Unit",
          allows: ["READ", "CREATE RETUR", "CREATE ITEM", "CREATE ITEM MULTIPLE", "DELETE ITEM RETUR"],
        },
      ],
    },
    {
      name: "Penerimaan Barang",
      features: [
        {
          name: "Penerimaan Unit",
          allows: ["READ"],
        },
        {
          name: "Penerimaan Retur Unit",
          allows: ["READ"],
        },
      ],
    },
    {
      name: "Kartu Stok dan Mutasi",
      allows: ["READ", "CETAK KARTU STOK DAN MUTASI"],
    },
    {
      name: "Stok Opname",
      allows: [
        "READ",
        "CREATE STOK OPNAME",
        "DELETE ITEM STOK OPNAME",
        "REKONISIL DARI MATER ITEM",
        "REKONISIL DARI STOK ITEM",
        "SIMPAN DRAFT",
        "SIMPAN DAN AKHIRI SO",
        "DOWNLOAD LEMBAR KERJA",
        "IMPORT EXCEL",
        "CETAK",
      ],
    },
    {
      name: "Stok Adjustment",
      allows: ["READ", "ADJUSTMENT", "ADJUST"],
    },
  ],
};

export const inventoryPermission = {
  module: "Inventory",
  subModules: [
    {
      name: "Pengadaan Barang",
      features: [
        {
          name: "Verifikasi Pembelian Barang Supplier",
          allows: ["READ", "CREATE PEMBELIAN", "CREATE ITEM PEMBELIAN", "UPDATE PEMBELIAN", "DELETE ITEM PEMBELIAN", "CARI MULTIPLE", "SIMPAN PEMBELIAN", "AMBIL ITEM", "BATALKAN PEMBELIAN"],
        },
      ],
    },
    {
      name: "Verifikasi Pembelian Barang Supplier",
      allows: ["READ", "VERIFIKASI"],
    },
    {
      name: "Retur dan Penggantian Supplier",
      allows: ["READ", "CREATE RETUR", "CREATE ITEM RETUR", "DELETE ITEM RETUR", "CARI DAN PILIH FAKTUR", "CARI MULTIPLE", "SIMPAN DAN TERIMA PENGGANTIAN", "AMBIL ITEM", "SIMPAN DAN PROSES RETUR"],
    },
    {
      name: "Pengeluaran Barang",
      features: [
        {
          name: "Verifikasi dan Penerimaan Barang Unit",
          allows: ["READ", "CETAK", "TOLAK PERMINTAAN", "VERIFIKASI", "KIRIM BARANG"],
        },
        {
          name: "Pengeluaran Barang Unit",
          allows: ["READ", "CREATE PENGELUARAN", "CREATE ITEM PENGELUARAN", "CETAK", "CARI MULTIPLE"],
        },
      ],
    },
    {
      name: "Penerimaan Barang",
      features: [
        {
          name: "Penerimaan Pembelian",
          allows: ["READ", "TERIMA PEMBELIAN"],
        },
        {
          name: "Penerimaan Retur Unit",
          allows: ["READ"],
        },
      ],
    },
    {
      name: "Datamaster Supplier",
      allows: ["READ", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Riwayat Tarif",
      allows: ["READ"],
    },
    {
      name: "Kartu Stok dan Mutasi",
      allows: ["READ", "CETAK"],
    },
    {
      name: "Stok Opname",
      allows: [
        "READ",
        "CREATE STOK OPNAME",
        "DELETE ITEM STOK OPNAME",
        "ACTION REKONISIL DARI MASTER ITEM",
        "ACTION REKONISIL DARI STOK ITEM",
        "SIMPAN DRAFT",
        "SIMPAN DAN AKHIR SO",
        "DOWNLOAD LEMBAR KERJA",
        "IMPORT EXCEL",
        "CETAK",
      ],
    },
    {
      name: "Stok Adjustment",
      allows: ["READ", "ADJUST", "ADJUST ITEM"],
    },
    {
      name: "Laporan Inventory",
      features: [
        {
          name: "Obat Expired",
          allows: ["READ", "CETAK LAPORAN"],
        },
        {
          allows: ["READ", "CETAK LAPORAN"],
          name: "Obat Expired",
        },
      ],
    },
    {
      // STD-0019 — Pembelian BMHP via marketplace mitra. Fitur katalog "inv_marketplace" (mati bawaan).
      name: "Pembelian Marketplace",
      allows: [
        "READ",
        "KONFIGURASI KONEKSI",
        "CARI PENAWARAN",
        "KELOLA PEMETAAN",
        "AJUKAN PERMINTAAN",
        "PERSETUJUAN",
        "CHECKOUT",
        "SINKRON STATUS",
        "LIHAT LAPORAN",
      ],
    },
  ],
};

export const datamasterPermission = {
  module: "Datamaster",
  subModules: [
    {
      name: "User",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Role",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Pegawai",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Praktisioner",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "DETAIL DATA PRAKSTISI", "IMPORT", "EXPORT"],
    },
    {
      name: "Ruangan",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Kategori Ruangan",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Diagnosis ICD-10",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "ICD-9 CM",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Snomed-CT",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "LOINC",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Tindakan",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Tarif",
      allows: [
        "READ",
        "CREATE TARIF",
        "CREATE TINDAKAN",
        "CREATE KOMPONEN TARIF",
        "CREATE JENIS PEMBAYARAN",
        "UPDATE TARIF",
        "DELETE TARIF",
        "DELETE TINDAKAN",
        "DELETE KOMPONEN TARIF",
        "DELETE JENIS PEMERIKSAAN",
        "IMPORT",
        "EXPORT",
      ],
    },
    {
      name: "Komponen Tarif",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Faskes",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Organisasi",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Lokasi",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Penjamin",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Voucher",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "General Consent",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Gigi FDI",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Kategori Gigi",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Item Gigi",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
    {
      name: "Oklusi",
      allows: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORT", "EXPORT"],
    },
  ],
};

export const laporanPermission = {
  module: "Laporan",
  subModules: [
    {
      name: "Jumlah Kunjungan Berdasarkan Status Rawat",
      allows: ["READ", "CETAK LAPORAN"],
    },
    {
      name: "Rekapitulasi Tindakan",
      allows: ["READ", "CETAK LAPORAN"],
    },
    {
      name: "Rekapitulasi Pemeriksaan Lab",
      allows: ["READ", "CETAK LAPORAN"],
    },
    {
      name: "Rekapitulasi Pendapatan Fisioterapi",
      allows: ["READ", "CETAK LAPORAN"],
    },
    {
      name: "Rekapitulasi Pendapatan",
      allows: ["READ", "CETAK LAPORAN"],
    },
    {
      name: "Rekapitulasi Diagnosis berdasarkan Umur Pasien",
      allows: ["READ", "CETAK LAPORAN"],
    },
  ],
};

export const settingPermission = {
  module: "Setting",
  subModules: [
    {
      name: "Profile Faskes",
      allows: ["READ", "UPDATE PROFILE", "UPDATE LOGO DAN WARNA"],
    },
    {
      name: "Konfigurasi Integrasi",
      allows: ["READ", "UPDATE KONFIGURASI VCLAIM", "UPDATE KONFIGURASI SATUSEHAT", "UPDATE KONFIGURASI LAINNYA"],
    },
    {
      name: "Print Out",
      allows: ["READ", "UPDATE PRINT OUT", "DELETE GAMBAR", "CARI FILE"],
    },
    {
      name: "System",
      allows: ["READ", "UPDATE PPN"],
    },
    {
      name: "Profile Saya",
      allows: ["READ", "UPDATE FOTO PROFILE DAN NAMA LENGKAP", "UPDATE USERNAME DAN PASSWORD"],
    },
    // Audit Trail terpusat (STD-0029): tidak diberikan otomatis ke peran faskes mana pun — hanya superadmin lewat
    // migrasi database/migrations/20261018000001-izin_audit_trail_setting.cjs. Admin faskes lain diberi manual.
    {
      name: "Audit Trail",
      allows: ["LIHAT", "EKSPOR"],
    },
  ],
};

export const profilePermission = {
  module: "Setting",
  subModules: [
    {
      name: "Profile Saya",
      allows: ["READ", "UPDATE FOTO PROFILE DAN NAMA LENGKAP", "UPDATE USERNAME DAN PASSWORD"],
    },
  ],
};

export const dashboardPermission = {
  module: "Dashboard",
  subModules: [],
};

// Dashboard Eksekutif (STD-0034, laporan-service): indikator layanan, keuangan, mutu & SDM untuk pimpinan. Modul sama
// dengan dashboardPermission (digabung di katalog izin) tetapi objek terpisah agar seeder peran yang memberi
// dashboardPermission tidak ikut memberi akses eksekutif. Aksi dipisah: lihat agregat, rincian, ekspor PDF, atur target.
export const dashboardEksekutifPermission = {
  module: "Dashboard",
  subModules: [{ name: "Eksekutif", allows: ["READ", "RINCIAN", "EKSPOR PDF", "ATUR TARGET"] }],
};

/**
 *
 * @param {Array<string>} permissionList
 * @returns {Array<Object>} permissions
 */
// SIMRS Studio (mode pengembang berbasis AI, studio-service). Tidak pernah diberikan otomatis ke peran faskes:
// superadmin memberikannya per peran (Pengusul, Product, Reviewer klinis, Programmer, QA, Maintainer rilis).
export const simrsStudioPermission = {
  module: "SIMRS Studio",
  subModules: [
    { name: "Permintaan", allows: ["READ", "CREATE", "UPDATE", "TRIASE", "SETUJUI USECASE", "BATAL"] },
    { name: "PRD", allows: ["READ", "UPDATE", "SETUJUI", "TETAPKAN RISIKO"] },
    { name: "Review Klinis", allows: ["READ", "SETUJUI"] },
    { name: "Desain", allows: ["READ", "UPDATE", "SETUJUI"] },
    { name: "Coding", allows: ["READ", "JALANKAN AGEN", "REVIEW", "BUKA PR"] },
    { name: "QA", allows: ["READ", "UPDATE", "JALANKAN UJI", "LULUS"] },
    { name: "Rilis", allows: ["READ", "SIAPKAN", "DEPLOY"] },
    { name: "Ekstensi", allows: ["READ", "CREATE", "PASANG", "COPOT"] },
    { name: "Audit", allows: ["READ", "EKSPOR"] },
  ],
};

export function mapPermission(permissionList) {
  const permissions = [];
  const lowerCasePermissionList = permissionList.map((prms) => prms.toLowerCase());
  const cleanedPermissionList = removeLeadingSpaces(lowerCasePermissionList);

  const permissionMap = {
    antrian: antrianPermission,
    admisi: admisiPermission,
    "rawat jalan": rawatJalanPermission,
    "rawat inap": rawatInapPermission,
    icu: icuPermission,
    igd: igdPermission,
    farmasi: farmasiPermission,
    laboratorium: laboraturiumPermission,
    fisioterapi: fisioTerapiPermission,
    radiologi: radiologiPermission,
    mcu: mcuPermission,
    "program puskesmas": programPuskesmasPermission,
    "patologi anatomi": patologiAnatomiPermission,
    mikrobiologi: mikrobiologiPermission,
    "koding rekam medis": kodingRmPermission,
    "kamar operasi": kamarOperasiPermission,
    gizi: giziPermission,
    laundry: laundryPermission,
    utd: utdPermission,
    "bank darah rs (bdrs)": bankDarahPermission,
    cssd: cssdPermission,
    "manajemen ambulans": ambulansPermission,
    "mutu & akreditasi": mutuPermission,
    "hr / sdm": sdmPermission,
    "sarana dan prasarana (ipsrs)": sarprasPermission,
    hemodialisa: hemodialisaPermission,
    training: trainingPermission,
    pembayaran: pembayaranPermission,
    stok: stokPermission,
    inventory: inventoryPermission,
    datamaster: datamasterPermission,
    dashboard: dashboardPermission,
    "dashboard eksekutif": dashboardEksekutifPermission,
    setting: settingPermission,
    profile: profilePermission,
    laporan: laporanPermission,
    "simrs studio": simrsStudioPermission,
  };

  cleanedPermissionList.forEach((permission) => {
    if (permissionMap.hasOwnProperty(permission)) {
      permissions.push(permissionMap[permission]);
    }
  });

  return permissions;
}

/**
 * Removes leading spaces from each element in the array.
 * @param {Array<Array<string>>} arrayOfArrays
 * @returns {Array<Array<string>>}
 */
export function removeLeadingSpaces(arrayOfArrays) {
  return arrayOfArrays.map((innerArray) => innerArray.trimStart());
}


/**
 * 
 * @param {Array<string>} role 
 * @param {Array<string>} targetRole 
 */
export function checkRole(role, targetRole) {
  role.forEach((r) => {
    if (!targetRole.includes(r)) {
      throw new HttpException(
        generateErrorMessage(
          'Gagal', "invalid", `Role ${r} tidak ada dalam daftar role yang tersedia.`
        ), HttpStatus.BAD_REQUEST
      )
    }
  });
}
