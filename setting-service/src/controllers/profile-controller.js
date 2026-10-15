import ProfileService from "../services/profile-service.js";
import successResponse from "../responses/success-response.js";

export default class ProfileController {
    static async getProfile(request, response, nextFunction) {
        try {
            const username = request.author.username;
            const profile = await ProfileService.getProfileByUsername(username);
            response.status(200).json(successResponse("data berhasil didapat", profile));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async updateProfile(request, response, nextFunction) {
        try {
            const username = request.author.username;
            const req = request.body;
            req.username = username;
            await ProfileService.update(req);
            response.status(200).json(successResponse("data berhasil diupdate"));
        } catch (error) {
            nextFunction(error);
        }
    }
}