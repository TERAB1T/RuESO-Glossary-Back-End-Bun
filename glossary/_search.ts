import { Database } from "bun:sqlite";
import {
	COLUMNS, TABLE_NAME, DEFAULT_SERVER,
	TES_VALID_GAMES, TES_DB_PATHS, TES_SERVER_GAMES,
	FALLOUT_VALID_GAMES, FALLOUT_DB_PATHS, FALLOUT_SERVER_GAMES
} from "../glossary/constants";
import { prepareHtml } from "../utils";

const MAX_LENGTH = 200;

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

		const [dbPaths, serverGames] = game === 'fallout'
			? [FALLOUT_DB_PATHS, FALLOUT_SERVER_GAMES]
			: [TES_DB_PATHS, TES_SERVER_GAMES];
		this.#validGames = game === 'fallout' ? FALLOUT_VALID_GAMES : TES_VALID_GAMES;

		const requestedGames: string[] = (query.games || '').split(',');

		// Only one server can be searched at a time; if a request names both, the first one wins.
		const server = requestedGames.map(g => serverGames[g]?.[1]).find(Boolean) ?? DEFAULT_SERVER;
		this.#dbPath = dbPaths[server];

		this.#draw = query.draw || '1';
		this.#start = Math.max(parseInt(query.start) || 0, 0);
		this.#length = Math.min(Math.max(parseInt(query.length) || 10, 1), MAX_LENGTH);
		this.#searchValue = query["search[value]"] || "";
		this.#games = this.#validateGames(requestedGames.map(g => serverGames[g]?.[0] ?? g));
		this.#filters = COLUMNS.map((_, index) => query[`columns[${index}][search][value]`] || '');

		this.#orderDir = (query["order[0][dir]"] || 'asc').toUpperCase();

		this.#orderColumnIndex = query['order[0][column]'] !== null && !isNaN(query['order[0][column]']) ? parseInt(query['order[0][column]']) : null;

		this.#orderColumn = (this.#orderColumnIndex != null
			&& this.#orderColumnIndex >= 0
			&& this.#orderColumnIndex < COLUMNS.length
			&& ['ASC', 'DESC'].includes(this.#orderDir))
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
		const db = new Database(this.#dbPath, { readonly: true });

		try {
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

			// A short page means every match from #start on is already fetched, so the total is
			// known without a COUNT, which would repeat the whole FTS lookup (costly for long phrases).
			// An empty page past the first one may just be out of range, so it still needs a COUNT.
			let total: number;
			if (results.length < this.#length && (this.#start === 0 || results.length > 0)) {
				total = this.#start + results.length;
			} else {
				const startCountTime = Date.now();
				const { query: countQuery, params: countParams } = this.#buildQuery(true);
				const totalRecords = db.query(countQuery).get(countParams) as { "COUNT(*)": number };
				total = totalRecords ? totalRecords["COUNT(*)"] : 0;

				console.log(`Fetching total records: ${(Date.now() - startCountTime) / 1000} seconds`);
			}

			return {
				draw: this.#draw,
				recordsTotal: total,
				recordsFiltered: total,
				data: results.map((res: any) => ({
					game: res.game,
					en: prepareHtml(res.en),
					ru: prepareHtml(res.ru),
					type: res.type,
					tag: res.tag
				})),
			};
		} finally {
			db.close();
		}
	}

	#buildQuery(isCountQuery = false) {
		let baseQuery = isCountQuery
			? `SELECT COUNT(*) FROM ${TABLE_NAME}`
			: `SELECT * FROM ${TABLE_NAME}`;

		const queryConditions: string[] = [];
		const params: string[] = [];

		if (this.#searchValue) {
			if (/[а-яА-Я]/.test(this.#searchValue)) {
				queryConditions.push('ru MATCH ?');
				params.push(this.#escapeQuery(this.#searchValue));
			} else {
				queryConditions.push(`${TABLE_NAME} MATCH ?`);
				params.push(`en:${this.#escapeQuery(this.#searchValue)} OR ru:${this.#escapeQuery(this.#searchValue)}`);
			}
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

		// Selecting every game filters nothing but costs an extra FTS lookup over all rows.
		if (this.#games.length && this.#games.length < this.#validGames.length) {
			queryConditions.push(`${TABLE_NAME} MATCH ?`);
			params.push(this.#games.map(game => `game:^${game.replace(" ", "")}`).join(' OR '));
		}

		if (queryConditions.length) {
			baseQuery += ' WHERE ' + queryConditions.join(' AND ');
		}

		return { query: baseQuery, params };
	}
}
