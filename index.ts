import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { isInteger, parseIds, getFileLastModifiedDate } from "./utils";

import { GlossarySearch } from "./glossary/_search";
import { Categories } from "./library/_categories";
import { Patches } from "./library/_patches";
import { Books } from "./library/_books";

import { DB_PATH as LIBRARY_DB_PATH} from "./library/constants";
import { DB_PATH as GLOSSARY_DB_PATH } from "./glossary/constants";

const isWindows = process.platform === 'win32';
const SOCKET_PATH = '/tmp/apiRueso.sock';

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

	.get("/glossary", async ({ query }) => {
		const glossarySearch = new GlossarySearch(query);
		return await glossarySearch.searchTerm();
	})

	.get("/library/categories", async () => {
		const categories = new Categories();
		return await categories.getCategories();
	})

	.get("/library/categories/:category_id", async ({ params, query }) => {
		const categories = new Categories();

		const categoryId = params.category_id;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = 50;

		if (!isInteger(categoryId)) return {};

		return await categories.getCategory(parseInt(categoryId), parseInt(page), parseInt(pageSize), filter);
	})

	.get("/library/patches", async () => {
		const patches = new Patches();
		return await patches.getPatches();
	})

	.get("/library/patches/:patch_version", async ({ params, query }) => {
		const patches = new Patches();

		const patchVersion = params.patch_version;
		let page: any = query.page;
		let pageSize: any = query.page_size;
		let filter: any = query.filter;

		if (!isInteger(page)) page = 1;
		if (!isInteger(pageSize)) pageSize = 50;

		return await patches.getPatch(patchVersion, parseInt(page), parseInt(pageSize), filter);
	})

	.get('/library/books', async ({ query }) => {
        const books = new Books();

        let page: any = query.page;
        let pageSize: any = query.page_size;
        const ids: number[] = parseIds(query.ids);
		let filter: any = query.filter;

        if (!isInteger(page)) page = 1;
        if (!isInteger(pageSize)) pageSize = 50;

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

	.get("/glossary/updated", async () => {
		const lastModified = await getFileLastModifiedDate(GLOSSARY_DB_PATH);
		return { lastModified };
	})

	//.listen(8000);
	.listen(isWindows ? { port: 8000 } : { unix: SOCKET_PATH });

	//console.log(`Server running on http://localhost:8000`);
	console.log(isWindows
		? `Server running on http://localhost:8000`
		: `Server running on Unix socket: ${SOCKET_PATH}`);
