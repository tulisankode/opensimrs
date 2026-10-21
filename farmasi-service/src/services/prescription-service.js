import PrescriptionRepository from "../repositories/prescription-repository.js";
import PrescriptionValidation from "../validations/prescription-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import BadRequestException from "../errors/bad-request-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import DataMasterLokasiStokRepository from "../repositories/datamaster-lokasi-stok-repository.js";
import InternalServerException from "../errors/internal-server-exception.js";
import Utils from "../helpers/utils.js";
import axiosInstance from "../configurations/axios-instance.js";
import { INVENTORY_URL, REKAM_MEDIS_URL } from "../helpers/constants.js";
import { setRangeDate, toEpochDate } from "../helpers/date-helper.js";
import KonfigurasiHargaService from "./konfigurasi-harga-service.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import DataMasterItemMedisRepository from "../repositories/datamaster-item-medis-repository.js";
import DataMasterBentukRacikanRepository from "../repositories/datamaster-bentuk-racikan-repository.js";
// kelas lokal: dikenali error-middleware sebagai 404 (versi model-sdk berakhir sebagai 500)
import NotfoundException from "../errors/notfound-exception.js";
import PrescriptionHelper from "../helpers/prescriptionHelper.js";
import TagihanRepository from "../repositories/tagihan-repository.js";
import TagihanFarmasiService from "./tagihan-farmasi-service.js";

export default class PrescriptionService {
  static async getByUuid(uuid, faskes_uuid) {
    const prescription = await PrescriptionRepository.getByUuid(
      uuid,
      undefined,
      faskes_uuid
    );
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }

    const formattedPrescription =
      PrescriptionHelper.mapPrescription(prescription);

    if (prescription.order_status === PrescriptionHelper.STATUS.SIAP_DISERAHKAN) {
      formattedPrescription.status_pembayaran = (
        await TagihanFarmasiService.statusPembayaran([prescription], "resep", faskes_uuid)
      ).get(prescription.uuid);
    }

    // riwayat substitusi obat: penanda "Substitusi dari <obat asal>" per item & daftar lengkapnya
    PrescriptionHelper.lampirkanSubstitusi(
      formattedPrescription,
      await PrescriptionRepository.getSubstitutionByPrescription(
        uuid,
        faskes_uuid
      )
    );

    return formattedPrescription;
  }

  static async orderObat(req) {
    req.order_status = PrescriptionHelper.STATUS.RESEP_MASUK;
    req.no_resep = Utils.generate4Code("RSP");

    ZodValidator.validate(PrescriptionValidation.CREATE_PRESCRIPTION, req);
    if (!Array.isArray(req.obat) || req.obat.length === 0) {
      throw new BadRequestException("'obat' tidak boleh kosong");
    }

    if (!req.lokasi_stok_uuid) {
      const lokasiStocks = await DataMasterLokasiStokRepository.getAll({
        faskes_uuid: req.faskes_uuid,
        jenis_lokasi: "depo",
        limit: 100,
      });

      if (!lokasiStocks) {
        throw new InternalServerException("lokasi stok belum di set");
      }

      const lokasi = lokasiStocks.data.find((item) =>
        (item.default_tujuan_order_permintaan ?? "").includes(
          Utils.pelayananToJenisStockCode(req.jenis_pelayanan)
        )
      );

      if (!lokasi) {
        throw new InternalServerException(
          `Lokasi stok default belum di set untuk pelayanan ${req.jenis_pelayanan}`
        );
      }

      req.lokasi_stok_uuid = lokasi.uuid;
    }

    // transaksi dibuka setelah validasi: galat validasi sebelumnya meninggalkan koneksi transaksi terbuka
    const transaction = await sequelizeInstance.transaction();
    try {
      const prescription = await PrescriptionRepository.createPrescription(
        req,
        transaction
      );
      const prescription_uuid = prescription.dataValues.uuid;

      // create prescription item
      for (const item of req.obat) {
        item.prescription_uuid = prescription_uuid;
        item.faskes_uuid = req.faskes_uuid;
        item.sisa_qty_order = item.medication_qty;

        ZodValidator.validate(
          PrescriptionValidation.CREATE_PRESCRIPTION_ITEM,
          item
        );

        const prescription_item =
          await PrescriptionRepository.createPrescriptionItem(
            item,
            transaction
          );

        // create prescription item racikan
        if (item.racikan !== null && item.racikan !== undefined) {
          for (const racikan of item.racikan) {
            ZodValidator.validate(
              PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
              racikan
            );

            racikan.faskes_uuid = req.faskes_uuid;
            racikan.prescription_item_uuid = prescription_item.dataValues.uuid;

            await PrescriptionRepository.createPrescriptionItemRacikan(
              racikan,
              transaction
            );
          }
        }
      }

      // insert into rekam medis
      try {
        await axiosInstance.post(
          `${REKAM_MEDIS_URL}/rekam-medis/order-obat`,
          {
            session_uuid: req.session_uuid,
            order_obat_uuid: prescription_uuid,
          },
          {
            headers: {
              Authorization: req.token,
            },
          }
        );
      } catch (error) {
        if (error.response) {
          throw new InternalServerException(
            "[SERVER REKAM MEDIS]: " + error.response.data.message
          );
        } else if (error.request) {
          throw new InternalServerException(
            "Tidak ada respons dari server rekam medis"
          );
        } else {
          throw new InternalServerException(
            "Kesalahan saat menyiapkan permintaan rekam medis"
          );
        }
      }

      await transaction.commit();

      return prescription;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async addObat(req) {
    if (!Array.isArray(req.obat) || req.obat.length === 0) {
      throw new BadRequestException("'obat' tidak boleh kosong");
    }

    // obat hanya boleh ditambah sebelum verifikasi (stok & tagihan belum terbentuk)
    await this.pastikanStatus(req.prescription_uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.RESEP_MASUK,
      PrescriptionHelper.STATUS.SUDAH_DITELAAH,
    ]);

    const transaction = await sequelizeInstance.transaction();
    try {
      for (const item of req.obat) {
        item.prescription_uuid = req.prescription_uuid;
        item.sisa_qty_order = item.medication_qty;
        item.faskes_uuid = req.faskes_uuid;

        ZodValidator.validate(
          PrescriptionValidation.CREATE_PRESCRIPTION_ITEM,
          item
        );

        const prescription_item =
          await PrescriptionRepository.createPrescriptionItem(
            item,
            transaction
          );

        if (item.racikan !== null && item.racikan !== undefined) {
          for (const racikan of item.racikan) {
            // validasi komponen racikan (sebelumnya yang divalidasi item induknya)
            ZodValidator.validate(
              PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
              racikan
            );

            racikan.faskes_uuid = req.faskes_uuid;
            racikan.prescription_item_uuid = prescription_item.dataValues.uuid;

            await PrescriptionRepository.createPrescriptionItemRacikan(
              racikan,
              transaction
            );
          }
        }
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async deleteObat(req) {
    ZodValidator.validate(PrescriptionValidation.DELETE_PRESCRIPTION_ITEM, req);

    await this.pastikanStatusItem(req.prescription_item_uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.RESEP_MASUK,
      PrescriptionHelper.STATUS.SUDAH_DITELAAH,
    ]);

    const result = await PrescriptionRepository.deletePrescriptionItem(
      req.prescription_item_uuid
    );
    if (result === 0) {
      throw new BadRequestException("data tidak ditemukan");
    }
    return result;
  }

  static async editSisaObat(data, prescription_item_uuid, faskes_uuid) {
    const validatedData = ZodValidator.validate(
      PrescriptionValidation.EDIT_SISA_OBAT,
      data
    );

    const transaction = await sequelizeInstance.transaction();
    try {
      const originalData =
        await PrescriptionRepository.getPrescriptionItemByUuid(
          prescription_item_uuid,
          transaction
        );

      if (!originalData || originalData.faskes_uuid !== faskes_uuid) {
        throw new NotfoundException("prescription item tidak ditemukan.");
      }

      const jumlahPermintaan = originalData.dataValues.medication_qty;

      if (validatedData.sisa_qty_order > jumlahPermintaan) {
        throw new BadRequestException(
          "jumlah sisa tidak boleh melebihi permintaan"
        );
      }
      if (validatedData.sisa_qty_order < 0) {
        throw new BadRequestException("jumlah sisa tidak boleh negatif");
      }

      await PrescriptionRepository.editSisaObat(
        prescription_item_uuid,
        validatedData,
        transaction
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Substitusi obat oleh apoteker sebelum verifikasi (status 1–2): stok belum terpotong dan tagihan belum
  // dibuat, sehingga cukup mengganti obat pada item resep; verifikasi kemudian memotong stok & menagih obat
  // pengganti. Obat pengganti wajib punya stok cukup di lokasi stok resep pada jenis stok yang dipilih.
  // Racikan ditolak: komponen racikan diubah lewat edit komposisi racikan.
  static async substituteItem(data, author) {
    const validatedData = ZodValidator.validate(
      PrescriptionValidation.SUBSTITUTE_PRESCRIPTION_ITEM,
      data
    );
    const faskes_uuid = author.faskesUuid;

    const transaction = await sequelizeInstance.transaction();

    try {
      const originalItem =
        await PrescriptionRepository.getPrescriptionItemByUuid(
          validatedData.prescription_item_uuid,
          transaction
        );

      if (!originalItem || originalItem.faskes_uuid !== faskes_uuid) {
        throw new NotfoundException(
          "Item resep yang akan diganti tidak ditemukan."
        );
      }

      // baris resep dikunci: substitusi tidak boleh berbarengan dengan verifikasi (pemotongan stok & tagihan)
      const resep = await PrescriptionRepository.lockPrescription(
        originalItem.prescription_uuid,
        faskes_uuid,
        transaction
      );
      if (!resep) {
        throw new NotfoundException("Resep tidak ditemukan.");
      }
      // setelah verifikasi stok & tagihan sudah terbentuk dari obat lama
      this.cekStatus(resep.order_status, [
        PrescriptionHelper.STATUS.RESEP_MASUK,
        PrescriptionHelper.STATUS.SUDAH_DITELAAH,
      ]);

      // substitusi mengganti item_medis_uuid; racikan diubah lewat edit komposisi, bukan substitusi
      if (originalItem.is_compound) {
        throw new BadRequestException(
          "Obat racikan tidak dapat disubstitusi; ubah komposisi racikannya."
        );
      }
      if (originalItem.item_medis_uuid === validatedData.item_medis_uuid) {
        throw new BadRequestException(
          "Obat pengganti sama dengan obat pada resep."
        );
      }

      const lokasiStok = (
        await PrescriptionRepository.getByUuid(
          originalItem.prescription_uuid,
          transaction,
          faskes_uuid
        )
      )?.lokasi_stok_uuid;
      if (!lokasiStok) {
        throw new BadRequestException("Lokasi stok resep belum dipilih.");
      }

      // obat pengganti: obat aktif faskes ini dengan stok belum kedaluwarsa di lokasi stok resep
      const [stokPengganti] = await PrescriptionRepository.getStokObatDiLokasi(
        {
          faskes_uuid,
          lokasi_stok_uuid: lokasiStok,
          item_medis_uuid: validatedData.item_medis_uuid,
          jenis_stok_uuid: validatedData.jenis_stok_uuid,
        },
        transaction
      );
      if (!stokPengganti) {
        throw new BadRequestException(
          "Obat pengganti tidak tersedia pada jenis stok tersebut di lokasi stok resep."
        );
      }
      if (Number(stokPengganti.sisa_stok) < validatedData.medication_qty) {
        throw new BadRequestException(
          `Stok ${stokPengganti.name} (${stokPengganti.jenis_stok}) tidak mencukupi: tersedia ${stokPengganti.sisa_stok}, dibutuhkan ${validatedData.medication_qty}.`
        );
      }

      // harga wajib ada agar verifikasi bisa menagih; HPP dicatat sebagai informasi (dihitung ulang saat verifikasi)
      const hargaBaruData = await DataMasterItemMedisRepository.getPrice({
        item_medis_uuid: validatedData.item_medis_uuid,
        jenis_stok_uuid: validatedData.jenis_stok_uuid,
      });
      const detailHarga = hargaBaruData?.detail_harga?.[0];
      if (!detailHarga) {
        throw new BadRequestException(
          `Harga ${stokPengganti.name} (${stokPengganti.jenis_stok}) belum diatur.`
        );
      }
      const konfigurasiHarga = await KonfigurasiHargaService.get({
        faskes_uuid,
      });
      const hargaSatuan = ["avg", "average"].includes(
        konfigurasiHarga?.metode_hpp
      )
        ? detailHarga.harga_avg ?? 0
        : detailHarga.harga_terakhir ?? 0;

      const KOLOM_KLINIS = [
        "medication_dose_qty",
        "medication_dose_satuan_uuid",
        "medication_period",
        "aturan_pakai_uuid",
        "cara_pakai_uuid",
        "route",
        "is_chronic",
        "prescription_notes",
      ];
      const dataAsal = {
        item_medis_uuid: originalItem.item_medis_uuid,
        jenis_stok_uuid: originalItem.jenis_stok_uuid,
        medication_qty: originalItem.medication_qty,
      };
      for (const kolom of KOLOM_KLINIS) {
        dataAsal[kolom] = originalItem[kolom] ?? null;
      }

      await PrescriptionRepository.createSubstitutionLog(
        {
          faskes_uuid,
          prescription_uuid: originalItem.prescription_uuid,
          prescription_item_uuid: originalItem.uuid,
          item_medis_asal_uuid: originalItem.item_medis_uuid,
          jenis_stok_asal_uuid: originalItem.jenis_stok_uuid,
          medication_qty_asal: originalItem.medication_qty,
          data_asal: dataAsal,
          item_medis_uuid: validatedData.item_medis_uuid,
          jenis_stok_uuid: validatedData.jenis_stok_uuid,
          medication_qty: validatedData.medication_qty,
          harga_satuan: hargaSatuan,
          kategori_alasan: validatedData.kategori_alasan,
          alasan: validatedData.alasan,
          persetujuan_dokter: validatedData.persetujuan_dokter,
          dokter_penyetuju: validatedData.persetujuan_dokter
            ? validatedData.dokter_penyetuju
            : null,
          catatan: validatedData.catatan ?? null,
          petugas: author.username,
        },
        transaction
      );

      // dosis/aturan/cara pakai tetap mengikuti resep kecuali diisi; harga & batch stok diisi saat verifikasi
      const perubahan = {
        item_medis_uuid: validatedData.item_medis_uuid,
        jenis_stok_uuid: validatedData.jenis_stok_uuid,
        medication_qty: validatedData.medication_qty,
        sisa_qty_order: validatedData.medication_qty,
        harga_satuan: null,
      };
      for (const kolom of [
        "medication_dose_qty",
        "medication_dose_satuan_uuid",
        "aturan_pakai_uuid",
        "cara_pakai_uuid",
      ]) {
        if (validatedData[kolom] !== undefined) perubahan[kolom] = validatedData[kolom];
      }

      await PrescriptionRepository.updatePrescriptionItem(
        originalItem.uuid,
        perubahan,
        transaction
      );

      await transaction.commit();
      return {
        prescription_uuid: originalItem.prescription_uuid,
        prescription_item_uuid: originalItem.uuid,
        item_medis_asal_uuid: originalItem.item_medis_uuid,
        item_medis_uuid: validatedData.item_medis_uuid,
        jenis_stok_uuid: validatedData.jenis_stok_uuid,
        medication_qty: validatedData.medication_qty,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Pilihan obat pengganti untuk satu item resep: obat lain yang punya stok di lokasi stok resep.
  static async getOpsiSubstitusi(prescription_item_uuid, faskes_uuid) {
    const item = await PrescriptionRepository.getPrescriptionItemByUuid(
      prescription_item_uuid
    );
    if (!item || item.faskes_uuid !== faskes_uuid) {
      throw new NotfoundException("Item resep tidak ditemukan.");
    }
    const resep = await PrescriptionRepository.getByUuid(
      item.prescription_uuid,
      undefined,
      faskes_uuid
    );
    if (!resep) {
      throw new NotfoundException("Resep tidak ditemukan.");
    }
    if (!resep.lokasi_stok_uuid) {
      throw new BadRequestException("Lokasi stok resep belum dipilih.");
    }
    const daftar = await PrescriptionRepository.getStokObatDiLokasi({
      faskes_uuid,
      lokasi_stok_uuid: resep.lokasi_stok_uuid,
    });
    return daftar.filter((o) => o.item_medis_uuid !== item.item_medis_uuid);
  }

  static async getRiwayatSubstitusi(prescription_uuid, faskes_uuid) {
    const resep = await PrescriptionRepository.getByUuid(
      prescription_uuid,
      undefined,
      faskes_uuid
    );
    if (!resep) {
      throw new NotfoundException("Resep tidak ditemukan.");
    }
    return PrescriptionHelper.lampirkanSubstitusi(
      {},
      await PrescriptionRepository.getSubstitutionByPrescription(
        prescription_uuid,
        faskes_uuid
      )
    ).riwayat_substitusi;
  }

  static async updatePrescription(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_PRESCRIPTION, req);

    await this.pastikanStatus(req.uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.RESEP_MASUK,
      PrescriptionHelper.STATUS.SUDAH_DITELAAH,
    ]);

    // hanya kolom yang boleh diubah dari layar order (sebelumnya seluruh isi body ikut tersimpan)
    return await PrescriptionRepository.editPrescription({
      uuid: req.uuid,
      is_takeaway: req.is_takeaway,
      lokasi_stok_uuid: req.lokasi_stok_uuid,
    });
  }

  static async updateObat(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_OBAT, req);

    const item = await this.pastikanStatusItem(req.uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.RESEP_MASUK,
      PrescriptionHelper.STATUS.SUDAH_DITELAAH,
    ]);
    // obat non-racikan hanya boleh diganti lewat substitusi agar obat asal & alasannya tercatat
    if (
      !item.is_compound &&
      req.item_medis_uuid &&
      req.item_medis_uuid !== item.item_medis_uuid
    ) {
      throw new BadRequestException(
        "Penggantian obat dilakukan lewat tombol Substitusi agar obat asal dan alasannya tercatat."
      );
    }

    const transaction = await sequelizeInstance.transaction();
    try {
      if (req.type === "racikan" && item.is_compound) {
        for (const racikan of req.racikan ?? []) {
          if (
            racikan.uuid === null ||
            racikan.uuid === undefined ||
            racikan.uuid === ""
          ) {
            ZodValidator.validate(
              PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
              racikan
            );

            await PrescriptionRepository.createPrescriptionItemRacikan(
              {
                item_medis_uuid: racikan.item_medis_uuid,
                medication_qty: racikan.medication_qty,
                faskes_uuid: req.faskes_uuid,
                prescription_item_uuid: req.uuid,
              },
              transaction
            );

            continue;
          }

          // komponen harus milik item resep ini
          const komponen = await PrescriptionRepository.getRacikanByUuid(
            racikan.uuid
          );
          if (!komponen || komponen.prescription_item_uuid !== req.uuid) {
            throw new BadRequestException(
              `komponen racikan ${racikan.uuid} tidak ditemukan pada obat ini`
            );
          }

          if (racikan.is_deleted) {
            await PrescriptionRepository.deletePrescriptionItemRacikan(
              racikan.uuid,
              transaction
            );

            continue;
          }

          if (racikan.is_updated) {
            ZodValidator.validate(
              PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN,
              racikan
            );

            await PrescriptionRepository.editPrescriptionItemRacikan(
              {
                uuid: racikan.uuid,
                item_medis_uuid: racikan.item_medis_uuid,
                medication_qty: racikan.medication_qty,
              },
              transaction
            );
          }
        }
      }

      // kolom klinis yang boleh diubah; harga, stok, dan induk resep tidak boleh dikirim dari klien
      const DIIZINKAN = [
        "item_medis_uuid",
        "medication_qty",
        "medication_dose_qty",
        "medication_dose_satuan_uuid",
        "medication_period",
        "aturan_pakai_uuid",
        "cara_pakai_uuid",
        "prescription_notes",
        "is_chronic",
        "route",
        "nama_racikan",
        "jenis_racikan",
        "bentuk_racikan_uuid",
      ];
      const perubahan = { uuid: req.uuid };
      for (const kolom of DIIZINKAN) {
        if (req[kolom] !== undefined) perubahan[kolom] = req[kolom];
      }
      if (perubahan.medication_qty !== undefined) {
        perubahan.sisa_qty_order = perubahan.medication_qty;
      }

      const result = await PrescriptionRepository.editPrescriptionItem(
        perubahan,
        transaction
      );
      await transaction.commit();
      return result;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async getHistoryObat(req) {
    return await PrescriptionRepository.getHistoryObat(req);
  }

  static async getOrderBySomeUuid(req) {
    ZodValidator.validate(PrescriptionValidation.GET_SOME_ORDER, req);
    const rawData = await PrescriptionRepository.getOrderBySomeUuid(
      req.uuides,
      req.faskes_uuid
    );
    let data = [];

    for (const resep of rawData) {
      resep.dataValues.jumlah_obat = resep.dataValues.obat.length;

      resep.dataValues.lokasi_stok = resep.dataValues.lokasi_stok?.name;

      for (const obatItem of resep.dataValues.obat) {
        if (obatItem.is_compound) {
          resep.dataValues.is_racikan = true;
        }

        if (obatItem.is_chronic) {
          resep.dataValues.is_chronic = true;
        }
      }

      resep.dataValues.obat = undefined;

      data.push(resep.dataValues);
    }

    if (data.length <= 0) {
      throw new BadRequestException("data tidak ditemukan");
    }

    return data;
  }

  static async updateTelaah(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_TELAAH, {
      ...req,
      status_telaah: true,
    });
    await this.pastikanStatus(req.uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.RESEP_MASUK,
    ]);

    return await PrescriptionRepository.editPrescription({
      uuid: req.uuid,
      status_telaah: true,
      petugas_telaah: req.petugas_telaah,
      order_status: PrescriptionHelper.STATUS.SUDAH_DITELAAH,
    });
  }

  // Batal order. Sebelum verifikasi cukup ubah status; setelah verifikasi (status 3) stok yang sudah
  // terpotong dikembalikan ke batch asalnya dan tagihan obat resep ini ditarik dari kasir.
  // Resep yang sudah siap diserahkan harus dibatalkan penyiapannya dulu; yang sudah diserahkan lewat Retur.
  static async batalOrder(req) {
    ZodValidator.validate(PrescriptionValidation.BATAL_ORDER, req);

    const transaction = await sequelizeInstance.transaction();
    try {
      const terkunci = await PrescriptionRepository.lockPrescription(
        req.uuid,
        req.faskes_uuid,
        transaction
      );
      if (!terkunci) {
        throw new BadRequestException("data prescription tidak ditemukan");
      }
      this.cekStatus(terkunci.order_status, [
        PrescriptionHelper.STATUS.RESEP_MASUK,
        PrescriptionHelper.STATUS.SUDAH_DITELAAH,
        PrescriptionHelper.STATUS.OBAT_DISIAPKAN,
      ]);

      if (terkunci.order_status === PrescriptionHelper.STATUS.OBAT_DISIAPKAN) {
        const prescription = await PrescriptionRepository.getByUuid(
          req.uuid,
          transaction
        );

        // tagihan yang sudah ditutup/dibayar di kasir tidak bisa ditarik; pengembalian lewat Retur
        const tagihan = await TagihanRepository.statusTagihanRef(
          `resep:${req.uuid}`,
          req.faskes_uuid,
          transaction
        );
        if (tagihan?.tertutup) {
          throw new BadRequestException(
            `Tagihan resep ${prescription.no_resep} sudah ditutup/dibayar di kasir; gunakan Retur Obat.`
          );
        }

        // item & jenis stok dibaca dari batch-nya: catatan resep lama (sebelum perbaikan) tidak menyimpannya
        const batch = new Map(
          (
            await StockMedisRepository.findStocksWithDetails(
              prescription.obat.flatMap((o) =>
                (o.stok_medis_uuides ?? []).map((c) => c.stock_medis_uuid)
              )
            )
          ).map((s) => [s.uuid, s.item_medis_jenis_stok])
        );

        for (const obat of prescription.obat) {
          for (const catatan of obat.stok_medis_uuides ?? []) {
            const asal = batch.get(catatan.stock_medis_uuid);
            await StockMedisRepository.addQuantity(
              {
                stock_medis_uuid: catatan.stock_medis_uuid,
                quantity: catatan.quantity,
              },
              {
                faskes_uuid: req.faskes_uuid,
                petugas: req.petugas_pembatalan,
                kode_referensi: prescription.no_resep,
                keterangan_prefix: `Batal Resep: ${prescription.no_resep}`,
                item_uuid: catatan.item_medis_uuid ?? asal?.item_medis_uuid ?? obat.item_medis_uuid,
                jenis_stok_uuid: catatan.jenis_stok_uuid ?? asal?.jenis_stok_uuid ?? obat.jenis_stok_uuid,
                lokasi_stok_uuid: prescription.lokasi_stok_uuid,
              },
              transaction
            );
          }

          await PrescriptionRepository.editPrescriptionItem(
            { uuid: obat.uuid, stok_medis_uuides: null },
            transaction
          );
        }

        // tarik item tagihan resep ini (dikirim saat verifikasi dengan referensi yang sama)
        await this.kirimTagihan(prescription, [], req.token);
      }

      await PrescriptionRepository.editPrescription(
        {
          uuid: req.uuid,
          order_status: PrescriptionHelper.STATUS.BATAL,
          petugas_pembatalan: req.petugas_pembatalan,
          alasan_batal: req.alasan_batal,
        },
        transaction
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async updateVerifikasi(req) {
    const validatedData = ZodValidator.validate(
      PrescriptionValidation.UPDATE_VERIFIKASI,
      req
    );

    const konfigurasiHarga = await KonfigurasiHargaService.get(req);
    const transaction = await sequelizeInstance.transaction();

    try {
      // baris resep dikunci: dua klik/dua petugas bersamaan tidak boleh memotong stok & menagih dua kali
      const terkunci = await PrescriptionRepository.lockPrescription(
        req.uuid,
        req.faskes_uuid,
        transaction
      );
      if (!terkunci) {
        throw new BadRequestException("data prescription tidak ditemukan");
      }
      // verifikasi hanya setelah telaah (status 2); sebelumnya resep batal (0) pun bisa diverifikasi
      this.cekStatus(terkunci.order_status, [
        PrescriptionHelper.STATUS.SUDAH_DITELAAH,
      ]);

      const prescription = await PrescriptionRepository.getByUuid(
        req.uuid,
        transaction
      );

      const itemStockMap = new Map(
        validatedData.items?.map((i) => [i.item_uuid, i.jenis_stok_uuid]) || []
      );

      const racikanStockMap = new Map(
        validatedData.racikan_items?.map((r) => [
          r.racikan_uuid,
          r.jenis_stok_uuid,
        ]) || []
      );

      await this.setPriceInPrescription(
        prescription,
        konfigurasiHarga,
        itemStockMap,
        racikanStockMap,
        transaction
      );

      const updatedPrescription = await PrescriptionRepository.getByUuid(
        req.uuid,
        transaction
      );

      const baseMutasiData = {
        faskes_uuid: req.faskes_uuid,
        petugas: req.petugas_verifikasi,
        kode_referensi: updatedPrescription.no_resep,
        keterangan_prefix: `Verifikasi Resep: ${updatedPrescription.no_resep}`,
      };

      for (const obat of updatedPrescription.obat) {
        let usedStock = [];

        if (obat.is_compound) {
          // batch tiap komponen dicatat semua (sebelumnya hanya komponen terakhir yang tersimpan,
          // sehingga retur/batal tidak bisa mengembalikan stok komponen lain)
          for (const racikan of obat.racikan) {
            if (!racikan.jenis_stok_uuid) {
              throw new BadRequestException(
                `Jenis stok untuk komponen racikan ${racikan.item_medis?.name ?? racikan.uuid} belum dipilih.`
              );
            }

            const terpakai = await StockMedisRepository.reduceQuantity(
              {
                item_medis_uuid: racikan.item_medis_uuid,
                jenis_stok_uuid: racikan.jenis_stok_uuid,
                quantity: racikan.medication_qty,
                metode_pemotongan_stok: konfigurasiHarga.metode_pemotongan_stok,
                name: racikan.item_medis?.name,
                lokasi_stok_uuid: prescription.lokasi_stok_uuid,
              },
              {
                ...baseMutasiData,
                item_uuid: racikan.item_medis_uuid,
                jenis_stok_uuid: racikan.jenis_stok_uuid,
              },
              transaction
            );
            usedStock.push(
              ...terpakai.map((t) => ({
                ...t,
                item_medis_uuid: racikan.item_medis_uuid,
                jenis_stok_uuid: racikan.jenis_stok_uuid,
              }))
            );
          }
        } else {
          if (!obat.jenis_stok_uuid) {
            throw new BadRequestException(
              `Jenis stok untuk obat ${obat.item_medis?.name ?? obat.uuid} belum dipilih.`
            );
          }

          usedStock = await StockMedisRepository.reduceQuantity(
            {
              item_medis_uuid: obat.item_medis_uuid,
              jenis_stok_uuid: obat.jenis_stok_uuid,
              quantity: obat.medication_qty,
              lokasi_stok_uuid: prescription.lokasi_stok_uuid,
              metode_pemotongan_stok: konfigurasiHarga.metode_pemotongan_stok,
              name: obat.item_medis?.name,
            },
            {
              ...baseMutasiData,
              item_uuid: obat.item_medis_uuid,
              jenis_stok_uuid: obat.jenis_stok_uuid,
            },
            transaction
          );
        }

        await PrescriptionRepository.editPrescriptionItem(
          { uuid: obat.uuid, stok_medis_uuides: usedStock },
          transaction
        );
      }

      // harga jual = HPP (harga_satuan hasil verifikasi) x (1 + margin% Konfigurasi Harga);
      // racikan ditagih sebagai satu paket: komponen + biaya racik + embalase. PPN dihitung kasir di level tagihan.
      const billingItems = PrescriptionHelper.itemTagihan(
        updatedPrescription.obat,
        konfigurasiHarga?.margin
      );

      await PrescriptionRepository.editPrescription(
        {
          uuid: req.uuid,
          order_status: PrescriptionHelper.STATUS.OBAT_DISIAPKAN,
          status_verifikasi: true,
          petugas_verifikasi: req.petugas_verifikasi,
          waktu_verifikasi: toEpochDate(new Date()),
          no_invoice: Utils.generate4Code("INV"),
          // total_harga = nilai yang ditagihkan ke pasien (sebelumnya HPP tanpa margin, beda dengan tagihan kasir)
          total_harga: billingItems.reduce(
            (sum, item) => sum + Number(item.harga || 0) * Number(item.qty || 0),
            0
          ),
        },
        transaction
      );

      await this.kirimTagihan(prescription, billingItems, req.token);

      await transaction.commit();
      return updatedPrescription;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  // Kirim (atau tarik, bila items kosong) tagihan obat resep ke kasir lewat rekam medis.
  // Referensi `resep:<uuid>` membuat pengiriman ulang mengganti item lama, bukan menambah.
  static async kirimTagihan(prescription, items, token) {
    try {
      await axiosInstance.post(
        `${REKAM_MEDIS_URL}/rekam-medis/pelayanan/billing-layanan`,
        {
          session_uuid: prescription.session_uuid,
          type: "order_obat",
          ref: `resep:${prescription.uuid}`,
          items,
        },
        {
          headers: {
            Authorization: token,
          },
        }
      );
    } catch (apiError) {
      throw new InternalServerException(
        "Gagal sinkronisasi ke Billing: " +
          (apiError?.response?.data?.errors?.[0]?.message ||
            apiError?.response?.data?.message ||
            apiError.message)
      );
    }
  }

  static async updateSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_SIAP_DISERAHKAN, req);

    // hanya resep yang sudah diverifikasi (stok terpotong & tertagih)
    await this.pastikanStatus(req.uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.OBAT_DISIAPKAN,
    ]);

    return await PrescriptionRepository.editPrescription({
      uuid: req.uuid,
      order_status: PrescriptionHelper.STATUS.SIAP_DISERAHKAN,
      petugas_penyiapan_obat: req.petugas_penyiapan_obat,
      waktu_penyiapan: toEpochDate(new Date()),
    });
  }

  static async batalSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.BATAL_DISERAHKAN, req);
    await this.pastikanStatus(req.uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.SIAP_DISERAHKAN,
    ]);
    // kembali ke "Obat Disiapkan"; jejak penyiapan dikosongkan agar waktu tunggu tidak terhitung salah
    return await PrescriptionRepository.editPrescription({
      uuid: req.uuid,
      order_status: PrescriptionHelper.STATUS.OBAT_DISIAPKAN,
      petugas_penyiapan_obat: null,
      waktu_penyiapan: null,
    });
  }

  static async updateDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_SERAHKAN, req);
    const prescription = await this.pastikanStatus(req.uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.SIAP_DISERAHKAN,
    ]);
    // obat dibayar dulu di kasir, kecuali rawat inap & pasien penjamin (lihat tagihan-farmasi-service.js)
    await TagihanFarmasiService.pastikanSudahDibayar(prescription, "resep", req.faskes_uuid);
    return await PrescriptionRepository.editPrescription({
      uuid: req.uuid,
      order_status: PrescriptionHelper.STATUS.DISERAHKAN,
      penerima: req.penerima,
      no_hp_penerima: req.no_hp_penerima,
      petugas_edukasi: req.petugas_edukasi,
      status_edukasi: true,
      petugas_pemberi: req.petugas_pemberi,
      waktu_pemberian: toEpochDate(new Date()),
    });
  }

  static async updateLokasiStok(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_LOKASI_STOK, req);
    // setelah verifikasi stok sudah terpotong dari lokasi lama
    await this.pastikanStatus(req.uuid, req.faskes_uuid, [
      PrescriptionHelper.STATUS.RESEP_MASUK,
      PrescriptionHelper.STATUS.SUDAH_DITELAAH,
    ]);
    return await PrescriptionRepository.editPrescription({
      uuid: req.uuid,
      lokasi_stok_uuid: req.lokasi_stok_uuid,
    });
  }

  static async getAll(req) {
    setRangeDate(req);

    ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
    const rawData = await PrescriptionRepository.getAllPrescription(req);

    const formattedData = PrescriptionHelper.mapPrescriptionList(rawData);

    let resep_masuk = [];
    let obat_disiapkan = [];
    let penyerahan_obat = [];

    for (const resep of formattedData) {
      const resepData = resep.dataValues || resep;

      if (resepData.order_status === 1 || resepData.order_status === 2) {
        resep_masuk.push(resepData);
      } else if (resepData.order_status === 3) {
        obat_disiapkan.push(resepData);
      } else if (resepData.order_status === 4) {
        penyerahan_obat.push(resepData);
      }
    }

    // status pembayaran kasir pada tahap siap diserahkan (tombol Serahkan nonaktif bila menunggu pembayaran)
    const statusBayar = await TagihanFarmasiService.statusPembayaran(penyerahan_obat, "resep", req.faskes_uuid);
    for (const resep of penyerahan_obat) resep.status_pembayaran = statusBayar.get(resep.uuid);

    return {
      resep_masuk,
      obat_disiapkan,
      penyerahan_obat,
    };
  }

  static async updateJenisItem(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_JENIS_ITEM, req);

    const STATUS_BOLEH = [
      PrescriptionHelper.STATUS.RESEP_MASUK,
      PrescriptionHelper.STATUS.SUDAH_DITELAAH,
    ];
    if (req.is_racikan) {
      const komponen = await PrescriptionRepository.getRacikanByUuid(req.uuid);
      if (!komponen || komponen.faskes_uuid !== req.faskes_uuid) {
        throw new NotfoundException("komponen racikan tidak ditemukan");
      }
      await this.pastikanStatusItem(
        komponen.prescription_item_uuid,
        req.faskes_uuid,
        STATUS_BOLEH
      );
      return await PrescriptionRepository.editPrescriptionItemRacikan({
        uuid: req.uuid,
        jenis_stok_uuid: req.jenis_stok_uuid,
      });
    } else {
      await this.pastikanStatusItem(req.uuid, req.faskes_uuid, STATUS_BOLEH);
      return await PrescriptionRepository.editPrescriptionItem({
        uuid: req.uuid,
        jenis_stok_uuid: req.jenis_stok_uuid,
      });
    }
  }

  static async setPriceInPrescription(
    prescription,
    konfigurasiHarga,
    itemStockMap,
    racikanStockMap,
    transaction
  ) {
    let totalHarga = 0;

    const hargaSatuanDari = (hargaItem) =>
      ["avg", "average"].includes(konfigurasiHarga.metode_hpp)
        ? hargaItem.detail_harga[0].dataValues.harga_avg ?? 0
        : hargaItem.detail_harga[0].dataValues.harga_terakhir ?? 0;

    for (const item of prescription.obat) {
      if (item.is_compound) {
        for (const racikan of item.racikan) {
          // jenis stok pilihan apoteker di layar verifikasi (sebelumnya peta ini dibuat tetapi tidak dipakai)
          if (racikanStockMap.get(racikan.uuid)) {
            racikan.jenis_stok_uuid = racikanStockMap.get(racikan.uuid);
          }
          if (!racikan.jenis_stok_uuid) {
            throw new BadRequestException(
              `Jenis stok untuk komponen racikan ${racikan.item_medis?.name ?? racikan.uuid} belum dipilih.`
            );
          }

          const hargaItem = await DataMasterItemMedisRepository.getPrice({
            item_medis_uuid: racikan.item_medis_uuid,
            jenis_stok_uuid: racikan.jenis_stok_uuid,
          });

          if (
            hargaItem === null ||
            !hargaItem.detail_harga ||
            hargaItem.detail_harga.length === 0
          ) {
            throw new BadRequestException(
              `Harga item medis ${racikan.item_medis?.name} tidak ditemukan`
            );
          }

          const hargaSatuan = hargaSatuanDari(hargaItem);

          totalHarga += hargaSatuan * racikan.medication_qty;

          await PrescriptionRepository.editPrescriptionItemRacikan(
            {
              uuid: racikan.uuid,
              harga_satuan: hargaSatuan,
              jenis_stok_uuid: racikan.jenis_stok_uuid,
            },
            transaction
          );
        }

        const tarif = await DataMasterBentukRacikanRepository.getByUuid(
          item.bentuk_racikan_uuid
        );
        if (!tarif) {
          throw new BadRequestException(`tarif racikan tidak ditemukan`);
        }

        // "paket" sebelumnya memakai 1 + floor(qty/isi): 10 bungkus dengan isi paket 10 tertagih 2 paket
        const multiplier = PrescriptionHelper.kaliBiayaRacik(
          konfigurasiHarga.metode_biaya_racikan,
          item.medication_qty,
          tarif.jumlah,
          item.racikan.length
        );
        if (multiplier === null) {
          throw new BadRequestException(`metode biaya racikan belum di set`);
        }

        totalHarga +=
          tarif.tarif_racik * multiplier + tarif.tarif_embalase * multiplier;

        await PrescriptionRepository.editPrescriptionItem(
          {
            uuid: item.uuid,
            biaya_racik: tarif.tarif_racik * multiplier,
            biaya_embalase: tarif.tarif_embalase * multiplier,
          },
          transaction
        );
      } else {
        // jenis stok pilihan apoteker di layar verifikasi (bila item belum menyimpannya)
        if (!item.jenis_stok_uuid && itemStockMap.get(item.uuid)) item.jenis_stok_uuid = itemStockMap.get(item.uuid);
        if (!item.jenis_stok_uuid) {
          throw new BadRequestException(
            `Jenis stok untuk obat ${item.item_medis?.name ?? item.uuid} belum dipilih.`
          );
        }
        const hargaItem = await DataMasterItemMedisRepository.getPrice({
          item_medis_uuid: item.item_medis_uuid,
          jenis_stok_uuid: item.jenis_stok_uuid,
        });

        if (
          hargaItem === null ||
          !hargaItem.detail_harga ||
          hargaItem.detail_harga.length === 0
        ) {
          throw new BadRequestException(
            `Harga item medis ${item.item_medis?.name} tidak ditemukan (item: ${item.item_medis_uuid}, stok: ${item.jenis_stok_uuid})`
          );
        }

        const hargaSatuan = hargaSatuanDari(hargaItem);

        totalHarga += hargaSatuan * item.medication_qty;

        await PrescriptionRepository.editPrescriptionItem(
          {
            uuid: item.uuid,
            harga_satuan: hargaSatuan,
            jenis_stok_uuid: item.jenis_stok_uuid,
          },
          transaction
        );
      }
    }

    return totalHarga;
  }

  static cekStatus(orderStatus, statusDiizinkan) {
    if (!statusDiizinkan.includes(orderStatus)) {
      throw new BadRequestException(
        `order status tidak memungkinkan aksi ini (status resep: ${
          PrescriptionHelper.NAMA_STATUS[orderStatus] ?? orderStatus
        })`
      );
    }
  }

  // Resep harus milik faskes pengguna dan berstatus salah satu dari statusDiizinkan.
  // Menggantikan statusLessThan yang hanya membatasi batas atas (resep batal/status 0 lolos semua aksi).
  static async pastikanStatus(uuid, faskes_uuid, statusDiizinkan) {
    if (!uuid) {
      throw new BadRequestException("prescription uuid tidak boleh kosong");
    }

    const prescription = await PrescriptionRepository.getByUuid(
      uuid,
      undefined,
      faskes_uuid
    );
    if (prescription === null) {
      throw new BadRequestException("data prescription tidak ditemukan");
    }

    this.cekStatus(prescription.order_status, statusDiizinkan);
    return prescription;
  }

  // Sama dengan pastikanStatus, tetapi dari uuid item resep.
  static async pastikanStatusItem(item_uuid, faskes_uuid, statusDiizinkan) {
    const item = await PrescriptionRepository.getPrescriptionUuidByObat(
      item_uuid
    );
    if (!item || item.faskes_uuid !== faskes_uuid) {
      throw new NotfoundException(
        `Item resep dengan UUID ${item_uuid} tidak ditemukan.`
      );
    }
    await this.pastikanStatus(
      item.prescription_uuid,
      faskes_uuid,
      statusDiizinkan
    );
    return item;
  }

  static async getForFpo(req) {
    ZodValidator.validate(PrescriptionValidation.GET_FOR_FPO, req);
    return await PrescriptionRepository.getForFpo(req);
  }

  static async getEticketData(uuid, faskes_uuid) {
    // query cetak resep sudah meng-include komposisi racikan
    const prescription = await PrescriptionRepository.getForPrescriptionPrint(uuid, faskes_uuid);
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }

    const namaObat = (item) => {
      if (!item.is_compound) return item.item_medis?.name || "-";
      const komposisi = (item.racikan ?? [])
        .map((r) => r.item_medis?.name)
        .filter(Boolean)
        .join(", ");
      return `Racikan ${item.bentuk_racikan?.nama_bentuk_racikan ?? ""}`.trim() + (komposisi ? ` (${komposisi})` : "");
    };

    const aturanPakai = (aturan) => {
      if (!aturan) return "-";
      if (aturan.name) return aturan.name;
      if (aturan.frekuensi && aturan.periode_unit) return `${aturan.frekuensi}x, ${aturan.periode} ${aturan.periode_unit}`;
      return "-";
    };

    return (prescription.obat ?? []).map((item) => ({
      nama_faskes: prescription.faskes?.name,
      no_resep: prescription.no_resep,
      date: prescription.order_date,
      no_rm: prescription.no_rm,
      nama_pasien: prescription.patient?.name,
      tanggal_lahir: prescription.patient?.birth_detail?.birth_date,
      jenis: item.is_compound ? "Racikan" : "Non-Racikan",
      jumlah_obat: item.medication_qty,
      nama_obat: namaObat(item),
      satuan: item.is_compound
        ? item.bentuk_racikan?.nama_bentuk_racikan
        : item.item_medis?.satuan_penggunaan?.name,
      aturan_pakai: aturanPakai(item.aturan_pakai),
      cara_pakai: item.cara_pakai?.cara_pakai,
      catatan: item.prescription_notes,
    }));
  }

  static async getPrintPrescription(uuid, faskes_uuid) {
    const prescription = await PrescriptionRepository.getForPrescriptionPrint(
      uuid,
      faskes_uuid
    );
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }
    // e-resep mencantumkan obat yang disubstitusi beserta obat asal & alasannya
    return PrescriptionHelper.lampirkanSubstitusi(
      prescription.get({ plain: true }),
      await PrescriptionRepository.getSubstitutionByPrescription(
        uuid,
        faskes_uuid
      ),
      "obat"
    );
  }

  static async getForInvoicePrint(uuid, faskes_uuid) {
    const prescription = await PrescriptionRepository.getForInvoicePrint(uuid, faskes_uuid);
    if (prescription === null) {
      throw new BadRequestException("data tidak ditemukan");
    }
    return prescription;
  }
}
