import TarifRepository from "../repositories/tarif-repository.js";
import TarifValidation from "../validations/tarif-validation.js";
import ZodValidator from "../validations/validator.js";
import successResponse from "../response/result-response.js";
import {
  messageSuccessExport,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Result from "../response/result.js";
import {
  affectedRowMustBeOne,
  findPartOf,
  isUuidExist,
  parseAllSeets,
} from "../helpers/helper.js";
import { uuidv7 } from "uuidv7";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../helpers/generate-message.js";
import {
  NameTarifKomponenModel,
  PenjaminModel,
  TarifModel,
  TindakanModel,
} from "@opensimrs/model-sdk/datamaster";
import { GlobalValidation } from "../validations/global-validation.js";
import { LabRepository } from "../repositories/lab-repository.js";
import NameTarifKomponenRepository from "../repositories/name_tarif_komponen-repository.js";
import PenjaminRepository from "../repositories/penjamin-repository.js";
import RuanganRepository from "../repositories/ruangan-repository.js";
import LokasiRepository from "../repositories/lokasi-repository.js";

export default class TarifService {
  static async importTarif(pathFile, faskestUuid) {
    const data = await parseAllSeets(pathFile);
    const tindakan = data[0]; // ambil seet tindakan
    const ruangan = data[1]; // ambil seet ruangan
    let tarifTindakan = [];
    let komponenTarif = [];
    let ruanganList = [];
    let tarifLab = [];
    let pelayananList = [];

    let penjaminList = [];
    [tindakan, ruangan].flatMap((c) => {
      c.eachRow((data, index) => {
        if (index === 1) return;
        const [, , , penjamin, code] = data.values;
        const same = penjaminList.find(
          (p) => p.code == code && p.penjamin == penjamin
        );
        if (!same) penjaminList.push({ code, penjamin });
      });
    });
    // menghilangkan duplikat element menggunakan set
    penjaminList = [...new Set(penjaminList)];

    tindakan.eachRow((t, index) => {
      if (index === 1) return;
      const uuid = uuidv7();
      let [
        ,
        ,
        jenis_tarif,
        ,
        code,
        name,
        mode,
        pelayanan,
        tindakan,
        komponen_tarif,
        harga_tarif_rupiah,
        grand_total,
        is_mcu,
        tarif_lab,
      ] = t.values;
      let tindakanSame = tarifTindakan.find((t) => t.code === code);

      is_mcu = !new Boolean(is_mcu).valueOf();
      harga_tarif_rupiah = this.stirngToDouble(harga_tarif_rupiah);
      grand_total = this.stirngToDouble(grand_total);

      // duplikat tarif lab
      const tarifLabSame = tarifLab.find(
        (tl) => tl.tarif_lab == tarif_lab && tl.code == code
      );
      if (!tarifLabSame) {
        if (typeof is_mcu == "string") {
          if (is_mcu.trim().toLowerCase() == "true") {
            is_mcu = is_mcu.trim().toLowerCase() == "true" ? true : false;
            tarifLab.push({ code, tarif_lab });
          }
        }
      } else if (typeof is_mcu == "boolean") {
        tarifLab.push({ code, tarif_lab });
      } else {
        throw new HttpException(
          generateErrorResponse(
            "is_mcu tidak valid",
            "invalid",
            "is_mcu harus boolean"
          ),
          HttpStatus.BAD_REQUEST
        );
      }

      // pelaayanan: EX: RAJAL, RANAP, ICU, IGD
      const pelayananSame = pelayananList.find(
        (p) => p.code == code && p.pelayanan == pelayanan
      );
      if (!pelayananSame) pelayananList.push({ code: code, pelayanan });

      if (tindakanSame)
        komponenTarif.push({ code, komponen_tarif, harga_tarif_rupiah });
      else {
        if (is_mcu instanceof String) {
          is_mcu = is_mcu.trim().toLowerCase() == "true" ? true : false;
        }
        tarifTindakan.push({
          uuid,
          jenis_tarif,
          code,
          name,
          mode,
          pelayanan,
          tindakan,
          komponen_tarif,
          harga_tarif_rupiah,
          grand_total,
          is_mcu,
          tarif_lab,
        });
      }
    });

    ruangan.eachRow((r, index) => {
      if (index === 1) return;
      const uuid = uuidv7();
      let [, , jenis_tarif, metode, code, name, pelayanan, ruangan, harga_bed] =
        r.values;
      ruanganList.push({
        uuid,
        jenis_tarif,
        metode,
        code,
        name,
        pelayanan,
        ruangan,
        harga_bed,
      });
    });

    const [reuslt_penjamin, result_komponen, result_ruangan, result_lab] =
      await Promise.all([
        // TindakanRepository.findAllByNameIn(tarifTindakan.map(tt => tt.tindakan), faskestUuid),
        PenjaminRepository.findAllByNameIn(
          penjaminList.map((p) => p.penjamin),
          faskestUuid
        ),
        NameTarifKomponenRepository.findByNameIn(
          komponenTarif.map((kt) => kt.komponen_tarif),
          faskestUuid
        ),
        LokasiRepository.findAllByNameIn(
          [...new Set(ruanganList.map((r) => r.ruangan))],
          faskestUuid
        ),
        LabRepository.findAllByNameIn(
          tarifLab.map((t) => t.tarif_lab),
          faskestUuid
        ),
      ]);
    ZodValidator.validate(TarifValidation.IMPORT_TARIF_RANGAN, ruanganList);
    // ZodValidator.validate(TarifValidation.IMPORT_TARIF_TINDAKAN, tarifTindakan);
    // tarifTindakan.forEach((tt, index) => {
    //   const match = result_tindakan.find(t => t.name == tt.tindakan);
    //   if(!match) throw new HttpException(generateErrorResponse("Gagal", "notfound", `tindakan ${tt.name} tidak ditemukan`), HttpStatus.NOT_FOUND);
    //   tarifTindakan[index].tindakan_uuid = match.uuid;
    // })

    /**
     * MEMBUAT STRUKTUR TINDAKAN pada tarif
     */

    komponenTarif.forEach((kt, index) => {
      const match = result_komponen.find((k) => k.name == kt.komponen_tarif);
      if (!match)
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "notfound",
            `komponen ${kt.komponen_tarif} tidak ditemukan`
          ),
          HttpStatus.NOT_FOUND
        );
      komponenTarif[index].k_code = kt.code;
      komponenTarif[index].uuid = match.uuid;
      komponenTarif[index].tarif_per_komponen =
        kt.harga_tarif_persen ?? kt.harga_tarif_rupiah;
      komponenTarif[index].komponen_tarif_name = match.name;
      komponenTarif[index].presentase = kt.harga_tarif_persen ? true : false;
    });

    tarifTindakan.forEach((tt, index) => {
      const match = komponenTarif.filter((k) => k.k_code == tt.code);
      tarifTindakan[index].tindakan = [
        {
          tindakan_uuid: tt.uuid,
          tindakan_name: tt.name,
          komponen_tarif: match.map((m) => {
            return {
              tarif_komponen_uuid: m.uuid,
              tarif_komponen_name: m.komponen_tarif,
              tarif_per_komponen: m.tarif_per_komponen,
              tarif_uuid: tt.uuid,
              faskes_uuid: faskestUuid,
              tindakan_uuid: tt.uuid,
            };
          }),
        },
      ];
    });
    /**
     * END
     */

    /**
     * susun tarif lab untuk mcu true
     *
     */

    tarifLab.forEach((tl, index) => {
      const match = result_lab.find((rl) => rl.name == tl.tarif_lab);
      if (!match)
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "notfound",
            `tarif lab ${tl.tarif_lab} tidak ditemukan`
          ),
          HttpStatus.NOT_FOUND
        );
      tarifLab[index].k_code = tl.code;
      tarifLab[index].uuid = match.uuid;
    });

    //Setup tindakan lab dan unit pelayanan dan
    tarifTindakan.forEach((tt, index) => {
      const match = tarifLab.filter((tl) => tl.k_code == tt.code);
      match.forEach((m) => {
        tarifTindakan[index].tindakan.push({
          tarif_komponen_tindakan_lab_uuid: m.uuid,
        });
      });
      const unitPelayanan = pelayananList.filter((p) => p.code == tt.code);
      tarifTindakan[index].unit_pelayanan = unitPelayanan.map((u) => ({
        unit_pelayanan: u.pelayanan,
      }));
    });

    /**
     * END
     */

    /**
     * susun struktur untuk penjamin
     *
     */
    penjaminList.forEach((pj, index) => {
      const match = reuslt_penjamin.find((p) => p.name == pj.penjamin);
      if (!match)
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "notfound",
            `penjamin ${pj.penjamin} tidak ditemukan`
          ),
          HttpStatus.NOT_FOUND
        );
      penjaminList[index].uuid = match.uuid;
    });

    tarifTindakan.forEach((tt, index) => {
      const penjamin = penjaminList.filter((p) => p.code == tt.code);
      tarifTindakan[index].penjamin = penjamin.map((p) => ({
        penjamin_uuid: p.uuid,
        penjamin_name: p.penjamin,
      }));
      tarifTindakan[index].tindakan[0].presentase = tt.presentase;
      tarifTindakan[index].tindakan[0].total_harga = tt.grand_total;
      tarifTindakan[index].grand_total;
      delete tarifTindakan[index].harga_tarif_rupiah;
      delete tarifTindakan[index].harga_tarif_persen;
      delete tarifTindakan[index].tarif_lab;
      delete tarifTindakan[index].presentase;
      delete tarifTindakan[index].komponen_tarif;
      delete tarifTindakan[index].tindakan_uuid;
      delete tarifTindakan[index].pelayanan;
    });

    /**
     *
     * END
     */

    // susun JSON ruangan
    ruanganList.forEach((r, index) => {
      const match = result_ruangan.find((rr) => r.ruangan == rr.name);
      if (!match)
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "notfound",
            `ruangan ${r.ruangan} tidak ditemukan`
          ),
          HttpStatus.NOT_FOUND
        );
      const penjamin = penjaminList.filter((pn) => pn.code == r.code);
      ruanganList[index].lokasi_uuid = match.uuid;
      ruanganList[index].penjamin = penjamin.map((p) => ({
        penjamin_uuid: p.uuid,
        harga: this.stirngToDouble(r.harga_bed),
        penjamin_name: p.penjamin,
      }));
      ruanganList[index].unit_pelayanan = [{ unit_pelayanan: r.pelayanan }];
      ruanganList[index].tindakan = [];
      delete ruanganList[index].pelayanan;
      delete ruanganList[index].metode;
      delete ruanganList[index].harga_bed;
    });

    const payload = [ruanganList, tarifTindakan].flat().map((d) => {
      d.penjamin = JSON.stringify(d.penjamin);
      d.unit_pelayanan = JSON.stringify(d.unit_pelayanan);
      d.tindakan = JSON.stringify(d.tindakan);
      d.faskes_uuid = faskestUuid;
      d.grand_total = d.grand_total;
      d.status = true;
      return d;
    });
    await sequelizeInstance.transaction(async (tr) => {
      await TarifRepository.saveAll(payload, tr);
    });
    return generateSuccessResponse("Berhasil import tarif");
  }

  static stirngToDouble(currency) {
    if (currency) {
      const cleanedString = currency
        .replace(/Rp\.|\s|,|(\.\d{2})$/g, "")
        .replace(/\./g, "");
      const number = parseFloat(cleanedString);
      return isNaN(number) ? 0 : number;
    }
  }

  static async createTarifTindakan(request) {
    if (request.is_mcu) {
      return this.createTindakanIsMcuTrue(request);
    } else {
      ZodValidator.validate(TarifValidation.IS_MCU_FALSE, request);
      request.uuid = uuidv7();
      let { tindakan, tag_unit_pelayanan, tag_penjamin } = request;
      let [, resultTindakan, resultKomponen, pnjmin] = await Promise.all([
        isUuidExist(
          tag_unit_pelayanan.map((u) => u.tindakan_uuid),
          TindakanModel,
          "tindakan_uuid"
        ),
        isUuidExist(
          tindakan.map((t) => t.tindakan_uuid),
          TindakanModel,
          "tindakan_uuid"
        ),
        isUuidExist(
          tindakan
            .map((t) => t.komponen_tarif.map((k) => k.tarif_komponen_uuid))
            .flat(),
          NameTarifKomponenModel,
          "tarif_komponen_uuid"
        ),
        isUuidExist(
          tag_penjamin.map((p) => p.penjamin_uuid),
          PenjaminModel,
          "penjamin_uuid"
        ),
      ]);

      pnjmin = pnjmin.map((p) => ({
        penjamin_uuid: p.uuid,
        penjamin_name: p.name,
      }));

      tindakan = tindakan.map((t) => {
        t.tindakan_name = resultTindakan.find(
          (rt) => rt.uuid === t.tindakan_uuid
        )?.name;
        return t;
      });

      tindakan.forEach((t) =>
        t.komponen_tarif.forEach((data, index) => {
          t.komponen_tarif[index].tarif_komponen_name = resultKomponen.find(
            (r) => r.uuid == data.tarif_komponen_uuid
          )?.name;
          t.komponen_tarif[index].faskes_uuid = request.faskes_uuid;
          t.komponen_tarif[index].tindakan_uuid = t.tindakan_uuid;
        })
      );

      const tarifTindakn = {
        uuid: request.uuid,
        faskes_uuid: request.faskes_uuid,
        jenis_tarif: request.jenis_tarif,
        code: request.code,
        name: request.name,
        is_mcu: request.is_mcu,
        mode: request.mode_pilihan_tarif,
        grand_total: request.grand_total,
        unit_pelayanan: JSON.stringify(request.tag_unit_pelayanan),
        penjamin: JSON.stringify(pnjmin),
        tindakan: JSON.stringify(tindakan),
        status: request.status,
      };

      await sequelizeInstance.transaction(async (tr) => {
        await Promise.all([TarifRepository.save(tarifTindakn, TarifModel, tr)]);
      });
      return generateSuccessResponse(`Berhasil membuat tarif ${request.name}`);
    }
  }

  static async updateTindakan(request) {
    request = ZodValidator.validate(
      TarifValidation.UPDATE_IS_MCU_FALSE,
      request
    );
    let { tag_penjamin, tag_unit_pelayanan, tindakan } = request;
    let komponenTarifuuidList = tindakan
      .map((t) => {
        if (t.komponen_tarif) {
          return t.komponen_tarif.map((k) => k.tarif_komponen_uuid);
        }
      })
      .filter((d) => d !== undefined)
      .flat();

    let [tindakanList, komponenList, penjamin, tarifTindakan] =
      await Promise.all([
        isUuidExist(
          request?.tindakan.map((t) => t.tindakan_uuid),
          TindakanModel,
          "tindakan_uuid"
        ),
        isUuidExist(
          komponenTarifuuidList,
          NameTarifKomponenModel,
          "tarif_komponen_uuid"
        ),
        isUuidExist(
          tag_penjamin.map((p) => p.penjamin_uuid),
          PenjaminModel,
          "penjamin_uuid"
        ),
        TarifRepository.findByUuid(
          { faskes_uuid: request.faskes_uuid, uuid: request.uuid },
          TarifModel
        ),
      ]);
    if (!tarifTindakan)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `tarif dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    tindakan.forEach((t) =>
      t.komponen_tarif.forEach((data, index) => {
        t.komponen_tarif[index].tarif_komponen_name = komponenList.find(
          (r) => r.uuid == data.tarif_komponen_uuid
        )?.name;
        t.komponen_tarif[index].faskes_uuid = request.faskes_uuid;
        t.komponen_tarif[index].tindakan_uuid = t.tindakan_uuid;
      })
    );

    tindakan.forEach((tn, index) => {
      tindakan[index].tindakan_name = tindakanList.find(
        (td) => td.uuid === tn.tindakan_uuid
      )?.name;
    });

    await sequelizeInstance.transaction(async (tr) => {
      tarifTindakan.jenis_tarif =
        request.jenis_tarif ?? tarifTindakan.jenis_tarif;
      tarifTindakan.code = request.code ?? tarifTindakan.code;
      tarifTindakan.name = request.name ?? tarifTindakan.name;
      tarifTindakan.grand_total =
        request.grand_total ?? tarifTindakan.grand_total;
      tarifTindakan.mode = request.mode ?? tarifTindakan.mode;
      tarifTindakan.is_mcu = request.is_mcu ?? tarifTindakan.is_mcu;
      tarifTindakan.status = request.status ?? tarifTindakan.status;
      tarifTindakan.penjamin =
        JSON.stringify(
          penjamin.map((p) => ({
            penjamin_uuid: p.uuid,
            penjamin_name: p.name,
          }))
        ) ?? tarifTindakan.tag_penjamin;
      tarifTindakan.unit_pelayanan =
        JSON.stringify(tag_unit_pelayanan) ?? tarifTindakan.tag_unit_pelayanan;
      tarifTindakan.tindakan =
        JSON.stringify(tindakan) ?? tarifTindakan.tindakan;
      affectedRowMustBeOne(await TarifRepository.update(tarifTindakan, tr));
    });
    return generateSuccessResponse(`Berhasil memperbarui tarif tindakan`);
  }

  static async delete(request) {
    request = ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const tarif = await TarifRepository.findByUuid(request, TarifModel);
    if (!tarif)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `tarif dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    await sequelizeInstance.transaction(async (tr) => {
      affectedRowMustBeOne(await TarifRepository.delete(tarif, TarifModel, tr));
    });
    return generateSuccessResponse(`Berhasil meghapus tarif`);
  }

  static async findAll(request) {
    const { payload, properties } = await TarifRepository.findAll(request);
    return generateSuccessResponse(
      "Berhasil menampilkan semua tarif",
      payload,
      properties
    );
  }

  static async createTindakanIsMcuTrue(request) {
    request = ZodValidator.validate(TarifValidation.IS_MCU_TRUE, request);
    request.uuid = uuidv7();
    let { tindakan } = request;

    let tarifKomponenUuidList = tindakan
      .map((tn) => {
        if (tn.komponen_tarif)
          return tn.komponen_tarif.map((k) => k.tarif_komponen_uuid);
      })
      .filter((d) => d !== undefined)
      .flat();

    let tindakanUuidList = tindakan
      .map((t) => {
        if (t.tindakan_uuid) return t.tindakan_uuid;
      })
      .filter((d) => d !== undefined);

    let penjaminUuidList = request.tag_penjamin.map((p) => p.penjamin_uuid);

    let [resultTindakan, resultKomponen, pnjmin] = await Promise.all([
      isUuidExist(tindakanUuidList, TindakanModel, "tindakan_uuid"),
      isUuidExist(
        tarifKomponenUuidList,
        NameTarifKomponenModel,
        "tarif_komponen_uuid"
      ),
      isUuidExist(penjaminUuidList, PenjaminModel, "penjamin_uuid"),
    ]);

    pnjmin = pnjmin.map((p) => ({
      penjamin_uuid: p.uuid,
      penjamin_name: p.name,
    }));
    let tindakanList = [];
    let uuidTindakanLabList = tindakan
      .map((t) => t.tarif_komponen_tindakan_lab_uuid)
      .filter((d) => d !== undefined);
    let komponenTindakanLabList = await LabRepository.findAllByUuidIn(
      uuidTindakanLabList,
      request.faskes_uuid
    );
    // let itemPemeriksaanOrKelompokPemeriksaan = await LabRepository.findItemPemeriksanOrKelompokPemeriksaanByUuid({faskes_uuid: request.faskes_uuid, uuid: komponenTindakanLabList.map(k => k.tarif_lab_item_uuid)});
    uuidTindakanLabList.forEach((u) => {
      let isExist = komponenTindakanLabList.find((k) => k.uuid == u);
      if (!isExist)
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "notfound",
            `komponen_tindakan_lab_uuid ${u} tidak ditemukan`
          ),
          HttpStatus.NOT_FOUND
        );
      tindakanList.push({
        tarif_komponen_tindakan_lab_uuid: isExist.uuid,
        nama_tindakan: isExist.TarifLabModel.name,
        grand_total: isExist.TarifLabModel.grand_total,
        tarif_lab_item_uuid: isExist.tarif_lab_item_uuid,
      });
    });
    tindakan.forEach((t) => {
      if (t.tindakan_uuid) {
        tindakanList.push(t);
      }
    });

    tindakanList.forEach((t, index) => {
      tindakanList[index].tindakan_name = resultTindakan.find(
        (rt) => rt.uuid === t.tindakan_uuid
      )?.name;
    });

    tindakan.forEach((t) =>
      t.komponen_tarif.forEach((data, index) => {
        t.komponen_tarif[index].tarif_komponen_name = resultKomponen.find(
          (r) => r.uuid == data.tarif_komponen_uuid
        )?.name;
        t.komponen_tarif[index].faskes_uuid = request.faskes_uuid;
        t.komponen_tarif[index].tindakan_uuid = t.tindakan_uuid;
      })
    );
    const tarifTindakn = {
      uuid: request.uuid,
      faskes_uuid: request.faskes_uuid,
      jenis_tarif: request.jenis_tarif,
      code: request.code,
      name: request.name,
      is_mcu: request.is_mcu,
      mode: request.mode_pilihan_tarif,
      grand_total: request.grand_total,
      unit_pelayanan: JSON.stringify(request.tag_unit_pelayanan),
      penjamin: JSON.stringify(pnjmin),
      tindakan: JSON.stringify(tindakanList),
      status: request.status,
    };
    await sequelizeInstance.transaction(async (tr) => {
      await TarifRepository.save(tarifTindakn, TarifModel, tr);
    });
    return generateSuccessResponse(`Berhasil membuat tarif mcu true`);
  }

  static async updateTarifMcuTrue(request) {
    request = ZodValidator.validate(
      TarifValidation.UPDATE_IS_MCU_TRUE,
      request
    );
    let { tindakan, tag_unit_pelayanan, tag_penjamin } = request;
    let penjaminUuidList = tag_penjamin.map((p) => p.penjamin_uuid);
    let tindakanUuidList = tindakan
      .map((t) => {
        if (t.tindakan_uuid) return t.tindakan_uuid;
      })
      .filter((d) => d !== undefined);
    let tarifkomponenUuidList = tindakan
      .map((t) => {
        if (t.komponen_tarif) {
          return t.komponen_tarif.map((k) => {
            return k.tarif_komponen_uuid;
          });
        }
      })
      .filter((d) => d !== undefined)
      .flat();

    let [penjaminList, tindakanList, tarifKomponenList, tarif] =
      await Promise.all([
        isUuidExist(penjaminUuidList, PenjaminModel, "penjamin_uuid"),
        isUuidExist(tindakanUuidList, TindakanModel, "tindakan_uuid"),
        isUuidExist(
          tarifkomponenUuidList,
          NameTarifKomponenModel,
          "tarif_komponen_uuid"
        ),
        TarifRepository.findByUuid(
          { faskes_uuid: request.faskes_uuid, uuid: request.uuid },
          TarifModel
        ),
      ]);

    tindakan.forEach(
      (t, index) =>
        (tindakan[index].tindakan_name = tindakanList.find(
          (tn) => tn.uuid === t.tindakan_uuid
        )?.name)
    );
    tindakan.forEach((t) =>
      t.komponen_tarif.forEach((data, index) => {
        t.komponen_tarif[index].tarif_komponen_name = tarifKomponenList.find(
          (r) => r.uuid == data.tarif_komponen_uuid
        )?.name;
        t.komponen_tarif[index].faskes_uuid = request.faskes_uuid;
        t.komponen_tarif[index].tindakan_uuid = t.tindakan_uuid;
      })
    );

    if (!tarif)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `tarif dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    await sequelizeInstance.transaction(async (tr) => {
      affectedRowMustBeOne(
        await TarifRepository.update(
          {
            id: tarif.id,
            uuid: tarif.uuid,
            faskes_uuid: tarif.faskes_uuid,
            jenis_tarif: request.jenis_tarif ?? tarif.jenis_tarif,
            code: request.code ?? tarif.code,
            name: request.name ?? tarif.name,
            grand_total: request.grand_total ?? tarif.grand_total,
            mode: request.mode ?? tarif.mode,
            penjamin:
              JSON.stringify(
                penjaminList.map((p) => ({
                  penjamin_uuid: p.uuid,
                  penjamin_name: p.name,
                }))
              ) ?? tarif.penjamin,
            unit_pelayanan:
              JSON.stringify(tag_unit_pelayanan) ?? tarif.unit_pelayanan,
            tindakan: JSON.stringify(request.tindakan) ?? tarif.tindakan,
            is_mcu: request.is_mcu ?? tarif.is_mcu,
            status: request.status ?? tarif.status,
          },
          tr
        )
      );
    });
    return generateSuccessResponse(`Berhasil memperbaru tarif is mcu true`);
  }

  static async createTarifRuangan(request) {
    request = ZodValidator.validate(TarifValidation.CREATE_RUANGAN, request);
    let [penjaminList, ruangan] = await Promise.all([
      isUuidExist(
        request.tarif_penjamin.map((t) => t.penjamin_uuid),
        PenjaminModel,
        "penjamin_uuid"
      ),
      LokasiRepository.findByUuid({ uuid: request.lokasi_uuid, faskes_uuid: request.faskes_uuid }),
    ]);
    if (!ruangan)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `ruangan dengan uuid ${request.lokasi_uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    penjaminList = request.tarif_penjamin.map((tp) => {
      const match = penjaminList.find((p) => p.uuid == tp.penjamin_uuid);
      return {
        penjamin_uuid: match.uuid,
        penjamin_name: match.name,
        harga: tp.harga,
      };
    });
    request.unit_pelayanan = JSON.stringify(request.unit_pelayanan);
    request.penjamin = JSON.stringify(penjaminList);
    delete request.tarif_penjamin;
    await sequelizeInstance.transaction(async (tr) => {
      await TarifRepository.save(request, TarifModel, tr);
    });
    return generateSuccessResponse(`Berhasil menambahkan tarif ruangan`);
  }

  static async updateRuangan(request) {
    console.log(request);
    request = ZodValidator.validate(TarifValidation.UPDATE_RUANGAN, request);
    let tarifRuangan = await TarifRepository.findByUuid(
      { faskes_uuid: request.faskes_uuid, uuid: request.uuid },
      TarifModel
    );
    if (!tarifRuangan)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `tarif ruangan dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    let [penjaminList, ruangan] = await Promise.all([
      isUuidExist(
        request.tarif_penjamin.map((t) => t.penjamin_uuid),
        PenjaminModel,
        "penjamin_uuid"
      ),
      LokasiRepository.findByUuid({ uuid: request.lokasi_uuid, faskes_uuid: request.faskes_uuid }),
    ]);

    if (!ruangan)
      throw new HttpException(
        generateErrorResponse(
          "Gagal update ruangan",
          "notfound",
          `ruangan dengan uuid ${request.lokasi_uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    penjaminList = request.tarif_penjamin.map((tp) => {
      const match = penjaminList.find((p) => p.uuid == tp.penjamin_uuid);
      return {
        penjamin_uuid: match.uuid,
        penjamin_name: match.name,
        harga: tp.harga,
      };
    });
    // request.unit_pelayanan = JSON.stringify(request.unit_pelayanan);
    request.penjamin = JSON.stringify(penjaminList);
    delete request.tarif_penjamin;
    await sequelizeInstance.transaction(async (tr) => {
      await TarifRepository.update(
        {
          id: tarifRuangan.id,
          uuid: tarifRuangan.uuid,
          faskes_uuid: tarifRuangan.faskes_uuid,
          name: request.name ?? tarifRuangan.name,
          code: request.code ?? tarifRuangan.code,
          jenis_tarif: request.jenis_tarif ?? tarifRuangan.jenis_tarif,
          penjamin: JSON.stringify(penjaminList) ?? tarifRuangan.penjamin,
          lokasi_uuid: request.lokasi_uuid ?? tarifRuangan.lokasi_uuid,
          unit_pelayanan:
            JSON.stringify(request.unit_pelayanan) ??
            tarifRuangan.unit_pelayanan,
          status: request.status ?? tarifRuangan.status,
        },
        tr
      );
    });
    return generateSuccessResponse(`Berhasil memperbarui tarif ruangan`);
  }

  static async getAllTarif(request) {
    const filters = {
      name: request.name,
      unit: request.unit,
      penjamin: request.penjamin,
    };
    let result = await this.getAllGroupedTarifData(
      request.jenis,
      filters,
      request.faskes_uuid
    );
    result = this.applyFilters(result, {
      name: request.name,
      unit: request.unit,
      penjamin: request.penjamin,
    });
    const { paginatedResult, paginationInfo } = this.paginateResults(
      result,
      request.page,
      request.pageSize
    );
    return Result.responseWithPaginate(
      messageSuccessShow,
      paginationInfo,
      paginatedResult
    );
  }

  static async getAllTarifAktif(faskes_uuid) {
    const result = await TarifRepository.getAllTarifAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async exportTarif() {
    const result = await TarifRepository.exportTarif();
    return successResponse(messageSuccessExport, result);
  }

  static mapPelayanan = (resultTarifPelayanan) => {
    const name_pelayanan = ["IGD", "Rawat Jalan", "Rawat Inap"];
    return resultTarifPelayanan.map((p) => ({
      uuid: p.uuid,
      unit_pelayanan_name: name_pelayanan[p.unit_pelayanan - 1] || "Unknown",
      unit_pelayanan: p.unit_pelayanan,
    }));
  };

  static mapPenjamin = (resultTarifPenjamin, penjaminNameLookup) => {
    return resultTarifPenjamin.map((p) => ({
      uuid: p.uuid,
      penjamin_name: penjaminNameLookup.get(p.penjamin_uuid),
      penjamin_uuid: p.penjamin_uuid,
      harga: p.harga,
    }));
  };

  static mapTindakanPoli = (
    tindakanPoliList,
    tindakanNameLookup,
    tarifKomponenNameLookup
  ) => {
    return tindakanPoliList.reduce((acc, current) => {
      const tindakanUuid = current.tindakan_uuid;
      const listKomponenTarif = [
        {
          uuid: current.uuid,
          tarif_komponen_uuid: current.tarif_komponen_uuid,
          tarif_per_komponen_name: tarifKomponenNameLookup.get(
            current.tarif_komponen_uuid
          ),
          tarif_per_komponen: current.tarif_per_komponen,
        },
      ];

      const existingTindakan = acc.find(
        (t) => t.tindakan_uuid === tindakanUuid
      );
      if (existingTindakan) {
        existingTindakan.list_komponen_tarif.push(...listKomponenTarif);
      } else {
        acc.push({
          tindakan_uuid: tindakanUuid,
          tindakan_name: tindakanNameLookup.get(tindakanUuid) ?? "Unknown",
          list_komponen_tarif: listKomponenTarif,
        });
      }

      return acc;
    }, []);
  };

  static mapRuangan = (
    resultTarifRuangan,
    ruanganNameLookup,
    kategoriRuanganNameLookup,
    allRuanganModels
  ) => {
    const kelas_ruangan = ["kelas 1", "kelas 2", "kelas 3", "VIP", "VVIP"];
    return resultTarifRuangan.map((r) => {
      const ruanganModel = allRuanganModels.find(
        (rm) => rm.uuid === r.ruangan_uuid
      );
      return {
        uuid: r.uuid,
        ruangan_uuid: r.ruangan_uuid ?? null,
        ruangan_name: ruanganNameLookup.get(r.ruangan_uuid),
        kelas_ruangan: ruanganModel
          ? kelas_ruangan[ruanganModel.kelas_ruangan]
          : null,
        kategori_ruangan_name: ruanganModel
          ? kategoriRuanganNameLookup.get(ruanganModel.kategori_ruangan_uuid)
          : null,
        harga: r.harga,
      };
    });
  };

  static mapLab = (resultTarifLab) => {
    return resultTarifLab.map((p) => ({
      uuid: p.uuid,
      tarif_lab_uuid: p.tarif_lab_uuid,
    }));
  };

  static async searchTarif(request) {
    const result = await TarifRepository.searchTarif(
      request.query,
      request.page,
      request.pageSize,
      request.faskes_uuid
    );
    return successResponse(messageSuccessShow, result.tarifList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }
}
