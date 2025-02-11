import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors'
import { validateGames } from "./utils";
import { searchTerm } from "./db/db_search";

const app = new Elysia()
  .use(cors({
    origin: [
      "http://rueso.ru",
      "https://rueso.ru",
      "http://127.0.0.1",
      "http://127.0.0.1:5500",
    ],
  }))
  .get("/search", async ({ query }) => {
    const draw = query.draw || "1";
    const start = Number(query.start) || 0;
    const length = Number(query.length) || 10;
    const searchValue = query["search[value]"] || "";
    const orderColumnIndex = query["order[0][column]"];
    const orderDir = query["order[0][dir]"]?.toUpperCase() || "ASC";
    const games = query.games ? query.games.split(",") : [];

    const filters = [
      query["columns[0][search][value]"],
      query["columns[1][search][value]"],
      query["columns[2][search][value]"],
      query["columns[3][search][value]"],
    ];

    const columns = ["game", "type", "en", "ru"];
    const orderColumn = orderColumnIndex !== undefined ? columns[Number(orderColumnIndex)] : null;

    const result = searchTerm(searchValue, start, length, orderColumn, orderDir, validateGames(games), filters);

    return {
      draw,
      recordsTotal: result.recordsTotal,
      recordsFiltered: result.recordsFiltered,
      data: result.data,
    };
  })
  .listen(8000);

console.log(`Server running on http://localhost:8000`);
