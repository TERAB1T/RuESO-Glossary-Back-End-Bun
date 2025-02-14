import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { GlossarySearch } from "./glossary/_search";

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
    const glossarySearch = new GlossarySearch(query);
    return await glossarySearch.searchTerm();
  })
  .listen(8000);

console.log(`Server running on http://localhost:8000`);
