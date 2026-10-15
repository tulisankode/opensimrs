import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse } from "../helpers/generate-message.js";
import UserService from "../services/user-service.js";

export default class UserController {


  /**
   * 
   * @param {Request} request 
   * @param {Response} response 
   * @param {import("express").NextFunction} nextFunction 
   */
  static async findAllUser(request, response, nextFunction){
    try{
      const limit = request.query.limit ?? 10;
      const offset = request.query.offset ?? 1;
      const order_by = request.query.order_by ?? "DESC";
      const search = request.query.search ?? null;
      const faskes_uuid = request.author.faskesUuid ?? null;
      const result = await UserService.findAllUser({limit, offset, order_by, search, faskes_uuid});
      response.status(200).json(result);
    }catch(error){
      nextFunction(error);
    }
  }


  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {import("express").NextFunction} nextFunction
   */
  static async create(request, response, nextFunction) {
    try {
      request.body.faskes_uuid = request.author.faskesUuid;
      const result = await UserService.create(request.body);
      response.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {import("express").NextFunction} nextFunction
   */
  static async updatePassword(request, response, nextFunction) {
    try {
      request.body.uuid = request.params.uuid;
      request.body.faskesUuid = request.author.faskesUuid;
      const result = await UserService.updatePassword(request.body);
      response.status(202).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {import("express").NextFunction} nextFunction
   */
  static async update(request, response, nextFunction) {
    try {
      request.body.user_uuid = request.params.uuid;
      request.body.faskes_uuid = request.author.faskesUuid;
      const result = await UserService.update(request.body);
      response.status(202).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {import("express").NextFunction} nextFunction
   */
  static async findAll(request, response, nextFunction) {
    try {
      const page = request.query.page !== undefined ? parseInt(request.query.page) : 0;
      const pageSize = request.query.pageSize !== undefined ? parseInt(request.query.pageSize) : 10;
      const order = request.query.order !== undefined ? request.query.order : "DESC";
      const role = request.query.role !== undefined ? { name: request.query.role } : undefined;
      const name = request.query.name !== undefined ? request.query.name : "";
      const result = await UserService.findAll(page, pageSize, order, role, name, request.author);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {import("express").NextFunction} nextFunction
   */
  static async export(request, response, nextFunction) {
    try {
      const result = await UserService.export(request.author.faskesUuid);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {import("express").NextFunction} nextFunction
   */
  static async delete(request, response, nextFunction) {
    try {
      request.body.uuid = request.params.uuid;
      request.body.faskesUuid = request.author.faskesUuid;
      const result = await UserService.delete(request.body);
      response.status(202).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {import("express").NextFunction} nextFunction
   */
  static async findAllDeleted(request, response, nextFunction) {
    try {
      const result = await UserService.findAllDeleted(request.author.faskesUuid);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async findByUuidIncludeRole(request, response, nextFunction) {
    try {
      request.body.uuid = request.params.uuid;
      request.body.faskesUuid = request.author.faskesUuid;
      const result = await UserService.findByUuidIncludeRole(request.body);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request
   * @param {Response} response
   * @param {NextFunction} nextFunction
   */
  static async import(request, response, nextFunction) {
    try {
      console.log(request.file)
      const files = request.file;
      if (!files) {
        throw new HttpException(generateErrorResponse("Gagal import", "required", "file harus di sertakan"), HttpStatus.BAD_REQUEST);
      }
      const allowExtentions = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
      if (!allowExtentions.includes(files.mimetype)) throw new HttpException(generateErrorResponse("Gagal import", "invalid", "file yang di import harus file excel"), HttpStatus.BAD_REQUEST);
      const result = await UserService.import(files.path, request.author.faskesUuid);
      response.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
