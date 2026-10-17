import express from "express";
import { wajibLogin } from "./auth.js";
import fisioterapi from "./fisioterapi/rute.js";
import radiologi from "./radiologi/rute.js";
import mcu from "./mcu/rute.js";
import patologi from "./patologi/rute.js";
import mikrobiologi from "./mikrobiologi/rute.js";
import cssd from "./cssd/rute.js";
import bankDarah from "./bank-darah/rute.js";

// /api/v3/penunjang/{fisioterapi|radiologi|mcu|patologi|mikrobiologi|cssd|bank-darah}/...
const rute = express.Router();
rute.get("/health", (req, res) => res.json({ message: "OK" }));
rute.use(wajibLogin);
rute.use("/fisioterapi", fisioterapi);
rute.use("/radiologi", radiologi);
rute.use("/mcu", mcu);
rute.use("/patologi", patologi);
rute.use("/mikrobiologi", mikrobiologi);
rute.use("/cssd", cssd);
rute.use("/bank-darah", bankDarah);

export default rute;
