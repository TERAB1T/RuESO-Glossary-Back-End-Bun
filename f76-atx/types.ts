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

export interface ItemsResponse {
	items: Item[];
	pagination: PaginationInfo;
}

export interface ItemWithRelations extends Item {
	category: Pick<Category, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
	subcategory: Pick<Subcategory, 'formId' | 'nameEn' | 'nameRu' | 'slug'> | null;
}