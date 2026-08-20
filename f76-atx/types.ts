import type { Category as CampCategory, Subcategory as CampSubcategory } from "../f76-camp/types";

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

export interface AcquisitionSource {
	id: number;
	slug: string;
	type: string;
	nameEn: string | null;
	nameRu: string | null;
	subtitleEn: string | null;
	subtitleRu: string | null;
	startDate: number | null;
	endDate: number | null;
}

export interface AcquisitionSourcesByType {
	type: string;
	sources: AcquisitionSource[];
}

export interface CampUnlockedItem {
	formId: string;
	nameEn: string | null;
	nameRu: string | null;
	mainImage: string | null;
	slug: string | null;
	category: Pick<CampCategory, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
	subcategory: Pick<CampSubcategory, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
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
	supportItem: string | null;
	supportBundles: string | null;
	campUnlockedItems: string | null;
	acquisitionSourceId: number | null;
	acquisitionSourceType: string;
	rarity: number | null;
	slug: string | null;
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

export interface AcquisitionTypeItemsResponse {
	type: string;
	items: Item[];
	pagination: PaginationInfo;
}

export interface AcquisitionSourceItemsResponse {
	acquisitionSource: AcquisitionSource;
	items: Item[];
	pagination: PaginationInfo;
}

export interface ItemsResponse {
	items: Item[];
	pagination: PaginationInfo;
}

export interface ItemWithRelations extends Omit<Item, 'campUnlockedItems'> {
	category: Pick<Category, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
	subcategory: Pick<Subcategory, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
	acquisitionSource: Pick<AcquisitionSource, 'type' | 'nameRu' | 'subtitleRu' | 'slug'> | null;
	campUnlockedItems: CampUnlockedItem[] | null;
}