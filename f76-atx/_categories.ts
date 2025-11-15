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
		order: string
	): Promise<CategoryItemsResponse | null> {
		const offset = (page - 1) * pageSize;

		const category = this.#db.query<Category, [string]>(
			`SELECT * FROM ${TABLE_NAME_CATEGORIES} WHERE formId = ?`
		).get(categoryFormId);

		if (!category) return null;

		let items: Item[] = [];
		let totalItems = 0;

		const orderClause = getF76AtxOrderClause(order);

		if (filter && filter.length > 2) {
			const escapedFilter = escapeQuery(filter);

			items = this.#db.query<Item, [string, string, number, number]>(
				`SELECT i.formId, i.nameEn, i.nameRu, i.mainImage, i.categoryFormId, i.subcategoryFormId, i.slug
				FROM ${TABLE_NAME_ITEMS} i
				JOIN items_fts ON items_fts.formId = i.formId
				WHERE items_fts MATCH ? AND i.categoryFormId = ?
				${orderClause}
				LIMIT ? OFFSET ?`
			).all(escapedFilter, categoryFormId, pageSize, offset);

			totalItems = (this.#db.query<{ count: number }, [string, string]>(
				`SELECT COUNT(*) AS count
				FROM items_fts
				JOIN ${TABLE_NAME_ITEMS} i ON items_fts.formId = i.formId
				WHERE items_fts MATCH ? AND i.categoryFormId = ?`
			).get(escapedFilter, categoryFormId) as { count: number }).count;
		} else {
			items = this.#db.query<Item, [string, number, number]>(
				`SELECT formId, nameEn, nameRu, mainImage, categoryFormId, subcategoryFormId, slug
				FROM ${TABLE_NAME_ITEMS}
				WHERE categoryFormId = ?
				${orderClause}
				LIMIT ? OFFSET ?`
			).all(categoryFormId, pageSize, offset);

			totalItems = (this.#db.query<{ count: number }, [string]>(
				`SELECT COUNT(*) AS count
				FROM ${TABLE_NAME_ITEMS}
				WHERE categoryFormId = ?`
			).get(categoryFormId) as { count: number }).count;
		}

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
		order: string
	): Promise<SubcategoryItemsResponse | null> {
		const offset = (page - 1) * pageSize;

		// Получаем подкатегорию
		const subcategory = this.#db.query<Subcategory, [string]>(
			`SELECT * FROM ${TABLE_NAME_SUBCATEGORIES} WHERE formId = ?`
		).get(subcategoryFormId);

		if (!subcategory) return null;

		let items: Item[] = [];
		let totalItems = 0;

		const orderClause = getF76AtxOrderClause(order);

		if (filter && filter.length > 2) {
			const escapedFilter = escapeQuery(filter);

			items = this.#db.query<Item, [string, string, number, number]>(
				`SELECT i.formId, i.nameEn, i.nameRu, i.mainImage, i.categoryFormId, i.subcategoryFormId, i.slug
				FROM ${TABLE_NAME_ITEMS} i
				JOIN items_fts ON items_fts.formId = i.formId
				WHERE items_fts MATCH ? AND i.subcategoryFormId = ?
				${orderClause}
				LIMIT ? OFFSET ?`
			).all(escapedFilter, subcategoryFormId, pageSize, offset);

			totalItems = (this.#db.query<{ count: number }, [string, string]>(
				`SELECT COUNT(*) AS count
				FROM items_fts
				JOIN ${TABLE_NAME_ITEMS} i ON items_fts.formId = i.formId
				WHERE items_fts MATCH ? AND i.subcategoryFormId = ?`
			).get(escapedFilter, subcategoryFormId) as { count: number }).count;
		} else {
			items = this.#db.query<Item, [string, number, number]>(
				`SELECT formId, nameEn, nameRu, mainImage, categoryFormId, subcategoryFormId, slug
				FROM ${TABLE_NAME_ITEMS}
				WHERE subcategoryFormId = ?
				${orderClause}
				LIMIT ? OFFSET ?`
			).all(subcategoryFormId, pageSize, offset);

			totalItems = (this.#db.query<{ count: number }, [string]>(
				`SELECT COUNT(*) AS count
				FROM ${TABLE_NAME_ITEMS}
				WHERE subcategoryFormId = ?`
			).get(subcategoryFormId) as { count: number }).count;
		}

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