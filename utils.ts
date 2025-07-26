
import { VALID_GAMES } from "./glossary/constants";
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
	return escape(str).replace(/\n/g, "<br>");
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
