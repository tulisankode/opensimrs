import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import MainMenuRepository from "../repositories/main_menu-repository.js";
import MainMenuValidation from "../validations/main_menu-validation.js";
import ConflictException from "../errors/conflict-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import {
  messageErrorConflict,
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorEdit,
  messageErrorIdNotFound,
  messageErrorSave,
  messageErrorShow,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";

export default class MainMenuService {
  static async createMainMenu(data) {
    const validationResult = ZodValidator.validate(
      MainMenuValidation.CREATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({
        message: messageErrorSave,
        error: validationResult.errors,
      });
    }

    const existingCodeMainMenu = await MainMenuRepository.findMainMenuByName(
      data.name
    );

    if (existingCodeMainMenu) {
      throw new ConflictException();
    }

    await MainMenuRepository.addMainMenu(data);
    return successResponse(messageSuccessSave);
  }

  static async updateMainMenu(uuid, data) {
    const validationResult = ZodValidator.validate(
      MainMenuValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({
        message: messageErrorSave,
        error: validationResult.errors,
      });
    }

    const existingMainMenu = await MainMenuRepository.findMainMenuById(uuid);
    if (!existingMainMenu) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.name) {
      if (data.name != existingMainMenu.name) {
        const existingNameMainMenu =
          await MainMenuRepository.findMainMenuByName(data.name);
        if (existingNameMainMenu) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await MainMenuRepository.updateMainMenu(existingMainMenu, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllMainMenu(page, pageSize) {
    const pages = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const result = await MainMenuRepository.getAllMainMenu(pages, limit);
    return successResponse(messageSuccessShow, result.mainMenuList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllMainMenuAktif() {
    const result = await MainMenuRepository.getAllMainMenuAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getMainMenuById(uuid) {
    const result = await MainMenuRepository.findMainMenuById(uuid);
    if (!result) {
      throw new NotFoundException(messageErrorShow, messageErrorIdNotFound);
    }
    return successResponse(messageSuccessShow, result);
  }

  static async exportMainMenu() {
    const result = await MainMenuRepository.exportMainMenu();
    return successResponse(messageSuccessShow, result);
  }

  static async importMainMenu(filePath) {
    let dataValid = [];
    let error = [];

    try {
      // Membaca file dari disk
      const fileBuffer = await fs.readFile(filePath);

      // Mengurai file Excel yang diterima sebagai buffer
      const data = xlsx.parse(fileBuffer);

      // check banyak sheet
      // for (let s = 0; s < data.length; s++) {
      // check data sheet 0
      for (let i = 1; i < data[0].data.length; i++) {
        const no = data[0].data[i][0];
        const kode = data[0].data[i][1];
        const nama = data[0].data[i][2];
        const status = data[0].data[i][3];

        // validate data
        if (!kode || kode == undefined) {
          error.push("Kode MainMenu Pada Baris " + (no + 1) + " Kosong ");
          continue;
        }
        if (!nama || nama == undefined) {
          error.push("Nama MainMenu Pada Baris " + (no + 1) + " Kosong ");
          continue;
        }
        if (status == undefined) {
          error.push("Status MainMenu Pada Baris " + (no + 1) + " Kosong ");
          continue;
        }

        dataValid.push({ code: kode, name: nama, status: status });
      }
      // }

      if (error.length > 0) {
        return {
          message: "Import data gagal",
          total_error: error.length,
          errors: error,
        };
      }
    } catch (error) {
      throw new Error(`Error: ${error.message}`);
    }

    let dataValidZod = [];

    for (let i = 0; i < dataValid.length; i++) {
      const validationResult = ZodValidator.validate(
        MainMenuValidation.CREATE,
        dataValid[i]
      );

      dataValidZod.push(validationResult);
    }
    // Proses data yang valid
    for (let i = 0; i < dataValidZod.length; i++) {
      await MainMenuRepository.addMainMenu(dataValidZod[i]);
    }

    // Mengembalikan respons dengan informasi sukses dan error
    return successResponse("Data berhasil di import");
  }

  static async searchMainMenu(query, page, pageSize) {
    const pages = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const result = await MainMenuRepository.searchMainMenu(query, pages, limit);

    return successResponse(messageSuccessShow, result.mainMenuList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async deleteMainMenu(uuid) {
    const result = await MainMenuRepository.findMainMenuById(uuid);
    if (!result) {
      throw new NotFoundException(messageErrorDelete, messageErrorIdNotFound);
    }
    await MainMenuRepository.deleteMainMenu(result);

    return successResponse(messageSuccessDelete);
  }
}
