import { deepStrictEqual } from "node:assert";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBuilder, createParser, loadSchemaSync } from "../src";
import type { Openimmo, Schema } from "./interfaces";
import { stubOpenImmoObj } from "./openimmo-full-stub";

/**
 * This example file performs a sanity check on this lib's xml parser <-> builder
 *
 * - In theory if you create an object using the same xsd and the generated interfaces
 * you should be able to build a valid XML if there are no type errors (facetless - facets are only partially supported via zod generation - see README)
 *
 * - Also, in theory, if you parse back the generated XML, it should be strictly equal to the original (the one used to generate the XML in first place)
 *
 */

// compile the XSD once; the builder and the parser share it
const compiledXsd = loadSchemaSync(join(__dirname, "openimmo_127b.xsd"));

const build = createBuilder(compiledXsd);
const parse = createParser<Openimmo>(compiledXsd);

// myOpenImmoSchemaObj.openimmo -> XML (compliant to openimmo_127b.xsd)
const myOpenImmoObjToXml = build(stubOpenImmoObj, "openimmo");

// this should represent myOpenImmoSchemaObj['openimmo']
const myOpenImmoXmlParsedBackToJs = parse(myOpenImmoObjToXml);

/**
 * the original openimmo object declared in L#7 should match the one parsed back from it's generated xml
 * otherwise the lib has a building/parsing drift
 */
deepStrictEqual(stubOpenImmoObj.openimmo, myOpenImmoXmlParsedBackToJs);

// biome-ignore lint/suspicious/noConsole: <example file>
console.log("object -> xml -> object round-trip ok");

// writeFileSync(join(__dirname, "my-open-immo-2.xml"), myOpenImmoObjToXml);
