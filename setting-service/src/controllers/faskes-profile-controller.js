import FaskesProfileService from "../services/faskes-profile-service.js";
import SuccessResponse from "../responses/success-response.js";

export default class FaskesProfileController {
  static async findByFaskesUuid(request, response, nextFunction) {
    try {
      const result = await FaskesProfileService.findByFaskesUuid(request.author.faskesUuid);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async update(request, response, nextFunction) {
    try {
      request.body.uuid = request.author.faskesUuid;
      const result = await FaskesProfileService.update(request.body);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updatePPN(request, response, nextFunction) {
    try {
      request.body.uuid = request.author.faskesUuid;
      const result = await FaskesProfileService.updatePPN(request.body);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateBiayaAdministrasi(request, response, nextFunction) {
    try {
      request.body.uuid = request.author.faskesUuid;
      const result = await FaskesProfileService.updateBiayaAdministrasi(request.body);
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async findPPN(request, response, nextFunction) {
    try {
      const result = await FaskesProfileService.findPPN(request.author.faskesUuid);
      response.status(200).json(SuccessResponse("data berhasil didapat", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async findBiayaAdministrasi(request, response, nextFunction) {
    try {
      const result = await FaskesProfileService.findBiayaAdministrasi(request.author.faskesUuid);
      response.status(200).json(SuccessResponse("data berhasil didapat", result));
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
  static async findFaskesProfileByFaskesUuid(request, response, nextFunction) {
    try{ 
      const result = await FaskesProfileService.findProfileByFaskesUuid(request.params.faskesUuid);
      response.status(200).json(result);
    }catch(error){
      nextFunction(error);
    }
  }

  /**
   * 
   * @param {Request} request 
   * @param {Response} response 
   * @param {NextFunction} nextFunction 
   */
  static async findAllIncludeAddress(request, response, nextFunction) {
    try{ 
      const page = request.query.page === undefined? 1 : request.query.page;
      const pageSize = request.query.pageSize === undefined? 10 : request.query.pageSize;
      const orderBy = request.query.orderBy === undefined? "DESC" : request.query.orderBy;
      const search = request.query.search === undefined ? undefined : request.query.search;
      const result = await FaskesProfileService.findAllFaskesProfileIncludeAddress(page, pageSize, orderBy, search);
      response.status(200).json(result);
    }catch(error){
      nextFunction(error);
    }
  }
}
