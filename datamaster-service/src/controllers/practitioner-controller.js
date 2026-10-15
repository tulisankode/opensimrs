import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse } from "../helpers/generate-message.js";
import PractitionerService from "../services/practitioner-service.js";

export default class PractitionerController {
  static async createPractitioner(req, res, nextFunction) {
    try {
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      if (body.is_doctor) {
        const result = await PractitionerService.createPractitioner(body);
        res.status(201).json(result);
      } else {
        const result = await PractitionerService.createPractitionerNonDoctor(
          body
        );
        res.status(201).json(result);
      }
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} req
   * @param {Response} res
   * @param {import("express").NextFunction} nextFunction
   */
  static async updatePractitioner(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid ?? null;
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid, uuid };
      if (body.is_doctor == true) {
        const result = await PractitionerService.updatePractitioner(body);
        res.status(200).json(result);
      }
      if (body.is_doctor == false) {
        const result = await PractitionerService.updatePractitionerNonDokter(
          body
        );
        res.status(200).json(result);
      } else {
        throw new HttpException(
          generateErrorResponse(
            "Gagal update",
            "badrequest",
            "is_doctor harus boolean"
          ),
          HttpStatus.BAD_REQUEST
        );
      }
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllPractitioner(req, res, nextFunction) {
    try {
      const page = req.query.page ?? 1;
      const pageSize = req.query.limit ?? 10;
      const name = req.query.name ?? null;
      const is_doctor = req.query.is_doctor ?? null;
      const faskes_uuid = req.author.faskesUuid ?? null;
      const order_by = req.query.order_by ?? "DESC";
      const result = await PractitionerService.getAllPractitioner({
        name,
        is_doctor,
        page,
        pageSize,
        faskes_uuid,
        order_by,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async exportPractitioner(req, res, nextFunction) {
    try {
      const result = await PractitionerService.exportPractitioner();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllPractitionerAktif(req, res, nextFunction) {
    try {
      const limit = req.query.limit ?? 10;
      const offset = req.query.offset ?? 1;
      const search = req.query.search ?? null;
      const is_doctor = req.query.is_doctor ?? null;
      const faskes_uuid = req.author.faskesUuid ?? null;
      const order_by = req.query.order_by ?? "DESC";
      const result = await PractitionerService.getAllPractitionerAktif({
        limit,
        offset,
        search,
        is_doctor,
        faskes_uuid,
        order_by,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllPractitionerAktifByPoli(req, res, nextFunction) {
    try {
      const data = req.query;
      data.faskes_uuid = req.author.faskesUuid;
      const result = await PractitionerService.getAllPractitionerAktifByPoli(
        data
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllPractitionerAktifByPoliMobile(req, res, nextFunction) {
    try {
      console.log("req == ", req);
      const data = req.query;
      data.faskes_uuid = req.headers.faskes_uuid;
      const result = await PractitionerService.getAllPractitionerAktifByPoli(
        data
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPractitionerById(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid;
      const faskes_uuid = req.author.faskesUuid;
      const result = await PractitionerService.getPractitionerById({
        uuid,
        faskes_uuid,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPractitionerByIdMobile(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid;
      const faskes_uuid = req.headers.faskes_uuid;
      const result = await PractitionerService.getPractitionerById({
        uuid,
        faskes_uuid,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deletePractitioner(req, res, nextFunction) {
    try {
      const result = await PractitionerService.deletePractitioner({
        uuid: req.params.uuid,
        faskes_uuid: req.author.faskesUuid,
      });
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async findPractitionerByCodeAntrianByFaskes(req, res, nextFunction) {
    try {
      let data = req.params;
      data.faskes_uuid = req.headers.faskes_uuid;

      const result =
        await PractitionerService.findPractitionerByCodeAntrianByFaskes(data);
      res.status(200).json(result);
      res.status;
    } catch (error) {
      nextFunction(error);
    }
  }
}
