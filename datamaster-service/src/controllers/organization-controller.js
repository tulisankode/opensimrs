import OrganizationService from "../services/organization-service.js";
import deleteFile from "../helpers/delete-file.js";
import { validateExcel } from "../helpers/helper.js";
import { PartOfOrganizationService } from "../services/part-of-organization-service.js";

export default class OrganizationController {

  /**
   * 
   * @param {Request} req 
   * @param {Response} resp 
   * @param {import("express").NextFunction} nextFunction 
   */
  static async findAllPartOf(req, resp, nextFunction) {
    try {
      const offset = req.query.offset || 1;
      const limit = req.query.limit || 10;
      const name = req.query.name || null;
      const order_by = req.query.order_by || "DESC";
      const faskes_uuid = req.author.faskesUuid || null;
      const result = await OrganizationService.findAllPartOf({ limit, offset, name, faskes_uuid, order_by });
      resp.status(200).json(result);
    }catch(error){
      nextFunction(error);
    }
  }

  /**
   * 
   * @param {Request} request - Request
   * @param {Response} response - response
   * @param {NewableFunction} nextFunction - NextFunction
   */
  static async findAllIncludePartOf(request, response, nextFunction) {
    try{
      const faskes_uuid = request.author.faskesUuid;
      const limit = request.query.limit ?? 10;
      const offset = request.query.page ?? 1;
      const order_by = request.query.order_by ?? "DESC";
      const search = request.query.name ?? "";
      const result = await OrganizationService.findAllIncludePrartOf({faskes_uuid, limit, offset, order_by, search});
      response.status(200).json(result)
    }catch(error){
      nextFunction(error);
    }
  }



  static async createOrganization(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await OrganizationService.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateOrganization(req, res, nextFunction) {
    try {
      let result;
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.uuid = req.params.uuid;
      if("part_of" in req.body){
        result = await PartOfOrganizationService.update(req.body);
      }
      else {
        result = await OrganizationService.updateOrganization(req.body);
      }
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllOrganization(req, res, nextFunction) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.limit) || 10;
      const name = req.query.name ?? null;
      const order_by = req.query.order_by || "DESC";

      const organizationList = await OrganizationService.getAllOrganization(name, page, pageSize, order_by, req.author.faskesUuid);
      res.status(200).json(organizationList);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllOrganizationAktif(req, res, nextFunction) {
    try {
      const result = await OrganizationService.getAllOrganizationAktif(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importOrganization(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await OrganizationService.importOrganization(req.author.faskesUuid, req.file.path);
      await deleteFile(req.file.path);
      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportOrganization(req, res, nextFunction) {
    try {
      const data = await OrganizationService.exportOrganization(req.author.faskesUuid);
      res.status(200).json(data);
    } catch (error) {
      console.log(error);
      nextFunction(error);
    }
  }

  static async getOrganizationById(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid;
      const uuid = req.params.uuid;
      const result = await OrganizationService.getOrganizationById({faskes_uuid, uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteOrganization(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid;
      const uuid = req.params.uuid;
      const result = await OrganizationService.deleteOrganization({faskes_uuid, uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
