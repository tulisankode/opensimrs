import sequelizeInstance from "@opensimrs/model-sdk/instance";
import flagDecider from "../helpers/flag-decider.js";
import ObservationItemRepository from "../repositories/observation-item-repository.js";
import OrderLabRepository from "../repositories/order-lab-repository.js";
import PatientRepository from "../repositories/patient-repository.js";
import HasilPemeriksaanValidation from "../validations/hasil-pemeriksaan-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import ExpertiseValidation from "../validations/expertise-validation.js";
import toEpochDate from "../helpers/date-helper.js";
import { status } from "./order-lab-service.js";
import { NotfoundException } from "@opensimrs/model-sdk/exceptions";
import checkNilaiRujukan from "../helpers/check-nilai-rujukan.js";
import SpesimenRepository from "../repositories/spesimen-repository.js";
import BadRequestException from "../exception/bad-request-exception.js";

export default class HasilPemeriksaanService {
  static async inputHasilPemeriksaan(req) {
    // proses validasi
    console.log(req);
    const validdata = ZodValidator.validate(
      HasilPemeriksaanValidation.INPUT_HASIL_PEMERIKSAAN,
      req
    );

    // get data order lab
    const orderLabExist = await OrderLabRepository.findByUuid(
      validdata.order_lab_uuid,
      validdata.faskes_uuid
    );

    if (!orderLabExist) {
      throw new NotfoundException("Order Lab tidak ada");
    }

    if (orderLabExist.order_status !== status.PERIKSA) {
      throw new BadRequestException("Order Lab belum diperiksa");
    }

    // get item pemeriksaan
    const observationItemUuids = validdata.hasil_pemeriksaan.map(
      (item) => item.observation_item_uuid
    );

    // Cari observation items berdasarkan UUID
    const observationItems = await ObservationItemRepository.findByUuids(
      observationItemUuids,
      validdata.faskes_uuid
    );

    if (observationItems.length !== observationItemUuids.length) {
      throw new NotfoundException("Observation Item tidak ditemukan");
    }

    // get pasien
    const patient = await PatientRepository.findByUuid(
      orderLabExist.patient_uuid,
      validdata.faskes_uuid
    );

    // Mapping hasil pemeriksaan dengan data yang valid
    const hasilPemeriksaan = validdata.hasil_pemeriksaan.map((item, index) => {
      const observationItem = observationItems.find(
        (oi) => oi.uuid === item.observation_item_uuid
      );

      if (!observationItem) {
        throw new Error(
          `Observation Item dengan UUID ${item.observation_item_uuid} tidak ditemukan`
        );
      }

      return {
        observation_item_uuid: item.observation_item_uuid,
        item_pemeriksaan_uuid: observationItem.item_pemeriksaan_uuid,
        result: item.result,
        jenis_input: observationItem.item_pemeriksaan.jenis_input,
        status_nilai_rujukan:
          observationItem.item_pemeriksaan.status_nilai_rujukan,
        dirujuk: observationItem.dirujuk,
      };
    });

    const pemeriksaanMustCheckingFlag = hasilPemeriksaan.filter(
      (item) => item.status_nilai_rujukan
    );

    // Umur dari kolom umur birth_detail; bila kosong (pasien dari Admisi hanya menyimpan tanggal lahir) dihitung dari
    // tanggal lahir agar nilai rujukan per umur tetap dapat dipilih.
    const bd = patient.birth_detail ?? {};
    let ageYear = bd.ageYear ?? bd.age_year;
    let ageMonth = bd.ageMonth ?? bd.age_month;
    let ageDay = bd.ageDay ?? bd.age_day;
    const tglLahir = bd.birthDate ?? bd.birth_date;
    if ((ageYear === null || ageYear === undefined) && tglLahir) {
      const lahir = new Date(tglLahir);
      const kini = new Date();
      let th = kini.getFullYear() - lahir.getFullYear();
      let bl = kini.getMonth() - lahir.getMonth();
      let hr = kini.getDate() - lahir.getDate();
      if (hr < 0) { bl -= 1; hr += 30; }
      if (bl < 0) { th -= 1; bl += 12; }
      ageYear = th; ageMonth = bl; ageDay = hr;
    }
    const patientData = {
      gender: patient.gender,
      ageYear: ageYear === null || ageYear === undefined ? NaN : Number(ageYear),
      ageMonth: Number(ageMonth ?? 0),
      ageDay: Number(ageDay ?? 0),
    };

    const flags = await flagDecider(
      pemeriksaanMustCheckingFlag,
      patientData,
      validdata.faskes_uuid
    );

    console.log("decide flags ==> ", JSON.stringify(flags));

    const mergedDataHasilPemeriksaan = hasilPemeriksaan.map((item) => {
      // Cari item yang sesuai di flagDecider berdasarkan observation_item_uuid
      const flagItem = flags.find(
        (flag) => flag.observation_item_uuid === item.observation_item_uuid
      );

      // Jika ditemukan, gabungkan datanya, jika tidak set flag menjadi null
      return {
        observation_item_uuid: item.observation_item_uuid,
        item_pemeriksaan_uuid: item.item_pemeriksaan_uuid,
        result: item.result,
        flag: flagItem ? flagItem.flag : null,
        dirujuk: item.dirujuk,
      };
    });

    await sequelizeInstance.transaction(async (t) => {
      if (validdata.catatan_analis) {
        await OrderLabRepository.update(
          validdata.order_lab_uuid,
          validdata.faskes_uuid,
          {
            catatan_analis: validdata.catatan_analis,
          },
          t
        );
      }

      for (const observation of mergedDataHasilPemeriksaan) {
        const { dirujuk, ...data } = observation;
        data.waktu_periksa = toEpochDate(new Date());
        data.status_periksa =
          data.result && data.result.trim() !== "" ? true : false;

        if (dirujuk && data.status_periksa) {
          data.status_rujukan = "hasil_diterima";
        }

        await ObservationItemRepository.updateResult(
          data.observation_item_uuid,
          validdata.faskes_uuid,
          data,
          t
        );
      }
    });
  }

  static async expertise(req) {
    const validata = ZodValidator.validate(
      ExpertiseValidation.INPUT_EXPERTISE,
      req
    );

    const orderLabExist = await OrderLabRepository.findByUuid(
      validata.order_lab_uuid,
      validata.faskes_uuid
    );

    if (!orderLabExist) {
      throw new NotfoundException("Order Lab tidak ada");
    }

    await sequelizeInstance.transaction(async (t) => {
      await OrderLabRepository.update(
        validata.order_lab_uuid,
        validata.faskes_uuid,
        {
          waktu_expertise: toEpochDate(new Date()),
          petugas_expertise: validata.petugas_expertise,
          catatan_expertise: validata.catatan_expertise,
          expertise: true,
        },
        t
      );
    });
  }

  static async batalExpertise(req) {
    const orderLabExist = await OrderLabRepository.findByUuid(
      req.order_lab_uuid,
      req.faskes_uuid
    );

    if (!orderLabExist) {
      throw new NotfoundException("Order Lab tidak ada");
    }

    await sequelizeInstance.transaction(async (t) => {
      await OrderLabRepository.update(
        req.order_lab_uuid,
        req.faskes_uuid,
        {
          waktu_expertise: null,
          petugas_expertise: null,
          catatan_expertise: null,
          expertise: false,
        },
        t
      );
    });
  }

  static async getPemeriksaan(req, order_lab_uuid) {
    const orderLabExist = await OrderLabRepository.findByUuid(
      order_lab_uuid,
      req.faskes_uuid
    );

    if (!orderLabExist) {
      throw new NotfoundException("Order Lab tidak ada");
    }

    const orderData = orderLabExist.get({ plain: true });

    // order yang divalidasi tanpa spesimen menyimpan spesimen_uuids = null
    let spesimenList = orderData.spesimen_uuids?.length
      ? await SpesimenRepository.findByUuids(orderData.spesimen_uuids)
      : [];
    spesimenList = spesimenList.map((item) => item.get({ plain: true }));

    orderData.spesimen_uuids = spesimenList;

    const hasilPemeriksaan = await ObservationItemRepository.findByOrderLabUuid(
      order_lab_uuid,
      req.faskes_uuid
    );

    const formattedHasilPemeriksaan = await checkNilaiRujukan(
      hasilPemeriksaan,
      orderData.patient,
      req.faskes_uuid
    );

    // Untuk cetak hasil: kategori (Hematologi, Kimia Klinik, …) & kelompok/panel (Darah Rutin, Elektrolit, …) tiap item.
    const susunan = await HasilPemeriksaanService.susunanItem(order_lab_uuid, formattedHasilPemeriksaan);

    return {
      ...orderData,
      hasil_pemeriksaan: formattedHasilPemeriksaan.map((h) => ({ ...h, ...(susunan.get(h.item_pemeriksaan_uuid) ?? {}) })),
    };
  }

  static async susunanItem(order_lab_uuid, hasil) {
    const peta = new Map();
    const uuids = [...new Set(hasil.map((h) => h.item_pemeriksaan_uuid).filter(Boolean))];
    if (!uuids.length) return peta;
    const kategori = await sequelizeInstance.query(
      `SELECT ip.uuid, cp.name AS kategori, COALESCE(cp.no_urut, 999) AS kategori_urut
         FROM item_pemeriksaan ip
         LEFT JOIN category_pemeriksaan cp ON cp.uuid = ip.category_pemeriksaan_uuid AND cp.deleted_at IS NULL
        WHERE ip.uuid IN (:uuids)`,
      { replacements: { uuids }, type: "SELECT" }
    );
    for (const k of kategori) peta.set(k.uuid, { kategori: k.kategori, kategori_urut: Number(k.kategori_urut) });
    // Kelompok diambil dari tarif yang dipesan (tarif kelompok / paket berisi kelompok).
    const kelompok = await sequelizeInstance.query(
      `SELECT DISTINCT ON (ikp.item_pemeriksaan_uuid) ikp.item_pemeriksaan_uuid AS uuid, kp.name AS kelompok
         FROM order_lab_pemeriksaan olp
         JOIN tarif_lab_item tli ON tli.tarif_lab_uuid = olp.tarif_lab_uuid AND tli.deleted_at IS NULL
         JOIN kelompok_pemeriksaan kp ON kp.uuid = tli.kelompok_pemeriksaan_uuid AND kp.deleted_at IS NULL
         JOIN item_kelompok_pemeriksaan ikp ON ikp.kelompok_pemeriksaan_uuid = kp.uuid AND ikp.deleted_at IS NULL
        WHERE olp.order_lab_uuid = :order AND olp.deleted_at IS NULL
        ORDER BY ikp.item_pemeriksaan_uuid, tli.id`,
      { replacements: { order: order_lab_uuid }, type: "SELECT" }
    );
    for (const k of kelompok) peta.set(k.uuid, { ...(peta.get(k.uuid) ?? {}), kelompok: k.kelompok });
    return peta;
  }
}
