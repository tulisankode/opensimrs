import {UserModel} from "@opensimrs/model-sdk/datamaster";
import {hash} from "bcrypt";
import {Op} from "sequelize";

export default class UserSeeder {
    static async seed(transaction){
        await UserModel.findOrCreate({
            where: {
                [Op.and]: [
                    {
                        email: "pengguna4@contoh.id",
                    }
                ],
            },
            defaults: {
                uuid : "0192b31f-365d-731c-8b16-3a4565c9475e",
                roleUuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
                faskesUuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
                pegawaiUuid: '0192b31f-365d-731c-8b16-3a4565c9475e',
                phone: "080000000000",
                email: "pengguna4@contoh.id",
                username: "ojione-kenobi",
                permissions: [
                    {
                        module: "Antrian",
                        sub_module: [
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
                                allows: ["CREATE PATIEBT JKN", "CREATE PASIEN NON-JKN", "CHECKIN", "PRINT"],
                            },
                        ],
                    },
                    {
                        module: "Admisi",
                        sub_module: [
                            {
                                name: "Antrian",
                                allows: ["PANGGIL", "LEWATI", "PROSSES", "SELESAI", "CHECKIN"],
                            },
                            {
                                name: "RJ",
                                allows: ["READ", "CREATE PASIEN RJ", "CREATE GENERAL CONSENT", "UPDATE ADMISI RJ", "UPDATE GENERAl CONSENT", "CETAk KUNJUNGAN", "CETAK LABEL", "BATAL RJ"],
                            },
                            {
                                name: "RI",
                                allows: [
                                    "READ",
                                    "CREATE BAYI BARU LAHIR",
                                    "CREATE PASIEN RI",
                                    "CREATE GENERAL CONSENT",
                                    "UPDATE ADMISI RI",
                                    "UPDATE GENERAL CONSENT",
                                    "BATAL REQUEST RI",
                                    "CETAK GENERAL CONSENT",
                                    "CETAK KUNJUNGAN",
                                    "CETAK LABEL",
                                ],
                            },
                            {
                                name: "IGD",
                                allows: ["CREATE PASIEN IGD", "CREATE GENERAL CONSENT", "UPDATE ADMISI IGD", "UPDATE GENERAL CONSENT", "BATAL IGD", "CETAK GENERAL CONSENT", "CETAK KUNJUNGAN", "CETAK LABEL"],
                            },
                            {
                                name: "SEP",
                                allows: ["READ", "CREATE SEP", "CREATE SEP MANUAL", "DELETE", "SIMPAN SEP MANUAL"],
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
                                        name: "penjamin",
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
                    },
                    {
                        module: "Rawat Jalan",
                        sub_modules: [
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
                                        name: "Pembatalan Poli",
                                        allows: ["READ", "CETAK LAPORAN"],
                                    },
                                    {
                                        name: "rekap Pembatalan Pasien",
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
                                            "TUTUP SEMUA FORM",
                                            "BUKAN SEMUA FORM",
                                            "RIWAYAT",
                                            "SEMBUNYIKAN DETAIL PASIEN",
                                            "TAMPILKAN DETAIL PASIEN",
                                        ],
                                    },
                                    {
                                        name: "Asemen",
                                        allows: [
                                            "READ",
                                            "CETAK LABEL",
                                            "RIWAYAT",
                                            "SEMBUNYIKAN DETAIL PASIEN",
                                            "CREATE DIAGNOSIS",
                                            "DELETE DIAGNOSIS",
                                            "UPDATE CATATAN PERAWAT",
                                            "BALAS CATATAN PERAWAT",
                                            "KIRIM CATATAN",
                                            "KIRIM INTRUKSI",
                                            "CREATE TINDAKAN",
                                            "CREATE MULTIPLE TINDAKAN",
                                            "DELETE TINDAKAN",
                                        ],
                                    },
                                    {
                                        name: "SOAP",
                                        allows: [
                                            "READ",
                                            "CETAK LABEL",
                                            "RIWAYAT",
                                            "SEMBUNYIKAN DATA PASIEN",
                                            "TUTUP SEMUA FORM",
                                            "BUKA SEMUA FORM",
                                            "CREATE OBAT",
                                            "CREATE RACIKAN OBAT",
                                            "ITEM OBAT RACIKAN",
                                            "UPDATE OBAT",
                                            "DELETE OBAT",
                                            "DELETE ITEM OBAT RACIKAN",
                                        ],
                                    },
                                    {
                                        name: "Akses Dan Penunjang",
                                        allows: ["READ", "CREATE ALKES", "CREATE MULTIPLE ALKES", "DELETE LIST ALKES", "DELETE MULTIPLE ITEM ALKES", "DELETE SEMUA", "CREATE TINDAKAN", "DELETE LIST TINDAKAN"],
                                    },
                                    {
                                        name: "Inform Consent",
                                        allows: ["READ"],
                                    },
                                    {
                                        name: "Unggah Berkas",
                                        allows: ["READ", "UPDATE FILE", "DELETE FILE", ""],
                                    },
                                    {
                                        name: "Resume Dan Discarge",
                                        allows: ["READ"],
                                    },
                                    {
                                        name: "Cetak Hasil Dan Surat",
                                        allows: ["READ", "CREATE SURAT KETERANGAN", "DELETE SURAT KETERANGAN"],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        module: "Rawat Inap",
                        sub_modules: [
                            {
                                name: "Rawat Inap",
                                allows: ["READ"],
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
                                        allows: ["READ", "UPDATE PEMERIKSAAN FISIK", "UPDATE DERAJAT LUKA BAKAR", "UPDATE PEMERIKSAAN DAN TINDAKAN", "UPDATE REKAM MEDIS", "DELETE SESI", ""],
                                    },
                                    {
                                        name: "Asesmen",
                                        allows: [
                                            "READ",
                                            "CREATE DIAGNOSIS",
                                            "DELETE DIAGNOSIS",
                                            "UPDATE CATATAN PERAWAT",
                                            "BALAS CATATAN PERAWAT",
                                            "KIRIM CATATAN PERAWAT",
                                            "KIRIM INTERUKSI MEDIS",
                                            "CREATE MULTIPLE TINDAKAN",
                                            "DELETE TINDAKAN",
                                            "DELETE MULTIPLE TINDAKAN",
                                            "DELETE SEMUA",
                                        ],
                                    },
                                    {
                                        name: "SOAP Dokter",
                                        allows: ["READ", "CREATE OBAT", "CREATE RACIKAN", "UPDATE OBAT", "DELETE OBAT", "DELETE ITEM OBAT RACIKAN"],
                                    },
                                    {
                                        name: "Inform Consent",
                                        allows: ["READ"],
                                    },
                                    {
                                        name: "Inform Consent",
                                        allows: ["READ"],
                                    },
                                    {
                                        name: "Alkes Dan Penunjang",
                                        allows: ["CREATE ALKES", "CREATE MULTIPLE ALKES", "DELETE ALKES", "DELETE MULTIPLE ALKES", "DELETE SEMUA", "CREATE TINDAKAN", "DELETE TINDAKAN"],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        module: "IGD",
                        sub_modules: [],
                    },
                    {
                        module: "Farmasi",
                        sub_modules: [],
                    },
                    {
                        module: "Lab",
                        sub_modules: [],
                    },
                    {
                        module: "Fisioterapi",
                        sub_modules: [],
                    },
                    {
                        module: "Training",
                        sub_modules: [],
                    },
                    {
                        module: "Pembayaran",
                        sub_modules: [],
                    },
                    {
                        module: "Stok",
                        sub_modules: [],
                    },
                    {
                        module: "Inventory",
                        sub_modules: [],
                    },
                    {
                        module: "Datamaster",
                        sub_modules: [],
                    },
                    {
                        module: "Laporan",
                        sub_modules: [],
                    },
                    {
                        module: "Setting",
                        sub_modules: [],
                    },
                ].toString(),
                password: await hash("password123", 10),
                status: true,
            },
            transaction: transaction,
        });
    }
}