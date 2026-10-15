import Utils from "./utils.js";

export default class Pagination {
  static async init(model, args, options = {}) {
    const page = parseInt(args.page || 1, 10);
    const limit = parseInt(args.limit || 10, 10);
    const offset = (page - 1) * limit;
    const subQuery = args.subQuery ?? false;

    const query = await model.findAndCountAll({
      limit: limit,
      offset: offset,
      distinct: true,
      subQuery: subQuery,
      ...options,
    });

    const mappedRows = query.rows.map((row) =>
      Utils.camelToSnakeObject(row.toJSON())
    );

    if (query.count instanceof Array) {
      query.count = query.count.length;
    }

    return {
      data: mappedRows,
      pagination: Utils.paginationHelper(page, limit, query.count),
    };
  }
}
