import { Router } from "express";
import multer from "multer";
import ItemGigiController from "../controllers/item_gigi-controller.js";

const itemGigiRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Gigi
itemGigiRouter.post("/item_gigi", ItemGigiController.createItemGigi);
itemGigiRouter.put("/item_gigi/:uuid", ItemGigiController.updateItemGigi);
itemGigiRouter.get("/item_gigi", ItemGigiController.getAllItemGigi);
itemGigiRouter.get("/item_gigi/export", ItemGigiController.exportItemGigi);
itemGigiRouter.post(
  "/item_gigi/import",
  upload.single("file"),
  ItemGigiController.importItemGigi
);
itemGigiRouter.get("/item_gigi/aktif", ItemGigiController.getItemGigiAktif);
itemGigiRouter.get("/item_gigi/:uuid", ItemGigiController.getItemGigiByUuid);
itemGigiRouter.delete("/item_gigi/:uuid", ItemGigiController.deleteItemGigi);

export default itemGigiRouter;
