import { escape } from "html-escaper";

export function escapeQuery(query: string): string {
	let escaped = query.replace(/"/g, '""').replace(/ /g, ' ');
	escaped = escaped.replace(/[‘’]/g, "'").replace(/[“”„]/g, '""');
	return `"${escaped}"`;
}

export function prepareHtml(str: string | null): string {
	if (!str) {
		return "";
	}
	return escape(str).replace(/(\r\n|\n|\r)/g, "<br>");
}

export function isInteger(value: unknown): boolean {
	if (typeof value === "number") {
		return Number.isInteger(value) && value > 0;
	}

	if (typeof value === "string" && /^\d+$/.test(value)) {
		return parseInt(value) > 0;
	}

	return false;
}

export function isHex(value: any): boolean {
	return typeof value === 'string' && /^[0-9a-f]+$/i.test(value);
}

export function parseIds(ids: unknown): number[] {
	if (typeof ids === "string" && /^[\d,]+$/.test(ids)) {
		return ids.split(",").filter(x => x !== "").map(Number);
	}

	return [];
}

export async function getFileLastModifiedDate(path: string): Promise<string> {
	const timestamp = await Bun.file(path).lastModified;

	return new Intl.DateTimeFormat("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(timestamp);
}

export function getF76AtxOrderClause(order: string): string {
	switch (order) {
		case "date_desc":
			return "ORDER BY orderByFormId DESC";
		case "date_asc":
			return "ORDER BY orderByFormId ASC";
		case "name_desc":
			return "ORDER BY orderByName DESC";
		case "name_asc":
			return "ORDER BY orderByName ASC";
		default:
			return "ORDER BY orderByFormId DESC";
	}
}