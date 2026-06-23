import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES } from "./constants";
import {
	DB_PATH as CAMP_DB_PATH,
	TABLE_NAME_ITEMS as CAMP_TABLE_NAME_ITEMS,
	TABLE_NAME_CATEGORIES as CAMP_TABLE_NAME_CATEGORIES,
	TABLE_NAME_SUBCATEGORIES as CAMP_TABLE_NAME_SUBCATEGORIES
} from "../f76-camp/constants";
import { escapeQuery, getF76AtxOrderClause } from "../utils";

import type {
	Category,
	Subcategory,
	Item,
	ItemsResponse,
	ItemWithRelations,
	CampUnlockedItem
} from "./types";

interface CampUnlockedItemRow {
	formId: string;
	nameEn: string | null;
	nameRu: string | null;
	mainImage: string | null;
	slug: string | null;
	categoryFormId: string | null;
	categoryNameEn: string | null;
	categoryNameRu: string | null;
	categorySlug: string | null;
	subcategoryFormId: string | null;
	subcategoryNameEn: string | null;
	subcategoryNameRu: string | null;
	subcategorySlug: string | null;
}

export class Items {
	#db: Database;
	#campAttached = false;

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
			subcategory: subcategory || null,
			campUnlockedItems: this.#resolveCampUnlockedItems(item.campUnlockedItems)
		};
	}

	#ensureCampAttached() {
		if (this.#campAttached) return;
		this.#db.query(`ATTACH DATABASE ? AS campdb`).run(CAMP_DB_PATH);
		this.#campAttached = true;
	}

	#resolveCampUnlockedItems(raw: string | null): CampUnlockedItem[] | null {
		if (!raw) return null;

		const formIds = raw.split('|').filter(Boolean);
		if (formIds.length === 0) return null;

		this.#ensureCampAttached();

		const placeholders = formIds.map(() => '?').join(',');

		const rows = this.#db.query<CampUnlockedItemRow, string[]>(
			`SELECT
				ci.formId AS formId,
				ci.nameEn AS nameEn,
				ci.nameRu AS nameRu,
				ci.mainImage AS mainImage,
				ci.slug AS slug,
				cc.formId AS categoryFormId,
				cc.nameEn AS categoryNameEn,
				cc.nameRu AS categoryNameRu,
				cc.slug AS categorySlug,
				cs.formId AS subcategoryFormId,
				cs.nameEn AS subcategoryNameEn,
				cs.nameRu AS subcategoryNameRu,
				cs.slug AS subcategorySlug
			FROM campdb.${CAMP_TABLE_NAME_ITEMS} ci
			LEFT JOIN campdb.${CAMP_TABLE_NAME_CATEGORIES} cc ON cc.formId = ci.categoryFormId
			LEFT JOIN campdb.${CAMP_TABLE_NAME_SUBCATEGORIES} cs ON cs.formId = ci.subcategoryFormId
			WHERE ci.formId IN (${placeholders})
			ORDER BY ci.orderInGame`
		).all(...formIds);

		return rows.map(row => ({
			formId: row.formId,
			nameEn: row.nameEn,
			nameRu: row.nameRu,
			mainImage: row.mainImage,
			slug: row.slug,
			category: row.categoryFormId
				? { formId: row.categoryFormId, nameEn: row.categoryNameEn, nameRu: row.categoryNameRu, slug: row.categorySlug }
				: null,
			subcategory: row.subcategoryFormId
				? { formId: row.subcategoryFormId, nameEn: row.subcategoryNameEn, nameRu: row.subcategoryNameRu, slug: row.subcategorySlug }
				: null
		}));
	}
}