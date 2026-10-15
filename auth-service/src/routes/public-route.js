import express from "express";
import AuthenticationController from "../controllers/authentication-controller.js";

const publicRoutes = express.Router();
publicRoutes.post(`/login`, AuthenticationController.login);
publicRoutes.post(`/refresh-token`, AuthenticationController.refreshToken);



export default publicRoutes;