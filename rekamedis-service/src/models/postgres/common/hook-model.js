import moment from 'moment';
import {toEpochDate} from "../../../helpers/date-helper.js";

export const hookModel = {
    beforeCreate: (instance, options) => {
        const unixTimestamp = moment().unix();
        instance.createdAt = unixTimestamp;
        instance.updatedAt = unixTimestamp;
    },
    beforeUpdate: (instance, options) => {
        instance.updated_at = toEpochDate(new Date());
    },
    beforeSave : (instance, options) => {
        instance.updated_at = toEpochDate(new Date());
    },
    beforeDefine(attributes, options) {
        Object.keys(attributes).forEach((key) => {
            const snakeCase = key.replace(/([A-Z])/g, "_$1").toLowerCase();
            if (snakeCase !== key) {
                attributes[snakeCase] = attributes[key];
                delete attributes[key];
            }
        });
    }
};