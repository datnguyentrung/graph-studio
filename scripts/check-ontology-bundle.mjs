import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const JS_BUDGET_BYTES = 225 * 1024;
const DATA_BUDGET_BYTES = 350 * 1024;
const distDirectory = path.resolve("dist");
const manifest = JSON.parse(
  await readFile(path.join(distDirectory, ".vite", "manifest.json"), "utf8"),
);

function findManifestKey(predicate, label) {
  const key = Object.keys(manifest).find(predicate);
  if (!key) throw new Error(`Could not find ${label} in the Vite manifest.`);
  return key;
}

function isOntologyDataKey(key) {
  return key.replaceAll("\\", "/").includes("data/ontology/");
}

const entryKey = findManifestKey(
  (key) => manifest[key].isEntry,
  "the application entry",
);
const ontologyRouteKey = findManifestKey(
  (key) => key.replaceAll("\\", "/").endsWith("src/pages/ontology/OntologyPage.tsx"),
  "the Ontology route",
);
const defaultOntologyKey = findManifestKey(
  (key) =>
    key.replaceAll("\\", "/").split("?", 1)[0]
      .endsWith("data/ontology/all.ontology.json"),
  "the default ontology chunk",
);

const selectedKeys = new Set();
function collectStatic(key) {
  if (selectedKeys.has(key) || !manifest[key]) return;
  selectedKeys.add(key);
  for (const importedKey of manifest[key].imports ?? []) collectStatic(importedKey);
}

function collectOntologyRuntime(key) {
  if (selectedKeys.has(key) || !manifest[key] || isOntologyDataKey(key)) return;
  selectedKeys.add(key);
  for (const importedKey of manifest[key].imports ?? []) {
    collectOntologyRuntime(importedKey);
  }
  for (const dynamicKey of manifest[key].dynamicImports ?? []) {
    collectOntologyRuntime(dynamicKey);
  }
}

collectStatic(entryKey);
collectOntologyRuntime(ontologyRouteKey);

async function gzipSizeForKeys(keys) {
  const files = new Set(
    [...keys]
      .map((key) => manifest[key]?.file)
      .filter((file) => typeof file === "string" && file.endsWith(".js")),
  );
  let total = 0;
  for (const file of files) {
    total += gzipSync(await readFile(path.join(distDirectory, file))).byteLength;
  }
  return { total, files };
}

const js = await gzipSizeForKeys(selectedKeys);
const dataFile = manifest[defaultOntologyKey].file;
const dataBytes = gzipSync(
  await readFile(path.join(distDirectory, dataFile)),
).byteLength;
const kb = (bytes) => (bytes / 1024).toFixed(1);

console.log(
  `Ontology JS: ${kb(js.total)} KB gzip across ${js.files.size} chunks ` +
    `(budget ${kb(JS_BUDGET_BYTES)} KB)`,
);
console.log(
  `Default ontology: ${kb(dataBytes)} KB gzip (budget ${kb(DATA_BUDGET_BYTES)} KB)`,
);

if (js.total > JS_BUDGET_BYTES || dataBytes > DATA_BUDGET_BYTES) {
  process.exitCode = 1;
}
