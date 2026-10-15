import { Router } from "express";
import multer from "multer";
import ProvinceController from "../controllers/province-controller.js";

const provinceRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Province
provinceRouter.post("/provinsi", ProvinceController.createProvince);
provinceRouter.put("/provinsi/:id", ProvinceController.updateProvince);
provinceRouter.get("/provinsi", ProvinceController.getAllProvince);
provinceRouter.post(
  "/provinsi/import",
  upload.single("file"),
  ProvinceController.importProvince
);
provinceRouter.get("/provinsi/:id", ProvinceController.getProvinceById);
provinceRouter.delete("/provinsi/:id", ProvinceController.deleteProvince);

export default provinceRouter;
