import jwt from "jsonwebtoken";
import config from "./config.js";
export const wajibLogin = (req,res,next) => { const h=req.headers.authorization??""; const token=h.startsWith("Bearer ")?h.slice(7):h; if(!token)return res.status(401).json({message:"Token tidak ditemukan"}); try { const x=jwt.verify(token,config.secretKey,{algorithms:["HS256"]}); if(!x.faskesUuid)return res.status(401).json({message:"Token tidak memuat faskes"}); req.author={faskesUuid:x.faskesUuid,username:x.username,role:x.role}; next(); } catch { res.status(401).json({message:"Token tidak valid"}); } };
