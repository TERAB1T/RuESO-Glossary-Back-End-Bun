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

interface ShopRow {
	formId: string;
	descriptionEn: string | null;
	descriptionRu: string | null;
	screenshots: string | null;
	campUnlockedItems: string | null;
}

// Groups sharing a limit reach 530 items, and listing them all would bury the page; larger groups get a per-category breakdown instead.
const SHARED_LIMIT_LIST_MAX = 100;

// Recipes of collectors whose description only says what they produce, which the production block shows in full.
// Interim list: descriptions of other collectors hold placement rules ("only on dirt", "on a deposit") and stay.
const RECIPES_DESCRIBED_BY_PRODUCES = new Set([
	'006f7e7d', '006d342e', '006f7e8a', '00691c00', '008d2af8', '008fae0a', '0068e77a', '00773e1f',
	'007813f7', '0067adbf', '0067f3aa', '00662e68', '0075fbee', '006f0685', '007df844', '008f10dd',
	'005fe789', '007ae26d', '007ae26e', '007ae26f', '0076d045',
]);

// Already shown by the item's own data. The English line is always the same and the Russian one is found by its index;
// a few texts have the Russian lines in a different order, so the Russian line is also matched as is.
const SHELTER_BAN_LINE_EN = 'This item cannot be built inside of a Shelter.';
const SHELTER_BAN_LINE_RU = 'Этот предмет нельзя изготовить в укрытии.';

// Recipes whose description repeats a line of the shop text ("Changes weather within C.A.M.P. radius when powered.", the sink's "will dispense water").
const RECIPES_DESCRIBED_BY_SHOP_TEXT = new Set(['006ee8ed', '005771b5', '007ae545']);

// Recipe descriptions that are not shown at all.
const RECIPES_WITH_HIDDEN_DESCRIPTION = new Set(['0042f115']);

// Recipe descriptions that only state the surface rule, which the page now builds from the item's surface (matched by the English text).
const SURFACE_RULE_DESCRIPTIONS_EN = new Set([
	'Can only be placed in dirt.', 'Must be placed in dirt.', 'Can only be placed in water.', 'Must be placed in the water.',
]);

// The shop texts of repair stations describe the same behaviour in several ways; every variant (matched by the English line)
// is replaced with one wording, in the same position in both languages.
const REPAIR_STATION_RECIPE = '007ae545';
const REPAIR_NOTE_LINES_EN = new Set([
	'Does not repair destroyed C.A.M.P. objects.',
	'Repairs damaged C.A.M.P. objects but cannot rebuild objects that have been completed destroyed.',
]);
const REPAIR_NOTE = {
	en: 'Restores health to damaged C.A.M.P. objects over time but cannot rebuild objects that have been completed destroyed.',
	ru: 'Постепенно ремонтирует поврежденные объекты в C.A.M.P., но не восстанавливает полностью уничтоженные объекты.',
};

function replaceRepairNote(info: ShopInfo | null): void {
	if (!info?.descriptionEn || !info.descriptionRu) return;
	const enLines = info.descriptionEn.split('\n');
	const ruLines = info.descriptionRu.split('\n');
	if (enLines.length !== ruLines.length) return;
	const i = enLines.findIndex(line => REPAIR_NOTE_LINES_EN.has(line.trim()));
	if (i < 0) return;
	enLines[i] = REPAIR_NOTE.en;
	ruLines[i] = REPAIR_NOTE.ru;
	info.descriptionEn = enLines.join('\n');
	info.descriptionRu = ruLines.join('\n');
}

const isWarningLine =(line: string) => line.startsWith('-') && line.endsWith('-');

// Shop descriptions carry technical notes like "- C.A.M.P. ITEMS APPEAR WHILE IN C.A.M.P. MODE. -".
// The Russian text often lacks the dashes, but both languages have the same line layout, so a line
// is dropped when either language marks it. If the layouts differ, each language is judged alone.
function cleanShopDescriptions(en: string | null, ru: string | null): { en: string | null; ru: string | null } {
	const enLines = en?.split('\n').map(line => line.trim());
	const ruLines = ru?.split('\n').map(line => line.trim());
	const aligned = !!enLines && !!ruLines && enLines.length === ruLines.length;

	const clean = (lines: string[] | undefined, other: string[] | undefined) =>
		lines?.filter((line, i) => !isWarningLine(line) && !(aligned && isWarningLine(other![i])) && line !== SHELTER_BAN_LINE_EN && line !== SHELTER_BAN_LINE_RU && !(aligned && other![i] === SHELTER_BAN_LINE_EN)).join('\n').replace(/\n{3,}/g, '\n\n').trim() || null;

	return { en: clean(enLines, ruLines), ru: clean(ruLines, enLines) };
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
		const item = this.#db.query<Item & { camp: boolean; shelter: boolean; workshop: boolean; campOwned: boolean; campMaxFormId: string | null; campMaxValue: number | null; workshopMaxFormId: string | null; workshopMaxValue: number | null; carryWeight: number | null; requiresPower: boolean; powerRequired: number; powerConnectable: boolean; powerGenerated: number; powerRadiated: number; learnConditions: string | null; produces: string | null; display: string | null; storage: string | null; spoilRate: number | null; surface: 'dirt' | 'water' | null; weather: string | null; buffs: string | null; arcadeGame: string | null; unlockEntitlements: string | null; recipeFormId: string }, [string]>(
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

		// The recipe description is the page's lead text; drop it where a block below already says the same.
		const recipe = item.recipeFormId ? this.#resolveRecipe(item.recipeFormId) : null;
		const shopInfo = this.#resolveShopInfo(unlockEntitlements);
		if (item.recipeFormId === REPAIR_STATION_RECIPE) replaceRepairNote(shopInfo);
		if (recipe && ((RECIPES_DESCRIBED_BY_SHOP_TEXT.has(item.recipeFormId) && (shopInfo?.descriptionRu || shopInfo?.descriptionEn)) || item.storage || RECIPES_DESCRIBED_BY_PRODUCES.has(item.recipeFormId) || RECIPES_WITH_HIDDEN_DESCRIPTION.has(item.recipeFormId)
			|| (item.surface && SURFACE_RULE_DESCRIPTIONS_EN.has(recipe.descriptionEn?.trim() ?? '')))) {
			recipe.descriptionEn = null;
			recipe.descriptionRu = null;
		}

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
			storage: item.storage ? JSON.parse(item.storage) : null,
			spoilRate: item.spoilRate ?? null,
			surface: item.surface ?? null,
			weather: item.weather ? JSON.parse(item.weather) : null,
			buffs: item.buffs ? JSON.parse(item.buffs) : null,
			arcadeGame: item.arcadeGame ? JSON.parse(item.arcadeGame) : null,
			category: category || null,
			subcategory: subcategory || null,
			unlockedByEntitlements: this.#resolveUnlockedByEntitlements(unlockEntitlements),
			shopInfo,
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

	#resolveShopInfo(raw: string | null): ShopInfo | null {
		const formIds = raw?.split('|').filter(Boolean) ?? [];
		if (formIds.length === 0) return null;

		const placeholders = formIds.map(() => '?').join(',');

		const rows = getDb(ATX_DB_PATH).query<ShopRow, string[]>(
			`SELECT formId, descriptionEn, descriptionRu, screenshots, campUnlockedItems
			FROM ${ATX_TABLE_NAME_ITEMS}
			WHERE formId IN (${placeholders})`
		).all(...formIds);

		if (rows.length === 0) return null;

		const campItemCount = (row: ShopRow) => row.campUnlockedItems?.split('|').filter(Boolean).length ?? 0;

		// Several entitlements can unlock one item: a generic box plus its skin. The one covering the fewest
		// C.A.M.P. items is the most specific; on a tie the first in unlock order wins.
		const [best] = rows.sort((a, b) =>
			campItemCount(a) - campItemCount(b) || formIds.indexOf(a.formId) - formIds.indexOf(b.formId)
		);

		const { en, ru } = cleanShopDescriptions(best.descriptionEn, best.descriptionRu);
		const screenshots = best.screenshots?.split(';').filter(Boolean) ?? [];

		if (!en && !ru && screenshots.length === 0) return null;

		return {
			descriptionEn: en,
			descriptionRu: ru,
			screenshots: screenshots.length > 0 ? screenshots : null,
			isSet: campItemCount(best) > 1
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
		const row = this.#db.query<Omit<SubItem, 'details' | 'usedIn'> & { details: string | null; usedIn: string }, [string]>(
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

		return { ...row, details: row.details ? JSON.parse(row.details) : null, usedIn };
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