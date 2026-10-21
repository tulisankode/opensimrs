import pdfMake from "pdfmake/build/pdfmake";
import type {
  PageOrientation,
  PageSize,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import { customVfs } from "../customVfs";
import { convertImageToBase64, epochToDate, generateQRCode } from "../Helpers";
import { defaultHeader } from "./HeaderPrint";
import logoUrl from "@/assets/images/opensimrs-square.png";

const listTorusPalatinus = [
  { code: "OV000074", tampilan: "Tidak Ada" },
  { code: "OV000075", tampilan: "Kecil" },
  { code: "OV000076", tampilan: "Sedang" },
  { code: "OV000077", tampilan: "Besar" },
  { code: "OV000078", tampilan: "Multiple" },
];
const listTorusMandibularis = [
  { code: "OV000079", tampilan: "Tidak Ada" },
  { code: "OV000080", tampilan: "Sisi Kiri" },
  { code: "OV000081", tampilan: "Sisi Kanan" },
  { code: "OV000082", tampilan: "Kedua Sisi" },
];
const listPalatum = [
  { code: "OV000083", tampilan: "Dalam" },
  { code: "OV000084", tampilan: "Sedang" },
  { code: "OV000085", tampilan: "Rendah" },
];

const getLabel = (list: any[], code: string, defaultVal: string) => {
  const item = list.find((i) => i.code === code);
  return item ? item.tampilan : defaultVal || "-";
};

export async function createLaporanOdontogram({
  data,
  patientData,
  odontogramImage,
  odontogramItems,
  page = "A4",
  orientation = "portrait",
  headerData = {},
}: {
  data: any;
  patientData: any;
  odontogramImage: string;
  odontogramItems: any[];
  page?: PageSize;
  orientation?: PageOrientation;
  headerData?: any;
}) {
  pdfMake.vfs = customVfs.pdfMake.vfs;
  pdfMake.fonts = {
    Arial: {
      normal: "Arial.ttf",
      bold: "Arial_Bold.ttf",
      italics: "Arial_Italic.ttf",
      bolditalics: "Arial_Bold_Italic.ttf",
    },
  };

  const faskesProfile = JSON.parse(
    localStorage.getItem("faskes_profile") ?? "{}"
  );
  let faskesLogo = "";
  if (faskesProfile.logo) {
    faskesLogo = faskesProfile.logo;
  } else {
    faskesLogo = await convertImageToBase64(logoUrl);
  }

  // Siapkan data tabel detail gigi
  const tableBodyGigi: any[]= [
    [
      { text: 'No. Gigi', fontsize: 10, bold: true, fillColor: '#ECFDF5', alignment: 'center' },
      { text: 'Keadaan Gigi', fontsize: 10, bold: true, fillColor: '#ECFDF5' }
    ]
  ];

  if (odontogramItems && odontogramItems.length > 0) {
    odontogramItems.forEach((item) => {
      tableBodyGigi.push([
        { text: item.noGigi.toString(), alignment: 'center' },
        { text: Array.isArray(item.keadaanGigi) ? item.keadaanGigi.join(", ") : item.keadaanGigi }
      ]);
    });
  } else {
    tableBodyGigi.push([{ text: "Tidak ada data gigi yang dipilih", colSpan: 2, alignment: 'center' }, ""]);
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: page,
    pageOrientation: orientation,
    defaultStyle: {
      font: "Arial",
      fontSize: 11,
    },
    header: defaultHeader(
      "resumeMedis",
      "PEMERIKSAAN ODONTOGRAM",
      faskesLogo,
      faskesProfile,
      patientData,
      headerData
    ),
    pageMargins: [60, 200, 60, 50],
    content: [
      {
        margin: [0, 5, 60, 7.5],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 1,
            x2: 475,
            y2: 1,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },
      {
        text: "VISUALISASI ODONTOGRAM",
        bold: true,
        fontSize: 11,
        margin: [0, 10, 0, 5]
      },
      {
        image: odontogramImage,
        width: 475,
        alignment: "center",
        margin: [0, 0, 0, 15]
      },
      {
        table: {
          headerRows: 1,
          widths: [60, "*"],
          body: tableBodyGigi
        },
        layout: {
          fillColor: function (rowIndex) {
            return (rowIndex % 2 === 0) && rowIndex !== 0 ? '#F9FAFB' : null;
          },
          hLineColor: function (i, node) {
            return '#E5E7EB';
          },
          vLineColor: function (i, node) {
            return '#E5E7EB';
          },
          hLineWidth: function (i, node) {
            return 0.5;
          },
          vLineWidth: function (i, node) {
            return 0.5;
          }
        },
        margin: [0, 0, 0, 20]
      },
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "HASIL PEMERIKSAAN",
                fillColor: "#EAECEF",
                bold: true,
                margin: [5, 2, 5, 2],
              },
            ],
          ],
        },
      },
      {
        margin: [0, 10, 0, 10],
        columns: [

          {
            width: "50%",
            stack: [
              {
                stack: [
                   { text: "Oklusi", bold: true, decoration: 'underline', margin: [0, 5, 0, 0] }, 
                   { text: (data.oklusiGigiUuid || "-"), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Torus Mandibularis", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: getLabel(listTorusMandibularis, data.torusMandibularis, data.torusMandibularis), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Frenulum Labialis", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: (data.frenulumLabialis || "-"), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Diastema", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: (data.diastema ? "Ya" : "Tidak"), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Jml. Gigi Decayed", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: (data.gigiDecayed?.toString() || "0"), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Jml. Filled", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: (data.gigiFilled?.toString() || "0"), margin: [0, 2, 0, 10] }
                ]
              },
            ]
          },
          
          {
            width: "50%",
            stack: [
              {
                stack: [
                   { text: "Torus Palatinus", bold: true, decoration: 'underline', margin: [0, 5, 0, 0] }, 
                   { text: getLabel(listTorusPalatinus, data.torusPalatinus, data.torusPalatinus), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Palatum", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: getLabel(listPalatum, data.palatum, data.palatum), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Frenulum Lingualis", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: (data.frenulumLingualis || "-"), margin: [0, 2, 0, 10] }
                ]
              },
              {
                stack: [
                   { text: "Gigi Anomali", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: (data.gigiAnomali ? "Ya" : "Tidak"), margin: [0, 2, 0, 10] }
                ]
              },
              
              {
                stack: [
                   { text: "Jml. Gigi Missing", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: (data.gigiMissing?.toString() || "0"), margin: [0, 2, 0, 10] }
                ]
              }, 
              {
                stack: [
                   { text: "Temuan Lainnya", bold: true, decoration: 'underline', margin: [0, 10, 0, 0] }, 
                   { text: data.temuanLain || "-", margin: [0, 2, 0, 10] }
                ]
              },
            ]
          }
        ]
      },
      {
        margin: [0, 15, 0, 5],
        stack: [
          {
            stack: [
                { text: "Keterangan Tindakan Gigi", bold: true, decoration: 'underline', margin: [0, 5, 0, 0] }, 
                { text: data.ketTindakanGigi || "-", margin: [0, 2, 0, 10] }
            ]
          },
        ]
      },
      {
        text: "Demikian Surat Keterangan ini dibuat untuk dapat digunakan sebagaimana mestinya.",
        margin: [0, 20, 0, 25],
        fontSize: 11
      },
      
      {
        columns: [
          { width: "*", text: "" },
          {
             width: 200,
             stack: [
               { text: `${faskesProfile?.address?.city || 'Surabaya'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, fontSize: 11, color: 'black', bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
               { text: "Dokter Penanggung Jawab", bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
               
               {
                alignment: "center",
                image: await generateQRCode(
                  `Dikeluarkan di ${
                    faskesProfile.name
                  }, Ditandatangani secara elektronik oleh ${
                    patientData.practitioner?.pegawai?.firstTitle &&
                    patientData.practitioner?.pegawai?.firstTitle != "-"
                      ? `${patientData.practitioner?.pegawai?.firstTitle} `
                      : ""
                  }${patientData.practitioner?.pegawai?.name || patientData.practitioner?.pegawai?.nama} ${
                    patientData.practitioner?.pegawai?.lastTitle &&
                    patientData.practitioner?.pegawai?.lastTitle != "-"
                      ? `${patientData.practitioner?.pegawai?.lastTitle} `
                      : ""
                  }, Pada tanggal ${new Date().toLocaleDateString('id-ID')}`
                ),
                width: 80,
                height: 80,
                fit: [80, 80],
                margin: [0, 5, 0, 5]
              },

               {
                margin: [0, 0, 0, 0],
                alignment: "center",
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: `${
                          patientData.practitioner?.pegawai?.firstTitle &&
                          patientData.practitioner?.pegawai?.firstTitle != "-"
                            ? `${patientData.practitioner?.pegawai?.firstTitle} `
                            : ""
                        }${patientData.practitioner?.pegawai?.name || patientData.practitioner?.pegawai?.nama} ${
                          patientData.practitioner?.pegawai?.lastTitle &&
                          patientData.practitioner?.pegawai?.lastTitle != "-"
                            ? `${patientData.practitioner?.pegawai?.lastTitle} `
                            : ""
                        }`,
                        marginBottom: 1,
                        border: [false, false, false, true],
                        alignment: 'center',
                        bold: true
                      },
                    ],
                    [
                      {
                        text: `SIP: ${patientData.practitioner?.sip || '-'}`,
                        border: [false, true, false, false],
                        alignment: 'center'
                      },
                    ],
                  ],
                },
              },
             ]
          }
        ]
      }
    ],
  };

  pdfMake.createPdf(docDefinition).open();
}

export async function createSuratPersetujuanTindakan({
  data,
  page = "A4",
  orientation = "portrait",
  type = "Persetujuan",
}: {
  data: any;
  page?: PageSize;
  orientation?: PageOrientation;
  type?: "Persetujuan" | "Penolakan";
}) {
  pdfMake.vfs = customVfs.pdfMake.vfs;
  pdfMake.fonts = {
    Arial: {
      normal: "Arial.ttf",
      bold: "Arial_Bold.ttf",
      italics: "Arial_Italic.ttf",
      bolditalics: "Arial_Bold_Italic.ttf",
    },
  };

  const faskesProfile = JSON.parse(
    localStorage.getItem("faskes_profile") ?? "{}"
  );
  let faskesLogo = "";
  if (faskesProfile.logo) {
    faskesLogo = faskesProfile.logo;
  } else {
    faskesLogo = await convertImageToBase64(logoUrl);
  }

  const tglPersetujuanFormatted = new Date(
    data.documentData.tglPersetujuan * 1000
  ).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: page,
    pageOrientation: orientation,
    defaultStyle: {
      font: "Arial",
      fontSize: 9,
    },
    header: defaultHeader(
      "noRM",
      `SURAT ${type.toUpperCase()} TINDAKAN`,
      faskesLogo,
      faskesProfile,
      data.patientData
    ),
    pageMargins: [60, 115, 60, 0],
    content: [
      {
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        table: {
          widths: [100, "auto", "*"],
          body: [
            [
              "Dokter Pelaksana",
              ":",
              {
                text: `${
                  data.documentData.practitioner?.pegawai?.firstTitle &&
                  data.documentData.practitioner?.pegawai?.firstTitle != "-"
                    ? `${data.documentData.practitioner?.pegawai?.firstTitle} `
                    : ""
                }${data.documentData.practitioner?.pegawai?.name || ""} ${
                  data.documentData.practitioner?.pegawai?.lastTitle &&
                  data.documentData.practitioner?.pegawai?.lastTitle != "-"
                    ? `${data.documentData.practitioner?.pegawai?.lastTitle} `
                    : ""
                }`,
                bold: true,
              },
            ],
            [
              "Pemberi Informasi",
              ":",
              { text: data.documentData.pemberiInformasi, bold: true },
            ],
            [
              "Penerima Informasi",
              ":",
              {
                text:
                  data.documentData.penerima == "pasien"
                    ? data.patientData.patient.name
                    : data.documentData.namaKeluarga,
                bold: true,
              },
            ],
          ],
        },
      },
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "INFORMASI TINDAKAN",
                fillColor: "#EAECEF",
                bold: true,
                margin: [5, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        table: {
          widths: [100, "auto", "*"],
          body: [
            ["Diagnosis (WD & DD)", ":", { text: data.documentData.diagnosis }],
            [
              "Dasar Diagnosis",
              ":",
              { text: data.documentData.dasarDiagnosis },
            ],
            [
              "Tindakan Kedokteran",
              ":",
              { text: data.documentData.tindakanKedokteran },
            ],
            [
              "Indikasi Tindakan",
              ":",
              { text: data.documentData.indikasiTindakan },
            ],
            ["Tata Cara", ":", { text: data.documentData.tatacaraTindakan }],
            ["Tujuan", ":", { text: data.documentData.tujuanTindakan }],
            ["Risiko", ":", { text: data.documentData.risikoTindakan }],
            ["Komplikasi", ":", { text: data.documentData.komplikasi }],
            ["Prognosis", ":", { text: data.documentData.prognosis }],
            [
              "Alternatif & Risiko",
              ":",
              { text: data.documentData.alaternatif },
            ],
            ["Lain-lain", ":", { text: data.documentData.lainnya }],
          ],
        },
      },
      {
        margin: [0, 7.5, 0, 7.5],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 1,
            x2: 475,
            y2: 1,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },
      {
        layout: "noBorders",
        table: {
          widths: ["*", 100],
          body: [
            [
              {
                text: "Dengan ini menyatakan bahwa saya telah menerangkan hal-hal di atas secara benar dan jujur dan memberikan kesempatan untuk bertanya dan/atau berdiskusi.",
              },
              {
                stack: [
                  {
                    text: "Pemberi Informasi",
                    bold: true,
                    alignment: "center",
                  },
                  {
                    alignment: "center",
                    image: await generateQRCode(
                      `Dikeluarkan di ${
                        faskesProfile.name
                      }, Ditandatangani secara elektronik oleh ${
                        data.documentData.pemberiInformasi
                      }, Pada tanggal ${epochToDate(
                        data.documentData.tglPersetujuan,
                        "date"
                      )}`
                    ),
                    width: 40,
                    height: 40,
                    fit: [40, 40],
                  },
                ],
              },
            ],
          ],
        },
      },
      {
        marginTop: 30,
        layout: "noBorders",
        table: {
          widths: ["*", 100],
          body: [
            [
              {
                text: "Dengan ini menyatakan bahwa saya telah menerima informasi sebagaimana di atas yang saya beri tanda/paraf di kolom kanannya, dan telah memahaminya.",
              },
              {
                stack: [
                  {
                    text: "Penerima Informasi",
                    bold: true,
                    alignment: "center",
                  },
                  {
                    alignment: "center",
                    image: await generateQRCode(
                      `Dikeluarkan di ${
                        faskesProfile.name
                      }, Ditandatangani secara elektronik oleh ${
                        data.documentData.penerima == "pasien"
                          ? data.patientData.patient.name
                          : data.documentData.namaKeluarga
                      }, Pada tanggal ${epochToDate(
                        data.documentData.tglPersetujuan,
                        "date"
                      )}`
                    ),
                    width: 40,
                    height: 40,
                    fit: [40, 40],
                  },
                ],
              },
            ],
          ],
        },
      },
      {
        pageBreak: "before",
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "PERSETUJUAN TINDAKAN KEDOKTERAN",
                fillColor: "#EAECEF",
                bold: true,
                margin: [5, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [0, 4, 0, 20],
        text: [
          "Yang bertandatangan di bawah ini, ",
          {
            text: `${
              data.documentData.penerima == "pasien"
                ? data.patientData.patient.name
                : data.documentData.namaKeluarga
            }`,
            bold: true,
          },
          `, ${
            data.documentData.penerima == "pasien"
              ? data.patientData.patient.gender.toLowerCase() == "male"
                ? "Laki-laki"
                : "Perempuan"
              : data.documentData.gender
          }, ${
            data.documentData.penerima == "pasien"
              ? data.patientData.patient.address?.fullAddress || data.patientData.patient.address?.fullAddress
              : data.documentData.alamat
          }. `,
          `Dengan ini menyatakan ${type.toUpperCase()} untuk dilakukannya tindakan `,
          ...(data.documentData.penerima == "pasien"
            ? [
                { text: `${data.documentData.tindakanKedokteran}.`, bold: true },
              ]
            : [
                { text: `${data.documentData.tindakanKedokteran}, `, bold: true },
                "terhadap pasien ",
                `(${data.documentData.hubunganKeluarga}) bernama`,
                { text: ` ${data.patientData.patient.name}`, bold: true },
                `, ${data.patientData.patient.birthDetail.ageYear}Th ${
                  data.patientData.patient.birthDetail.ageMonth
                }Bl ${data.patientData.patient.birthDetail.ageDay}Hr, ${
                  data.patientData.patient.gender.toLowerCase() == "male"
                    ? "Laki-laki"
                    : "Perempuan"
                }, ${data.patientData.patient.address?.fullAddress || data.patientData.patient.address?.fullAddress}.)`,
              ]),
        ],
      },
      "Saya memahami perlunya dan manfaat tindakan tersebut sebagaimana telah dijelaskan seperti di atas kepada saya, termasuk risiko dan komplikasi yang mungkin timbul. Saya juga menyadari bahwa oleh karena ilmu kedokteran bukanlah ilmu pasti, maka keberhasilan tindakan kedokteran bukanlah keniscayaan, melainkan sangat bergantung kepada izin Tuhan Yang Maha Esa.",
      {
        layout: "noBorders",
        marginTop: 45,
        alignment: "center",
        table: {
          widths: ["*", 100, "*"],
          body: [
            [
              "",
              "",
              {
                text: `${tglPersetujuanFormatted}`,
                bold: true,
              },
            ],
            [
              {
                text: "Dokter",
                bold: true,
              },
              "",
              {
                text: "Penerima Informasi",
                bold: true,
              },
            ],
            [
              {
                alignment: "center",
                image: await generateQRCode(
                  `Dikeluarkan di ${
                    faskesProfile.name
                  }, Ditandatangani secara elektronik oleh ${`${
                  data.documentData.practitioner?.pegawai?.firstTitle &&
                  data.documentData.practitioner?.pegawai?.firstTitle != "-"
                    ? `${data.documentData.practitioner?.pegawai?.firstTitle} `
                    : ""
                }${data.documentData.practitioner?.pegawai?.name || ""} ${
                  data.documentData.practitioner?.pegawai?.lastTitle &&
                  data.documentData.practitioner?.pegawai?.lastTitle != "-"
                    ? `${data.documentData.practitioner?.pegawai?.lastTitle} `
                    : ""
                }`},, Pada tanggal ${epochToDate(
                    data.documentData.tglPersetujuan,
                    "date"
                  )}`
                ),
                width: 80,
                height: 80,
                fit: [80, 80],
              },
              "",
              {
                alignment: "center",
                image: await generateQRCode(
                  `Dikeluarkan di ${
                    faskesProfile.name
                  }, Ditandatangani secara elektronik oleh ${
                    data.documentData.penerima == "pasien"
                      ? data.patientData.patient.name
                      : data.documentData.namaKeluarga
                  }, Pada tanggal ${epochToDate(
                    data.documentData.tglPersetujuan,
                    "date"
                  )}`
                ),
                width: 80,
                height: 80,
                fit: [80, 80],
              },
            ],
            [
              {
                margin: [20, 0, 20, 0],
                alignment: "center",
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                      text: `${
                        data.documentData.practitioner?.pegawai?.firstTitle &&
                        data.documentData.practitioner?.pegawai?.firstTitle != "-"
                          ? `${data.documentData.practitioner?.pegawai?.firstTitle} `
                          : ""
                      }${data.documentData.practitioner?.pegawai?.name || ""} ${
                        data.documentData.practitioner?.pegawai?.lastTitle &&
                        data.documentData.practitioner?.pegawai?.lastTitle != "-"
                          ? `${data.documentData.practitioner?.pegawai?.lastTitle} `
                          : ""
                      }`,
                        marginBottom: 1,
                        border: [false, false, false, true],
                      },
                    ],
                    [
                      {
                        text: `SIP: ${data.documentData.practitioner?.sip}`,
                        border: [false, true, false, false],
                      },
                    ],
                  ],
                },
              },
              "",
              {
                margin: [20, 0, 20, 0],
                alignment: "center",
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: `${
                          data.documentData.penerima == "pasien"
                            ? data.patientData.patient.name
                            : data.documentData.namaKeluarga
                        }`,
                        marginBottom: 1,
                        border: [false, false, false, true],
                      },
                    ],
                  ],
                },
              },
            ],
          ],
        },
      },
      {
        layout: "noBorders",
        marginTop: 30,
        alignment: "center",
        table: {
          widths: ["*", 100, "*"],
          body: [
            [
              {
                text: "Saksi 1",
                bold: true,
              },
              "",
              {
                text: "Saksi 2",
                bold: true,
              },
            ],
            [
              {
                alignment: "center",
                image: await generateQRCode(
                  `Dikeluarkan di ${
                    faskesProfile.name
                  }, Ditandatangani secara elektronik oleh ${
                    data.documentData.saksi1
                  }, Pada tanggal ${epochToDate(
                    data.documentData.tglPersetujuan,
                    "date"
                  )}`
                ),
                width: 80,
                height: 80,
                fit: [80, 80],
              },
              "",
              {
                alignment: "center",
                image: await generateQRCode(
                  `Dikeluarkan di ${
                    faskesProfile.name
                  }, Ditandatangani secara elektronik oleh ${
                    data.documentData.saksi2
                  }, Pada tanggal ${epochToDate(
                    data.documentData.tglPersetujuan,
                    "date"
                  )}`
                ),
                width: 80,
                height: 80,
                fit: [80, 80],
              },
            ],
            [
              {
                margin: [20, 0, 20, 0],
                alignment: "center",
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: `${data.documentData.saksi1}`,
                        marginBottom: 1,
                        border: [false, false, false, true],
                      },
                    ],
                  ],
                },
              },
              "",
              {
                margin: [20, 0, 20, 0],
                alignment: "center",
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: `${data.documentData.saksi2}`,
                        marginBottom: 1,
                        border: [false, false, false, true],
                      },
                    ],
                  ],
                },
              },
            ],
          ],
        },
      },
    ],
  };

  pdfMake.createPdf(docDefinition).open();
}

export async function createResumeMedis({
  data,
  page = "A4",
  orientation = "portrait",
}: {
  data: any;
  page?: PageSize;
  orientation?: PageOrientation;
}) {
  pdfMake.vfs = customVfs.pdfMake.vfs;
  pdfMake.fonts = {
    Arial: {
      normal: "Arial.ttf",
      bold: "Arial_Bold.ttf",
      italics: "Arial_Italic.ttf",
      bolditalics: "Arial_Bold_Italic.ttf",
    },
  };

  const faskesProfile = JSON.parse(
    localStorage.getItem("faskes_profile") ?? "{}"
  );
  let faskesLogo = "";
  if (faskesProfile.logo) {
    faskesLogo = faskesProfile.logo;
  } else {
    faskesLogo = await convertImageToBase64(logoUrl);
  }

  const getKondisiPulangNama = (kode: string) => {
    switch (kode) {
      case "359746009": return "Stabil";
      case "162668006": return "Tidak stabil";
      case "268910001": return "Perbaikan";
      default: return kode || '-';
    }
  };

  const getStatusPulangNama = (kode: string) => {
    switch (kode) {
      case "home": return "Pulang atas persetujuan dokter";
      case "aadvice": return "Pulang atas permintaan sendiri";
      case "other-hcf":
      case "other-hfc": return "Dirujuk";
      case "exp-lt48h": return "Meninggal < 48 jam";
      case "exp-gt48h": return "Meninggal > 48 jam";
      case "oth": return "Lain-lain";
      default: return kode || '-';
    }
  };

  const getEdukasiNama = (kode: string) => {
    switch (kode) {
      case "84635008": return "Proses penyakit, diagnosis, dan rencana asuhan";
      case "967006": return "Obat-obatan";
      case "410082002": return "Rehabilitasi medis";
      case "712651001": return "Manajemen nyeri";
      case "61310001": return "Gizi";
      case "698608004": return "Cuci tangan";
      case "362978005": return "Penggunaan alat medis";
      default: return kode || '-';
    }
  };

  const pemeriksaanFisikData: any[] = [];
  data.resumeData?.selectedPemeriksaanFisik.forEach(
    (pemeriksaanFisik: any, index: number) => {
      pemeriksaanFisikData.push([
        `${index + 1}`,
        `${
          pemeriksaanFisik.keterangan && pemeriksaanFisik.keterangan != ""
            ? pemeriksaanFisik.keterangan
            : "-"
        }`,
        `${pemeriksaanFisik.organ}`,
      ]);
    }
  );

  const diagnosisData: any[] = [];
  data.resumeData?.selectedDiagnosis.forEach(
    (diagnosis: any, index: number) => {
      diagnosisData.push([
        `${index + 1}`,
        `${diagnosis.diagnosis}`,
        `${diagnosis.tipe}`,
      ]);
    }
  );

  const tindakanData: any[] = [];
  data.resumeData?.selectedTindakan.forEach((tindakan: any, index: number) => {
    tindakanData.push([`${index + 1}`, `${tindakan.namaTindakan}`]);
  });

  const pengobatanData: any[] = [];
  const pengobatanPulangData: any[] = [];
  data.resumeData?.selectedObat.forEach((obat: any) => {
    if (obat.isTakeaway) {
      pengobatanPulangData.push([
        `${pengobatanPulangData.length + 1}`,
        `${obat?.itemMedis?.name}`,
        `${obat?.medicationQty}`,
        `${obat?.aturanPakai}`,
        `${obat?.caraPakai}`,
      ]);
    } else {
      pengobatanData.push([
        `${pengobatanData.length + 1}`,
        `${obat?.itemMedis?.name}`,
        `${obat?.medicationQty}`,
        `${obat?.aturanPakai}`,
        `${obat?.caraPakai}`,
      ]);
    }
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: page,
    pageOrientation: orientation,
    defaultStyle: {
      font: "Arial",
      fontSize: 9,
    },
    header: defaultHeader(
      "resumeMedis",
      "RESUME MEDIS",
      faskesLogo,
      faskesProfile,
      data.patientData,
      data.resumeData
    ),
    pageMargins: [60, 220, 60, 20],
    content: [
      {
        margin: [0, 5, 60, 7.5],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 1,
            x2: 475,
            y2: 1,
            lineWidth: 1,
            lineColor: "black",
          },
        ],
      },
      // SECTION DPJP Anamnesis
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["auto", 10, "*"],
          body: [
            [
              {
                text: "DPJP",
                fillColor: "#EAECEF",
                bold: true,
                margin: [10, 0, 5, 0],
              },
              "",
              {
                text: `${
                  data.patientData.practitioner?.pegawai?.firstTitle &&
                  data.patientData.practitioner?.pegawai?.firstTitle != "-"
                    ? `${data.patientData.practitioner?.pegawai?.firstTitle} `
                    : ""
                }${data.patientData.practitioner?.pegawai?.nama} ${
                  data.patientData.practitioner?.pegawai?.lastTitle &&
                  data.patientData.practitioner?.pegawai?.lastTitle != "-"
                    ? `${data.patientData.practitioner?.pegawai?.lastTitle} `
                    : ""
                }`,
                fillColor: "#EAECEF",
                margin: [10, 0, 0, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        columns: [
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: "Ringkasan Riwayat Penyakit / Anamnesis",
                    bold: true,
                    decoration: "underline",
                    colSpan: 3,
                  },
                ],
                [
                  {
                    text: `${data.resumeData?.anamnesis}`,
                    colSpan: 3,
                  },
                ],
              ],
            },
            width: "50%",
          },
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: "Keluhan Utama",
                    bold: true,
                    decoration: "underline",
                    colSpan: 3,
                  },
                ],
                [
                  {
                    text: `${data.patientData?.complaint}`,
                    colSpan: 3,
                  },
                ],
              ],
            },
            width: "50%",
          },
        ],
      },
      // SECTION Tanda Vital Awal
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "TANDA TANDA VITAL (TTV) - KETIKA MASUK",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        columns: [
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: [{ text: "Tekanan Darah", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalAwal?.tekananDarahSistole}/${data.resumeData?.tandaVitalAwal?.tekananDarahDiastole} mmHg`,
                  },
                ],
                [
                  {
                    text: [{ text: "Frek. Nafas", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalAwal?.frekuensiNafas} / menit`,
                  },
                ],
              ],
            },
            width: "50%",
          },
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: [{ text: "Frek. Nadi", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalAwal?.frekuensiNadi} / menit`,
                  },
                ],
                [
                  {
                    text: [{ text: "Suhu", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalAwal?.suhu} °C`,
                  },
                ],
              ],
            },
            width: "50%",
          },
        ],
      },
      // SECTION Tanda Vital Keluar
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "TANDA TANDA VITAL (TTV) - KETIKA KELUAR",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        columns: [
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: [{ text: "Tekanan Darah", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalPulang?.tekananDarahSistole}/${data.resumeData?.tandaVitalPulang?.tekananDarahDiastole} mmHg`,
                  },
                ],
                [
                  {
                    text: [{ text: "Frek. Nafas", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalPulang?.frekuensiNafas} / menit`,
                  },
                ],
              ],
            },
            width: "50%",
          },
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: [{ text: "Frek. Nadi", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalPulang?.frekuensiNadi} / menit`,
                  },
                ],
                [
                  {
                    text: [{ text: "Suhu", bold: true }],
                  },
                  { text: ":" },
                  {
                    text: `${data.resumeData?.tandaVitalPulang?.suhu} °C`,
                  },
                ],
              ],
            },
            width: "50%",
          },
        ],
      },
      // SECTION Pemeriksaan Fisik
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "PEMERIKSAAN FISIK",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        layout: "noBorders",
        table: {
          widths: [20, "*", "*"],
          body: [
            [
              {
                text: "No.",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Hasil Pemeriksaan",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Lokasi Fisik",
                decoration: "underline",
                bold: true,
              },
            ],
            ...pemeriksaanFisikData,
          ],
        },
      },
      // SECTION Diagnosa
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "DIAGNOSA",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        layout: "noBorders",
        table: {
          widths: [20, "*", 50],
          body: [
            [
              {
                text: "No.",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Nama Diagnosa",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Tipe",
                decoration: "underline",
                bold: true,
              },
            ],
            ...diagnosisData,
          ],
        },
      },
      // SECTION Tindakan
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "TINDAKAN",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        layout: "noBorders",
        table: {
          widths: [20, "*"],
          body: [
            [
              {
                text: "No.",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Nama Tindakan",
                decoration: "underline",
                bold: true,
              },
            ],
            ...tindakanData,
          ],
        },
      },
      // SECTION Pengobatan
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "PENGOBATAN",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        layout: "noBorders",
        table: {
          widths: [20, "*", "*", "*", "*"],
          body: [
            [
              {
                text: "No.",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Nama Obat",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Jumlah",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Aturan Pakai",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Cara Pakai",
                decoration: "underline",
                bold: true,
              },
            ],
            ...pengobatanData,
          ],
        },
      },
      // SECTION Cara Pulang
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "CARA PULANG",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        columns: [
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: "Status Pulang",
                    bold: true,
                    decoration: "underline",
                    colSpan: 3,
                  },
                ],
                [
                  {
                    text: `${getStatusPulangNama(data.resumeData?.statusPulang)}`,
                    colSpan: 3,
                  },
                ],
              ],
            },
            width: "50%",
          },
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: "Kondisi Saat Pulang",
                    bold: true,
                    decoration: "underline",
                    colSpan: 3,
                  },
                ],
                [
                  {
                    text: `${getKondisiPulangNama(data.resumeData?.kondisiPasienPulang)}`,
                    colSpan: 3,
                  },
                ],
              ],
            },
            width: "50%",
          },
        ],
      },
      // SECTION Pengobatan Pulang
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "PENGOBATAN PULANG",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        layout: "noBorders",
        table: {
          widths: [20, "*", "*", "*", "*"],
          body: [
            [
              {
                text: "No.",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Nama Obat",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Jumlah",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Aturan Pakai",
                decoration: "underline",
                bold: true,
              },
              {
                text: "Cara Pakai",
                decoration: "underline",
                bold: true,
              },
            ],
            ...pengobatanPulangData,
          ],
        },
      },
      // SECTION Edukasi
      {
        margin: [0, 2, 0, 2],
        layout: "noBorders",
        fontSize: 10.5,
        bold: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "EDUKASI",
                fillColor: "#EAECEF",
                margin: [10, 0, 5, 0],
              },
            ],
          ],
        },
      },
      {
        margin: [10, 2, 10, 2],
        columns: [
          {
            layout: "noBorders",
            table: {
              widths: [80, 2, "*"],
              body: [
                [
                  {
                    text: `${getEdukasiNama(data.resumeData.edukasi)}`,
                    bold: true,
                    decoration: "underline",
                    colSpan: 3,
                  },
                ],
                [
                  {
                    text: `${data.resumeData.edukasiText}`,
                    colSpan: 3,
                  },
                ],
              ],
            },
            width: "100%",
          },
        ],
      },
      // !SECTION
      {
        layout: "noBorders",
        marginTop: 45,
        alignment: "center",
        table: {
          widths: ["*", 100, "*"],
          body: [
            [
              "",
              "",
              {
                text: `${faskesProfile?.address?.city}, ${
                  data.resumeData?.dischargeDate
                    ? epochToDate(data.resumeData.dischargeDate, "date")
                    : "-"
                }`,
                bold: true,
              },
            ],
            [
              {
                text: "Pasien",
                bold: true,
              },
              "",
              {
                text: "Dokter Penanggung Jawab",
                bold: true,
              },
            ],
            [
              {
                alignment: "center",
                image: await generateQRCode(
                  `Dikeluarkan di ${
                    faskesProfile.name
                  }, Ditandatangani secara elektronik oleh ${
                    data.patientData.patient.name
                  }, Pada tanggal ${
                    data.resumeData?.dischargeDate
                      ? epochToDate(data.resumeData.dischargeDate, "date")
                      : "-"
                  }`
                ),
                width: 80,
                height: 80,
                fit: [80, 80],
              },
              "",
              {
                alignment: "center",
                image: await generateQRCode(
                  `Dikeluarkan di ${
                    faskesProfile.name
                  }, Ditandatangani secara elektronik oleh ${`${
                    data.patientData.practitioner?.pegawai?.firstTitle &&
                    data.patientData.practitioner?.pegawai?.firstTitle != "-"
                      ? `${data.patientData.practitioner?.pegawai?.firstTitle} `
                      : ""
                  }${data.patientData.practitioner?.pegawai?.nama} ${
                    data.patientData.practitioner?.pegawai?.lastTitle &&
                    data.patientData.practitioner?.pegawai?.lastTitle != "-"
                      ? `${data.patientData.practitioner?.pegawai?.lastTitle} `
                      : ""
                  }`}, Pada tanggal ${
                    data.resumeData?.dischargeDate
                      ? epochToDate(data.resumeData.dischargeDate, "date")
                      : "-"
                  }`
                ),
                width: 80,
                height: 80,
                fit: [80, 80],
              },
            ],
            [
              {
                margin: [20, 0, 20, 0],
                alignment: "center",
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: `${data.patientData.patient.name}`,
                        marginBottom: 1,
                        border: [false, false, false, true],
                      },
                    ],
                  ],
                },
              },
              "",
              {
                margin: [20, 0, 20, 0],
                alignment: "center",
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: `${
                          data.patientData.practitioner?.pegawai?.firstTitle &&
                          data.patientData.practitioner?.pegawai?.firstTitle !=
                            "-"
                            ? `${data.patientData.practitioner?.pegawai?.firstTitle} `
                            : ""
                        }${data.patientData.practitioner?.pegawai?.nama} ${
                          data.patientData.practitioner?.pegawai?.lastTitle &&
                          data.patientData.practitioner?.pegawai?.lastTitle !=
                            "-"
                            ? `${data.patientData.practitioner?.pegawai?.lastTitle} `
                            : ""
                        }`,
                        marginBottom: 1,
                        border: [false, false, false, true],
                      },
                    ],
                    [
                      {
                        text: `SIP: ${data.patientData.practitioner?.sip}`,
                        border: [false, true, false, false],
                      },
                    ],
                  ],
                },
              },
            ],
          ],
        },
      },
    ],
  };

  pdfMake.createPdf(docDefinition).open();
}
