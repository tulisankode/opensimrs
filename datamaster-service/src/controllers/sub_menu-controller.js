import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import SubMenuService from "../services/sub_menu-service.js";
import { validateExcel } from "../helpers/helper.js";

export default class SubMenuController {
  static async createSubMenu(req, res, nextFunction) {
    try {
      const newSubMenu = await SubMenuService.createSubMenu(req.body);
      res.status(201).json(newSubMenu);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateSubMenu(req, res, nextFunction) {
    try {
      const updatedSubMenu = await SubMenuService.updateSubMenu(req.params.uuid, req.body);
      res.status(200).json(updatedSubMenu);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllSubMenu(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const query = req.query.name;

      if (query) {
        const listSubMenu = await SubMenuService.searchSubMenu(query, page, pageSize);
        res.status(200).json(listSubMenu);
      } else {
        const listSubMenu = await SubMenuService.getAllSubMenu(page, pageSize);
        res.status(200).json(listSubMenu);
      }
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importSubMenu(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await SubMenuService.importSubMenu(req.file.path);

      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }

      nextFunction(error);
    }
  }

  static async exportSubMenu(req, res, nextFunction) {
    try {
      const data = await SubMenuService.exportSubMenu();
      res.status(200).json(data);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllSubMenuAktif(req, res, nextFunction) {
    try {
      const listSubMenu = await SubMenuService.getAllSubMenuAktif();
      res.status(200).json(listSubMenu);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getSubMenuById(req, res, nextFunction) {
    try {
      const result = await SubMenuService.getSubMenuById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteSubMenu(req, res, nextFunction) {
    try {
      const result = await SubMenuService.deleteSubMenu(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
