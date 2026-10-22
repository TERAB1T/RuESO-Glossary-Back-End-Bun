import type { Database } from "bun:sqlite";
import { escapeQuery } from "./utils";

// Shared by the Atomic Shop and C.A.M.P. DBs: both have an `items` table with these
// columns and an `items_fts` table keyed by formId.

const ORDER_CLAUSES: Record<string, string> = {
	date_desc: "ORDER BY orderByFormId DESC",
	date_asc: "ORDER BY orderByFormId ASC",
	name_desc: "ORDER BY orderByName DESC",
	name_asc: "ORDER BY orderByName ASC",
};

export function getItemOrderClause(order: string): string {
	return ORDER_CLAUSES[order] ?? ORDER_CLAUSES.date_desc;
}

export interface ItemListOptions {
	table: string;
	/** Extra conditions on the `i` alias, each with its single bound value. */
	conditions?: [sql: string, value: string | number][];
	filter: string;
	isPTS?: boolean;
	hasSupport?: boolean;
}

export interface ItemListQuery {
	fromClause: string;
	countFromClause: string;
	whereClause: string;
	params: (string | number)[];
}

export function buildItemListQuery({ table, conditions = [], filter, isPTS, hasSupport }: ItemListOptions): ItemListQuery {
	const where: string[] = [];
	const params: (string | number)[] = [];

	const useFilter = !!filter && filter.length > 2;

	if (useFilter) {
		where.push("items_fts MATCH ?");
		params.push(escapeQuery(filter));
	}

	for (const [sql, value] of conditions) {
		where.push(sql);
		params.push(value);
	}

	if (isPTS === true) {
		where.push("i.isPTS = 1");
	}

	if (hasSupport === true) {
		where.push("(i.supportItem IS NOT NULL OR i.supportBundles IS NOT NULL)");
	}

	return {
		fromClause: useFilter
			? `FROM ${table} i JOIN items_fts ON items_fts.formId = i.formId`
			: `FROM ${table} i`,
		countFromClause: useFilter
			? `FROM items_fts JOIN ${table} i ON items_fts.formId = i.formId`
			: `FROM ${table} i`,
		whereClause: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
		params,
	};
}

export interface Pagination {
	page: number;
	page_size: number;
	total_items: number;
	total_pages: number;
}

/** Runs one page of the item list and its total count. */
export function queryItemPage<T>(
	db: Database,
	columns: string,
	options: ItemListOptions,
	order: string,
	page: number,
	pageSize: number
): { items: T[]; pagination: Pagination } {
	const { fromClause, countFromClause, whereClause, params } = buildItemListQuery(options);

	const items = db.query<T, any[]>(
		`SELECT ${columns}
		${fromClause}
		${whereClause}
		${getItemOrderClause(order)}
		LIMIT ? OFFSET ?`
	).all(...params, pageSize, (page - 1) * pageSize);

	const totalItems = db.query<{ count: number }, any[]>(
		`SELECT COUNT(*) AS count
		${countFromClause}
		${whereClause}`
	).get(...params)!.count;

	return {
		items,
		pagination: {
			page,
			page_size: pageSize,
			total_items: totalItems,
			total_pages: Math.ceil(totalItems / pageSize),
		},
	};
}
