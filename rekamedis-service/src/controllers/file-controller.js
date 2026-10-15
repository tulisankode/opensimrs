import successResponse from "../responses/success-response.js";
import FileService from "../services/file-service.js";

export default class FileController {
    static async getAll(request, response, nextFunction) {
        try {
            const result = await FileService.getAll(request.query.rekam_medis_uuid);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async upload(request, response, nextFunction) {
        try {

            if (Array.isArray(request.body)) {
                request.body.forEach(item => {
                    item.faskes_uuid = request.author.faskesUuid;
                    item.token = request.headers["authorization"];
                });
            } else {
                request.body.faskes_uuid = request.author.faskesUuid;
                request.body.token = request.headers["authorization"];
            }

            const result = await FileService.upload(request.body);
            response.status(200).json(successResponse("data berhasil dibuat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async delete(request, response, nextFunction) {
        try {
            await FileService.delete(request.body.file_uuid);
            response.status(200).json(successResponse("data berhasil dihapus"));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async update(request, response, nextFunction) {
        try {
            await FileService.update(request.body);
            response.status(200).json(successResponse("data berhasil diupdate"));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async getLetters(request, response, nextFunction) {
        try {
            const result = await FileService.getLetters(request.query.rekam_medis_uuid);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async downloadLetter(request, response, nextFunction) {
        try {
            const result = await FileService.downloadLetter(request.query.uuid);

            const fileBuffer = Buffer.from(result.file, "base64");

            response.setHeader("Content-Type", "application/pdf");
            response.setHeader("Content-Disposition", `attachment; filename=${result.file_type || "file"}.pdf`);

            response.send(fileBuffer);
        } catch (error) {
            nextFunction(error);
        }
    }

    static async generateLetterCode(request, response, nextFunction) {
        try {
            request.body.faskes_uuid = request.author.faskesUuid;
            request.body.file_type =request.query.type
            const result = await FileService.generateCode(request.body);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }
}