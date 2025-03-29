import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_BOOKS, TABLE_NAME_CATEGORIES, TABLE_NAME_PATCHES } from "../library/constants";

export class Books {
	#db: Database;

	constructor() {
        this.#db = new Database(DB_PATH);
    }

	public async getBooks(page: number, pageSize: number) {
		const offset: number = (page - 1) * pageSize;

		const books = this.#db.query(
            `SELECT id, titleEn, titleRu, icon, slug FROM ${TABLE_NAME_BOOKS} WHERE catId != 2000 ORDER BY orderId ASC LIMIT ? OFFSET ?`
        ).all(pageSize, offset);
        const totalBooks = this.#db.query(`SELECT COUNT(*) AS count FROM ${TABLE_NAME_BOOKS} WHERE catId != 2000`).get().count;

		return {
            books,
            pagination: {
                page,
                page_size: pageSize,
                total_books: totalBooks,
                total_pages: Math.ceil(totalBooks / pageSize)
            }
        };
	}

	async getBooksWithIds(ids: number[]) {
        const placeholders = ids.map(() => "?").join(",");

        return this.#db.query(
            `SELECT id, titleEn, titleRu, icon, slug FROM ${TABLE_NAME_BOOKS} WHERE id IN (${placeholders}) ORDER BY orderId ASC`
        ).all(...ids);
    }

	async getBook(bookId: number) {
        const book = this.#db.query(`SELECT * FROM ${TABLE_NAME_BOOKS} WHERE id = ?`).get(bookId);
        if (!book) return {};

        const isSameVersion = book.created === book.updated;

        const category = this.#db.query(
            `SELECT id, titleEn, titleRu, icon, slug FROM ${TABLE_NAME_CATEGORIES} WHERE id = ?`
        ).get(book.catId);

        const created = this.#db.query(
            `SELECT version, nameEn, nameRu, date, slug FROM ${TABLE_NAME_PATCHES} WHERE version = ?`
        ).get(book.created);

        if (isSameVersion) {
            return { ...book, category: category || {}, created: created || {}, updated: created || {} };
        }

        const updated = this.#db.query(
            `SELECT version, nameEn, nameRu, date, slug FROM ${TABLE_NAME_PATCHES} WHERE version = ?`
        ).get(book.updated);

        return { ...book, category: category || {}, created: created || {}, updated: updated || {} };
    }
}