import { KioskLayarService } from "../services/kiosk-layar.service.js";

export class KioskLayarController {
  // Admin: ambil kunci kiosk layar (dibuat bila belum ada).
  static async ambilKunci(req, res, next) {
    try {
      const data = await KioskLayarService.ambilKunci({
        faskesUuid: req.author.faskesUuid,
        uuid: req.params.layar_antrian_uuid,
      });
      res.status(200).json({ message: "Kunci kiosk berhasil diambil", payload: data });
    } catch (err) {
      next(err);
    }
  }

  // Admin: buat ulang kunci; link kiosk lama tidak berlaku lagi.
  static async buatUlangKunci(req, res, next) {
    try {
      const data = await KioskLayarService.ambilKunci({
        faskesUuid: req.author.faskesUuid,
        uuid: req.params.layar_antrian_uuid,
        buatUlang: true,
      });
      res.status(200).json({ message: "Kunci kiosk berhasil dibuat ulang", payload: data });
    } catch (err) {
      next(err);
    }
  }

  // Publik (TV): data layar & panggilan hari ini, diakses dengan kunci layar.
  static async dataPublik(req, res, next) {
    try {
      const data = await KioskLayarService.dataPublik({
        uuid: req.params.layar_antrian_uuid,
        kunci: req.query.kunci ?? req.headers["x-kunci-layar"],
      });
      res.set("Cache-Control", "no-store");
      res.status(200).json({ message: "Data layar berhasil ditampilkan", payload: data });
    } catch (err) {
      next(err);
    }
  }
}
