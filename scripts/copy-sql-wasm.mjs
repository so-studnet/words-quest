// Copy sql.js's WebAssembly next to the site so the Anki export can load it (/sql-wasm.wasm).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const from = "node_modules/sql.js/dist/sql-wasm.wasm";
if (existsSync(from)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(from, "public/sql-wasm.wasm");
}
