import { Database } from "bun:sqlite";
import { DB_PATH, TABLE_NAME_BOOKS, TABLE_NAME_CATEGORIES, TABLE_NAME_PATCHES } from "../library/constants";
import { escapeQuery } from "../utils";

export class Books {
    #db: Database;

    constructor() {
        this.#db = new Database(DB_PATH);
    }

    public async getBooks(page: number, pageSize: number, filter?: string) {
        const offset: number = (page - 1) * pageSize;

        let books: any[] = [];
        let totalBooks: number = 0;

        if (filter && filter.length > 2) {
            filter = escapeQuery(filter);

            books = this.#db.query(
                `SELECT b.id, b.titleEn, b.titleRu, b.icon, b.slug
                FROM ${TABLE_NAME_BOOKS} b
                JOIN books_fts ON books_fts.id = b.id
                WHERE books_fts MATCH ? AND catId != 2000
                ORDER BY orderId ASC
                LIMIT ? OFFSET ?`
            ).all(filter, pageSize, offset);

            totalBooks = (this.#db.query(
                `SELECT COUNT(*) AS count
                FROM books_fts
                JOIN ${TABLE_NAME_BOOKS} b ON books_fts.id = b.id
                WHERE books_fts MATCH ? AND catId != 2000`
            ).get(filter) as { count: number }).count;

        } else {
            books = this.#db.query(
                `SELECT id, titleEn, titleRu, icon, slug
                FROM ${TABLE_NAME_BOOKS}
                WHERE catId != 2000
                ORDER BY orderId ASC
                LIMIT ? OFFSET ?`
            ).all(pageSize, offset);

            totalBooks = (this.#db.query(
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME_BOOKS}
                WHERE catId != 2000`
            ).get() as { count: number }).count;
        }

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


        let group = [];

        if (book.groupIds) {
            const groupIds = book.groupIds.split(',').map(id => parseInt(id));
            group = this.#db.query(`SELECT id, titleRu, icon, slug FROM ${TABLE_NAME_BOOKS} WHERE id IN (${groupIds.map(() => "?").join(",")})`).all(...groupIds);
            group.sort((a, b) => groupIds.indexOf(a.id) - groupIds.indexOf(b.id));
        }
        delete book.groupIds;


        if (isSameVersion) {
            return { ...book, category: category || {}, group, created: created || {}, updated: created || {} };
        }

        const updated = this.#db.query(
            `SELECT version, nameEn, nameRu, date, slug FROM ${TABLE_NAME_PATCHES} WHERE version = ?`
        ).get(book.updated);

        return { ...book, category: category || {}, group, created: created || {}, updated: updated || {} };
    }
}