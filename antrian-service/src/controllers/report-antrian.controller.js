import { ReportAntrianService } from "../services/report-antrian.service.js";

export class ReportAntrianController {
  static async cancelBookingFromMobile(req, res, next) {
    try {
      const result = await ReportAntrianService.cancelBookingFromMobile(
        req.body
      );

      return res.json({
        message: "Booking berhasil dibatalkan.",
      });
    } catch (err) {
      next(err);
    }
  }
}
