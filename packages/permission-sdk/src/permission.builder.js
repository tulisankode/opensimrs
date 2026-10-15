import {NotAllowedException} from "./exceptions/not-allowed-exception.js";


/**
 * @author anata_alliano
 * @link https://github.com/alliano
 */
export class PermissionBuilder {
  /**
   * @type {import("@redis/client").RedisClientType}
   */
  static #redis;



  /**
   * set instance redis, digunakan untuk mengambil permission yang ada pada redis
   * @param {import("@redis/client").RedisClientType} instance
   */
  static setRedis(instance) {
    this.#redis = instance;
    return this;
  }

  static build() {
    /**
     * @param {string} module modul pada opensimrs
     * @param {string} subModule submodul pada opensimrs
     * @param {string} action aksi | READ | DELETE | DLL
     * @param {string} feature fitur pada opensimrs
     */
    return (module, subModule, feature = null, action) => {
      return async (request, response, nextFunction) => {
        try {
          const token = request.get("Authorization").substring(7);
          let data = await this.#redis.get(`token-${generateRedisKey(token)}`);
          const { permissions } = JSON.parse(data);
          if (!permissions) throwNotAlowedException("");
          const mdl = permissions.find((m) => m.module === module);
          if (!mdl) throwNotAlowedException("modul");
          const subMdl = mdl.subModules.find((sm) => sm.name === subModule);
          if (!subMdl) throwNotAlowedException("sub modul");
          if (feature !== null) {
            const ftr = subMdl.features.find((f) => f.name === feature);
            if (!ftr) throwNotAlowedException("fitur");
            if (!ftr.allows.includes(action)) throwNotAlowedException("tidak ada");
            nextFunction();
          }
          if (feature === null) {
            if (!subMdl.allows.includes(action)) throwNotAlowedException("sub modul");
            nextFunction();
          }
        } catch (error) {
          nextFunction(error);
        }
      };
    };
  }
}


const generateRedisKey = (token) => {
  const [, , signature] = token.split(".");
  return signature.substring(1, 11);
};

function throwNotAlowedException(param) {
  throw new NotAllowedException("Gagal", "not allowed", "Anda tidak memiliki hak akese " + param);
}
