import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { isInteger, isHex, parseIds, getFileLastModifiedDate } from "./utils";

import { GlossarySearch } from "./glossary/_search";
import { GlossaryUpdated } from "./glossary/_updated";
import { Categories as LibraryCategories } from "./library/_categories";
import { Patches as LibraryPatches } from "./library/_patches";
import { Books } from "./library/_books";

import { Categories as F76AtxCategories } from "./f76-atx/_categories";
import { Items as F76AtxItems } from "./f76-atx/_items";
import { AcquisitionSources as F76AtxAcquisitionSources } from "./f76-atx/_acquisitionSources";

import { Categories as F76CampCategories } from "./f76-camp/_categories";
import { Items as F76CampItems } from "./f76-camp/_items";

import { DB_PATH as LIBRARY_DB_PATH } from "./library/constants";
import { DB_PATH as F76ATX_DB_PATH, VALID_SORT_ORDERS as F76ATX_VALID_SORT_ORDERS, VALID_ACQUISITION_TYPES as F76ATX_VALID_ACQUISITION_TYPES } from "./f76-atx/constants";
import { DB_PATH as F76CAMP_DB_PATH, VALID_SORT_ORDERS as F76CAMP_VALID_SORT_ORDERS } from "./f76-camp/constants";

const isWindows = process.platform === 'win32';
const SOCKET_PATH = '/tmp/apiRueso.sock';

const LIBRARY_PAGE_SIZE = 50;
const ATX_PAGE_SIZE = 18;
const MAX_PAGE_SIZE = 200;

const notFound = (set: { status?: number | string }) => {
	set.status = 404;
	return { error: "Not Found" };
};

const app = new Elysia()
	.onError(({ error, set }) => {
		console.error(error);
		set.status = 500;
		return { error: "Internal Server Error" };
	})
	.use(cors({
		origin: [
			"http://rueso.ru",
			"https://rueso.ru",
			"http://127.0.0.1",
			"http://127.0.0.1:5500",
			"http://localhost:6173",
		],
	}))

	.get("/glossary/tes", async ({ query }) => {
		const glossarySearch = new GlossarySearch(query, "tes");
		return await glossarySearch.searchTerm();
	})

	.get("/glossary/fallout", async ({ query }) => {
		const glossarySearch = new GlossarySearch(query, "fallout");
		return await glossarySearch.searchTerm();
	})

	.get("/library/categories", async () => {
		const categories = new LibraryCategories();
		return await categories.getCategories();
	})

	.get("/library/categories/:category_id", async ({ params, query, set }) => {
		const categories = new LibraryCategories();

		const categoryId = params.category_id;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = LIBRARY_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

		if (!isInteger(categoryId)) return notFound(set);

		const result = await categories.getCategory(parseInt(categoryId), parseInt(page), parseInt(pageSize), filter);
		return result ?? notFound(set);
	})

	.get("/library/patches", async () => {
		const patches = new LibraryPatches();
		return await patches.getPatches();
	})

	.get("/library/patches/:patch_version", async ({ params, query, set }) => {
		const patches = new LibraryPatches();

		const patchVersion = params.patch_version;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = LIBRARY_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

		const result = await patches.getPatch(patchVersion, parseInt(page), parseInt(pageSize), filter);
		return result ?? notFound(set);
	})

	.get("/library/patches/:patch_version/export", async ({ params, set }) => {
		const patches = new LibraryPatches();

		const patchVersion = params.patch_version;

		const result = await patches.getPatchBooksExport(patchVersion);
		return result ?? notFound(set);
	})

	.get('/library/books', async ({ query }) => {
		const books = new Books();

		let page: any = query.page;
		let pageSize: any = query.page_size;
		const ids: number[] = parseIds(query.ids);
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = LIBRARY_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

		if (ids.length) return await books.getBooksWithIds(ids);

		return await books.getBooks(parseInt(page), parseInt(pageSize), filter);
	})

	.get('/library/books/:book_id', async ({ params, set }) => {
		const books = new Books();

		const bookId = params.book_id;
		if (!isInteger(bookId)) return notFound(set);

		const result = await books.getBook(parseInt(bookId));
		return result ?? notFound(set);
	})

	.get("/library/updated", async () => {
		const lastModified = await getFileLastModifiedDate(LIBRARY_DB_PATH);
		return { lastModified };
	})

	.get("/glossary/tes/updated", async () => {
		const glossaryUpdated = new GlossaryUpdated("tes");
		return await glossaryUpdated.getUpdated();
	})

	.get("/glossary/fallout/updated", async () => {
		const glossaryUpdated = new GlossaryUpdated("fallout");
		return await glossaryUpdated.getUpdated();
	})

	// F76 Atomic Shop

	.get("/f76/atomicshop/categories", async () => {
		const categories = new F76AtxCategories();
		return await categories.getCategories();
	})

	.get("/f76/atomicshop/categories/:category_form_id", async ({ params, query, set }) => {
		const categories = new F76AtxCategories();

		const categoryFormId = params.category_form_id;
		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		const hasSupport = query.has_support === '1' || query.has_support === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		if (!isHex(categoryFormId)) {
			return notFound(set);
		}

		const result = await categories.getCategoryItems(
			categoryFormId,
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS,
			hasSupport
		);

		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/subcategories/:subcategory_form_id", async ({ params, query, set }) => {
		const categories = new F76AtxCategories();

		const subcategoryFormId = params.subcategory_form_id;
		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		const hasSupport = query.has_support === '1' || query.has_support === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		if (!isHex(subcategoryFormId)) {
			return notFound(set);
		}

		const result = await categories.getSubcategoryItems(
			subcategoryFormId,
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS,
			hasSupport
		);

		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/acquisition", async () => {
		const acquisitionSources = new F76AtxAcquisitionSources();
		return await acquisitionSources.getAcquisitionSources();
	})

	.get("/f76/atomicshop/acquisition/:type", async ({ params, query, set }) => {
		const acquisitionSources = new F76AtxAcquisitionSources();

		const type = params.type;
		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		const hasSupport = query.has_support === '1' || query.has_support === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		if (!F76ATX_VALID_ACQUISITION_TYPES.includes(type)) {
			return notFound(set);
		}

		const result = await acquisitionSources.getTypeItems(
			type,
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS,
			hasSupport
		);

		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/acquisition/:type/:number", async ({ params, query, set }) => {
		const acquisitionSources = new F76AtxAcquisitionSources();

		const type = params.type;
		const number = params.number;
		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		const hasSupport = query.has_support === '1' || query.has_support === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		if (!F76ATX_VALID_ACQUISITION_TYPES.includes(type) || !isInteger(number)) {
			return notFound(set);
		}

		const result = await acquisitionSources.getSourceItems(
			type,
			parseInt(number),
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS,
			hasSupport
		);

		return result ?? notFound(set);
	})

	.get('/f76/atomicshop/items', async ({ query, set }) => {
		const items = new F76AtxItems();

		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		const hasSupport = query.has_support === '1' || query.has_support === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		const result = await items.getItems(
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS,
			hasSupport
		);

		return result ?? notFound(set);
	})

	.get('/f76/atomicshop/items/:item_form_id', async ({ params, set }) => {
		const items = new F76AtxItems();

		const itemId = params.item_form_id;
		if (!isHex(itemId)) return notFound(set);

		const result = await items.getItem(itemId);
		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/updated", async () => {
		const lastModified = await getFileLastModifiedDate(F76ATX_DB_PATH);
		return { lastModified };
	})


	// F76 C.A.M.P.

	.get("/f76/camp/categories", async () => {
		const categories = new F76CampCategories();
		return await categories.getCategories();
	})

	.get("/f76/camp/categories/:category_form_id", async ({ params, query, set }) => {
		const categories = new F76CampCategories();

		const categoryFormId = params.category_form_id;
		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76CAMP_VALID_SORT_ORDERS.includes(order) && order) order = F76CAMP_VALID_SORT_ORDERS[0];

		if (!isHex(categoryFormId)) {
			return notFound(set);
		}

		const result = await categories.getCategoryItems(
			categoryFormId,
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS
		);

		return result ?? notFound(set);
	})

	.get("/f76/camp/subcategories/:subcategory_form_id", async ({ params, query, set }) => {
		const categories = new F76CampCategories();

		const subcategoryFormId = params.subcategory_form_id;
		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76CAMP_VALID_SORT_ORDERS.includes(order) && order) order = F76CAMP_VALID_SORT_ORDERS[0];

		if (!isHex(subcategoryFormId)) {
			return notFound(set);
		}

		const result = await categories.getSubcategoryItems(
			subcategoryFormId,
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS
		);

		return result ?? notFound(set);
	})

	.get('/f76/camp/items', async ({ query, set }) => {
		const items = new F76CampItems();

		const isPTS = query.is_pts === '1' || query.is_pts === 'true';
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		else if (parseInt(pageSize) > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
		if (!F76CAMP_VALID_SORT_ORDERS.includes(order) && order) order = F76CAMP_VALID_SORT_ORDERS[0];

		const result = await items.getItems(
			parseInt(page),
			parseInt(pageSize),
			filter,
			order,
			isPTS
		);

		return result ?? notFound(set);
	})

	.get('/f76/camp/items/:item_form_id', async ({ params, set }) => {
		const items = new F76CampItems();

		const itemId = params.item_form_id;
		if (!isHex(itemId)) return notFound(set);

		const result = await items.getItem(itemId);
		return result ?? notFound(set);
	})

	.get("/f76/camp/updated", async () => {
		const lastModified = await getFileLastModifiedDate(F76CAMP_DB_PATH);
		return { lastModified };
	})

	//.listen(8000);
	.listen(isWindows ? { port: 8000 } : { unix: SOCKET_PATH });

//console.log(`Server running on http://localhost:8000`);
console.log(isWindows
	? `Server running on http://localhost:8000`
	: `Server running on Unix socket: ${SOCKET_PATH}`);
