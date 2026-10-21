import { z } from "zod";
import { faskesUuidRequired, required } from "./message-validation-error.js";

export default class PrescriptionValidation {
  static CREATE_PRESCRIPTION = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    no_resep: z.string().min(1, required),
    no_reg: z.string().min(1, required),
    patient_uuid: z.string().min(1, required),
    no_rm: z.string().min(1, required),
    order_status: z.number(),
    is_takeaway: z.boolean(),
    dokter_order: z.string().min(1, required),
    jenis_pelayanan: z.string().min(1, required),
    session_uuid: z.string().min(1, required),
    rekam_medis_uuid: z.string().min(1, required),
    lokasi_uuid: z.string().min(1, required),
    payment_method: z.number(),
  });

  static EDIT_SISA_OBAT = z.object({
    sisa_qty_order: z.number()
  })

  static CREATE_PRESCRIPTION_ITEM = z.object({
    prescription_uuid: z.string().min(1, required),
    item_medis_uuid: z.string().min(1, required),
    medication_qty: z.number().positive("jumlah obat harus lebih dari 0"),
    medication_dose_qty: z.number(),
    medication_dose_satuan_uuid: z.string().min(1, required),
    medication_period: z.string().min(1, required),
    aturan_pakai_uuid: z.string().min(1, required),
    cara_pakai_uuid: z.string().min(1, required),
    is_chronic: z.boolean(),
    route: z.string().min(1, required),
  });

  static CREATE_PRESCRIPTION_ITEM_RACIKAN = z.object({
    item_medis_uuid: z.string().min(1, required),
    medication_qty: z.number().positive("jumlah harus lebih dari 0"),
  });

  static DELETE_PRESCRIPTION_ITEM = z.object({
    prescription_item_uuid: z.string().min(1, required),
  });

  static UPDATE_PRESCRIPTION = z.object({
    uuid: z.string().min(1, required),
    is_takeaway: z.boolean(),
    lokasi_stok_uuid: z.string().min(1, required),
  });

  static UPDATE_OBAT = z.object({
    uuid: z.string().min(1, required),
    type: z.string().min(1, required),
  });

  static GET_SOME_ORDER = z.object({
    uuides: z.array(z.string().min(1, required)),
  });

  static UPDATE_TELAAH = z.object({
    uuid: z.string().min(1, required),
    status_telaah: z.boolean(),
    petugas_telaah: z.string().min(1, required),
  });

  static BATAL_ORDER = z.object({
    uuid: z.string().min(1, required),
    petugas_pembatalan: z.string().min(1, required),
    alasan_batal: z.string().min(1, required),
  });

  // items/racikan_items: jenis stok pilihan apoteker. Harus dideklarasikan — zod membuang kunci yang
  // tidak dikenal, sehingga sebelumnya pilihan ini selalu hilang saat verifikasi.
  static UPDATE_VERIFIKASI = z.object({
    uuid: z.string().min(1, required),
    items: z
      .array(
        z.object({
          item_uuid: z.string().min(1, required),
          jenis_stok_uuid: z.string().min(1, required),
        })
      )
      .optional(),
    racikan_items: z
      .array(
        z.object({
          racikan_uuid: z.string().min(1, required),
          jenis_stok_uuid: z.string().min(1, required),
        })
      )
      .optional(),
  });

  static UPDATE_SIAP_DISERAHKAN = z.object({
    uuid: z.string().min(1, required),
  });

  static BATAL_DISERAHKAN = z.object({
    uuid: z.string().min(1, required),
  });

  static UPDATE_SERAHKAN = z.object({
    uuid: z.string().min(1, required),
    penerima: z.string().min(1, required),
    no_hp_penerima: z.string().min(1, required),
    petugas_edukasi: z.string().min(1, required),
  });

  static UPDATE_LOKASI_STOK = z.object({
    uuid: z.string().min(1, required),
    lokasi_stok_uuid: z.string().min(1, required),
  });

  static GET_ALL = z.object({
    faskes_uuid: z.string().min(1, required),
    start_date: z.number(),
    end_date: z.number(),
  });

  static UPDATE_JENIS_ITEM = z.object({
    uuid: z.string().min(1, required),
    is_racikan: z.boolean(),
    jenis_stok_uuid: z.string().min(1, required),
  });

  static STATUS_MORE_THAN = z.object({
    status: z.number(),
    prescription_uuid: z.string().min(1, required),
  });

  static GET_FOR_FPO = z.object({
    date: z.string().min(1, required),
    rekam_medis_uuid: z.string().min(1, required),
  });

  // Kategori alasan substitusi obat (kode disimpan; label ditampilkan di layar Resep Dokter)
  static KATEGORI_ALASAN_SUBSTITUSI = [
    "stok_kosong",
    "tidak_ada_di_formularium",
    "permintaan_pasien",
    "penjamin",
    "lainnya",
  ];

  // Substitusi obat: obat, jenis stok, jumlah, dan alasan wajib; dosis/aturan/cara pakai opsional
  // (tanpa isian tetap mengikuti resep dokter). Kolom harga/stok/faskes tidak diterima dari klien.
  static SUBSTITUTE_PRESCRIPTION_ITEM = z
    .object({
      prescription_item_uuid: z.string().min(1, "Item resep harus dipilih"),
      item_medis_uuid: z.string().min(1, "Obat pengganti harus dipilih"),
      jenis_stok_uuid: z.string().min(1, "Jenis stok harus dipilih"),
      medication_qty: z.number().positive("Jumlah obat harus lebih dari 0"),
      medication_dose_qty: z.number().positive().optional(),
      medication_dose_satuan_uuid: z.string().min(1).optional(),
      aturan_pakai_uuid: z.string().min(1).optional(),
      cara_pakai_uuid: z.string().min(1).optional(),
      kategori_alasan: z.enum(PrescriptionValidation.KATEGORI_ALASAN_SUBSTITUSI, {
        errorMap: () => ({ message: "Kategori alasan substitusi tidak dikenal" }),
      }),
      alasan: z.string().trim().min(1, "Alasan substitusi wajib diisi").max(1000),
      persetujuan_dokter: z.boolean().default(false),
      dokter_penyetuju: z.string().trim().max(255).optional().nullable(),
      catatan: z.string().trim().max(1000).optional().nullable(),
    })
    .refine((d) => !d.persetujuan_dokter || !!d.dokter_penyetuju, {
      message: "Nama dokter yang menyetujui wajib diisi",
      path: ["dokter_penyetuju"],
    });
}
