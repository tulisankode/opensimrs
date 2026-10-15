import { Router } from "express";
import multer from "multer";
import MainMenuController from "../controllers/main_menu-controller.js";

const mainMenuRouter = Router();
const upload = multer({ dest: "src/uploads/" });

mainMenuRouter.post("/main_menu", MainMenuController.createMainMenu);
mainMenuRouter.put("/main_menu/:uuid", MainMenuController.updateMainMenu);
mainMenuRouter.get("/main_menu", MainMenuController.getAllMainMenu);
mainMenuRouter.get("/main_menu/export", MainMenuController.exportMainMenu);
mainMenuRouter.post(
  "/main_menu/import",
  upload.single("file"),
  MainMenuController.importMainMenu
);
mainMenuRouter.get("/main_menu/:uuid", MainMenuController.getMainMenuById);
mainMenuRouter.delete("/main_menu/:uuid", MainMenuController.deleteMainMenu);

export default mainMenuRouter;
