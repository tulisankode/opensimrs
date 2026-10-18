import { readFileSync } from "node:fs";
JSON.parse(readFileSync("database/data/katalog-modul.json", "utf8"));
console.log("json ok");
