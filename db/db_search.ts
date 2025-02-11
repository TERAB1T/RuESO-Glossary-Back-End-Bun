import { Database } from "bun:sqlite";
import { DB_PATH_REL, TABLE_NAME } from "../constants";
import { prepareHtml } from "../utils";

const db = new Database(DB_PATH_REL);
    
function escapeQuery(query: string): string {
    let escapedQuery = query.replace(/"/g, '""').replace(/\u00A0/g, ' ');
    escapedQuery = escapedQuery.replace(/[‘’]/g, "'").replace(/[“”„]/g, '""');
    return `"${escapedQuery}"`;
}

function buildQuery(term: string, filters: (string | null)[], games: string[], isCountQuery = false) {
    let baseQuery = isCountQuery
        ? `SELECT COUNT(*) FROM ${TABLE_NAME}`
        : `SELECT * FROM ${TABLE_NAME}`;
    const queryConditions: string[] = [];
    const params: string[] = [];

    if (/[а-яА-Я]/.test(term)) {
        queryConditions.push("ru MATCH ?");
        params.push(escapeQuery(term));
    } else {
        queryConditions.push(`${TABLE_NAME} MATCH ?`);
        params.push(`en:${escapeQuery(term)} OR ru:${escapeQuery(term)}`);
    }

    if (filters[1]) {
        queryConditions.push("type MATCH ?");
        params.push(escapeQuery(filters[1]));
    }
    if (filters[2]) {
        queryConditions.push("en MATCH ?");
        params.push(escapeQuery(filters[2]));
    }
    if (filters[3]) {
        queryConditions.push("ru MATCH ?");
        params.push(escapeQuery(filters[3]));
    }

    if (games.length > 0) {
        queryConditions.push(`${TABLE_NAME} MATCH ?`);
        params.push(games.map(game => `game: ^${game}`).join(" OR "));
    }

    if (queryConditions.length > 0) {
        baseQuery += " WHERE " + queryConditions.join(" AND ");
    }

    return { query: baseQuery, params };
}

export function searchTerm(
    term: string,
    start = 0,
    length = 10,
    orderColumn: string | null,
    orderDir: "ASC" | "DESC" = "ASC",
    games: string[] = [],
    filters: (string | null)[] = [null, null, null, null]
) {
    const startTime = Date.now();
    const { query, params } = buildQuery(term, filters, games);

    let finalQuery = query;
    if (orderColumn) {
        finalQuery += ` ORDER BY ${orderColumn} ${orderDir}`;
    }
    finalQuery += " LIMIT ? OFFSET ?";
    params.push(length.toString(), start.toString());

    const results = db.query(finalQuery).all(params);
    console.log(`Execution time 1: ${(Date.now() - startTime) / 1000} seconds`);

    const startCountTime = Date.now();
    const { query: countQuery, params: countParams } = buildQuery(term, filters, games, true);
    const totalRecords = db.query(countQuery).get(countParams) as { "COUNT(*)": number };

    console.log(`Execution time 2: ${(Date.now() - startCountTime) / 1000} seconds`);

    return {
        data: results.map((res: any) => ({
            game: res.game,
            en: prepareHtml(res.en),
            ru: prepareHtml(res.ru),
            type: res.type,
            tag: res.tag
        })),
        recordsFiltered: totalRecords ? totalRecords["COUNT(*)"] : 0,
        recordsTotal: totalRecords ? totalRecords["COUNT(*)"] : 0
    };
}
