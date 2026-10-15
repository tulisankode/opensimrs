import { Router } from "express";
import multer from "multer";
import SubMenuController from "../controllers/sub_menu-controller.js";

const subMenuRouter = Router();
const upload = multer({ dest: "src/uploads/" });

subMenuRouter.post("/sub_menu", SubMenuController.createSubMenu);
subMenuRouter.put("/sub_menu/:uuid", SubMenuController.updateSubMenu);
subMenuRouter.get("/sub_menu", SubMenuController.getAllSubMenu);
subMenuRouter.get("/sub_menu/export", SubMenuController.exportSubMenu);
subMenuRouter.post(
  "/sub_menu/import",
  upload.single("file"),
  SubMenuController.importSubMenu
);
subMenuRouter.get("/sub_menu/:uuid", SubMenuController.getSubMenuById);
subMenuRouter.delete("/sub_menu/:uuid", SubMenuController.deleteSubMenu);

export default subMenuRouter;
