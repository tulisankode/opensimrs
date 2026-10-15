import Utils from "../helpers/utils.js";

// Fungsi khusus untuk respons sukses
export default function resultResponse(message, data, property) {
  if (!data && !property) {
    return {
      message: message,
    };
  }

  if (!property) {
    return {
      message: message,
      payload: Utils.convertSequelizeResultToSnakeCase(data),
    };
  }

  if (property) {
    return {
      message: message,
      properties: Utils.convertKeysToSnakeCase(property),
      payload: Utils.convertSequelizeResultToSnakeCase(data),
    };
  }
}
