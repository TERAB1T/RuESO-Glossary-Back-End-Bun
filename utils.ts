
import { VALID_GAMES } from "./glossary/constants";
import { escape } from "html-escaper";

export function escapeQuery(query: string): string {
  return query.replace(/"/g, '""').replace(/\u00A0/g, " ").replace(/[‘’]/g, "'").replace(/[“”„]/g, '""');
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
