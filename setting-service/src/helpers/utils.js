export default class Utils {
    static camelToSnakeObject(obj, exclude = []) {
        const newObj = {};

        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {

                if(exclude.includes(key)){
                    newObj[key] = obj[key];
                    continue;
                }

                const snakeCaseKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
                newObj[snakeCaseKey] = obj[key];
            }
        }

        return newObj;
    }

    static snakeToCamelObject(obj) {
        const newObj = {};

        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                const camelCaseKey = key.replace(/_([a-z])/g, (match, p1) => p1.toUpperCase());
                newObj[camelCaseKey] = obj[key];
            }
        }

        return newObj;
    }
}