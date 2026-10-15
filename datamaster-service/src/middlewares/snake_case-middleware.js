const snakeCaseKeys = (req, res, next) => {
  const toSnakeCase = (str) => {
    return str
      .replace(/([A-Z])/g, (letter) => `_${letter.toLowerCase()}`)
      .replace(/[\s-]+/g, "_")
      .replace(/^_/, "");
  };

  const convertKeysToSnakeCase = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map((item) => convertKeysToSnakeCase(item));
    } else if (obj !== null && typeof obj === "object") {
      return Object.keys(obj).reduce((acc, key) => {
        const newKey = toSnakeCase(key);
        acc[newKey] = convertKeysToSnakeCase(obj[key]);
        return acc;
      }, {});
    }
    return obj;
  };

  req.body = convertKeysToSnakeCase(req.body);
  req.query = convertKeysToSnakeCase(req.query);
  req.params = convertKeysToSnakeCase(req.params);

  next();
};

export default snakeCaseKeys;
