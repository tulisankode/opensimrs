import moment from "moment";

export const hookModel = {
  beforeCreate: (instance, options) => {
    const unixTimestamp = moment().unix();
    instance.created_at = unixTimestamp;
    instance.updated_at = unixTimestamp;
  },
  beforeUpdate: (instance, options) => {
    instance.updated_at = moment().unix();
  },
  beforeSave: (instance, options) => {
    instance.updated_at = moment().unix();
  },
  beforeDefine(attributes, options) {
    Object.keys(attributes).forEach((key) => {
      const snakeCase = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (snakeCase !== key) {
        attributes[snakeCase] = attributes[key];
        delete attributes[key];
      }
    });
  },
};
