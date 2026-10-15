// File: utils/pdf/pdfPembayaran/cetakRincian.ts (BARU)

import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions, TableCell, Content } from "pdfmake/interfaces";
import { customVfs } from "@/utils/customVfs";
import { convertImageToBase64, epochToDate, generateQRCode, formatPrice, numberToWords } from "@/utils/Helpers";
import { defaultHeader } from "../HeaderPrint";
import { barisRincianPotongan, hitungRincianPotongan } from "./rincianPotongan";
import logoUrl from "@/assets/images/opensimrs-square.png";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
    Arial: {
        normal: "Arial.ttf",
        bold: "Arial_Bold.ttf",
        italics: "Arial_Italic.ttf",
        bolditalics: "Arial_Bold_Italic.ttf",
    },
};

const reversePoliMapping: { [key: string]: string } = {
    "RI": "RAWAT INAP",
    "RJ": "RAWAT JALAN",
    "IGD": "IGD",
    "APS": "APS",
    "OTC": "OTC"
};

const paymentMethodMap: { [key: string]: string } = {
    'DEBIT_KREDIT': 'Debit/Kredit',
    'TRANSFER': 'Transfer',
    'CASH': 'Cash'
};

export async function createRincianPdf({ detailBill, itemBill, paymentResult }: { detailBill: any, itemBill: any, paymentResult?: any }) {
    try {
        const faskesProfile = JSON.parse(
            localStorage.getItem("faskes_profile") ?? "{}"
        );

        let logo = await convertImageToBase64(logoUrl);
        if (faskesProfile.logo && faskesProfile.logo.startsWith('data:image')) {
            logo = faskesProfile.logo;
        }

        const safeBill = detailBill?.bill || detailBill || {};
        const safePatient = detailBill?.patient || safeBill;
        const safePayment = paymentResult || {};
        const safeItems = itemBill || {};
        const kasirName = safePayment.cashierName || (Array.isArray(safeBill.cashierName) ? safeBill.cashierName.join(', ') : '-');
        const qrCodePasien = await generateQRCode(safeBill.patientName || 'Pasien');
        const qrCodeKasir = await generateQRCode(kasirName || 'Kasir');

        const paymentMethodRaw = safeBill.paymentMethod || safePayment.paymentMethod || 'CASH'; 
        const paymentMethodDisplay = paymentMethodMap[paymentMethodRaw] || paymentMethodRaw;


        const totalDiterima = safeBill.totalPaid || 0;
        const total = safeBill.grandTotal || 0;
        const terbilangDiterima = totalDiterima > 0 ? numberToWords(totalDiterima).trim() + ' Rupiah' : '-';
        const terbilangTotal = total > 0 ? numberToWords(total).trim() + ' Rupiah' : '-';

        const rincianContent: Content[] = [];
        const itemData = safeItems.item || {};
        // API item mengirim `date` (DD/MM/YYYY) & `total`; `dateUsed`/`serviceFee` hanya ada pada data lama.
        const tglItem = (item: any) =>
            item.date ? String(item.date).replace(/\//g, '-') : item.dateUsed ? epochToDate(item.dateUsed, "date") : '-';
        const rp = (n: any) => `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;
        const totalItem = (item: any) =>
            item.total ?? (Number(item.price) || 0) * (Number(item.qty) || 0) + (Number(item.serviceFee) || 0);

        //logika paymentmethod/penjamin
        const normalizedPaymentType = (safeBill.paymentType || '').toUpperCase();

        const patientInfoBody = [
            ['No. RM', { text: `: ${safeBill.noRm || '-'}`, bold: true }],
            ['No. Invoice', { text: `: ${safeBill.invoiceCode || '-'}`, bold: true }], 
            ['Nama Pasien', { text: `: ${safeBill.patientName || '-'}`, bold: true }],
            ['Alamat', { text: `: ${safeBill.alamat || '-'}`, bold: true }],
            ['Cara Bayar', { text: `: ${normalizedPaymentType === 'CASH' || normalizedPaymentType === 'TUNAI' ? 'Tunai' : 'Asuransi'}`, bold: true }],
        ];
        // Cek tipe pembayaran untuk menentukan baris selanjutnya
        if (normalizedPaymentType === 'INSURANCE' || normalizedPaymentType === 'ASURANSI') {
            patientInfoBody.push(['Penjamin', { text: ': -', bold: true }]);
        } else {
             patientInfoBody.push(['Metode Pembayaran', { text: `: ${paymentMethodDisplay}`, bold: true }]);
        }

        // Helper function untuk membuat tabel per kategori
        const createCategoryTable = (title: string, items: any[], columns: string[], dataMapping: (item: any, index: number) => any[]) => {
            if (!items || items.length === 0) return;
            const widths = Array(columns.length).fill('*');
            // Judul Kategori
            rincianContent.push({
                table: {
                    widths: ['*'],
                    body: [[{ text: title, bold: true, color: 'black', fillColor: '#EEEEEE', margin: [5, 2] }]] // Warna hijau
                },
                layout: 'noBorders',
                margin: [0, 10, 0, 5]
            });

            // Tabel Rincian
            rincianContent.push({
                layout: 'lightHorizontalLines',
                table: {
                    headerRows: 1,
                    widths,
                    body: [
                        columns.map(h => ({ text: h, style: 'tableHeader' })),
                        ...items.map(dataMapping)
                    ],
                },
            });
        };

        // Tabel Tindakan
        createCategoryTable(
            'BIAYA RAWAT JALAN',
            itemData.tindakan?.list,
            ['Tanggal', 'Biaya Tindakan', 'Petugas', 'Jml', 'Tarif', 'Potongan', 'Total'],
            (item, index) => [
                tglItem(item),
                item.itemName || '-',
                safeBill.serviceBill?.[0]?.practitionerName || '-',
                item.qty,
                { text: `Rp ${(item.price?.toLocaleString('id-ID') || 0)}`, alignment: 'left' },
                { text: rp(item.serviceFee), alignment: 'left' },
                { text: rp(totalItem(item)), alignment: 'left' }
            ]
        );

        // Tabel Penunjang 
        createCategoryTable(
            'BIAYA PENUNJANG MEDIS DAN LAIN-LAIN',
            itemData.penunjang?.list,
            ['Tanggal', 'Biaya Lab', 'Petugas', 'Jml', 'Tarif', 'Total'],
            (item, index) => [
                tglItem(item),
                item.itemName || '-',
                safeBill.serviceBill?.[0]?.practitionerName || '-',
                item.qty,
                { text: `Rp ${(item.price?.toLocaleString('id-ID') || 0)}`, alignment: 'left' },
                { text: rp(totalItem(item)), alignment: 'left' }
            ]
        );

        // Tabel Alkes
        createCategoryTable(
            'BIAYA ALAT KESEHATAN (ALKES)',
            itemData.alkes?.list,
            ['Tanggal', 'Nama Barang', 'Petugas', 'Jml', 'Tarif', 'Total'],
            (item, index) => [
                tglItem(item),
                item.itemName || '-',
                safeBill.serviceBill?.[0]?.practitionerName || '-',
                item.qty,
                { text: `Rp ${(item.price?.toLocaleString('id-ID') || 0)}`, alignment: 'left' },
                { text: rp(totalItem(item)), alignment: 'left' }
            ]
        );

        // Tabel Obat
        createCategoryTable(
            'BIAYA OBAT ',
            itemData.obat?.list,
            ['Tanggal', 'Nama Obat', 'Petugas', 'Jml', 'Tarif', 'Total'],
            (item, index) => [
                tglItem(item),
                item.itemName || '-',
                safeBill.serviceBill?.[0]?.practitionerName || '-',
                item.qty,
                { text: `Rp ${(item.price?.toLocaleString('id-ID') || 0)}`, alignment: 'left' },
                { text: rp(totalItem(item)), alignment: 'left' }
            ]
        );

        // Tabel Kamar
        createCategoryTable(
            'BIAYA RAWAT INAP',
            itemData.ruangan?.list,
            ['Tanggal', 'Nama Ruangan', 'Petugas', 'Jml', 'Tarif', 'Total'],
            (item, index) => [
                tglItem(item),
                item.itemName || '-',
                safeBill.serviceBill?.[0]?.practitionerName || '-',
                item.qty,
                { text: `Rp ${(item.price?.toLocaleString('id-ID') || 0)}`, alignment: 'left' },
                { text: rp(totalItem(item)), alignment: 'left' }
            ]
        );

        const docDefinition: TDocumentDefinitions = {
            pageSize: 'A4',
            pageMargins: [40, 110, 40, 60],
            defaultStyle: { font: 'Arial', fontSize: 9, lineHeight: 1.1 },

            header: defaultHeader("invoice", "TAGIHAN PEMBAYARAN ", logo, faskesProfile, { grandTotal: safeBill.grandTotal || safeBill.invoice_code || '-' }),
            content: [
                {
                    columns: [
                        {
                            layout: 'noBorders',
                            table: {
                                widths: ['auto', '*'],
                                body: patientInfoBody 
                            }
                        },
                        {
                            layout: 'noBorders',
                            table: {
                                widths: ['auto', '*'],
                                body: [
                                    ['No. Registrasi', { text: `: ${safeBill.noReg || '-'}`, bold: true }],//ini nomer reg
                                    ['Pelayanan', { text: `: ${reversePoliMapping[safeBill.serviceBill && safeBill.serviceBill[0]?.type] || (safeBill.serviceBill && safeBill.serviceBill[0]?.type) || '-'}`, bold: true }],
                                    ['Tgl. Kunjungan', { text: `: ${safeBill.visitDate ? epochToDate(safeBill.visitDate, "date") : '-'}`, bold: true }],
                                    ['Tgl. Discharge', { text: `: ${safeBill.dischargeDate ? epochToDate(safeBill.dischargeDate, "date") : '-'}`, bold: true }],
                                    ['Tgl. Tagihan', { text: `: ${epochToDate(Date.now() / 1000, "date")}`, bold: true }],
                                ]
                            }
                        }
                    ],
                    margin: [0, 0, 0, 10]
                },
                ...rincianContent,

                {
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, dash: { length: 2, space: 2 } }],
                    margin: [0, 10, 0, 5],
                    fillColor: '#EAECEF',
                },

                //Detail Tagihan
                {
                    layout: 'noBorders',
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            // Subtotal, biaya admin/PPN, potongan voucher & diskon, total tagihan (rumus sama dengan server)
                            ...barisRincianPotongan(hitungRincianPotongan(safeBill)),
                            [{ text: 'Pembayaran Diterima', margin: [5, 2], bold: true }, { text: `Rp ${(safeBill.totalPaid || 0)?.toLocaleString('id-ID')}`, alignment: 'right', bold: true, margin: [5, 2] }],
                            [{ text: 'Sisa pembayaran ',bold:true, margin: [5, 2] }, { text: `Rp ${(safeBill.remainingDebt || 0)?.toLocaleString('id-ID')}`, alignment: 'right', margin: [5, 2], bold: true }],
                        ]
                    },
                    margin: [0, 5, 0, 2]
                },

                // Baris Terbilang
                {
                    layout: 'noBorders',
                    table: {
                        widths: ['*'],
                        body: [
                            [{
                                text: [{ text: 'Terbilang :',fontSize: 12, bold: true }, { text: `${terbilangDiterima}`, italics: true, bold: true,fontSize:12, }],
                                fillColor: '#EAECEF',
                                margin: [5, 5]
                            }]
                        ]
                    }
                },
                { text: '', margin: [0, 40, 0, 0] },

                // Baris Terbilang Diterima
                // {
                //     layout: 'noBorders',
                //     table: {
                //         widths: ['*'],
                //         body: [
                //             [{
                //                 text: [
                //                     { text: 'Terbilang Diterima :', bold: true },
                //                     { text: ` ${terbilangDiterima}`, italics: true, bold: true }
                //                 ],
                //                 fillColor: '#EAECEF',
                //                 margin: [5, 5]
                //             }]
                //         ]
                //     },
                //     margin: [0, 0, 0, 0]
                // },
                // { text: '', margin: [0, 20, 0, 0] },
                //QR code dan ttd
                {
                    columns: [
                        // KOLOM KIRI (PASIEN)
                        {
                            width: '*',
                            alignment: 'center',
                            stack: [
                                { text: 'Mengetahui', margin: [0, 10, 0, 0], bold: true },
                                { text: 'Pasien/Keluarga Pasien', margin: [0, 0, 0, 10], bold: true },
                                { image: qrCodePasien, width: 70, margin: [0, 5, 0, 5] },
                                { text: ` ${safeBill.patientName || 'Nama Pasien'} `, bold: true, margin: [0, 0, 0, 10] },
                                { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 170, y2: 0, lineWidth: 0.5 }] },

                            ]
                        },
                        // KOLOM KANAN (KASIR)
                        {
                            width: '*',
                            alignment: 'center',
                            stack: [
                                { text: `${faskesProfile?.address?.city || 'Surabaya'}, ${epochToDate(Date.now() / 1000, "date")}`, margin: [0, 10, 0, 0], bold: true },
                                { text: 'Petugas', margin: [0, 0, 0, 10], bold: true },
                                { image: qrCodeKasir, width: 70, margin: [0, 5, 0, 5] },
                                { text: ` ${kasirName} `, bold: true, margin: [0, 0, 0, 10] },
                                { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 170, y2: 0, lineWidth: 0.5 }] },

                            ],
                        }
                    ],
                    margin: [0, 0, 0, 0]
                },
            ],
            styles: {
                tableHeader: { bold: true, fillColor: '#EEEEEE' }
            },
            // footer: {}
        };

        pdfMake.createPdf(docDefinition).open();

    } catch (error) {
        console.error("Gagal membuat PDF Rincian:", error);
    }
}