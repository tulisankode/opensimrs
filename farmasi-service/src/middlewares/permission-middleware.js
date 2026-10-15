import "dotenv/config";
import { createClient } from "redis";
import generateRedisKeyByJwtToken from "@opensimrs/authorization-sdk/generateKeyRedis";

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_USERNAME = process.env.REDIS_USERNAME?.trim() || undefined;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD?.trim() || undefined;
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_DATABASE = Number.parseInt(process.env.REDIS_DATABASE, 10) || 0;

let redisClient;

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeAllow = (allow) => {
  if (typeof allow === "string") return { name: allow };
  if (allow && typeof allow === "object" && allow.name) {
    return { name: String(allow.name) };
  }
  return null;
};

const normalizeAllows = (allows) => toArray(allows).map(normalizeAllow).filter(Boolean);

const normalizeFeature = (feature) => {
  if (!feature || typeof feature !== "object" || !feature.name) return null;

  return {
    name: String(feature.name),
    allows: normalizeAllows(feature.allows),
  };
};

const normalizeSubmodule = (submodule) => {
  if (!submodule || typeof submodule !== "object" || !submodule.name) return null;

  return {
    name: String(submodule.name),
    features: toArray(submodule.features).map(normalizeFeature).filter(Boolean),
    allows: normalizeAllows(submodule.allows),
  };
};

const normalizePermissions = (permissions) =>
  toArray(permissions)
    .map((module) => {
      if (!module || typeof module !== "object" || !module.module) return null;

      return {
        module: String(module.module),
        submodules: toArray(module.submodules ?? module.subModules ?? module.sub_modules)
          .map(normalizeSubmodule)
          .filter(Boolean),
      };
    })
    .filter(Boolean);

const includesAction = (allows, action) => {
  const actionList = Array.isArray(action) ? action : [action ?? "READ"];

  return actionList.some((item) =>
    allows.some((allow) => normalizeText(allow.name) === normalizeText(item))
  );
};

const hasPermission = (permissions, moduleName, submoduleName, action, featureName = null) => {
  const targetModule = permissions.find(
    (module) => normalizeText(module.module) === normalizeText(moduleName)
  );
  if (!targetModule) return false;
  if (!submoduleName) return true;

  const matchingSubmodules = targetModule.submodules.filter(
    (submodule) => normalizeText(submodule.name) === normalizeText(submoduleName)
  );
  if (!matchingSubmodules.length) return false;

  if (featureName) {
    return matchingSubmodules.some((submodule) => {
      const feature = submodule.features.find(
        (item) => normalizeText(item.name) === normalizeText(featureName)
      );

      return feature ? includesAction(feature.allows, action) : false;
    });
  }

  return matchingSubmodules.some((submodule) => includesAction(submodule.allows, action));
};

const getRedisClient = async () => {
  if (!redisClient) {
    const redisOptions = {
      database: REDIS_DATABASE,
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
    };

    if (REDIS_USERNAME) redisOptions.username = REDIS_USERNAME;
    if (REDIS_PASSWORD) redisOptions.password = REDIS_PASSWORD;

    redisClient = createClient(redisOptions);
    redisClient.on("error", (error) => {
      console.error("[Permission Middleware Redis]", error.message);
    });
  }

  if (!redisClient.isOpen) await redisClient.connect();
  return redisClient;
};

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getBearerToken = (request) => {
  const bearerToken = request.get("Authorization");
  if (!bearerToken) return null;

  return bearerToken.replace(/^Bearer\s+/i, "");
};

const getEffectivePermissions = async (request) => {
  const authorPermissions = request.author?.permissions ?? request.author?.permission;
  if (authorPermissions) return normalizePermissions(authorPermissions);

  const token = getBearerToken(request);
  if (!token) return [];

  const client = await getRedisClient();
  const session = parseJson(
    await client.get(`token-${generateRedisKeyByJwtToken(token)}`)
  );

  return normalizePermissions(
    session?.permissions ?? session?.permission ?? session?.payload ?? []
  );
};

const forbidden = (response, moduleName, submoduleName, action) =>
  response.status(403).json({
    message: "Akses ditolak",
    errors: [
      {
        type: "permission",
        message: `Permission ${moduleName}/${submoduleName}/${action} tidak tersedia`,
      },
    ],
  });

export const permissionSdk =
  (moduleName, submoduleName, action = "READ", featureName = null) =>
  async (request, response, nextFunction) => {
    try {
      const permissions = await getEffectivePermissions(request);

      if (
        permissions.length === 0 &&
        normalizeText(request.author?.role) === "super admin"
      ) {
        return nextFunction();
      }

      if (hasPermission(permissions, moduleName, submoduleName, action, featureName)) {
        return nextFunction();
      }

      return forbidden(response, moduleName, submoduleName, action);
    } catch (error) {
      return nextFunction(error);
    }
  };

// Lolos bila salah satu aturan terpenuhi. Dipakai untuk endpoint yang diakses dari dua sisi,
// mis. order alkes: petugas farmasi (Farmasi Ruangan) maupun perawat/dokter dari rekam medis pasien.
// aturan: [{ module, submodule, action (string | string[]), feature? }]
export const permissionAny =
  (aturan = []) =>
  async (request, response, nextFunction) => {
    try {
      const permissions = await getEffectivePermissions(request);

      if (
        permissions.length === 0 &&
        normalizeText(request.author?.role) === "super admin"
      ) {
        return nextFunction();
      }

      if (aturan.some((a) => hasPermission(permissions, a.module, a.submodule, a.action, a.feature ?? null))) {
        return nextFunction();
      }

      const utama = aturan[0] ?? {};
      return forbidden(response, utama.module, utama.submodule, [].concat(utama.action ?? "READ").join("|"));
    } catch (error) {
      return nextFunction(error);
    }
  };

export default permissionSdk;
