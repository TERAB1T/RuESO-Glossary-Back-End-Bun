import { Database } from "bun:sqlite";
import { getFileLastModifiedDate } from "../utils";
import { TES_DB_PATHS, FALLOUT_DB_PATHS, type GlossaryServer } from "./constants";

type ServerInfo = { lastModified: string, version: string | null } | null;

export class GlossaryUpdated {
	#dbPaths: Record<GlossaryServer, string>;

	constructor(game: string) {
		this.#dbPaths = game === 'fallout' ? FALLOUT_DB_PATHS : TES_DB_PATHS;
	}

	async getUpdated(): Promise<Record<GlossaryServer, ServerInfo>> {
		const [live, pts] = await Promise.all([
			this.#getServerInfo(this.#dbPaths.live),
			this.#getServerInfo(this.#dbPaths.pts),
		]);

		return { live, pts };
	}

	async #getServerInfo(dbPath: string): Promise<ServerInfo> {
		if (!(await Bun.file(dbPath).exists())) return null;

		const db = new Database(dbPath, { readonly: true });

		try {
			const row = db.query("SELECT value FROM meta WHERE key = 'version'").get() as { value: string } | null;

			return {
				lastModified: await getFileLastModifiedDate(dbPath),
				version: row?.value ?? null,
			};
		} finally {
			db.close();
		}
	}
}
