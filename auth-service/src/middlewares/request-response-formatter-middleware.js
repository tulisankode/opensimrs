const requestResponseFormatterMidddleware = (request, response, nextFunction) => {
  request.body = snakeToCamelCase(request.body);
  const resp = response.json;
  response.json = function (data) {
    resp.call(this, camelToSnakeCase(data));
  };
  nextFunction();
};

function camelToSnakeCase(obj) {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(camelToSnakeCase);
  }

  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    acc[snakeKey] = camelToSnakeCase(obj[key]);
    return acc;
  }, {});
}

function snakeToCamelCase(obj) {
  if (typeof obj !== "object" || obj === null) {
    return obj; 
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamelCase);
  }

  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/(_\w)/g, (matches) => matches[1].toUpperCase());
    acc[camelKey] = snakeToCamelCase(obj[key]);
    return acc;
  }, {});
}
export default requestResponseFormatterMidddleware;
