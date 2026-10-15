import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import MainMenuService from "../services/main_menu-service.js";
import { validateExcel } from "../helpers/helper.js";

export default class MainMenuController {
  static async createMainMenu(req, res, nextFunction) {
    try {
      const newMainMenu = await MainMenuService.createMainMenu(req.body);
      res.status(201).json(newMainMenu);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateMainMenu(req, res, nextFunction) {
    try {
      const updatedMainMenu = await MainMenuService.updateMainMenu(
        req.params.uuid,
        req.body
      );
      res.status(200).json(updatedMainMenu);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllMainMenu(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const query = req.query.name;

      if (query) {
        const listMainMenu = await MainMenuService.searchMainMenu(
          query,
          page,
          pageSize
        );
        res.status(200).json(listMainMenu);
      } else {
        const listMainMenu = await MainMenuService.getAllMainMenu(
          page,
          pageSize
        );
        res.status(200).json(listMainMenu);
      }
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importMainMenu(req, res, nextFunction) {
    try {
     validateExcel(req.file);
      const result = await MainMenuService.importMainMenu(req.file.path);

      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }

      nextFunction(error);
    }
  }

  static async exportMainMenu(req, res, nextFunction) {
    try {
      const data = await MainMenuService.exportMainMenu();
      res.status(200).json(data);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllMainMenuAktif(req, res, nextFunction) {
    try {
      const listMainMenu = await MainMenuService.getAllMainMenuAktif();
      res.status(200).json(listMainMenu);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getMainMenuById(req, res, nextFunction) {
    try {
      const result = await MainMenuService.getMainMenuById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteMainMenu(req, res, nextFunction) {
    try {
      const result = await MainMenuService.deleteMainMenu(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async restoreMainMenu(req, res, nextFunction) {
    try {
      await MainMenuService.restoreMainMenu(req.params.uuid);
      res.status(204).send();
    } catch (error) {
      nextFunction(error);
    }
  }
}
