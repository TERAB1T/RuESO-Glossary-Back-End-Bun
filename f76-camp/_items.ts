import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES, TABLE_NAME_RECIPES, LIST_COLUMNS } from "./constants";
import {
	DB_PATH as ATX_DB_PATH,
	TABLE_NAME_ITEMS as ATX_TABLE_NAME_ITEMS
} from "../f76-atx/constants";
import { queryItemPage } from "../itemList";

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

	constructor() {
		this.#db = getDb(DB_PATH);
	}

	async getItems(
		page: number,
		pageSize: number,
		filter: string,
		order: string,
		isPTS?: boolean
	): Promise<ItemsResponse | null> {
		const { items, pagination } = queryItemPage<Item>(this.#db, LIST_COLUMNS, {
			table: TABLE_NAME_ITEMS,
			filter,
			isPTS
		}, order, page, pageSize);

		return { items, pagination };
	}

	async getItem(itemFormId: string): Promise<ItemWithRelations | null> {
		const item = this.#db.query<Item & { camp: boolean; shelter: boolean; workshop: boolean; campOwned: boolean; campMaxFormId: string | null; campMaxValue: number | null; workshopMaxFormId: string | null; workshopMaxValue: number | null; carryWeight: number | null; requiresPower: boolean; powerRequired: number; powerConnectable: boolean; powerGenerated: number; powerRadiated: number; learnConditions: string | null; produces: string | null; display: string | null; buffs: string | null; arcadeGame: string | null; unlockEntitlements: string | null; recipeFormId: string }, [string]>(
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
			// SQLite stores BOOLEAN columns as 0/1.
			camp: !!item.camp,
			shelter: !!item.shelter,
			workshop: !!item.workshop,
			campOwned: !!item.campOwned,
			requiresPower: !!item.requiresPower,
			powerConnectable: !!item.powerConnectable,
			learnConditions: item.learnConditions ? JSON.parse(item.learnConditions) : null,
			produces: item.produces ? JSON.parse(item.produces) : null,
			display: item.display ? JSON.parse(item.display) : null,
			buffs: item.buffs ? JSON.parse(item.buffs) : null,
			arcadeGame: item.arcadeGame ? JSON.parse(item.arcadeGame) : null,
			category: category || null,
			subcategory: subcategory || null,
			unlockedByEntitlements: this.#resolveUnlockedByEntitlements(unlockEntitlements),
			recipe: item.recipeFormId ? this.#resolveRecipe(item.recipeFormId) : null,
			recipeItems: item.recipeFormId ? this.#resolveRecipeItems(item.recipeFormId, item.formId) : []
		};
	}

	#resolveUnlockedByEntitlements(raw: string | null): UnlockedByEntitlement[] | null {
		if (!raw) return null;

		const formIds = raw.split('|').filter(Boolean);
		if (formIds.length === 0) return null;

		const placeholders = formIds.map(() => '?').join(',');

		// The table here is in the Atomic Shop DB; only the formIds come from this item.
		const rows = getDb(ATX_DB_PATH).query<UnlockedByEntitlementRow, string[]>(
			`SELECT formId, editorId, nameEn, nameRu, mainImage, screenshots, slug
			FROM ${ATX_TABLE_NAME_ITEMS}
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