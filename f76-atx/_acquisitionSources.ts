import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_ACQUISITION_SOURCES, GROUPED_ACQUISITION_TYPES } from "./constants";
import { escapeQuery, getF76AtxOrderClause } from "../utils";

import type {
	AcquisitionSource,
	AcquisitionSourcesByType,
	AcquisitionTypeItemsResponse,
	AcquisitionSourceItemsResponse,
	Category,
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

			const fromClause = useFilter
				? `FROM ${TABLE_NAME_ITEMS} i JOIN items_fts ON items_fts.formId = i.formId`
				: `FROM ${TABLE_NAME_ITEMS} i`;

			const selectColumns = 'i.formId, i.nameEn, i.nameRu, i.mainImage, i.categoryFormId, i.subcategoryFormId, i.slug, i.isPTS, i.supportItem, i.supportBundles';

			// Seasons are small enough to show on a single page, grouped under category headers
			if (GROUPED_ACQUISITION_TYPES.includes(type)) {
				const orderClause = getF76AtxOrderClause(order).replace('ORDER BY', 'ORDER BY c.orderId ASC,');

				const items = this.#db.query<Item, any[]>(
					`SELECT ${selectColumns}
				${fromClause}
				JOIN ${TABLE_NAME_CATEGORIES} c ON c.formId = i.categoryFormId
				${whereClause}
				${orderClause}`
				).all(...params);

				const catIds = [...new Set(items.map(item => item.categoryFormId))];
				let categories: Pick<Category, 'formId' | 'nameRu'>[] = [];

				if (catIds.length !== 0) {
					const catPlaceholders = catIds.map(() => '?').join(',');
					categories = this.#db.query<Pick<Category, 'formId' | 'nameRu'>, any[]>(
						`SELECT formId, nameRu
					FROM ${TABLE_NAME_CATEGORIES}
					WHERE formId IN (${catPlaceholders})
					ORDER BY orderId ASC`
					).all(...catIds);
				}

				return {
					acquisitionSource,
					items,
					categories,
					pagination: {
						page: 1,
						page_size: items.length,
						total_items: items.length,
						total_pages: 1
					}
				};
			}

			const orderClause = getF76AtxOrderClause(order);

			const items = this.#db.query<Item, any[]>(
				`SELECT ${selectColumns}
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
				categories: [],
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
