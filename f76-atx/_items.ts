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
		order: string
	): Promise<ItemsResponse | null> {
		const offset = (page - 1) * pageSize;

		let items: Item[] = [];
		let totalItems = 0;

		let orderClause = getF76AtxOrderClause(order);

		if (filter && filter.length > 2) {
			const escapedFilter = escapeQuery(filter);

			items = this.#db.query<Item, [string, number, number]>(
				`SELECT i.formId, i.nameEn, i.nameRu, i.mainImage, i.categoryFormId, i.subcategoryFormId, i.slug
				FROM ${TABLE_NAME_ITEMS} i
				JOIN items_fts ON items_fts.formId = i.formId
				WHERE items_fts MATCH ?
				${orderClause}
				LIMIT ? OFFSET ?`
			).all(escapedFilter, pageSize, offset);

			totalItems = (this.#db.query<{ count: number }, [string]>(
				`SELECT COUNT(*) AS count
				FROM items_fts
				JOIN ${TABLE_NAME_ITEMS} i ON items_fts.formId = i.formId
				WHERE items_fts MATCH ?`
			).get(escapedFilter) as { count: number }).count;
		} else {
			items = this.#db.query<Item, [number, number]>(
				`SELECT formId, nameEn, nameRu, mainImage, categoryFormId, subcategoryFormId, slug
				FROM ${TABLE_NAME_ITEMS}
				${orderClause}
				LIMIT ? OFFSET ?`
			).all(pageSize, offset);

			totalItems = (this.#db.query<{ count: number }, []>(
				`SELECT COUNT(*) AS count
				FROM ${TABLE_NAME_ITEMS}`
			).get() as { count: number }).count;
		}

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