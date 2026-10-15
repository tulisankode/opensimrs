import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import VoucherService from "../services/voucher-service.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { validateExcel } from "../helpers/helper.js";

export default class VoucherController {
  static async createVoucher(req, res, nextFunction) {
    try {
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      const result = await VoucherService.createVoucher(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateVoucher(req, res, nextFunction) {
    try {
      const result = await VoucherService.updateVoucher(
        req.params.uuid,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllVoucher(req, res, nextFunction) {
    try {
      const offset = req.query.page ?? 1;
      const limit = req.query.limit ?? 10;
      const name = req.query.name ?? null;
      const faskes_uuid = req.author.faskesUuid ?? null;
      const order_by = req.query.sort_by ?? "DESC";
      const result = await VoucherService.getAllVoucher({offset, limit, name, faskes_uuid, order_by});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
  static async getAllVoucherAktif(req, res, nextFunction) {
    try {
      const result = await VoucherService.getAllVoucherAktif(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importVoucher(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await VoucherService.importVoucher(
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

  static async exportVoucher(req, res, nextFunction) {
    try {
      const result = await VoucherService.exportVoucher();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getVoucherById(req, res, nextFunction) {
    try {
      const result = await VoucherService.getVoucherById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteVoucher(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid;
      const faskes_uuid = req.author.faskesUuid;
      const result = await VoucherService.deleteVoucher({uuid, faskes_uuid});
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
