import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import { DB_PATH, TABLE_NAME_ITEMS, TABLE_NAME_CATEGORIES, TABLE_NAME_SUBCATEGORIES, TABLE_NAME_RECIPES, TABLE_NAME_SUBITEMS, LIST_COLUMNS } from "./constants";
import {
	DB_PATH as ATX_DB_PATH,
	TABLE_NAME_ITEMS as ATX_TABLE_NAME_ITEMS
} from "../f76-atx/constants";
import { queryItemPage } from "../itemList";

import type {
	Category,
	Subcategory,
	Item,
	ItemRow,
	ItemsResponse,
	ItemWithRelations,
	UnlockedByEntitlement,
	RecipeInfo,
	RecipeComponent,
	RecipeSiblingItem,
	SharedLimit,
	SharedLimitCategory,
	ShopInfo,
	SubItem
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

// Groups sharing a limit reach 530 items, and listing them all would bury the page; larger groups get a per-category breakdown instead.
const SHARED_LIMIT_LIST_MAX = 100;

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
		const item = this.#db.query<ItemRow, [string]>(
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

		const { unlockEntitlements, shopEntitlementFormId, shopDescriptionEn, shopDescriptionRu, shopIsSet, hideRecipeDescription, ...itemWithoutRawFields } = item;

		// The parser decides where the recipe description, the page's lead text, repeats a block below.
		const recipe = item.recipeFormId ? this.#resolveRecipe(item.recipeFormId) : null;
		if (recipe && hideRecipeDescription) {
			recipe.descriptionEn = null;
			recipe.descriptionRu = null;
		}

		return {
			...itemWithoutRawFields,
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
			storage: item.storage ? JSON.parse(item.storage) : null,
			givesItems: item.givesItems ? JSON.parse(item.givesItems) : null,
			spoilRate: item.spoilRate ?? null,
			surface: item.surface ?? null,
			weather: item.weather ? JSON.parse(item.weather) : null,
			buffs: item.buffs ? JSON.parse(item.buffs) : null,
			arcadeGame: item.arcadeGame ? JSON.parse(item.arcadeGame) : null,
			waterSource: item.waterSource ? JSON.parse(item.waterSource) : null,
			ally: item.ally ? JSON.parse(item.ally) : null,
			category: category || null,
			subcategory: subcategory || null,
			unlockedByEntitlements: this.#resolveUnlockedByEntitlements(unlockEntitlements),
			shopInfo: this.#resolveShopInfo(shopEntitlementFormId, shopDescriptionEn, shopDescriptionRu, !!shopIsSet),
			sharedLimit: this.#resolveSharedLimit(item.campMaxFormId, item.formId),
			recipe,
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

	// The parser picks the shop entitlement and cleans its text; only the screenshots come from the Atomic Shop DB.
	#resolveShopInfo(formId: string | null, en: string | null, ru: string | null, isSet: boolean): ShopInfo | null {
		if (!formId) return null;

		const row = getDb(ATX_DB_PATH).query<{ screenshots: string | null }, [string]>(
			`SELECT screenshots FROM ${ATX_TABLE_NAME_ITEMS} WHERE formId = ?`
		).get(formId);
		const screenshots = row?.screenshots?.split(';').filter(Boolean) ?? [];

		if (!en && !ru && screenshots.length === 0) return null;

		return {
			descriptionEn: en,
			descriptionRu: ru,
			screenshots: screenshots.length > 0 ? screenshots : null,
			isSet
		};
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

	// Items share a limit when their recipes point at the same C.A.M.P. limit global.
	#resolveSharedLimit(campMaxFormId: string | null, excludeFormId: string): SharedLimit | null {
		if (!campMaxFormId) return null;

		const { total } = this.#db.query<{ total: number }, [string, string]>(
			`SELECT COUNT(*) AS total FROM ${TABLE_NAME_ITEMS} WHERE campMaxFormId = ? AND formId != ?`
		).get(campMaxFormId, excludeFormId)!;

		if (total === 0) return null;
		if (total > SHARED_LIMIT_LIST_MAX) {
			const categories = this.#db.query<SharedLimitCategory, [string, string]>(
				`SELECT c.formId, c.nameEn, c.nameRu, c.slug, COUNT(*) AS count
			FROM ${TABLE_NAME_ITEMS} i
			JOIN ${TABLE_NAME_CATEGORIES} c ON c.formId = i.categoryFormId
			WHERE i.campMaxFormId = ? AND i.formId != ?
			GROUP BY c.formId
			ORDER BY count DESC`
			).all(campMaxFormId, excludeFormId);

			return { total, items: [], categories };
		}

		const items = this.#db.query<RecipeSiblingItem, [string, string]>(
			`SELECT formId, nameEn, nameRu, slug
		FROM ${TABLE_NAME_ITEMS}
		WHERE campMaxFormId = ? AND formId != ?
		ORDER BY orderInGame`
		).all(campMaxFormId, excludeFormId);

		return { total, items, categories: [] };
	}

	// An item listed in collector and storage tables (collector output, candy bowl), with the C.A.M.P. objects that list it.
	async getSubItem(formId: string): Promise<SubItem | null> {
		const row = this.#db.query<Omit<SubItem, 'details' | 'usedIn' | 'teaches'> & { details: string | null; usedIn: string }, [string]>(
			`SELECT formId, editorId, formType, type, nameEn, nameRu, descriptionEn, descriptionRu, weight, value, details, usedIn
		FROM ${TABLE_NAME_SUBITEMS}
		WHERE formId = ?`
		).get(formId);

		if (!row) return null;

		// An item can sit in several subcategories (several rows); one link per object is enough.
		const usedIn = this.#db.query<RecipeSiblingItem, [string]>(
			`SELECT i.formId, i.nameEn, i.nameRu, i.slug
		FROM json_each(?) j
		JOIN ${TABLE_NAME_ITEMS} i ON i.formId = j.value
		GROUP BY i.formId
		ORDER BY MIN(i.orderByName)`
		).all(row.usedIn);

		// A plan or recipe unlocks the C.A.M.P. items whose learn conditions name it.
		const teaches = row.type === 'RECIPE'
			? this.#db.query<RecipeSiblingItem, [string]>(
				`SELECT formId, nameEn, nameRu, slug
		FROM ${TABLE_NAME_ITEMS}
		WHERE learnConditions LIKE ?
		GROUP BY formId
		ORDER BY MIN(orderByName)`
			).all(`%{"type":"plan","formId":"0x${row.formId}"%`)
			: [];

		return { ...row, details: row.details ? JSON.parse(row.details) : null, usedIn, teaches };
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