import { PermissionBuilder } from "@opensimrs/permission-sdk";
import redisClient from "./redis-client-config.js";

const permissionSdk = PermissionBuilder.setRedis(redisClient).build();

export { permissionSdk };
