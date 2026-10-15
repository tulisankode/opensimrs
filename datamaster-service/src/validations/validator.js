export default class ZodValidator {
  static validate(schema, dataObject) {
    return schema.parse(dataObject);
  }
}
