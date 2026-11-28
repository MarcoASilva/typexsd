import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	build,
	createBuilder,
	createParser,
	generateTypes,
	loadSchema,
	loadSchemaSync,
	parse,
} from "../src";
import { document } from "./fixtures/openimmo-1.2.7b/document";
import type { Openimmo } from "./fixtures/openimmo-1.2.7b/interfaces";
import { expectValidAgainstXsd, typecheckFile } from "./helpers";

/**
 * Black-box contract of the library, exercised only through its public API.
 *
 * The fixtures are golden files and must stay mutually consistent:
 * - `schema.xsd`     the input XSD
 * - `interfaces.ts`  exactly what `generateTypes(schema.xsd)` emits
 * - `document.ts`    an object typed by `interfaces.ts`
 * - `document.xml`   exactly what building `document.ts` emits; valid against `schema.xsd`
 *
 * A failure here means the library's observable behaviour changed. Only update
 * a fixture when that change is intended.
 */

const fixtures = join(__dirname, "fixtures", "openimmo-1.2.7b");
const xsdPath = join(fixtures, "schema.xsd");
const read = (file: string) => readFileSync(join(fixtures, file), "utf8");
const root = "openimmo";

describe("OpenImmo 1.2.7b", () => {
	const schema = loadSchemaSync(xsdPath);
	const buildXml = createBuilder(schema);
	const parseXml = createParser<Openimmo>(schema);
	const documentXml = read("document.xml");

	describe("XSD -> TypeScript types", () => {
		it("compiles the XSD without errors", () => {
			expect(
				schema.diagnostics.filter(d => d.severity === "error"),
			).toEqual([]);
		});

		it("generates exactly the committed interfaces", () => {
			expect(generateTypes(schema)).toBe(read("interfaces.ts"));
		});

		it("accepts the fixture document as a strictly typed value", () => {
			expect(typecheckFile(join(fixtures, "document.ts"))).toEqual([]);
		});
	});

	describe("object -> XML -> object", () => {
		const xml = buildXml(document, root);

		it("builds XML that is valid against the XSD", async () => {
			await expectValidAgainstXsd(xml, xsdPath);
		});

		it("builds the committed XML byte for byte", () => {
			expect(xml).toBe(documentXml);
		});

		it("parses the built XML back into the original object", () => {
			expect(parseXml(xml)).toStrictEqual(document.openimmo);
		});
	});

	describe("XML -> object -> XML", () => {
		const parsed = parseXml(documentXml);
		const rebuilt = buildXml({ [root]: parsed }, root);

		it("starts from XML that is valid against the XSD", async () => {
			await expectValidAgainstXsd(documentXml, xsdPath);
		});

		it("parses the XML into the committed object", () => {
			expect(parsed).toStrictEqual(document.openimmo);
		});

		it("rebuilds the original XML byte for byte", () => {
			expect(rebuilt).toBe(documentXml);
		});

		it("rebuilds XML that is valid against the XSD", async () => {
			await expectValidAgainstXsd(rebuilt, xsdPath);
		});
	});

	describe("every entry point behaves the same", () => {
		it("async loadSchema", async () => {
			const asyncSchema = await loadSchema(xsdPath);
			expect(createBuilder(asyncSchema)(document, root)).toBe(
				documentXml,
			);
			expect(createParser(asyncSchema)(documentXml)).toStrictEqual(
				document.openimmo,
			);
		});

		it("one-shot build and parse from the XSD path", () => {
			expect(build({ xsdFilePath: xsdPath }, document, root)).toBe(
				documentXml,
			);
			expect(parse(documentXml, xsdPath)).toStrictEqual(
				document.openimmo,
			);
		});
	});
});
