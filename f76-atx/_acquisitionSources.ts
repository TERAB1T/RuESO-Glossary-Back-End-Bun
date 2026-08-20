import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_ACQUISITION_SOURCES } from "./constants";
import { escapeQuery, getF76AtxOrderClause } from "../utils";

import type {
	AcquisitionSource,
	AcquisitionSourcesByType,
	AcquisitionTypeItemsResponse,
	AcquisitionSourceItemsResponse,
	Item
} from "./types";

export class AcquisitionSources {
	#db: Database;

	constructor() {
		this.#db = new Database(DB_PATH);
	}

	async getAcquisitionSources(): Promise<AcquisitionSourcesByType[]> {
		try {
			const sources = this.#db.query<AcquisitionSource, []>(
				`SELECT * FROM ${TABLE_NAME_ACQUISITION_SOURCES} ORDER BY type, startDate ASC`
			).all();

			const byType = new Map<string, AcquisitionSource[]>();

			for (const source of sources) {
				if (!byType.has(source.type)) {
					byType.set(source.type, []);
				}
				byType.get(source.type)!.push(source);
			}

			return [...byType.entries()].map(([type, list]) => ({ type, sources: list }));
		} finally {
			this.#db.close();
		}
	}

	async getTypeItems(
		type: string,
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean,
		hasSupport?: boolean
	): Promise<AcquisitionTypeItemsResponse | null> {
		try {
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [];
			const params: any[] = [];

			const useFilter = filter && filter.length > 2;
			const baseTable = useFilter ? 'items_fts' : TABLE_NAME_ITEMS;

			if (useFilter) {
				const escapedFilter = escapeQuery(filter);
				conditions.push(`${baseTable} MATCH ?`);
				params.push(escapedFilter);
			}

			conditions.push('i.acquisitionSourceType = ?');
			params.push(type);

			if (isPTS === true) {
				conditions.push('i.isPTS = 1');
			}

			if (hasSupport === true) {
				conditions.push('(i.supportItem IS NOT NULL OR i.supportBundles IS NOT NULL)');
			}

			const whereClause = `WHERE ${conditions.join(' AND ')}`;
			const orderClause = getF76AtxOrderClause(order);

			const fromClause = useFilter
				? `FROM ${TABLE_NAME_ITEMS} i JOIN items_fts ON items_fts.formId = i.formId`
				: `FROM ${TABLE_NAME_ITEMS} i`;

			const items = this.#db.query<Item, any[]>(
				`SELECT i.formId, i.nameEn, i.nameRu, i.mainImage, i.categoryFormId, i.subcategoryFormId, i.slug, i.isPTS, i.supportItem, i.supportBundles
			${fromClause}
			${whereClause}
			${orderClause}
			LIMIT ? OFFSET ?`
			).all(...params, pageSize, offset);

			const countFromClause = useFilter
				? `FROM items_fts JOIN ${TABLE_NAME_ITEMS} i ON items_fts.formId = i.formId`
				: `FROM ${TABLE_NAME_ITEMS} i`;

			const totalItems = (this.#db.query<{ count: number }, any[]>(
				`SELECT COUNT(*) AS count
			${countFromClause}
			${whereClause}`
			).get(...params) as { count: number }).count;

			return {
				type,
				items,
				pagination: {
					page,
					page_size: pageSize,
					total_items: totalItems,
					total_pages: Math.ceil(totalItems / pageSize)
				}
			};
		} finally {
			this.#db.close();
		}
	}

	async getSourceItems(
		type: string,
		number: number,
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean,
		hasSupport?: boolean
	): Promise<AcquisitionSourceItemsResponse | null> {
		try {
			const offset = (page - 1) * pageSize;

			const acquisitionSource = this.#db.query<AcquisitionSource, [string, number]>(
				`SELECT * FROM ${TABLE_NAME_ACQUISITION_SOURCES} WHERE type = ? AND number = ?`
			).get(type, number);

			if (!acquisitionSource) return null;

			const conditions: string[] = [];
			const params: any[] = [];

			const useFilter = filter && filter.length > 2;
			const baseTable = useFilter ? 'items_fts' : TABLE_NAME_ITEMS;

			if (useFilter) {
				const escapedFilter = escapeQuery(filter);
				conditions.push(`${baseTable} MATCH ?`);
				params.push(escapedFilter);
			}

			conditions.push('i.acquisitionSourceType = ?');
			params.push(type);

			conditions.push('i.acquisitionSourceNumber = ?');
			params.push(number);

			if (isPTS === true) {
				conditions.push('i.isPTS = 1');
			}

			if (hasSupport === true) {
				conditions.push('(i.supportItem IS NOT NULL OR i.supportBundles IS NOT NULL)');
			}

			const whereClause = `WHERE ${conditions.join(' AND ')}`;
			const orderClause = getF76AtxOrderClause(order);

			const fromClause = useFilter
				? `FROM ${TABLE_NAME_ITEMS} i JOIN items_fts ON items_fts.formId = i.formId`
				: `FROM ${TABLE_NAME_ITEMS} i`;

			const items = this.#db.query<Item, any[]>(
				`SELECT i.formId, i.nameEn, i.nameRu, i.mainImage, i.categoryFormId, i.subcategoryFormId, i.slug, i.isPTS, i.supportItem, i.supportBundles
			${fromClause}
			${whereClause}
			${orderClause}
			LIMIT ? OFFSET ?`
			).all(...params, pageSize, offset);

			const countFromClause = useFilter
				? `FROM items_fts JOIN ${TABLE_NAME_ITEMS} i ON items_fts.formId = i.formId`
				: `FROM ${TABLE_NAME_ITEMS} i`;

			const totalItems = (this.#db.query<{ count: number }, any[]>(
				`SELECT COUNT(*) AS count
			${countFromClause}
			${whereClause}`
			).get(...params) as { count: number }).count;

			return {
				acquisitionSource,
				items,
				pagination: {
					page,
					page_size: pageSize,
					total_items: totalItems,
					total_pages: Math.ceil(totalItems / pageSize)
				}
			};
		} finally {
			this.#db.close();
		}
	}
}
