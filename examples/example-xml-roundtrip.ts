import assert, { deepStrictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateXML } from "xsd-schema-validator";
import { createBuilder, createParser, loadSchemaSync } from "../src";
import type { Openimmo } from "./interfaces";

/**
 * This example file performs a sanity check on this lib's xml parser <-> builder
 * the other way around from `example.ts`.
 *
 * - Start from a schema-valid XML document
 * - Parse it to a JS object typed by the generated interfaces
 * - Build that object back to XML
 * - Assert the rebuilt XML is strictly equal to the original
 *
 * If this drifts, the lib is losing or reordering information across parse/build.
 */

const originalXml = readFileSync(
	join(__dirname, "openimmo-full-stub.xml"),
	"utf8",
);

// compile the XSD once; the builder and the parser share it
const compiledXsd = loadSchemaSync(join(__dirname, "openimmo_127b.xsd"));

const build = createBuilder(compiledXsd);
const parse = createParser<Openimmo>(compiledXsd);

// originalXml -> JS object (compliant to openimmo_127b.xsd / interfaces)
const parsed = parse(originalXml);

// parsed object -> XML again
const rebuiltXml = build({ openimmo: parsed }, "openimmo");

/**
 * the original XML should match the one rebuilt from its parsed object
 * otherwise the lib has a parsing/building drift
 */
deepStrictEqual(originalXml, rebuiltXml);

Promise.allSettled([
	validateXML(originalXml, join(__dirname, "openimmo_127b.xsd")).then(
		result => {
			try {
				assert(result.valid);
			} catch (_) {
				// biome-ignore lint/suspicious/noConsole: <log validation errors>
				console.log(result.messages);
				process.exit(1);
			}
		},
	),
	validateXML(rebuiltXml, join(__dirname, "openimmo_127b.xsd")).then(
		result => {
			try {
				assert(result.valid);
			} catch (_) {
				// biome-ignore lint/suspicious/noConsole: <log validation errors>
				console.log(result.messages);
				process.exit(1);
			}
		},
	),
]).then(() => {
	// biome-ignore lint/suspicious/noConsole: <example file>
	console.log("xml -> object -> xml round-trip ok");
});
