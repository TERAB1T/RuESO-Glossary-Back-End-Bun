import { Database } from "bun:sqlite";
import { statSync } from "node:fs";

// Long enough for a request that awaits between queries to finish on the old file.
const CLOSE_DELAY_MS = 60_000;

// Windows refuses to delete a file that is open, and the local generators (the parser, the library
// generator) delete the DB before rebuilding it. So in local development a connection is closed once
// it has been idle for a moment.
const WINDOWS_IDLE_CLOSE_MS = 1_000;
const isWindows = process.platform === "win32";

type Connection = { db: Database; ino: number; idleTimer?: ReturnType<typeof setTimeout> };

const connections = new Map<string, Connection>();

/**
 * Returns a shared read-only connection to the SQLite file at `path`.
 *
 * DB updates replace the file with an atomic rename, which gives it a new inode. When that happens,
 * a new connection is opened and the old one, which still reads the replaced file, is closed later.
 */
export function getDb(path: string): Database {
	const { ino } = statSync(path);
	let connection = connections.get(path);

	if (connection && connection.ino !== ino) {
		const replaced = connection;
		clearTimeout(replaced.idleTimer);
		setTimeout(() => replaced.db.close(), CLOSE_DELAY_MS);
		connection = undefined;
	}

	if (!connection) {
		connection = { db: new Database(path, { readonly: true }), ino };
		connections.set(path, connection);
	}

	if (isWindows) {
		const current = connection;
		clearTimeout(current.idleTimer);
		current.idleTimer = setTimeout(() => {
			connections.delete(path);
			current.db.close();
		}, WINDOWS_IDLE_CLOSE_MS);
	}

	return connection.db;
}
