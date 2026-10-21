import FaskesService from "../services/faskes-service.js";
import deleteFile from "../helpers/delete-file.js";
import { validateExcel } from "../helpers/helper.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";

export default class FaskesController {
  static async createFaskes(req, res, nextFunction) {
    try {
      const result = await FaskesService.createFaskes(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateFaskes(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      const result = await FaskesService.updateFaskes(req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllFaskes(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;

      const result = await FaskesService.getAllFaskes(name, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importFaskes(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await FaskesService.importFaskes(req.file.path);
      await deleteFile(req.file.path);
      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportFaskes(req, res, nextFunction) {
    try {
      const result = await FaskesService.exportFaskes();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllFaskesAktif(req, res, nextFunction) {
    try {
      const result = await FaskesService.getAllFaskesAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getFaskesByUuid(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid ?? null;
      const result = await FaskesService.fidnByUuid({ uuid });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteFaskes(req, res, nextFunction) {
    try {
      const result = await FaskesService.deleteFaskes(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async restoreFaskes(req, res, nextFunction) {
    try {
      await FaskesService.restoreFaskes(req.params.uuid);
      res.status(204).send();
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {nextFunction} nextFunction
   */
  static async findAllFaskesIncludeAddressAndPoli(
    request,
    response,
    nextFunction
  ) {
    try {
      const page = request.query.page ?? 1;
      const pageSize = request.query.page_size ?? 10;
      const orderBy = request.query.order_by ?? "DESC";
      const search = request.query.search ?? null;
      const result = await FaskesService.findAllFaskesIncludeAddressAndPoli({
        page,
        pageSize,
        orderBy,
        search,
      });
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllForPatient(request, response, nextFunction) {
    try {
      const faskesUuid = request.author?.faskesUuid;
      if (!faskesUuid) {
        throw new HttpException(
          { message: "Konteks faskes tidak tersedia", payload: null },
          HttpStatus.UNAUTHORIZED
        );
      }
      const result = await FaskesService.getActiveForPatient(faskesUuid);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetailForPatient(request, response, nextFunction) {
    try {
      const data = request.params;
      const result = await FaskesService.getDetailForPatient(data);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
