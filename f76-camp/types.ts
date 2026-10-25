export interface Category {
	formId: string;
	editorId: string;
	nameEn: string | null;
	nameRu: string | null;
	slug: string | null;
	orderId: number;
}

export interface Subcategory {
	formId: string;
	editorId: string;
	nameEn: string | null;
	nameRu: string | null;
	slug: string | null;
	parentCategoryFormId: string | null;
	parentCategoryEditorId: string | null;
	orderId: number;
}

export interface CategoryWithSubcategories extends Category {
	subcategories: Subcategory[];
}

export interface Item {
	formId: string;
	editorId: string;
	nameEn: string | null;
	nameRu: string | null;
	descriptionEn: string | null;
	descriptionRu: string | null;
	mainImage: string | null;
	screenshots: string | string[] | null;
	categoryFormId: string | null;
	subcategoryFormId: string | null;
	isPTS: boolean | null;
	slug: string | null;
	orderInGame: number;
	orderByName: number;
	orderByFormId: number;
}

export interface PaginationInfo {
	page: number;
	page_size: number;
	total_items: number;
	total_pages: number;
}

export interface CategoryItemsResponse {
	category: Category;
	items: Item[];
	pagination: PaginationInfo;
}

export interface SubcategoryItemsResponse {
	subcategory: Subcategory;
	items: Item[];
	pagination: PaginationInfo;
}

export interface ItemsResponse {
	items: Item[];
	pagination: PaginationInfo;
}

export interface UnlockedByEntitlement {
	formId: string;
	editorId: string;
	nameEn: string | null;
	nameRu: string | null;
	mainImage: string | null;
	screenshots: string[] | null;
	slug: string | null;
}

export interface ProducesItemNode {
	kind: 'item';
	formId: string;
	editorId: string | null;
	en: string | null;
	ru: string | null;
	type: string | null;
	count: number;
	probability: number;
	availabilityNote: string | null;
}

export interface ProducesListNode {
	kind: 'list';
	formId: string;
	editorId: string | null;
	en: string | null;
	ru: string | null;
	probability: number;
	entries: ProducesNode[];
}

export type ProducesNode = ProducesItemNode | ProducesListNode;

export interface ProducesMode {
	en: string | null;
	ru: string | null;
	intervalHours: number | null;
	outcomes: ProducesNode[];
	modeEn?: string;
	modeRu?: string;
	cost?: number;
}

export interface DisplayAllowedEntry {
	formId: string;
	en: string | null;
	ru: string | null;
	maxAmount: number;
}

export interface DisplayExcludedEntry {
	formId: string;
	en: string | null;
	ru: string | null;
}

export interface DisplayInfo {
	allowed: DisplayAllowedEntry[];
	excluded: DisplayExcludedEntry[];
}

export type BuffTrigger = 'whileUsing' | 'afterDelay' | 'onActivate' | 'onPassThrough';
export type BuffCondition = 'noAllyNearby' | 'infatuatedAllyNearby' | 'romanticAllyNearby';

export interface LocalizedName {
	en: string | null;
	ru: string | null;
}

export interface BuffRequiredPerk {
	formId: string;
	name: LocalizedName;
}

export interface BuffEffect {
	mgefFormId: string;
	description: LocalizedName;
	magnitude: number;
	duration: number;
	actorValueFormId: string | null;
	requiresPerk: BuffRequiredPerk | null;
}

export interface Buff {
	spellFormId: string;
	name: LocalizedName;
	trigger: BuffTrigger;
	delaySeconds: number | null;
	condition: BuffCondition | null;
	diseaseRisk: boolean;
	effects: BuffEffect[];
}

export interface ArcadeGame {
	name: LocalizedName;
	description: LocalizedName;
	pointsDescription: LocalizedName;
}

export interface RecipeComponent {
	formId: string;
	editorId: string | null;
	nameEn: string | null;
	nameRu: string | null;
	count: number;
}

export interface RecipeInfo {
	formId: string;
	editorId: string;
	nameEn: string | null;
	nameRu: string | null;
	descriptionEn: string | null;
	descriptionRu: string | null;
	components: RecipeComponent[];
}

export interface RecipeSiblingItem {
	formId: string;
	nameEn: string | null;
	nameRu: string | null;
	slug: string | null;
}

export interface StorageInfo {
	group: string;
	lists: { formId: string; en: string | null; ru: string | null }[];
	limit: number | null;
	items?: { formId: string; editorId: string | null; en: string | null; ru: string | null; type: string | null }[];
	chargeRate?: number;
}

export interface SharedLimitCategory extends Pick<Category, 'formId' | 'nameEn' | 'nameRu' | 'slug'> {
	count: number;
}

export interface SharedLimit {
	total: number;
	items: RecipeSiblingItem[];
	categories: SharedLimitCategory[];
}

export interface ShopInfo {
	descriptionEn: string | null;
	descriptionRu: string | null;
	screenshots: string[] | null;
	isSet: boolean;
}

export interface WeatherInfo {
	type: 'radiation' | 'rain' | 'sandstorm' | 'other';
	intenseEffects: boolean;
}

export interface ItemWithRelations extends Item {
	category: Pick<Category, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
	subcategory: Pick<Subcategory, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
	camp: boolean;
	shelter: boolean;
	workshop: boolean;
	campOwned: boolean;
	campMaxFormId: string | null;
	campMaxValue: number | null;
	workshopMaxFormId: string | null;
	workshopMaxValue: number | null;
	carryWeight: number | null;
	requiresPower: boolean;
	powerRequired: number;
	powerConnectable: boolean;
	powerGenerated: number;
	powerRadiated: number;
	learnConditions: unknown[] | null;
	produces: ProducesMode[] | null;
	display: DisplayInfo | null;
	storage: StorageInfo | null;
	spoilRate: number | null;
	surface: 'dirt' | 'water' | null;
	weather: WeatherInfo | null;
	buffs: Buff[] | null;
	arcadeGame: ArcadeGame | null;
	unlockedByEntitlements: UnlockedByEntitlement[] | null;
	shopInfo: ShopInfo | null;
	sharedLimit: SharedLimit | null;
	recipe: RecipeInfo | null;
	recipeItems: RecipeSiblingItem[];
}
export interface SubItemComponent {
	formId: string;
	name: LocalizedName | null;
	count: number;
}

export type SubItemEffectKind = 'hunger' | 'thirst' | 'rads' | 'disease' | 'feral';
export type SubItemEffectCondition = 'ghoul' | 'notGhoul' | 'night' | 'ally';

export interface SubItemEffect {
	kind: SubItemEffectKind | null;
	mgefFormId: string;
	description: LocalizedName | null;
	magnitude: number;
	duration: number;
	requiresPerk: { formId: string; name: LocalizedName | null; rank: number | null } | null;
	condition: SubItemEffectCondition | null;
}

export interface SubItemConsumable {
	effects: SubItemEffect[];
	spoilMinutes: number | null;
	ferments: boolean;
	spoilsInto: { formId: string; name: LocalizedName | null } | null;
	addiction: { name: LocalizedName | null; chance: number } | null;
}

export interface SubItemDetails {
	components?: SubItemComponent[];
	consumable?: SubItemConsumable;
	ammo?: { formId: string; name: LocalizedName | null };
}

export interface SubItem {
	formId: string;
	editorId: string | null;
	formType: string;
	type: string | null;
	nameEn: string | null;
	nameRu: string | null;
	descriptionEn: string | null;
	descriptionRu: string | null;
	weight: number | null;
	value: number | null;
	details: SubItemDetails | null;
	usedIn: RecipeSiblingItem[];
}
