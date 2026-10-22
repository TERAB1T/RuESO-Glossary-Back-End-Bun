import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_ACQUISITION_SOURCES, GROUPED_ACQUISITION_TYPES, LIST_COLUMNS } from "./constants";
import { buildItemListQuery, getItemOrderClause, queryItemPage } from "../itemList";

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
		this.#db = getDb(DB_PATH);
	}

	async getAcquisitionSources(): Promise<AcquisitionSourcesByType[]> {
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
		const { items, pagination } = queryItemPage<Item>(this.#db, LIST_COLUMNS, {
			table: TABLE_NAME_ITEMS,
			conditions: [['i.acquisitionSourceType = ?', type]],
			filter,
			isPTS,
			hasSupport
		}, order, page, pageSize);

		return { type, items, pagination };
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
		const acquisitionSource = this.#db.query<AcquisitionSource, [string, number]>(
			`SELECT * FROM ${TABLE_NAME_ACQUISITION_SOURCES} WHERE type = ? AND number = ?`
		).get(type, number);

		if (!acquisitionSource) return null;

		const listOptions = {
			table: TABLE_NAME_ITEMS,
			conditions: [['i.acquisitionSourceType = ?', type], ['i.acquisitionSourceNumber = ?', number]] as [string, string | number][],
			filter,
			isPTS,
			hasSupport
		};

		// Seasons are small enough to show on a single page, grouped under category headers
		if (GROUPED_ACQUISITION_TYPES.includes(type)) {
			const { fromClause, whereClause, params } = buildItemListQuery(listOptions);
			const orderClause = getItemOrderClause(order).replace('ORDER BY', 'ORDER BY c.orderId ASC,');

			const items = this.#db.query<Item, any[]>(
				`SELECT ${LIST_COLUMNS}
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

		const { items, pagination } = queryItemPage<Item>(this.#db, LIST_COLUMNS, listOptions, order, page, pageSize);

		return { acquisitionSource, items, categories: [], pagination };
	}
}
