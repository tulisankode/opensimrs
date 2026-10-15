import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import SubMenuValidation from "../validations/sub_menu-validation.js";
import SubMenuRepository from "../repositories/sub_menu-repository.js";
import NotFoundException from "../errors/notfound-exception.js";
import {
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorEdit,
  messageErrorIdNotFound,
  messageErrorSave,
  messageErrorShow,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessExport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";

export default class SubMenuService {
  static async createSubMenu(data) {
    const validationResult = ZodValidator.validate(
      SubMenuValidation.CREATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({
        message: messageErrorSave,
        error: validationResult.errors,
      });
    }
    await SubMenuRepository.addSubMenu(data);
    return successResponse(messageSuccessSave);
  }

  static async updateSubMenu(uuid, data) {
    const validationResult = ZodValidator.validate(
      SubMenuValidation.UPDATE,
      data
    );
    if (validationResult.errors) {
      throw new ValidationException({
        message: messageErrorSave,
        error: validationResult.errors,
      });
    }
    const existingSubMenu = await SubMenuRepository.findSubMenuById(uuid);
    if (!existingSubMenu) {
      throw new NotFoundException(messageErrorEdit, messageErrorIdNotFound);
    }

    await SubMenuRepository.updateSubMenu(existingSubMenu, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllSubMenu(page, pageSize) {
    const pages = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const result = await SubMenuRepository.getAllSubMenu(pages, limit);
    return successResponse(messageSuccessShow, result.subMenuList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllSubMenuAktif() {
    const result = await SubMenuRepository.getAllSubMenuAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getSubMenuById(uuid) {
    const result = await SubMenuRepository.findSubMenuById(uuid);
    if (!result) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }
    return successResponse(messageSuccessShow, result);
  }

  static async exportSubMenu() {
    const result = await SubMenuRepository.exportSubMenu();
    return successResponse(messageSuccessExport, result);
  }

  static async importSubMenu(filePath) {
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
          error.push("Kode SubMenu Pada Baris " + (no + 1) + " Kosong ");
          continue;
        }
        if (!nama || nama == undefined) {
          error.push("Nama SubMenu Pada Baris " + (no + 1) + " Kosong ");
          continue;
        }
        if (status == undefined) {
          error.push("Status SubMenu Pada Baris " + (no + 1) + " Kosong ");
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
        SubMenuValidation.CREATE,
        dataValid[i]
      );

      dataValidZod.push(validationResult);
    }
    // Proses data yang valid
    for (let i = 0; i < dataValidZod.length; i++) {
      await SubMenuRepository.addSubMenu(dataValidZod[i]);
    }

    // Mengembalikan respons dengan informasi sukses dan error
    return successResponse("Data berhasil di import");
  }

  // Search a SubMenu by Name
  static async searchSubMenu(query, page, pageSize) {
    const pages = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const result = await SubMenuRepository.searchSubMenu(query, pages, limit);

    return successResponse(messageSuccessShow, result.subMenuList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  // Delete a SubMenu by UUID
  static async deleteSubMenu(uuid) {
    const existingSubMenu = await SubMenuRepository.findSubMenuById(uuid);
    if (!existingSubMenu) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }
    await SubMenuRepository.deleteSubMenu(existingSubMenu);
    return successResponse(messageSuccessDelete);
  }
}
