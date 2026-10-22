import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { isInteger, isHex, parseIds, parseListQuery, getFileLastModifiedDate } from "./utils";

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

const libraryListQuery = (query: Record<string, string | undefined>) =>
	parseListQuery(query, LIBRARY_PAGE_SIZE, MAX_PAGE_SIZE);
const atxListQuery = (query: Record<string, string | undefined>) =>
	parseListQuery(query, ATX_PAGE_SIZE, MAX_PAGE_SIZE, F76ATX_VALID_SORT_ORDERS);
const campListQuery = (query: Record<string, string | undefined>) =>
	parseListQuery(query, ATX_PAGE_SIZE, MAX_PAGE_SIZE, F76CAMP_VALID_SORT_ORDERS);

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
		return await new LibraryCategories().getCategories();
	})

	.get("/library/categories/:category_id", async ({ params, query, set }) => {
		if (!isInteger(params.category_id)) return notFound(set);

		const { page, pageSize, filter } = libraryListQuery(query);
		const result = await new LibraryCategories().getCategory(parseInt(params.category_id), page, pageSize, filter);
		return result ?? notFound(set);
	})

	.get("/library/patches", async () => {
		return await new LibraryPatches().getPatches();
	})

	.get("/library/patches/:patch_version", async ({ params, query, set }) => {
		const { page, pageSize, filter } = libraryListQuery(query);
		const result = await new LibraryPatches().getPatch(params.patch_version, page, pageSize, filter);
		return result ?? notFound(set);
	})

	.get("/library/patches/:patch_version/export", async ({ params, set }) => {
		const result = await new LibraryPatches().getPatchBooksExport(params.patch_version);
		return result ?? notFound(set);
	})

	.get('/library/books', async ({ query }) => {
		const books = new Books();

		const ids: number[] = parseIds(query.ids);
		if (ids.length) return await books.getBooksWithIds(ids);

		const { page, pageSize, filter } = libraryListQuery(query);
		return await books.getBooks(page, pageSize, filter);
	})

	.get('/library/books/:book_id', async ({ params, set }) => {
		if (!isInteger(params.book_id)) return notFound(set);

		const result = await new Books().getBook(parseInt(params.book_id));
		return result ?? notFound(set);
	})

	.get("/library/updated", async () => {
		const lastModified = await getFileLastModifiedDate(LIBRARY_DB_PATH);
		return { lastModified };
	})

	.get("/glossary/tes/updated", async () => {
		return await new GlossaryUpdated("tes").getUpdated();
	})

	.get("/glossary/fallout/updated", async () => {
		return await new GlossaryUpdated("fallout").getUpdated();
	})

	// F76 Atomic Shop

	.get("/f76/atomicshop/categories", async () => {
		return await new F76AtxCategories().getCategories();
	})

	.get("/f76/atomicshop/categories/:category_form_id", async ({ params, query, set }) => {
		if (!isHex(params.category_form_id)) return notFound(set);

		const { page, pageSize, filter, order, isPTS, hasSupport } = atxListQuery(query);
		const result = await new F76AtxCategories().getCategoryItems(params.category_form_id, page, pageSize, filter, order, isPTS, hasSupport);
		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/subcategories/:subcategory_form_id", async ({ params, query, set }) => {
		if (!isHex(params.subcategory_form_id)) return notFound(set);

		const { page, pageSize, filter, order, isPTS, hasSupport } = atxListQuery(query);
		const result = await new F76AtxCategories().getSubcategoryItems(params.subcategory_form_id, page, pageSize, filter, order, isPTS, hasSupport);
		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/acquisition", async () => {
		return await new F76AtxAcquisitionSources().getAcquisitionSources();
	})

	.get("/f76/atomicshop/acquisition/:type", async ({ params, query, set }) => {
		if (!F76ATX_VALID_ACQUISITION_TYPES.includes(params.type)) return notFound(set);

		const { page, pageSize, filter, order, isPTS, hasSupport } = atxListQuery(query);
		const result = await new F76AtxAcquisitionSources().getTypeItems(params.type, page, pageSize, filter, order, isPTS, hasSupport);
		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/acquisition/:type/:number", async ({ params, query, set }) => {
		if (!F76ATX_VALID_ACQUISITION_TYPES.includes(params.type) || !isInteger(params.number)) return notFound(set);

		const { page, pageSize, filter, order, isPTS, hasSupport } = atxListQuery(query);
		const result = await new F76AtxAcquisitionSources().getSourceItems(params.type, parseInt(params.number), page, pageSize, filter, order, isPTS, hasSupport);
		return result ?? notFound(set);
	})

	.get('/f76/atomicshop/items', async ({ query }) => {
		const { page, pageSize, filter, order, isPTS, hasSupport } = atxListQuery(query);
		return await new F76AtxItems().getItems(page, pageSize, filter, order, isPTS, hasSupport);
	})

	.get('/f76/atomicshop/items/:item_form_id', async ({ params, set }) => {
		if (!isHex(params.item_form_id)) return notFound(set);

		const result = await new F76AtxItems().getItem(params.item_form_id);
		return result ?? notFound(set);
	})

	.get("/f76/atomicshop/updated", async () => {
		const lastModified = await getFileLastModifiedDate(F76ATX_DB_PATH);
		return { lastModified };
	})

	// F76 C.A.M.P.

	.get("/f76/camp/categories", async () => {
		return await new F76CampCategories().getCategories();
	})

	.get("/f76/camp/categories/:category_form_id", async ({ params, query, set }) => {
		if (!isHex(params.category_form_id)) return notFound(set);

		const { page, pageSize, filter, order, isPTS } = campListQuery(query);
		const result = await new F76CampCategories().getCategoryItems(params.category_form_id, page, pageSize, filter, order, isPTS);
		return result ?? notFound(set);
	})

	.get("/f76/camp/subcategories/:subcategory_form_id", async ({ params, query, set }) => {
		if (!isHex(params.subcategory_form_id)) return notFound(set);

		const { page, pageSize, filter, order, isPTS } = campListQuery(query);
		const result = await new F76CampCategories().getSubcategoryItems(params.subcategory_form_id, page, pageSize, filter, order, isPTS);
		return result ?? notFound(set);
	})

	.get('/f76/camp/items', async ({ query }) => {
		const { page, pageSize, filter, order, isPTS } = campListQuery(query);
		return await new F76CampItems().getItems(page, pageSize, filter, order, isPTS);
	})

	.get('/f76/camp/items/:item_form_id', async ({ params, set }) => {
		if (!isHex(params.item_form_id)) return notFound(set);

		const result = await new F76CampItems().getItem(params.item_form_id);
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
