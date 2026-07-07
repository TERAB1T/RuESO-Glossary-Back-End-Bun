import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES, TABLE_NAME_RECIPES } from "./constants";
import {
	DB_PATH as ATX_DB_PATH,
	TABLE_NAME_ITEMS as ATX_TABLE_NAME_ITEMS
} from "../f76-atx/constants";
import { escapeQuery, getF76CampOrderClause } from "../utils";

import type {
	Category,
	Subcategory,
	Item,
	ItemsResponse,
	ItemWithRelations,
	UnlockedByEntitlement,
	RecipeInfo,
	RecipeComponent,
	RecipeSiblingItem
} from "./types";

interface UnlockedByEntitlementRow {
	formId: string;
	editorId: string;
	nameEn: string | null;
	nameRu: string | null;
	mainImage: string | null;
	screenshots: string | null;
	slug: string | null;
}

interface RecipeRow {
	formId: string;
	editorId: string;
	nameEn: string | null;
	nameRu: string | null;
	descriptionEn: string | null;
	descriptionRu: string | null;
	components: string | null;
}

export class Items {
	#db: Database;
	#atxAttached = false;

	constructor() {
		this.#db = new Database(DB_PATH);
	}

	async getItems(
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean
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

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
		const orderClause = getF76CampOrderClause(order);

		// Main query
		const fromClause = useFilter
			? `FROM ${TABLE_NAME_ITEMS} i JOIN items_fts ON items_fts.formId = i.formId`
			: `FROM ${TABLE_NAME_ITEMS} i`;

		const items = this.#db.query<Item, any[]>(
			`SELECT i.formId, i.nameEn, i.nameRu, i.mainImage, i.categoryFormId, i.subcategoryFormId, i.slug, i.isPTS
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
		const item = this.#db.query<Item & { camp: boolean; shelter: boolean; workshop: boolean; campOwned: boolean; campMaxFormId: string | null; campMaxValue: number | null; workshopMaxFormId: string | null; workshopMaxValue: number | null; learnConditions: string | null; produces: string | null; display: string | null; unlockEntitlements: string | null; recipeFormId: string }, [string]>(
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

		const { unlockEntitlements, ...itemWithoutRawEntitlements } = item;

		return {
			...itemWithoutRawEntitlements,
			learnConditions: item.learnConditions ? JSON.parse(item.learnConditions) : null,
			produces: item.produces ? JSON.parse(item.produces) : null,
			display: item.display ? JSON.parse(item.display) : null,
			category: category || null,
			subcategory: subcategory || null,
			unlockedByEntitlements: this.#resolveUnlockedByEntitlements(unlockEntitlements),
			recipe: item.recipeFormId ? this.#resolveRecipe(item.recipeFormId) : null,
			recipeItems: item.recipeFormId ? this.#resolveRecipeItems(item.recipeFormId, item.formId) : []
		};
	}

	#ensureAtxAttached() {
		if (this.#atxAttached) return;
		this.#db.query(`ATTACH DATABASE ? AS atxdb`).run(ATX_DB_PATH);
		this.#atxAttached = true;
	}

	#resolveUnlockedByEntitlements(raw: string | null): UnlockedByEntitlement[] | null {
		if (!raw) return null;

		const formIds = raw.split('|').filter(Boolean);
		if (formIds.length === 0) return null;

		this.#ensureAtxAttached();

		const placeholders = formIds.map(() => '?').join(',');

		const rows = this.#db.query<UnlockedByEntitlementRow, string[]>(
			`SELECT formId, editorId, nameEn, nameRu, mainImage, screenshots, slug
			FROM atxdb.${ATX_TABLE_NAME_ITEMS}
			WHERE formId IN (${placeholders})
			ORDER BY orderByFormId`
		).all(...formIds);

		return rows.map(row => ({
			formId: row.formId,
			editorId: row.editorId,
			nameEn: row.nameEn,
			nameRu: row.nameRu,
			mainImage: row.mainImage,
			screenshots: row.screenshots ? row.screenshots.split(';') : null,
			slug: row.slug
		}));
	}

	#resolveRecipe(recipeFormId: string): RecipeInfo | null {
		const row = this.#db.query<RecipeRow, [string]>(
			`SELECT formId, editorId, nameEn, nameRu, descriptionEn, descriptionRu, components
		FROM ${TABLE_NAME_RECIPES}
		WHERE formId = ?`
		).get(recipeFormId);

		if (!row) return null;

		return {
			formId: row.formId,
			editorId: row.editorId,
			nameEn: row.nameEn,
			nameRu: row.nameRu,
			descriptionEn: row.descriptionEn,
			descriptionRu: row.descriptionRu,
			components: row.components ? (JSON.parse(row.components) as RecipeComponent[]) : []
		};
	}

	#resolveRecipeItems(recipeFormId: string, excludeFormId: string): RecipeSiblingItem[] {
		return this.#db.query<RecipeSiblingItem, [string, string]>(
			`SELECT formId, nameEn, nameRu, slug
		FROM ${TABLE_NAME_ITEMS}
		WHERE recipeFormId = ? AND formId != ?
		ORDER BY orderInGame`
		).all(recipeFormId, excludeFormId);
	}
}