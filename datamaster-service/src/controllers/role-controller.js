import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import RoleService from "../services/role-service.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import path from "path";
import BadRequestException from "../errors/bad_request-exception.js";
import { validateExcel } from "../helpers/helper.js";

export default class RoleController {
  static async createRole(req, res, nextFunction) {
    try {
      // const faskes_uuid = res.locals.jwtData.faskesUuid;
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      const result = await RoleService.createRole(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateRole(req, res, nextFunction) {
    try {
      const result = await RoleService.updateRole(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllRole(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;
      const faskes_uuid = req.author.faskesUuid;
      const order_by = req.query.order_by || "DESC";
      const result = await RoleService.getAllRole(name, page, pageSize, order_by, faskes_uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importRole(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      // const faskesUuid = res.locals.jwtData.faskesUuid;
      const result = await RoleService.importRole(
        req.author.faskesUuid ?? faskes_uuid_dummy,
        req.file.path
      );
      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportRole(req, res, nextFunction) {
    try {
      const result = await RoleService.exportRole(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllRoleAktif(req, res, nextFunction) {
    try {
      const result = await RoleService.getAllRoleAktif(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getRoleById(req, res, nextFunction) {
    try {
      const result = await RoleService.getRoleById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteRole(req, res, nextFunction) {
    try {
      const result = await RoleService.deleteRole(req.params.uuid);
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
