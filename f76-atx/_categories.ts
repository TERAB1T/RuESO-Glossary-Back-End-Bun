import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES } from "./constants";
import { escapeQuery, getF76AtxOrderClause } from "../utils";

import type {
	Category,
	CategoryItemsResponse,
	CategoryWithSubcategories,
	Item,
	Subcategory,
	SubcategoryItemsResponse
} from "./types";

export class Categories {
	#db: Database;

	constructor() {
		this.#db = new Database(DB_PATH);
	}

	async getCategories(): Promise<CategoryWithSubcategories[]> {
		const categories = this.#db.query<Category, []>('SELECT * FROM categories ORDER BY orderId').all();

		const subcategories = this.#db.query<Subcategory, []>('SELECT * FROM subcategories ORDER BY orderId').all();

		const subcatMap = new Map<string, Subcategory[]>();

		for (const sub of subcategories) {
			if (sub.parentCategoryFormId) {
				const key = sub.parentCategoryFormId;
				if (!subcatMap.has(key)) {
					subcatMap.set(key, []);
				}
				subcatMap.get(key)!.push(sub);
			}
		}

		return categories.map(cat => ({
			...cat,
			subcategories: subcatMap.get(cat.formId) ?? []
		}));
	}

	async getCategoryItems(
		categoryFormId: string,
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean,
		hasSupport?: boolean
	): Promise<CategoryItemsResponse | null> {
		const offset = (page - 1) * pageSize;

		const category = this.#db.query<Category, [string]>(
			`SELECT * FROM ${TABLE_NAME_CATEGORIES} WHERE formId = ?`
		).get(categoryFormId);

		if (!category) return null;

		const conditions: string[] = [];
		const params: any[] = [];

		const useFilter = filter && filter.length > 2;
		const baseTable = useFilter ? 'items_fts' : TABLE_NAME_ITEMS;

		if (useFilter) {
			const escapedFilter = escapeQuery(filter);
			conditions.push(`${baseTable} MATCH ?`);
			params.push(escapedFilter);
		}

		conditions.push('i.categoryFormId = ?');
		params.push(categoryFormId);

		if (isPTS === true) {
			conditions.push('i.isPTS = 1');
		}

		if (hasSupport === true) {
			conditions.push('(i.supportItem IS NOT NULL OR i.supportBundles IS NOT NULL)');
		}

		const whereClause = `WHERE ${conditions.join(' AND ')}`;
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
			category,
			items,
			pagination: {
				page,
				page_size: pageSize,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / pageSize)
			}
		};
	}

	async getSubcategoryItems(
		subcategoryFormId: string,
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean,
		hasSupport?: boolean
	): Promise<SubcategoryItemsResponse | null> {
		const offset = (page - 1) * pageSize;

		// Get subcategory
		const subcategory = this.#db.query<Subcategory, [string]>(
			`SELECT * FROM ${TABLE_NAME_SUBCATEGORIES} WHERE formId = ?`
		).get(subcategoryFormId);

		if (!subcategory) return null;

		const conditions: string[] = [];
		const params: any[] = [];

		const useFilter = filter && filter.length > 2;
		const baseTable = useFilter ? 'items_fts' : TABLE_NAME_ITEMS;

		if (useFilter) {
			const escapedFilter = escapeQuery(filter);
			conditions.push(`${baseTable} MATCH ?`);
			params.push(escapedFilter);
		}

		conditions.push('i.subcategoryFormId = ?');
		params.push(subcategoryFormId);

		if (isPTS === true) {
			conditions.push('i.isPTS = 1');
		}

		if (hasSupport === true) {
			conditions.push('(i.supportItem IS NOT NULL OR i.supportBundles IS NOT NULL)');
		}

		const whereClause = `WHERE ${conditions.join(' AND ')}`;
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
			subcategory,
			items,
			pagination: {
				page,
				page_size: pageSize,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / pageSize)
			}
		};
	}
}