import Utils from "./utils.js";

export default class Pagination {
    static async init(model, args, options = {}) {
        const page = args.page || 1;
        const limit = args.limit || 10;
        const offset = (page - 1) * limit;
        const subQuery = args.subQuery ?? false;

        let totalCount = 0;
        let paginatedRows = [];

        if (options.group && Array.isArray(options.group) && options.group.length > 0) {
            const findOptions = {
                ...options,
                limit: null,
                offset: null,
                subQuery: false, 
            };
            delete findOptions.distinct;

            const allRows = await model.findAll(findOptions);

            totalCount = allRows.length; 
            
            paginatedRows = allRows.slice(offset, offset + limit);

        } else {
            const { ...countOptionsClean } = options;
            const countOptions = {
                where: countOptionsClean.where,
                include: countOptionsClean.include,
                distinct: true,
                col: model.primaryKeyAttribute 
            };
            
            totalCount = await model.count(countOptions);

            const findOptions = {
                ...options, 
                limit: limit,
                offset: offset,
                subQuery: subQuery, 
            };
            
            paginatedRows = await model.findAll(findOptions);
        }

        const mappedRows = paginatedRows.map(row => Utils.camelToSnakeObject(row.toJSON()));

        return {
            data: mappedRows,
            pagination: Utils.paginationHelper(page, limit, totalCount)
        };
    }
}