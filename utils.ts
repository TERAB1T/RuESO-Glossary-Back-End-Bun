
import { VALID_GAMES } from "./constants";
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
  
  export function validateGames(games: string[]): string[] {
    return Array.from(new Set(games).intersection(new Set(VALID_GAMES)));
}