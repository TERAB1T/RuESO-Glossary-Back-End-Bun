import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_BOOKS, TABLE_NAME_PATCHES } from "./constants";
import { escapeQuery } from "../utils";

export class Patches {
	#db: Database;

	constructor() {
		this.#db = new Database(DB_PATH);
	}

	async getPatches() {
		return this.#db.query(`SELECT version, nameEn, nameRu, slug FROM ${TABLE_NAME_PATCHES} ORDER BY id DESC`).all();
	}

	async getPatch(patchVersion: string, page: number, pageSize: number, filter?: string) {
		const offset: number = (page - 1) * pageSize;

		const patch = this.#db.query(`SELECT * FROM ${TABLE_NAME_PATCHES} WHERE version = ?`).get(patchVersion);

		if (!patch) return {};

		let books: any[] = [];
		let totalBooks: number = 0;

		if (filter && filter.length > 2) {
			filter = escapeQuery(filter);

			books = this.#db.query(
                `SELECT b.id, b.titleEn, b.titleRu, b.icon, b.slug
                FROM ${TABLE_NAME_BOOKS} b
                JOIN books_fts ON books_fts.id = b.id
                WHERE books_fts MATCH ? AND created = ?
                ORDER BY orderId ASC
                LIMIT ? OFFSET ?`
            ).all(filter, patchVersion, pageSize, offset);

            totalBooks = (this.#db.query(
                `SELECT COUNT(*) AS count
                FROM books_fts
                JOIN ${TABLE_NAME_BOOKS} b ON books_fts.id = b.id
                WHERE books_fts MATCH ? AND created = ?`
            ).get(filter, patchVersion) as { count: number }).count;

		} else {
			books = this.#db.query(
				`SELECT id, titleEn, titleRu, icon, slug
				FROM ${TABLE_NAME_BOOKS}
				WHERE created = ?
				ORDER BY orderId ASC
				LIMIT ? OFFSET ?`
			).all(patchVersion, pageSize, offset);

			totalBooks = (this.#db.query(
				`SELECT COUNT(*) AS count
				FROM ${TABLE_NAME_BOOKS}
				WHERE created = ?`
			).get(patchVersion) as { count: number }).count;
		}

		return {
			...patch,
			books,
			pagination: {
				page,
				page_size: pageSize,
				total_books: totalBooks,
				total_pages: Math.ceil(totalBooks / pageSize)
			}
		};
	}
}