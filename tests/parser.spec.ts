import stubDefaultPrimitivesParsedXml from './stubs/default-primitives-parsed-xml.json';
import stubSchemaCompliantPrimitivesParsedXml from './stubs/schema-compliant-primitives-parsed-xml.json';
import { parse } from '../src/parser/parser';
import { join } from 'path';
import assert from 'assert';
import { readFileSync } from 'fs';
import extractFields from '../src/codegen/extract-fields';

const xsdFilePath = join(__dirname, 'assets', 'openimmo_127b.xsd');
const xmlFilePath = join(__dirname, 'assets', 'openimmo-data_127.xml');
const xml = readFileSync(xmlFilePath).toString();

describe('parser', () => {
    it('yeld same json given the same xml (defaultPrimitivesParser)', () => {
        const object = parse(xml);
        assert.equal(
            JSON.stringify(object),
            JSON.stringify(stubDefaultPrimitivesParsedXml),
        );
    });
    it('yeld same json given the same xml (schemaCompliantPrimitivesParser)', () => {
        const object = parse(xml, extractFields(xsdFilePath));
        assert.equal(
            JSON.stringify(object),
            JSON.stringify(stubSchemaCompliantPrimitivesParsedXml),
        );
    });
});
