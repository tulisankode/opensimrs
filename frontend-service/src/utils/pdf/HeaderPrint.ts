import { epochToDate, formatStringDate } from "../Helpers";
import { warnaTema } from "@/utils/tema";

export function defaultHeader(
  type: "noRM" | "invoice" | "resumeMedis" | "noSurat",
  title: string,
  faskesLogo: string,
  faskesProfile: any,
  patientData: any,
  resumeData?: any
) {
  return {
    margin: [60, 0, 60, 0],
    stack: [
      {
        margin: [30, 20, 30, 0],
        columns: [
          {
            image: faskesLogo,
            fit: [100, 45],
            width: "auto",
          },
          {
            alignment: "center",
            stack: [
              {
                text: faskesProfile?.name,
                fontSize: 15,
                bold: true,
                marginBottom: 2,
              },
              {
                text: faskesProfile?.address?.fullAddress ?? "-",
                marginBottom: 2,
              },
              {
                text: `${faskesProfile?.phone ?? "080000000000"} - ${faskesProfile?.email ?? "dev@opensimrs.id"
                  }`,
              },
            ],
            width: "*",
          },
        ],
      },
      {
        marginTop: 10.5,
        alignment: "center",
        bold: true,
        layout: "noBorders",
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: title ?? "Judul Surat",
                fontSize: 15,
                color: "white",
                fillColor: warnaTema('300'),
              },
            ],
            type == "noRM"
              ? [
                {
                  text: `RM. ${patientData.noRm}`,
                  fillColor: "#EAECEF",
                },
              ]
              : type == "invoice"
                ? [
                  {
                    text: `No. ${patientData.invoiceCode}`, 
                    fillColor: "#A7F3D0", 
                  },
                ]
                : [""],
          ],
        },
      },
      type == "resumeMedis"
        ? {
          margin: [0, 2, 0, 2],
          layout: "noBorders",
          fontSize: 13.5,
          table: {
            widths: ["auto", 10, "*"],
            body: [
              [
                {
                  text: "PASIEN",
                  fillColor: "#EAECEF",
                  bold: true,
                  margin: [10, 3, 5, 0],
                },
                "",
                {
                  table: {
                    widths: ["*", "auto"],
                    body: [
                      [
                        {
                          text: patientData?.patient?.name,
                          border: [false, false, false, false],
                        },
                        {
                          text: `RM. ${patientData?.noRm}`,
                          alignment: "right",
                          border: [true, false, false, false],
                          margin: [5, 0, 0, 0],
                        },
                      ],
                    ],
                  },
                  fillColor: "#EAECEF",
                  bold: true,
                  margin: [5, 0, 5, 0],
                },
              ],
            ],
          },
        }
        : "",
      type == "resumeMedis"
        ? {
          margin: [0, 2, 0, 2],
          columns: [
            {
              layout: "noBorders",
              table: {
                widths: [80, 2, "*"],
                body: [
                  [
                    {
                      text: [{ text: "Tgl. Lahir / Umur", bold: true }],
                    },
                    { text: ":" },
                    {
                      text: `${formatStringDate(
                        patientData?.patient?.birthDetail?.birthDate
                      )} / ${patientData?.patient?.birthDetail?.ageYear
                        } Tahun`,
                    },
                  ],
                  [
                    {
                      text: [{ text: "Jenis Kelamin", bold: true }],
                    },
                    { text: ":" },
                    {
                      text: `${["Male", "Laki-laki"].includes(patientData?.patient?.gender)
                          ? "Laki-laki"
                          : "Perempuan"
                        }`,
                    },
                  ],
                  [
                    {
                      text: [{ text: "Alamat", bold: true }],
                    },
                    { text: ":" },
                    { text: `${patientData?.patient?.address?.fullAddress}` },
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
                      text: [{ text: "Tgl. Masuk", bold: true }],
                    },
                    { text: ":" },
                    {
                      text: `${epochToDate(
                        patientData?.tanggalDaftar,
                        "date"
                      )}`,
                    },
                  ],
                  [
                    {
                      text: [{ text: "Tgl. Keluar", bold: true }],
                    },
                    { text: ":" },
                    {
                      text: `${resumeData?.dischargeDate
                          ? epochToDate(resumeData.dischargeDate, "date")
                          : "-"
                        }`,
                    },
                  ],
                  [
                    {
                      text: [{ text: "Kunjungan", bold: true }],
                    },
                    { text: ":" },
                    { text: `${patientData?.jenisPelayanan}` },
                  ],
                  [
                    {
                      text: [{ text: "Pembayaran", bold: true }],
                    },
                    { text: ":" },
                    {
                      text: `${patientData?.paymentMethod == 1
                          ? "Tunai"
                          : "Non Tunai"
                        }`,
                    },
                  ],
                  ...(patientData?.paymentMethod == 1
                    ? []
                    : [
                        [
                          {
                            text: [{ text: "Penjamin", bold: true }],
                          },
                          { text: ":" },
                          {
                            text: `${patientData?.insurance?.name ?? '-'}`,
                          },
                        ],
                      ]
                   )
                ],
              },
              width: "50%",
            },
          ],
        }
        : "",
    ],
  } as any;
}