import { Sequelize } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import SubMenu from "../models/sub_menu-model.js";

export default class SubMenuRepository {
  static async addSubMenu(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const dataSubMenu = await SubMenu.create(data, { transaction: tr });
      return dataSubMenu;
    });

    return result;
  }

  static async findSubMenuByCode(code) {
    return await SubMenu.findOne({ where: { code: code } });
  }

  static async getAllSubMenuAktif() {
    return await SubMenu.findAll();
  }

  static async exportSubMenu() {
    return await SubMenu.findAll();
  }

  static async getAllSubMenu(page, limit) {
    const offset = (page - 1) * limit;
    const { count, rows } = await SubMenu.findAndCountAll({
      limit: limit,
      offset: offset,
    });

    return {
      totalItems: count,
      subMenuList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findSubMenuById(id) {
    return await SubMenu.findOne({ where: { id } });
  }

  static async updateSubMenu(subMenu, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const updatedSubMenu = await subMenu.update(data, {
        transaction: tr,
      });
      return updatedSubMenu;
    });

    return result;
  }

  static async deleteSubMenu(subMenu) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      await subMenu.destory({ transaction: tr });
      return true;
    });

    return result;
  }

  static async searchSubMenu(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const { count, rows } = await SubMenu.findAndCountAll({
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
      subMenuList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }
}
