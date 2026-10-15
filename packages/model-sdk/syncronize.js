import * as admisi from "./exports/admisi-exports.js"
import * as antrian from "./exports/antrian-exports.js"
import * as datamaster from "./exports/datamaster-exports.js";
import * as farmasi from "./exports/farmasi-exports.js";
import * as inventory from "./exports/inventory-exports.js";
import * as lab from "./exports/lab-exports.js"
import * as pelayanan from "./exports/pelayanan-exports.js"
import * as rekamMedis from "./exports/rekam-medis-exports.js";
import * as setting from "./exports/setting-exports.js"
import sequelizeInstance from "./configurations/config-db.js";


async function sincronize() {
  await sequelizeInstance.sync({ alter: false, force: true });
}

sincronize()
  .then(() => {
    console.log("Success fully syncronize ....");
    process.exit();
  })
  .catch((err) => {
    console.log("Failed syncronize database....");
    console.error(err);
    process.exit();
  });
