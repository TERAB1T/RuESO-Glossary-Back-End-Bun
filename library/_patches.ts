import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_BOOKS, TABLE_NAME_PATCHES } from "./constants";

export class Patches {
	#db: Database;

	constructor() {
		this.#db = new Database(DB_PATH);
	}

	async getPatches() {
		return this.#db.query(`SELECT version, nameEn, nameRu, slug FROM ${TABLE_NAME_PATCHES} ORDER BY id DESC`).all();
	}

	async getPatch(patchVersion: string, page: number, pageSize: number) {
		const offset: number = (page - 1) * pageSize;

		const patch = this.#db.query(`SELECT * FROM ${TABLE_NAME_PATCHES} WHERE version = ?`).get(patchVersion);

		if (!patch) return {};

		const books = this.#db.query(`SELECT id, titleEn, titleRu, icon, slug FROM ${TABLE_NAME_BOOKS} WHERE created = ? ORDER BY orderId ASC LIMIT ? OFFSET ?`).all(patchVersion, pageSize, offset);

		const totalBooks = this.#db.query(`SELECT COUNT(*) AS count FROM ${TABLE_NAME_BOOKS} WHERE created = ?`).get(patchVersion).count;

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