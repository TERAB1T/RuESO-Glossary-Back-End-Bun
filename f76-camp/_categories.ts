import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES, LIST_COLUMNS } from "./constants";
import { queryItemPage } from "../itemList";

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
		this.#db = getDb(DB_PATH);
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
		isPTS?: boolean
	): Promise<CategoryItemsResponse | null> {
		const category = this.#db.query<Category, [string]>(
			`SELECT * FROM ${TABLE_NAME_CATEGORIES} WHERE formId = ?`
		).get(categoryFormId);

		if (!category) return null;

		const { items, pagination } = queryItemPage<Item>(this.#db, LIST_COLUMNS, {
			table: TABLE_NAME_ITEMS,
			conditions: [['i.categoryFormId = ?', categoryFormId]],
			filter,
			isPTS
		}, order, page, pageSize);

		return { category, items, pagination };
	}

	async getSubcategoryItems(
		subcategoryFormId: string,
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean
	): Promise<SubcategoryItemsResponse | null> {
		// Get subcategory
		const subcategory = this.#db.query<Subcategory, [string]>(
			`SELECT * FROM ${TABLE_NAME_SUBCATEGORIES} WHERE formId = ?`
		).get(subcategoryFormId);

		if (!subcategory) return null;

		const { items, pagination } = queryItemPage<Item>(this.#db, LIST_COLUMNS, {
			table: TABLE_NAME_ITEMS,
			conditions: [['i.subcategoryFormId = ?', subcategoryFormId]],
			filter,
			isPTS
		}, order, page, pageSize);

		return { subcategory, items, pagination };
	}
}