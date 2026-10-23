/**
 * API regression check.
 *
 *   bun run check:api --save [file]      record the responses (status + body hash) of a broad set of requests
 *   bun run check:api --compare [file]   replay the same requests and report every difference
 *   bun run check:api                    only the invariants below, no snapshot
 *
 * The snapshot defaults to .checks/api.json. The request list is built from the local DB files on
 * --save and stored in the snapshot, so --compare replays exactly the same URLs.
 *
 * Every run also checks what must hold regardless of the data: no 5xx anywhere, and 404 for missing
 * books / items / categories / patches / seasons.
 *
 * Options:
 *   --base <url>         API base, default http://localhost:8000
 *   --socket <path>      go through a unix socket instead (on the server: /tmp/apiRueso.sock)
 *   --concurrency <n>    parallel requests, default 4. Use 1 against production, and only from
 *                        inside the server: bulk requests to https://rueso.ru get the IP banned.
 *
 * Exits with code 1 when a difference or a broken invariant is found.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const option = (name: string) => {
	const i = args.indexOf(name);
	return i === -1 ? undefined : args[i + 1]?.startsWith("--") ? "" : (args[i + 1] ?? "");
};

const DEFAULT_SNAPSHOT = join(import.meta.dir, "..", ".checks", "api.json");
const saveTo = option("--save");
const compareTo = option("--compare");
const base = option("--base") || "http://localhost:8000";
const socket = option("--socket") || undefined;
const concurrency = Number(option("--concurrency") || 4);

type Snapshot = { createdAt: string; responses: Record<string, string> };

const db = (name: string) => new Database(join(import.meta.dir, "..", "db", name), { readonly: true });
const column = (database: Database, sql: string) => database.query(sql).all().map(row => Object.values(row as object)[0] as string);

/** A broad request list: every item linked across the two Fallout DBs, random samples of the rest, every list. */
function buildRequestList(): string[] {
	const atx = db("f76_atx.db");
	const camp = db("f76_camp.db");
	const library = db("library.db");

	const urls = [
		...column(atx, "SELECT '/f76/atomicshop/items/' || formId FROM items WHERE campUnlockedItems != ''"),
		...column(camp, "SELECT '/f76/camp/items/' || formId FROM items WHERE unlockEntitlements != ''"),
		...column(atx, "SELECT '/f76/atomicshop/items/' || formId FROM items ORDER BY random() LIMIT 300"),
		...column(camp, "SELECT '/f76/camp/items/' || formId FROM items ORDER BY random() LIMIT 300"),
		...column(library, "SELECT '/library/books/' || id FROM books ORDER BY random() LIMIT 300"),
	];

	for (const order of ["date_desc", "name_asc"]) {
		urls.push(...column(atx, `SELECT '/f76/atomicshop/categories/' || formId || '?sort_order=${order}' FROM categories`));
		urls.push(...column(atx, `SELECT '/f76/atomicshop/subcategories/' || formId || '?page=2&sort_order=${order}' FROM subcategories`));
		urls.push(...column(camp, `SELECT '/f76/camp/categories/' || formId || '?is_pts=1&sort_order=${order}' FROM categories`));
		urls.push(...column(camp, `SELECT '/f76/camp/subcategories/' || formId || '?sort_order=${order}' FROM subcategories`));
	}

	urls.push(...column(atx, "SELECT '/f76/atomicshop/acquisition/' || type || '/' || number || '?has_support=1' FROM acquisition_sources"));
	urls.push(...column(library, "SELECT '/library/categories/' || id || '?page=1&filter=the' FROM categories"));
	urls.push(...column(library, "SELECT '/library/patches/' || version FROM patches"));
	urls.push(...column(library, "SELECT '/library/patches/' || version || '/export' FROM patches"));

	urls.push(
		"/library/categories", "/library/patches", "/library/books?page=3", "/library/books?ids=7147,7148,7149",
		"/library/books?filter=dragon", "/library/updated",
		"/f76/atomicshop/categories", "/f76/atomicshop/acquisition", "/f76/atomicshop/acquisition/season",
		"/f76/atomicshop/items?filter=door&has_support=1", "/f76/atomicshop/updated",
		"/f76/camp/categories", "/f76/camp/items?filter=chair&is_pts=1", "/f76/camp/updated",
		"/glossary/tes/updated", "/glossary/fallout/updated",
		"/glossary/tes?draw=3&start=0&length=10&search%5Bvalue%5D=dragon",
		"/glossary/tes?draw=1&start=20&length=10&search%5Bvalue%5D=%D0%BC%D0%B5%D1%87&games=eso_pts,skyrim",
		"/glossary/fallout?draw=2&start=0&length=25&search%5Bvalue%5D=vault&order%5B0%5D%5Bcolumn%5D=2&order%5B0%5D%5Bdir%5D=desc",
		"/glossary/tes?draw=1&start=0&length=50&search%5Bvalue%5D=",
	);

	return [...new Set(urls)];
}

const MUST_404 = [
	"/library/books/999999", "/library/books/abc", "/library/categories/99999", "/library/patches/99.9", "/library/patches/99.9/export",
	"/f76/atomicshop/items/deadbeef", "/f76/camp/items/deadbeef",
	"/f76/atomicshop/categories/deadbeef", "/f76/atomicshop/subcategories/deadbeef",
	"/f76/camp/categories/deadbeef", "/f76/camp/subcategories/deadbeef",
	"/f76/atomicshop/acquisition/season/999", "/f76/atomicshop/acquisition/bogus",
];

// Odd but legal input: none of it may end in a 5xx.
const ODD_INPUT = [
	"/library/books?filter=dragon&filter=sword", "/f76/atomicshop/items?sort_order=bogus", "/f76/atomicshop/items?page=2&page=3",
	"/f76/atomicshop/items?page_size=-5", "/f76/atomicshop/items?page_size=500", "/f76/atomicshop/items?page=99999999999999999999",
	"/library/books?page_size=0", "/glossary/tes?draw=1&start=abc&length=-1&search%5Bvalue%5D=dragon",
	"/glossary/tes?search%5Bvalue%5D=%22%22%22", "/f76/camp/items?filter=%22",
];

async function request(path: string): Promise<{ status: number; summary: string }> {
	const response = await fetch(base + path, socket ? { unix: socket } : undefined);
	const body = await response.text();
	return { status: response.status, summary: `${response.status} ${response.headers.get("content-type")} ${Bun.hash(body).toString(16)} ${body.length}` };
}

async function requestAll(paths: string[]): Promise<Record<string, string>> {
	const results: Record<string, string> = {};
	let next = 0;
	await Promise.all(Array.from({ length: concurrency }, async () => {
		while (next < paths.length) {
			const path = paths[next++];
			results[path] = (await request(path)).summary;
		}
	}));
	return results;
}

const pattern = (path: string) => path.replace(/[0-9a-f]{8}|\d+(\.\d+)?/g, "#").replace(/\?.*/, "");
const problems: string[] = [];

// Invariants
for (const path of MUST_404) {
	const { status } = await request(path);
	if (status !== 404) problems.push(`expected 404, got ${status}: ${path}`);
}
for (const path of ODD_INPUT) {
	const { status } = await request(path);
	if (status >= 500) problems.push(`got ${status}: ${path}`);
}
console.log(`invariants: ${MUST_404.length} not-found probes, ${ODD_INPUT.length} odd-input probes`);

// Snapshot
if (saveTo !== undefined) {
	const file = saveTo || DEFAULT_SNAPSHOT;
	const urls = buildRequestList();
	const started = performance.now();
	const responses = await requestAll(urls);
	mkdirSync(dirname(file), { recursive: true });
	await Bun.write(file, JSON.stringify({ createdAt: new Date().toISOString(), responses } satisfies Snapshot));
	console.log(`saved ${urls.length} responses to ${file} in ${((performance.now() - started) / 1000).toFixed(1)} s`);
	for (const [path, summary] of Object.entries(responses)) if (summary.startsWith("5")) problems.push(`got ${summary.split(" ")[0]}: ${path}`);
}

if (compareTo !== undefined) {
	const file = compareTo || DEFAULT_SNAPSHOT;
	const snapshot: Snapshot = await Bun.file(file).json();
	const urls = Object.keys(snapshot.responses);
	const responses = await requestAll(urls);
	const changed = urls.filter(path => responses[path] !== snapshot.responses[path]);

	const byPattern = new Map<string, number>();
	for (const path of changed) byPattern.set(pattern(path), (byPattern.get(pattern(path)) ?? 0) + 1);

	console.log(`compared ${urls.length} responses with ${file} (${snapshot.createdAt}): ${changed.length} changed`);
	for (const [p, n] of byPattern) console.log(`  ${String(n).padStart(5)}  ${p}`);
	for (const path of changed.slice(0, 10)) console.log(`  ${path}\n     before: ${snapshot.responses[path]}\n     after:  ${responses[path]}`);
	if (changed.length) problems.push(`${changed.length} responses changed`);
}

if (problems.length) {
	console.log(`\nFAILED:\n  ${problems.slice(0, 20).join("\n  ")}`);
	process.exit(1);
}
console.log("\nOK");
