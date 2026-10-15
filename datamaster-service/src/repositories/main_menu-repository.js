import { Sequelize } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import MainMenu from "../models/main_menu-model.js";

export default class MainMenuRepository {
  static async addMainMenu(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      this.findMainMenuByName(data.name);
      const dataMainMenu = await MainMenu.create(data, { transaction: tr });
      return dataMainMenu;
    });

    return result;
  }

  static async findMainMenuByName(name) {
    return await MainMenu.findOne({ where: { name: name } });
  }

  static async getAllMainMenuAktif() {
    return await MainMenu.findAll();
  }

  static async exportMainMenu() {
    return await MainMenu.findAll();
  }

  static async getAllMainMenu(page, limit) {
    const offset = (page - 1) * limit;
    const { count, rows } = await MainMenu.findAndCountAll({
      limit: limit,
      offset: offset,
    });

    return {
      totalItems: count,
      mainMenuList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findMainMenuById(id) {
    return await MainMenu.findOne({ where: { id } });
  }

  static async updateMainMenu(mainMenu, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const updatedMainMenu = await mainMenu.update(data, {
        transaction: tr,
      });
      return updatedMainMenu;
    });

    return result;
  }

  static async deleteMainMenu(mainMenu) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      await mainMenu.destroy({ transaction: tr });
      return true;
    });

    return result;
  }

  static async searchMainMenu(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const { count, rows } = await MainMenu.findAndCountAll({
      where: {
        name: {
          [Sequelize.Op.iLike]: `%${query}%`,
        },
      },
      limit: limit,
      offset: offset,
    });

    return {
      totalItems: count,
      mainMenuList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }
}
