import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_BOOKS, TABLE_NAME_CATEGORIES } from "../library/constants";
import { escapeQuery } from "../utils";

export class Categories {
	#db: Database;

	constructor() {
		this.#db = new Database(DB_PATH);
	}

	async getCategories() {
		return this.#db.query(`SELECT id, titleEn, titleRu, icon, slug FROM ${TABLE_NAME_CATEGORIES} ORDER BY titleRu ASC`).all();
	}

	async getCategory(categoryId: number, page: number, pageSize: number, filter?: string) {
		const offset: number = (page - 1) * pageSize;

		const category = this.#db.query(`SELECT * FROM ${TABLE_NAME_CATEGORIES} WHERE id = ?`).get(categoryId);

		if (!category) return {};

		let books: any[] = [];
		let totalBooks: number = 0;

		if (filter && filter.length > 2) {
			filter = escapeQuery(filter);

			books = this.#db.query(
                `SELECT b.id, b.titleEn, b.titleRu, b.icon, b.slug
                FROM ${TABLE_NAME_BOOKS} b
                JOIN books_fts ON books_fts.id = b.id
                WHERE books_fts MATCH ? AND catId = ?
                ORDER BY orderId ASC
                LIMIT ? OFFSET ?`
            ).all(filter, category.id, pageSize, offset);

            totalBooks = (this.#db.query(
                `SELECT COUNT(*) AS count
                FROM books_fts
                JOIN ${TABLE_NAME_BOOKS} b ON books_fts.id = b.id
                WHERE books_fts MATCH ? AND catId = ?`
            ).get(filter, category.id) as { count: number }).count;

		} else {
			books = this.#db.query(
				`SELECT id, titleEn, titleRu, icon, slug
				FROM ${TABLE_NAME_BOOKS}
				WHERE catId = ?
				ORDER BY orderId ASC
				LIMIT ? OFFSET ?`
			).all(category.id, pageSize, offset);

			totalBooks = (this.#db.query(
				`SELECT COUNT(*) AS count
				FROM ${TABLE_NAME_BOOKS}
				WHERE catId = ?`
			).get(category.id) as { count: number }).count;
		}

		return {
			...category,
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