import PerpindahanService from "../services/perpindahan-service.js";
import successResponse from "../responses/success-response.js";

export default class PerpindahanController {
    static async GetCurrentBed(req, res, next) {
        try {
            const { uuid } = req.params;
            const result = await PerpindahanService.GetCurrentBed(uuid);
            return res.status(200).json(successResponse("Success Get Current Bed", result));
        } catch (error) {
            console.log("Error on PerpindahanController.GetCurrentBed");
            next(error);
        }
    }

    static async RequestMoveBed(req, res, next) {
        try {
            const { uuid } = req.params;
            const data = req.body;
            await PerpindahanService.RequestMoveBed(uuid, data);
            return res.status(200).json(successResponse("Success Request Move Bed"));
        } catch (error) {
            console.log("Error on PerpindahanController.RequestMoveBed");
            next(error);
        }
    }

    static async RejectMoveBed(req, res, next) {
        try {
            const { uuid } = req.params;
            const result = await PerpindahanService.RejectMoveBed(uuid);
            return res.status(200).json(successResponse("Success Reject Move Bed"));
        } catch (error) {
            console.log("Error on PerpindahanController.RejectMoveBed");
            next(error);
        }
    }

    static async ApproveMoveBed(req, res, next) {
        try {
            const { uuid } = req.params;
            const result = await PerpindahanService.ApproveMoveBed(uuid);
            return res.status(200).json(successResponse("Success Approve Move Bed"));
        } catch (error) {
            console.log("Error on PerpindahanController.ApproveMoveBed");
            next(error);
        }
    }

    static async GetHistoryMoveBed(req, res, next) {
        try {
            const { uuid } = req.params;
            const result = await PerpindahanService.GetHistoryMoveBed(uuid);
            return res.status(200).json(successResponse("Success Get History Move Bed", result));
        } catch (error) {
            console.log("Error on PerpindahanController.GetHistoryMoveBed");
            next(error);
        }
    }

    static async GetRequestMoveBed(req, res, next) {
        try {
            const { uuid } = req.params;
            const result = await PerpindahanService.GetRequestMoveBed(uuid);
            return res.status(200).json(successResponse("Success Get Request Move Bed", result));
        } catch (error) {
            console.log("Error on PerpindahanController.GetRequestMoveBed");
            next(error);
        }
    }

    static async GetTotalPending(req, res, next) {
        try {
            const result = await PerpindahanService.GetTotalPending();
            return res.status(200).json(successResponse("Success Get Total Pending", result));
        } catch (error) {
            console.log("Error on PerpindahanController.GetRequestMoveBedByUuid");
            next(error);
        }
    }


    static async GetAllRequest(req, res, next) {
        try {
            const result = await PerpindahanService.GetAllData(req.query);
            return res.status(200).json(successResponse("Success Get All History", result.data, result.pagination));
        } catch (error) {
            console.log("Error on PerpindahanController.GetAllHistory");
            next(error);
        }
    }
}