import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_BOOKS, TABLE_NAME_CATEGORIES } from "../library/constants";

export class Categories {
	#db: Database;

	constructor() {
        this.#db = new Database(DB_PATH);
    }

	async getCategories() {
		return this.#db.query(`SELECT id, titleEn, titleRu, icon, slug FROM ${TABLE_NAME_CATEGORIES} ORDER BY titleRu ASC`).all();
	}

	async getCategory(categoryId: number, page: number, pageSize: number) {
		const offset: number = (page - 1) * pageSize;

		const category = this.#db.query(`SELECT * FROM ${TABLE_NAME_CATEGORIES} WHERE id = ?`).get(categoryId);

		if (!category) return {};

		const books = this.#db.query(`SELECT id, titleEn, titleRu, icon, slug FROM ${TABLE_NAME_BOOKS} WHERE catId = ? ORDER BY titleRu ASC LIMIT ? OFFSET ?`).all(category.id, pageSize, offset);

		const totalBooks = this.#db.query(`SELECT COUNT(*) AS count FROM ${TABLE_NAME_BOOKS} WHERE catId = ?`).get(category.id).count;

		return {
			...category,
			books,
			pagination: {
				page,
				page_size: pageSize,
				total_books: books.length,
				total_pages: Math.ceil(books.length / pageSize)
			}
		};
	}
}