import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { isInteger, isHex, parseIds, getFileLastModifiedDate } from "./utils";

import { GlossarySearch } from "./glossary/_search";
import { Categories as LibraryCategories } from "./library/_categories";
import { Patches as LibraryPatches } from "./library/_patches";
import { Books } from "./library/_books";

import { Categories as F76AtxCategories } from "./f76-atx/_categories";
import { Items as F76AtxItems } from "./f76-atx/_items";

import { DB_PATH as LIBRARY_DB_PATH } from "./library/constants";
import { TES_DB_PATH as GLOSSARY_TES_DB_PATH } from "./glossary/constants";
import { FALLOUT_DB_PATH as GLOSSARY_FALLOUT_DB_PATH } from "./glossary/constants";
import { DB_PATH as F76ATX_DB_PATH, VALID_SORT_ORDERS as F76ATX_VALID_SORT_ORDERS } from "./f76-atx/constants";

const isWindows = process.platform === 'win32';
const SOCKET_PATH = '/tmp/apiRueso.sock';

const LIBRARY_PAGE_SIZE = 50;
const ATX_PAGE_SIZE = 15;

const app = new Elysia()
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

	.get("/library/categories/:category_id", async ({ params, query }) => {
		const categories = new LibraryCategories();

		const categoryId = params.category_id;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = LIBRARY_PAGE_SIZE;

		if (!isInteger(categoryId)) return {};

		return await categories.getCategory(parseInt(categoryId), parseInt(page), parseInt(pageSize), filter);
	})

	.get("/library/patches", async () => {
		const patches = new LibraryPatches();
		return await patches.getPatches();
	})

	.get("/library/patches/:patch_version", async ({ params, query }) => {
		const patches = new LibraryPatches();

		const patchVersion = params.patch_version;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = LIBRARY_PAGE_SIZE;

		return await patches.getPatch(patchVersion, parseInt(page), parseInt(pageSize), filter);
	})

	.get('/library/books', async ({ query }) => {
		const books = new Books();

		let page: any = query.page;
		let pageSize: any = query.page_size;
		const ids: number[] = parseIds(query.ids);
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = LIBRARY_PAGE_SIZE;

		if (ids.length) return await books.getBooksWithIds(ids);

		return await books.getBooks(parseInt(page), parseInt(pageSize), filter);
	})

	.get('/library/books/:book_id', async ({ params }) => {
		const books = new Books();

		const bookId = params.book_id;
		if (!isInteger(bookId)) return {};

		return await books.getBook(parseInt(bookId));
	})

	.get("/library/updated", async () => {
		const lastModified = await getFileLastModifiedDate(LIBRARY_DB_PATH);
		return { lastModified };
	})

	.get("/glossary/tes/updated", async () => {
		const lastModified = await getFileLastModifiedDate(GLOSSARY_TES_DB_PATH);
		return { lastModified };
	})

	.get("/glossary/fallout/updated", async () => {
		const lastModified = await getFileLastModifiedDate(GLOSSARY_FALLOUT_DB_PATH);
		return { lastModified };
	})

	.get("/f76/atomicshop/categories", async () => {
		const categories = new F76AtxCategories();
		return await categories.getCategories();
	})

	.get("/f76/atomicshop/categories/:category_form_id", async ({ params, query }) => {
		const categories = new F76AtxCategories();

		const categoryFormId = params.category_form_id;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		if (!isHex(categoryFormId)) {
			return {};
		}

		const result = await categories.getCategoryItems(
			categoryFormId,
			parseInt(page),
			parseInt(pageSize),
			filter,
			order
		);

		if (!result) {
			return {};
		}

		return result;
	})

	.get("/f76/atomicshop/subcategories/:subcategory_form_id", async ({ params, query }) => {
		const categories = new F76AtxCategories();

		const subcategoryFormId = params.subcategory_form_id;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		if (!isHex(subcategoryFormId)) {
			return {};
		}

		const result = await categories.getSubcategoryItems(
			subcategoryFormId,
			parseInt(page),
			parseInt(pageSize),
			filter,
			order
		);

		if (!result) {
			return {};
		}

		return result;
	})

	.get('/f76/atomicshop/items', async ({ query }) => {
		const items = new F76AtxItems();

		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;
		let order: any = query.sort_order;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = ATX_PAGE_SIZE;
		if (!F76ATX_VALID_SORT_ORDERS.includes(order) && order) order = F76ATX_VALID_SORT_ORDERS[0];

		const result = await items.getItems(parseInt(page), parseInt(pageSize), filter, order);

		if (!result) {
			return {};
		}

		return result;
	})

	.get('/f76/atomicshop/items/:item_form_id', async ({ params }) => {
		const items = new F76AtxItems();

		const itemId = params.item_form_id;
		if (!isHex(itemId)) return {};

		return await items.getItem(itemId);
	})

	.get("/f76/atomicshop/updated", async () => {
		const lastModified = await getFileLastModifiedDate(F76ATX_DB_PATH);
		return { lastModified };
	})

	//.listen(8000);
	.listen(isWindows ? { port: 8000 } : { unix: SOCKET_PATH });

//console.log(`Server running on http://localhost:8000`);
console.log(isWindows
	? `Server running on http://localhost:8000`
	: `Server running on Unix socket: ${SOCKET_PATH}`);
