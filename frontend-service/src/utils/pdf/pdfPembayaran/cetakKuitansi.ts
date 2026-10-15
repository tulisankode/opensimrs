import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { customVfs } from "@/utils/customVfs";
import { convertImageToBase64, epochToDate, generateQRCode, formatPrice, numberToWords } from "@/utils/Helpers";
import { defaultHeader } from "../HeaderPrint";
import { barisRincianPotongan, hitungRincianPotongan } from "./rincianPotongan";
import logoUrl from "@/assets/images/opensimrs-square.png";
import lunasStampUrl from "@/assets/images/Pembayaran/lunas-stamp.png";
import belumLunasStampUrl from "@/assets/images/Pembayaran/belumlunas-stamp2.png";

pdfMake.vfs = customVfs.pdfMake.vfs;
pdfMake.fonts = {
    Arial: {
        normal: "Arial.ttf",
        bold: "Arial_Bold.ttf",
        italics: "Arial_Italic.ttf",
        bolditalics: "Arial_Bold_Italic.ttf",
    },
};

//mapping data
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

export async function createInvoicePdf({ detailBill, paymentResult }: { detailBill: any, paymentResult?: any }) {
    try {
        const faskesProfile = JSON.parse(
            localStorage.getItem("faskes_profile") ?? "{}"
        );

        let logo = await convertImageToBase64(logoUrl);
        if (faskesProfile.logo && faskesProfile.logo.startsWith('data:image')) {
            logo = faskesProfile.logo;
        }
        const lunasStampBase64 = await convertImageToBase64(lunasStampUrl);
        // const belumLunasStampBase64 = await convertImageToBase64(belumLunasStampUrl);

        const safeBill = detailBill?.bill || detailBill || {};
        const safePatient = detailBill?.patient || safeBill;
        const safePayment = paymentResult || {};

        const paymentMethodRaw = safeBill.paymentMethod || safePayment.paymentMethod || 'CASH'; // Ambil data dari detail tagihan, fallback ke CASH
        const paymentMethodDisplay = paymentMethodMap[paymentMethodRaw] || paymentMethodRaw;

        const kasirName = safePayment.cashierName || (Array.isArray(safeBill.cashierName) ? safeBill.cashierName.join(', ') : '-');

        const totalDiterima = safeBill.totalPaid || 0;
        const terbilangDiterima = totalDiterima > 0 ? numberToWords(totalDiterima).trim() + ' Rupiah' : '-';
        const qrCodePasien = await generateQRCode(safeBill.patientName || 'Pasien');
        const qrCodeKasir = await generateQRCode(kasirName || 'Kasir');

        //logic payment method / penjamin
        const normalizedPaymentType = (safeBill.paymentType || '').toUpperCase();

        const patientInfoBody = [
            ['No. RM', { text: `: ${safePatient.noRm || safeBill.noRm || '-'}`, bold: true }],
            ['Nama Pasien', { text: `: ${safeBill.patientName || '-'}`, bold: true }],
            ['Alamat', { text: `: ${safeBill.alamat || '-'}`, bold: true }],
            ['No. Kuitansi', { text: `: ${safePatient.receiptNumber || safeBill.receiptNumber || '-'}`, bold: true }],
            ['Cara Bayar', { text: `: ${normalizedPaymentType === 'CASH' || normalizedPaymentType === 'TUNAI' ? 'Tunai' : 'Asuransi'}`, bold: true }],
        ];

        if (normalizedPaymentType === 'INSURANCE' || normalizedPaymentType === 'ASURANSI') {
            // Jika Asuransi, tambahkan baris "Penjamin"
            patientInfoBody.push(['Penjamin', { text: ': -', bold: true }]);
        } else {
            // Terjemahkan
            patientInfoBody.push(['Metode Pembayaran', { text: `: ${paymentMethodDisplay}`, bold: true }]);
        }

        const docDefinition: TDocumentDefinitions = {
            pageSize: 'A4',
            pageMargins: [40, 110, 40, 60],
            defaultStyle: { font: 'Arial', fontSize: 9, lineHeight: 1.1 },

            header: defaultHeader("invoice", "KUITANSI", logo, faskesProfile, { invoiceCode: safeBill.invoiceCode || '-' }),
            content: [

                //Biodata Pasien
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
                                    ['No.Registrasi', { text: `: ${safeBill.noReg || '-'}`, bold: true }],
                                    ['Pelayanan', { text: `: ${reversePoliMapping[safeBill.serviceBill && safeBill.serviceBill[0]?.type] || (safeBill.serviceBill && safeBill.serviceBill[0]?.type) || '-'}`, bold: true }],
                                    ['Tgl.Kunjungan', { text: `: ${safeBill.visitDate ? epochToDate(safeBill.visitDate, "date") : '-'}`, bold: true }],
                                    ['Tgl.Discharge', { text: `: ${safeBill.dischargeDate ? epochToDate(safeBill.dischargeDate, "date") : '-'}`, bold: true }]
                                ]
                            }
                        }
                    ],
                    margin: [0, 0, 0, 5]
                },

                {
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5 }],
                    margin: [0, 5, 0, 5],
                    fillColor: '#EEEEEE',
                },

                //Kuitansi Pembayaran 
                // {
                //     table: {
                //         widths: ['*'],
                //         body: [
                //             [{ text: 'KUITANSI PEMBAYARAN', bold: true, fillColor: '#EEEEEE', margin: [5, 2] }]
                //         ]
                //     },
                //     layout: 'noBorders',
                //     margin: [0, 0, 0, 5]
                // },


                //  Pembayaran
                {
                    layout: 'noBorders',
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Keterangan', style: 'tableHeader' },
                                { text: 'Diterima', style: 'tableHeader', alignment: 'right' },
                                { text: 'Digunakan', style: 'tableHeader', alignment: 'right' },
                                { text: 'Dikembalikan', style: 'tableHeader', alignment: 'right' },
                                { text: 'Nama Petugas', style: 'tableHeader', alignment: 'center' }
                            ],
                            [
                                { text: (safeBill.invoiceCode || '-'), alignment: 'left', margin: [5, 0] },
                                { text: `Rp ${(safeBill.totalPaid || 0).toLocaleString('id-ID')}`, alignment: 'right' },                                // Kolom DIGUNAKAN -> dari grandTotal
                                { text: `Rp ${(safeBill.grandTotal || 0).toLocaleString('id-ID')}`, alignment: 'right' },
                                { text: `Rp ${(safePayment.change || 0).toLocaleString('id-ID')}`, alignment: 'right' },
                                { text: kasirName, alignment: 'center' }
                            ]
                        ]
                    }
                },

                // Rincian tagihan: subtotal, potongan voucher & diskon, total yang harus dibayar
                {
                    columns: [
                        { text: '', width: '*' },
                        {
                            width: 260,
                            layout: 'noBorders',
                            table: { widths: ['*', 'auto'], body: barisRincianPotongan(hitungRincianPotongan(safeBill)) },
                        },
                    ],
                    margin: [0, 8, 0, 0],
                },

                // Baris Terbilang Diterima
                {
                    layout: 'noBorders',
                    table: {
                        widths: ['*'],
                        body: [
                            [{
                                text: [
                                    { text: 'Terbilang Diterima :', bold: true },
                                    { text: ` ${terbilangDiterima}`, italics: true, bold: true }
                                ],
                                fillColor: '#EAECEF',
                                margin: [5, 5]
                            }]
                        ]
                    },
                    margin: [0, 10, 0, 0]
                },
                (safeBill.totalPaid >= safeBill.grandTotal && safeBill.grandTotal > 0)
                    ? {
                        image: lunasStampBase64,
                        width: 90,
                        opacity: 1,
                        alignment: 'right',
                        margin: [0, 20, 25, 20]
                    }
                    : { text: '', margin: [0, 150, 0, 0] },
                //QR code dan ttd
                {
                    columns: [
                        // KOLOM KIRI (PASIEN)
                        {
                            width: '*',
                            alignment: 'center',
                            stack: [
                                { text: 'Mengetahui', margin: [0, 10, 0, 0], bold: true },
                                { text: 'Pasien/Keluarga Pasien', margin: [0, 10, 0, 10], bold: true },
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
                                { text: 'Petugas', margin: [0, 10, 0, 10], bold: true },
                                { image: qrCodeKasir, width: 70, margin: [0, 5, 0, 5] },
                                { text: ` ${kasirName} `, bold: true, margin: [0, 0, 0, 10] },
                                { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 170, y2: 0, lineWidth: 0.5 }] },

                            ],
                        }
                    ],
                    margin: [0, 0, 0, 0]
                },

                //note
                {
                    margin: [0, 70, 0, 0],
                    ul: [
                        '*Nota ini harap dibawa saat pengambilan hasil pemeriksaan',
                        '*Pemeriksaan yang tidak dilakukan dalam 14 hari dianggap batal dan uang tidak bisa kembali'
                    ],
                    fontSize: 8,
                    italics: true,
                    bold: true
                }
            ],
            styles: {
                tableHeader: { bold: true, fillColor: '#EEEEEE', margin: [5, 2] }
            },
            // footer: {}
        };

        pdfMake.createPdf(docDefinition).open();

    } catch (error) {
        console.error("Gagal membuat PDF Invoice:", error);
    }
}