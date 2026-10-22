import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES, TABLE_NAME_ACQUISITION_SOURCES, LIST_COLUMNS } from "./constants";
import {
	DB_PATH as CAMP_DB_PATH,
	TABLE_NAME_ITEMS as CAMP_TABLE_NAME_ITEMS,
	TABLE_NAME_CATEGORIES as CAMP_TABLE_NAME_CATEGORIES,
	TABLE_NAME_SUBCATEGORIES as CAMP_TABLE_NAME_SUBCATEGORIES
} from "../f76-camp/constants";
import { queryItemPage } from "../itemList";

import type {
	Category,
	Subcategory,
	AcquisitionSource,
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

	constructor() {
		this.#db = getDb(DB_PATH);
	}

	async getItems(
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean,
		hasSupport?: boolean
	): Promise<ItemsResponse | null> {
		const { items, pagination } = queryItemPage<Item>(this.#db, LIST_COLUMNS, {
			table: TABLE_NAME_ITEMS,
			filter,
			isPTS,
			hasSupport
		}, order, page, pageSize);

		return { items, pagination };
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

		const acquisitionSource = item.acquisitionSourceNumber != null
			? this.#db.query<Pick<AcquisitionSource, 'type' | 'number' | 'nameRu' | 'slug'>, [string, number]>(
				`SELECT type, number, nameRu, slug FROM ${TABLE_NAME_ACQUISITION_SOURCES} WHERE type = ? AND number = ?`
			).get(item.acquisitionSourceType, item.acquisitionSourceNumber)
			: null;

		return {
			...item,
			category: category || null,
			subcategory: subcategory || null,
			acquisitionSource: acquisitionSource || null,
			campUnlockedItems: this.#resolveCampUnlockedItems(item.campUnlockedItems)
		};
	}

	#resolveCampUnlockedItems(raw: string | null): CampUnlockedItem[] | null {
		if (!raw) return null;

		const formIds = raw.split('|').filter(Boolean);
		if (formIds.length === 0) return null;

		const placeholders = formIds.map(() => '?').join(',');

		// Every table here is in the C.A.M.P. DB; only the formIds come from this item.
		const rows = getDb(CAMP_DB_PATH).query<CampUnlockedItemRow, string[]>(
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
			FROM ${CAMP_TABLE_NAME_ITEMS} ci
			LEFT JOIN ${CAMP_TABLE_NAME_CATEGORIES} cc ON cc.formId = ci.categoryFormId
			LEFT JOIN ${CAMP_TABLE_NAME_SUBCATEGORIES} cs ON cs.formId = ci.subcategoryFormId
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