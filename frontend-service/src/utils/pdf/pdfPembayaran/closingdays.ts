import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { customVfs } from "@/utils/customVfs";
import { convertImageToBase64, epochToDate, generateQRCode, formatPrice } from "@/utils/Helpers";
import { defaultHeader } from "../HeaderPrint"; 
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


const lightLineRow = [{ colSpan: 2, canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.5, lineColor: '#cccccc' }] }, {}];

const formatTanggalShift = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: '2-digit'
    };
    
    const dateFormatter = new Intl.DateTimeFormat('id-ID', options);
    const datePart = dateFormatter.format(date);
    
    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false //format 24 jam
    });
    const timePart = timeFormatter.format(date).replace('.', ':'); 
    
    return `${datePart} ${timePart}`;
};

export async function createSlipTutupHarianPdf({ data }: { data: any }) {
    try {
        const faskesProfile = JSON.parse(
            localStorage.getItem("faskes_profile") ?? "{}"
        );
        
        let logo = await convertImageToBase64(logoUrl); 
        if (faskesProfile.logo && faskesProfile.logo.startsWith('data:image')) {
            logo = faskesProfile.logo;
        }

        const safeData = data || {};
        const qrCodeImage = await generateQRCode(safeData.cashierName || 'Nama Kasir');
        safeData.shift = Array.isArray(safeData.shift) ? safeData.shift : [];
        
        const shiftMapping: { [key: string]: string } = { "1": "Pagi", "2": "Siang", "3": "Malam" };
        
        // Kalkulasi Transaksi Total
        const transaksiNett = safeData.total || 0;
        const greyBg = '#EAECEF';
        
        const tableBody: TableCell[][] = [
            [
                { text: 'SHIFT', bold: true, fillColor: greyBg, margin: [5, 2] }, 
                { text: 'TUNAI', bold: true, alignment: 'right', fillColor: greyBg, margin: [5, 2] }, 
                { text: 'DEBIT/KREDIT', bold: true, alignment: 'right', fillColor: greyBg, margin: [5, 2] }, 
                { text: 'TRANSFER', bold: true, alignment: 'right', fillColor: greyBg, margin: [5, 2] }, 
                { text: 'SUBTOTAL', bold: true, alignment: 'right', fillColor: greyBg, margin: [5, 2] }
            ]
        ];

        safeData.shift.forEach((shiftItem: any) => {
            const subtotal = shiftItem.ballance || 0;
            tableBody.push([
                shiftMapping[shiftItem.shiftType] || 'N/A',
                { text: `Rp ${(shiftItem.cash || 0).toLocaleString ('id-ID')}`, alignment: 'right' },
                { text: `Rp ${(shiftItem.debitKredit || 0).toLocaleString ('id-ID')}`, alignment: 'right' },
                { text: `Rp ${(shiftItem.transfer || 0).toLocaleString ('id-ID')}`, alignment: 'right' },
                { text: `Rp ${(subtotal || 0).toLocaleString ('id-ID')}`, alignment: 'right' }
            ]);
        });

        const docDefinition: TDocumentDefinitions = {
            pageSize: 'A4',
            pageMargins: [40, 110, 40, 60],
            defaultStyle: { font: 'Arial', fontSize: 10, lineHeight: 1.2 },

            header: defaultHeader(safeData.shiftId || '-', "SLIP LAPORAN TUTUP HARIAN ", logo, faskesProfile, {}),
            content: [
                //  Informasi Tanggal
                {
                    layout: 'noBorders',
                    table: {
                        widths: ['auto', '*'],
                        body: [
                            ['Tanggal', { text: `: ${formatTanggalShift(safeData.timeClosed)}`, bold: true }],
                            ['Transaksi Pasien', { text: `: ${safeData.transactionTotal || 0} Transaksi`, bold: true }],
                        ]
                    },
                    margin: [0, 0, 0, 10]
                },

                // Garis Pembatas
                {
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#000000' }],
                    margin: [0, 5, 0, 5]
                },
                
                // Total Pendapatan Sistem
                {
                    layout: 'noBorders',
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            ['Total Transaksi', { text: `Rp ${(transaksiNett).toLocaleString ('id-ID') || 0}`, alignment: 'right',margin:[2,0] }],
                            lightLineRow,
                        ]
                    },
                    margin: [0, 0, 0, 30]
                },

                //  Rincian per Shift
                {
                    layout: 'lightHorizontalLines',
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                        body: tableBody
                    },
                    margin: [0, 0, 0, 15]
                },

                //  Total Penerimaan system
                {
                    layout: 'noBorders',
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            [{ text: 'TUNAI', margin: [2,0] }, { text: `Rp ${(safeData.cash || 0).toLocaleString ('id-ID')}`, alignment: 'right' ,margin:[2,0]}],
                            lightLineRow,
                            [{ text: 'DEBIT/KREDIT', margin: [2,0] }, { text: `Rp ${(safeData.debitKredit || 0).toLocaleString ('id-ID')}`, alignment: 'right',margin:[2,0] }],
                            lightLineRow,
                            [{ text: 'TRANSFER', margin: [2,0] }, { text: `Rp ${(safeData.transfer || 0).toLocaleString ('id-ID')}`, alignment: 'right',margin:[2,0] }],
                            [{ text: 'Total Pemasukan', bold: true, fillColor: greyBg, margin: [2,0] }, { text: `Rp ${(transaksiNett || 0).toLocaleString ('id-ID')}`, alignment: 'right', bold: true, fillColor: greyBg, margin: [2,0] }],
                        ]
                    }
                },

                { text: '', margin: [0, 100, 0, 0] },
                {
                    layout: 'noBorders',
                    table: {
                        widths: ['*', 'auto'], 
                        body: [
                            [
                                '', 
                                {
                                    stack: [
                                        { text: `${faskesProfile?.address?.city || 'Surabaya'} , ${epochToDate(Date.now() / 1000, "date")}`, margin: [0, 20, 0, 0] , bold:true },
                                        { text: 'Kasir', margin: [0, 10, 0, 0] , bold:true},
                                        { image: qrCodeImage, width: 60, margin: [0, 5, 0, 5] },
                                        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 0.5 }] },
                                        { text: safeData.cashierName, bold: true, margin: [0, 2, 0, 0] },
                                    ],
                                    alignment: 'center' 
                                }
                            ]
                        ]
                    }
                }                
            ],
            // footer: function (currentPage, pageCount) {
            //     return {
            //         margin: [40, 10, 40, 0],
            //         columns: [ ]
            //     };
            // },
        };

        pdfMake.createPdf(docDefinition).open();

    } catch (error) {
        console.error("Gagal membuat PDF Tutup Harian:", error);
    }
}