import { Router } from "express";
import multer from "multer";
import VoucherController from "../controllers/voucher-controller.js";

const voucherRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Voucher
voucherRouter.post("/voucher", VoucherController.createVoucher);
voucherRouter.put("/voucher/:uuid", VoucherController.updateVoucher);
voucherRouter.get("/voucher", VoucherController.getAllVoucher);
voucherRouter.post(
  "/voucher/import",
  upload.single("file"),
  VoucherController.importVoucher
);
voucherRouter.get("/voucher/export", VoucherController.exportVoucher);
voucherRouter.get("/voucher/aktif", VoucherController.getAllVoucherAktif);
voucherRouter.get("/voucher/:uuid", VoucherController.getVoucherById);
voucherRouter.delete("/voucher/:uuid", VoucherController.deleteVoucher);

export default voucherRouter;
