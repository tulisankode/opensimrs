import data from "../fix.json"
describe('TEST PERMISSION', () => {
    it('test', async() => {
        permissionSdk("Admisi", "Laporan Admisi", "Kunjungan", "UPDATE");

        permissionSdk("Admisi", "Antrian", null, "PANGGIL");
        permissionSdk("Admisi", "Laporan Admisi", "Penjamin", "READ");
    });
});



function permissionSdk(module, subModule, feature = null, actions){
    const permission = data.permissions;
    try{
        const mdl = permission.find(m => m.module === module);
        if(!mdl) throw Error("ACCESS DENIED");
        const subMdl = mdl.sub_modules.find(sm => sm.name === subModule);
        if(!subMdl) throw Error("ACCESS DENIED SUB MODULE");
        if(feature !== null){
            const ftr = subMdl.features.find(f => f.name === feature);
            if(!ftr) throw Error("ACCESS DENIED");
            if(!ftr.allows.includes(actions)) throw Error("ACCESS DENIED FEATURE");
            console.log("ALLOWED FEATURE");
        }
        if(feature === null) {
            if(!subMdl.allows.includes(actions)) throw new Error("ACCESS DENIED MODULE");
            console.log("ALLOWD MODULE");
        }
        
    }catch(error){
        console.log(error.message);
        
    }
    
}