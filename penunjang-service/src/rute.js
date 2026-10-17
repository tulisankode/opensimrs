import express from "express";
import { wajibLogin } from "./auth.js";
import fisioterapi from "./fisioterapi/rute.js";
import radiologi from "./radiologi/rute.js";
import mcu from "./mcu/rute.js";
import patologi from "./patologi/rute.js";
import mikrobiologi from "./mikrobiologi/rute.js";
import training from "./training/rute.js";
import koding from "./koding/rute.js";
import kamarOperasi from "./kamar-operasi/rute.js";
import gizi from "./gizi/rute.js";
import utd from "./utd/rute.js";
import cssd from "./cssd/rute.js";
import bankDarah from "./bank-darah/rute.js";

// /api/v3/penunjang/{fisioterapi|radiologi|mcu|patologi|mikrobiologi|cssd|bank-darah|utd|gizi}/...
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
rute.use("/utd", utd);
rute.use("/gizi", gizi);
rute.use("/kamar-operasi", kamarOperasi);
rute.use("/koding", koding);
rute.use("/training", training);

export default rute;
