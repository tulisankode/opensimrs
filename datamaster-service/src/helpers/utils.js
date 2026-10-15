import _ from "lodash";

export default class Utils {
  // Fungsi untuk mengonversi key menjadi snake_case
  static convertKeysToSnakeCase(obj) {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertKeysToSnakeCase(item));
    } else if (obj !== null && typeof obj === "object") {
      return _.mapKeys(obj, (value, key) => _.snakeCase(key));
    }
    return obj;
  }

  static convertSequelizeResultToSnakeCase(sequelizeResult) {
    if (!Array.isArray(sequelizeResult)) {
      return this.convertKeysToSnakeCase(sequelizeResult.dataValues);
    }
    return sequelizeResult.map((data) =>
      this.convertKeysToSnakeCase(data.dataValues)
    );
  }

  static convertKeysPaginationToSnakeCase = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map((item) => convertKeysToSnakeCase(item));
    } else if (obj !== null && typeof obj === "object") {
      if (item.dataValues) {
        return mapKeys(item.dataValues, (value, key) => snakeCase(key));
      }
      return mapKeys(obj, (value, key) => snakeCase(key));
    }
    return obj;
  };

  static validateUUID(uuid) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    return uuidRegex.test(uuid);
  }
}
