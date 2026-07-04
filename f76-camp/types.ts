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
	learnConditions: unknown[] | null;
	produces: ProducesMode[] | null;
	unlockedByEntitlements: UnlockedByEntitlement[] | null;
}