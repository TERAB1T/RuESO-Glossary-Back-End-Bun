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

const MAX_IDS = 200;

export function parseIds(ids: unknown): number[] {
	if (typeof ids === "string" && /^[\d,]+$/.test(ids)) {
		return ids.split(",").filter(x => x !== "").map(Number).slice(0, MAX_IDS);
	}

	return [];
}

// Far above any real page; keeps (page - 1) * pageSize a safe integer for SQLite's OFFSET.
const MAX_PAGE = 100_000;

export interface ListQuery {
	page: number;
	pageSize: number;
	filter: string;
	order: string;
	isPTS: boolean;
	hasSupport: boolean;
}

/** Reads the paging, filter and sorting params shared by the list endpoints. */
export function parseListQuery(
	query: Record<string, string | undefined>,
	defaultPageSize: number,
	maxPageSize: number,
	validSortOrders: string[] = []
): ListQuery {
	const isTrue = (value?: string) => value === "1" || value === "true";

	return {
		page: isInteger(query.page) ? Math.min(parseInt(query.page!), MAX_PAGE) : 1,
		pageSize: isInteger(query.page_size) ? Math.min(parseInt(query.page_size!), maxPageSize) : defaultPageSize,
		filter: query.filter ?? "",
		order: validSortOrders.includes(query.sort_order ?? "") ? query.sort_order! : validSortOrders[0] ?? "",
		isPTS: isTrue(query.is_pts),
		hasSupport: isTrue(query.has_support),
	};
}

export async function getFileLastModifiedDate(path: string): Promise<string> {
	const timestamp = await Bun.file(path).lastModified;

	return new Intl.DateTimeFormat("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(timestamp);
}
