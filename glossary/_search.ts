import { Database } from "bun:sqlite";
import { COLUMNS, TABLE_NAME,
	TES_VALID_GAMES, TES_DB_PATH,
	FALLOUT_VALID_GAMES, FALLOUT_DB_PATH } from "../glossary/constants";
import { prepareHtml } from "../utils";

export class GlossarySearch {
    #draw: string;
    #start: number;
    #length: number;
    #searchValue: string;
    #games: string[];
    #filters: string[];
    #orderDir: 'ASC' | 'DESC';
    #orderColumnIndex: number | null;
    #orderColumn: string | null;

	#dbPath: string;
	#validGames: string[];


    constructor(query, game: string) {

		if (game === 'fallout') {
			this.#dbPath = FALLOUT_DB_PATH;
			this.#validGames = FALLOUT_VALID_GAMES;
		} else {
			this.#dbPath = TES_DB_PATH;
			this.#validGames = TES_VALID_GAMES;
		}

        this.#draw = query.draw || '1';
        this.#start = parseInt(query.start || 0);
        this.#length = parseInt(query.length || 10);
        this.#searchValue = query["search[value]"] || "";
        this.#games = this.#validateGames((query.games || '').split(','));
        this.#filters = COLUMNS.map((_, index) => query[`columns[${index}][search][value]`] || '');

        this.#orderDir = (query["order[0][dir]"] || 'asc').toUpperCase();

        this.#orderColumnIndex = query['order[0][column]'] !== null && !isNaN(query['order[0][column]']) ? parseInt(query['order[0][column]']) : null;

        this.#orderColumn = (this.#orderColumnIndex != null && ['ASC', 'DESC'].includes(this.#orderDir))
            ? COLUMNS[this.#orderColumnIndex]
            : null;
    }

    #validateGames(games: string[]): string[] {
        return Array.from(new Set(games).intersection(new Set(this.#validGames)));
    }

    #escapeQuery(query: string): string {
        let escaped = query.replace(/"/g, '""').replace(/ /g, ' ');
        escaped = escaped.replace(/[‘’]/g, "'").replace(/[“”„]/g, '""');
        return `"${escaped}"`;
    }

    async searchTerm() {
        const db = new Database(this.#dbPath);

        const startTime = Date.now();
        const { query, params } = this.#buildQuery();

        let finalQuery = query;
        if (this.#orderColumn !== null) {
            finalQuery += ` ORDER BY ${this.#orderColumn} ${this.#orderDir}`;
        }
        finalQuery += " LIMIT ? OFFSET ?";
        params.push(this.#length.toString(), this.#start.toString());

        const results = db.query(finalQuery).all(params);
        console.log(`Fetching data: ${(Date.now() - startTime) / 1000} seconds`);

        const startCountTime = Date.now();
        const { query: countQuery, params: countParams } = this.#buildQuery(true);
        const totalRecords = db.query(countQuery).get(countParams) as { "COUNT(*)": number };

        console.log(`Fetching total records: ${(Date.now() - startCountTime) / 1000} seconds`);

        db.close();

        return {
            draw: this.#draw,
            recordsTotal: totalRecords ? totalRecords["COUNT(*)"] : 0,
            recordsFiltered: totalRecords ? totalRecords["COUNT(*)"] : 0,
            data: results.map((res: any) => ({
                game: res.game,
                en: prepareHtml(res.en),
                ru: prepareHtml(res.ru),
                type: res.type,
                tag: res.tag
            })),
        };
    }

    #buildQuery(isCountQuery = false) {
        let baseQuery = isCountQuery
            ? `SELECT COUNT(*) FROM ${TABLE_NAME}`
            : `SELECT * FROM ${TABLE_NAME}`;

        const queryConditions: string[] = [];
        const params: string[] = [];

        if (/[а-яА-Я]/.test(this.#searchValue)) {
            queryConditions.push('ru MATCH ?');
            params.push(this.#escapeQuery(this.#searchValue));
        } else {
            queryConditions.push(`${TABLE_NAME} MATCH ?`);
            params.push(`en:${this.#escapeQuery(this.#searchValue)} OR ru:${this.#escapeQuery(this.#searchValue)}`);
        }

        if (this.#filters[1]) {
            queryConditions.push('type MATCH ?');
            params.push(this.#escapeQuery(this.#filters[1]));
        }
        if (this.#filters[2]) {
            queryConditions.push('en MATCH ?');
            params.push(this.#escapeQuery(this.#filters[2]));
        }
        if (this.#filters[3]) {
            queryConditions.push('ru MATCH ?');
            params.push(this.#escapeQuery(this.#filters[3]));
        }

        if (this.#games.length) {
            queryConditions.push(`${TABLE_NAME} MATCH ?`);
            params.push(this.#games.map(game => `game:^${game}`).join(' OR '));
        }

        if (queryConditions.length) {
            baseQuery += ' WHERE ' + queryConditions.join(' AND ');
        }

        return { query: baseQuery, params };
    }
}
