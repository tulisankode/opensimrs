export const tangani = (fn) => (req,res,next) => Promise.resolve(fn(req,res)).catch((e)=>{ const status=e.status>=400&&e.status<600?e.status:500; if(status>=500) console.error("[mutu-service]",e); res.status(status).json({message:e.message||"Terjadi kesalahan"}); });
export const kirim=(res,payload,message="Data berhasil ditampilkan")=>res.json({message,payload});
export const galat=(status,message)=>Object.assign(new Error(message),{status});
export const wajib=(o,ks)=>{const x=ks.filter(k=>o?.[k]===undefined||o[k]===null||o[k]==="");if(x.length)throw galat(400,`${x.join(", ")} wajib diisi`);};
