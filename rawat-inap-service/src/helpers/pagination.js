const paginationHelper = (page, limit, total) => {
    const total_page = Math.ceil(total / limit);
    const next = page < total_page ? page + 1 : null;
    const prev = page > 1 ? page - 1 : null;
    return {
        page: parseInt(page),
        page_size: parseInt(limit),
        total_page,
        total_data: total,
        next_page: next,
        prev_page: prev
    };
}
export default class Pagination {
    static async init(model, args, filter = {}, options = {}, transformMap = {}, distinct = false) {
        const page = args.page || 1;
        const limit = args.limit || 10;
        const offset = (page - 1) * limit;

        console.log("model:", model);
        console.log("Options:", options);
        const query = await model.findAndCountAll({
            distinct,
            limit,
            offset,
            where: filter,
            ...options
        });

        const data = await Pagination.transform(query.rows, transformMap);

        console.log("data:", data);
        return {
            data,
            pagination: paginationHelper(page, limit, query.count)
        };
    }

    static async transform(data, transformMap) {
        return data.map(row => {
            let transformedRow = { ...row.get() };

            for (const [key, transformFn] of Object.entries(transformMap)) {
                if (typeof transformFn === 'function') {
                    if (key === 'remove') {
                        transformFn.forEach(k => delete transformedRow[k]);
                    } else {
                        transformedRow[key] = transformFn(transformedRow);
                    }
                }
            }

            return transformedRow;
        });
    }
}
