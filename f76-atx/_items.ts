import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES } from "./constants";
import { escapeQuery, getF76AtxOrderClause } from "../utils";

import type {
	Category,
	Subcategory,
	Item,
	ItemsResponse,
	ItemWithRelations
} from "./types";

export class Items {
	#db: Database;

	constructor() {
		this.#db = new Database(DB_PATH);
	}

	async getItems(
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean,
		hasSupport?: boolean
	): Promise<ItemsResponse | null> {
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

		if (isPTS === true) {
			conditions.push('i.isPTS = 1');
		}

		if (hasSupport === true) {
			conditions.push('(i.supportItem IS NOT NULL OR i.supportBundles IS NOT NULL)');
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
		const orderClause = getF76AtxOrderClause(order);

		// Main query
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

		// Count total items
		const countFromClause = useFilter
			? `FROM items_fts JOIN ${TABLE_NAME_ITEMS} i ON items_fts.formId = i.formId`
			: `FROM ${TABLE_NAME_ITEMS} i`;

		const totalItems = (this.#db.query<{ count: number }, any[]>(
			`SELECT COUNT(*) AS count
			${countFromClause}
			${whereClause}`
		).get(...params) as { count: number }).count;

		return {
			items,
			pagination: {
				page,
				page_size: pageSize,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / pageSize)
			}
		};
	}

	async getItem(itemFormId: string): Promise<ItemWithRelations | null> {
		const item = this.#db.query<Item, [string]>(
			`SELECT * FROM ${TABLE_NAME_ITEMS} WHERE formId = ?`
		).get(itemFormId);

		if (!item) return null;

		if (item.screenshots && typeof item.screenshots === 'string')
			item.screenshots = item.screenshots.split(';');

		const category = item.categoryFormId
			? this.#db.query<Pick<Category, 'formId' | 'nameEn' | 'nameRu' | 'slug'>, [string]>(
				`SELECT formId, nameEn, nameRu, slug FROM ${TABLE_NAME_CATEGORIES} WHERE formId = ?`
			).get(item.categoryFormId)
			: null;

		const subcategory = item.subcategoryFormId
			? this.#db.query<Pick<Subcategory, 'formId' | 'nameEn' | 'nameRu' | 'slug'>, [string]>(
				`SELECT formId, nameEn, nameRu, slug FROM ${TABLE_NAME_SUBCATEGORIES} WHERE formId = ?`
			).get(item.subcategoryFormId)
			: null;

		return {
			...item,
			category: category || null,
			subcategory: subcategory || null
		};
	}
}